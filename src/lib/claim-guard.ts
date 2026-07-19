// Model/Compliance Claim Guard — saf değerlendirme motoru (37 Tez Dikey C,
// docs/adr/PR0-37-tez-dikeyC-claim-guard-2026-07-20.md).
//
// MİMARİ src/lib/legal-basis.ts'ten (M23) BİREBİR ALINDI — ikinci bir motor
// İCAT EDİLMEDİ, aynı desen (sebepler[] kod/seviye/mesaj, asOf parametresi,
// Date.now() yok, deterministik) yeni bir soruya uygulandı: "bu testi
// çalıştırayım mı" yerine "bu iddiayı KESİN diye gösterebilir miyim".
//
// DB GUARD'I ZATEN VERIFIED'e GEÇİŞTE kaynak+kanıt şartını ZORLUYOR
// (assurance_claim_dogrulama_guard, migration 20260720000000) — bu motorun
// işi o kararı TEKRARLAMAK değil, DB'de VERIFIED olsa bile SONRADAN BAYATLAMIŞ
// (süre dolmuş / kaynak SUPERSEDED olmuş) bir iddianın GÖSTERİM durumunu
// doğru yansıtmak (guard geçmişe dönük durumu değiştirmez, yalnız işaretler —
// gösterim katmanı bunu dürüstçe iletir) VE bir iddia VERIFIED'e sunulmadan
// ÖNCE önizleme yapmak (round-trip'i beklemeden "şu an uygun değil çünkü..."
// diyebilmek).

export type DogrulamaDurumu =
  | "DRAFT_RESEARCH"
  | "TODO_DOGRULA"
  | "LEGAL_REVIEW"
  | "VERIFIED"
  | "SUPERSEDED"
  | "REJECTED";

export type GuvenSeviyesi = "DUSUK" | "ORTA" | "YUKSEK";
export type IddiaTuru = "UYUM" | "RISK" | "KONTROL" | "MEVZUAT";
export type IddiaSonucu = "OLUMLU" | "OLUMSUZ" | "KOSULLU";

export type IddiaGosterimDurumu =
  | "VERIFIED"
  | "LEGAL_REVIEW_REQUIRED"
  | "UNVERIFIED"
  | "SURESI_GECMIS_INCELEME_GEREKLI"
  | "REDDEDILDI";

export interface IddiaGosterimSebebi {
  kod:
    | "REDDEDILDI_VEYA_GECERSIZ"
    | "SURESI_GECTI"
    | "YENIDEN_INCELEME_ISARETLI"
    | "TAM_DOGRULANMIS"
    | "INCELEMEDE"
    | "TASLAK";
  seviye: "bilgi" | "uyari" | "blok";
  mesaj: string;
}

export interface IddiaGosterimGirdisi {
  dogrulamaDurumu: DogrulamaDurumu;
  yururlukTarihi: string | null; // ISO tarih (yyyy-mm-dd)
  yenidenIncelemeGerekli: boolean;
  /** Deterministik "bugün" — Date.now() burada YOK (kural 11). */
  asOf: string; // ISO tarih (yyyy-mm-dd)
}

export interface IddiaGosterimSonucu {
  gosterimDurumu: IddiaGosterimDurumu;
  sebepler: IddiaGosterimSebebi[];
  /** true YALNIZ gosterimDurumu === "VERIFIED" olduğunda — UI kısayolu. */
  kesinGosterilebilir: boolean;
}

/**
 * Var olan bir iddia satırının GÖSTERİM durumunu hesaplar. Staleness
 * sinyalleri (süre dolumu / yeniden inceleme işareti) dogrulama_durumu'nun
 * KENDİSİNDEN ÖNCELİKLİDİR — DB guard'ı geçmiş bir VERIFIED kararını
 * geriye dönük DEĞİŞTİRMEZ (yalnız cron işaretler), ama gösterim katmanı
 * bunu "hâlâ kesin" gibi sunmamalı.
 */
export function iddiaGosterimDurumuHesapla(girdi: IddiaGosterimGirdisi): IddiaGosterimSonucu {
  if (girdi.dogrulamaDurumu === "REJECTED" || girdi.dogrulamaDurumu === "SUPERSEDED") {
    return {
      gosterimDurumu: "REDDEDILDI",
      sebepler: [
        {
          kod: "REDDEDILDI_VEYA_GECERSIZ",
          seviye: "blok",
          mesaj: `İddia ${girdi.dogrulamaDurumu} durumunda — kesin ya da koşullu gösterilemez.`,
        },
      ],
      kesinGosterilebilir: false,
    };
  }

  const sebepler: IddiaGosterimSebebi[] = [];
  if (girdi.yururlukTarihi !== null && girdi.yururlukTarihi < girdi.asOf) {
    sebepler.push({
      kod: "SURESI_GECTI",
      seviye: "blok",
      mesaj: `Yürürlük tarihi (${girdi.yururlukTarihi}) ${girdi.asOf} itibarıyla geçmiş.`,
    });
  }
  if (girdi.yenidenIncelemeGerekli) {
    sebepler.push({
      kod: "YENIDEN_INCELEME_ISARETLI",
      seviye: "blok",
      mesaj: "İddia yeniden inceleme kuyruğunda — güncel kaynak durumu henüz doğrulanmadı.",
    });
  }
  if (sebepler.length > 0) {
    return { gosterimDurumu: "SURESI_GECMIS_INCELEME_GEREKLI", sebepler, kesinGosterilebilir: false };
  }

  if (girdi.dogrulamaDurumu === "VERIFIED") {
    return {
      gosterimDurumu: "VERIFIED",
      sebepler: [{ kod: "TAM_DOGRULANMIS", seviye: "bilgi", mesaj: "Kaynak ve kanıt şartları DB guard'ında doğrulandı, süresi geçmemiş." }],
      kesinGosterilebilir: true,
    };
  }
  if (girdi.dogrulamaDurumu === "LEGAL_REVIEW") {
    return {
      gosterimDurumu: "LEGAL_REVIEW_REQUIRED",
      sebepler: [{ kod: "INCELEMEDE", seviye: "uyari", mesaj: "İddia hukuk/uyum incelemesinde — henüz kesin değil." }],
      kesinGosterilebilir: false,
    };
  }
  return {
    gosterimDurumu: "UNVERIFIED",
    sebepler: [{ kod: "TASLAK", seviye: "uyari", mesaj: `İddia ${girdi.dogrulamaDurumu} durumunda — kesin gösterilemez.` }],
    kesinGosterilebilir: false,
  };
}

export interface VerifiedOnKosulGirdisi {
  kaynakVarMi: boolean;
  kaynakDurumu: DogrulamaDurumu | null;
  kanitSayisi: number;
}

export interface VerifiedOnKosulSonucu {
  uygun: boolean;
  eksikSebepler: IddiaGosterimSebebi[];
}

/**
 * ÖNİZLEME: DB guard'ı VERIFIED geçişini bu iki şart sağlanmadan reddeder
 * (kural 3/4/6). UI, kullanıcı "Doğrula" butonuna basmadan ÖNCE aynı kararı
 * TS'te tekrar hesaplayıp gösterebilsin diye buradaki mantık guard'ın
 * kendisiyle BİREBİR (aynı iki şart, ikisi de kaynak yükümlülüğün VERIFIED
 * olmasını ve en az bir kanıt referansı olmasını ister).
 */
export function verifiedOnKosulDegerlendir(girdi: VerifiedOnKosulGirdisi): VerifiedOnKosulSonucu {
  const eksikSebepler: IddiaGosterimSebebi[] = [];
  if (!girdi.kaynakVarMi) {
    eksikSebepler.push({
      kod: "REDDEDILDI_VEYA_GECERSIZ",
      seviye: "blok",
      mesaj: "İddianın resmi/hukuki kaynağı yok — kaynaksız iddia VERIFIED olamaz.",
    });
  } else if (girdi.kaynakDurumu !== "VERIFIED") {
    eksikSebepler.push({
      kod: "REDDEDILDI_VEYA_GECERSIZ",
      seviye: "blok",
      mesaj: `Kaynak yükümlülük ${girdi.kaynakDurumu} durumunda — hukuk doğrulaması yok.`,
    });
  }
  if (girdi.kanitSayisi === 0) {
    eksikSebepler.push({
      kod: "REDDEDILDI_VEYA_GECERSIZ",
      seviye: "blok",
      mesaj: "Kanıt referansı yok — kanıtsız iddia VERIFIED olamaz.",
    });
  }
  return { uygun: eksikSebepler.length === 0, eksikSebepler };
}

export interface IddiaOzet {
  id: string;
  hedefTablo: string | null;
  hedefId: string | null;
  iddiaTuru: IddiaTuru;
  sonuc: IddiaSonucu;
  dogrulamaDurumu: DogrulamaDurumu;
}

export interface CatismaGrubu {
  hedefTablo: string;
  hedefId: string;
  iddiaTuru: IddiaTuru;
  farkliSonuclar: IddiaSonucu[];
  iddiaIdleri: string[];
}

/**
 * ÇATIŞMA TESPİTİ (kural 8): aynı (hedef, iddia türü) için birbiriyle
 * ÇELİŞEN (farklı `sonuc`) birden fazla, REJECTED/SUPERSEDED OLMAYAN iddia
 * varsa görünür bir çatışma grubu döner. Otomatik uzlaştırma YAPILMAZ —
 * yalnız TESPİT. `sonuc` alanı iddiayı yazanın AÇIK beyanıdır (kural 11:
 * iddia_metni'nin anlamı NLP/AI ile YORUMLANMAZ — sahte kesinlik olurdu).
 * Hedefsiz (hedefTablo/hedefId null) iddialar karşılaştırma dışıdır.
 */
export function catismaTespitEt(iddialar: IddiaOzet[]): CatismaGrubu[] {
  const aktifler = iddialar.filter(
    (i) => i.hedefTablo !== null && i.hedefId !== null && i.dogrulamaDurumu !== "REJECTED" && i.dogrulamaDurumu !== "SUPERSEDED",
  );

  const gruplar = new Map<string, IddiaOzet[]>();
  for (const iddia of aktifler) {
    const anahtar = `${iddia.hedefTablo}::${iddia.hedefId}::${iddia.iddiaTuru}`;
    gruplar.set(anahtar, [...(gruplar.get(anahtar) ?? []), iddia]);
  }

  const sonuc: CatismaGrubu[] = [];
  // Kural 11: girdi sırasından bağımsızlık — anahtara göre deterministik sırala.
  for (const anahtar of [...gruplar.keys()].sort()) {
    const grup = gruplar.get(anahtar)!;
    const farkliSonuclar = [...new Set(grup.map((i) => i.sonuc))].sort();
    if (farkliSonuclar.length > 1) {
      sonuc.push({
        hedefTablo: grup[0].hedefTablo!,
        hedefId: grup[0].hedefId!,
        iddiaTuru: grup[0].iddiaTuru,
        farkliSonuclar,
        iddiaIdleri: grup.map((i) => i.id).sort(),
      });
    }
  }
  return sonuc;
}
