import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION, repairOutputSet, type SourceLine, type SourceManifest } from "@/lib/output-contract";
import { outputCsv, outputDocx, outputText, outputsZip } from "@/lib/output-export";
import { unzipSync, strFromU8 } from "fflate";
import { OUTPUT_CATALOGUE, OUTPUT_REFERENCE, RECONCILED_OUTPUT_CATALOGUE } from "@/lib/output-catalogue";
import { outputBinding } from "@/lib/output-reference";
import { structuredMeetings } from "@/lib/meeting-contract";
const bytes = (blob: Blob) => new Promise<Uint8Array>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error("Invalid blob")); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob); });

const manifest: SourceManifest = { documentId: "synthetic-doc", jobId: "synthetic-job", originalHash: "test-original-hash", parserVersion: "1.4.0", contractVersion: CONTRACT_VERSION, classification: "DEMO", approval: "draft", locators: ["table1:row1"], verifiedCoverage: false };
const lines: SourceLine[] = [{ seq: 0, locator_key: "table1:row1", content: "कार्यसूची | 10:00", method_version: "1.4.0", locator: { table: 1, row: 1, cells: [{ column: 1, ref: "table1:r1:c1", raw: "कार्यसूची", value: "कार्यसूची", formula: null, type: "text" }, { column: 2, ref: "table1:r1:c2", raw: "=1+1", value: "10:00", formula: "1+1", type: "n" }] } }];
const englishSource = (content: string): SourceLine[] => [{ seq: 0, locator_key: "l1", method_version: "1.4.0", locator: { line: 1 }, content }];
describe("source qualification and output contracts", () => {
  const meetingTable = (headers: string[], rows: string[][], table = 1): SourceLine[] => [headers, ...rows].map((values, i) => ({ seq: i, locator_key: `table${table}:row${i + 1}`, content: values.join(" | "), method_version: "1.4.1", locator: { table, row: i + 1, cells: values.map((value, j) => ({ column: j + 1, ref: `table${table}:r${i + 1}:c${j + 1}`, raw: value, value, formula: null, type: "text" })) } }));
  it("creates distinct O06–O09 explicit-source drafts without promoting evidence", () => {
    const inputs = [
      meetingTable(["क्रमांक", "कार्यसूची मद", "उद्देश्य", "प्रस्तुतकर्ता", "अवधि", "पूर्व पठन", "अपेक्षित परिणाम"], [["2", "प्रवेश समीक्षा", "समीक्षा", "डॉ. राव", "10 मिनट", "नोट", "प्रस्ताव"], ["1", "वित्त", "चर्चा", "सचिव", "5 मिनट", "पत्र", "मसौदा"]], 1),
      meetingTable(["Meeting", "Meeting date", "Attendance", "Proceedings"], [["M-1", "2026-10-13", "Dr Rao", "Reviewed draft"]], 2),
      meetingTable(["Decision ID", "Agenda item", "Decision wording", "Status", "Authority", "Owner", "Decision date"], [["D-1", "2", "Return revised draft", "deferred", "Council", "Secretary", "2026-10-13"]], 3),
      meetingTable(["Action", "Meeting", "Decision reference", "Owner", "Due date", "Status", "Completion proof"], [["Revise draft", "M-1", "D-1", "Secretary", "2026-11-01", "pending", "not supplied"]], 4),
    ].flat().map((l, seq) => ({ ...l, seq }));
    const r = repairOutputSet([], inputs, manifest);
    const drafts = r.outputs.filter(o => o.meeting);
    expect(drafts.map(o => o.meeting?.contractId)).toEqual(["O06", "O07", "O08", "O09"]);
    expect(drafts.every(o => o.meeting?.validation === "complete" && o.manifest?.approval === "draft" && o.manifest.verifiedCoverage === false)).toBe(true);
    expect(drafts[0]?.meeting?.records.map(r => r.fields["number"]?.[0]?.value)).toEqual(["2", "1"]);
    expect(drafts[0]?.body).toContain("प्रवेश समीक्षा");
    expect(drafts[2]?.meeting?.records[0]?.fields["status"]?.[0]).toMatchObject({ value: "deferred", locator: "table3:row2", cell: "table3:r2:c4" });
    expect(drafts[3]?.meeting?.records[0]?.fields["status"]?.[0]?.value).toBe("pending");
  });
  it("retains missing owner/deadline/status without invention", () => {
    const r = structuredMeetings(meetingTable(["Action", "Meeting"], [["Review", "M-1"]]));
    expect(r[0]?.meeting.validation).toBe("incomplete");
    expect(r[0]?.meeting.records[0]?.missing).toEqual(["decision", "owner", "dueDate", "status", "completionProof"]);
    expect(r[0]?.meeting.records[0]?.fields["owner"]).toBeUndefined();
  });
  it("preserves conflicting owner columns and ambiguous deadlines for review", () => {
    const r = structuredMeetings(meetingTable(["Action", "Owner", "Owner", "Due date"], [["Review", "A", "B", "soon"]]));
    expect(r[0]?.meeting.validation).toBe("ambiguous");
    expect(r[0]?.meeting.records[0]?.fields["owner"]?.map(f => f.value)).toEqual(["A", "B"]);
    expect(r[0]?.meeting.records[0]?.issues.join(" ")).toContain("no overdue inference");
  });
  it("does not assign semantic contracts to prose or unknown table headers", () => {
    expect(structuredMeetings(englishSource("Minutes: approved budget by someone"))).toEqual([]);
    expect(structuredMeetings(meetingTable(["Notes", "Person"], [["Approved", "Rao"]]))).toEqual([]);
  });
  it("exports structured registers and original cell provenance in downloadable manifests", async () => {
    const o = repairOutputSet([], meetingTable(["Decision ID", "Agenda item", "Decision wording", "Status"], [["D-1", "1", "Hold for review", "held"]]), manifest).outputs.find(o => o.type === "decisions");
    if (!o) throw new Error("Decision draft missing");
    const files = unzipSync(await bytes(await outputsZip([o], "synthetic-register.docx")));
    const name = Object.keys(files).find(n => n.endsWith(".manifest.json")); if (!name) throw new Error("Manifest absent");
    expect(JSON.parse(strFromU8(files[name] ?? new Uint8Array())).meeting.records[0].fields.status[0].value).toBe("held");
    expect(outputCsv(o)).toContain("table1:r2:c3");
  });
  it("accounts for all 30 authoritative catalogue IDs without granting release", () => {
    expect(RECONCILED_OUTPUT_CATALOGUE.map(o => o.Output_ID)).toEqual(Array.from({ length: 30 }, (_, i) => `OUT-${String(i + 1).padStart(3, "0")}`));
    expect(OUTPUT_REFERENCE.contracts.map(c => c.Output_ID)).toEqual(Array.from({ length: 13 }, (_, i) => `O${String(i + 1).padStart(2, "0")}`));
    expect(RECONCILED_OUTPUT_CATALOGUE.find(o => o.Output_ID === "OUT-017")).toMatchObject({ Default_Access_Class: "Company-restricted by default", support: "blocked" });
    const ids = new Set(OUTPUT_REFERENCE.outputs.map(o => o.Output_ID));
    const contracts = new Set(OUTPUT_REFERENCE.contracts.map(o => o.Output_ID));
    for (const entry of Object.values(OUTPUT_CATALOGUE).flat()) {
      if (entry.catalogueId) expect(ids.has(entry.catalogueId)).toBe(true);
      if (entry.contractId) expect(contracts.has(entry.contractId)).toBe(true);
      expect(entry.support).not.toBe("approved");
    }
  });
  it("blocks unknown output types and unsupported official report bindings", () => {
    expect(outputBinding("agency_submission").support).toBe("blocked");
    const r = repairOutputSet([{ type: "invented_report", name: "Unknown", title: "Unknown", body: "unsupported" }], englishSource("English source"), manifest);
    expect(r.outputs.map(o => o.type)).not.toContain("invented_report");
    expect(r.skipped.find(o => o.name === "Unknown")?.reason).toContain("Unknown output type");
  });
  it("does not represent prose as a validated structured decision register", () => {
    const source = englishSource("Minutes: Resolution recorded");
    const r = repairOutputSet([{ type: "decisions", name: "Decisions", title: "Register", body: "Resolution recorded" }], source, manifest);
    expect(r.outputs.map(o => o.type)).not.toContain("decisions");
    expect(r.skipped.find(o => o.name === "Decisions")?.reason).toContain("structured register");
  });
  it("blocks X copy beyond its 270-character channel contract", () => {
    const r = repairOutputSet([{ type: "x_post", name: "X", title: "X", body: "a".repeat(271) }], englishSource("English source"), manifest);
    expect(r.outputs.map(o => o.type)).not.toContain("x_post");
    expect(r.skipped.find(o => o.name === "X")?.reason).toContain("270");
  });
  it("keeps a supported historical caption as an unapproved draft variant", () => {
    const r = repairOutputSet([{ type: "x_post", name: "X", title: "X", body: "a".repeat(270) }], englishSource("English source"), manifest);
    expect(r.outputs.find(o => o.type === "x_post")).toMatchObject({ catalogue: { catalogueId: "OUT-009", support: "stored-draft-only" }, manifest: { approval: "draft", verifiedCoverage: false } });
  });
  it("never derives decisions or minutes from an agenda alone", () => {
    const result = repairOutputSet([{ type: "decisions", name: "Decisions", title: "False", body: "Approved" }], lines, manifest);
    expect(result.outputs.map(o => o.type)).not.toContain("decisions");
    expect(result.skipped.find(s => s.name === "Decisions")?.reason).toContain("Agenda alone");
  });
  it("keeps synthetic source units Candidate and excludes verified coverage", () => {
    const result = repairOutputSet([], lines, manifest);
    expect(result.qualification[0]).toMatchObject({ status: "Candidate", verification: "human review required", consent: "not established", confidence: null, destinations: ["extraction_review", "structured_tables"] });
    expect(result.outputs.every(o => o.manifest?.classification === "DEMO" && o.manifest.verifiedCoverage === false && o.manifest.approval === "draft")).toBe(true);
  });
  it("blocks text masquerading as image or video", () => {
    const result = repairOutputSet([{ type: "social_image", name: "Image", title: "Image", body: "Caption" }], lines, manifest);
    expect(result.outputs.map(o => o.type)).not.toContain("social_image");
    expect(result.skipped.find(s => s.name === "Image")?.reason).toContain("BLOCKED");
  });
  it("does not force news without dated event support", () => {
    const result = repairOutputSet([{ type: "press_release", name: "News", title: "News", body: "Policy announcement" }], lines, manifest);
    expect(result.outputs.map(o => o.type)).not.toContain("press_release");
  });
  it("retains the exact stored text and does not manufacture historical table cells", () => {
    const source = [{ ...lines[0], locator: { line: 1 }, content: "142 | 83%" }] as SourceLine[];
    const result = repairOutputSet([], source, manifest);
    expect(result.outputs[0]?.body).toBe("[table1:row1] 142 | 83%");
    expect(result.outputs.some(o => o.tables?.length)).toBe(false);
    expect(result.limitations.join(" ")).toContain("remain partial");
  });
  it("exports actual Word table, source manifest, CSV and honest draft labels", async () => {
    const output = repairOutputSet([], lines, manifest).outputs.find(o => o.type === "structured_tables");
    if (!output) throw new Error("Table output missing");
    const text = outputText(output, "synthetic-agenda.docx");
    expect(text).toContain("DEMO"); expect(text).toContain("NOT APPROVED"); expect(text).toContain("synthetic-job");
    const csv = outputCsv(output); expect(csv).toContain("table1:r1:c1"); expect(csv).toContain("कार्यसूची"); expect(csv).toContain("'=1+1");
    const doc = unzipSync(await bytes(await outputDocx(output, "synthetic-agenda.docx")));
    const xml = strFromU8(doc["word/document.xml"] ?? new Uint8Array());
    expect(xml).toContain("<w:tbl>"); expect(xml).toContain("कार्यसूची"); expect(xml).toContain("DEMO");
    const zip = unzipSync(await bytes(await outputsZip([output], "synthetic-agenda.docx")));
    expect(Object.keys(zip).filter(n => n.endsWith(".csv"))).toHaveLength(1);
    expect(Object.keys(zip).filter(n => n.endsWith(".manifest.json"))).toHaveLength(1);
    const manifestName = Object.keys(zip).find(n => n.endsWith(".manifest.json"));
    if (!manifestName) throw new Error("Manifest missing");
    expect(JSON.parse(strFromU8(zip[manifestName] ?? new Uint8Array()))).toMatchObject({ catalogue: { contractId: "O10", support: "source-review" } });
  });
});