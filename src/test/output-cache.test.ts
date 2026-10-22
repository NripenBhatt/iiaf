import { describe, it, expect } from "vitest";
import { confirmedCacheWinner } from "@/lib/output-cache";
const set = { outputs: [], skipped: [], limitations: ["draft"], segmentCount: 2 };
describe("output duplicate winner readback", () => {
  it("returns the persisted equal winner and its timestamp", () => { expect(confirmedCacheWinner(set, { outputs: set, source_version: "1.4:2.2", created_at: "2026-10-22" }, "1.4:2.2")).toMatchObject({ cached: true, createdAt: "2026-10-22", segmentCount: 2 }); });
  it("rejects a different persisted body", () => { expect(() => confirmedCacheWinner(set, { outputs: { ...set, segmentCount: 3 }, source_version: "v", created_at: "t" }, "v")).toThrow("conflict"); });
  it("rejects another source version", () => { expect(() => confirmedCacheWinner(set, { outputs: set, source_version: "old", created_at: "t" }, "v")).toThrow("conflict"); });
  it("fails closed when RLS/readback cannot supply a winner", () => { expect(() => confirmedCacheWinner(set, null, "v")).toThrow("could not be read"); });
});