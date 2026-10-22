import { describe, it, expect } from "vitest";
import { mappingCards, consolidatedReview } from "@/lib/destination-map";

const out = (o: object) => ({ type: "extraction_review", name: "Stored extraction review", title: "t", body: "[p1] Hello", contract: { template: null, mimeType: "text/markdown", dimensions: null, approver: null, release: "not_authorized" }, ...o }) as never;
describe("mapping truthfulness", () => {
  it("a proposed fact is review-required, never approved", () => {
    const c = mappingCards(null, { facts: [{ id: "f", source_label: "Venue", extracted_value: "Hall", state: "proposed", locator_key: "p1", canonical_field: null }], relationships: [] });
    expect(c[0]!.status).toBe("Review required"); expect(c[0]!.destinationCode).toBe("DST-001");
  });
  it("a requested output that was not produced is reported, not claimed", () => {
    const c = mappingCards({ outputs: [], skipped: [] }, null, ["OUT-009"]);
    expect(c[0]!.status).toBe("Unsupported"); expect(c[0]!.created).toBe(false);
  });
  it("an unapproved relationship is a candidate, not persisted-approved", () => {
    const c = mappingCards(null, { facts: [], relationships: [{ id: "r", relation_type: "conflicts_with", target_type: "fact", target_label: "x", rule_id: "R1", status: "proposed" }] });
    expect(c[0]!.status).toBe("Candidate mapping");
  });
  it("combined review keeps each file's name on every line", () => {
    const t = consolidatedReview([{ name: "a.pdf", documentId: "1", set: { outputs: [out({})], skipped: [] } }, { name: "b.pdf", documentId: "2", set: { outputs: [out({ body: "[r1] Bye" })], skipped: [] } }]);
    expect(t).toContain("[a.pdf] [p1] Hello"); expect(t).toContain("[b.pdf] [r1] Bye");
  });
});
