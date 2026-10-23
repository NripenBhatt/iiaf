import { describe, expect, it } from "vitest";
import { buildPackageContent, packageMarkdown, locatorText, type Retrieval } from "@/lib/package-format";

const ev = (over: Partial<Retrieval["mappings"][number]["evidence"][number]> = {}) => ({ factId: "f1", documentId: "d1", filename: "a.pdf", documentSha256: "ab", reportingPeriod: "2025-26", value: "EV-0001", field: "Evidence_ID", locator: { page: 1, line: 2 }, method: "pdf v1.1.0", integrity: "trusted_processor", factState: "approved", identificationStatus: "approved", usable: true, reasons: [], ...over });
const base = (evidence = [ev()], status = "approved"): Retrieval => ({
  organizationId: "o", period: "2025-26", agency: { id: "AG-UGC", name: "UGC", authority: "University Grants Commission" },
  requirement: { recordId: "r", id: "UGC-REQ-005", sourceRow: 7, workbook: "w.xlsx", workbookSha256: "s", metric: "Equity compliance", level: "Metric", pillar: "Equity", description: "", officialLabel: "", mandatory: "Yes", validationRule: "", missingValueRule: "", mismatchRule: "", reportingPeriodRule: "", versionLock: "PENDING", humanVerification: "", notes: "", officialSource: "" },
  fields: [], conflicts: [],
  mappings: [{ mappingId: "MAP-00002", sourceRow: 3, evidenceId: "EV-0001", evidenceName: "", packageName: "", coverage: "", role: "", sourceMappingStatus: "", frameworkVersion: null, status, evidence }],
});

describe("requirement package", () => {
  it("retains nested cell and merge provenance without object coercion", () => {
    const text = locatorText({ row: 2, cells: [{ ref: "A2", mergeOrigin: "A1" }] });
    expect(text).toContain('"ref":"A2"'); expect(text).toContain('"mergeOrigin":"A1"'); expect(text).not.toContain("[object Object]");
  });
  it("indexes only usable evidence and numbers attachments", () => {
    const c = buildPackageContent(base([ev(), ev({ factId: "f2", usable: false, reasons: ["Fact is not human-approved"] })]));
    expect(c.evidenceIndex).toHaveLength(1);
    expect(c.attachments[0]).toMatchObject({ number: 1, filename: "a.pdf" });
    expect(c.evidenceIndex[0]?.locator).toBe("page 1, line 2");
    expect(c.issues.some(i => i.includes("Fact is not human-approved"))).toBe(true);
  });
  it("never uses a candidate mapping as approved", () => {
    const c = buildPackageContent(base([ev({ usable: false, reasons: ["Requirement mapping is not approved"] })], "candidate"));
    expect(c.evidenceIndex).toHaveLength(0);
    expect(c.issues).toContain("MAP-00002: mapping is candidate, not approved; it cannot support this package.");
  });
  it("is deterministic so unchanged records keep the same hash", () => {
    expect(JSON.stringify(buildPackageContent(base()))).toBe(JSON.stringify(buildPackageContent(base())));
  });
  it("labels output as draft without certification", () => {
    const md = packageMarkdown(buildPackageContent(base()), { version: 1, sha256: "x", generatedAt: "t", status: "draft" });
    expect(md).toContain("DRAFT");
    expect(md).toContain("Registrar certification is not implemented");
  });

  const field = (canonicalMapping: string | null, canonicalMappingStatus: string) => ({ id: "UGC-F-1", sourceRow: 2, label: "Evidence reference", dataType: "Text", unit: null, mandatory: "Yes", frameworkVersion: "v1", reportingPeriod: "", fieldLevel: "", versionLock: "", officialSource: "", canonicalMapping, canonicalMappingStatus });
  it("populates a field only through an approved canonical mapping", () => {
    const c = buildPackageContent({ ...base(), fields: [field("Evidence_ID", "approved")] });
    expect(c.dataTable[0]?.value).toBe("EV-0001");
  });
  it("leaves a candidate-mapped field unpopulated", () => {
    const c = buildPackageContent({ ...base(), fields: [field(null, "candidate")] });
    expect(c.dataTable[0]?.value).toBeNull();
    expect(c.dataTable[0]?.valueStatus).toContain("candidate, not approved");
  });
  it("keeps a value missing when no approved fact exists instead of inventing one", () => {
    const c = buildPackageContent({ ...base([ev({ usable: false, reasons: ["Fact is not human-approved"] })]), fields: [field("Evidence_ID", "approved")] });
    expect(c.dataTable[0]?.value).toBeNull();
    expect(c.dataTable[0]?.valueStatus).toMatch(/^Missing/);
  });
  it("does not choose between conflicting approved values", () => {
    const c = buildPackageContent({ ...base([ev(), ev({ factId: "f2", value: "EV-0002" })]), fields: [field("Evidence_ID", "approved")] });
    expect(c.dataTable[0]?.value).toBeNull();
    expect(c.dataTable[0]?.valueStatus).toContain("conflicting");
  });
  it("does not merge equal values from distinct recorded periods", () => {
    const c = buildPackageContent({ ...base([ev(), ev({ factId: "f2", reportingPeriod: "2024-25" })]), period: "", fields: [field("Evidence_ID", "approved")] });
    expect(c.dataTable[0]?.value).toBeNull();
    expect(c.dataTable[0]?.sources.map(s => s.reportingPeriod)).toEqual(["2025-26", "2024-25"]);
    expect(c.temporalSemantics).toBe("recorded_periods_separate_not_as_of");
  });
  it("stores both conflict endpoints and retains their values and locators in downloads", () => {
    const source = { factId: "f1", available: true, value: "10", reportingPeriod: "2025-26", filename: "a.pdf", locator: { page: 1 }, state: "approved", integrity: "trusted_processor" };
    const target = { ...source, factId: "f2", value: "20", filename: "b.pdf", locator: { page: 2 } };
    const c = buildPackageContent({ ...base(), conflicts: [{ from: "Count", to: "Count", status: "candidate", source, target }] });
    expect(c.conflicts[0]?.source).toEqual(source); expect(c.conflicts[0]?.target).toEqual(target);
    const md = packageMarkdown(c, { version: 1, sha256: "x", generatedAt: "t", status: "draft" });
    expect(md).toContain("value 10"); expect(md).toContain("value 20"); expect(md).toContain("page 2");
  });
});
