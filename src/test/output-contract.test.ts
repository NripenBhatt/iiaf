import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION, repairOutputSet, type SourceLine, type SourceManifest } from "@/lib/output-contract";
import { outputCsv, outputDocx, outputText, outputsZip } from "@/lib/output-export";
import { unzipSync, strFromU8 } from "fflate";
import { OUTPUT_CATALOGUE, OUTPUT_REFERENCE, RECONCILED_OUTPUT_CATALOGUE } from "@/lib/output-catalogue";
import { outputBinding } from "@/lib/output-reference";
const bytes = (blob: Blob) => new Promise<Uint8Array>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error("Invalid blob")); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob); });

const manifest: SourceManifest = { documentId: "synthetic-doc", jobId: "synthetic-job", originalHash: "test-original-hash", parserVersion: "1.4.0", contractVersion: CONTRACT_VERSION, classification: "DEMO", approval: "draft", locators: ["table1:row1"], verifiedCoverage: false };
const lines: SourceLine[] = [{ seq: 0, locator_key: "table1:row1", content: "कार्यसूची | 10:00", method_version: "1.4.0", locator: { table: 1, row: 1, cells: [{ column: 1, ref: "table1:r1:c1", raw: "कार्यसूची", value: "कार्यसूची", formula: null, type: "text" }, { column: 2, ref: "table1:r1:c2", raw: "=1+1", value: "10:00", formula: "1+1", type: "n" }] } }];
describe("source qualification and output contracts", () => {
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
    const r = repairOutputSet([{ type: "invented_report", name: "Unknown", title: "Unknown", body: "unsupported" }], lines, manifest);
    expect(r.outputs.map(o => o.type)).not.toContain("invented_report");
    expect(r.skipped.find(o => o.name === "Unknown")?.reason).toContain("Unknown output type");
  });
  it("does not represent prose as a validated structured decision register", () => {
    const source = [{ ...lines[0], content: "Minutes: Resolution recorded", locator: { line: 1 } }];
    const r = repairOutputSet([{ type: "decisions", name: "Decisions", title: "Register", body: "Resolution recorded" }], source, manifest);
    expect(r.outputs.map(o => o.type)).not.toContain("decisions");
    expect(r.skipped.find(o => o.name === "Decisions")?.reason).toContain("structured register");
  });
  it("blocks X copy beyond its 270-character channel contract", () => {
    const r = repairOutputSet([{ type: "x_post", name: "X", title: "X", body: "a".repeat(271) }], [{ ...lines[0], content: "English source" }], manifest);
    expect(r.outputs.map(o => o.type)).not.toContain("x_post");
    expect(r.skipped.find(o => o.name === "X")?.reason).toContain("270");
  });
  it("keeps a supported historical caption as an unapproved draft variant", () => {
    const r = repairOutputSet([{ type: "x_post", name: "X", title: "X", body: "a".repeat(270) }], [{ ...lines[0], content: "English source" }], manifest);
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
  });
});