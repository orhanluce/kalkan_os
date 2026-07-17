// Kontrol test motoru (docs/ROADMAP.md M12, belge M02).
//
// NE İŞE YARAR: bir kontrolün TASARLANDIĞINI değil, GERÇEKTEN ÇALIŞTIĞINI
// deterministik bir testle söyler. Testin çıktısı beş AYRI durumdan biridir ve
// bunlar BİRLEŞTİRİLEMEZ (CLAUDE.md kural 13):
//
//   PASSED     Kontrol iddiası fiilen değerlendirildi ve karşılandı.
//   FAILED     Kontrol iddiası fiilen değerlendirildi ve KARŞILANMADI.
//   UNKNOWN    Ölçüm YAPILAMADI (connector/toplama arızası, sinyal yok).
//   STALE      Ölçüm var ama BAYAT: tazelik penceresi geçmiş.
//   EXCEPTION  Boşluk yönetimce KABUL edilmiş (istisna).
//
// KURAL 13'ÜN KALBİ — burası ürünün en pahalı yanlışını önler:
// TOPLAMA/CONNECTOR ARIZASI ASLA `FAILED` ÜRETMEZ, `UNKNOWN` ÜRETİR.
// Bir güvenlik aracının API'si düştüğünde kontrolü "başarısız" saymak, olmayan
// bir ihlali rapor etmektir — yatırımcıya/denetçiye "kontrol çalışmıyor" der
// oysa yalnızca ÖLÇEMEDİK. "false failure < %2" KPI'ı tam olarak bu ayrımdır.
// `FAILED` demek için iddianın GERÇEKTEN değerlendirilip karşılanmadığını
// görmek gerekir; göremediğimiz her durum `UNKNOWN`'dır.
//
// DETERMİNİSTİK (kural 11): Date.now, rastgelelik, dış çağrı YOK. `asOf`
// parametreyle gelir. Aynı (tanım, gözlem, asOf) her zaman aynı sonucu ve aynı
// gerekçeyi verir — denetçi yeniden koşturup karşılaştırabilsin diye.

import { canonicalJson, type CanonicalDeger } from "./canonical";

export type TestTuru =
  | "MANUAL_PROCEDURE"
  | "CONFIG_ASSERTION"
  | "SAMPLE_REVIEW"
  | "ATTACK_SIMULATION"
  | "RESTORE_TEST";

export type TestSonuc = "PASSED" | "FAILED" | "UNKNOWN" | "STALE" | "EXCEPTION";

export interface TestTanimi {
  tur: TestTuru;
  /**
   * Tazelik penceresi (gün). Ölçüm bundan eskiyse sonuç STALE.
   * null = tazelik şartı yok (ör. bir kerelik konfigürasyon iddiası).
   */
  tazelikGun: number | null;
  /**
   * CONFIG_ASSERTION için beklenen değer. Gözlenen değer buna KANONİK olarak
   * eşitse iddia karşılanmıştır. Diğer türlerde kullanılmaz (iddia sonucu
   * gözlemde `iddiaKarsilandi` olarak gelir).
   */
  beklenen?: CanonicalDeger;
}

/** Testin fiilen koşturulduğunda gözlenen şey. */
export interface Gozlem {
  /**
   * Toplama/connector arızası. TRUE ise sonuç UNKNOWN olur — iddia hiç
   * değerlendirilmez. Bu, kural 13'ün en kritik kapısıdır.
   */
  toplamaBasarisiz: boolean;
  toplamaHatasi: string | null;
  /** Ölçümün yakalandığı an (ISO). Tazelik bununla hesaplanır. Yoksa null. */
  gozlemZamani: string | null;
  /** Bu kontrolü kapsayan, yönetimce KABUL edilmiş bir istisna var mı. */
  istisnaKabul: boolean;
  /** CONFIG_ASSERTION: gözlenen değer (beklenenle karşılaştırılır). */
  gozlenenDeger?: CanonicalDeger;
  /**
   * Diğer türler için önceden sinyale indirgenmiş iddia sonucu:
   *   true  = iddia karşılandı
   *   false = iddia karşılanmadı
   *   null  = değerlendirilemedi (sinyal yok) -> UNKNOWN, ASLA FAILED değil
   */
  iddiaKarsilandi?: boolean | null;
}

export interface TestSonucu {
  sonuc: TestSonuc;
  /** NEDEN bu sonuç — kural 11. Gerekçesiz sonuç "sistem böyle dedi"dir. */
  gerekce: string;
}

function s(sonuc: TestSonuc, gerekce: string): TestSonucu {
  return { sonuc, gerekce };
}

/** Gözlem, tazelik penceresinden eski mi? */
function bayatMi(gozlemZamani: string, tazelikGun: number, asOf: Date): boolean {
  const yas = asOf.getTime() - new Date(gozlemZamani).getTime();
  return yas > tazelikGun * 24 * 60 * 60 * 1000;
}

/**
 * Testi değerlendirir. Karar ağacının SIRASI anlamlıdır ve bilinçlidir:
 *
 *   1. Toplama başarısız  -> UNKNOWN  (ölçemediğimiz şeyi yorumlayamayız)
 *   2. İstisna kabul       -> EXCEPTION (boşluk resmen kabul; Failed/Passed değil)
 *   3. Bayat ölçüm         -> STALE    (eski kanıtla PASSED de FAILED de denemez)
 *   4. İddia değerlendir    -> PASSED / FAILED
 *
 * NEDEN UNKNOWN EN ÖNDE: bir boşluğu "kabul" etmek (istisna) ancak o boşluğu
 * GÖRDÜYSEK anlamlıdır. Ölçemediysek istisna da bir şeyi kapatmaz — durum
 * UNKNOWN'dır. Ölçemediğimiz bir şeyi "kabul edilmiş" saymak, bilmediğimiz bir
 * riski kapatılmış gibi göstermek olurdu.
 */
export function testDegerlendir(tanim: TestTanimi, gozlem: Gozlem, asOf: Date): TestSonucu {
  // 1. TOPLAMA ARIZASI -> UNKNOWN (kural 13'ün kalbi).
  if (gozlem.toplamaBasarisiz) {
    return s(
      "UNKNOWN",
      `Ölçüm yapılamadı (toplama/connector arızası)${
        gozlem.toplamaHatasi ? `: ${gozlem.toplamaHatasi}` : ""
      }. Bu bir kontrol başarısızlığı DEĞİL, ölçüm eksikliğidir.`,
    );
  }

  // 2. İSTİSNA -> EXCEPTION.
  if (gozlem.istisnaKabul) {
    return s("EXCEPTION", "Kontrol boşluğu yönetimce kabul edilmiş bir istisnayla karşılanıyor.");
  }

  // 3. BAYAT ÖLÇÜM -> STALE.
  if (tanim.tazelikGun !== null && gozlem.gozlemZamani !== null) {
    if (bayatMi(gozlem.gozlemZamani, tanim.tazelikGun, asOf)) {
      return s(
        "STALE",
        `Ölçüm ${tanim.tazelikGun} günlük tazelik penceresinden eski; güvence bayatladı. Yeniden test gerekiyor.`,
      );
    }
  }

  // 4. İDDİAYI DEĞERLENDİR.
  let karsilandi: boolean | null;
  if (tanim.tur === "CONFIG_ASSERTION") {
    // Sinyal yerine değer karşılaştırması — kanonik eşitlik.
    if (gozlem.gozlenenDeger === undefined || tanim.beklenen === undefined) {
      karsilandi = null;
    } else {
      karsilandi = canonicalJson(gozlem.gozlenenDeger) === canonicalJson(tanim.beklenen);
    }
  } else {
    karsilandi = gozlem.iddiaKarsilandi ?? null;
  }

  // Sinyal yoksa UNKNOWN — ASLA FAILED. Değerlendirilememiş bir iddiayı
  // "başarısız" saymak, kural 13'ün önlediği tam o yanlıştır.
  if (karsilandi === null) {
    return s("UNKNOWN", "İddia değerlendirilemedi (sinyal yok). Ölçüm eksikliği, başarısızlık değil.");
  }

  return karsilandi
    ? s("PASSED", "Kontrol iddiası değerlendirildi ve karşılandı.")
    : s("FAILED", "Kontrol iddiası değerlendirildi ve KARŞILANMADI.");
}

/**
 * Bir kontrolün güvence durumunu, en son test koşularından türetir.
 *
 * BİRLEŞTİRMEZ (kural 13): birden çok testi olan bir kontrolde en KÖTÜ ölçülen
 * durum kazanır ama durumlar ezilmez. Öncelik: FAILED > STALE > UNKNOWN >
 * EXCEPTION > PASSED. Hiç test yoksa NOT_TESTED.
 *
 * NEDEN BU SIRA: FAILED ölçülmüş bir eksiktir, en yüksek dikkat. STALE ve
 * UNKNOWN "güvence yok" halleridir ama STALE bir zamanlar ölçülmüştü, UNKNOWN
 * hiç değil — ikisi ayrı raporlanır. EXCEPTION bilinçli bir kabuldür, en
 * altta ama PASSED'in üstünde çünkü kabul edilmiş bir boşluk yine de boşluktur.
 */
export type KontrolGuvenceDurumu = TestSonuc | "NOT_TESTED";

const ONCELIK: Record<TestSonuc, number> = {
  FAILED: 5,
  STALE: 4,
  UNKNOWN: 3,
  EXCEPTION: 2,
  PASSED: 1,
};

export function kontrolGuvenceDurumu(sonuclar: TestSonuc[]): KontrolGuvenceDurumu {
  if (sonuclar.length === 0) return "NOT_TESTED";
  return sonuclar.reduce((enKotu, s) => (ONCELIK[s] > ONCELIK[enKotu] ? s : enKotu));
}

export interface BulguOnerisi {
  baslik: string;
  gerekce: string;
  onem: "acil" | "kritik" | "yuksek" | "orta" | "dusuk";
}

/**
 * Başarısız testten bulgu ÖNERİSİ üretir (kural 11).
 *
 * YALNIZCA FAILED için ve yalnızca `otomatik_bulgu` açıksa. UNKNOWN/STALE
 * bulgu ÜRETMEZ — kritik ayrım: UNKNOWN "ölçemedik"tir, bir bulgu (ölçülmüş
 * eksik) değildir; ona bulgu açmak, olmayan bir ihlali iş listesine sokardı.
 * STALE de bir başarısızlık değil, tazeleme ihtiyacıdır. Bunlar panoda
 * görünür ama otomatik bulgu doğurmaz.
 *
 * Öneri; insan kabul etmeden gerçek bulgu OLMAZ (bu yalnız öneri üretir).
 */
export function bulguOnerisiUret(
  tanim: { ad: string; otomatikBulgu: boolean; basarisizlikOnem: BulguOnerisi["onem"] },
  sonuc: TestSonucu,
): BulguOnerisi | null {
  if (sonuc.sonuc !== "FAILED" || !tanim.otomatikBulgu) return null;
  return {
    baslik: `Kontrol testi başarısız: ${tanim.ad}`,
    // Gerekçe motorun kararından gelir — "sistem böyle dedi" değil, ölçülen olgu.
    gerekce: sonuc.gerekce,
    onem: tanim.basarisizlikOnem,
  };
}
