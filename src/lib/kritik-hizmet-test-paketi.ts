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

export const KRITIK_HIZMET_TEST_PAKETI_SCHEMA = "KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1";

export type KritikHizmetTestBagTuru = "DIRECT" | "VIA_CRITICAL_SERVICE_CONTROL" | "BOTH";

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
  hesaplamaYontemi: {
    surum: string;
    kapsamCozumleme: string;
    guncelKosuSecimi: string;
    worstOfKurali: string;
    tarihselIzKurali: string;
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

  const { genelDurum, gerekceler } = genelDurumHesapla(testler);

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
    hesaplamaYontemi: {
      surum: "kritik-hizmet-test-paketi-v1",
      kapsamCozumleme: "DIRECT (control_test_definitions.critical_service_id) + VIA_CRITICAL_SERVICE_CONTROL (critical_service_controls.control_id) — deterministik birleşim, serbest metinle eşleştirme yok.",
      guncelKosuSecimi: "Her test tanımı için en yüksek calisti_at; eşitlikte en yüksek seq (append-only sıra).",
      worstOfKurali: "FAILED > (UNKNOWN/EXCEPTION/STALE/BAYAT/eksik-koşu) > PASSED+TAZE. Belirsizlikte INCELEME_GEREKLI — asla sahte DOGRULANMIS üretilmez.",
      tarihselIzKurali: "Tam koşu geçmişi kopyalanmaz — yalnız sayaç/kimlik listeleri (toplam/sonuç dağılımı/ilk-son tarih/bulgu-retest kimlikleri).",
    },
  };
}

function genelDurumHesapla(testler: KritikHizmetTestDurumu[]): { genelDurum: KritikHizmetTestPaketiGenelDurum; gerekceler: string[] } {
  if (testler.length === 0) {
    return { genelDurum: "TEST_YOK", gerekceler: ["Kapsamda hiç test tanımı yok."] };
  }

  const kosusuzTanimlar = testler.filter((t) => t.enGuncelKosu === null);
  if (kosusuzTanimlar.length === testler.length) {
    return { genelDurum: "VERI_EKSIK", gerekceler: ["Kapsamdaki hiçbir test tanımının koşusu yok."] };
  }

  const gerekceler: string[] = [];

  if (kosusuzTanimlar.length > 0) {
    gerekceler.push(`${kosusuzTanimlar.length} test tanımının hiç koşusu yok.`);
  }

  const failedTanimlar = testler.filter((t) => t.enGuncelKosu?.sonuc === "FAILED");
  if (failedTanimlar.length > 0) {
    gerekceler.push(`${failedTanimlar.length} test tanımının en güncel koşusu FAILED.`);
    return { genelDurum: "ENGELLENDI", gerekceler };
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
    return { genelDurum: "INCELEME_GEREKLI", gerekceler };
  }

  gerekceler.push("Kapsamdaki tüm test tanımlarının en güncel koşusu PASSED ve taze.");
  return { genelDurum: "DOGRULANMIS", gerekceler };
}
