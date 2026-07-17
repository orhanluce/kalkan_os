// M10 kabul kriteri: "beyan 'Evet' ama kanıt sayısı 0 ise BEYAN VAR – KANIT
// YOK döner (CR-001); RTO beyanı fiili tatbikat süresinden düşükse BEYAN VE
// KANIT TUTARSIZ döner (CR-003); aynı girdi aynı sonucu verir."
import { describe, expect, it } from "vitest";
import {
  beyanDurumuHesapla,
  crKuraliDegerlendir,
  tetiklenenKurallariBul,
  type BeyanKanitGirdisi,
  type CrGirdi,
  type CrKural,
} from "../board-declaration-audit";

const ASOF = new Date("2026-07-17T00:00:00.000Z");

function beyanGirdi(patch: Partial<BeyanKanitGirdisi> = {}): BeyanKanitGirdisi {
  return { beyan: "evet", kanitSayisi: 1, toleransGun: 365, sonDogrulamaTarihi: "2026-06-01", ...patch };
}

describe("beyanDurumuHesapla", () => {
  it("aynı girdi her zaman aynı sonucu verir", () => {
    const g = beyanGirdi();
    expect(beyanDurumuHesapla(g, ASOF)).toEqual(beyanDurumuHesapla(g, ASOF));
  });

  it("'hayır' beyanı kanıt gerektirmez, her zaman uyumlu", () => {
    const sonuc = beyanDurumuHesapla(beyanGirdi({ beyan: "hayir", kanitSayisi: 0 }), ASOF);
    expect(sonuc.durum).toBe("BEYAN_VE_KANIT_UYUMLU");
  });

  it("'uygulanamaz' beyanı kanıt gerektirmez", () => {
    const sonuc = beyanDurumuHesapla(beyanGirdi({ beyan: "uygulanamaz", kanitSayisi: 0 }), ASOF);
    expect(sonuc.durum).toBe("BEYAN_VE_KANIT_UYUMLU");
  });

  it("beyan 'evet' ama kanıt sayısı 0 -> BEYAN_VAR_KANIT_YOK", () => {
    const sonuc = beyanDurumuHesapla(beyanGirdi({ kanitSayisi: 0 }), ASOF);
    expect(sonuc.durum).toBe("BEYAN_VAR_KANIT_YOK");
  });

  it("beyan 'kismen' ama kanıt sayısı 0 -> BEYAN_VAR_KANIT_YOK", () => {
    const sonuc = beyanDurumuHesapla(beyanGirdi({ beyan: "kismen", kanitSayisi: 0 }), ASOF);
    expect(sonuc.durum).toBe("BEYAN_VAR_KANIT_YOK");
  });

  it("kanıt var ama son doğrulama tarihi girilmemiş -> INCELEME_GEREKLI", () => {
    const sonuc = beyanDurumuHesapla(beyanGirdi({ sonDogrulamaTarihi: null }), ASOF);
    expect(sonuc.durum).toBe("INCELEME_GEREKLI");
  });

  it("son doğrulama tolerans içinde -> UYUMLU", () => {
    const sonuc = beyanDurumuHesapla(beyanGirdi({ sonDogrulamaTarihi: "2026-06-01", toleransGun: 365 }), ASOF);
    expect(sonuc.durum).toBe("BEYAN_VE_KANIT_UYUMLU");
  });

  it("son doğrulama tolerans dışında -> BEYAN_VAR_KANIT_EKSIK", () => {
    const sonuc = beyanDurumuHesapla(
      beyanGirdi({ sonDogrulamaTarihi: "2024-01-01", toleransGun: 365 }),
      ASOF,
    );
    expect(sonuc.durum).toBe("BEYAN_VAR_KANIT_EKSIK");
  });

  it("tam sınırda tolerans içinde sayılır", () => {
    const tamSinir = new Date(ASOF.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sonuc = beyanDurumuHesapla(beyanGirdi({ sonDogrulamaTarihi: tamSinir, toleransGun: 365 }), ASOF);
    expect(sonuc.durum).toBe("BEYAN_VE_KANIT_UYUMLU");
  });

  it("gelecekteki doğrulama tarihi INCELEME_GEREKLI döner (veri hatası)", () => {
    const sonuc = beyanDurumuHesapla(beyanGirdi({ sonDogrulamaTarihi: "2099-01-01" }), ASOF);
    expect(sonuc.durum).toBe("INCELEME_GEREKLI");
  });

  it("her sonuç gerekçe taşır", () => {
    for (const beyan of ["evet", "hayir", "kismen", "uygulanamaz"] as const) {
      const sonuc = beyanDurumuHesapla(beyanGirdi({ beyan }), ASOF);
      expect(sonuc.gerekce.length).toBeGreaterThan(0);
    }
  });
});

function kural(patch: Partial<CrKural> = {}): CrKural {
  return {
    kod: "CR-TEST",
    aciklama: "Test kuralı",
    degerlendirmeTipi: "KANIT_YOK_ISE_TUTARSIZ",
    parametreler: {},
    onerilenBulguBasligi: "Test bulgusu",
    riskSeviyesi: "orta",
    veriKaynagiDurumu: "MEVCUT",
    ...patch,
  };
}

function crGirdi(patch: Partial<CrGirdi> = {}): CrGirdi {
  return {
    beyan: "evet",
    kanitSayisi: 1,
    sonDogrulamaTarihi: "2026-06-01",
    beyanEdilenHedefSaat: null,
    fiiliSonucSaat: null,
    auditKaydiVarMi: null,
    simulasyonDurumu: null,
    ...patch,
  };
}

describe("crKuraliDegerlendir — veri kaynağı kapısı (dürüstlük sınırı)", () => {
  it("MODEL_YOK kural, tip ne olursa olsun İNCELENEMEDİ döner", () => {
    const k = kural({ veriKaynagiDurumu: "MODEL_YOK", degerlendirmeTipi: "KANIT_YOK_ISE_TUTARSIZ" });
    // Girdi kuralın "tetiklenir" olacağı şekilde kurulu olsa bile (kanıt yok):
    const sonuc = crKuraliDegerlendir(k, crGirdi({ kanitSayisi: 0 }), ASOF);

    // Sahte bir "tetiklendi" ÜRETİLMEMELİ — veri modeli yoksa sistem
    // bilmediği bir şeyi biliyormuş gibi davranmamalı.
    expect(sonuc.sonuc).toBe("incelenemedi");
    expect(sonuc.gerekce).toContain("MODEL_YOK");
  });

  it("KISMI veri kaynağı da İNCELENEMEDİ döner", () => {
    const sonuc = crKuraliDegerlendir(kural({ veriKaynagiDurumu: "KISMI" }), crGirdi(), ASOF);
    expect(sonuc.sonuc).toBe("incelenemedi");
  });

  it("bilinmeyen değerlendirme tipi sahte sonuç üretmez", () => {
    const k = kural({ degerlendirmeTipi: "TEDARIKCI_ENVANTERINDE_YOK", veriKaynagiDurumu: "MEVCUT" });
    // veriKaynagiDurumu MEVCUT dese bile, bu tip için gerçek bir handler yok:
    // default case yine incelenemedi döner.
    expect(crKuraliDegerlendir(k, crGirdi(), ASOF).sonuc).toBe("incelenemedi");
  });
});

describe("crKuraliDegerlendir — CR-001 (KANIT_YOK_ISE_TUTARSIZ)", () => {
  it("beyan evet + kanıt 0 -> tetiklenir", () => {
    const sonuc = crKuraliDegerlendir(kural(), crGirdi({ beyan: "evet", kanitSayisi: 0 }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklendi");
    expect(sonuc.riskSeviyesi).toBe("orta");
    expect(sonuc.bulguBasligi).toBe("Test bulgusu");
  });

  it("beyan evet + kanıt var -> tetiklenmez", () => {
    const sonuc = crKuraliDegerlendir(kural(), crGirdi({ beyan: "evet", kanitSayisi: 3 }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklenmedi");
  });

  it("beyan hayır ise kural uygulanmaz", () => {
    const sonuc = crKuraliDegerlendir(kural(), crGirdi({ beyan: "hayir", kanitSayisi: 0 }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklenmedi");
  });
});

describe("crKuraliDegerlendir — CR-002 (KANIT_SURESI_GECMISSE)", () => {
  const k = kural({ degerlendirmeTipi: "KANIT_SURESI_GECMISSE", parametreler: { tolerans_gun: 180 } });

  it("kanıt var ama süresi geçmiş -> tetiklenir", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ sonDogrulamaTarihi: "2025-01-01" }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklendi");
  });

  it("kanıt tolerans içinde -> tetiklenmez", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ sonDogrulamaTarihi: "2026-07-01" }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklenmedi");
  });

  it("son doğrulama tarihi yoksa incelenemedi", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ sonDogrulamaTarihi: null }), ASOF);
    expect(sonuc.sonuc).toBe("incelenemedi");
  });
});

describe("crKuraliDegerlendir — CR-003 (HEDEF_ASILDIYSA / RTO)", () => {
  const k = kural({ kod: "CR-003", degerlendirmeTipi: "HEDEF_ASILDIYSA" });

  it("fiili sonuç beyan edilen hedefi aşarsa tetiklenir", () => {
    // Belgenin kendi örneği: RTO beyanı 4 saat, fiili tatbikat 6 saat sürdü.
    const sonuc = crKuraliDegerlendir(
      k,
      crGirdi({ beyanEdilenHedefSaat: 4, fiiliSonucSaat: 6 }),
      ASOF,
    );
    expect(sonuc.sonuc).toBe("tetiklendi");
    expect(sonuc.gerekce).toContain("6");
    expect(sonuc.gerekce).toContain("4");
  });

  it("fiili sonuç hedef içindeyse tetiklenmez", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ beyanEdilenHedefSaat: 4, fiiliSonucSaat: 3 }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklenmedi");
  });

  it("tam sınırda (fiili = hedef) tetiklenmez", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ beyanEdilenHedefSaat: 4, fiiliSonucSaat: 4 }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklenmedi");
  });

  it("bağlı tatbikat yoksa incelenemedi", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ beyanEdilenHedefSaat: 4, fiiliSonucSaat: null }), ASOF);
    expect(sonuc.sonuc).toBe("incelenemedi");
  });
});

describe("crKuraliDegerlendir — CR-007 (RAPORLAMA_IZI_YOK)", () => {
  const k = kural({ kod: "CR-007", degerlendirmeTipi: "RAPORLAMA_IZI_YOK" });

  it("beyan evet ama audit izi yoksa tetiklenir", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ beyan: "evet", auditKaydiVarMi: false }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklendi");
  });

  it("audit izi varsa tetiklenmez", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ beyan: "evet", auditKaydiVarMi: true }), ASOF);
    expect(sonuc.sonuc).toBe("tetiklenmedi");
  });

  it("kontrol edilmediyse (null) incelenemedi", () => {
    const sonuc = crKuraliDegerlendir(k, crGirdi({ beyan: "evet", auditKaydiVarMi: null }), ASOF);
    expect(sonuc.sonuc).toBe("incelenemedi");
  });
});

describe("crKuraliDegerlendir — CR-008 (SIMULASYON_KRITIK_ESIK_ALTI)", () => {
  const k = kural({ kod: "CR-008", degerlendirmeTipi: "SIMULASYON_KRITIK_ESIK_ALTI" });

  it("CRITICAL_FAILURE tetikler", () => {
    expect(
      crKuraliDegerlendir(k, crGirdi({ simulasyonDurumu: "CRITICAL_FAILURE" }), ASOF).sonuc,
    ).toBe("tetiklendi");
  });

  it("BASARISIZ tetikler", () => {
    expect(crKuraliDegerlendir(k, crGirdi({ simulasyonDurumu: "BASARISIZ" }), ASOF).sonuc).toBe(
      "tetiklendi",
    );
  });

  it("BASARILI tetiklemez", () => {
    expect(crKuraliDegerlendir(k, crGirdi({ simulasyonDurumu: "BASARILI" }), ASOF).sonuc).toBe(
      "tetiklenmedi",
    );
  });

  it("bağlı tatbikat yoksa incelenemedi", () => {
    expect(crKuraliDegerlendir(k, crGirdi({ simulasyonDurumu: null }), ASOF).sonuc).toBe(
      "incelenemedi",
    );
  });
});

describe("tetiklenenKurallariBul", () => {
  it("yalnızca tetiklenen kuralları döndürür", () => {
    const sonuclar = tetiklenenKurallariBul(
      [
        { kural: kural({ kod: "A" }), girdi: crGirdi({ kanitSayisi: 0 }) }, // tetiklenir
        { kural: kural({ kod: "B" }), girdi: crGirdi({ kanitSayisi: 5 }) }, // tetiklenmez
        { kural: kural({ kod: "C", veriKaynagiDurumu: "MODEL_YOK" }), girdi: crGirdi({ kanitSayisi: 0 }) }, // incelenemedi
      ],
      ASOF,
    );

    expect(sonuclar).toHaveLength(1);
    expect(sonuclar[0].kod).toBe("A");
  });

  it("aynı girdi aynı sonuçları verir", () => {
    const veri = [
      { kural: kural({ kod: "A" }), girdi: crGirdi({ kanitSayisi: 0 }) },
      { kural: kural({ kod: "B", degerlendirmeTipi: "HEDEF_ASILDIYSA" as const }), girdi: crGirdi({ beyanEdilenHedefSaat: 4, fiiliSonucSaat: 8 }) },
    ];
    expect(tetiklenenKurallariBul(veri, ASOF)).toEqual(tetiklenenKurallariBul(veri, ASOF));
  });
});
