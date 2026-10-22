import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { latestSource } from "@/lib/document-source";

function client(count: number, fail = false) {
  const pages: number[] = [];
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: { id: "latest-job", state: "needs_review", segment_count: count, processor_version: "1.4.0" }, error: null })),
    range: vi.fn(async (offset: number) => { pages.push(offset); return { data: fail ? [] : Array.from({ length: Math.min(500, count - offset) }, (_, i) => ({ id: `s${offset + i}`, seq: offset + i, locator_key: `l${offset + i}`, content: "stored", locator: {}, method_version: "1.4.0" })), error: null }; }),
  };
  return { supabase: { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>, query, pages };
}
describe("latest stored source retrieval", () => {
  it("pages only the chosen job beyond the API row limit, never mixes older runs", async () => {
    const c = client(1201); const result = await latestSource(c.supabase, "doc");
    expect(result?.lines).toHaveLength(1201); expect(c.pages).toEqual([0, 500, 1000]);
    expect(c.query.eq).toHaveBeenCalledWith("job_id", "latest-job");
    expect(result?.segmentIds).toHaveLength(1201); expect(result?.segmentIds.at(-1)).toBe("s1200");
  });
  it("fails closed when stored segment count does not reconcile", async () => {
    const c = client(2, true); await expect(latestSource(c.supabase, "doc")).rejects.toThrow("incomplete");
  });
});