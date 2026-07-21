// Dikey F, F2 (docs/adr/PR0-dikeyF-f2-kritik-hizmet-test-paketi-2026-07-21.md):
// tek bir kritik hizmet için mevcut M12 verilerini (test tanımı → koşu →
// öneri → bulgu → retest) MÜHÜRLENEBİLİR tek bir pakete projekte eder.
//
// YENİ TEST MOTORU DEĞİL: burada hiçbir test ÇALIŞTIRILMAZ, hiçbir sonuç
// YENİDEN HESAPLANMAZ. Yalnız ZATEN VAR olan `test_runs.sonuc` (kural 13'ün
// beş durumu) ve `findings`/`control_test_finding_proposals` ilişkileri tek
// bir görünümde toplanır.
//
// SAF: DB/ağ/AI çağrısı yok, `Date.now()` yok — `asOf` girdiden gelir. Aynı
// girdi + aynı `asOf` her zaman aynı paketi (ve dolayısıyla aynı hash'i)
// üretir — bir denetçi aynı ham veriyle yeniden hesaplayıp karşılaştırabilsin.
//
// SAYISAL GÜVEN SKORU YOK: `genelDurum` beş AYRI sınıftan biridir
// (DOGRULANMIS/INCELEME_GEREKLI/ENGELLENDI/VERI_EKSIK/TEST_YOK), kural 13'ün
// "birleştirilemez" ilkesinin bu paket seviyesindeki karşılığıdır. Belirsiz
// her durumda INCELEME_GEREKLI'ye düşülür — asla sahte bir "doğrulanmış"
// iddiası üretilmez.
import { bayatMi, type TestSonuc } from "./control-test";

/** Eski sürüm — okunabilir kalır, yeniden hash'lenmez, yeni paket ÜRETMEZ. */
export const KRITIK_HIZMET_TEST_PAKETI_SCHEMA_V1 = "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1";
// Dikey F, F3: etkiToleransiOzeti eklendi — payload gerçekliği değişti, V2.
export const KRITIK_HIZMET_TEST_PAKETI_SCHEMA = "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V2";

export type KritikHizmetTestBagTuru = "DIRECT" | "VIA_CRITICAL_SERVICE_CONTROL" | "BOTH";

/**
 * Dikey F, F3 (docs/adr/PR0-dikeyF-f3-etki-toleransi-gorunurlugu-2026-07-21.md):
 * onaylı etki toleransının VARLIĞI — nicel karşılaştırma DEĞİL. `test_runs`'ta
 * yapılandırılmış bir kesinti/veri-kaybı ÖLÇÜMÜ olmadığı için "RTO karşılandı"
 * gibi bir hüküm asla üretilmez (kural 11).
 */
export type EtkiToleransiDurumu =
  | "TOLERANS_TANIMLI_VE_ONAYLI"
  | "TOLERANS_TANIMLI_FAKAT_ONAYSIZ"
  | "TOLERANS_BULUNAMADI"
  | "TOLERANS_VERISI_EKSIK"
  | "BIRDEN_FAZLA_AKTIF_TOLERANS";

/** Ham girdi — impact_tolerances'ın ZATEN VAR olan bir satırı. */
export interface ImpactToleranceInput {
  id: string;
  version: number;
  durum: "TASLAK" | "YURURLUKTE" | "SUPERSEDED";
  maxKesintiSaat: number | null;
  maxVeriKaybiSaat: number | null;
  yonetimOnayi: boolean;
  /** Ham kimlik değil — yalnız "atanmış mı" (F1'in hazirlayanBelirtildi deseni). */
  onaylayanBelirtildi: boolean;
  onayZamani: string | null;
}

export interface EtkiToleransiOzeti {
  durum: EtkiToleransiDurumu;
  toleranceId: string | null;
  version: number | null;
  maxKesintiSaat: number | null;
  maxVeriKaybiSaat: number | null;
  onayDurumu: "TASLAK" | "YURURLUKTE" | "SUPERSEDED" | null;
  onaylayanBelirtildi: boolean;
  onayZamani: string | null;
  birim: "SAAT";
  /** HER ZAMAN false — bu dilimde gerçek ölçüm yok, motor kendi kendini denetler. */
  karsilastirmaYapildi: false;
  aciklamaKodu: "GERCEK_OLCUM_YOK" | "ONAYLI_TOLERANS_YOK" | "TOLERANS_EKSIK" | "AKTIF_KAYIT_CAKISMASI" | null;
}

export type KritikHizmetTestPaketiGenelDurum =
  | "DOGRULANMIS"
  | "INCELEME_GEREKLI"
  | "ENGELLENDI"
  | "VERI_EKSIK"
  | "TEST_YOK";

export type TazelikDurumu = "TAZE" | "BAYAT" | "BILINMIYOR";

/** Ham girdi — motor bunları BİRLEŞTİRİR, hiçbirini sorgulamaz/çağırmaz. */
export interface KritikHizmetTestPaketiGirdisi {
  criticalService: { id: string; ad: string; durum: string };
  /** Snapshot'ın alındığı an (ISO). Tazelik ve tarihsel özet bununla hesaplanır. */
  asOf: string;
  /** Bu tenant'ın test tanımları (yalnız ilgili kontrol/hizmete bağlı olması ŞART değil — motor kendi filtreler). */
  testTanimlari: {
    id: string;
    controlId: string;
    tur: string;
    ad: string;
    tazelikGun: number | null;
    /** control_test_definitions.critical_service_id — DOĞRUDAN bağ (F1'in gerçek referansı). */
    criticalServiceId: string | null;
  }[];
  /** critical_service_controls'tan bu kritik hizmete bağlı control_id'ler — DOLAYLI bağ. */
  serviceControlIds: string[];
  /** İlgili test tanımlarının TÜM koşuları (yalnız en güncel değil — tarihsel özet için). */
  kosular: {
    id: string;
    testDefinitionId: string;
    /** test_runs.seq — aynı calistiAt'ta deterministik tie-break için. */
    seq: number;
    sonuc: TestSonuc;
    calistiAt: string;
    evidenceId: string | null;
  }[];
  kanitlar: { id: string; hashSha256: string | null; gecerlilikBitis: string | null }[];
  /** Bu tenant'ın kontrol testinden doğan bulguları (kaynak='kontrol_testi'). */
  bulgular: {
    id: string;
    /** findings.kaynak_test_definition_id — null olabilir (eski/elle bağlanmamış). */
    testDefinitionId: string | null;
    durum: "acik" | "kapali";
    onem: "acil" | "kritik" | "yuksek" | "orta" | "dusuk";
    kapatmaRetestRunId: string | null;
    /** Bağımsız kapanış durumu — ham kimlik değil, yalnız "atanmış mı". */
    kapatanBelirtildi: boolean;
  }[];
  /**
   * Dikey F, F3: bu kritik hizmete ait impact_tolerances kayıtları (TÜM
   * sürümler — TASLAK/YURURLUKTE/SUPERSEDED). OPSİYONEL — verilmezse (eski
   * F2 çağıranları) sonuç birebir F2 davranışıyla aynı kalır (TOLERANS_
   * BULUNAMADI, genelDurum'u ETKİLEMEZ).
   */
  impactTolerances?: ImpactToleranceInput[];
}

export interface KanitOzeti {
  evidenceId: string;
  hashSha256: string | null;
  suresiGecmis: boolean | null;
}

export interface KritikHizmetTestDurumu {
  testDefinitionId: string;
  controlId: string;
  tur: string;
  ad: string;
  bagTuru: KritikHizmetTestBagTuru;
  enGuncelKosu: {
    testRunId: string;
    sonuc: TestSonuc;
    calistiAt: string;
    tazelikDurumu: TazelikDurumu;
    kanitOzeti: KanitOzeti | null;
  } | null;
  bulguOzeti: {
    acikBulguIdleri: string[];
    kapanmisBulguIdleri: string[];
    kapanisRetestRunIdleri: string[];
    bagimsizKapanmayanBulguIdleri: string[];
  };
  tarihselOzet: {
    toplamKosu: number;
    ilkKosuAt: string | null;
    sonKosuAt: string | null;
    sonucDagilimi: Record<TestSonuc, number>;
  };
}

export interface KritikHizmetTestPaketi {
  schema: typeof KRITIK_HIZMET_TEST_PAKETI_SCHEMA;
  criticalService: { id: string; ad: string; durum: string };
  asOf: string;
  kapsam: {
    testTanimiSayisi: number;
    kontrolSayisi: number;
    dogrudanBagliSayisi: number;
    kontrolUzerindenBagliSayisi: number;
  };
  testler: KritikHizmetTestDurumu[];
  genelDurum: KritikHizmetTestPaketiGenelDurum;
  gerekceler: string[];
  /**
   * Dikey F, F3 — OPSİYONEL alan: eski V1 kayıtlarda YOK (motor onları asla
   * üretmedi), UI/Proof Room bu yokluğu "bu sürümde bilgi yok" ile savunmacı
   * okur. Motor bu alanı ARTIK HER ZAMAN doldurur (undefined DÖNMEZ).
   */
  etkiToleransiOzeti?: EtkiToleransiOzeti;
  hesaplamaYontemi: {
    surum: string;
    kapsamCozumleme: string;
    guncelKosuSecimi: string;
    worstOfKurali: string;
    tarihselIzKurali: string;
    etkiToleransiYontemi: string;
  };
}

const BOS_SONUC_DAGILIMI: Record<TestSonuc, number> = {
  PASSED: 0,
  FAILED: 0,
  UNKNOWN: 0,
  STALE: 0,
  EXCEPTION: 0,
};

function tazelikDurumuHesapla(calistiAt: string, tazelikGun: number | null, asOf: Date): TazelikDurumu {
  if (tazelikGun === null) return "BILINMIYOR";
  return bayatMi(calistiAt, tazelikGun, asOf) ? "BAYAT" : "TAZE";
}

/**
 * Onaylı etki toleransının VARLIĞINI çözer — NİCEL karşılaştırma yapmaz
 * (`karsilastirmaYapildi` her zaman false, ADR §2). `impact_tolerances_tek_
 * yururlukte` unique partial index'i DB'de birden fazla YURURLUKTE kaydını
 * yapısal olarak imkansız kılar; motor yine de bu olasılığı SAVUNMACI ele
 * alır — rastgele bir kayıt seçmez, yeni bir politika icat etmeden yalnız
 * `BIRDEN_FAZLA_AKTIF_TOLERANS` döner.
 */
function etkiToleransiOzetiHesapla(kayitlar: ImpactToleranceInput[] | undefined): EtkiToleransiOzeti {
  const BOS: Pick<EtkiToleransiOzeti, "toleranceId" | "version" | "maxKesintiSaat" | "maxVeriKaybiSaat" | "onayDurumu" | "onaylayanBelirtildi" | "onayZamani"> = {
    toleranceId: null,
    version: null,
    maxKesintiSaat: null,
    maxVeriKaybiSaat: null,
    onayDurumu: null,
    onaylayanBelirtildi: false,
    onayZamani: null,
  };

  if (!kayitlar || kayitlar.length === 0) {
    return { ...BOS, durum: "TOLERANS_BULUNAMADI", birim: "SAAT", karsilastirmaYapildi: false, aciklamaKodu: "ONAYLI_TOLERANS_YOK" };
  }

  const yururlukteler = kayitlar.filter((k) => k.durum === "YURURLUKTE");
  if (yururlukteler.length > 1) {
    return { ...BOS, durum: "BIRDEN_FAZLA_AKTIF_TOLERANS", birim: "SAAT", karsilastirmaYapildi: false, aciklamaKodu: "AKTIF_KAYIT_CAKISMASI" };
  }

  if (yururlukteler.length === 1) {
    const k = yururlukteler[0];
    const ozet: EtkiToleransiOzeti = {
      durum: "TOLERANS_TANIMLI_VE_ONAYLI",
      toleranceId: k.id,
      version: k.version,
      maxKesintiSaat: k.maxKesintiSaat,
      maxVeriKaybiSaat: k.maxVeriKaybiSaat,
      onayDurumu: k.durum,
      onaylayanBelirtildi: k.onaylayanBelirtildi,
      onayZamani: k.onayZamani,
      birim: "SAAT",
      karsilastirmaYapildi: false,
      aciklamaKodu: "GERCEK_OLCUM_YOK",
    };
    // NULL sıfır değildir — ikisi de null ise hedef fiilen boş onaylanmış demektir.
    if (k.maxKesintiSaat === null && k.maxVeriKaybiSaat === null) {
      return { ...ozet, durum: "TOLERANS_VERISI_EKSIK", aciklamaKodu: "TOLERANS_EKSIK" };
    }
    return ozet;
  }

  // YURURLUKTE yok — en güncel (en yüksek sürüm) TASLAK var mı? Onaylı hedef
  // GİBİ gösterilmez (durum ayrı), ama önerilen değerler yine de görünür.
  const taslaklar = kayitlar.filter((k) => k.durum === "TASLAK").sort((a, b) => b.version - a.version);
  if (taslaklar.length > 0) {
    const k = taslaklar[0];
    return {
      durum: "TOLERANS_TANIMLI_FAKAT_ONAYSIZ",
      toleranceId: k.id,
      version: k.version,
      maxKesintiSaat: k.maxKesintiSaat,
      maxVeriKaybiSaat: k.maxVeriKaybiSaat,
      onayDurumu: k.durum,
      onaylayanBelirtildi: k.onaylayanBelirtildi,
      onayZamani: k.onayZamani,
      birim: "SAAT",
      karsilastirmaYapildi: false,
      aciklamaKodu: null,
    };
  }

  // Yalnız SUPERSEDED kayıtlar var — fiilen yürürlükte/onaylı bir hedef yok.
  return { ...BOS, durum: "TOLERANS_BULUNAMADI", birim: "SAAT", karsilastirmaYapildi: false, aciklamaKodu: "ONAYLI_TOLERANS_YOK" };
}

/**
 * Kritik hizmetin GÜNCEL test kapsamını + mühürlenmiş paketi projekte eder.
 *
 * Kapsam çözümleme (kural 11 — uydurma yok): bir test tanımı yalnız İKİ
 * güvenilir yoldan kapsama girer — `criticalServiceId` DOĞRUDAN eşleşmesi
 * veya `controlId`'nin `serviceControlIds` içinde olması. Serbest metin
 * (`kritik_hizmet_adi`) ASLA otomatik eşleştirme için kullanılmaz — çağıran
 * bunu girdiye hiç dahil etmez.
 */
export function kritikHizmetTestPaketiOlustur(girdi: KritikHizmetTestPaketiGirdisi): KritikHizmetTestPaketi {
  const asOfDate = new Date(girdi.asOf);
  const serviceControlSet = new Set(girdi.serviceControlIds);

  const kapsamdakiTanimlar = girdi.testTanimlari
    .map((t) => {
      const dogrudan = t.criticalServiceId === girdi.criticalService.id;
      const dolayli = serviceControlSet.has(t.controlId);
      if (!dogrudan && !dolayli) return null;
      const bagTuru: KritikHizmetTestBagTuru = dogrudan && dolayli ? "BOTH" : dogrudan ? "DIRECT" : "VIA_CRITICAL_SERVICE_CONTROL";
      return { tanim: t, bagTuru };
    })
    .filter((x): x is { tanim: (typeof girdi.testTanimlari)[number]; bagTuru: KritikHizmetTestBagTuru } => x !== null)
    // Girdi sırasından BAĞIMSIZ, kararlı çıktı — hash yalnız İÇERİĞE bağlı olsun.
    .sort((a, b) => a.tanim.id.localeCompare(b.tanim.id));

  const kanitMap = new Map(girdi.kanitlar.map((k) => [k.id, k]));

  const testler: KritikHizmetTestDurumu[] = kapsamdakiTanimlar.map(({ tanim, bagTuru }) => {
    const kosularBu = girdi.kosular
      .filter((k) => k.testDefinitionId === tanim.id)
      .sort((a, b) => {
        const t = new Date(b.calistiAt).getTime() - new Date(a.calistiAt).getTime();
        return t !== 0 ? t : b.seq - a.seq;
      });
    const enGuncel = kosularBu[0] ?? null;

    const bulgularBu = girdi.bulgular.filter((b) => b.testDefinitionId === tanim.id);

    const sonucDagilimi: Record<TestSonuc, number> = { ...BOS_SONUC_DAGILIMI };
    for (const k of kosularBu) sonucDagilimi[k.sonuc]++;

    let kanitOzeti: KanitOzeti | null = null;
    if (enGuncel?.evidenceId) {
      const k = kanitMap.get(enGuncel.evidenceId);
      kanitOzeti = {
        evidenceId: enGuncel.evidenceId,
        hashSha256: k?.hashSha256 ?? null,
        suresiGecmis: k?.gecerlilikBitis ? asOfDate > new Date(k.gecerlilikBitis) : null,
      };
    }

    return {
      testDefinitionId: tanim.id,
      controlId: tanim.controlId,
      tur: tanim.tur,
      ad: tanim.ad,
      bagTuru,
      enGuncelKosu: enGuncel
        ? {
            testRunId: enGuncel.id,
            sonuc: enGuncel.sonuc,
            calistiAt: enGuncel.calistiAt,
            tazelikDurumu: tazelikDurumuHesapla(enGuncel.calistiAt, tanim.tazelikGun, asOfDate),
            kanitOzeti,
          }
        : null,
      bulguOzeti: {
        acikBulguIdleri: bulgularBu.filter((b) => b.durum === "acik").map((b) => b.id).sort(),
        kapanmisBulguIdleri: bulgularBu.filter((b) => b.durum === "kapali").map((b) => b.id).sort(),
        kapanisRetestRunIdleri: [...new Set(bulgularBu.map((b) => b.kapatmaRetestRunId).filter((x): x is string => !!x))].sort(),
        bagimsizKapanmayanBulguIdleri: bulgularBu.filter((b) => b.durum === "kapali" && !b.kapatanBelirtildi).map((b) => b.id).sort(),
      },
      tarihselOzet: {
        toplamKosu: kosularBu.length,
        ilkKosuAt: kosularBu.length > 0 ? kosularBu[kosularBu.length - 1].calistiAt : null,
        sonKosuAt: kosularBu.length > 0 ? kosularBu[0].calistiAt : null,
        sonucDagilimi,
      },
    };
  });

  const etkiToleransiOzeti = etkiToleransiOzetiHesapla(girdi.impactTolerances);
  const { genelDurum, gerekceler } = genelDurumHesapla(testler, etkiToleransiOzeti);

  return {
    schema: KRITIK_HIZMET_TEST_PAKETI_SCHEMA,
    criticalService: girdi.criticalService,
    asOf: girdi.asOf,
    kapsam: {
      testTanimiSayisi: testler.length,
      kontrolSayisi: new Set(testler.map((t) => t.controlId)).size,
      dogrudanBagliSayisi: testler.filter((t) => t.bagTuru === "DIRECT" || t.bagTuru === "BOTH").length,
      kontrolUzerindenBagliSayisi: testler.filter((t) => t.bagTuru === "VIA_CRITICAL_SERVICE_CONTROL" || t.bagTuru === "BOTH").length,
    },
    testler,
    genelDurum,
    gerekceler,
    etkiToleransiOzeti,
    hesaplamaYontemi: {
      surum: "kritik-hizmet-test-paketi-v2",
      kapsamCozumleme: "DIRECT (control_test_definitions.critical_service_id) + VIA_CRITICAL_SERVICE_CONTROL (critical_service_controls.control_id) — deterministik birleşim, serbest metinle eşleştirme yok.",
      guncelKosuSecimi: "Her test tanımı için en yüksek calisti_at; eşitlikte en yüksek seq (append-only sıra).",
      worstOfKurali: "FAILED > (UNKNOWN/EXCEPTION/STALE/BAYAT/eksik-koşu) > PASSED+TAZE. Belirsizlikte INCELEME_GEREKLI — asla sahte DOGRULANMIS üretilmez.",
      tarihselIzKurali: "Tam koşu geçmişi kopyalanmaz — yalnız sayaç/kimlik listeleri (toplam/sonuç dağılımı/ilk-son tarih/bulgu-retest kimlikleri).",
      etkiToleransiYontemi:
        "Onaylı etki toleransı gösterilmiştir. Test koşusunda yapılandırılmış gerçek kesinti/veri kaybı ölçümü bulunmadığından nicel uygunluk karşılaştırması yapılmamıştır.",
    },
  };
}

/**
 * Dikey F, F3 (ADR §7): tolerans durumu ASLA yeni bir "üstünlük" yaratmaz —
 * yalnız zaten-DOGRULANMIS bir sonucu INCELEME_GEREKLI'ye düşürebilir. Diğer
 * her durumda (ENGELLENDI/VERI_EKSIK/TEST_YOK/zaten-INCELEME_GEREKLI) worst-of
 * sonucu OLDUĞU GİBİ korunur — tolerans bilgisi bunları "iyileştirmez".
 */
function etkiToleransiGerekceUygula(
  base: { genelDurum: KritikHizmetTestPaketiGenelDurum; gerekceler: string[] },
  etkiToleransiOzeti: EtkiToleransiOzeti,
): { genelDurum: KritikHizmetTestPaketiGenelDurum; gerekceler: string[] } {
  if (etkiToleransiOzeti.durum !== "TOLERANS_TANIMLI_FAKAT_ONAYSIZ" && etkiToleransiOzeti.durum !== "BIRDEN_FAZLA_AKTIF_TOLERANS") {
    return base;
  }

  const gerekceler = [...base.gerekceler];
  if (etkiToleransiOzeti.durum === "TOLERANS_TANIMLI_FAKAT_ONAYSIZ") {
    gerekceler.push("Etki toleransı yalnız taslak — yönetim onayı yok.");
  } else {
    gerekceler.push("Birden fazla aktif etki toleransı kaydı çakışıyor — tekil onaylı hedef çözülemedi.");
  }

  if (base.genelDurum === "DOGRULANMIS") {
    return { genelDurum: "INCELEME_GEREKLI", gerekceler };
  }
  return { genelDurum: base.genelDurum, gerekceler };
}

function genelDurumHesapla(
  testler: KritikHizmetTestDurumu[],
  etkiToleransiOzeti: EtkiToleransiOzeti,
): { genelDurum: KritikHizmetTestPaketiGenelDurum; gerekceler: string[] } {
  if (testler.length === 0) {
    return etkiToleransiGerekceUygula({ genelDurum: "TEST_YOK", gerekceler: ["Kapsamda hiç test tanımı yok."] }, etkiToleransiOzeti);
  }

  const kosusuzTanimlar = testler.filter((t) => t.enGuncelKosu === null);
  if (kosusuzTanimlar.length === testler.length) {
    return etkiToleransiGerekceUygula(
      { genelDurum: "VERI_EKSIK", gerekceler: ["Kapsamdaki hiçbir test tanımının koşusu yok."] },
      etkiToleransiOzeti,
    );
  }

  const gerekceler: string[] = [];

  if (kosusuzTanimlar.length > 0) {
    gerekceler.push(`${kosusuzTanimlar.length} test tanımının hiç koşusu yok.`);
  }

  const failedTanimlar = testler.filter((t) => t.enGuncelKosu?.sonuc === "FAILED");
  if (failedTanimlar.length > 0) {
    gerekceler.push(`${failedTanimlar.length} test tanımının en güncel koşusu FAILED.`);
    return etkiToleransiGerekceUygula({ genelDurum: "ENGELLENDI", gerekceler }, etkiToleransiOzeti);
  }

  const belirsizTanimlar = testler.filter(
    (t) =>
      t.enGuncelKosu !== null &&
      (t.enGuncelKosu.sonuc === "UNKNOWN" ||
        t.enGuncelKosu.sonuc === "EXCEPTION" ||
        t.enGuncelKosu.sonuc === "STALE" ||
        t.enGuncelKosu.tazelikDurumu === "BAYAT"),
  );
  if (belirsizTanimlar.length > 0) {
    gerekceler.push(`${belirsizTanimlar.length} test tanımının güncel koşusu belirsiz/bayat (UNKNOWN/EXCEPTION/STALE veya tazelik penceresi geçmiş).`);
  }

  const acikKritikBulgular = testler.flatMap((t) => t.bulguOzeti.acikBulguIdleri.map((id) => ({ testDefinitionId: t.testDefinitionId, findingId: id })));
  if (acikKritikBulgular.length > 0) {
    gerekceler.push(`${acikKritikBulgular.length} açık bulgu var (kapanış retest'i beklenmekte olabilir).`);
  }

  if (kosusuzTanimlar.length > 0 || belirsizTanimlar.length > 0 || acikKritikBulgular.length > 0) {
    return etkiToleransiGerekceUygula({ genelDurum: "INCELEME_GEREKLI", gerekceler }, etkiToleransiOzeti);
  }

  gerekceler.push("Kapsamdaki tüm test tanımlarının en güncel koşusu PASSED ve taze.");
  return etkiToleransiGerekceUygula({ genelDurum: "DOGRULANMIS", gerekceler }, etkiToleransiOzeti);
}
