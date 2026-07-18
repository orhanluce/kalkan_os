import { describe, expect, it } from "vitest";
import { ilkOlusumlar, ttvMetrikleri } from "../aktivasyon";

// V2 PR-3b ADR-V2-5: TTV türetimi saf/deterministik; profil yoksa null.

const OLAYLAR = [
  { event_type: "PROFILE_COMPLETED", occurred_at: "2026-07-18T09:00:00Z" },
  { event_type: "FIRST_EVIDENCE", occurred_at: "2026-07-18T15:00:00Z" },
  { event_type: "FIRST_EVIDENCE", occurred_at: "2026-07-19T10:00:00Z" }, // tekrar — ilki kazanır
  { event_type: "FIRST_SOD_EVALUATION", occurred_at: "2026-07-18T11:30:00Z" },
];

describe("aktivasyon / TTV", () => {
  it("ilkOlusumlar her tür için EN ERKEN zamanı alır", () => {
    const ilk = ilkOlusumlar(OLAYLAR);
    expect(ilk.FIRST_EVIDENCE).toBe("2026-07-18T15:00:00Z"); // 19'u değil
  });

  it("TTV: profil tamamlanmasından itibaren saat hesaplar", () => {
    const m = ttvMetrikleri(OLAYLAR);
    const kanit = m.find((x) => x.anahtar === "FIRST_EVIDENCE");
    expect(kanit?.saat).toBe(6); // 09:00 → 15:00
    const sod = m.find((x) => x.anahtar === "FIRST_SOD_EVALUATION");
    expect(sod?.saat).toBe(2.5); // 09:00 → 11:30
  });

  it("olay yoksa metrik null (0 ile karışmaz — henüz ulaşılmadı)", () => {
    const m = ttvMetrikleri(OLAYLAR);
    expect(m.find((x) => x.anahtar === "FIRST_AUDIT_PACKAGE")?.saat).toBeNull();
  });

  it("profil tamamlanmamışsa TÜM metrikler null", () => {
    const m = ttvMetrikleri([{ event_type: "FIRST_EVIDENCE", occurred_at: "2026-07-18T15:00:00Z" }]);
    expect(m.every((x) => x.saat === null)).toBe(true);
  });
});
