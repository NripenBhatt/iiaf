import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import * as XLSX from "xlsx";
import { extract, matchField, parseCsv, parseDate, proposeFacts, validateFact } from "@/lib/extraction";
import { CONTRACT_VERSION, repairOutputSet, type SourceManifest } from "@/lib/output-contract";

const enc = (s: string) => new TextEncoder().encode(s);

describe("Phase 2 real-file synthetic fixtures", () => {
  const fixture = (name: string) => new Uint8Array(readFileSync(`src/test/fixtures/phase2/${name}`));
  it.each([
    ["docx", "synthetic-hindi-agenda.docx", "कार्यसूची"],
    ["docx", "synthetic-minutes.docx", "Minutes"],
    ["docx", "synthetic-decisions.docx", "revised draft"],
    ["docx", "synthetic-performance.docx", "142"],
    ["xlsx", "synthetic-performance.xlsx", "83%"],
    ["xls", "synthetic-performance.xls", "83%"],
    ["pptx", "synthetic-slides.pptx", "प्रवेश समीक्षा"],
    ["csv", "synthetic-table.csv", "2026-10-13"],
    ["txt", "synthetic-labels.txt", "Evidence_ID: EV-0042"],
    ["pdf", "synthetic-text.pdf", "Evidence_ID: EV-0042"],
  ])("reads %s file %s with source-linked review outputs", async (extension, name, expected) => {
    const result = await extract(extension, fixture(name));
    expect(result.status).toBe("extracted");
    expect(result.segments.map(s => s.content).join("\n")).toContain(expected);
    expect(result.segments.every(s => s.locator_key.length > 0 && Object.keys(s.locator).length > 0)).toBe(true);
    const manifest: SourceManifest = { documentId: `synthetic-${name}`, jobId: "synthetic-fixture-job", originalHash: "offline-test-only", parserVersion: "1.4.0", contractVersion: CONTRACT_VERSION, classification: "DEMO", approval: "draft", locators: result.segments.map(s => s.locator_key), verifiedCoverage: false };
    const outputs = repairOutputSet([], result.segments.map(s => ({ ...s, method_version: "1.4.0" })), manifest);
    expect(outputs.outputs[0]?.body).toContain(expected);
    expect(outputs.outputs.every(o => o.manifest?.approval === "draft" && o.manifest.verifiedCoverage === false)).toBe(true);
  });
  it("preserves agenda Hindi table blanks without inventing proceedings", async () => {
    const r = await extract("docx", fixture("synthetic-hindi-agenda.docx"));
    expect(r.segments.find(s => s.locator_key === "table1:row2")?.locator["cells"]).toMatchObject([{ value: "10:00", column: 1 }, { value: "प्रवेश समीक्षा", column: 2 }, { value: "", column: 3 }]);
    expect(proposeFacts(r.segments).find(f => f.label === "बैठक तिथि")?.field).toBeNull();
  });
  it.each(["xlsx", "xls"])("preserves real %s worksheet values and date formatting", async extension => {
    const r = await extract(extension, fixture(`synthetic-performance.${extension}`));
    expect(r.segments[1]?.locator["cells"]).toMatchObject([{ ref: "A2", raw: "142" }, { ref: "B2", raw: "0.83", value: "83%" }, { ref: "C2", value: "2026-10-13" }, { ref: "D2", raw: "118" }, { ref: "E2", value: "" }]);
    if (extension === "xlsx") expect(r.segments[1]?.locator["cells"]).toMatchObject([{}, {}, {}, { formula: "A2-24" }, {}]);
  });
  it("preserves real slide order and paragraph references", async () => {
    const r = await extract("pptx", fixture("synthetic-slides.pptx"));
    expect(r.segments.find(s => s.content === "प्रवेश समीक्षा")?.locator).toMatchObject({ slide: 2, paragraph: 2 });
  });
  it.each(["png", "jpg", "jpeg"])("routes a valid %s image to OCR without a paid invocation", async extension => {
    const r = await extract(extension, fixture(`synthetic-poster.${extension}`));
    expect(r.status).toBe("ocr_required"); expect(r.segments).toEqual([]);
  });
  it("identifies the actual image-only page in a scanned PDF", async () => {
    const r = await extract("pdf", fixture("synthetic-scanned.pdf"));
    expect(r.status).toBe("ocr_required"); expect(r.ocrPages).toEqual([1]); expect(r.segments).toEqual([]);
  });
  it("keeps native page text while identifying the scanned page of a mixed PDF", async () => {
    const r = await extract("pdf", fixture("synthetic-mixed.pdf"));
    expect(r.status).toBe("extracted"); expect(r.ocrPages).toEqual([2]);
    expect(r.segments[0]?.page).toBe(1); expect(r.segments.map(s => s.content).join("\n")).toContain("EV-0042");
  });
});

describe("document extraction", () => {
  it("extracts a real text PDF with page and line provenance", async () => {
    const r = await extract("pdf", new Uint8Array(readFileSync("src/test/fixtures/text-policy.pdf")));
    expect(r.status).toBe("extracted");
    expect(r.ocrPages).toBeUndefined();
    expect(r.segments[0]).toMatchObject({ locator_key: "p1:l1", locator: { page: 1, line: 1 }, page: 1 });
    expect(r.segments.map(s => s.content).join(" ")).toContain("Document_Version: v3");
  });
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
  it.each(["jpg", "jpeg"])("routes %s to OCR rather than claiming native extraction", async (extension) => {
    const r = await extract(extension, new Uint8Array([255, 216, 255, 217]));
    expect(r.status).toBe("ocr_required");
    expect(r.segments).toEqual([]);
  });
  it("keeps CSV row locators and source-located proposed facts", async () => {
    const r = await extract("csv", enc("Meeting_ID,M-0042\nChairperson,Dr. Rao"));
    expect(r.status).toBe("extracted");
    expect(r.segments[1]).toMatchObject({ locator_key: "row2", locator: { row: 2, columns: 2 }, sheet: "csv" });
    expect(proposeFacts(r.segments)[0]).toMatchObject({ value: "M-0042", locator_key: "row1", locator: { row: 1 } });
  });
  it("reads PPTX slides in order with slide and paragraph references", async () => {
    const pres = `<p:presentation xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>`;
    const rels = `<Relationships><Relationship Id="rId1" Target="slides/slide2.xml"/><Relationship Id="rId2" Target="slides/slide1.xml"/></Relationships>`;
    const slide1 = `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Meeting_Type: Senate</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    const slide2 = `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Evidence_ID: EV-0123</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    const bytes = zipSync({ "ppt/presentation.xml": strToU8(pres), "ppt/_rels/presentation.xml.rels": strToU8(rels), "ppt/slides/slide1.xml": strToU8(slide1), "ppt/slides/slide2.xml": strToU8(slide2) });
    const r = await extract("pptx", bytes);
    expect(r.status).toBe("extracted");
    expect(r.segments.map(s => s.locator_key)).toEqual(["slide1:p1", "slide2:p1"]);
    expect(r.segments[0]).toMatchObject({ content: "Meeting_Type: Senate", locator: { slide: 1 } });
  });
  it("reads legacy XLS workbooks with sheet and row references", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Meeting_ID", "M-0042"], ["Chairperson", "Dr. Rao"]]), "Meetings");
    const bytes = new Uint8Array(XLSX.write(wb, { bookType: "xls", type: "array" }) as ArrayBuffer);
    const r = await extract("xls", bytes);
    expect(r.status).toBe("extracted");
    expect(r.segments[0]).toMatchObject({ sheet: "Meetings", content: "Meeting_ID: M-0042" });
  });
  it("reads legacy DOC files as text lines", async () => {
    const bytes = new Uint8Array(readFileSync("src/test/fixtures/sample.doc"));
    const r = await extract("doc", bytes);
    expect(r.status).toBe("extracted");
    expect(r.segments.map(s => s.content)).toContain("Document_Version: v3");
    expect(r.segments.every(s => s.locator_key === `l${s.locator["line"]}`)).toBe(true);
  });
  it("marks unknown stored formats for manual review", async () => {
    expect((await extract("odt", new Uint8Array([1]))).status).toBe("needs_review");
  });
  it("fails safely on corrupt files", async () => {
    expect((await extract("docx", enc("not a zip"))).status).toBe("processing_failed");
  });
});

describe("fact validation", () => {
  it("marks bounded extraction partial instead of silently claiming completeness", async () => {
    const r = await extract("txt", enc(Array.from({ length: 2001 }, (_, i) => `Line ${i}`).join("\n")));
    expect(r.status).toBe("needs_review");
    expect(r.segments).toHaveLength(2000);
    expect(r.error).toContain("Partial extraction");
  });
  it("does not mistake a URL scheme for a fact label", async () => {
    const r = await extract("txt", enc("https://aiflucknow.in/idea-to-enterprise\nPublication_URL: https://aiflucknow.in/idea-to-enterprise"));
    expect(proposeFacts(r.segments)).toHaveLength(1);
    expect(proposeFacts(r.segments)[0]?.field).toBe("Publication_URL");
  });
  it("retains Hindi labels as unresolved, never fabricates a canonical mapping", async () => {
    const r = await extract("txt", enc("बैठक तिथि: 12 मार्च 2026"));
    expect(proposeFacts(r.segments)[0]).toMatchObject({ label: "बैठक तिथि", value: "12 मार्च 2026", field: null });
  });
  it("preserves CSV blanks, embedded newlines, raw whitespace and cells", async () => {
    const r = await extract("csv", enc('Name,Empty,Value\n"Hindi\nहिन्दी",," 83% "'));
    expect(r.segments[1]?.locator["cells"]).toEqual([
      { column: 1, ref: "row2:col1", raw: "Hindi\nहिन्दी", value: "Hindi\nहिन्दी", formula: null, type: "text" },
      { column: 2, ref: "row2:col2", raw: "", value: "", formula: null, type: "text" },
      { column: 3, ref: "row2:col3", raw: " 83% ", value: "83%", formula: null, type: "text" },
    ]);
  });
  it("preserves DOCX Hindi table row, columns, blank cell and grid span", async () => {
    const xml = '<w:document><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>कार्यसूची</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p/></w:tc><w:tc><w:p><w:r><w:t>10:00</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    const r = await extract("docx", zipSync({ "word/document.xml": strToU8(xml) }));
    expect(r.segments[0]?.locator_key).toBe("table1:row1");
    expect(r.segments[0]?.locator["cells"]).toMatchObject([{ column: 1, value: "कार्यसूची" }, { column: 2, value: "", columnSpan: 2 }, { column: 4, value: "10:00" }]);
  });
  it("retains XLSX raw numbers, percentages, dates, cached formula and gaps", async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Count", "Rate", "Date", "Total"], [142, 0.83, new Date(Date.UTC(2026, 9, 13)), 118]]);
    sheet["B2"].z = "0%"; sheet["C2"].z = "yyyy-mm-dd"; sheet["D2"].f = "A2-24";
    XLSX.utils.book_append_sheet(wb, sheet, "Data");
    const r = await extract("xlsx", new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer));
    expect(r.segments[1]?.locator["cells"]).toMatchObject([{ ref: "A2", raw: "142", value: "142" }, { ref: "B2", raw: "0.83", value: "83%" }, { ref: "C2", value: "2026-10-13" }, { ref: "D2", raw: "118", formula: "A2-24" }]);
  });
  it("accepts unambiguous dates and rejects impossible ones", () => {
    expect(parseDate("12 March 2026")).toBe("2026-03-12");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(validateFact("Meeting_Date", "soon")).toHaveLength(1);
  });
  it("requires Evidence_ID format", () => expect(validateFact("Evidence_ID", "0001")).toHaveLength(1));
  it("matches fields by name or label", () => expect(matchField("Meeting date")?.field).toBe("Meeting_Date"));
  it("parses quoted CSV cells", () => expect(parseCsv('a,"b, c"\n1,2')).toEqual([["a", "b, c"], ["1", "2"]]));
});
