import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { girisYap } from "./helpers";
import { applicabilityFactSnapshot, factSnapshotFingerprint } from "../src/lib/applicability";

// M23 kabul (V2 §akış 4-5): hukuk onayı olmayan eşleme ZORUNLU kontrolü
// ÇALIŞTIRMAZ; zincir doğrulanınca koşu açılır; her koşu/girişim değişmez
// dayanak fotoğrafı bırakır. Gerçek Chromium + gerçek Supabase.
//
// Akış: fixture ingest (kaynak→artifact→hüküm→yükümlülük→eşleme, service) →
// koş: 409 BLOCK + koşusuz snapshot → doğrula (LEGAL_REVIEW→VERIFIED) → koş:
// 200 ALLOW_WITH_WARNING (kapsam değerlendirilmemiş) → applicability APPLICABLE
// → koş: 200 ALLOW + koşulu snapshot. Global e2e kalıntıları başta/sonda
// temizlenir (kural 3: bu satırlar E2E etiketli sentetik veridir, mevzuat
// içeriği İDDİA ETMEZ).

const KAYNAK_ADI = "E2E Legal Basis Kaynağı (sentetik)";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik (.env.local).");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Önceki koşulardan kalan E2E-LB global zincirini söker (FK sırasıyla). */
async function globalKalintilariTemizle(db: ReturnType<typeof admin>) {
  const { data: eskiObl } = await db.from("obligations").select("id").like("kod", "E2E-LB%");
  const oblIds = (eskiObl ?? []).map((o) => o.id);
  if (oblIds.length > 0) {
    await db.from("applicability_decisions").delete().in("obligation_id", oblIds);
    await db.from("obligation_control_mappings").delete().in("obligation_id", oblIds);
    await db.from("obligations").delete().in("id", oblIds);
  }
  const { data: eskiSrc } = await db.from("regulatory_sources").select("id").eq("ad", KAYNAK_ADI);
  for (const s of eskiSrc ?? []) {
    const { data: arts } = await db.from("source_artifacts").select("id").eq("source_id", s.id);
    const artIds = (arts ?? []).map((a) => a.id);
    if (artIds.length > 0) {
      await db.from("provisions").delete().in("source_artifact_id", artIds);
      await db.from("source_artifacts").delete().in("id", artIds);
    }
    await db.from("regulatory_sources").delete().eq("id", s.id);
  }
}

test("legal-basis guard: doğrulanmamış eşleme zorunlu kontrolü bloklar; doğrulanınca koşar", async ({ page }) => {
  test.setTimeout(90_000);
  const db = admin();
  await globalKalintilariTemizle(db);

  const { data: kurum } = await db.from("tenants").select("id").eq("name", "E2E Test Kurumu A.Ş.").single();
  // Fixture'ın seed ettiği tanımı ADIYLA seç: kontrol-test.spec'in UI testi bu
  // spec'ten önce İKİNCİ bir MANUAL_PROCEDURE tanımı yaratıyor — tur filtresi
  // tek başına .single()'ı "birden fazla satır" ile patlatır.
  const { data: tanim } = await db
    .from("control_test_definitions")
    .select("id, control_id")
    .eq("tenant_id", kurum!.id)
    .eq("ad", "E2E: MFA tüm ayrıcalıklı hesaplarda zorunlu")
    .single();

  // 1) Fixture ingest: zincir TODO_DOGRULA doğar (kural 3).
  const { data: src } = await db
    .from("regulatory_sources")
    .insert({ authority: "SPK", jurisdiction: "TR", kaynak_seviyesi: "A", ad: KAYNAK_ADI, erisim_politikasi_durumu: "manuel" })
    .select("id").single();
  const sha = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: art } = await db
    .from("source_artifacts")
    .insert({ source_id: src!.id, baslik: "E2E sentetik artifact", sha256: sha })
    .select("id").single();
  const { data: prov } = await db
    .from("provisions")
    .insert({ source_artifact_id: art!.id, provision_ref: "E2E-LB md. 1", metin: "Sentetik e2e hükmü", effective_from: "2020-01-01" })
    .select("id").single();
  const { data: obl } = await db
    .from("obligations")
    .insert({ provision_id: prov!.id, kod: "E2E-LB-1", baslik: "Sentetik yükümlülük", amac: "e2e", nitelik: "zorunlu" })
    .select("id").single();
  const { data: map } = await db
    .from("obligation_control_mappings")
    .insert({ obligation_id: obl!.id, control_id: tanim!.control_id })
    .select("id").single();

  await girisYap(page);

  // 2) Doğrulanmamış zincir → 409 BLOCK, koşu YOK, koşusuz fotoğraf VAR.
  const blok = await page.request.post(`/api/kontrol-test/${tanim!.id}/calistir`, {
    data: { iddiaKarsilandi: true, gozlemZamani: new Date().toISOString() },
  });
  expect(blok.status()).toBe(409);
  const blokGovde = await blok.json();
  expect(blokGovde.dayanak.karar).toBe("BLOCK");
  const { data: blokFoto } = await db
    .from("execution_legal_snapshots")
    .select("karar, test_run_id")
    .eq("test_definition_id", tanim!.id)
    .eq("karar", "BLOCK")
    .order("created_at", { ascending: false })
    .limit(1);
  expect(blokFoto![0].test_run_id).toBeNull();

  // 3) Hukuk doğrulaması — DÖRT GÖZ (PR-Q2a'): uyum rolü incelemeye alır,
  //    admin doğrular; incelemeye alanın kendi sunumunu doğrulaması DB'de
  //    reddedilir (guard, service_role bile atlayamaz).
  const { data: onaylayanProfil } = await db
    .from("profiles").select("id").eq("tenant_id", kurum!.id).eq("role", "admin").limit(1).single();
  const { data: sunanProfil } = await db
    .from("profiles").select("id").eq("tenant_id", kurum!.id).eq("role", "uyum").limit(1).single();
  for (const tablo of ["obligations", "obligation_control_mappings"] as const) {
    const id = tablo === "obligations" ? obl!.id : map!.id;
    await db
      .from(tablo)
      .update({ dogrulama_durumu: "LEGAL_REVIEW", incelemeye_alan: sunanProfil!.id, incelemeye_alinma_zamani: new Date().toISOString() })
      .eq("id", id);
    // Dört-göz ihlali: sunan kendi sunumunu doğrulayamaz.
    const { error: dortGoz } = await db
      .from(tablo)
      .update({ dogrulama_durumu: "VERIFIED", dogrulayan: sunanProfil!.id, dogrulama_zamani: new Date().toISOString() })
      .eq("id", id);
    expect(dortGoz?.message).toContain("dort goz");
    const { error } = await db
      .from(tablo)
      .update({ dogrulama_durumu: "VERIFIED", dogrulayan: onaylayanProfil!.id, dogrulama_zamani: new Date().toISOString() })
      .eq("id", id);
    expect(error).toBeNull();
  }

  // 4) Zincir doğrulandı ama applicability YOK → koşu açılır, UYARILI.
  const uyarili = await page.request.post(`/api/kontrol-test/${tanim!.id}/calistir`, {
    data: { iddiaKarsilandi: true, gozlemZamani: new Date().toISOString() },
  });
  expect(uyarili.ok()).toBeTruthy();
  const uyariliGovde = await uyarili.json();
  expect(uyariliGovde.dayanak.karar).toBe("ALLOW_WITH_WARNING");
  expect(uyariliGovde.dayanak.sebepler.map((s: { kod: string }) => s.kod)).toContain("KAPSAM_DEGERLENDIRILMEMIS");

  // 5) Applicability: güncel profilden APPLICABLE karar (motor kaynaklı).
  //    Profil yoksa kur (diğer spec'ler kurmuş olabilir — oku ya da oluştur).
  let { data: profil } = await db
    .from("organization_profiles")
    .select("organization_type, regulated_status, regulator_types, jurisdictions, operating_sectors, finance_department_enabled, employee_band, legal_entity_count")
    .eq("tenant_id", kurum!.id).maybeSingle();
  if (!profil) {
    await db.from("organization_profiles").insert({ tenant_id: kurum!.id, organization_type: "REGULATED_FINANCIAL_INSTITUTION" });
    ({ data: profil } = await db
      .from("organization_profiles")
      .select("organization_type, regulated_status, regulator_types, jurisdictions, operating_sectors, finance_department_enabled, employee_band, legal_entity_count")
      .eq("tenant_id", kurum!.id).single());
  }
  const snap = applicabilityFactSnapshot(profil!);
  const { error: kararErr } = await db.from("applicability_decisions").insert({
    tenant_id: kurum!.id,
    obligation_id: obl!.id,
    durum: "APPLICABLE",
    fact_snapshot: snap,
    fact_snapshot_fingerprint: await factSnapshotFingerprint(snap),
    gerekce: "E2E: profil olgularıyla uygulanır",
    karar_kaynagi: "motor",
  });
  expect(kararErr).toBeNull();

  // 6) Tam zincir → ALLOW; koşunun fotoğrafı koşuya bağlı.
  const temiz = await page.request.post(`/api/kontrol-test/${tanim!.id}/calistir`, {
    data: { iddiaKarsilandi: true, gozlemZamani: new Date().toISOString() },
  });
  expect(temiz.ok()).toBeTruthy();
  const temizGovde = await temiz.json();
  expect(temizGovde.dayanak.karar).toBe("ALLOW");
  expect(temizGovde.sonuc).toBe("PASSED");
  const { data: kosuFoto } = await db
    .from("execution_legal_snapshots")
    .select("karar")
    .eq("test_run_id", temizGovde.testRunId)
    .single();
  expect(kosuFoto!.karar).toBe("ALLOW");

  // 7) M24 sitasyon paketi: koşudan taşınabilir bundle → BAĞIMSIZ CLI ayrı
  //    süreç olarak doğrular (M11 verify-paket disiplini): sağlam → çıkış 0,
  //    kurcalı → çıkış 1.
  const sitasyon = await page.request.get(`/api/kontrol-test/run/${temizGovde.testRunId}/sitasyon`);
  expect(sitasyon.ok()).toBeTruthy();
  const paket = await sitasyon.json();
  expect(paket.schema).toBe("KALKAN_CITATION_BUNDLE_V1");
  expect(paket.imzaDurumu).toBe("IMZASIZ_HASH_BUTUNLUKLU");
  expect(paket.legalSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
  expect(paket.kaynakZinciri.map((k: { artifactSha256: string }) => k.artifactSha256)).toContain(sha);
  expect(paket.applicability[0].durum).toBe("APPLICABLE");

  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const klasor = mkdtempSync(join(tmpdir(), "kalkan-sitasyon-"));
  try {
    const dosya = join(klasor, "paket.json");
    writeFileSync(dosya, JSON.stringify(paket));
    const cikti = execFileSync("npx", ["tsx", "scripts/verify-sitasyon.ts", dosya], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    expect(cikti).toContain("VERIFIED");

    // Kurcalama: snippet değiştirilirse CLI FAILED vermeli (çıkış 1).
    const kurcali = JSON.parse(JSON.stringify(paket));
    kurcali.kaynakZinciri[0].snippet = "Kurcalanmış alıntı";
    writeFileSync(dosya, JSON.stringify(kurcali));
    let cikisKodu = 0;
    try {
      execFileSync("npx", ["tsx", "scripts/verify-sitasyon.ts", dosya], {
        encoding: "utf8",
        shell: process.platform === "win32",
      });
    } catch (e) {
      cikisKodu = (e as { status?: number }).status ?? -1;
    }
    expect(cikisKodu).toBe(1);
  } finally {
    rmSync(klasor, { recursive: true, force: true });
  }

  // 8) Temizlik: sentetik global zincir sökülür (fotoğraflar fixture cascade'i
  //    ile bir sonraki koşuda gider; kiracı applicability kararı da silinir).
  await globalKalintilariTemizle(db);
});
