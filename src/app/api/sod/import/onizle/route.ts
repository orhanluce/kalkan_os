// SoD atama içe aktarma — dry-run önizleme (docs/ROADMAP.md M16 PR-3A).
//
// SALT OKUR: bu rota HİÇBİR atamayı değiştirmez. CSV'yi güvenlik kontrolünden
// geçirir, normalleştirir, mevcut atamalarla farkını hesaplar, bütünlük
// hash'leri üretir ve bir ÖNİZLEME satırı yazar (önizleme bir atama değildir).
// Apply PR-3B'de; önizleme oradaki 409 IMPORT_PREVIEW_STALE kontrolü için
// hash'leri saklar.
import { NextResponse } from "next/server";
import {
  atamaSnapshotHash,
  kuralSetiHash,
  sodDegerlendir,
  type SodAtama,
  type SodKural,
} from "@/lib/sod";
import {
  csvAyristir,
  csvDosyasiKabulEdilebilirMi,
  diffHesapla,
  dosyaHash,
  kayitlarHash,
  normalize,
  type ImportMode,
  type MevcutAtama,
} from "@/lib/sod-import";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  // İçe aktarma önizleme yetkisi (PR-3A: admin/uyum; ince taneli yetenek #6/#9'da).
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "İçe aktarma önizleme yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }
  if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });
  const tenantId = profil.tenant_id;

  const govde = (await req.json().catch(() => ({}))) as {
    csvBase64?: string;
    mode?: string;
    kaynak?: string;
    dosyaAdi?: string;
    mimeType?: string;
  };
  const mode: ImportMode = govde.mode === "AUTHORITATIVE_SNAPSHOT" ? "AUTHORITATIVE_SNAPSHOT" : "DELTA";
  const kaynak = (govde.kaynak ?? "").trim();
  if (!kaynak) {
    return NextResponse.json({ hata: "Kaynak (source) zorunlu." }, { status: 400 });
  }
  if (!govde.csvBase64) {
    return NextResponse.json({ hata: "csvBase64 zorunlu." }, { status: 400 });
  }

  // Kapı kontrolü (PR-3D, MIME borcu): uzantı + beyan edilen tür. İçerik
  // güvenliği (null-byte/boyut/formula) aşağıda csvAyristir'da ayrıca koşar —
  // bu yalnız ilk katman, beyan spoof edilebilir.
  const dosyaKabul = csvDosyasiKabulEdilebilirMi(govde.dosyaAdi ?? "import.csv", govde.mimeType ?? "");
  if (!dosyaKabul.kabul) {
    return NextResponse.json(
      { durum: "INVALID", dosyaHatasi: { kod: "DOSYA_TURU", neden: dosyaKabul.neden } },
      { status: 200 },
    );
  }

  // Ham baytları koru: fileHash bunların üzerinedir.
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(govde.csvBase64, "base64"));
  } catch {
    return NextResponse.json({ hata: "csvBase64 çözülemedi." }, { status: 400 });
  }
  const metin = new TextDecoder("utf-8").decode(bytes);
  const fileHash = await dosyaHash(bytes);

  const ayristirma = csvAyristir(metin, bytes.byteLength);

  // Dosya-seviyesi hata: dry-run PATLAMAZ, INVALID önizleme yazar ve raporlar.
  if (ayristirma.dosyaHatasi) {
    return NextResponse.json(
      { durum: "INVALID", dosyaHatasi: ayristirma.dosyaHatasi },
      { status: 200 },
    );
  }

  const { kayitlar, satirHatalari, duplicateler } = normalize(ayristirma.basliklar, ayristirma.satirlar);

  // --- Mevcut durum (RLS altında, yalnız bu kiracı — cross-tenant eşleşme yok) ---
  const [{ data: atamalarRow }, { data: kurallarRow }, { data: taraflarRow }, { data: catismalarRow }] =
    await Promise.all([
      db
        .from("sod_atamalari")
        .select(
          "kullanici_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami, kaynak_sistem, source_record_id, gecerlilik_baslangic, gecerlilik_bitis",
        ),
      db.from("sod_kurallari").select("id, durum, onem").eq("durum", "aktif"),
      db.from("sod_kural_taraflari").select("rule_id, taraf, aktivite_kodu, rol_kodu, sistem_kapsami"),
      db.from("sod_catismalari").select("fingerprint, durum"),
    ]);

  const mevcutAtamalar: MevcutAtama[] = (atamalarRow ?? []).map((a) => ({
    source_record_id: a.source_record_id,
    kaynak_sistem: a.kaynak_sistem,
    aktivite_kodu: a.aktivite_kodu,
    rol_kodu: a.rol_kodu,
    sistem_kapsami: a.sistem_kapsami,
    gecerlilik_baslangic: a.gecerlilik_baslangic,
    gecerlilik_bitis: a.gecerlilik_bitis,
  }));

  const diff = diffHesapla(kayitlar, mevcutAtamalar, mode, kaynak);

  // --- Bütünlük hash'leri (apply anında yeniden doğrulanır) ---
  const mevcutSodAtamalar: SodAtama[] = (atamalarRow ?? []).map((a) => ({
    kisiKimligi: a.kullanici_id ?? a.harici_kullanici_id ?? "BILINMEYEN",
    aktivite_kodu: a.aktivite_kodu,
    rol_kodu: a.rol_kodu,
    sistem_kapsami: a.sistem_kapsami,
  }));
  const assignmentSnapshotHash = await atamaSnapshotHash(mevcutSodAtamalar);
  const normalizedRecordsHash = await kayitlarHash(kayitlar);

  // Kuralları motor girdisine çevir (degerlendir rotasıyla aynı desen).
  type TarafRow = { rule_id: string; taraf: string; aktivite_kodu: string; rol_kodu: string | null; sistem_kapsami: string | null };
  const taraflarByRule = new Map<string, { A?: TarafRow; B?: TarafRow }>();
  for (const t of taraflarRow ?? []) {
    const giris = taraflarByRule.get(t.rule_id) ?? {};
    if (t.taraf === "A") giris.A = t as TarafRow;
    else giris.B = t as TarafRow;
    taraflarByRule.set(t.rule_id, giris);
  }
  const kurallar: SodKural[] = (kurallarRow ?? [])
    .map((k) => {
      const taraflar = taraflarByRule.get(k.id);
      if (!taraflar?.A || !taraflar?.B) return null;
      return {
        id: k.id,
        kod: k.id,
        durum: k.durum as "aktif" | "pasif",
        onem: k.onem as SodKural["onem"],
        tarafA: { aktivite_kodu: taraflar.A.aktivite_kodu, rol_kodu: taraflar.A.rol_kodu, sistem_kapsami: taraflar.A.sistem_kapsami },
        tarafB: { aktivite_kodu: taraflar.B.aktivite_kodu, rol_kodu: taraflar.B.rol_kodu, sistem_kapsami: taraflar.B.sistem_kapsami },
      };
    })
    .filter((k): k is SodKural => k !== null);
  const ruleSetVersion = await kuralSetiHash(kurallar);

  // --- Beklenen yeni çatışmalar (TAHMİN): projeksiyon + motor ---
  // İçe aktarılan kayıtların kimliği `kaynak:externalSubjectId` (harici) olarak
  // alınır — 3A'da tam kimlik çözümlemesi yok, bu bir TAHMİNDİR. Sona erdirilecek
  // ve güncellenen-eski atamalar projeksiyondan çıkarılır.
  const SEP = String.fromCharCode(31);
  const bitecekAnahtarlar = new Set(
    [...diff.sonaErdirilecek, ...diff.guncellenecek.map((g) => g.onceki)]
      .filter((a): a is MevcutAtama => a !== undefined)
      .map((a) => `${a.kaynak_sistem}${SEP}${a.source_record_id}`),
  );
  const projeksiyon: SodAtama[] = (atamalarRow ?? [])
    .filter((a) => !(a.source_record_id && bitecekAnahtarlar.has(`${a.kaynak_sistem}${SEP}${a.source_record_id}`)))
    .map((a) => ({
      kisiKimligi: a.kullanici_id ?? a.harici_kullanici_id ?? "BILINMEYEN",
      aktivite_kodu: a.aktivite_kodu,
      rol_kodu: a.rol_kodu,
      sistem_kapsami: a.sistem_kapsami,
    }));
  for (const r of [...diff.eklenecek, ...diff.guncellenecek.map((g) => g.record)]) {
    projeksiyon.push({
      kisiKimligi: `${r.source}:${r.externalSubjectId}`,
      aktivite_kodu: r.activityCode,
      rol_kodu: r.roleCode,
      sistem_kapsami: r.systemCode,
    });
  }
  const acikFingerprintler = new Set(
    (catismalarRow ?? [])
      .filter((c) => ["OPEN", "REOPENED", "UNDER_REVIEW", "EXCEPTION_REQUESTED"].includes(c.durum))
      .map((c) => c.fingerprint),
  );
  let beklenenCatismalar: { fingerprint: string; ruleId: string; kisiKimligi: string; onem: string }[] = [];
  try {
    const projeCatismalar = await sodDegerlendir(tenantId, projeksiyon, kurallar);
    beklenenCatismalar = projeCatismalar
      .filter((c) => !acikFingerprintler.has(c.fingerprint))
      .map((c) => ({ fingerprint: c.fingerprint, ruleId: c.ruleId, kisiKimligi: c.kisiKimligi, onem: c.onem }));
  } catch {
    // Projeksiyon tahmini başarısızsa önizleme yine üretilir (diff asıl çıktı).
  }

  const durum = satirHatalari.length > 0 ? "INVALID" : "READY_FOR_REVIEW";

  const { data: onizleme, error: onizErr } = await db
    .from("sod_import_onizlemeleri")
    .insert({
      tenant_id: tenantId,
      kaynak,
      mode,
      file_hash: fileHash,
      normalized_records_hash: normalizedRecordsHash,
      assignment_snapshot_hash: assignmentSnapshotHash,
      rule_set_version: ruleSetVersion,
      normalized_records: kayitlar as unknown as Json,
      diff: diff as unknown as Json,
      satir_hatalari: satirHatalari as unknown as Json,
      duplicateler: duplicateler as unknown as Json,
      beklenen_catismalar: beklenenCatismalar as unknown as Json,
      durum,
      yukleyen: user.id,
    })
    .select("id")
    .single();
  if (onizErr) {
    return NextResponse.json({ hata: onizErr.message }, { status: 500 });
  }

  return NextResponse.json({
    dryRunId: onizleme.id,
    durum,
    mode,
    kaynak,
    ozet: {
      eklenecek: diff.eklenecek.length,
      guncellenecek: diff.guncellenecek.length,
      degismeyecek: diff.degismeyecek.length,
      sonaErdirilecek: diff.sonaErdirilecek.length,
      satirHatasi: satirHatalari.length,
      duplicate: duplicateler.length,
      beklenenYeniCatisma: beklenenCatismalar.length,
    },
    diff,
    satirHatalari,
    duplicateler,
    beklenenCatismalar,
    hashler: { fileHash, normalizedRecordsHash, assignmentSnapshotHash, ruleSetVersion },
  });
}
