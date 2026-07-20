// Dikey E, E1 — Bulut/kritik tedarikçi güvence profili motoru
// (docs/adr/PR0-dikeyE1-cloud-tedarikci-guvence-2026-07-20.md §6).
//
// SAF/DETERMİNİSTİK (kural 11): DB/ağ çağrısı yok, Date.now()/rastgelelik/AI
// çağrısı yok, global tenant/kullanıcı bağlamı okunmaz. `asOf` HER ZAMAN
// girdiden gelir. Çağıran (API rotası) veriyi toplar, bu motor yalnız
// hesaplar.
//
// "ZORUNLU KATEGORİ" LİSTESİ UYDURULMADI (ADR §6): Cloud Pack şemasında
// hiçbir kategori zorunlu olarak işaretli değil. Genel durum yalnız MEVCUT
// sorulara göre worst-of hesaplanır; hiç sorusu olmayan bir kategori
// CEVAPSIZ görünür (sessizce atlanmaz), asla sahte DOGRULANMIS_PROFIL
// üretilmez. Tek MUTLAK blok açık KRİTİK bulgudur (M35'in mevcut
// assessment_tamamla_guard ilkesinin AYNI yansıması, YENİDEN İCAT edilmedi).
//
// KAYNAK_TURU ↔ DOGRULAMA_DURUMU AYRIMI (ADR §5): iki BAĞIMSIZ boyut.
// kaynak_turu = iddianın DAYANDIĞI kaynak TÜRÜ (PROVIDER_ATTESTATION dahil).
// sablonDogrulamaDurumu = sorunun/künyenin KENDİSİNİN insan tarafından
// doğrulanıp doğrulanmadığı (cloud_pack_dogrulama_guard). Bu motor ikisini
// BİRLEŞTİRMEZ, ayrı ayrı taşır ve ayrı engel kodları üretir.
//
// ŞEMA V2 (Dikey E2, Kapı 2, docs/adr/PR0-dikeyE2-telafi-edici-kontrol-
// proof-room-2026-07-20.md §5): telafi edici kontrol kapsamı eklendi.
// `cloud_assurance_profile_snapshots.profil`de DB CHECK kısıtı YOK (serbest
// jsonb) — V1 payload'ları DEĞİŞTİRİLMEDİ, yeniden hash'lenmedi, geriye
// dönük okunabilir kalıyor. Eski (`@1`) bir snapshot'ta `telafiKapsananBulguIdleri`
// hiç YOKTUR — bu "telafi uygulanmadı" anlamına gelir, "kontrol edilmedi"
// DEĞİL; UI/Proof Room alanı `[]`/undefined olarak savunmacı okur.

export const CLOUD_ASSURANCE_SEMA_SURUMU = "cloud-assurance-profili@2";

export const CLOUD_PACK_KATEGORILERI = [
  "BULUT_ENVANTERI",
  "SHARED_RESPONSIBILITY",
  "SLA_GUVENLIK",
  "DORDUNCU_TARAF",
  "VERI_LOKASYON",
  "IAM_LOG",
  "OLAY_BILDIRIM",
  "YEDEKLEME_KURTARMA",
  "VERI_IMHA",
  "CIKIS_PLANI",
  "DDOS_KAPASITE",
] as const;
export type KategoriKodu = (typeof CLOUD_PACK_KATEGORILERI)[number];

export const KAYNAK_TURLERI = [
  "LEGAL_REQUIREMENT",
  "REGULATORY_GUIDANCE",
  "CONTRACTUAL_REQUIREMENT",
  "INTERNAL_POLICY",
  "PROVIDER_ATTESTATION",
  "TECHNICAL_OBSERVATION",
  "BEST_PRACTICE",
  "UNKNOWN",
] as const;
export type KaynakTuru = (typeof KAYNAK_TURLERI)[number];

/** Kurucu onaylı Türkçe UI etiketleri (§ kurucu kararı #3) — API/DB kanonik İngilizce sabitleri değişmez. */
export const KAYNAK_TURU_TR_ETIKET: Record<KaynakTuru, string> = {
  LEGAL_REQUIREMENT: "Hukuki zorunluluk",
  REGULATORY_GUIDANCE: "Düzenleyici rehberlik",
  CONTRACTUAL_REQUIREMENT: "Sözleşmesel yükümlülük",
  INTERNAL_POLICY: "İç politika",
  PROVIDER_ATTESTATION: "Sağlayıcı beyanı (bağımsız doğrulama değil)",
  TECHNICAL_OBSERVATION: "Teknik gözlem",
  BEST_PRACTICE: "İyi uygulama",
  UNKNOWN: "Bilinmiyor",
};

/** Deterministik engel kodları — UI serbest metne değil bu kodlara bağlanır (kırılgan metin testi yok). */
export type GuvenceEngelKodu =
  | "ACIK_KRITIK_BULGU"
  | "CEVAPSIZ_SORU"
  | "KAYNAK_TURU_BILINMIYOR"
  | "YALNIZ_SAGLAYICI_BEYANI"
  | "DOGRULANMAMIS_SORU"
  | "SOZLESME_EKSIK"
  // Dikey E2, Kapı 2: telafi edici kontrol bilgi/engel kodları. NOT: bunlar
  // ASLA bulguyu kapatmaz — yalnız açık bulgunun yönetim durumunu bildirir.
  | "AKTIF_TELAFI_EDICI_KONTROL"
  | "TELAFI_KONTROLU_SURESI_DOLMUS"
  | "TELAFI_KONTROLU_DOGRULANMAMIS"
  | "TELAFI_TESTI_BASARISIZ"
  | "TELAFI_KANITI_GUNCEL_DEGIL";

export const GUVENCE_ENGEL_ACIKLAMALARI: Record<GuvenceEngelKodu, string> = {
  ACIK_KRITIK_BULGU: "Açık (kapanmamış) KRİTİK bulgu var — kritik risk kapanmadan güvence verilemez.",
  CEVAPSIZ_SORU: "Bu kategoride yanıtlanmamış veya uygulanabilirliği belirsiz (UNKNOWN) soru var.",
  KAYNAK_TURU_BILINMIYOR: "Bu kategorideki en az bir yanıtın kaynak türü bilinmiyor (UNKNOWN).",
  YALNIZ_SAGLAYICI_BEYANI: "Bu kategorideki tüm yanıtlar yalnızca sağlayıcı beyanına dayanıyor — bağımsız doğrulama yok.",
  DOGRULANMAMIS_SORU: "Bu kategorideki en az bir sorunun kaynak künyesi henüz insan tarafından doğrulanmadı.",
  SOZLESME_EKSIK: "Bu tedarikçi için bağlı bir sözleşme kaydı yok.",
  AKTIF_TELAFI_EDICI_KONTROL:
    "Bulgu açık kalmaktadır; doğrulanmış telafi edici kontrol nedeniyle belirli süreyle yönetilmektedir. Bu, bulgunun kapandığı veya kök nedenin ortadan kalktığı anlamına gelmez.",
  TELAFI_KONTROLU_SURESI_DOLMUS: "Bu bulguya bağlı telafi edici kontrolün geçerlilik süresi doldu — bulgu yeniden ENGELLENDI durumunda.",
  TELAFI_KONTROLU_DOGRULANMAMIS: "Bu bulguya bağlı telafi edici kontrol henüz bağımsız incelemeden geçmedi (TASLAK/İNCELEMEDE).",
  TELAFI_TESTI_BASARISIZ: "Bu bulguya bağlı telafi edici kontrolün dayandığı test koşusu PASSED değil.",
  TELAFI_KANITI_GUNCEL_DEGIL: "Bu bulguya bağlı telafi edici kontrolün dayandığı kanıtın süresi geçmiş.",
};

export type SablonDogrulamaDurumu = "TODO_DOGRULA" | "VERIFIED" | "YURURLUKTEN_KALKTI";

export interface GuvenceSorusuGirdisi {
  id: string;
  /** assessment_questions.template_id üzerinden CANLI okunur; null = şablon bağlantısı yok (uydurulmaz, ayrı sayılır). */
  kategori: KategoriKodu | null;
  cevap: string | null;
  uygulanabilirlik: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
  kaynakTuru: KaynakTuru;
  /** null = template_id yok (kategoriyle aynı sebep). */
  sablonDogrulamaDurumu: SablonDogrulamaDurumu | null;
}

export interface AcikKritikBulgu {
  id: string;
  baslik: string;
}

/** Dikey E2, Kapı 2 (ADR §4). YENİ test altyapısı yok — control_id/test_run_id M12'nin gerçek koşusuna işaret eder. */
export type TelafiEdiciKontrolDurumu = "TASLAK" | "INCELEMEDE" | "AKTIF" | "REDDEDILDI" | "SURESI_DOLDU" | "IPTAL_EDILDI";

export interface TelafiEdiciKontrolOzeti {
  id: string;
  assessmentFindingId: string;
  durum: TelafiEdiciKontrolDurumu;
  /** M12 kural 13 — beş ayrı durum, motor DB'nin `durum='AKTIF'` etiketine kör güvenmez, bunu da kontrol eder. */
  testSonucu: "PASSED" | "FAILED" | "UNKNOWN" | "STALE" | "EXCEPTION";
  /** Bağlı test koşusunun kanıtı (varsa) `asOf` itibarıyla güncel mi — çağıran hesaplar (evidences.gecerlilik_bitis >= asOf). */
  kanitGuncel: boolean;
  validFrom: string;
  validUntil: string;
  /** Yalnız GÖRÜNTÜLEME için (Proof Room "kontrol/test referans özeti") — hesaplamada kullanılmaz. */
  controlMaddeRef: string | null;
}

export interface GuvenceProfiliGirdisi {
  asOf: string;
  thirdPartyId: string;
  contractId: string | null;
  sorular: GuvenceSorusuGirdisi[];
  acikKritikBulgular: AcikKritikBulgu[];
  /** Opsiyonel — atlanırsa (undefined) TÜM mevcut sonuçlar birebir aynı kalır (geriye dönük uyumluluk). */
  telafiEdiciKontroller?: TelafiEdiciKontrolOzeti[];
}

export type KategoriDurumu = "CEVAPSIZ" | "UYGULANMAZ" | "INCELEME_GEREKLI" | "DOGRULANMIS";

export interface KategoriSonucu {
  kategori: KategoriKodu;
  soruSayisi: number;
  uygulanamazSayisi: number;
  cevapsizSayisi: number;
  kaynakTuruDagilimi: Partial<Record<KaynakTuru, number>>;
  durum: KategoriDurumu;
  engelGerekceleri: GuvenceEngelKodu[];
}

export type GenelGuvenceDurumu = "ENGELLENDI" | "EKSIK" | "INCELEME_GEREKLI" | "DOGRULANMIS_PROFIL" | "KRITIK_BULGU_TELAFI_ALTINDA";

export interface CloudAssuranceHesaplamaYontemi {
  sema: string;
  asOf: string;
  worstOfKurali: string;
  acikBulguKurali: string;
  kaynakTuruYaklasimi: string;
  bagimsizDogrulamaYaklasimi: string;
}

export interface GuvenceEngelGerekcesi {
  kod: GuvenceEngelKodu;
  kategori: KategoriKodu | null;
  aciklama: string;
}

export interface GuvenceProfiliSonucu {
  semaSurumu: string;
  asOf: string;
  thirdPartyId: string;
  contractId: string | null;
  genelDurum: GenelGuvenceDurumu;
  kategoriler: KategoriSonucu[];
  /** template_id/kategori olmayan sorular — kaybolmadan raporlanır (uydurulmuş kategoriye atanmaz). */
  kategorisizSoruSayisi: number;
  kaynakTuruDagilimi: Partial<Record<KaynakTuru, number>>;
  acikKritikBulgular: AcikKritikBulgu[];
  /** Açık KRİTİK bulgulardan GEÇERLİ+AKTİF telafi edici kontrolle kapsananların id'leri (sıralı). Bulgu KAPANMAZ — yalnız yönetim durumu. */
  telafiKapsananBulguIdleri: string[];
  /**
   * Proof Room'un "kontrol/test referans özeti + geçerlilik bitiş tarihi"
   * asgari gösterimi için (ADR §8) — yalnız KAPSANAN bulgular için, yalnız
   * GÖRÜNTÜLEME amaçlı minimize alanlar (ham test çıktısı/serbest metin/PII
   * YOK). "Bağımsız incelemeden geçti" burada AYRI bir alan TAŞIMAZ — AKTIF
   * durumuna ulaşmış her kayıt YAPISAL OLARAK bağımsız incelenmiştir (DB
   * guard: reviewed_by != submitted_by, kural: kanıtlanmış olgu, tekrar
   * taşınmaz).
   */
  telafiOzetleri: { bulguId: string; controlMaddeRef: string | null; validUntil: string }[];
  engelGerekceleri: GuvenceEngelGerekcesi[];
  hesaplamaYontemi: CloudAssuranceHesaplamaYontemi;
}

function dagilimEkle(dagilim: Partial<Record<KaynakTuru, number>>, tur: KaynakTuru) {
  dagilim[tur] = (dagilim[tur] ?? 0) + 1;
}

function kategoriDurumuHesapla(kategori: KategoriKodu, sorular: GuvenceSorusuGirdisi[]): KategoriSonucu {
  const kaynakTuruDagilimi: Partial<Record<KaynakTuru, number>> = {};
  const uygulanamaz = sorular.filter((s) => s.uygulanabilirlik === "NOT_APPLICABLE");
  const ilgili = sorular.filter((s) => s.uygulanabilirlik !== "NOT_APPLICABLE");
  // Uygulanabilirliği UNKNOWN olan (henüz belirlenmemiş) veya yanıtsız sorular
  // "cevapsiz" sayılır — cevap dolu olsa bile uygulanabilirlik belirsizse
  // ilgililik kendisi henüz kurulmamıştır (kural: UNKNOWN != NOT_APPLICABLE,
  // sessizce olumluya çevrilmez).
  const cevapsiz = ilgili.filter((s) => s.uygulanabilirlik === "UNKNOWN" || !s.cevap || s.cevap.trim() === "");
  const degerlendirilebilir = ilgili.filter((s) => !cevapsiz.includes(s));

  for (const s of ilgili) dagilimEkle(kaynakTuruDagilimi, s.kaynakTuru);

  const engelGerekceleri: GuvenceEngelKodu[] = [];
  let durum: KategoriDurumu;

  if (sorular.length === 0) {
    durum = "CEVAPSIZ";
    engelGerekceleri.push("CEVAPSIZ_SORU");
  } else if (ilgili.length === 0) {
    // Kategorideki TÜM sorular açıkça NOT_APPLICABLE — dışlanır, engel üretmez.
    durum = "UYGULANMAZ";
  } else if (cevapsiz.length > 0) {
    durum = "CEVAPSIZ";
    engelGerekceleri.push("CEVAPSIZ_SORU");
  } else {
    const kaynakSet = new Set(degerlendirilebilir.map((s) => s.kaynakTuru));
    const kaynakTuruBilinmiyor = kaynakSet.has("UNKNOWN");
    const yalnizSaglayiciBeyani = kaynakSet.size === 1 && kaynakSet.has("PROVIDER_ATTESTATION");
    const sablonDogrulanmamis = degerlendirilebilir.some((s) => s.sablonDogrulamaDurumu !== "VERIFIED");

    if (kaynakTuruBilinmiyor) engelGerekceleri.push("KAYNAK_TURU_BILINMIYOR");
    if (yalnizSaglayiciBeyani) engelGerekceleri.push("YALNIZ_SAGLAYICI_BEYANI");
    if (sablonDogrulanmamis) engelGerekceleri.push("DOGRULANMAMIS_SORU");

    durum = engelGerekceleri.length > 0 ? "INCELEME_GEREKLI" : "DOGRULANMIS";
  }

  return {
    kategori,
    soruSayisi: sorular.length,
    uygulanamazSayisi: uygulanamaz.length,
    cevapsizSayisi: cevapsiz.length,
    kaynakTuruDagilimi,
    durum,
    engelGerekceleri,
  };
}

/**
 * Bir telafi edici kontrol kaydının `asOf` ANINDA GERÇEKTEN etkin olup
 * olmadığı — DB'nin dondurulmuş `durum='AKTIF'` etiketine KÖR GÜVENİLMEZ
 * (aynı ilke: kaynak_turu/dogrulama_durumu canlı okunur, E1 §1). Cron henüz
 * çalışmamış olsa bile (durum hâlâ AKTIF yazsa da) pencere dışına çıkmışsa
 * ya da bağlı test/kanıt artık geçersizse etkin SAYILMAZ.
 */
function telafiAktifMi(t: TelafiEdiciKontrolOzeti, asOf: string): boolean {
  return (
    t.durum === "AKTIF" &&
    t.testSonucu === "PASSED" &&
    t.kanitGuncel &&
    asOf >= t.validFrom &&
    asOf <= t.validUntil
  );
}

/** Etkin OLMAYAN bir telafi kaydı için nedenini bildiren kod — hiçbiri uygulanmazsa null (kayıt zaten geçersiz/reddedilmiş, ek açıklama gerekmez). */
function telafiEngelKodu(t: TelafiEdiciKontrolOzeti, asOf: string): GuvenceEngelKodu | null {
  if (t.durum === "TASLAK" || t.durum === "INCELEMEDE") return "TELAFI_KONTROLU_DOGRULANMAMIS";
  if (t.durum === "SURESI_DOLDU") return "TELAFI_KONTROLU_SURESI_DOLMUS";
  if (t.durum === "AKTIF") {
    if (t.testSonucu !== "PASSED") return "TELAFI_TESTI_BASARISIZ";
    if (!t.kanitGuncel) return "TELAFI_KANITI_GUNCEL_DEGIL";
    if (asOf < t.validFrom || asOf > t.validUntil) return "TELAFI_KONTROLU_SURESI_DOLMUS";
  }
  // REDDEDILDI / IPTAL_EDILDI: kayıt zaten terminal-geçersiz, ayrı bir kod
  // eklemez — ACIK_KRITIK_BULGU zaten durumu dürüstçe anlatıyor.
  return null;
}

function genelDurumHesapla(
  kategoriler: KategoriSonucu[],
  acikKritikBulguVar: boolean,
  tumKritiklerTelafiyleKapsandiMi: boolean,
  sozlesmeYok: boolean,
): GenelGuvenceDurumu {
  if (acikKritikBulguVar) return tumKritiklerTelafiyleKapsandiMi ? "KRITIK_BULGU_TELAFI_ALTINDA" : "ENGELLENDI";
  if (kategoriler.length === 0) return "EKSIK";
  if (kategoriler.some((k) => k.durum === "CEVAPSIZ")) return "EKSIK";
  const degerlendirilenler = kategoriler.filter((k) => k.durum !== "UYGULANMAZ");
  if (degerlendirilenler.length === 0) return "EKSIK"; // hepsi UYGULANMAZ — hiçbir olumlu güvence UYDURULMAZ.
  if (degerlendirilenler.some((k) => k.durum === "INCELEME_GEREKLI")) return "INCELEME_GEREKLI";
  if (sozlesmeYok) return "INCELEME_GEREKLI";
  return "DOGRULANMIS_PROFIL";
}

/**
 * Bulut/tedarikçi güvence profilini hesaplar. Girdideki HER ŞEY çağıran
 * tarafından toplanmış olmalı (motor sorgu atmaz). Aynı girdi HER ZAMAN aynı
 * sonucu üretir.
 */
export function guvenceProfiliHesapla(girdi: GuvenceProfiliGirdisi): GuvenceProfiliSonucu {
  const kategoriliSorularMap = new Map<KategoriKodu, GuvenceSorusuGirdisi[]>();
  let kategorisizSoruSayisi = 0;
  const genelKaynakTuruDagilimi: Partial<Record<KaynakTuru, number>> = {};

  for (const s of girdi.sorular) {
    if (s.uygulanabilirlik !== "NOT_APPLICABLE") dagilimEkle(genelKaynakTuruDagilimi, s.kaynakTuru);
    if (s.kategori === null) {
      kategorisizSoruSayisi += 1;
      continue;
    }
    if (!kategoriliSorularMap.has(s.kategori)) kategoriliSorularMap.set(s.kategori, []);
    kategoriliSorularMap.get(s.kategori)!.push(s);
  }

  const kategoriler = [...kategoriliSorularMap.entries()]
    .map(([kategori, sorular]) => kategoriDurumuHesapla(kategori, sorular))
    .sort((a, b) => a.kategori.localeCompare(b.kategori));

  const acikKritikBulguVar = girdi.acikKritikBulgular.length > 0;
  const sozlesmeYok = girdi.contractId === null;

  // Telafi edici kontrol kapsamı — açık KRİTİK bulgu başına GEÇERLİ+AKTİF bir
  // kayıt var mı (Dikey E2 Kapı 2, ADR §5). Kısmi kapsama genel bloğu
  // KALDIRMAZ — kaplanmamış TEK bir KRİTİK bulgu bile ENGELLENDI'de tutar.
  const telafiler = girdi.telafiEdiciKontroller ?? [];
  const telafiKapsananBulguIdleri: string[] = [];
  const telafiOzetleri: GuvenceProfiliSonucu["telafiOzetleri"] = [];
  const telafiEngelKodlari: { bulguId: string; kod: GuvenceEngelKodu }[] = [];
  for (const bulgu of girdi.acikKritikBulgular) {
    const ilgiliTelafiler = telafiler
      .filter((t) => t.assessmentFindingId === bulgu.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    const aktifTelafi = ilgiliTelafiler.find((t) => telafiAktifMi(t, girdi.asOf));
    if (aktifTelafi) {
      telafiKapsananBulguIdleri.push(bulgu.id);
      telafiOzetleri.push({ bulguId: bulgu.id, controlMaddeRef: aktifTelafi.controlMaddeRef, validUntil: aktifTelafi.validUntil });
      telafiEngelKodlari.push({ bulguId: bulgu.id, kod: "AKTIF_TELAFI_EDICI_KONTROL" });
    } else {
      const ilkAnlamliKod = ilgiliTelafiler.map((t) => telafiEngelKodu(t, girdi.asOf)).find((k): k is GuvenceEngelKodu => k !== null);
      if (ilkAnlamliKod) telafiEngelKodlari.push({ bulguId: bulgu.id, kod: ilkAnlamliKod });
    }
  }
  telafiKapsananBulguIdleri.sort();
  telafiOzetleri.sort((a, b) => a.bulguId.localeCompare(b.bulguId));
  const tumKritiklerTelafiyleKapsandiMi =
    acikKritikBulguVar && girdi.acikKritikBulgular.every((b) => telafiKapsananBulguIdleri.includes(b.id));

  const genelDurum = genelDurumHesapla(kategoriler, acikKritikBulguVar, tumKritiklerTelafiyleKapsandiMi, sozlesmeYok);

  const engelGerekceleri: GuvenceEngelGerekcesi[] = [];
  if (acikKritikBulguVar) {
    engelGerekceleri.push({ kod: "ACIK_KRITIK_BULGU", kategori: null, aciklama: GUVENCE_ENGEL_ACIKLAMALARI.ACIK_KRITIK_BULGU });
  }
  for (const { kod } of telafiEngelKodlari) {
    engelGerekceleri.push({ kod, kategori: null, aciklama: GUVENCE_ENGEL_ACIKLAMALARI[kod] });
  }
  for (const k of kategoriler) {
    for (const kod of k.engelGerekceleri) {
      engelGerekceleri.push({ kod, kategori: k.kategori, aciklama: GUVENCE_ENGEL_ACIKLAMALARI[kod] });
    }
  }
  if (sozlesmeYok) {
    engelGerekceleri.push({ kod: "SOZLESME_EKSIK", kategori: null, aciklama: GUVENCE_ENGEL_ACIKLAMALARI.SOZLESME_EKSIK });
  }

  const hesaplamaYontemi: CloudAssuranceHesaplamaYontemi = {
    sema: CLOUD_ASSURANCE_SEMA_SURUMU,
    asOf: girdi.asOf,
    worstOfKurali:
      "Genel durum kategorilerin en kötüsüne göre belirlenir: ENGELLENDI > EKSIK > INCELEME_GEREKLI > DOGRULANMIS_PROFIL/KRITIK_BULGU_TELAFI_ALTINDA. Zorunlu kategori listesi yoktur — yalnız MEVCUT sorulara göre hesaplanır; sorusu olmayan kategori CEVAPSIZ görünür.",
    acikBulguKurali:
      "Açık (KAPANDI değil) KRİTİK bulgu genel durumu ENGELLENDI yapar — mutlak blok, M35'in mevcut sign-off engelinin aynı ilkesi. TÜM açık KRİTİK bulgular geçerli+aktif bir telafi edici kontrolle kapsanıyorsa (Dikey E2) durum KRITIK_BULGU_TELAFI_ALTINDA'ya döner — bu BULGUYU KAPATMAZ, yalnız yönetim durumunu bildirir; tek bir kaplanmamış KRİTİK bulgu bile ENGELLENDI'de tutar.",
    kaynakTuruYaklasimi:
      "kaynak_turu, dogrulama_durumu'ndan bağımsız ayrı bir boyuttur. UNKNOWN kaynak türü kategoriyi INCELEME_GEREKLI'ye düşürür; olumlu ya da olumsuz bir sonuç anlamına gelmez.",
    bagimsizDogrulamaYaklasimi:
      "PROVIDER_ATTESTATION tek başına bağımsız doğrulama sayılmaz — bir kategorideki tüm yanıtlar yalnızca sağlayıcı beyanına dayanıyorsa kategori INCELEME_GEREKLI'dir.",
  };

  return {
    semaSurumu: CLOUD_ASSURANCE_SEMA_SURUMU,
    asOf: girdi.asOf,
    thirdPartyId: girdi.thirdPartyId,
    contractId: girdi.contractId,
    genelDurum,
    kategoriler,
    kategorisizSoruSayisi,
    kaynakTuruDagilimi: genelKaynakTuruDagilimi,
    acikKritikBulgular: [...girdi.acikKritikBulgular].sort((a, b) => a.id.localeCompare(b.id)),
    telafiKapsananBulguIdleri,
    telafiOzetleri,
    engelGerekceleri,
    hesaplamaYontemi,
  };
}
