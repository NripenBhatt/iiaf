import { describe, expect, it } from "vitest";
import { OCR_CAUTION, extract, ocrSegments, proposeFacts, tagOcrFacts } from "@/lib/extraction";

const enc = (s: string) => new TextEncoder().encode(s);

describe("OCR segment and fact handling", () => {
  it("builds page-level locators for image OCR lines", () => {
    const segs = ocrSegments([{ page: null, lines: ["Title", "Evidence_ID: EV-0007"] }], 0);
    expect(segs.map(s => s.locator_key)).toEqual(["ocr:l1", "ocr:l2"]);
    expect(segs[1]).toMatchObject({ page: null, locator: { source: "ocr", precision: "page-level", line: 2 } });
  });
  it("builds page and line locators for scanned PDF pages", () => {
    const segs = ocrSegments([{ page: 3, lines: ["a", "b"] }, { page: 7, lines: ["c"] }], 10);
    expect(segs.map(s => s.locator_key)).toEqual(["ocr:p3:l1", "ocr:p3:l2", "ocr:p7:l1"]);
    expect(segs[0]!.seq).toBe(10);
    expect(segs[2]!.page).toBe(7);
  });
  it("flags OCR-derived facts for verification against the original", () => {
    const facts = tagOcrFacts(proposeFacts(ocrSegments([{ page: 1, lines: ["Evidence_ID: EV-0007"] }], 0)));
    expect(facts).toHaveLength(1);
    expect(facts[0]!.issues).toContain(OCR_CAUTION);
  });
  it("does not flag facts from embedded text layers", () => {
    const facts = tagOcrFacts(proposeFacts([{ seq: 0, locator_key: "p1:l1", locator: { page: 1, line: 1 }, page: 1, sheet: null, cell: null, content: "Evidence_ID: EV-0007" }]));
    expect(facts[0]!.issues).toHaveLength(0);
  });
});

describe("scanned and mixed PDF detection", () => {
  it("routes image-only PDFs to OCR with all pages listed", async () => {
    // A valid but textless PDF: unpdf reads zero text characters.
    const r = await extract("pdf", enc("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"));
    expect(r.status).toBe("ocr_required");
    expect(r.ocrPages).toEqual([1]);
  });
});
