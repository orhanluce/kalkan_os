import { describe, expect, it } from "vitest";
import { regulatedEntitySelectionRequired, regulatorTypesForEntities } from "../regulatory-scope";

describe("regulated kurum profili", () => {
  it("kurum alt türlerinden düzenleyicileri deterministik ve tekil türetir", () => {
    expect(regulatorTypesForEntities(["ARACI_KURUM", "BANKA", "PORTFOY_YONETIM_SIRKETI"])).toEqual([
      "BDDK",
      "SPK",
    ]);
  });

  it("yalnız regulated ve karma profilde kesin alt tür ister", () => {
    expect(regulatedEntitySelectionRequired("REGULATED_FINANCIAL_INSTITUTION")).toBe(true);
    expect(regulatedEntitySelectionRequired("MIXED_GROUP")).toBe(true);
    expect(regulatedEntitySelectionRequired("CORPORATE_FINANCE")).toBe(false);
  });
});
