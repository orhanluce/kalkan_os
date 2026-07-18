// Görevler Ayrılığı (SoD) değerlendirme motoru (docs/ROADMAP.md M16, SPK
// notları §5).
//
// NE İŞE YARAR: aynı kişinin (veya harici kimliğin) bir kuralın A ve B
// taraflarına eşleşen iki atamaya birden sahip olup olmadığını tespit eder.
// SoD motoru bir IAM/PAM sistemi DEĞİLDİR — kullanıcı yetkilerini yönetmez,
// KALKAN_OS'un kendi atama verisi üzerinde güvence/çatışma DEĞERLENDİRMESİ
// yapar.
//
// DETERMİNİSTİK (kural 11): Date.now, rastgelelik, dış çağrı YOK. Aynı kural
// seti + aynı atama kümesi her zaman aynı çatışma kümesini ve aynı
// fingerprint'leri üretir — bu iddia "güvenin" değil, canonicalHash ile
// yeniden hesaplanabilir bir kanıta dayanır.
//
// İLK SÜRÜM SERBEST KOD ÇALIŞTIRMAZ (kurucu talimatı): eşleşme yalnızca alan
// eşitliğiyle kurulur (aktivite kodu + opsiyonel rol kodu + sistem kapsamı).
// `matchExpression` gibi bir ifade motoru YOK — güvenli ve doğrulanabilir
// kalması için bilinçli bir sınır.

import { canonicalHash, type CanonicalDeger } from "./canonical";

/** Kuralın bir tarafı (A veya B). */
export interface SodTaraf {
  aktivite_kodu: string;
  rol_kodu: string | null;
  /**
   * null = kural bu tarafta sistem kapsamı belirtmiyor ("hangi sistemde
   * olursa olsun geçerli") — çoğu SPK-tarzı kural böyledir (ör. "kanıt
   * yükleyen kendi kontrolünü onaylayamaz" hangi sistemde olursa olsun
   * geçerli). Dolu ise yalnız o kapsamdaki atamalar bu tarafa aday olur
   * (ör. "yalnız üretim ortamında" gibi dar bir kural).
   *
   * ASIL ÇATIŞMA KARARI HER ZAMAN atamaların GERÇEK ORTAK kapsamına göre
   * verilir (bkz. kisiIcinCatismalar) — bu alan yalnızca kuralın hangi
   * atamalara aday olacağını daraltan bir FİLTREDİR, çatışmanın kapsamını
   * SABİTLEMEZ.
   */
  sistem_kapsami: string | null;
}

export interface SodKural {
  id: string;
  kod: string;
  durum: "aktif" | "pasif";
  onem: "acil" | "kritik" | "yuksek" | "orta" | "dusuk";
  tarafA: SodTaraf;
  tarafB: SodTaraf;
}

/** Bir kişinin (veya harici kimliğin) tek bir ataması. */
export interface SodAtama {
  /** İç kullanıcıysa kullanici_id, değilse harici_kullanici_id — ikisinden biri dolu. */
  kisiKimligi: string;
  aktivite_kodu: string;
  rol_kodu: string | null;
  sistem_kapsami: string;
}

export interface SodCatismaSonucu {
  ruleId: string;
  kisiKimligi: string;
  sistem_kapsami: string;
  onem: SodKural["onem"];
  /** Dedup anahtarı — aynı (kural, kişi, kapsam) ikinci kez açık kayıt olarak görünmez. */
  fingerprint: string;
}

/** Bir tarafın bir atamaya eşleşip eşleşmediği. Serbest kod yok, yalnız alan eşitliği. */
function tarafEslesirMi(taraf: SodTaraf, atama: SodAtama): boolean {
  if (taraf.aktivite_kodu !== atama.aktivite_kodu) return false;
  // rol_kodu ve sistem_kapsami belirtilmemişse (null) o alanda filtre
  // uygulanmaz — kuralın o tarafı o ayrımı yapmıyor demektir.
  if (taraf.rol_kodu !== null && taraf.rol_kodu !== atama.rol_kodu) return false;
  if (taraf.sistem_kapsami !== null && taraf.sistem_kapsami !== atama.sistem_kapsami) return false;
  return true;
}

/**
 * Çatışma dedup fingerprint'i: (tenant, kural, kişi, kapsam) kombinasyonunun
 * kanonik hash'i. Aynı kombinasyon her zaman AYNI fingerprint'i üretir —
 * route bunu `unique(tenant_id, fingerprint)` ile upsert için kullanır,
 * motorun kendisi DB'ye dokunmaz.
 */
export function sodFingerprint(
  tenantId: string,
  ruleId: string,
  kisiKimligi: string,
  sistemKapsami: string,
): Promise<string> {
  const deger: CanonicalDeger = {
    tenantId,
    ruleId,
    kisiKimligi,
    sistemKapsami,
  };
  return canonicalHash(deger);
}

/**
 * Bir kişinin atamaları arasında, verilen kural setine göre çatışma arar.
 *
 * NEDEN KİŞİ BAZINDA GRUPLANMIŞ GİRDİ: aynı kişinin İKİ farklı atamasının
 * (biri tarafA'ya, biri tarafB'ye eşleşen) BİR ARADA bulunması çatışmadır.
 * Farklı kişilerin atamaları asla çatışma üretmez — bu fonksiyonun ismiyle
 * de garanti edilir: girdi zaten TEK kişinin atama listesidir.
 */
async function kisiIcinCatismalar(
  tenantId: string,
  kisiKimligi: string,
  atamalar: SodAtama[],
  kurallar: SodKural[],
): Promise<SodCatismaSonucu[]> {
  const sonuclar: SodCatismaSonucu[] = [];

  for (const kural of kurallar) {
    if (kural.durum !== "aktif") continue;

    const aEslesenler = atamalar.filter((a) => tarafEslesirMi(kural.tarafA, a));
    const bEslesenler = atamalar.filter((a) => tarafEslesirMi(kural.tarafB, a));
    if (aEslesenler.length === 0 || bEslesenler.length === 0) continue;

    // Kapsam bazında eşleştir: A ve B aynı sistem_kapsami'nda bulunmalı —
    // "geliştirici sistem X'te üretime çıktı" ile "sistem Y'de erişim
    // onayladı" bir çatışma DEĞİLDİR, farklı kapsamlardır.
    const kapsamlar = new Set([
      ...aEslesenler.map((a) => a.sistem_kapsami),
      ...bEslesenler.map((a) => a.sistem_kapsami),
    ]);

    for (const kapsam of kapsamlar) {
      const aVar = aEslesenler.some((a) => a.sistem_kapsami === kapsam);
      const bVar = bEslesenler.some((a) => a.sistem_kapsami === kapsam);
      if (!aVar || !bVar) continue;

      sonuclar.push({
        ruleId: kural.id,
        kisiKimligi,
        sistem_kapsami: kapsam,
        onem: kural.onem,
        fingerprint: await sodFingerprint(tenantId, kural.id, kisiKimligi, kapsam),
      });
    }
  }

  return sonuclar;
}

/**
 * Tüm atamalar + kural seti üzerinde SoD değerlendirmesi çalıştırır.
 *
 * TENANT SINIRI: bu fonksiyon tek bir tenant'ın verisiyle çağrılır — RLS
 * zaten route seviyesinde bunu garanti eder; motor kendisi tenant filtresi
 * uygulamaz (girdi zaten filtrelenmiş gelir).
 *
 * ARTIK MEVCUT OLMAYAN ÇATIŞMALARI SİLMEZ: bu fonksiyon yalnızca BULUNAN
 * çatışmaların listesini döndürür. Route, dönen fingerprint kümesinde
 * OLMAYAN ama DB'de hâlâ OPEN duran bir çatışmayı SESSİZCE SİLMEZ — kanıtsız
 * silme append-only'nin ruhuna aykırıdır (kural 2). Böyle bir kayıt route
 * tarafından olduğu gibi bırakılır; kapanışı yalnız insan/guard kararı yapar.
 */
export async function sodDegerlendir(
  tenantId: string,
  atamalar: SodAtama[],
  kurallar: SodKural[],
): Promise<SodCatismaSonucu[]> {
  const kisiGruplari = new Map<string, SodAtama[]>();
  for (const atama of atamalar) {
    const liste = kisiGruplari.get(atama.kisiKimligi) ?? [];
    liste.push(atama);
    kisiGruplari.set(atama.kisiKimligi, liste);
  }

  const tumSonuclar: SodCatismaSonucu[] = [];
  for (const [kisiKimligi, kisiAtamalari] of kisiGruplari) {
    const sonuclar = await kisiIcinCatismalar(tenantId, kisiKimligi, kisiAtamalari, kurallar);
    tumSonuclar.push(...sonuclar);
  }
  return tumSonuclar;
}

/**
 * Kural setinin kanonik hash'i — bir değerlendirme koşusunun HANGİ kural
 * sürümüyle çalıştığının kanıtı (kurucu talimatı 2.4). Kural sırası hash'i
 * etkilememeli: DB'den geliş sırası kuralların kimliği değil.
 */
export function kuralSetiHash(kurallar: SodKural[]): Promise<string> {
  const sirali = [...kurallar]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((k) => ({
      id: k.id,
      durum: k.durum,
      onem: k.onem,
      tarafA: k.tarafA as unknown as CanonicalDeger,
      tarafB: k.tarafB as unknown as CanonicalDeger,
    }));
  return canonicalHash(sirali as unknown as CanonicalDeger);
}

/**
 * Atama snapshot'ının kanonik hash'i — "bu koşu ANINDA atamalar neydi"
 * sorusunun kanıtı. Sıra mühre girmemeli.
 */
export function atamaSnapshotHash(atamalar: SodAtama[]): Promise<string> {
  const sirali = [...atamalar].sort((a, b) => {
    const ka = `${a.kisiKimligi}|${a.aktivite_kodu}|${a.sistem_kapsami}`;
    const kb = `${b.kisiKimligi}|${b.aktivite_kodu}|${b.sistem_kapsami}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return canonicalHash(sirali as unknown as CanonicalDeger);
}
