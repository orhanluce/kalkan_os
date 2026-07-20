import { describe, expect, it } from "vitest";
import {
  guvenceProfiliHesapla,
  type GuvenceProfiliGirdisi,
  type GuvenceSorusuGirdisi,
  type TelafiEdiciKontrolOzeti,
} from "../cloud-assurance";

function telafi(over: Partial<TelafiEdiciKontrolOzeti> = {}): TelafiEdiciKontrolOzeti {
  return {
    id: "t1",
    assessmentFindingId: "f1",
    durum: "AKTIF",
    testSonucu: "PASSED",
    kanitGuncel: true,
    validFrom: "2026-01-01",
    validUntil: "2027-01-01",
    controlMaddeRef: "M.1",
    ...over,
  };
}

function soru(over: Partial<GuvenceSorusuGirdisi> = {}): GuvenceSorusuGirdisi {
  return {
    id: "s1",
    kategori: "BULUT_ENVANTERI",
    cevap: "Evet",
    uygulanabilirlik: "APPLICABLE",
    kaynakTuru: "CONTRACTUAL_REQUIREMENT",
    sablonDogrulamaDurumu: "VERIFIED",
    ...over,
  };
}

function girdi(over: Partial<GuvenceProfiliGirdisi> = {}): GuvenceProfiliGirdisi {
  return {
    asOf: "2026-07-20T10:00:00.000Z",
    thirdPartyId: "tp1",
    contractId: "c1",
    sorular: [],
    acikKritikBulgular: [],
    ...over,
  };
}

describe("guvenceProfiliHesapla", () => {
  it("boş girdi: hiç kategori yok → EKSIK, sahte DOGRULANMIS_PROFIL üretilmez", () => {
    const sonuc = guvenceProfiliHesapla(girdi());
    expect(sonuc.genelDurum).toBe("EKSIK");
    expect(sonuc.kategoriler).toHaveLength(0);
  });

  it("tüm sorular yanıtlı+VERIFIED+bağımsız kaynak+sözleşme var → DOGRULANMIS_PROFIL", () => {
    const sonuc = guvenceProfiliHesapla(girdi({ sorular: [soru()] }));
    expect(sonuc.genelDurum).toBe("DOGRULANMIS_PROFIL");
    expect(sonuc.kategoriler[0].durum).toBe("DOGRULANMIS");
    expect(sonuc.engelGerekceleri).toHaveLength(0);
  });

  it("aynı profil ama sözleşme yok → INCELEME_GEREKLI (SOZLESME_EKSIK), DOGRULANMIS_PROFIL DEĞİL", () => {
    const sonuc = guvenceProfiliHesapla(girdi({ sorular: [soru()], contractId: null }));
    expect(sonuc.genelDurum).toBe("INCELEME_GEREKLI");
    expect(sonuc.engelGerekceleri.map((e) => e.kod)).toContain("SOZLESME_EKSIK");
  });

  it("bir kategori CEVAPSIZ, diğeri DOGRULANMIS → genel EKSIK (worst-of)", () => {
    const sonuc = guvenceProfiliHesapla(
      girdi({
        sorular: [
          soru({ id: "s1", kategori: "BULUT_ENVANTERI" }),
          soru({ id: "s2", kategori: "SLA_GUVENLIK", cevap: null }),
        ],
      }),
    );
    expect(sonuc.genelDurum).toBe("EKSIK");
    const slaKategori = sonuc.kategoriler.find((k) => k.kategori === "SLA_GUVENLIK")!;
    expect(slaKategori.durum).toBe("CEVAPSIZ");
    expect(slaKategori.engelGerekceleri).toContain("CEVAPSIZ_SORU");
  });

  it("kaynak türü UNKNOWN → INCELEME_GEREKLI + KAYNAK_TURU_BILINMIYOR (asla sahte DOGRULANMIS)", () => {
    const sonuc = guvenceProfiliHesapla(girdi({ sorular: [soru({ kaynakTuru: "UNKNOWN" })] }));
    expect(sonuc.kategoriler[0].durum).toBe("INCELEME_GEREKLI");
    expect(sonuc.kategoriler[0].engelGerekceleri).toContain("KAYNAK_TURU_BILINMIYOR");
  });

  it("kategorideki TÜM yanıtlar yalnız PROVIDER_ATTESTATION → bağımsız doğrulama SAYILMAZ, INCELEME_GEREKLI", () => {
    const sonuc = guvenceProfiliHesapla(
      girdi({
        sorular: [
          soru({ id: "s1", kaynakTuru: "PROVIDER_ATTESTATION" }),
          soru({ id: "s2", kaynakTuru: "PROVIDER_ATTESTATION" }),
        ],
      }),
    );
    expect(sonuc.kategoriler[0].durum).toBe("INCELEME_GEREKLI");
    expect(sonuc.kategoriler[0].engelGerekceleri).toContain("YALNIZ_SAGLAYICI_BEYANI");
  });

  it("PROVIDER_ATTESTATION + başka bir kaynak türü karışık ise 'yalnız beyan' bloğu tetiklenmez", () => {
    const sonuc = guvenceProfiliHesapla(
      girdi({
        sorular: [
          soru({ id: "s1", kaynakTuru: "PROVIDER_ATTESTATION" }),
          soru({ id: "s2", kaynakTuru: "LEGAL_REQUIREMENT" }),
        ],
      }),
    );
    expect(sonuc.kategoriler[0].engelGerekceleri).not.toContain("YALNIZ_SAGLAYICI_BEYANI");
    expect(sonuc.kategoriler[0].durum).toBe("DOGRULANMIS");
  });

  it("şablon TODO_DOGRULA (henüz insan doğrulaması yok) → INCELEME_GEREKLI + DOGRULANMAMIS_SORU", () => {
    const sonuc = guvenceProfiliHesapla(girdi({ sorular: [soru({ sablonDogrulamaDurumu: "TODO_DOGRULA" })] }));
    expect(sonuc.kategoriler[0].durum).toBe("INCELEME_GEREKLI");
    expect(sonuc.kategoriler[0].engelGerekceleri).toContain("DOGRULANMAMIS_SORU");
  });

  it("template_id yok (sablonDogrulamaDurumu null) → aynı DOGRULANMAMIS_SORU muamelesi", () => {
    const sonuc = guvenceProfiliHesapla(girdi({ sorular: [soru({ sablonDogrulamaDurumu: null })] }));
    expect(sonuc.kategoriler[0].engelGerekceleri).toContain("DOGRULANMAMIS_SORU");
  });

  it("açık KRİTİK bulgu → ENGELLENDI, kategoriler kusursuz olsa bile mutlak blok", () => {
    const sonuc = guvenceProfiliHesapla(
      girdi({ sorular: [soru()], acikKritikBulgular: [{ id: "f1", baslik: "Şifreleme eksik" }] }),
    );
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
    expect(sonuc.engelGerekceleri[0]).toEqual({
      kod: "ACIK_KRITIK_BULGU",
      kategori: null,
      aciklama: expect.any(String),
    });
  });

  it("uygulanabilirlik NOT_APPLICABLE → kategori dışlanır (UYGULANMAZ), genel duruma engel olmaz", () => {
    const sonuc = guvenceProfiliHesapla(
      girdi({
        sorular: [
          soru({ id: "s1", kategori: "BULUT_ENVANTERI" }),
          soru({ id: "s2", kategori: "DDOS_KAPASITE", uygulanabilirlik: "NOT_APPLICABLE", cevap: null }),
        ],
      }),
    );
    expect(sonuc.genelDurum).toBe("DOGRULANMIS_PROFIL");
    const ddos = sonuc.kategoriler.find((k) => k.kategori === "DDOS_KAPASITE")!;
    expect(ddos.durum).toBe("UYGULANMAZ");
    expect(ddos.engelGerekceleri).toHaveLength(0);
  });

  it("uygulanabilirlik UNKNOWN → cevap dolu olsa bile CEVAPSIZ sayılır (sessizce olumluya çevrilmez)", () => {
    const sonuc = guvenceProfiliHesapla(girdi({ sorular: [soru({ uygulanabilirlik: "UNKNOWN", cevap: "Evet" })] }));
    expect(sonuc.kategoriler[0].durum).toBe("CEVAPSIZ");
  });

  it("kategorisiz sorular (template_id yok) kaybolmaz, ayrı sayılır — uydurulmuş kategoriye eklenmez", () => {
    const sonuc = guvenceProfiliHesapla(girdi({ sorular: [soru({ kategori: null })] }));
    expect(sonuc.kategoriler).toHaveLength(0);
    expect(sonuc.kategorisizSoruSayisi).toBe(1);
  });

  it("saf/deterministik: aynı girdi iki kez çağrılınca birebir aynı sonucu üretir", () => {
    const g = girdi({ sorular: [soru({ kaynakTuru: "UNKNOWN" }), soru({ id: "s2", kategori: "IAM_LOG" })] });
    const s1 = guvenceProfiliHesapla(g);
    const s2 = guvenceProfiliHesapla(g);
    expect(s1).toEqual(s2);
    expect(s1.asOf).toBe("2026-07-20T10:00:00.000Z");
  });

  it("worst-of sıralaması: ENGELLENDI, EKSIK'in ve INCELEME_GEREKLI'nin üstündedir", () => {
    const sonuc = guvenceProfiliHesapla(
      girdi({
        sorular: [
          soru({ id: "s1", kategori: "BULUT_ENVANTERI", cevap: null }), // CEVAPSIZ → EKSIK adayı
          soru({ id: "s2", kategori: "SLA_GUVENLIK", kaynakTuru: "UNKNOWN" }), // INCELEME_GEREKLI adayı
        ],
        acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      }),
    );
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
  });

  it("genel kaynak türü dağılımı NOT_APPLICABLE sorularını saymaz", () => {
    const sonuc = guvenceProfiliHesapla(
      girdi({
        sorular: [soru({ id: "s1", kaynakTuru: "LEGAL_REQUIREMENT" }), soru({ id: "s2", uygulanabilirlik: "NOT_APPLICABLE", cevap: null })],
      }),
    );
    expect(sonuc.kaynakTuruDagilimi).toEqual({ LEGAL_REQUIREMENT: 1 });
  });
});

describe("guvenceProfiliHesapla — telafi edici kontrol (Dikey E2, Kapı 2)", () => {
  it("telafiEdiciKontroller atlanırsa (undefined) davranış E1 ile birebir aynı kalır (geriye dönük uyumluluk)", () => {
    const g = girdi({ sorular: [soru()], acikKritikBulgular: [{ id: "f1", baslik: "X" }] });
    const eski = guvenceProfiliHesapla(g);
    expect(eski.genelDurum).toBe("ENGELLENDI");
    expect(eski.telafiKapsananBulguIdleri).toEqual([]);
  });

  it("geçerli AKTIF telafi, kritik bulguyu 'kapalı' YAPMAZ — bulgu hâlâ acikKritikBulgular listesinde", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi()],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.acikKritikBulgular).toEqual([{ id: "f1", baslik: "X" }]);
  });

  it("geçerli AKTIF telafi, profil durumunu KRITIK_BULGU_TELAFI_ALTINDA olarak işaretler", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi()],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("KRITIK_BULGU_TELAFI_ALTINDA");
    expect(sonuc.telafiKapsananBulguIdleri).toEqual(["f1"]);
    expect(sonuc.engelGerekceleri.map((e) => e.kod)).toContain("AKTIF_TELAFI_EDICI_KONTROL");
  });

  it("telafiOzetleri Proof Room'un asgari gösterimi için kontrol referansı + geçerlilik bitişini taşır (bulgu KAPANMAZ)", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ controlMaddeRef: "VII-128.10 md.5", validUntil: "2026-12-31" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.telafiOzetleri).toEqual([{ bulguId: "f1", controlMaddeRef: "VII-128.10 md.5", validUntil: "2026-12-31" }]);
  });

  it("kapsanmayan bulgu için telafiOzetleri boş kalır (yalnız GEÇERLİ+AKTİF kapsananlar taşınır)", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ durum: "REDDEDILDI" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.telafiOzetleri).toEqual([]);
  });

  it("süresi dolmuş telafi (asOf > validUntil) aktif sayılmaz — DB'nin dondurulmuş AKTIF etiketine kör güvenilmez", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ validUntil: "2026-01-01" })],
      asOf: "2026-07-20T00:00:00.000Z",
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
    expect(sonuc.engelGerekceleri.map((e) => e.kod)).toContain("TELAFI_KONTROLU_SURESI_DOLMUS");
  });

  it("asOf = validUntil sınır davranışı: geçerlilik sınırında dahil (kapsayıcı)", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ validFrom: "2026-01-01", validUntil: "2026-07-20" })],
      asOf: "2026-07-20",
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("KRITIK_BULGU_TELAFI_ALTINDA");
  });

  it("test sonucu FAILED ise telafi aktif sayılmaz", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ testSonucu: "FAILED" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
    expect(sonuc.engelGerekceleri.map((e) => e.kod)).toContain("TELAFI_TESTI_BASARISIZ");
  });

  it("test sonucu UNKNOWN ise telafi aktif sayılmaz (olumlu kabul edilmez)", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ testSonucu: "UNKNOWN" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
  });

  it("kanıt güncel değilse telafi aktif sayılmaz", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ kanitGuncel: false })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
    expect(sonuc.engelGerekceleri.map((e) => e.kod)).toContain("TELAFI_KANITI_GUNCEL_DEGIL");
  });

  it("yalnız PROVIDER_ATTESTATION varsa etkin sayılmaz kuralı zaten yapısal olarak sağlanır (test_run_id her zaman M12 kaynaklı)", () => {
    // Motor kaynak_turu'nu telafi girdisinde HİÇ taşımıyor (ADR §4) — bu
    // testin amacı, motorun "PROVIDER_ATTESTATION" diye bir alan bile
    // ARAMADIĞINI, yalnızca test_run sonucuna baktığını göstermek.
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi()],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("KRITIK_BULGU_TELAFI_ALTINDA");
  });

  it("iptal edilmiş telafi geçersiz — kritik bulgu ENGELLENDI kalır", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ durum: "IPTAL_EDILDI" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
  });

  it("reddedilmiş telafi geçersiz — kritik bulgu ENGELLENDI kalır", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ durum: "REDDEDILDI" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
  });

  it("TASLAK/İNCELEMEDE durumundaki telafi henüz doğrulanmamış sayılır", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ durum: "INCELEMEDE" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
    expect(sonuc.engelGerekceleri.map((e) => e.kod)).toContain("TELAFI_KONTROLU_DOGRULANMAMIS");
  });

  it("aynı bulguya birden fazla telafi varsa: HERHANGİ biri geçerli+aktifse bulgu kapsanmış sayılır (deterministik)", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi({ id: "t1", durum: "REDDEDILDI" }), telafi({ id: "t2", durum: "AKTIF" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("KRITIK_BULGU_TELAFI_ALTINDA");
  });

  it("kısmi kapsama: iki açık KRİTİK bulgudan yalnız biri kapsanırsa genel durum hâlâ ENGELLENDI", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [
        { id: "f1", baslik: "X" },
        { id: "f2", baslik: "Y" },
      ],
      telafiEdiciKontroller: [telafi({ id: "t1", assessmentFindingId: "f1" })],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.genelDurum).toBe("ENGELLENDI");
    expect(sonuc.telafiKapsananBulguIdleri).toEqual(["f1"]);
  });

  it("aynı girdi iki kez çağrılınca birebir aynı sonucu üretir (deterministik)", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "X" }],
      telafiEdiciKontroller: [telafi()],
    });
    expect(guvenceProfiliHesapla(g)).toEqual(guvenceProfiliHesapla(g));
  });

  it("impact yayılımıyla ilgisi yok — bu yalnız güvence profili motoru, telafi bulguyu VERİ MODELİNDEN silmez", () => {
    const g = girdi({
      sorular: [soru()],
      acikKritikBulgular: [{ id: "f1", baslik: "Şifreleme eksik" }],
      telafiEdiciKontroller: [telafi()],
    });
    const sonuc = guvenceProfiliHesapla(g);
    expect(sonuc.acikKritikBulgular[0].baslik).toBe("Şifreleme eksik");
  });
});
