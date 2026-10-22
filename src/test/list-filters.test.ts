import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useListFilters } from "@/components/iiaf/list-filters";
import { dateBounds, EMPTY_FILTERS, listFilterSchema, literalSearch, validateListSearch } from "@/lib/list-filters";
const router = vi.hoisted(() => ({ search: {} as Record<string, unknown>, navigate: vi.fn(async () => {}) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => router.navigate, useLocation: () => ({ pathname: "/reports", search: router.search }) }));
afterEach(() => { vi.useRealTimers(); router.search = {}; router.navigate.mockClear(); });

describe("Shared list rules", () => {
  it("preserves rapid Workshop typing across intermediate navigation and browser history", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useListFilters());
    act(() => result.current.update({ q: "W" }));
    router.search = { q: "W" }; rerender();
    act(() => { result.current.update({ q: "Work" }); result.current.update({ q: "Workshop" }); result.current.update({ status: "draft" }); });
    router.search = { q: "Work" }; rerender();
    expect(result.current.filters).toMatchObject({ q: "Workshop", status: "draft" });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(router.navigate).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ q: "Workshop", status: "draft", page: 1 }) }));
    router.search = { q: "Workshop", status: "draft" }; rerender();
    router.search = {}; rerender();
    expect(result.current.filters).toEqual(EMPTY_FILTERS);
  });
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