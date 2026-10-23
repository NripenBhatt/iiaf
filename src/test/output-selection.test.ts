import { describe, expect, it } from "vitest";
import { selectedDrafts, selectionKeySuffix, selectionOutcomes } from "@/lib/output-selection";
import { repairOutputSet } from "@/lib/output-contract";
import type { SourceLine } from "@/lib/output-contract";

const lines: SourceLine[] = [
  { seq: 0, locator_key: "table3:row1", content: "Action / Deliverable | Responsible person / office | Target date | Status", method_version: "p1", locator: { table: 3, row: 1, cells: ["Action / Deliverable", "Responsible person / office", "Target date", "Status"].map((value, i) => ({ column: i + 1, ref: `R1C${i + 1}`, value, raw: value, formula: null, type: "text" })) } },
  { seq: 1, locator_key: "table3:row2", content: "Share the revised concept note | [Nodal Officer] | 28 Oct 2026 | Pending — sample", method_version: "p1", locator: { table: 3, row: 2, cells: ["Share the revised concept note", "[Nodal Officer]", "28 Oct 2026", "Pending — sample"].map((value, i) => ({ column: i + 1, ref: `R2C${i + 1}`, value, raw: value, formula: null, type: "text" })) } },
];
const manifest = { documentId: "d1", jobId: "j1", originalHash: "hash", parserVersion: "p1", contractVersion: "iiaf-output-2.2", classification: "DEMO" as const, approval: "draft" as const, verifiedCoverage: false as const, locators: lines.map(l => l.locator_key) };
describe("saved selections and existing meeting generation", () => {
  it("produces the actual uploaded action header values with cell provenance without inferring decisions", () => {
    const set = repairOutputSet([], lines, manifest);
    const actions = set.outputs.find(o => o.type === "action_items");
    expect(actions?.meeting?.records[0]?.fields["action"]?.[0]).toEqual({ value: "Share the revised concept note", locator: "table3:row2", cell: "R2C1" });
    expect(actions?.meeting?.records[0]?.fields["owner"]?.[0]?.value).toBe("[Nodal Officer]");
    expect(actions?.meeting?.records[0]?.missing).toEqual(["meeting", "decision", "completionProof"]);
    expect(set.outputs.some(o => o.type === "decisions")).toBe(false);
  });
  it("selection OUT-007 saves action drafts and keeps review artifacts separate", () => {
    const outputs = selectedDrafts(repairOutputSet([], lines, manifest).outputs, ["OUT-007"]);
    expect(outputs.map(o => o.type)).toEqual(["extraction_review", "structured_tables", "action_items"]);
    expect(selectedDrafts(outputs, ["OUT-008"]).some(o => o.type === "action_items")).toBe(false);
    expect(selectionOutcomes(["OUT-007", "OUT-008"], outputs).map(o => o.status)).toEqual(["generated_saved", "not_supported"]);
  });
  it("different selections cannot reuse an unrelated saved output set", () => {
    expect(selectionKeySuffix(["OUT-007", "OUT-005", "OUT-007"])).toBe(selectionKeySuffix(["OUT-005", "OUT-007"]));
    expect(selectionKeySuffix(["OUT-007"])).not.toBe(selectionKeySuffix(["OUT-008"]));
    expect(selectionKeySuffix([])).toBe("");
  });
});