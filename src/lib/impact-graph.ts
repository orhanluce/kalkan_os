// Kurumsal dayanıklılık — birleşik etki grafiği projeksiyonu (Dikey D, ilk
// dilim, docs/adr/PR0-dikeyD-dayaniklilik-etki-grafi-2026-07-20.md). Saf,
// deterministik (kural 11) — dış çağrı/rastgelelik yok, aynı girdi aynı
// sonuç.
//
// YENİ VARLIK MODELİ İCAT EDİLMEDİ: her düğüm/kenar MEVCUT bir tablodan
// türer (critical_business_services/service_dependencies/third_parties/
// fourth_parties/ict_service_types/controls/obligations/control_test_
// definitions/findings/evidences, ADR §1). `tekilNoktaAnalizi` (dayaniklilik.
// ts, M13) ve `konsantrasyonAnalizi` (tedarikci.ts, M35) BURADA TEKRAR
// EDİLMEDİ — bu modül onların tek-domain/tek-atlamalı halini TÜM GRAFA
// genelleştiren AYRI bir traversal'dır (ADR §2).
//
// KESİNLİK UYDURMA YOK: bu motorun ürettiği hiçbir sonuç "doğrulanmış gerçek"
// değildir — yapısal erişilebilirlik hesaplamasıdır (HESAPLAMA_YONTEMI
// sabitleri, her sonuçla birlikte döner). Eksik/kopuk veri (`bilinmiyor`)
// asla varsayılan bir bağlantıya dönüştürülmez.

export type DugumTuru =
  | "KRITIK_HIZMET"
  | "BAGIMLILIK"
  | "UCUNCU_TARAF"
  | "ALT_YUKLENICI"
  | "ICT_HIZMETI"
  | "KONTROL"
  | "MEVZUAT"
  | "TEST"
  | "BULGU"
  | "KANIT"
  | "TEDARIKCI_BULGUSU";

export interface EtkiGrafDugumu {
  id: string; // `${tur}:${kaynakId}` — tur-öneki tüm düğüm türlerinde çakışmayı yapısal olarak engeller.
  tur: DugumTuru;
  etiket: string;
  /** true ise `etiket` bir yer tutucudur ("Bilinmiyor") — gerçek ad UYDURULMADI. */
  bilinmiyor: boolean;
}

export type KenarTuru =
  | "HIZMET_BAGIMLILIK"
  | "HIZMET_UCUNCU_TARAF"
  | "UCUNCU_TARAF_ALT_YUKLENICI"
  | "UCUNCU_TARAF_ICT_HIZMETI"
  | "HIZMET_KONTROL"
  | "MEVZUAT_KONTROL"
  | "KONTROL_TEST"
  | "TEST_BULGU"
  | "TEST_KANIT"
  | "UCUNCU_TARAF_TEDARIKCI_BULGUSU";

export interface EtkiGrafKenari {
  kaynakId: string;
  hedefId: string;
  tur: KenarTuru;
  /** Kenarın hangi ham kaynak(lar)dan geldiği — açıklanabilirlik (kural: kaynak ayrı gösterilir). */
  kaynaklar: string[];
}

export interface EtkiGrafi {
  dugumler: EtkiGrafDugumu[];
  kenarlar: EtkiGrafKenari[];
}

function dugumId(tur: DugumTuru, kaynakId: string): string {
  return `${tur}:${kaynakId}`;
}

export interface EtkiGrafGirdisi {
  kritikHizmetler: { id: string; ad: string }[];
  /** Yalnız third_party_id NULL olan service_dependencies satırları (ADR §1 kenar 1). */
  bagimliliklar: { id: string; kritikHizmetId: string; ad: string; tekilNokta: boolean }[];
  ucuncuTaraflar: { id: string; ad: string }[];
  altYukleniciler: { id: string; thirdPartyId: string; ad: string | null; bilinmiyor: boolean }[];
  ictHizmetleri: { kod: string; ad: string }[];
  kontroller: { id: string; maddeRef: string }[];
  /** obligations satırları — yalnız kod taşınır (ham hüküm metni graf içinde YOK). */
  mevzuatlar: { id: string; kod: string }[];
  testler: { id: string; controlId: string; ad: string }[];
  bulgular: { id: string; testDefinitionId: string | null; baslik: string }[];
  kanitlar: { id: string; hashSha256: string | null }[];

  /** third_party_contract_critical_services + service_dependencies.third_party_id — İKİ kaynak, tek kenar (kaynaklar[] ile ayrık kalır). */
  kritikHizmetUcuncuTaraf: { kritikHizmetId: string; thirdPartyId: string; kaynak: "SOZLESME_ESLEME" | "BAGIMLILIK" }[];
  ucuncuTarafIctHizmeti: { thirdPartyId: string; ictHizmetKodu: string }[];
  kritikHizmetKontrol: { kritikHizmetId: string; controlId: string }[];
  mevzuatKontrol: { obligationId: string; controlId: string }[];
  /** Test tanımı başına EN GÜNCEL koşunun evidence_id'si (çağıran seçer — kural 11, motor "en güncel"i tanımlamaz). */
  testKanit: { testDefinitionId: string; evidenceId: string }[];
  /**
   * Dikey E, E1 (ADR §1 madde 4): tedarikçi değerlendirme bulguları (assessment_
   * findings). OPSİYONEL — atlanırsa (undefined) mevcut tüm graf sonuçları
   * BİREBİR AYNI kalır (geriye dönük uyumluluk, kural 11 regresyon garantisi).
   * AYRI bir düğüm türü (`TEDARIKCI_BULGUSU`) — M12'nin control-test `BULGU`
   * türüyle KARIŞTIRILMAZ (iki farklı köken, iki farklı anlam). Açık/kapalı
   * filtrelemesi BURADA VARSAYILMAZ: çağıran hangi durumları dahil edeceğine
   * karar verir (ör. yalnız açık KRİTİK) — motor sessizce filtrelemez.
   */
  tedarikciBulgulari?: { id: string; thirdPartyId: string; baslik: string }[];
}

/**
 * 9 dağınık kenar kaynağını (ADR §1) TEK bir kanonik düğüm/kenar
 * projeksiyonuna birleştirir. Sıra HER ZAMAN tur+id'ye göre deterministiktir.
 */
export function etkiGrafiProjekteEt(girdi: EtkiGrafGirdisi): EtkiGrafi {
  const dugumler: EtkiGrafDugumu[] = [];
  const kenarMap = new Map<string, EtkiGrafKenari>();

  function kenarEkle(kaynakId: string, hedefId: string, tur: KenarTuru, kaynak: string) {
    const anahtar = `${kaynakId}|${hedefId}|${tur}`;
    const mevcut = kenarMap.get(anahtar);
    if (mevcut) {
      if (!mevcut.kaynaklar.includes(kaynak)) mevcut.kaynaklar.push(kaynak);
      return;
    }
    kenarMap.set(anahtar, { kaynakId, hedefId, tur, kaynaklar: [kaynak] });
  }

  for (const h of girdi.kritikHizmetler) dugumler.push({ id: dugumId("KRITIK_HIZMET", h.id), tur: "KRITIK_HIZMET", etiket: h.ad, bilinmiyor: false });

  // BAGIMLILIK düğümleri NORMALİZE AD ile birleşir (satır id'siyle DEĞİL) —
  // tekilNoktaAnalizi'nin (M13) AYNI kuralı: iki farklı kritik hizmetin AYNI
  // ada sahip (trim+küçük harf) iki AYRI service_dependencies satırı, aynı
  // fiziksel bağımlılığı temsil eder. Satır id'sine göre düğümlemek bu
  // paylaşımı GÖREMEZ hale getirirdi (SPOF tespitinin asıl amacı budur).
  const bagimlilikDugumIdleri = new Map<string, string>();
  for (const b of girdi.bagimliliklar) {
    const anahtar = b.ad.trim().toLowerCase();
    const dId = dugumId("BAGIMLILIK", anahtar);
    if (!bagimlilikDugumIdleri.has(anahtar)) {
      bagimlilikDugumIdleri.set(anahtar, dId);
      dugumler.push({ id: dId, tur: "BAGIMLILIK", etiket: b.ad.trim(), bilinmiyor: false });
    }
    kenarEkle(dugumId("KRITIK_HIZMET", b.kritikHizmetId), dId, "HIZMET_BAGIMLILIK", "service_dependencies");
  }
  for (const t of girdi.ucuncuTaraflar) dugumler.push({ id: dugumId("UCUNCU_TARAF", t.id), tur: "UCUNCU_TARAF", etiket: t.ad, bilinmiyor: false });
  for (const a of girdi.altYukleniciler) {
    dugumler.push({
      id: dugumId("ALT_YUKLENICI", a.id),
      tur: "ALT_YUKLENICI",
      etiket: a.bilinmiyor || a.ad === null ? "Bilinmiyor" : a.ad,
      bilinmiyor: a.bilinmiyor || a.ad === null,
    });
    kenarEkle(dugumId("UCUNCU_TARAF", a.thirdPartyId), dugumId("ALT_YUKLENICI", a.id), "UCUNCU_TARAF_ALT_YUKLENICI", "fourth_parties");
  }
  for (const i of girdi.ictHizmetleri) dugumler.push({ id: dugumId("ICT_HIZMETI", i.kod), tur: "ICT_HIZMETI", etiket: i.ad, bilinmiyor: false });
  for (const k of girdi.kontroller) dugumler.push({ id: dugumId("KONTROL", k.id), tur: "KONTROL", etiket: k.maddeRef, bilinmiyor: false });
  for (const m of girdi.mevzuatlar) dugumler.push({ id: dugumId("MEVZUAT", m.id), tur: "MEVZUAT", etiket: m.kod, bilinmiyor: false });
  for (const t of girdi.testler) dugumler.push({ id: dugumId("TEST", t.id), tur: "TEST", etiket: t.ad, bilinmiyor: false });
  for (const b of girdi.bulgular) dugumler.push({ id: dugumId("BULGU", b.id), tur: "BULGU", etiket: b.baslik, bilinmiyor: false });
  for (const k of girdi.kanitlar) dugumler.push({ id: dugumId("KANIT", k.id), tur: "KANIT", etiket: k.hashSha256 ? k.hashSha256.slice(0, 16) : "Bilinmiyor", bilinmiyor: k.hashSha256 === null });

  for (const e of girdi.kritikHizmetUcuncuTaraf) {
    kenarEkle(dugumId("KRITIK_HIZMET", e.kritikHizmetId), dugumId("UCUNCU_TARAF", e.thirdPartyId), "HIZMET_UCUNCU_TARAF", e.kaynak);
  }
  for (const e of girdi.ucuncuTarafIctHizmeti) {
    kenarEkle(dugumId("UCUNCU_TARAF", e.thirdPartyId), dugumId("ICT_HIZMETI", e.ictHizmetKodu), "UCUNCU_TARAF_ICT_HIZMETI", "third_party_contracts");
  }
  for (const e of girdi.kritikHizmetKontrol) {
    kenarEkle(dugumId("KRITIK_HIZMET", e.kritikHizmetId), dugumId("KONTROL", e.controlId), "HIZMET_KONTROL", "critical_service_controls");
  }
  for (const e of girdi.mevzuatKontrol) {
    kenarEkle(dugumId("MEVZUAT", e.obligationId), dugumId("KONTROL", e.controlId), "MEVZUAT_KONTROL", "obligation_control_mappings");
  }
  for (const t of girdi.testler) {
    kenarEkle(dugumId("KONTROL", t.controlId), dugumId("TEST", t.id), "KONTROL_TEST", "control_test_definitions");
  }
  for (const b of girdi.bulgular) {
    if (!b.testDefinitionId) continue;
    kenarEkle(dugumId("TEST", b.testDefinitionId), dugumId("BULGU", b.id), "TEST_BULGU", "findings");
  }
  for (const e of girdi.testKanit) {
    kenarEkle(dugumId("TEST", e.testDefinitionId), dugumId("KANIT", e.evidenceId), "TEST_KANIT", "test_runs");
  }
  for (const b of girdi.tedarikciBulgulari ?? []) {
    dugumler.push({ id: dugumId("TEDARIKCI_BULGUSU", b.id), tur: "TEDARIKCI_BULGUSU", etiket: b.baslik, bilinmiyor: false });
    kenarEkle(dugumId("UCUNCU_TARAF", b.thirdPartyId), dugumId("TEDARIKCI_BULGUSU", b.id), "UCUNCU_TARAF_TEDARIKCI_BULGUSU", "assessment_findings");
  }

  dugumler.sort((a, b) => a.id.localeCompare(b.id));
  const kenarlar = [...kenarMap.values()];
  for (const k of kenarlar) k.kaynaklar.sort();
  kenarlar.sort((a, b) => `${a.kaynakId}|${a.hedefId}|${a.tur}`.localeCompare(`${b.kaynakId}|${b.hedefId}|${b.tur}`));

  return { dugumler, kenarlar };
}

export const HESAPLAMA_YONTEMI_SPOF =
  "Yapısal erişilebilirlik hesaplaması: her düğümden geriye doğru hangi kritik hizmet düğümlerinin ulaşabildiği taranır (BFS). İki veya daha fazla farklı kritik hizmetin ulaştığı düğüm sistemik tekil nokta sayılır. Bu bir tahmin/öngörü DEĞİL, mevcut graf verisinin dökümüdür — eksik/kopuk veri bilinmiyor kalır, varsayılmaz.";

export interface SistemikTekilNokta {
  dugumId: string;
  tur: DugumTuru;
  etiket: string;
  etkilenenKritikHizmetIdleri: string[];
}

export interface TekNoktaTespitSonucu {
  sistemikNoktalar: SistemikTekilNokta[];
  hesaplamaYontemi: string;
}

/**
 * Tam-graf tekil nokta tespiti (ADR §2): `tekilNoktaAnalizi` (M13, yalnız
 * service_dependencies) ve `konsantrasyonAnalizi` (M35, yalnız tedarikçi→
 * dördüncü-taraf) İKİ AYRI, tek-domain motordu. Bu fonksiyon AYNI ilkeyi
 * ("≥2 farklı kritik hizmetin paylaştığı düğüm = sistemik risk") TÜM düğüm
 * türlerine (BAGIMLILIK/UCUNCU_TARAF/ALT_YUKLENICI/ICT_HIZMETI, çok-atlamalı
 * dahil) TEK bir traversal ile genelleştirir.
 */
export function tekNoktaTespitiTamGraf(graf: EtkiGrafi): TekNoktaTespitSonucu {
  const komsu = new Map<string, string[]>();
  for (const k of graf.kenarlar) {
    if (!komsu.has(k.kaynakId)) komsu.set(k.kaynakId, []);
    komsu.get(k.kaynakId)!.push(k.hedefId);
  }

  const ulasanKritikHizmetler = new Map<string, Set<string>>();
  const kritikHizmetDugumleri = graf.dugumler.filter((d) => d.tur === "KRITIK_HIZMET");

  for (const kok of kritikHizmetDugumleri) {
    const ziyaretEdildi = new Set<string>([kok.id]);
    const kuyruk = [kok.id];
    while (kuyruk.length > 0) {
      const suanki = kuyruk.shift()!;
      for (const komsuId of komsu.get(suanki) ?? []) {
        if (ziyaretEdildi.has(komsuId)) continue;
        ziyaretEdildi.add(komsuId);
        kuyruk.push(komsuId);
        if (!ulasanKritikHizmetler.has(komsuId)) ulasanKritikHizmetler.set(komsuId, new Set());
        ulasanKritikHizmetler.get(komsuId)!.add(kok.id);
      }
    }
  }

  const dugumMap = new Map(graf.dugumler.map((d) => [d.id, d]));
  const sistemikNoktalar: SistemikTekilNokta[] = [];
  for (const [dugumId, kokler] of ulasanKritikHizmetler) {
    if (kokler.size < 2) continue;
    const d = dugumMap.get(dugumId);
    if (!d) continue;
    sistemikNoktalar.push({
      dugumId,
      tur: d.tur,
      etiket: d.etiket,
      etkilenenKritikHizmetIdleri: [...kokler].sort(),
    });
  }
  sistemikNoktalar.sort((a, b) => a.dugumId.localeCompare(b.dugumId));

  return { sistemikNoktalar, hesaplamaYontemi: HESAPLAMA_YONTEMI_SPOF };
}

export const HESAPLAMA_YONTEMI_YAYILIM =
  "Yapısal erişilebilirlik hesaplaması (BFS, döngü korumalı): başlangıç düğümünden 'ileri' (kenar yönünde) ya da 'geri' (kenara ters) ulaşılabilen tüm düğümler, en kısa yol uzunluğu ve izlenen yol ile listelenir. Nedensellik İDDİASI DEĞİLDİR — yalnız grafta yapısal olarak bağlı olduğunu gösterir.";

export interface YayilimSonucuDugumu {
  dugumId: string;
  tur: DugumTuru;
  etiket: string;
  hopSayisi: number;
  /** Başlangıçtan bu düğüme izlenen düğüm id'leri sırasıyla (açıklanabilirlik). */
  yol: string[];
}

export interface EtkiYayilimSonucu {
  baslangicDugumIdleri: string[];
  yon: "ileri" | "geri";
  etkilenenler: YayilimSonucuDugumu[];
  hesaplamaYontemi: string;
}

/**
 * Çok-atlamalı (multi-hop) etki yayılımı: verilen başlangıç düğümlerinden
 * BFS ile ulaşılabilen TÜM düğümleri, hop sayısı ve izlenen yolla döner.
 * `yon='ileri'` kenar yönünde (ör. KONTROL → TEST → KANIT — kanıt zinciri);
 * `yon='geri'` kenara ters (ör. KONTROL ← KRITIK_HIZMET — "bu kontrol
 * bozulursa hangi kritik hizmetler etkilenir"). Döngü korumalı, deterministik
 * (aynı başlangıç kümesi + graf → aynı sonuç, kural 11).
 */
export function etkiYayilimi(baslangicDugumIdleri: string[], graf: EtkiGrafi, yon: "ileri" | "geri"): EtkiYayilimSonucu {
  const komsu = new Map<string, string[]>();
  for (const k of graf.kenarlar) {
    const kaynak = yon === "ileri" ? k.kaynakId : k.hedefId;
    const hedef = yon === "ileri" ? k.hedefId : k.kaynakId;
    if (!komsu.has(kaynak)) komsu.set(kaynak, []);
    komsu.get(kaynak)!.push(hedef);
  }
  const dugumMap = new Map(graf.dugumler.map((d) => [d.id, d]));

  const baslangicSirali = [...baslangicDugumIdleri].sort();
  const ziyaretEdildi = new Set<string>(baslangicSirali);
  const yollar = new Map<string, string[]>();
  for (const b of baslangicSirali) yollar.set(b, [b]);
  const kuyruk = [...baslangicSirali];
  const etkilenenler: YayilimSonucuDugumu[] = [];

  while (kuyruk.length > 0) {
    const suanki = kuyruk.shift()!;
    const suankiYol = yollar.get(suanki)!;
    for (const komsuId of [...(komsu.get(suanki) ?? [])].sort()) {
      if (ziyaretEdildi.has(komsuId)) continue;
      ziyaretEdildi.add(komsuId);
      const yeniYol = [...suankiYol, komsuId];
      yollar.set(komsuId, yeniYol);
      kuyruk.push(komsuId);
      const d = dugumMap.get(komsuId);
      if (d) {
        etkilenenler.push({ dugumId: komsuId, tur: d.tur, etiket: d.etiket, hopSayisi: yeniYol.length - 1, yol: yeniYol });
      }
    }
  }

  etkilenenler.sort((a, b) => a.hopSayisi - b.hopSayisi || a.dugumId.localeCompare(b.dugumId));

  return { baslangicDugumIdleri: baslangicSirali, yon, etkilenenler, hesaplamaYontemi: HESAPLAMA_YONTEMI_YAYILIM };
}
