/** Read-time guard only; transactional invalidation and correction policy remain separate. */
export function evidenceExclusions(input: { factState: string | null; integrity: string | null; segmentId: string | null; currentSegmentIds: ReadonlySet<string>; filename: string; organizationName: string; hasConflict: boolean }) {
  const reasons: string[] = [];
  if (!input.segmentId || !input.currentSegmentIds.has(input.segmentId)) reasons.push("Fact belongs to an earlier or unavailable extraction snapshot");
  if (input.hasConflict) reasons.push("Conflicting evidence requires a separate resolution; retrieval cannot select a winner");
  if (/synthetic|demo|fictional|dummy|काल्पनिक|नमूना/i.test(`${input.organizationName} ${input.filename}`)) reasons.push("Synthetic DEMO evidence cannot support verified institutional coverage");
  if (!["approved", "corrected"].includes(input.factState ?? "")) reasons.push("Fact is not human-approved");
  if (input.integrity !== "trusted_processor") reasons.push("Extraction result is not from the trusted processor");
  return reasons;
}