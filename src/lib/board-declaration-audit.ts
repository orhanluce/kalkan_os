// Yönetim Kurulu Beyanı — çapraz denetim motoru (docs/ROADMAP.md M10,
// kurucu spesifikasyonu 17 Temmuz 2026).
//
// scoring.ts'teki disiplinin aynısı: DETERMİNİSTİK VE AÇIKLANABİLİR.
// Rastgelelik, Date.now() veya dış çağrı YOKTUR — her şey parametre olarak
// gelir. "Evet" cevabı tek başına yeterli değildir; amaç YK'nın teknik
// uzmanlık beyanı vermesi değil, kritik riskler hakkında zamanında ve
// güvenilir bilgiye dayanarak karar verip vermediğini belgelemektir.
//
// BU MODÜL SONUCU SAKLAMAZ, HER ÇAĞRIDA HESAPLAR — verification.ts'teki
// verifyEvidence ile aynı gerekçe: bir cevap "tutarlı" diye DB'ye yazılsaydı,
// sonradan eklenen bir kanıt veya kapanmayan bir bulgu bu etiketi bayatlatır
// ve gerçek bir sorunu gizlerdi.

export type BeyanDegeri = "evet" | "hayir" | "kismen" | "uygulanamaz";

export type BeyanDurumu =
  | "BEYAN_VAR_KANIT_YOK"
  | "BEYAN_VAR_KANIT_EKSIK"
  | "BEYAN_VE_KANIT_UYUMLU"
  | "BEYAN_VE_KANIT_TUTARSIZ"
  | "INCELEME_GEREKLI";

export interface BeyanKanitGirdisi {
  beyan: BeyanDegeri;
  kanitSayisi: number;
  /** Son doğrulamanın üzerinden ne kadar süre geçmesi kabul edilebilir. */
  toleransGun: number;
  sonDogrulamaTarihi: string | null;
}

export interface BeyanDurumuSonucu {
  durum: BeyanDurumu;
  gerekce: string;
}

function gunFarki(a: Date, b: string): number {
  return Math.floor((a.getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Tek bir cevabın kanıtla tutarlılığını değerlendirir.
 *
 * "Evet" cevabı özel muameleye tabidir çünkü iddiası en güçlü olandır: kanıt
 * yoksa BEYAN_VAR_KANIT_YOK, kanıt var ama doğrulama tarihi eski veya hiç
 * girilmemişse BEYAN_VAR_KANIT_EKSIK / INCELEME_GEREKLI. "Hayır" ve
 * "uygulanamaz" kanıt gerektirmez — olumsuz bir beyanın kanıtı olmaz.
 */
export function beyanDurumuHesapla(girdi: BeyanKanitGirdisi, asOf: Date): BeyanDurumuSonucu {
  if (girdi.beyan === "hayir" || girdi.beyan === "uygulanamaz") {
    return {
      durum: "BEYAN_VE_KANIT_UYUMLU",
      gerekce: `Beyan "${girdi.beyan}": kanıt gerektirmiyor.`,
    };
  }

  if (girdi.kanitSayisi === 0) {
    return {
      durum: "BEYAN_VAR_KANIT_YOK",
      gerekce: `Beyan "${girdi.beyan}" ama bağlı hiçbir kanıt/kayıt yok.`,
    };
  }

  if (!girdi.sonDogrulamaTarihi) {
    return {
      durum: "INCELEME_GEREKLI",
      gerekce: `Kanıt var (${girdi.kanitSayisi}) ama son doğrulama tarihi girilmemiş.`,
    };
  }

  const gecenGun = gunFarki(asOf, girdi.sonDogrulamaTarihi);
  if (gecenGun < 0) {
    // Gelecekteki bir tarih: veri girişinde hata. Sessizce geçmiyoruz.
    return {
      durum: "INCELEME_GEREKLI",
      gerekce: `Son doğrulama tarihi gelecekte görünüyor (${girdi.sonDogrulamaTarihi}).`,
    };
  }

  if (gecenGun > girdi.toleransGun) {
    return {
      durum: "BEYAN_VAR_KANIT_EKSIK",
      gerekce: `Son doğrulamanın üzerinden ${gecenGun} gün geçmiş (tolerans ${girdi.toleransGun} gün).`,
    };
  }

  return {
    durum: "BEYAN_VE_KANIT_UYUMLU",
    gerekce: `${girdi.kanitSayisi} kanıt bağlı, son doğrulama ${gecenGun} gün önce.`,
  };
}

// ---------------------------------------------------------------------
// Çapraz denetim kuralları (CR-001..CR-008)
// ---------------------------------------------------------------------

export type CrDegerlendirmeTipi =
  | "KANIT_YOK_ISE_TUTARSIZ"
  | "KANIT_SURESI_GECMISSE"
  | "HEDEF_ASILDIYSA"
  | "TEDARIKCI_ENVANTERINDE_YOK"
  | "ERISIM_INCELEME_GECMIS"
  | "SLA_ASILMIS"
  | "RAPORLAMA_IZI_YOK"
  | "SIMULASYON_KRITIK_ESIK_ALTI";

/**
 * Kuralın gerçek veriye karşı çalışıp çalışamayacağı.
 *
 * MODEL_YOK olan kurallar (CR-004 tedarikçi, CR-005 IAM erişim incelemesi,
 * CR-006 sızma testi SLA takibi) için KALKAN-OS'ta henüz karşılık gelen veri
 * modeli yok. Değerlendirici bunlar için SAHTE bir karşılaştırma ÜRETMEZ —
 * dürüstçe "incelenemedi" döner.
 */
export type VeriKaynagiDurumu = "MEVCUT" | "MODEL_YOK" | "KISMI";

export interface CrKural {
  kod: string;
  aciklama: string;
  degerlendirmeTipi: CrDegerlendirmeTipi;
  parametreler: Record<string, unknown>;
  onerilenBulguBasligi: string;
  riskSeviyesi: "dusuk" | "orta" | "orta_yuksek" | "yuksek" | "kritik";
  veriKaynagiDurumu: VeriKaynagiDurumu;
}

export interface CrGirdi {
  beyan: BeyanDegeri;
  kanitSayisi: number;
  sonDogrulamaTarihi: string | null;
  /** HEDEF_ASILDIYSA için: beyan edilen hedef ve fiili sonuç (örn. RTO saat). */
  beyanEdilenHedefSaat: number | null;
  fiiliSonucSaat: number | null;
  /** RAPORLAMA_IZI_YOK için: audit_log'da ilgili kayıt bulundu mu. null = kontrol edilmedi. */
  auditKaydiVarMi: boolean | null;
  /** SIMULASYON_KRITIK_ESIK_ALTI için: bağlı tatbikatın genel sonucu. */
  simulasyonDurumu: "BASARILI" | "KISMI" | "BASARISIZ" | "CRITICAL_FAILURE" | null;
}

export type CrSonuc = "tetiklendi" | "tetiklenmedi" | "incelenemedi";

export interface CrDegerlendirmeSonucu {
  kod: string;
  sonuc: CrSonuc;
  gerekce: string;
  riskSeviyesi: CrKural["riskSeviyesi"] | null;
  bulguBasligi: string | null;
}

function sayi(parametreler: Record<string, unknown>, ad: string, varsayilan: number): number {
  const v = parametreler[ad];
  return typeof v === "number" ? v : varsayilan;
}

function incelenemedi(kod: string, gerekce: string): CrDegerlendirmeSonucu {
  return { kod, sonuc: "incelenemedi", gerekce, riskSeviyesi: null, bulguBasligi: null };
}

function tetiklendi(kural: CrKural, gerekce: string): CrDegerlendirmeSonucu {
  return {
    kod: kural.kod,
    sonuc: "tetiklendi",
    gerekce,
    riskSeviyesi: kural.riskSeviyesi,
    bulguBasligi: kural.onerilenBulguBasligi,
  };
}

function tetiklenmedi(kod: string, gerekce: string): CrDegerlendirmeSonucu {
  return { kod, sonuc: "tetiklenmedi", gerekce, riskSeviyesi: null, bulguBasligi: null };
}

/**
 * Tek bir çapraz denetim kuralını değerlendirir.
 *
 * VERİ KAYNAĞI KAPISI EN BAŞTA: kuralın tipi ne olursa olsun, veriKaynagiDurumu
 * MEVCUT değilse doğrudan "incelenemedi" döner. Bu, gelecekte biri yanlışlıkla
 * MODEL_YOK bir kural için gerçek veri girmeye çalışsa bile (örn. CrGirdi'ye
 * rastgele bir tedarikçi alanı eklenirse) kuralın kendi bildirdiği durumun
 * geçerli olmasını garanti eder — kural NEYE göre çalışacağını kendi söyler.
 */
export function crKuraliDegerlendir(
  kural: CrKural,
  girdi: CrGirdi,
  asOf: Date,
): CrDegerlendirmeSonucu {
  if (kural.veriKaynagiDurumu !== "MEVCUT") {
    return incelenemedi(
      kural.kod,
      `Bu kural için gerekli veri modeli henüz yok (${kural.veriKaynagiDurumu}). ` +
        `Manuel inceleme gerekir: ${kural.aciklama}`,
    );
  }

  switch (kural.degerlendirmeTipi) {
    case "KANIT_YOK_ISE_TUTARSIZ": {
      if (girdi.beyan !== "evet") return tetiklenmedi(kural.kod, `Beyan "${girdi.beyan}": kural uygulanmaz.`);
      if (girdi.kanitSayisi > 0) {
        return tetiklenmedi(kural.kod, `${girdi.kanitSayisi} kanıt bağlı.`);
      }
      return tetiklendi(kural, `Beyan "evet" ama bağlı kanıt sayısı 0.`);
    }

    case "KANIT_SURESI_GECMISSE": {
      if (girdi.beyan !== "evet" || girdi.kanitSayisi === 0) {
        return tetiklenmedi(kural.kod, "Beyan 'evet' değil veya kanıt yok: bu kural uygulanmaz.");
      }
      if (!girdi.sonDogrulamaTarihi) {
        return incelenemedi(kural.kod, "Kanıt var ama son doğrulama tarihi girilmemiş.");
      }
      const toleransGun = sayi(kural.parametreler, "tolerans_gun", 365);
      const gecenGun = gunFarki(asOf, girdi.sonDogrulamaTarihi);
      if (gecenGun > toleransGun) {
        return tetiklendi(kural, `Son doğrulamanın üzerinden ${gecenGun} gün geçmiş (tolerans ${toleransGun}).`);
      }
      return tetiklenmedi(kural.kod, `Son doğrulama ${gecenGun} gün önce, tolerans içinde.`);
    }

    case "HEDEF_ASILDIYSA": {
      if (girdi.beyanEdilenHedefSaat === null || girdi.fiiliSonucSaat === null) {
        return incelenemedi(kural.kod, "Beyan edilen hedef veya fiili sonuç bağlanmamış.");
      }
      if (girdi.fiiliSonucSaat > girdi.beyanEdilenHedefSaat) {
        return tetiklendi(
          kural,
          `Fiili sonuç ${girdi.fiiliSonucSaat} saat, beyan edilen hedef ${girdi.beyanEdilenHedefSaat} saat.`,
        );
      }
      return tetiklenmedi(
        kural.kod,
        `Fiili sonuç (${girdi.fiiliSonucSaat} saat) beyan edilen hedefi (${girdi.beyanEdilenHedefSaat} saat) aşmadı.`,
      );
    }

    case "RAPORLAMA_IZI_YOK": {
      if (girdi.beyan !== "evet") return tetiklenmedi(kural.kod, `Beyan "${girdi.beyan}": kural uygulanmaz.`);
      if (girdi.auditKaydiVarMi === null) {
        return incelenemedi(kural.kod, "Denetim izi kontrol edilmedi.");
      }
      if (!girdi.auditKaydiVarMi) {
        return tetiklendi(kural, "Beyan 'evet' ama denetim izinde ilgili kayıt bulunamadı.");
      }
      return tetiklenmedi(kural.kod, "Denetim izinde ilgili kayıt bulundu.");
    }

    case "SIMULASYON_KRITIK_ESIK_ALTI": {
      if (girdi.simulasyonDurumu === null) {
        return incelenemedi(kural.kod, "Bağlı bir tatbikat sonucu yok.");
      }
      if (girdi.simulasyonDurumu === "BASARISIZ" || girdi.simulasyonDurumu === "CRITICAL_FAILURE") {
        return tetiklendi(kural, `Bağlı tatbikat sonucu: ${girdi.simulasyonDurumu}.`);
      }
      return tetiklenmedi(kural.kod, `Bağlı tatbikat sonucu: ${girdi.simulasyonDurumu}.`);
    }

    // TEDARIKCI_ENVANTERINDE_YOK / ERISIM_INCELEME_GECMIS / SLA_ASILMIS:
    // bu tiplerin veri modeli yok. veriKaynagiDurumu kapısı bunları normalde
    // MODEL_YOK olarak zaten yukarıda eler; buraya düşerlerse (yanlış
    // yapılandırılmış bir kural) yine de sahte sonuç ÜRETMEYİZ.
    default:
      return incelenemedi(kural.kod, `"${kural.degerlendirmeTipi}" tipi için değerlendirici henüz yok.`);
  }
}

/** Bir dönemin tüm kurallarını değerlendirir; yalnızca tetiklenenleri döndürür. */
export function tetiklenenKurallariBul(
  degerlendirmeler: Array<{ kural: CrKural; girdi: CrGirdi }>,
  asOf: Date,
): CrDegerlendirmeSonucu[] {
  return degerlendirmeler
    .map(({ kural, girdi }) => crKuraliDegerlendir(kural, girdi, asOf))
    .filter((s) => s.sonuc === "tetiklendi");
}
