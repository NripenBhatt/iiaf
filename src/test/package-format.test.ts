import { describe, expect, it } from "vitest";
import { buildPackageContent, packageMarkdown, type Retrieval } from "@/lib/package-format";

const ev = (over: Partial<Retrieval["mappings"][number]["evidence"][number]> = {}) => ({ factId: "f1", documentId: "d1", filename: "a.pdf", documentSha256: "ab", reportingPeriod: "2025-26", value: "EV-0001", field: "Evidence_ID", locator: { page: 1, line: 2 }, method: "pdf v1.1.0", integrity: "trusted_processor", factState: "approved", identificationStatus: "approved", usable: true, reasons: [], ...over });
const base = (evidence = [ev()], status = "approved"): Retrieval => ({
  organizationId: "o", period: "2025-26", agency: { id: "AG-UGC", name: "UGC", authority: "University Grants Commission" },
  requirement: { recordId: "r", id: "UGC-REQ-005", sourceRow: 7, workbook: "w.xlsx", workbookSha256: "s", metric: "Equity compliance", level: "Metric", pillar: "Equity", description: "", officialLabel: "", mandatory: "Yes", validationRule: "", missingValueRule: "", mismatchRule: "", reportingPeriodRule: "", versionLock: "PENDING", humanVerification: "", notes: "", officialSource: "" },
  fields: [], conflicts: [],
  mappings: [{ mappingId: "MAP-00002", sourceRow: 3, evidenceId: "EV-0001", evidenceName: "", packageName: "", coverage: "", role: "", sourceMappingStatus: "", frameworkVersion: null, status, evidence }],
});

describe("requirement package", () => {
  it("indexes only usable evidence and numbers attachments", () => {
    const c = buildPackageContent(base([ev(), ev({ factId: "f2", usable: false, reasons: ["Fact is not human-approved"] })]));
    expect(c.evidenceIndex).toHaveLength(1);
    expect(c.attachments[0]).toMatchObject({ number: 1, filename: "a.pdf" });
    expect(c.evidenceIndex[0]!.locator).toBe("page 1, line 2");
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
});
