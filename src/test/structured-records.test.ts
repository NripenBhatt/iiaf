import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { archiveReconciliation, contactCandidates, recordsCsv, type ArchivedSegment } from "@/lib/structured-records";
import { structuredExcel, structuredCsvZip } from "@/lib/structured-export";
import type { Lineage } from "@/lib/lineage.functions";

const segment: ArchivedSegment = { id: "segment1", job_id: "job1", seq: 1, locator_key: "line:1", locator: { line: 1 }, method: "native", method_version: "v1", content: "SYNTHETIC: Test.User@EXAMPLE.ORG; +91 98765 43210. Date 2026-10-23; count 1234567890" };
const bytes = (blob: Blob) => new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("Not bytes")); reader.readAsArrayBuffer(blob); });
describe("structured archive readback", () => {
  it("retains exact raw contact/source IDs without inventing affiliation, persistence or consent", () => {
    const contacts = contactCandidates("doc1", "SYNTHETIC.txt", [segment]);
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({ raw: "Test.User@EXAMPLE.ORG", normalized: "Test.User@example.org", documentId: "doc1", jobId: "job1", segmentId: "segment1", locatorKey: "line:1", persisted: false, consent: "not_established", affiliation: null });
    expect(contacts[1]?.normalized).toBe("+919876543210");
    expect(contactCandidates("doc1", "SYNTHETIC.txt", [segment])).toEqual(contacts);
  });
  it("never turns dates, metrics or local unlabelled digits into a contact", () => {
    expect(contactCandidates("doc1", "SYNTHETIC.txt", [{ ...segment, content: "2026-10-23; students 1234567890; +000000000000" }])).toEqual([]);
  });
  it("reconciles persisted rows/cells and historical facts separately, reporting missing archive rows", () => {
    const row = { ...segment, locator: { table: 1, row: 2, cells: [{ column: 1, ref: "A2", raw: "42", value: "42", formula: null, type: "n" }] } };
    expect(archiveReconciliation([row], 2, [{ segment_id: "segment1", state: "proposed" }, { segment_id: "old", state: "approved" }], [])).toMatchObject({ complete: false, persistedSegments: 1, structuredTables: 1, structuredRows: 1, structuredCells: 1, currentFacts: 1, historicalFacts: 1, persistedContacts: 0 });
  });
  it("CSV preserves nested locators and both endpoints and neutralizes formulas", () => {
    const csv = recordsCsv([{ id: "r1", source_id: "f1", target_id: "f2", locator: { cells: [{ ref: "A2" }] }, raw: "=SUM(A1:A2)" }]);
    expect(csv).toContain('"f1","f2"'); expect(csv).toContain('"raw"'); expect(csv).toContain("'=SUM(A1:A2)"); expect(csv).toContain('""ref"":""A2""');
  });
  it("Excel/CSV archive downloads retain identifiers and separate relation endpoints", async () => {
    const contacts = contactCandidates("doc1", "SYNTHETIC.txt", [segment]);
    const lineage = { document: { id: "doc1", organization_id: "org", original_filename: "SYNTHETIC.txt", file_extension: "txt", sha256_hash: "hash", reporting_period: "2026", document_date_raw: null, processing_status: "needs_review", module: "institutional" }, job: null, methodCounts: { native: 1 }, segments: [segment], tables: [], contacts, reconciliation: archiveReconciliation([segment], 1, [], contacts), facts: [], relationships: [], reviews: [], reviewCount: 0, outputRecords: [], outputRecord: null, generatedOutputCount: 0, outputReadbackStatus: "none" } satisfies Lineage;
    const blob = structuredExcel(lineage);
    const book = XLSX.read(await bytes(blob), { type: "array" });
    const sheet = book.Sheets.segments;
    if (!sheet) throw new Error("Missing segments sheet");
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows[0]).toMatchObject({ document_id: "doc1", id: "segment1", job_id: "job1", locator_key: "line:1", recorded_period: "2026" });
    expect(book.SheetNames).toContain("relationships");
    const zip = await JSZip.loadAsync(await bytes(await structuredCsvZip(lineage)));
    expect(await zip.file("segments.csv")?.async("string")).toContain('"segment1"');
    expect(JSON.parse(await zip.file("readback.json")?.async("string") ?? "{}").contacts[0].persisted).toBe(false);
  });
});