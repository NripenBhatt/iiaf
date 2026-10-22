import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION, DRAFT_CONTRACT_STATE, generatedOutputSchema, outputContractStateSchema, repairOutputSet, type SourceLine, type SourceManifest } from "@/lib/output-contract";
import { QUALIFICATION_RULES, QUALIFICATION_SOURCE, classifyLines } from "@/lib/qualification-rules";

/**
 * G6 first batch: blueprint Qualification_Rules Q01–Q16 and the five v4 mandatory
 * output-contract behaviours (template, MIME, dimensions, approver, release).
 * Source: IIAF_Qualification_and_Relationship_Engine_Blueprint_v1_FIXED.xlsx#Qualification_Rules
 * and Detailed Concept Note v4.0 "Output contract" (page 7).
 */
const manifest: SourceManifest = { documentId: "synthetic-doc", jobId: "synthetic-job", originalHash: "hash", parserVersion: "1.4.2", contractVersion: CONTRACT_VERSION, classification: "DEMO", approval: "draft", locators: ["t1:row1"], verifiedCoverage: false };
const textLine = (content: string, over: Partial<SourceLine> = {}): SourceLine => ({ seq: 0, locator_key: "l1", content, method_version: "1.4.2", locator: { line: 1 }, ...over });
const tableLines = (headers: string[], rows: string[][], table = 1): SourceLine[] => [headers, ...rows].map((values, i) => ({ seq: i, locator_key: `table${table}:row${i + 1}`, content: values.join(" | "), method_version: "1.4.2", locator: { table, row: i + 1, cells: values.map((value, j) => ({ column: j + 1, ref: `table${table}:r${i + 1}:c${j + 1}`, raw: value, value, formula: null, type: "text" })) } }));

describe("qualification rule catalogue", () => {
  it("carries all 16 authoritative rules with verbatim source citations", () => {
    expect(QUALIFICATION_RULES.map(r => r.ruleId)).toEqual(Array.from({ length: 16 }, (_, i) => `Q${String(i + 1).padStart(2, "0")}`));
    for (const r of QUALIFICATION_RULES) {
      expect(r.inputSignal.length).toBeGreaterThan(0);
      expect(r.requiredAttributes.length).toBeGreaterThan(0);
      expect(r.block.length).toBeGreaterThan(0);
      expect(r.acceptanceCheck.length).toBeGreaterThan(0);
    }
    expect(QUALIFICATION_SOURCE).toContain("Qualification_Rules");
  });
  it("keeps renderer-dependent rules blocked and mapping/sensitivity rules unresolved", () => {
    expect(QUALIFICATION_RULES.filter(r => r.resolution === "blocked").map(r => r.ruleId)).toEqual(["Q03", "Q04", "Q05"]);
    expect(QUALIFICATION_RULES.filter(r => r.resolution === "unresolved").map(r => r.ruleId)).toEqual(["Q12", "Q14"]);
    expect(QUALIFICATION_RULES.filter(r => r.resolution === "implemented")).toHaveLength(11);
  });
});

describe("deterministic rule classification", () => {
  it("Q10: structured tables qualify with units/period/footnotes explicitly missing", () => {
    const apps = classifyLines(tableLines(["Name", "Count"], [["A", "1"]]));
    const q10 = apps.get("table1:row2")?.find(a => a.ruleId === "Q10");
    expect(q10).toMatchObject({ qualificationClass: "Structured table", resolution: "applied", source: `${QUALIFICATION_SOURCE}!Q10` });
    expect(q10?.missing).toEqual(expect.arrayContaining(["units", "period", "footnotes"]));
  });
  it("Q11: numeric and formula cells qualify as quantitative facts without executing formulas", () => {
    const lines = tableLines(["Metric", "Value"], [["Rate", "83%"]]);
    lines[1] = { ...lines[0]!, locator_key: "table1:row2", seq: 1, locator: { table: 1, row: 2, cells: [{ column: 1, ref: "table1:r2:c1", raw: "Rate", value: "Rate", formula: null, type: "text" }, { column: 2, ref: "table1:r2:c2", raw: "=C1-24", value: "83%", formula: "C1-24", type: "n" }] } };
    const q11 = classifyLines(lines).get("table1:row2")?.find(a => a.ruleId === "Q11");
    expect(q11?.present.join(" ")).toContain("formula provenance");
    expect(q11?.blockers.join(" ")).toContain("never executed");
    expect(q11?.missing).toEqual(expect.arrayContaining(["Unit", "definition", "denominator"]));
  });
  it("Q11 negative: plain text never qualifies as a quantitative fact", () => {
    const apps = classifyLines([textLine("Annual report narrative")]);
    expect(apps.get("l1")?.some(a => a.ruleId === "Q11")).toBe(false);
  });
  it("Q13: OCR-derived segments carry review caution; native segments do not", () => {
    const ocr = classifyLines([textLine("Scanned poster text", { method: "ocr-image(gemini)" })]);
    expect(ocr.get("l1")?.find(a => a.ruleId === "Q13")?.blockers.join(" ")).toContain("OCR_CAUTION");
    const native = classifyLines([textLine("Scanned poster text", { method: "pdf-text-layer" })]);
    expect(native.get("l1")?.some(a => a.ruleId === "Q13")).toBe(false);
  });
  it("Q02: dated event signals qualify as news candidates with essential fields listed missing", () => {
    const apps = classifyLines([textLine("Workshop on entrepreneurship announced for 2026")]);
    const q02 = apps.get("l1")?.find(a => a.ruleId === "Q02");
    expect(q02?.missing).toEqual(expect.arrayContaining(["who", "where", "why", "publication authority"]));
    expect(q02?.blockers.join(" ")).toContain("neutral wording");
    expect(classifyLines([textLine("General policy narrative without a date")]).get("l1")?.some(a => a.ruleId === "Q02")).toBe(false);
  });
  it("Q01: plain institutional text falls back to institutional information candidate", () => {
    const apps = classifyLines([textLine("The institution offers undergraduate programmes")]);
    expect(apps.get("l1")?.map(a => a.ruleId)).toEqual(["Q01"]);
  });
  it("Q06–Q09: explicit meeting headers classify member rows; prose never does", () => {
    const agenda = tableLines(["क्रमांक", "कार्यसूची मद", "उद्देश्य"], [["1", "वित्त", "चर्चा"]], 1);
    const decisions = tableLines(["Decision ID", "Agenda item", "Decision wording", "Status"], [["D-1", "1", "Hold", "held"]], 2);
    const actions = tableLines(["Action", "Meeting", "Decision reference", "Owner", "Due date", "Status", "Completion proof"], [["Revise", "M-1", "D-1", "Sec", "2026-11-01", "pending", "none"]], 3);
    const minutes = tableLines(["Meeting", "Meeting date", "Attendance", "Proceedings"], [["M-1", "2026-10-13", "Rao", "Reviewed"]], 4);
    const apps = classifyLines([...agenda, ...decisions, ...actions, ...minutes].map((l, seq) => ({ ...l, seq })));
    expect(apps.get("table1:row2")?.some(a => a.ruleId === "Q06")).toBe(true);
    expect(apps.get("table2:row2")?.some(a => a.ruleId === "Q08")).toBe(true);
    expect(apps.get("table3:row2")?.some(a => a.ruleId === "Q09")).toBe(true);
    expect(apps.get("table4:row2")?.some(a => a.ruleId === "Q07")).toBe(true);
    expect(classifyLines([textLine("Minutes: approved budget by someone")]).get("l1")?.some(a => ["Q06", "Q07", "Q08", "Q09"].includes(a.ruleId))).toBe(false);
  });
  it("Q15: empty source content is a blocked gap, never filled", () => {
    const apps = classifyLines([textLine("   ")]);
    const q15 = apps.get("l1")?.find(a => a.ruleId === "Q15");
    expect(q15?.qualificationClass).toBe("Blocked output / gap");
    expect(q15?.blockers.join(" ")).toContain("never invented");
  });
  it("Q16: multi-unit documents keep stable per-unit IDs; single-unit documents do not", () => {
    const multi = classifyLines([...tableLines(["A"], [["1"]], 1), ...tableLines(["B"], [["2"]], 2)].map((l, seq) => ({ ...l, seq })));
    expect(multi.get("table1:row2")?.find(a => a.ruleId === "Q16")?.present.join(" ")).toContain("table1:row2");
    const single = classifyLines(tableLines(["A"], [["1"]], 1));
    expect(single.get("table1:row1")?.some(a => a.ruleId === "Q16")).toBe(false);
  });
  it("Q12 and Q14 are never auto-applied to any source unit", () => {
    const apps = classifyLines([...tableLines(["Student", "Salary"], [["A", "100"]]), textLine("NAAC evidence narrative", { seq: 5, locator_key: "l9" })]);
    for (const list of apps.values()) {
      expect(list.some(a => a.ruleId === "Q12" || a.ruleId === "Q14")).toBe(false);
    }
  });
});

describe("v4 mandatory output-contract state", () => {
  it("every generated output carries fail-closed template/MIME/dimensions/approver/release", () => {
    const r = repairOutputSet([], tableLines(["Name", "Count"], [["A", "1"]]), manifest);
    expect(r.outputs.length).toBeGreaterThan(0);
    for (const o of r.outputs) expect(o.contract).toEqual(DRAFT_CONTRACT_STATE);
  });
  it("rejects any claimed approver, release, rendered dimensions or non-draft MIME", () => {
    expect(outputContractStateSchema.safeParse({ template: null, mimeType: "text/markdown", dimensions: null, approver: null, release: "not_authorized" }).success).toBe(true);
    expect(outputContractStateSchema.safeParse({ template: "news-v1", mimeType: "text/markdown", dimensions: null, approver: null, release: "not_authorized" }).success).toBe(false);
    expect(outputContractStateSchema.safeParse({ template: null, mimeType: "image/png", dimensions: null, approver: null, release: "not_authorized" }).success).toBe(false);
    expect(outputContractStateSchema.safeParse({ template: null, mimeType: "text/markdown", dimensions: { width: 1080, height: 1080 }, approver: null, release: "not_authorized" }).success).toBe(false);
    expect(outputContractStateSchema.safeParse({ template: null, mimeType: "text/markdown", dimensions: null, approver: "registrar@example.edu", release: "not_authorized" }).success).toBe(false);
    expect(outputContractStateSchema.safeParse({ template: null, mimeType: "text/markdown", dimensions: null, approver: null, release: "published" }).success).toBe(false);
  });
  it("qualification entries carry traceable rule applications and stay Candidate", () => {
    const r = repairOutputSet([], tableLines(["Decision ID", "Agenda item", "Decision wording", "Status"], [["D-1", "1", "Hold", "held"]]), manifest);
    const entry = r.qualification.find(q => q.locator === "table1:row2");
    expect(entry?.status).toBe("Candidate");
    expect(entry?.rules.some(a => a.ruleId === "Q08" && a.source.endsWith("!Q08"))).toBe(true);
    expect(entry?.rules.every(a => a.resolution === "applied")).toBe(true);
  });
  it("legacy stored payloads without rules or contract state still parse with fail-closed defaults", () => {
    const legacy = { type: "extraction_review", name: "n", title: "t", body: "b", qualification: [{ unitId: "u", locator: "l", ruleVersion: "iiaf-output-2.2", status: "Candidate", purpose: "p", audience: "a", channel: "c", relevance: "r", evidenceValue: "unverified", factualSupport: "source passage only", verification: "human review required", freshness: "not established", confidence: null, sensitivity: "not assessed", consent: "not established", contradiction: "not assessed", duplication: "not assessed", rationale: "r", destinations: [], blockers: [] }] };
    const parsed = generatedOutputSchema.parse(legacy);
    expect(parsed.contract).toEqual(DRAFT_CONTRACT_STATE);
    expect(parsed.qualification?.[0]?.rules).toEqual([]);
  });
});
