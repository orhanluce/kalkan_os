// K2 §8/§15 — alarm eşiklerinin saf değerlendirmesi (harici alarm servisi
// YOK, yalnız deterministik yerel mantık — kural 11).
import { describe, expect, it } from "vitest";
import {
  LEDGER_OUTBOX_ESIKLERI,
  ledgerOutboxAlarmDegerlendir,
  type LedgerOutboxSaglikOzeti,
} from "../ledger-outbox-saglik";

const temiz: LedgerOutboxSaglikOzeti = {
  kapsam: "TENANT",
  pendingSayisi: 0,
  staleProcessingSayisi: 0,
  processingSayisi: 0,
  failedSayisi: 0,
  enEskiPendingYasSaniye: null,
  jobTuruBazinda: {},
};

describe("ledgerOutboxAlarmDegerlendir", () => {
  it("her şey temizse hiçbir alarm tetiklenmez", () => {
    const durum = ledgerOutboxAlarmDegerlendir(temiz);
    expect(durum.aktifAlarmlar).toHaveLength(0);
  });

  it("eski PENDING kayıt eşiği aşınca ESKI_PENDING tetiklenir", () => {
    const durum = ledgerOutboxAlarmDegerlendir({
      ...temiz,
      pendingSayisi: 1,
      enEskiPendingYasSaniye: LEDGER_OUTBOX_ESIKLERI.pendingYasEsigiSaniye + 1,
      // consumer çalışıyor gibi görünsün diye (CONSUMER_HIC_CALISMAMIS'ı
      // AYRI test ediyoruz, burada onunla karışmasın):
      processingSayisi: 1,
    });
    expect(durum.aktifAlarmlar).toContain("ESKI_PENDING");
  });

  it("eşiğin ALTINDAKİ yaş alarm üretmez", () => {
    const durum = ledgerOutboxAlarmDegerlendir({
      ...temiz,
      pendingSayisi: 1,
      enEskiPendingYasSaniye: LEDGER_OUTBOX_ESIKLERI.pendingYasEsigiSaniye - 1,
    });
    expect(durum.aktifAlarmlar).not.toContain("ESKI_PENDING");
  });

  it("stale PROCESSING varsa STALE_PROCESSING tetiklenir", () => {
    const durum = ledgerOutboxAlarmDegerlendir({ ...temiz, staleProcessingSayisi: 2 });
    expect(durum.aktifAlarmlar).toContain("STALE_PROCESSING");
  });

  it("FAILED kaydı varsa FAILED_BACKLOG tetiklenir", () => {
    const durum = ledgerOutboxAlarmDegerlendir({ ...temiz, failedSayisi: 1 });
    expect(durum.aktifAlarmlar).toContain("FAILED_BACKLOG");
  });

  it("önceki ölçüm verilmezse BACKLOG_SICRAMASI değerlendirilmez (uydurulmaz)", () => {
    const durum = ledgerOutboxAlarmDegerlendir({ ...temiz, pendingSayisi: 100 });
    expect(durum.aktifAlarmlar).not.toContain("BACKLOG_SICRAMASI");
  });

  it("önceki ölçüme göre ani artış BACKLOG_SICRAMASI tetikler", () => {
    const durum = ledgerOutboxAlarmDegerlendir({ ...temiz, pendingSayisi: 30 }, LEDGER_OUTBOX_ESIKLERI, 5);
    expect(durum.aktifAlarmlar).toContain("BACKLOG_SICRAMASI");
  });

  it("küçük artış BACKLOG_SICRAMASI tetiklemez", () => {
    const durum = ledgerOutboxAlarmDegerlendir({ ...temiz, pendingSayisi: 10 }, LEDGER_OUTBOX_ESIKLERI, 5);
    expect(durum.aktifAlarmlar).not.toContain("BACKLOG_SICRAMASI");
  });

  it("pending var ama hiç işlenme izi yoksa ve eski ise CONSUMER_HIC_CALISMAMIS tetiklenir", () => {
    const durum = ledgerOutboxAlarmDegerlendir({
      ...temiz,
      pendingSayisi: 3,
      processingSayisi: 0,
      failedSayisi: 0,
      enEskiPendingYasSaniye: LEDGER_OUTBOX_ESIKLERI.pendingYasEsigiSaniye + 100,
    });
    expect(durum.aktifAlarmlar).toContain("CONSUMER_HIC_CALISMAMIS");
  });

  it("deterministik: aynı girdi aynı sonucu verir (kural 11)", () => {
    const girdi: LedgerOutboxSaglikOzeti = { ...temiz, pendingSayisi: 5, failedSayisi: 2 };
    const a = ledgerOutboxAlarmDegerlendir(girdi);
    const b = ledgerOutboxAlarmDegerlendir(girdi);
    expect(a).toEqual(b);
  });
});
