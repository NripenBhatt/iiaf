import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extract, matchField, parseCsv, parseDate, proposeFacts, validateFact } from "@/lib/extraction";

const enc = (s: string) => new TextEncoder().encode(s);

describe("document extraction", () => {
  it("keeps line locators for text files", async () => {
    const r = await extract("txt", enc("Title\n\nMeeting_Date: 12 March 2026"));
    expect(r.status).toBe("extracted");
    expect(r.segments.map(s => s.locator_key)).toEqual(["l1", "l3"]);
  });
  it("proposes facts only from explicit labels matched to spec fields", async () => {
    const r = await extract("txt", enc("Evidence_ID: EV-0001\nFavourite colour: blue\nAdmissions grew strongly"));
    const facts = proposeFacts(r.segments);
    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatchObject({ field: "Evidence_ID", spec: "SOURCE_EVIDENCE_MASTER", value: "EV-0001", issues: [] });
    expect(facts[1]!.field).toBeNull();
  });
  it("records sheet and cell ranges for xlsx", async () => {
    const wb = `<workbook xmlns:r="r"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const rels = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`;
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Meeting_Type</t></is></c><c r="B1" t="inlineStr"><is><t>Senate</t></is></c></row></sheetData></worksheet>`;
    const bytes = zipSync({ "xl/workbook.xml": strToU8(wb), "xl/_rels/workbook.xml.rels": strToU8(rels), "xl/worksheets/sheet1.xml": strToU8(sheet) });
    const r = await extract("xlsx", bytes);
    expect(r.segments[0]).toMatchObject({ sheet: "Data", cell: "A1:B1", content: "Meeting_Type: Senate" });
  });
  it("reads DOCX paragraphs with headings", async () => {
    const xml = `<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Minutes</w:t></w:r></w:p><w:p><w:r><w:t>Meeting_Date: 2026-03-12</w:t></w:r></w:p></w:body></w:document>`;
    const r = await extract("docx", zipSync({ "word/document.xml": strToU8(xml) }));
    expect(r.segments[1]).toMatchObject({ content: "Meeting_Date: 2026-03-12", locator: { heading: "Minutes" } });
  });
  it("marks images as OCR required instead of claiming extraction", async () => {
    expect((await extract("png", new Uint8Array([137, 80]))).status).toBe("ocr_required");
  });
  it("marks unsupported stored formats for manual review", async () => {
    expect((await extract("pptx", new Uint8Array([1]))).status).toBe("needs_review");
  });
  it("fails safely on corrupt files", async () => {
    expect((await extract("docx", enc("not a zip"))).status).toBe("processing_failed");
  });
});

describe("fact validation", () => {
  it("accepts unambiguous dates and rejects impossible ones", () => {
    expect(parseDate("12 March 2026")).toBe("2026-03-12");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(validateFact("Meeting_Date", "soon")).toHaveLength(1);
  });
  it("requires Evidence_ID format", () => expect(validateFact("Evidence_ID", "0001")).toHaveLength(1));
  it("matches fields by name or label", () => expect(matchField("Meeting date")?.field).toBe("Meeting_Date"));
  it("parses quoted CSV cells", () => expect(parseCsv('a,"b, c"\n1,2')).toEqual([["a", "b, c"], ["1", "2"]]));
});
