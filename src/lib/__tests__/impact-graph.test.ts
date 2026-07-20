import { describe, expect, it } from "vitest";
import { etkiGrafiProjekteEt, etkiYayilimi, tekNoktaTespitiTamGraf, type EtkiGrafGirdisi } from "../impact-graph";

function bosGirdi(over: Partial<EtkiGrafGirdisi> = {}): EtkiGrafGirdisi {
  return {
    kritikHizmetler: [],
    bagimliliklar: [],
    ucuncuTaraflar: [],
    altYukleniciler: [],
    ictHizmetleri: [],
    kontroller: [],
    mevzuatlar: [],
    testler: [],
    bulgular: [],
    kanitlar: [],
    kritikHizmetUcuncuTaraf: [],
    ucuncuTarafIctHizmeti: [],
    kritikHizmetKontrol: [],
    mevzuatKontrol: [],
    testKanit: [],
    ...over,
  };
}

describe("etkiGrafiProjekteEt", () => {
  it("izole düğümler de (kenarsız) grafta görünür — sessiz kayıp yok", () => {
    const graf = etkiGrafiProjekteEt(bosGirdi({ kritikHizmetler: [{ id: "h1", ad: "Ödeme" }] }));
    expect(graf.dugumler).toHaveLength(1);
    expect(graf.dugumler[0]).toEqual({ id: "KRITIK_HIZMET:h1", tur: "KRITIK_HIZMET", etiket: "Ödeme", bilinmiyor: false });
    expect(graf.kenarlar).toHaveLength(0);
  });

  it("bilinmeyen alt yüklenici ad UYDURMAZ, 'Bilinmiyor' yer tutucusu + bilinmiyor:true taşır", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
        altYukleniciler: [{ id: "a1", thirdPartyId: "t1", ad: null, bilinmiyor: true }],
      }),
    );
    const altYuklenici = graf.dugumler.find((d) => d.id === "ALT_YUKLENICI:a1")!;
    expect(altYuklenici.etiket).toBe("Bilinmiyor");
    expect(altYuklenici.bilinmiyor).toBe(true);
  });

  it("aynı kenarı besleyen iki kaynak (sözleşme eşleme + bağımlılık) TEK kenarda birleşir, kaynaklar[] ikisini de taşır", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kritikHizmetler: [{ id: "h1", ad: "Ödeme" }],
        ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
        kritikHizmetUcuncuTaraf: [
          { kritikHizmetId: "h1", thirdPartyId: "t1", kaynak: "SOZLESME_ESLEME" },
          { kritikHizmetId: "h1", thirdPartyId: "t1", kaynak: "BAGIMLILIK" },
        ],
      }),
    );
    expect(graf.kenarlar).toHaveLength(1);
    expect(graf.kenarlar[0].kaynaklar).toEqual(["BAGIMLILIK", "SOZLESME_ESLEME"]);
  });

  it("testDefinitionId null olan bulgu graf kenarı üretmez (kaynaksız bağlantı uydurulmaz)", () => {
    const graf = etkiGrafiProjekteEt(bosGirdi({ bulgular: [{ id: "b1", testDefinitionId: null, baslik: "Serbest bulgu" }] }));
    expect(graf.dugumler.find((d) => d.id === "BULGU:b1")).toBeDefined();
    expect(graf.kenarlar).toHaveLength(0);
  });

  it("kanıt hash'i yoksa (null) düğüm bilinmiyor:true ile yer tutucu taşır", () => {
    const graf = etkiGrafiProjekteEt(bosGirdi({ kanitlar: [{ id: "k1", hashSha256: null }] }));
    const kanit = graf.dugumler.find((d) => d.id === "KANIT:k1")!;
    expect(kanit.bilinmiyor).toBe(true);
    expect(kanit.etiket).toBe("Bilinmiyor");
  });

  it("çıktı deterministiktir (aynı girdi aynı sonuç, sıra tur+id'ye göre)", () => {
    const girdi = bosGirdi({
      kritikHizmetler: [
        { id: "h2", ad: "B" },
        { id: "h1", ad: "A" },
      ],
    });
    const g1 = etkiGrafiProjekteEt(girdi);
    const g2 = etkiGrafiProjekteEt(girdi);
    expect(g1).toEqual(g2);
    expect(g1.dugumler.map((d) => d.id)).toEqual(["KRITIK_HIZMET:h1", "KRITIK_HIZMET:h2"]);
  });

  it("AYNI normalize adlı (trim+küçük harf) iki farklı service_dependencies satırı TEK BAGIMLILIK düğümünde birleşir (tekilNoktaAnalizi'nin M13 kuralı)", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kritikHizmetler: [
          { id: "h1", ad: "Ödeme" },
          { id: "h2", ad: "Takas" },
        ],
        bagimliliklar: [
          { id: "d1", kritikHizmetId: "h1", ad: "Ana Veri Merkezi", tekilNokta: false },
          { id: "d2", kritikHizmetId: "h2", ad: "  ana veri merkezi  ", tekilNokta: false },
        ],
      }),
    );
    const bagimlilikDugumleri = graf.dugumler.filter((d) => d.tur === "BAGIMLILIK");
    expect(bagimlilikDugumleri).toHaveLength(1);
    expect(bagimlilikDugumleri[0].etiket).toBe("Ana Veri Merkezi");
    const kenarlarBuNokataya = graf.kenarlar.filter((k) => k.hedefId === bagimlilikDugumleri[0].id);
    expect(kenarlarBuNokataya).toHaveLength(2);
  });

  it("tam zincir: kritik hizmet → kontrol → test → bulgu/kanıt + mevzuat → kontrol doğru kenarları üretir", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kritikHizmetler: [{ id: "h1", ad: "Ödeme" }],
        kontroller: [{ id: "c1", maddeRef: "M.1" }],
        mevzuatlar: [{ id: "m1", kod: "DORA-1" }],
        testler: [{ id: "t1", controlId: "c1", ad: "Test 1" }],
        bulgular: [{ id: "b1", testDefinitionId: "t1", baslik: "Açık bulgu" }],
        kanitlar: [{ id: "e1", hashSha256: "a".repeat(64) }],
        kritikHizmetKontrol: [{ kritikHizmetId: "h1", controlId: "c1" }],
        mevzuatKontrol: [{ obligationId: "m1", controlId: "c1" }],
        testKanit: [{ testDefinitionId: "t1", evidenceId: "e1" }],
      }),
    );
    const kenarTurleri = graf.kenarlar.map((k) => `${k.kaynakId}->${k.hedefId}:${k.tur}`);
    expect(kenarTurleri).toEqual(
      [
        "KONTROL:c1->TEST:t1:KONTROL_TEST",
        "KRITIK_HIZMET:h1->KONTROL:c1:HIZMET_KONTROL",
        "MEVZUAT:m1->KONTROL:c1:MEVZUAT_KONTROL",
        "TEST:t1->BULGU:b1:TEST_BULGU",
        "TEST:t1->KANIT:e1:TEST_KANIT",
      ].sort(),
    );
  });

  it("kapatmaRetestTestDefinitionId atlanırsa (undefined) mevcut sonuçlar BİREBİR AYNI kalır (geriye dönük uyumluluk, Dikey F)", () => {
    const ortak = {
      kontroller: [{ id: "c1", maddeRef: "M.1" }],
      testler: [{ id: "t1", controlId: "c1", ad: "Test 1" }],
      bulgular: [{ id: "b1", testDefinitionId: "t1", baslik: "Açık bulgu" }],
    };
    const eski = etkiGrafiProjekteEt(bosGirdi(ortak));
    const yeni = etkiGrafiProjekteEt(
      bosGirdi({ ...ortak, bulgular: [{ ...ortak.bulgular[0], kapatmaRetestTestDefinitionId: undefined }] }),
    );
    expect(yeni).toEqual(eski);
  });

  it("kapatmaRetestTestDefinitionId verilince BULGU'dan mevcut TEST düğümüne kenar üretir — yeni düğüm türü AÇILMAZ", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kontroller: [{ id: "c1", maddeRef: "M.1" }],
        testler: [{ id: "t1", controlId: "c1", ad: "Test 1" }],
        bulgular: [{ id: "b1", testDefinitionId: "t1", baslik: "Açık bulgu", kapatmaRetestTestDefinitionId: "t1" }],
      }),
    );
    expect(graf.kenarlar).toContainEqual({
      kaynakId: "BULGU:b1",
      hedefId: "TEST:t1",
      tur: "BULGU_RETEST",
      kaynaklar: ["findings"],
    });
    // Kapalı/retestli bulgu grafiktan silinmez — TEST_BULGU kenarı da KORUNUR.
    expect(graf.kenarlar).toContainEqual({
      kaynakId: "TEST:t1",
      hedefId: "BULGU:b1",
      tur: "TEST_BULGU",
      kaynaklar: ["findings"],
    });
  });

  it("retest ilişkisi olmayan bulgu BULGU_RETEST kenarı üretmez", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kontroller: [{ id: "c1", maddeRef: "M.1" }],
        testler: [{ id: "t1", controlId: "c1", ad: "Test 1" }],
        bulgular: [{ id: "b1", testDefinitionId: "t1", baslik: "Açık bulgu" }],
      }),
    );
    expect(graf.kenarlar.some((k) => k.tur === "BULGU_RETEST")).toBe(false);
  });

  it("tedarikciBulgulari atlanırsa (undefined) mevcut sonuçlar BİREBİR AYNI kalır (geriye dönük uyumluluk, Dikey E)", () => {
    const girdiOrtak = {
      kritikHizmetler: [{ id: "h1", ad: "Ödeme" }],
      ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
      kritikHizmetUcuncuTaraf: [{ kritikHizmetId: "h1", thirdPartyId: "t1", kaynak: "SOZLESME_ESLEME" as const }],
    };
    const grafEski = etkiGrafiProjekteEt(bosGirdi(girdiOrtak));
    const grafYeni = etkiGrafiProjekteEt(bosGirdi({ ...girdiOrtak, tedarikciBulgulari: undefined }));
    expect(grafYeni).toEqual(grafEski);
  });

  it("tedarikciBulgulari verilince UCUNCU_TARAF'tan AYRI bir TEDARIKCI_BULGUSU düğümüne kenar üretir — M12'nin BULGU türüyle karışmaz", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
        tedarikciBulgulari: [{ id: "f1", thirdPartyId: "t1", baslik: "Şifreleme eksik" }],
      }),
    );
    const dugum = graf.dugumler.find((d) => d.id === "TEDARIKCI_BULGUSU:f1")!;
    expect(dugum).toEqual({ id: "TEDARIKCI_BULGUSU:f1", tur: "TEDARIKCI_BULGUSU", etiket: "Şifreleme eksik", bilinmiyor: false });
    expect(graf.kenarlar).toContainEqual({
      kaynakId: "UCUNCU_TARAF:t1",
      hedefId: "TEDARIKCI_BULGUSU:f1",
      tur: "UCUNCU_TARAF_TEDARIKCI_BULGUSU",
      kaynaklar: ["assessment_findings"],
    });
  });

  it("tedarikçi bulgusu düğümü etki yayılımına (etkiYayilimi) katılır", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kritikHizmetler: [{ id: "h1", ad: "Ödeme" }],
        ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
        kritikHizmetUcuncuTaraf: [{ kritikHizmetId: "h1", thirdPartyId: "t1", kaynak: "SOZLESME_ESLEME" as const }],
        tedarikciBulgulari: [{ id: "f1", thirdPartyId: "t1", baslik: "Şifreleme eksik" }],
      }),
    );
    const sonuc = etkiYayilimi(["KRITIK_HIZMET:h1"], graf, "ileri");
    expect(sonuc.etkilenenler.map((e) => e.dugumId)).toContain("TEDARIKCI_BULGUSU:f1");
  });

  it("telafiEdiciKontrolId atlanırsa (undefined) mevcut sonuçlar BİREBİR AYNI kalır (Dikey E2, geriye dönük uyumluluk)", () => {
    const ortak = {
      ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
      tedarikciBulgulari: [{ id: "f1", thirdPartyId: "t1", baslik: "Şifreleme eksik" }],
    };
    const eski = etkiGrafiProjekteEt(bosGirdi(ortak));
    const yeni = etkiGrafiProjekteEt(bosGirdi({ ...ortak, tedarikciBulgulari: [{ ...ortak.tedarikciBulgulari[0], telafiEdiciKontrolId: undefined }] }));
    expect(yeni).toEqual(eski);
  });

  it("telafiEdiciKontrolId verilince TEDARIKCI_BULGUSU'ndan mevcut KONTROL düğümüne kenar üretir — YENİ düğüm türü AÇILMAZ", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
        kontroller: [{ id: "c1", maddeRef: "M.1" }],
        tedarikciBulgulari: [{ id: "f1", thirdPartyId: "t1", baslik: "Şifreleme eksik", telafiEdiciKontrolId: "c1" }],
      }),
    );
    expect(graf.kenarlar).toContainEqual({
      kaynakId: "TEDARIKCI_BULGUSU:f1",
      hedefId: "KONTROL:c1",
      tur: "TEDARIKCI_BULGUSU_TELAFI_KONTROLU",
      kaynaklar: ["assessment_finding_compensating_controls"],
    });
  });

  it("telafi kontrolüne bağlanan kontrolün MEVCUT test/kanıt zinciri tekrar üretilmeden yayılıma dahil olur", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
        kontroller: [{ id: "c1", maddeRef: "M.1" }],
        testler: [{ id: "test1", controlId: "c1", ad: "Test 1" }],
        kanitlar: [{ id: "e1", hashSha256: "a".repeat(64) }],
        testKanit: [{ testDefinitionId: "test1", evidenceId: "e1" }],
        tedarikciBulgulari: [{ id: "f1", thirdPartyId: "t1", baslik: "Şifreleme eksik", telafiEdiciKontrolId: "c1" }],
      }),
    );
    const sonuc = etkiYayilimi(["TEDARIKCI_BULGUSU:f1"], graf, "ileri");
    const idler = sonuc.etkilenenler.map((e) => e.dugumId);
    expect(idler).toContain("KONTROL:c1");
    expect(idler).toContain("TEST:test1");
    expect(idler).toContain("KANIT:e1");
  });
});

describe("tekNoktaTespitiTamGraf", () => {
  it("tek kritik hizmete bağlı bir düğüm sistemik tekil nokta SAYILMAZ", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kritikHizmetler: [{ id: "h1", ad: "Ödeme" }],
        bagimliliklar: [{ id: "d1", kritikHizmetId: "h1", ad: "Ana Veri Merkezi", tekilNokta: false }],
      }),
    );
    const sonuc = tekNoktaTespitiTamGraf(graf);
    expect(sonuc.sistemikNoktalar).toHaveLength(0);
  });

  it("iki kritik hizmetin AYNI bağımlılık adını paylaşması (1-hop, tekilNoktaAnalizi'nin M13 senaryosu) sistemik tekil nokta yakalar", () => {
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kritikHizmetler: [
          { id: "h1", ad: "Ödeme" },
          { id: "h2", ad: "Takas" },
        ],
        bagimliliklar: [
          { id: "d1", kritikHizmetId: "h1", ad: "Ana Veri Merkezi", tekilNokta: false },
          { id: "d2", kritikHizmetId: "h2", ad: "Ana Veri Merkezi", tekilNokta: false },
        ],
      }),
    );
    const sonuc = tekNoktaTespitiTamGraf(graf);
    expect(sonuc.sistemikNoktalar).toHaveLength(1);
    expect(sonuc.sistemikNoktalar[0].tur).toBe("BAGIMLILIK");
    expect(sonuc.sistemikNoktalar[0].etkilenenKritikHizmetIdleri).toEqual(["KRITIK_HIZMET:h1", "KRITIK_HIZMET:h2"]);
  });

  it("iki farklı kritik hizmetin paylaştığı ÇOK-ATLAMALI (2-hop) düğüm sistemik tekil nokta olarak yakalanır", () => {
    // h1 ve h2 -> aynı üçüncü taraf t1 -> alt yüklenici a1 (2 atlamalı paylaşım,
    // ne tekilNoktaAnalizi (yalnız service_dependencies) ne konsantrasyonAnalizi
    // (yalnız third_party bazlı) bu BİRLEŞİK zinciri tek başına yakalayamazdı.
    const graf = etkiGrafiProjekteEt(
      bosGirdi({
        kritikHizmetler: [
          { id: "h1", ad: "Ödeme" },
          { id: "h2", ad: "Takas" },
        ],
        ucuncuTaraflar: [{ id: "t1", ad: "Bulut A.Ş." }],
        altYukleniciler: [{ id: "a1", thirdPartyId: "t1", ad: "Alt Bulut", bilinmiyor: false }],
        kritikHizmetUcuncuTaraf: [
          { kritikHizmetId: "h1", thirdPartyId: "t1", kaynak: "SOZLESME_ESLEME" },
          { kritikHizmetId: "h2", thirdPartyId: "t1", kaynak: "SOZLESME_ESLEME" },
        ],
      }),
    );
    const sonuc = tekNoktaTespitiTamGraf(graf);
    const dugumIdleri = sonuc.sistemikNoktalar.map((s) => s.dugumId);
    expect(dugumIdleri).toContain("UCUNCU_TARAF:t1");
    expect(dugumIdleri).toContain("ALT_YUKLENICI:a1");
    const altYuklenici = sonuc.sistemikNoktalar.find((s) => s.dugumId === "ALT_YUKLENICI:a1")!;
    expect(altYuklenici.etkilenenKritikHizmetIdleri).toEqual(["KRITIK_HIZMET:h1", "KRITIK_HIZMET:h2"]);
  });

  it("hesaplamaYontemi her zaman döner (kesinlik uydurma yok, yöntem ayrı gösterilir)", () => {
    const sonuc = tekNoktaTespitiTamGraf(etkiGrafiProjekteEt(bosGirdi()));
    expect(sonuc.hesaplamaYontemi.length).toBeGreaterThan(0);
  });
});

describe("etkiYayilimi", () => {
  const graf = etkiGrafiProjekteEt(
    bosGirdi({
      kritikHizmetler: [{ id: "h1", ad: "Ödeme" }],
      kontroller: [{ id: "c1", maddeRef: "M.1" }],
      testler: [{ id: "t1", controlId: "c1", ad: "Test 1" }],
      bulgular: [{ id: "b1", testDefinitionId: "t1", baslik: "Açık bulgu" }],
      kritikHizmetKontrol: [{ kritikHizmetId: "h1", controlId: "c1" }],
    }),
  );

  it("'ileri' yön kenar yönünde ilerler: KONTROL -> TEST -> BULGU (kanıt zinciri)", () => {
    const sonuc = etkiYayilimi(["KONTROL:c1"], graf, "ileri");
    const idler = sonuc.etkilenenler.map((e) => e.dugumId);
    expect(idler).toEqual(["TEST:t1", "BULGU:b1"]);
    expect(sonuc.etkilenenler.find((e) => e.dugumId === "BULGU:b1")!.hopSayisi).toBe(2);
  });

  it("'geri' yön kenara TERS ilerler: KONTROL <- KRITIK_HIZMET (bozulursa etkilenen hizmet)", () => {
    const sonuc = etkiYayilimi(["KONTROL:c1"], graf, "geri");
    const idler = sonuc.etkilenenler.map((e) => e.dugumId);
    expect(idler).toEqual(["KRITIK_HIZMET:h1"]);
  });

  it("izin verilmeyen/kopuk bir düğümden yayılım boş döner (bağlantı uydurulmaz)", () => {
    const sonuc = etkiYayilimi(["KRITIK_HIZMET:yok"], graf, "ileri");
    expect(sonuc.etkilenenler).toHaveLength(0);
  });

  it("döngü koruması: kendine referans veren bir graf sonsuz döngüye girmez", () => {
    const dongusuzGraf = {
      dugumler: [
        { id: "A", tur: "KONTROL" as const, etiket: "A", bilinmiyor: false },
        { id: "B", tur: "TEST" as const, etiket: "B", bilinmiyor: false },
      ],
      kenarlar: [
        { kaynakId: "A", hedefId: "B", tur: "KONTROL_TEST" as const, kaynaklar: ["x"] },
        { kaynakId: "B", hedefId: "A", tur: "KONTROL_TEST" as const, kaynaklar: ["x"] },
      ],
    };
    const sonuc = etkiYayilimi(["A"], dongusuzGraf, "ileri");
    expect(sonuc.etkilenenler.map((e) => e.dugumId)).toEqual(["B"]);
  });

  it("deterministik: aynı başlangıç+graf aynı sonucu üretir", () => {
    const s1 = etkiYayilimi(["KONTROL:c1"], graf, "ileri");
    const s2 = etkiYayilimi(["KONTROL:c1"], graf, "ileri");
    expect(s1).toEqual(s2);
  });
});
