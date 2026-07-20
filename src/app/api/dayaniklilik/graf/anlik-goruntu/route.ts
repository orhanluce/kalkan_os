// Dikey D, ilk dilim (docs/adr/PR0-dikeyD-dayaniklilik-etki-grafi-2026-07-20.md):
// birleşik etki grafını mevcut 9 kenar kaynağından derleyip mühürler. Yeni
// varlık modeli YOK — yalnız mevcut tablolardan OKUR, saf motorla
// (src/lib/impact-graph.ts) projekte eder.
import { NextResponse } from "next/server";
import { canonicalHash, type CanonicalDeger } from "@/lib/canonical";
import {
  etkiGrafiProjekteEt,
  etkiYayilimi,
  tekNoktaTespitiTamGraf,
  HESAPLAMA_YONTEMI_SPOF,
  HESAPLAMA_YONTEMI_YAYILIM,
  type EtkiGrafGirdisi,
} from "@/lib/impact-graph";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function POST() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) {
    return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });
  }

  const [{ data: hizmetler }, { data: bagimliliklar }, { data: sozlesmeEslemeleri }, { data: kritikHizmetKontrolSatirlari }, { data: testTanimlari }, { data: bulgular }] =
    await Promise.all([
      db.from("critical_business_services").select("id, ad"),
      db.from("service_dependencies").select("id, critical_service_id, ad, third_party_id, tekil_nokta"),
      db
        .from("third_party_contract_critical_services")
        .select("critical_service_id, third_party_contracts (third_party_id, ict_hizmet_turu_kod)"),
      db.from("critical_service_controls").select("critical_service_id, control_id"),
      db.from("control_test_definitions").select("id, control_id, ad"),
      db.from("findings").select("id, baslik, kaynak_test_definition_id, onem, durum, kapatma_retest_run_id"),
    ]);

  const ucuncuTarafIdSeti = new Set<string>();
  const ictHizmetKoduSeti = new Set<string>();
  for (const b of bagimliliklar ?? []) if (b.third_party_id) ucuncuTarafIdSeti.add(b.third_party_id);
  for (const s of sozlesmeEslemeleri ?? []) {
    const sozlesme = s.third_party_contracts as unknown as { third_party_id: string; ict_hizmet_turu_kod: string | null } | null;
    if (sozlesme?.third_party_id) ucuncuTarafIdSeti.add(sozlesme.third_party_id);
    if (sozlesme?.ict_hizmet_turu_kod) ictHizmetKoduSeti.add(sozlesme.ict_hizmet_turu_kod);
  }

  const controlIdSeti = new Set<string>();
  for (const k of kritikHizmetKontrolSatirlari ?? []) controlIdSeti.add(k.control_id);
  for (const t of testTanimlari ?? []) controlIdSeti.add(t.control_id);
  const controlIdListesi = [...controlIdSeti];

  const [{ data: ucuncuTaraflar }, { data: dorduncuTaraflar }, { data: ictHizmetleri }, { data: kontroller }, { data: eslemeler }, { data: koşular }] = await Promise.all([
    ucuncuTarafIdSeti.size > 0 ? db.from("third_parties").select("id, ad").in("id", [...ucuncuTarafIdSeti]) : Promise.resolve({ data: [] as { id: string; ad: string }[] }),
    ucuncuTarafIdSeti.size > 0 ? db.from("fourth_parties").select("id, third_party_id, ad, bilinmiyor").in("third_party_id", [...ucuncuTarafIdSeti]) : Promise.resolve({ data: [] }),
    ictHizmetKoduSeti.size > 0 ? db.from("ict_service_types").select("kod, ad").in("kod", [...ictHizmetKoduSeti]) : Promise.resolve({ data: [] }),
    controlIdListesi.length > 0 ? db.from("controls").select("id, madde_ref").in("id", controlIdListesi) : Promise.resolve({ data: [] }),
    controlIdListesi.length > 0
      ? db.from("obligation_control_mappings").select("obligation_id, control_id, dogrulama_durumu, obligations (kod)").in("control_id", controlIdListesi).neq("dogrulama_durumu", "REJECTED")
      : Promise.resolve({ data: [] }),
    testTanimlari && testTanimlari.length > 0
      ? db
          .from("test_runs")
          .select("test_definition_id, evidence_id, calisti_at")
          .in(
            "test_definition_id",
            testTanimlari.map((t) => t.id),
          )
          .not("evidence_id", "is", null)
          .order("calisti_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // Test tanımı başına EN GÜNCEL koşu (motor "en güncel"i tanımlamaz — kural 11, çağıran seçer).
  const enGuncelKanit = new Map<string, string>();
  for (const k of koşular ?? []) {
    if (!k.evidence_id) continue;
    if (!enGuncelKanit.has(k.test_definition_id)) enGuncelKanit.set(k.test_definition_id, k.evidence_id);
  }
  const kanitIdListesi = [...new Set(enGuncelKanit.values())];
  const { data: kanitlar } = kanitIdListesi.length > 0 ? await db.from("evidences").select("id, hash_sha256").in("id", kanitIdListesi) : { data: [] as { id: string; hash_sha256: string | null }[] };

  // Dikey F, F1: BULGU_RETEST kenarı için kapanış retest koşusunun HANGİ test
  // tanımına ait olduğunu çöz (motor testDefinitionId ister, run id değil —
  // TEST düğümü tanım-anahtarlıdır, bkz. impact-graph.ts).
  const retestRunIdListesi = [...new Set((bulgular ?? []).map((b) => b.kapatma_retest_run_id).filter((x): x is string => !!x))];
  const { data: retestKosulari } =
    retestRunIdListesi.length > 0
      ? await db.from("test_runs").select("id, test_definition_id").in("id", retestRunIdListesi)
      : { data: [] as { id: string; test_definition_id: string }[] };
  const retestRunToTestDefinitionId = new Map((retestKosulari ?? []).map((r) => [r.id, r.test_definition_id]));

  const girdi: EtkiGrafGirdisi = {
    kritikHizmetler: (hizmetler ?? []).map((h) => ({ id: h.id, ad: h.ad })),
    bagimliliklar: (bagimliliklar ?? [])
      .filter((b) => !b.third_party_id)
      .map((b) => ({ id: b.id, kritikHizmetId: b.critical_service_id, ad: b.ad, tekilNokta: b.tekil_nokta })),
    ucuncuTaraflar: (ucuncuTaraflar ?? []).map((t) => ({ id: t.id, ad: t.ad })),
    altYukleniciler: (dorduncuTaraflar ?? []).map((a) => ({ id: a.id, thirdPartyId: a.third_party_id, ad: a.ad, bilinmiyor: a.bilinmiyor })),
    ictHizmetleri: (ictHizmetleri ?? []).map((i) => ({ kod: i.kod, ad: i.ad })),
    kontroller: (kontroller ?? []).map((k) => ({ id: k.id, maddeRef: k.madde_ref })),
    mevzuatlar: [...new Map((eslemeler ?? []).map((e) => [e.obligation_id, (e.obligations as unknown as { kod: string } | null)?.kod ?? e.obligation_id])).entries()].map(([id, kod]) => ({ id, kod })),
    testler: (testTanimlari ?? []).map((t) => ({ id: t.id, controlId: t.control_id, ad: t.ad })),
    bulgular: (bulgular ?? []).map((b) => ({
      id: b.id,
      testDefinitionId: b.kaynak_test_definition_id,
      baslik: b.baslik,
      kapatmaRetestTestDefinitionId: b.kapatma_retest_run_id ? (retestRunToTestDefinitionId.get(b.kapatma_retest_run_id) ?? undefined) : undefined,
    })),
    kanitlar: (kanitlar ?? []).map((k) => ({ id: k.id, hashSha256: k.hash_sha256 })),
    kritikHizmetUcuncuTaraf: [
      ...(bagimliliklar ?? [])
        .filter((b) => b.third_party_id)
        .map((b) => ({ kritikHizmetId: b.critical_service_id, thirdPartyId: b.third_party_id as string, kaynak: "BAGIMLILIK" as const })),
      ...(sozlesmeEslemeleri ?? [])
        .map((s) => {
          const sozlesme = s.third_party_contracts as unknown as { third_party_id: string; ict_hizmet_turu_kod: string | null } | null;
          return sozlesme?.third_party_id ? { kritikHizmetId: s.critical_service_id, thirdPartyId: sozlesme.third_party_id, kaynak: "SOZLESME_ESLEME" as const } : null;
        })
        .filter((x): x is { kritikHizmetId: string; thirdPartyId: string; kaynak: "SOZLESME_ESLEME" } => x !== null),
    ],
    ucuncuTarafIctHizmeti: [...new Map((sozlesmeEslemeleri ?? [])
      .map((s) => s.third_party_contracts as unknown as { third_party_id: string; ict_hizmet_turu_kod: string | null } | null)
      .filter((s): s is { third_party_id: string; ict_hizmet_turu_kod: string } => !!s?.ict_hizmet_turu_kod)
      .map((s) => [`${s.third_party_id}|${s.ict_hizmet_turu_kod}`, s]))
      .values()].map((s) => ({ thirdPartyId: s.third_party_id, ictHizmetKodu: s.ict_hizmet_turu_kod })),
    kritikHizmetKontrol: (kritikHizmetKontrolSatirlari ?? []).map((k) => ({ kritikHizmetId: k.critical_service_id, controlId: k.control_id })),
    mevzuatKontrol: (eslemeler ?? []).map((e) => ({ obligationId: e.obligation_id, controlId: e.control_id })),
    testKanit: [...enGuncelKanit.entries()].map(([testDefinitionId, evidenceId]) => ({ testDefinitionId, evidenceId })),
  };

  const graf = etkiGrafiProjekteEt(girdi);
  const spofRaporu = tekNoktaTespitiTamGraf(graf);

  // Yayılım: AÇIK kritik/yüksek/acil bulgulu testlerin kontrol düğümlerinden başlar
  // (kurucunun "kontrol/bulgu etkisinin yayılımı" maddesi — otomatik, interaktif değil).
  const acikKritikTestTanimIdleri = new Set(
    (bulgular ?? []).filter((b) => b.durum === "acik" && ["acil", "kritik", "yuksek"].includes(b.onem) && b.kaynak_test_definition_id).map((b) => b.kaynak_test_definition_id as string),
  );
  const testTanimMap = new Map((testTanimlari ?? []).map((t) => [t.id, t]));
  const baslangicKontrolDugumIdleri = [
    ...new Set([...acikKritikTestTanimIdleri].map((testId) => testTanimMap.get(testId)?.control_id).filter((id): id is string => !!id).map((id) => `KONTROL:${id}`)),
  ].sort();

  const yayilimGeri = baslangicKontrolDugumIdleri.length > 0 ? etkiYayilimi(baslangicKontrolDugumIdleri, graf, "geri") : null;
  const yayilimIleri = baslangicKontrolDugumIdleri.length > 0 ? etkiYayilimi(baslangicKontrolDugumIdleri, graf, "ileri") : null;
  const yayilimRaporu = { baslangicKontrolDugumIdleri, geri: yayilimGeri, ileri: yayilimIleri };

  const grafHash = await canonicalHash(graf as unknown as CanonicalDeger);

  const hesaplamaYontemi = {
    motorSurumu: "impact-graph-v1",
    spofYontemi: HESAPLAMA_YONTEMI_SPOF,
    yayilimYontemi: HESAPLAMA_YONTEMI_YAYILIM,
    varsayimlar: [
      "Sözleşme-düzeyi granülerlik bu dilimde YOK — tedarikçi→ICT hizmet türü özetlenmiş görünümdür.",
      "Yayılım yalnız açık kritik/yüksek/acil bulgulu testlerin kontrollerinden otomatik başlar (interaktif düğüm seçimi sonraki dilim).",
      "Bu bir kesin gerçek değil, yapısal erişilebilirlik hesaplamasıdır — eksik veri her zaman bilinmiyor kalır.",
    ],
  };

  const { data: kayit, error } = await db
    .from("impact_graph_snapshots")
    .insert({
      tenant_id: profil.tenant_id,
      graf: graf as unknown as Json,
      graf_hash: grafHash,
      spof_raporu: spofRaporu as unknown as Json,
      yayilim_raporu: yayilimRaporu as unknown as Json,
      hesaplama_yontemi: hesaplamaYontemi as unknown as Json,
    })
    .select("id, graf_hash, created_at")
    .single();
  if (error || !kayit) {
    return NextResponse.json({ hata: error?.message ?? "Anlık görüntü oluşturulamadı." }, { status: 403 });
  }

  return NextResponse.json({
    id: kayit.id,
    grafHash: kayit.graf_hash,
    olusturulmaZamani: kayit.created_at,
    dugumSayisi: graf.dugumler.length,
    kenarSayisi: graf.kenarlar.length,
    spofRaporu,
    yayilimRaporu,
  });
}
