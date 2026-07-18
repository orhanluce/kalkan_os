// Legal-basis guard motoru (V2 PR-4b adım 4, M23).
//
// NE İŞE YARAR: M12 kontrol testi ÇALIŞMADAN ÖNCE, koşunun dayandığı yasal
// zincirin (hüküm → yükümlülük → eşleme → applicability) durumuna bakar ve
// üç AYRI karardan birini verir:
//
//   ALLOW               Dayanak iddiası yok ya da zincir sağlam.
//   ALLOW_WITH_WARNING  Koşu engellenmez ama dayanak iddiasında görünür bir
//                       zayıflık var (kapsam değerlendirilmemiş, kısmi eşleme,
//                       şartlı uygulanabilirlik, rehber nitelikte sorun...).
//   BLOCK               ZORUNLU nitelikte bir yükümlülüğe dayanak iddiası var
//                       ama zincir doğrulanmamış/yürürlükte değil — koşu bu
//                       dayanakla ÇALIŞTIRILAMAZ (V2 kabulü: hukuk onayı
//                       olmayan eşleme zorunlu kontrol çalıştırmaz).
//
// İLKELER:
//   * İKİNCİ MOTOR YOK: bu modül test SONUCU üretmez — M12 motoru neyse odur.
//     Burası yalnızca koşu ÖNCESİ dayanak kapısıdır.
//   * Dayanak iddiası OLMAYAN kontrol bloklanmaz: bugün M12 testleri yasal
//     eşleme olmadan da koşuyor (güvence değeri var). Guard'ın işi sahte/çürük
//     DAYANAK İDDİASINI engellemektir, dayanaksız güvence koşusunu değil.
//   * KAPSAM SORUNLARI BLOK DEĞİL UYARIDIR: applicability eksik/bayat/UNKNOWN
//     diye test koşusunu engellemek güvence toplamayı durdururdu (kural 13
//     ruhu: "değerlendiremedik" cezalandırmaz) — ama iddia raporda görünür
//     şekilde zayıflar.
//   * DETERMİNİSTİK (kural 11): Date.now yok, asOf parametredir; eşlemeler
//     kimliğe göre sıralanır — aynı girdi kümesi her zaman aynı kararı ve aynı
//     sebep listesini verir.

export type LegalBasisKarar = "ALLOW" | "ALLOW_WITH_WARNING" | "BLOCK";

export type DogrulamaDurumu =
  | "DRAFT_RESEARCH"
  | "TODO_DOGRULA"
  | "LEGAL_REVIEW"
  | "VERIFIED"
  | "SUPERSEDED"
  | "REJECTED";

export type ApplicabilityDurumKarar =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "CONDITIONAL"
  | "UNKNOWN";

/** Koşu anında zincirden okunan ham malzeme (SQL yalnız bunu toplar). */
export interface DayanakEslemesi {
  mappingId: string;
  obligationKod: string;
  /** Yükümlülüğün niteliği: zorunlu mu rehber mi. */
  nitelik: "zorunlu" | "rehber";
  /** Eşlemenin kapsam iddiası: kontrol yükümlülüğü tam mı kısmen mi karşılıyor. */
  kapsam: "tam" | "kismi";
  obligationDogrulama: DogrulamaDurumu;
  mappingDogrulama: DogrulamaDurumu;
  hukum: {
    provisionRef: string;
    effectiveFrom: string; // ISO tarih
    effectiveTo: string | null;
    /** system_to null mu — kayıt güncel mi (bitemporal bilgi ekseni). */
    guncelKayit: boolean;
  };
  applicability: {
    /** Güncel (superseded_at null) karar var mı. */
    mevcut: boolean;
    durum: ApplicabilityDurumKarar | null;
    kosul: string | null;
    /**
     * Kararın fact fingerprint'i BUGÜNKÜ profille aynı mı.
     * null = karşılaştırılamadı (profil yok vb.) — bayat sayılır.
     */
    fingerprintGuncel: boolean | null;
  };
}

export interface LegalBasisSebep {
  kod:
    | "DAYANAK_IDDIASI_YOK"
    | "DOGRULANMAMIS_YUKUMLULUK"
    | "DOGRULANMAMIS_ESLEME"
    | "HUKUM_YURURLUKTE_DEGIL"
    | "HUKUM_KAYDI_GUNCEL_DEGIL"
    | "KAPSAM_DEGERLENDIRILMEMIS"
    | "KAPSAM_BAYAT"
    | "KAPSAM_UYGULANMAZ_KARARI"
    | "KAPSAM_SARTLI"
    | "KISMI_ESLEME";
  seviye: "bilgi" | "uyari" | "blok";
  mesaj: string;
  mappingId: string | null;
}

export interface LegalBasisSonucu {
  karar: LegalBasisKarar;
  /** NEDEN bu karar (kural 11) — gerekçesiz kapı "sistem böyle dedi"dir. */
  sebepler: LegalBasisSebep[];
}

/** asOf (ISO tarih/zaman) hükmün yürürlük penceresinde mi. */
function hukumYururlukte(h: DayanakEslemesi["hukum"], asOf: string): boolean {
  const gun = asOf.slice(0, 10);
  if (h.effectiveFrom > gun) return false;
  if (h.effectiveTo !== null && h.effectiveTo < gun) return false;
  return true;
}

export function legalBasisDegerlendir(
  eslemeler: DayanakEslemesi[],
  asOf: string,
): LegalBasisSonucu {
  if (eslemeler.length === 0) {
    return {
      karar: "ALLOW",
      sebepler: [
        {
          kod: "DAYANAK_IDDIASI_YOK",
          seviye: "bilgi",
          mesaj: "Bu kontrol için yasal dayanak eşlemesi yok; koşu dayanak iddiası taşımaz.",
          mappingId: null,
        },
      ],
    };
  }

  const sebepler: LegalBasisSebep[] = [];
  // Kural 11: girdi sırasından bağımsızlık — kimliğe göre sırala.
  const sirali = [...eslemeler].sort((a, b) => a.mappingId.localeCompare(b.mappingId));

  for (const e of sirali) {
    // Zorunlu nitelikte doğrulanmamış zincir halkası BLOK'tur; rehberde uyarı.
    const zincirSeviye: "blok" | "uyari" = e.nitelik === "zorunlu" ? "blok" : "uyari";

    if (e.obligationDogrulama !== "VERIFIED") {
      sebepler.push({
        kod: "DOGRULANMAMIS_YUKUMLULUK",
        seviye: zincirSeviye,
        mesaj: `${e.obligationKod}: yükümlülük ${e.obligationDogrulama} durumunda — hukuk doğrulaması yok.`,
        mappingId: e.mappingId,
      });
    }
    if (e.mappingDogrulama !== "VERIFIED") {
      sebepler.push({
        kod: "DOGRULANMAMIS_ESLEME",
        seviye: zincirSeviye,
        mesaj: `${e.obligationKod}: kontrol eşlemesi ${e.mappingDogrulama} durumunda — hukuk doğrulaması yok.`,
        mappingId: e.mappingId,
      });
    }
    if (!hukumYururlukte(e.hukum, asOf)) {
      sebepler.push({
        kod: "HUKUM_YURURLUKTE_DEGIL",
        seviye: zincirSeviye,
        mesaj: `${e.hukum.provisionRef}: hüküm ${asOf.slice(0, 10)} itibarıyla yürürlükte değil.`,
        mappingId: e.mappingId,
      });
    }
    if (!e.hukum.guncelKayit) {
      sebepler.push({
        kod: "HUKUM_KAYDI_GUNCEL_DEGIL",
        seviye: zincirSeviye,
        mesaj: `${e.hukum.provisionRef}: hüküm kaydı güncel değil (system-time kapatılmış — düzeltilmiş sürümü kullanılmalı).`,
        mappingId: e.mappingId,
      });
    }

    // Kapsam sorunları UYARI — koşuyu durdurmaz, iddiayı zayıflatır.
    if (!e.applicability.mevcut || e.applicability.durum === "UNKNOWN") {
      sebepler.push({
        kod: "KAPSAM_DEGERLENDIRILMEMIS",
        seviye: "uyari",
        mesaj: `${e.obligationKod}: uygulanabilirlik değerlendirilmemiş (UNKNOWN) — dayanak kapsamı belirsiz.`,
        mappingId: e.mappingId,
      });
    } else {
      if (e.applicability.fingerprintGuncel !== true) {
        sebepler.push({
          kod: "KAPSAM_BAYAT",
          seviye: "uyari",
          mesaj: `${e.obligationKod}: uygulanabilirlik kararı güncel kurum profiliyle verilmemiş — yeniden değerlendirme gerekir.`,
          mappingId: e.mappingId,
        });
      }
      if (e.applicability.durum === "NOT_APPLICABLE") {
        sebepler.push({
          kod: "KAPSAM_UYGULANMAZ_KARARI",
          seviye: "uyari",
          mesaj: `${e.obligationKod}: kurum için onaylı "uygulanmaz" kararı var — bu yükümlülük dayanak olarak GÖSTERİLEMEZ.`,
          mappingId: e.mappingId,
        });
      }
      if (e.applicability.durum === "CONDITIONAL") {
        sebepler.push({
          kod: "KAPSAM_SARTLI",
          seviye: "uyari",
          mesaj: `${e.obligationKod}: uygulanabilirlik şartlı — şart: ${e.applicability.kosul ?? "(kayıtlı şart metni yok)"}.`,
          mappingId: e.mappingId,
        });
      }
    }

    if (e.kapsam === "kismi") {
      sebepler.push({
        kod: "KISMI_ESLEME",
        seviye: "uyari",
        mesaj: `${e.obligationKod}: eşleme KISMİ — bu kontrol tek başına yükümlülüğü karşılamaz.`,
        mappingId: e.mappingId,
      });
    }
  }

  const karar: LegalBasisKarar = sebepler.some((s) => s.seviye === "blok")
    ? "BLOCK"
    : sebepler.some((s) => s.seviye === "uyari")
      ? "ALLOW_WITH_WARNING"
      : "ALLOW";

  return { karar, sebepler };
}

export const EXECUTION_LEGAL_SNAPSHOT_SCHEMA = "KALKAN_EXECUTION_LEGAL_SNAPSHOT_V1";

/**
 * Koşuya mühürlenecek değişmez dayanak fotoğrafı: girdiler + karar + sebepler +
 * asOf. RFC 8785 kanonik hash'i adım 5'te `legalSnapshotHash` olarak sitasyon
 * paketine girer (kural 15: hash'in adı neyi doğruladığını söyler).
 */
export function executionLegalSnapshot(
  eslemeler: DayanakEslemesi[],
  asOf: string,
  sonuc: LegalBasisSonucu,
) {
  return {
    schema: EXECUTION_LEGAL_SNAPSHOT_SCHEMA,
    asOf,
    eslemeler: [...eslemeler].sort((a, b) => a.mappingId.localeCompare(b.mappingId)),
    karar: sonuc.karar,
    sebepler: sonuc.sebepler,
  };
}
