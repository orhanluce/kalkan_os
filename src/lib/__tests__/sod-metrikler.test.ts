// M16 #8: SoD üretim panosu metrikleri — saf/deterministik (kural 11).
import { describe, expect, it } from "vitest";
import { sodMetrikleriHesapla } from "../sod-metrikler";

const SIMDI = new Date("2026-07-18T12:00:00Z");

function temelGirdi() {
  return {
    kurallar: [
      { id: "k1", durum: "aktif", mevzuat_durumu: "VERIFIED" },
      { id: "k2", durum: "aktif", mevzuat_durumu: "TODO_DOGRULA" },
      { id: "k3", durum: "aktif", mevzuat_durumu: "INTERNAL" },
      { id: "k4", durum: "pasif", mevzuat_durumu: "VERIFIED" },
    ],
    tamTanimliKuralIdleri: new Set(["k1", "k2"]), // k3 aktif ama tarafları eksik
    atamalar: [
      { kisiKimligi: "u1", gecerlilik_bitis: null },
      { kisiKimligi: "u1", gecerlilik_bitis: "2026-12-31" },
      { kisiKimligi: "u2", gecerlilik_bitis: "2026-08-01" },
      { kisiKimligi: "u3", gecerlilik_bitis: "2026-07-01" }, // sona ermiş
    ],
    catismalar: [
      { durum: "OPEN", ilk_gorulme_at: "2026-07-10T00:00:00Z" },
      { durum: "REOPENED", ilk_gorulme_at: "2026-07-17T00:00:00Z" },
      { durum: "EXCEPTION_APPROVED", ilk_gorulme_at: "2026-07-01T00:00:00Z" },
      { durum: "RESOLVED", ilk_gorulme_at: "2026-06-01T00:00:00Z" },
      { durum: "UNDER_REVIEW", ilk_gorulme_at: "2026-07-18T09:00:00Z" },
    ],
    istisnalar: [
      { durum: "onaylandi", bitis: "2026-07-25" }, // 7 gün — yaklaşan
      { durum: "onaylandi", bitis: "2026-12-01" }, // uzak
      { durum: "suresi_doldu", bitis: "2026-07-10" }, // dolmuş — sayılmaz
      { durum: "talep_edildi", bitis: "2026-07-20" }, // henüz onaylı değil
    ],
    sonImport: { created_at: "2026-07-15T00:00:00Z", kaynak: "hr" },
  };
}

describe("sodMetrikleriHesapla", () => {
  it("kapsama: aktif kural / eksik tanım / aktif-sona ermiş atama / kişi sayısı", () => {
    const m = sodMetrikleriHesapla(temelGirdi(), SIMDI);
    expect(m.kapsama.aktifKural).toBe(3); // pasif sayılmaz
    expect(m.kapsama.eksikTanimliKural).toBe(1); // k3 değerlendirilemiyor
    expect(m.kapsama.aktifAtama).toBe(3);
    expect(m.kapsama.sonaErmisAtama).toBe(1);
    expect(m.kapsama.kisiSayisi).toBe(2); // u1, u2 (u3'ün ataması sona ermiş)
  });

  it("mevzuat dağılımı yalnız AKTİF kurallar üzerinden (pasif VERIFIED şişirmez)", () => {
    const m = sodMetrikleriHesapla(temelGirdi(), SIMDI);
    expect(m.mevzuat).toEqual({ verified: 1, todoDogrula: 1, internal: 1 });
  });

  it("çatışma grupları: durumlar birleştirilmez, gruplar yalnız sunum", () => {
    const m = sodMetrikleriHesapla(temelGirdi(), SIMDI);
    expect(m.catisma.acik).toBe(2); // OPEN + REOPENED
    expect(m.catisma.incelemede).toBe(1);
    expect(m.catisma.kontrolAltinda).toBe(1);
    expect(m.catisma.kapali).toBe(1);
    expect(m.catisma.dagilim.OPEN).toBe(1); // ham dağılım da erişilebilir
  });

  it("yaklaşan istisna: yalnız onaylı VE 14 gün penceresinde", () => {
    const m = sodMetrikleriHesapla(temelGirdi(), SIMDI);
    expect(m.yaklasanIstisna).toBe(1);
  });

  it("import sonrası yeni çatışma: son import'tan SONRA ilk görülenler", () => {
    const m = sodMetrikleriHesapla(temelGirdi(), SIMDI);
    // 17 Tem REOPENED + 18 Tem UNDER_REVIEW > 15 Tem import.
    expect(m.importSonrasiYeniCatisma).toBe(2);
  });

  it("henüz import yoksa null — 0 ile KARIŞTIRILMAZ (belirsizlik görünür)", () => {
    const m = sodMetrikleriHesapla({ ...temelGirdi(), sonImport: null }, SIMDI);
    expect(m.importSonrasiYeniCatisma).toBeNull();
  });

  it("deterministik: aynı girdi + aynı simdi → aynı sonuç (kural 11)", () => {
    expect(sodMetrikleriHesapla(temelGirdi(), SIMDI)).toEqual(sodMetrikleriHesapla(temelGirdi(), SIMDI));
  });
});
