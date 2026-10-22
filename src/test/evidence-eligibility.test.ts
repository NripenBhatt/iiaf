import { describe, expect, it } from "vitest";
import { evidenceExclusions } from "@/lib/evidence-eligibility";
const base = { factState: "approved", integrity: "trusted_processor", segmentId: "current", currentSegmentIds: new Set(["current"]), filename: "record.pdf", organizationName: "University", hasConflict: false };
describe("Phase 3 package evidence safety", () => {
  it("rejects stale source facts without changing approved records", () => { expect(evidenceExclusions({ ...base, segmentId: "previous" })).toContain("Fact belongs to an earlier or unavailable extraction snapshot"); });
  it("preserves unresolved contradictions instead of selecting a winner", () => { expect(evidenceExclusions({ ...base, hasConflict: true })).toContain("Conflicting evidence requires a separate resolution; retrieval cannot select a winner"); });
  it("prevents even approved synthetic fixtures from supporting verified coverage", () => { expect(evidenceExclusions({ ...base, organizationName: "IIAF Test University A SYNTHETIC DEMO" })).toContain("Synthetic DEMO evidence cannot support verified institutional coverage"); });
  it("requires human approval and trusted processing independently", () => { expect(evidenceExclusions({ ...base, factState: "proposed", integrity: "unverified_legacy" })).toEqual(["Fact is not human-approved", "Extraction result is not from the trusted processor"]); });
  it("does not exclude current trusted human-approved non-demo records", () => { expect(evidenceExclusions(base)).toEqual([]); });
});