import { describe, expect, it } from "vitest";
import { localDrafts, localDraftText } from "@/lib/local-artifacts";
import type { DraftSource } from "@/lib/authored-drafts";
const source = (values: string[]): DraftSource => ({ documentId: "d1", jobId: "j1", filename: "SYNTHETIC.txt", originalHash: "hash1", parserVersion: "p1", classification: "DEMO", lines: values.map((content, seq) => ({ content, seq, locator_key: `ocr:l${seq + 1}`, locator: { line: seq + 1 }, method_version: "p1" })) });
describe("local source-linked artifacts", () => {
  it("authors an explicit profile with exact lineage, DEMO and no saved or release claim", () => {
    const drafts = localDrafts(source(["Institution Name: Test University A", "Established: 2001", "Campus: Synthetic City"]));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ catalogueId: "OUT-001", persisted: false, classification: "DEMO", originalHash: "hash1", release: "not_authorized" });
    const draft = drafts[0]; if (!draft) throw new Error("No profile");
    const text = localDraftText(draft);
    expect(text).toContain("Campus: Synthetic City."); expect(text).toContain("OCR_CAUTION"); expect(text).toContain("document d1 · job j1 · ocr:l3");
  });
  it("does not infer identity or merge conflicting institutions", () => {
    expect(localDrafts(source(["Established: 2001"]))).toEqual([]);
    expect(localDrafts(source(["Institution Name: A", "Institution Name: B"]))).toEqual([]);
  });
  it("preserves event review restrictions and gives every local variant hash/version lineage", () => {
    const drafts = localDrafts(source(["Event title: Test Workshop", "Event date: 2026-10-23"]));
    expect(drafts).toHaveLength(6);
    expect(drafts.every(d => d.originalHash === "hash1" && d.parserVersion === "p1" && !d.persisted)).toBe(true);
  });
  it("reuses contextual saved poster text but never promotes local writing to a saved artifact", () => {
    const drafts = localDrafts(source(["From Ideas to", "Enterprises", "Understanding Legal Entity Formation for Startups:", "Why, How, Benefits and Goals", "13 October 2026", "Thursday", "Test University Hall", "Organised by Synthetic Foundation", "PARTICIPANT MOBILE FLOW", "Organised by Fabricated Foundation"]));
    const article = drafts.find(d => d.type === "press_release");
    expect(article?.body).toContain("Synthetic Foundation");
    expect(article?.body).not.toContain("Fabricated Foundation");
    expect(article?.cautions.join(" ")).toContain("weekday/date conflict");
    expect(article?.citations.map(c => c.locatorKey)).toContain("ocr:l8");
    expect(drafts.every(d => !d.persisted && d.release === "not_authorized")).toBe(true);
    expect(new Set(drafts.map(d => d.body)).size).toBe(drafts.length);
  });
});