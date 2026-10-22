import { describe, it, expect } from "vitest";
import { buildKnowledgeBundle, knowledgeQuerySchema, type KnowledgeDocument, type KnowledgeFact } from "@/lib/knowledge";

const org = "b655c3a9-329b-41ec-87c0-d5cb68c55790";
const docs: KnowledgeDocument[] = ["2025", "2026", null].map((period, i) => ({ id: `d${i}`, organization_id: org, original_filename: `synthetic-${i}.txt`, reporting_period: period, department_or_owner: "IQAC", sha256_hash: `hash${i}`, processing_status: "needs_review", uploaded_at: "2026-10-22" }));
const facts: KnowledgeFact[] = docs.map((d, i) => ({ id: `f${i}`, organization_id: org, document_id: d.id, source_label: "Students", canonical_field: "students", extracted_value: String(10 + i), reviewed_value: null, state: "proposed", integrity: "verified_source", locator_key: `line${i}`, locator: { line: i }, segment_id: `s${i}` }));
const make = (period = "", overrides: Partial<Parameters<typeof buildKnowledgeBundle>[0]> = {}) => buildKnowledgeBundle({ scope: knowledgeQuerySchema.parse({ organizationId: org, period }), documents: docs, passages: docs.map((d, i) => ({ documentId: d.id, jobId: `j${i}`, locatorKey: `line${i}`, locator: { line: i }, content: "Students data", method: "native", parserVersion: "1.4", seq: i })), facts, conflicts: [{ id: "c1", source_id: "f0", target_id: "f1", status: "proposed" }], currentSegmentIds: ["s1"], organizationName: "IIAF Test University A SYNTHETIC DEMO", totalDocuments: 3, incompleteDocuments: [], ...overrides });

describe("source-grounded historical knowledge", () => {
  it("keeps reporting periods separate and never substitutes upload time", () => {
    const r = make(); expect(r.periods).toEqual([null, "2025", "2026"]); expect(r.temporalSemantics).toBe("recorded_periods_separate_not_as_of"); expect(r.gaps.join(" ")).toContain("no recorded reporting period");
  });
  it("exact period selection retains the other conflict endpoint and its period", () => {
    const r = make("2026"); expect(r.passages.map(p => p.documentId)).toEqual(["d1"]); expect(r.facts.map(f => f.factId)).toEqual(["f1"]); expect(r.conflicts[0]).toMatchObject({ resolution: "not_resolved_by_retrieval", from: { value: "10", source: { period: "2025", documentId: "d0" } }, to: { value: "11", source: { period: "2026", documentId: "d1" } } });
  });
  it("retains source citation, hash, locator and draft/demo safeguards", () => {
    const r = make(); expect(r.passages[0]).toMatchObject({ citation: "d0/j0/line0", locator: { line: 0 }, verified: false, source: { sha256: "hash0", classification: "DEMO" } }); expect(r.release).toBe("not_authorized"); expect(r.facts[0]).toMatchObject({ usableForVerifiedCoverage: false, state: "proposed", currentExtraction: false }); expect(r.facts[1]).toMatchObject({ currentExtraction: true });
  });
  it("never returns another tenant's source or counterpart value", () => {
    const foreign = "f002e3db-ef32-4bfb-baaa-1a57b1ef50b7";
    const r = make("", { documents: docs.map(d => d.id === "d1" ? { ...d, organization_id: foreign } : d), facts: facts.map(f => f.id === "f1" ? { ...f, organization_id: foreign } : f) });
    expect(r.passages.map(p => p.documentId)).not.toContain("d1"); expect(r.conflicts[0]?.to).toEqual({ factId: "f1", available: false });
  });
  it("reports missing stored extraction and bounded pagination", () => {
    const r = make("", { totalDocuments: 21, incompleteDocuments: ["d2"] }); expect(r.page.hasMore).toBe(true); expect(r.gaps.join(" ")).toContain("no processing was rerun"); expect(r.gaps.join(" ")).toContain("not an exhaustive");
  });
  it("uses exact department selection and all query words", () => {
    const scope = knowledgeQuerySchema.parse({ organizationId: org, department: "Other", query: "Students data" }); expect(make("", { scope }).passages).toEqual([]);
  });
});