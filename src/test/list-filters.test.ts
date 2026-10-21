import { describe, expect, it } from "vitest";
import { dateBounds, EMPTY_FILTERS, listFilterSchema, literalSearch, validateListSearch } from "@/lib/list-filters";

describe("Shared list rules", () => {
  it("keeps created, uploaded and generated dates distinct", () => {
    expect(["created", "uploaded", "generated"].map(dateField => listFilterSchema.parse({ dateField }).dateField)).toEqual(["created", "uploaded", "generated"]);
  });
  it("includes the whole through-date in UTC", () => {
    expect(dateBounds({ from: "2026-10-21", to: "2026-10-21" })).toEqual({ start: "2026-10-21T00:00:00.000Z", end: "2026-10-22T00:00:00.000Z" });
  });
  it("rejects reversed and nonexistent calendar dates", () => {
    expect(() => dateBounds({ from: "2026-10-22", to: "2026-10-21" })).toThrow();
    expect(() => dateBounds({ from: "2026-02-30", to: "" })).toThrow();
  });
  it("retains combined predicates and resets all filters", () => {
    expect(validateListSearch({ q: "poster", status: "draft", type: "linkedin", from: "2026-10-21", page: 2 })).toMatchObject({ q: "poster", status: "draft", type: "linkedin", from: "2026-10-21", page: 2 });
    expect(validateListSearch(EMPTY_FILTERS)).toEqual(EMPTY_FILTERS);
  });
  it("does not let search text inject query predicates", () => {
    expect(literalSearch("poster%,organization_id.eq.(other)")).toBe("poster  organization id eq  other");
  });
});