import { describe, it, expect } from "vitest";
import { diffSnapshots, type Snapshot } from "../lib/audit-diff";
const row: Snapshot = {
  key: "stock:1:1",
  category: "stock",
  subject: "Produit · Paris",
  value: "Disponible : 10",
};
describe("audit snapshot comparison", () => {
  it("does not call the initial import a product creation", () => {
    expect(diffSnapshots([], [row], true)[0].action).toBe("État initial");
  });
  it("records no event for unchanged data", () => {
    expect(diffSnapshots([row], [{ ...row }], false)).toEqual([]);
  });
  it("retains before and after values for a stock decrease", () => {
    const e = diffSnapshots(
      [row],
      [{ ...row, value: "Disponible : 3" }],
      false,
    )[0];
    expect(e.details).toContain("10");
    expect(e.details).toContain("3");
    expect(e.action).toBe("Modification détectée");
  });
  it("distinguishes absence from proven deletion", () => {
    expect(diffSnapshots([row], [], false)[0].action).toBe("Absence détectée");
  });
  it("separates stock levels with the same product label", () => {
    expect(
      diffSnapshots([row], [row, { ...row, key: "stock:1:2" }], false),
    ).toHaveLength(1);
  });
});
