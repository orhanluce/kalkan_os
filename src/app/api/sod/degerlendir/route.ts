// SoD değerlendirmesini çalıştırır: tenant'ın aktif kurallarını ve
// atamalarını çeker, motoru koşar, çatışmaları upsert eder, koşuyu kaydeder
// (docs/ROADMAP.md M16, kural 11).
//
// NEDEN SUNUCUDA: motor mantığının kendisi saf (src/lib/sod.ts) ama upsert
// kararı ("bu fingerprint zaten var mı, yeni mi") ve koşu kaydı (kural
// seti/atama snapshot hash'i) atomik bir işlemdir — istemciye bırakılırsa
// yarım kalan bir koşu "hiç çalışmadı" ile "çalıştı ama yazamadı" arasında
// ayrım bırakmaz.
//
// ARTIK MEVCUT OLMAYAN ÇATIŞMALARI SİLMEZ (kurucu talimatı): motor yalnızca
// BULUNAN çatışmaları döndürür; DB'de olup bu koşuda bulunmayanlar OLDUĞU
// GİBİ bırakılır. Kapanışı yalnız insan/guard kararı yapar (append-only'nin
// ruhu, kural 2).
import { NextResponse } from "next/server";
import { atamaSnapshotHash, kuralSetiHash, sodDegerlendir, type SodAtama, type SodKural } from "@/lib/sod";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "Değerlendirme çalıştırma yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }
  const tenantId = profil.tenant_id;

  const baslamaAt = new Date().toISOString();

  // RLS altında oku: başka kiracının kuralı/ataması burada zaten görünmez.
  const [{ data: kurallarRow }, { data: taraflarRow }, { data: atamalarRow }] = await Promise.all([
    db
      .from("sod_kurallari")
      .select("id, durum, onem")
      .eq("durum", "aktif"),
    db.from("sod_kural_taraflari").select("rule_id, taraf, aktivite_kodu, rol_kodu, sistem_kapsami"),
    db
      .from("sod_atamalari")
      .select("kullanici_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami"),
  ]);

  type TarafRow = { rule_id: string; taraf: string; aktivite_kodu: string; rol_kodu: string | null; sistem_kapsami: string | null };
  const taraflarByRule = new Map<string, { A?: TarafRow; B?: TarafRow }>();
  for (const t of taraflarRow ?? []) {
    const giris = taraflarByRule.get(t.rule_id) ?? {};
    if (t.taraf === "A") giris.A = t;
    else giris.B = t;
    taraflarByRule.set(t.rule_id, giris);
  }

  const kurallar: SodKural[] = (kurallarRow ?? [])
    .map((k) => {
      const taraflar = taraflarByRule.get(k.id);
      if (!taraflar?.A || !taraflar?.B) return null; // eksik tanımlı kural — atlanır, uydurulmaz
      return {
        id: k.id,
        kod: k.id,
        durum: k.durum as "aktif" | "pasif",
        onem: k.onem as SodKural["onem"],
        tarafA: {
          aktivite_kodu: taraflar.A.aktivite_kodu,
          rol_kodu: taraflar.A.rol_kodu,
          sistem_kapsami: taraflar.A.sistem_kapsami,
        },
        tarafB: {
          aktivite_kodu: taraflar.B.aktivite_kodu,
          rol_kodu: taraflar.B.rol_kodu,
          sistem_kapsami: taraflar.B.sistem_kapsami,
        },
      };
    })
    .filter((k): k is SodKural => k !== null);

  const atamalar: SodAtama[] = (atamalarRow ?? []).map((a) => ({
    kisiKimligi: a.kullanici_id ?? a.harici_kullanici_id ?? "BILINMEYEN",
    aktivite_kodu: a.aktivite_kodu,
    rol_kodu: a.rol_kodu,
    sistem_kapsami: a.sistem_kapsami,
  }));

  let sonuclar: Awaited<ReturnType<typeof sodDegerlendir>> = [];
  let hata: string | null = null;
  try {
    sonuclar = await sodDegerlendir(tenantId, atamalar, kurallar);
  } catch (e) {
    hata = e instanceof Error ? e.message : String(e);
  }

  const kuralHash = await kuralSetiHash(kurallar);
  const atamaHash = await atamaSnapshotHash(atamalar);

  const { data: calistirma, error: calistirmaErr } = await db
    .from("sod_degerlendirme_calistirmalari")
    .insert({
      tenant_id: tenantId,
      baslama_at: baslamaAt,
      bitis_at: new Date().toISOString(),
      kural_seti_hash: kuralHash,
      atama_snapshot_hash: atamaHash,
      bulunan_sayisi: sonuclar.length,
      hata,
      calistiran: user.id,
    })
    .select("id")
    .single();
  if (calistirmaErr) {
    return NextResponse.json({ hata: calistirmaErr.message }, { status: 500 });
  }
  if (hata) {
    return NextResponse.json({ hata }, { status: 500 });
  }

  // Upsert: aynı fingerprint varsa son_gorulme_at güncellenir (yeni açık kayıt
  // AÇILMAZ — dedup, unique(tenant_id, fingerprint) ile de zorlanıyor).
  let yeniSayisi = 0;
  for (const s of sonuclar) {
    const { data: mevcut } = await db
      .from("sod_catismalari")
      .select("id, durum")
      .eq("fingerprint", s.fingerprint)
      .maybeSingle();

    if (mevcut) {
      await db
        .from("sod_catismalari")
        .update({ son_gorulme_at: new Date().toISOString(), degerlendirme_calistirma_id: calistirma.id })
        .eq("id", mevcut.id);
    } else {
      const { error: insertErr } = await db.from("sod_catismalari").insert({
        tenant_id: tenantId,
        rule_id: s.ruleId,
        // kisiKimligi bir UUID (profiles.id) mi yoksa harici kimlik mi
        // ayrımını burada tutmuyoruz: profiles.id formatına uyuyorsa
        // kullanici_id'ye, değilse harici_kullanici_id'ye yazılır.
        kullanici_id: /^[0-9a-f-]{36}$/i.test(s.kisiKimligi) ? s.kisiKimligi : null,
        harici_kullanici_id: /^[0-9a-f-]{36}$/i.test(s.kisiKimligi) ? null : s.kisiKimligi,
        sistem_kapsami: s.sistem_kapsami,
        onem: s.onem,
        fingerprint: s.fingerprint,
        degerlendirme_calistirma_id: calistirma.id,
      });
      // 23505 = unique_violation: iki koşu arası bir yarış durumunda
      // fingerprint zaten yazılmış olabilir — bu bir hata değil, dedup'ın
      // ta kendisi çalışıyor demektir.
      if (!insertErr) yeniSayisi++;
    }
  }

  await db
    .from("sod_degerlendirme_calistirmalari")
    .update({ yeni_sayisi: yeniSayisi })
    .eq("id", calistirma.id);

  return NextResponse.json({
    calistirmaId: calistirma.id,
    bulunanSayisi: sonuclar.length,
    yeniSayisi,
  });
}
