// M8 kabul kriteri: "aynı veri aynı puanı üretiyor; her puan satırı
// açıklanıyor; kritik mandatory fail çalışıyor; öneri onaylanmadan gerçek
// bulgu oluşmuyor" (docs/ROADMAP.md M8, CLAUDE.md kural 11).
import { describe, expect, it } from "vitest";
import {
  bulguOnerileriUret,
  puanla,
  type AksiyonSonucu,
  type PuanlamaGirdisi,
  type PuanlamaKurali,
} from "../scoring";

function kural(patch: Partial<PuanlamaKurali> = {}): PuanlamaKurali {
  return {
    kod: "K1",
    tip: "ACTION_COMPLETED",
    bilesen: "zorunlu_aksiyonlar",
    agirlik: 10,
    aciklama: "Test kuralı",
    beklenenAksiyon: "A1",
    parametreler: {},
    ...patch,
  };
}

function aksiyon(patch: Partial<AksiyonSonucu> = {}): AksiyonSonucu {
  return { kod: "A1", tamamlandi: true, dakika: 10, ...patch };
}

function girdi(patch: Partial<PuanlamaGirdisi> = {}): PuanlamaGirdisi {
  return {
    kurallar: [kural()],
    aksiyonlar: [aksiyon()],
    verilenKararlar: [],
    gozlemciPuani: null,
    ...patch,
  };
}

describe("puanla — deterministiklik (kural 11)", () => {
  it("aynı girdi her zaman aynı sonucu verir", async () => {
    const g = girdi({
      kurallar: [
        kural({ kod: "K1", tip: "ACTION_COMPLETED_WITHIN", agirlik: 25, parametreler: { dakika: 15 } }),
        kural({ kod: "K2", beklenenAksiyon: "A2", agirlik: 15 }),
      ],
      aksiyonlar: [aksiyon({ dakika: 10 }), aksiyon({ kod: "A2", tamamlandi: false, dakika: null })],
    });

    const a = puanla(g);
    const b = puanla(g);
    expect(a).toEqual(b);

    // Ve tekrar tekrar: rastgelelik veya zaman okuma olsaydı burada ayrışırdı.
    for (let i = 0; i < 5; i++) expect(puanla(g).puan).toBe(a.puan);
  });

  it("her puan satırı gerekçe taşır", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [
          kural({ kod: "K1" }),
          kural({ kod: "K2", tip: "ACTION_COMPLETED_WITHIN", parametreler: { dakika: 5 } }),
          kural({ kod: "K3", tip: "OBSERVER_RATING", beklenenAksiyon: null }),
        ],
        gozlemciPuani: 80,
      }),
    );

    // Gerekçesiz bir satır, katılımcıya "sistem böyle dedi" demek olurdu.
    for (const s of sonuc.satirlar) {
      expect(s.gerekce.length, `${s.kod} gerekçesiz`).toBeGreaterThan(0);
    }
  });
});

describe("puanla — zaman hedefleri", () => {
  it("hedef içinde tamamlanan aksiyon tam puan alır", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [kural({ tip: "ACTION_COMPLETED_WITHIN", agirlik: 25, parametreler: { dakika: 15 } })],
        aksiyonlar: [aksiyon({ dakika: 12 })],
      }),
    );
    expect(sonuc.satirlar[0].sonuc).toBe("gecti");
    expect(sonuc.puan).toBe(100);
  });

  it("hedefi aşan aksiyon puan almaz ve süreyi gerekçede gösterir", async () => {
    // Belge §8.5'teki örnek: beklenen 15 dk, gerçekleşen 42 dk.
    const sonuc = puanla(
      girdi({
        kurallar: [kural({ tip: "ACTION_COMPLETED_WITHIN", agirlik: 25, parametreler: { dakika: 15 } })],
        aksiyonlar: [aksiyon({ dakika: 42 })],
      }),
    );

    expect(sonuc.satirlar[0].sonuc).toBe("kaldi");
    expect(sonuc.satirlar[0].gerekce).toContain("42");
    expect(sonuc.satirlar[0].gerekce).toContain("15");
    expect(sonuc.puan).toBe(0);
  });

  it("tam hedefte tamamlanan aksiyon geçer (sınır dahil)", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [kural({ tip: "ACTION_COMPLETED_WITHIN", parametreler: { dakika: 15 } })],
        aksiyonlar: [aksiyon({ dakika: 15 })],
      }),
    );
    expect(sonuc.satirlar[0].sonuc).toBe("gecti");
  });

  it("RTO hedefi hedef_dakika parametresini okur", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [kural({ tip: "RTO_WITHIN_TARGET", parametreler: { hedef_dakika: 90 } })],
        aksiyonlar: [aksiyon({ dakika: 85 })],
      }),
    );
    expect(sonuc.satirlar[0].sonuc).toBe("gecti");
  });
});

describe("puanla — kritik başarısızlık (belge §9.3)", () => {
  it("zorunlu aksiyon eksikse puan yüksek olsa bile CRITICAL_FAILURE", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [
          kural({ kod: "K1", agirlik: 90 }), // geçer
          kural({ kod: "KRITIK", tip: "MANDATORY_FAIL_IF", beklenenAksiyon: "DELIL", agirlik: 0 }),
        ],
        aksiyonlar: [aksiyon(), aksiyon({ kod: "DELIL", tamamlandi: false, dakika: null })],
      }),
    );

    // "Ortalamayı tutturdu ama delil toplamadı" başarı değildir.
    expect(sonuc.puan).toBe(100);
    expect(sonuc.durum).toBe("CRITICAL_FAILURE");
    expect(sonuc.kritikBasarisizliklar).toHaveLength(1);
  });

  it("zorunlu aksiyon tamamlandıysa kritik başarısızlık yok", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [kural({ tip: "MANDATORY_FAIL_IF", beklenenAksiyon: "DELIL" })],
        aksiyonlar: [aksiyon({ kod: "DELIL" })],
      }),
    );
    expect(sonuc.durum).not.toBe("CRITICAL_FAILURE");
    expect(sonuc.kritikBasarisizliklar).toHaveLength(0);
  });

  it("MANDATORY_FAIL_IF kuralı puana katkı vermez", async () => {
    // Ağırlığı olsa bile puana girmez: "zorunlu" olmanın anlamı bu.
    const sonuc = puanla(
      girdi({
        kurallar: [
          kural({ kod: "K1", agirlik: 50 }),
          kural({ kod: "KRITIK", tip: "MANDATORY_FAIL_IF", beklenenAksiyon: "DELIL", agirlik: 50 }),
        ],
        aksiyonlar: [aksiyon(), aksiyon({ kod: "DELIL" })],
      }),
    );
    // Yalnızca K1 puanlandı: 50/50 = 100.
    expect(sonuc.puan).toBe(100);
  });
});

describe("puanla — gözlemci puanı (belge §9.3)", () => {
  it("gözlemci puanı tek başına toplamı belirlemez", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [
          kural({ kod: "K1", agirlik: 90, beklenenAksiyon: "A1" }),
          kural({ kod: "GOZ", tip: "OBSERVER_RATING", bilesen: "gozlemci", agirlik: 10, beklenenAksiyon: null }),
        ],
        aksiyonlar: [aksiyon({ tamamlandi: false, dakika: null })],
        gozlemciPuani: 100,
      }),
    );

    // Gözlemci tam puan verdi ama asıl aksiyon yapılmadı: toplam 10/100.
    expect(sonuc.puan).toBe(10);
    expect(sonuc.durum).toBe("BASARISIZ");
  });

  it("gözlemci puanı girilmemişse kural paydadan düşer", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [
          kural({ kod: "K1", agirlik: 50 }),
          kural({ kod: "GOZ", tip: "OBSERVER_RATING", agirlik: 50, beklenenAksiyon: null }),
        ],
        gozlemciPuani: null,
      }),
    );

    // Gözlemci notu girilmemesi, katılımcının başarısızlığı değildir:
    // K1 geçti, payda yalnızca K1 -> 100.
    expect(sonuc.satirlar[1].sonuc).toBe("uygulanamadi");
    expect(sonuc.puan).toBe(100);
  });
});

describe("puanla — sınır durumlar", () => {
  it("bağlı aksiyonu bulunmayan kural uygulanamadı sayılır", async () => {
    const sonuc = puanla(girdi({ kurallar: [kural({ beklenenAksiyon: "YOK" })], aksiyonlar: [] }));

    // Eksik şablon verisi, sessizce puanı şişirmemeli veya düşürmemeli.
    expect(sonuc.satirlar[0].sonuc).toBe("uygulanamadi");
    expect(sonuc.puan).toBe(0);
  });

  it("hiç uygulanabilir kural yoksa puan 0 (sıfıra bölme yok)", async () => {
    const sonuc = puanla(girdi({ kurallar: [], aksiyonlar: [] }));
    expect(sonuc.puan).toBe(0);
    expect(sonuc.durum).toBe("BASARISIZ");
  });

  it("karar verilmediyse DECISION_SELECTED kalır", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [kural({ tip: "DECISION_SELECTED", parametreler: { karar_kodu: "BILDIRIM" } })],
        verilenKararlar: [],
      }),
    );
    expect(sonuc.satirlar[0].sonuc).toBe("kaldi");
    expect(sonuc.satirlar[0].gerekce).toContain("BILDIRIM");
  });

  it("karar verildiyse DECISION_SELECTED geçer", async () => {
    const sonuc = puanla(
      girdi({
        kurallar: [kural({ tip: "DECISION_SELECTED", parametreler: { karar_kodu: "BILDIRIM" } })],
        verilenKararlar: ["BILDIRIM"],
      }),
    );
    expect(sonuc.satirlar[0].sonuc).toBe("gecti");
  });
});

describe("bulguOnerileriUret — öneri, bulgu değil (kural 11)", () => {
  it("başarısız kuraldan bağlı kontrol için öneri üretir", async () => {
    const kurallar = [
      kural({ kod: "K1", tip: "ACTION_COMPLETED_WITHIN", beklenenAksiyon: "ESKALASYON", parametreler: { dakika: 15 } }),
    ];
    const sonuc = puanla({
      kurallar,
      aksiyonlar: [aksiyon({ kod: "ESKALASYON", dakika: 42 })],
      verilenKararlar: [],
      gozlemciPuani: null,
    });

    const oneriler = bulguOnerileriUret(sonuc, kurallar, new Map([["ESKALASYON", ["ctrl-ir-002"]]]));

    expect(oneriler).toHaveLength(1);
    expect(oneriler[0].controlId).toBe("ctrl-ir-002");
    // Öneri ölçülen bir olguya dayanmalı, "sistem böyle dedi"ye değil.
    expect(oneriler[0].gerekce).toContain("42");
  });

  it("geçen kuraldan öneri üretilmez", async () => {
    const kurallar = [kural({ beklenenAksiyon: "A1" })];
    const sonuc = puanla(girdi({ kurallar }));

    expect(bulguOnerileriUret(sonuc, kurallar, new Map([["A1", ["ctrl-1"]]]))).toHaveLength(0);
  });

  it("kritik başarısızlık kritik önem üretir", async () => {
    const kurallar = [kural({ tip: "MANDATORY_FAIL_IF", beklenenAksiyon: "DELIL" })];
    const sonuc = puanla({
      kurallar,
      aksiyonlar: [aksiyon({ kod: "DELIL", tamamlandi: false, dakika: null })],
      verilenKararlar: [],
      gozlemciPuani: null,
    });

    const oneriler = bulguOnerileriUret(sonuc, kurallar, new Map([["DELIL", ["ctrl-log-001"]]]));
    expect(oneriler[0].onem).toBe("kritik");
  });

  it("kontrole bağlı olmayan aksiyondan öneri üretilmez", async () => {
    // Bağ yoksa öneri de yok: simülasyonu ana ürüne bağlayan şey o bağdır.
    const kurallar = [kural({ beklenenAksiyon: "A1" })];
    const sonuc = puanla({
      kurallar,
      aksiyonlar: [aksiyon({ tamamlandi: false, dakika: null })],
      verilenKararlar: [],
      gozlemciPuani: null,
    });

    expect(bulguOnerileriUret(sonuc, kurallar, new Map())).toHaveLength(0);
  });

  it("aynı girdi aynı önerileri verir", async () => {
    const kurallar = [kural({ beklenenAksiyon: "A1" })];
    const sonuc = puanla({
      kurallar,
      aksiyonlar: [aksiyon({ tamamlandi: false, dakika: null })],
      verilenKararlar: [],
      gozlemciPuani: null,
    });
    const harita = new Map([["A1", ["c1", "c2"]]]);

    expect(bulguOnerileriUret(sonuc, kurallar, harita)).toEqual(
      bulguOnerileriUret(sonuc, kurallar, harita),
    );
  });
});
