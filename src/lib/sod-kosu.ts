// SoD değerlendirme koşusu — ORTAK yardımcı (docs/ROADMAP.md M16, kural 11).
//
// NEDEN AYRI DOSYA: aynı koşu iki yerden tetiklenir — (1) elle "Değerlendir"
// rotası (/api/sod/degerlendir), (2) import sonrası transactional-outbox
// drenajı (/api/sod/outbox/isle, PR-3B). İki kopya, iki gerçek demektir; upsert
// kararı ve koşu kaydı tek yerde kalmalı ki import-tetikli değerlendirme ile
// elle değerlendirme AYNI sonucu versin.
//
// SAF DEĞİL (I/O yapar) ama DETERMİNİSTİK ÇEKİRDEĞE dayanır: motor (src/lib/
// sod.ts) saf; bu yardımcı yalnız DB okuma + koşu kaydı + çatışma upsert'ini
// sarmalar. "Artık mevcut olmayan çatışmayı SİLMEZ" ilkesi (kural 2) korunur.
import { atamaSnapshotHash, kuralSetiHash, sodDegerlendir, type SodAtama, type SodKural } from "./sod";
import type { Database } from "./supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SodKosuSonucu {
  calistirmaId: string;
  bulunanSayisi: number;
  yeniSayisi: number;
}

type TarafRow = {
  rule_id: string;
  taraf: string;
  aktivite_kodu: string;
  rol_kodu: string | null;
  sistem_kapsami: string | null;
};

/**
 * Tenant'ın aktif kurallarını + atamalarını RLS altında çeker, motoru koşar,
 * koşuyu kaydeder, çatışmaları upsert eder. `db` çağıranın (kullanıcı oturumlu)
 * client'ıdır — böylece RLS ve audit atıfı (auth.uid) doğru kişiye işler.
 *
 * `tetik`: koşunun ne tetiklediği (elle | import-outbox) — audit/izlenebilirlik
 * için koşu kaydına yazılmaz (şemada alan yok) ama çağıranın niyetini belgeler.
 */
export async function sodKosuyuYurut(
  db: SupabaseClient<Database>,
  tenantId: string,
  calistiranId: string,
): Promise<{ sonuc: SodKosuSonucu | null; hata: string | null }> {
  const baslamaAt = new Date().toISOString();

  const [{ data: kurallarRow }, { data: taraflarRow }, { data: atamalarRow }] = await Promise.all([
    db.from("sod_kurallari").select("id, durum, onem").eq("durum", "aktif"),
    db.from("sod_kural_taraflari").select("rule_id, taraf, aktivite_kodu, rol_kodu, sistem_kapsami"),
    db.from("sod_atamalari").select("kullanici_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami"),
  ]);

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
      calistiran: calistiranId,
    })
    .select("id")
    .single();
  if (calistirmaErr) {
    return { sonuc: null, hata: calistirmaErr.message };
  }
  if (hata) {
    return { sonuc: null, hata };
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

  await db.from("sod_degerlendirme_calistirmalari").update({ yeni_sayisi: yeniSayisi }).eq("id", calistirma.id);

  return { sonuc: { calistirmaId: calistirma.id, bulunanSayisi: sonuclar.length, yeniSayisi }, hata: null };
}
