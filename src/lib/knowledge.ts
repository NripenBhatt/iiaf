import { z } from "zod";

export type KnowledgeJson = string | number | boolean | null | KnowledgeJson[] | { [key: string]: KnowledgeJson };
const jsonSchema: z.ZodType<KnowledgeJson> = z.lazy(() => z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonSchema), z.record(z.string(), jsonSchema)]));
export function knowledgeLocator(value: unknown): KnowledgeJson { return jsonSchema.parse(value); }

export const knowledgeQuerySchema = z.object({
  organizationId: z.string().uuid(),
  query: z.string().trim().max(200).default(""),
  period: z.string().trim().max(40).default(""),
  department: z.string().trim().max(120).default(""),
  offset: z.number().int().min(0).max(10000).default(0),
});
export type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;
export type KnowledgeDocument = { id: string; organization_id: string; original_filename: string; reporting_period: string | null; department_or_owner: string | null; sha256_hash: string; processing_status: string; uploaded_at: string | null };
export type KnowledgePassage = { documentId: string; jobId: string; locatorKey: string; locator: KnowledgeJson; content: string; method: string; parserVersion: string; seq: number };
export type KnowledgeFact = { id: string; organization_id: string; document_id: string; source_label: string; canonical_field: string | null; extracted_value: string; reviewed_value: string | null; state: string; integrity: string; locator_key: string; locator: unknown; segment_id: string };
export type KnowledgeConflict = { id: string; source_id: string; target_id: string; status: string };
/** Append-only human review trail; the correction/version history of a fact. */
export type KnowledgeReview = { fact_id: string; decision: string; previous_state: string | null; value: string | null; note: string | null; created_at: string };
export type KnowledgeSource = { documentId: string; filename: string; sha256: string; period: string | null; department: string | null; uploadedAt: string | null; classification: "DEMO" | "unverified" };

/** Retrieval is not verification. No missing dates, entities, approvals or conflict winners are inferred. */
export function buildKnowledgeBundle(input: { scope: KnowledgeQuery; documents: KnowledgeDocument[]; passages: KnowledgePassage[]; facts: KnowledgeFact[]; conflicts: KnowledgeConflict[]; reviews: KnowledgeReview[]; currentSegmentIds: string[]; organizationName: string; totalDocuments: number; incompleteDocuments: string[] }) {
  const { scope } = input;
  const owned = new Map(input.documents.filter(d => d.organization_id === scope.organizationId).map(d => [d.id, d]));
  const matchesScope = (d: KnowledgeDocument) => (!scope.period || d.reporting_period === scope.period) && (!scope.department || d.department_or_owner === scope.department);
  const words = scope.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matchesText = (text: string) => words.every(w => text.toLocaleLowerCase().includes(w));
  const source = (d: KnowledgeDocument): KnowledgeSource => ({ documentId: d.id, filename: d.original_filename, sha256: d.sha256_hash, period: d.reporting_period, department: d.department_or_owner, uploadedAt: d.uploaded_at, classification: /synthetic|demo|fictional|dummy|काल्पनिक|नमूना/i.test(`${input.organizationName} ${d.original_filename}`) ? "DEMO" : "unverified" });
  const current = new Set(input.currentSegmentIds);
  const endpoint = (id: string) => {
    const f = input.facts.find(x => x.id === id && x.organization_id === scope.organizationId);
    const d = f ? owned.get(f.document_id) : undefined;
    if (!f || !d) return { factId: id, available: false as const };
    return { factId: id, available: true as const, source: source(d), label: f.source_label, field: f.canonical_field, value: f.reviewed_value ?? f.extracted_value, state: f.state, integrity: f.integrity, currentExtraction: current.has(f.segment_id), locatorKey: f.locator_key, locator: knowledgeLocator(f.locator), usableForVerifiedCoverage: false as const };
  };
  const allPassages = input.passages.flatMap(p => {
    const d = owned.get(p.documentId);
    return d && matchesScope(d) && matchesText(`${d.original_filename} ${p.content}`) ? [{ ...p, source: source(d), citation: `${p.documentId}/${p.jobId}/${p.locatorKey}`, review: "human_review_required" as const, verified: false as const }] : [];
  });
  const facts = input.facts.filter(f => {
    const d = owned.get(f.document_id);
    return f.organization_id === scope.organizationId && d && matchesScope(d) && matchesText(`${f.source_label} ${f.reviewed_value ?? f.extracted_value}`);
  }).map(f => endpoint(f.id));
  const factIds = new Set(facts.map(f => f.factId));
  const conflicts = input.conflicts.filter(c => factIds.has(c.source_id) || factIds.has(c.target_id)).map(c => ({ id: c.id, status: c.status, resolution: "not_resolved_by_retrieval" as const, from: endpoint(c.source_id), to: endpoint(c.target_id) }));
  const periods = [...new Set([...allPassages.map(p => p.source.period), ...facts.flatMap(f => f.available ? [f.source.period] : [])])].sort((a, b) => (a ?? "").localeCompare(b ?? ""));
  const gaps: string[] = [];
  if (!allPassages.length && !facts.length) gaps.push("No matching stored evidence in this document page; absence is not a finding about the institution.");
  if (input.incompleteDocuments.length) gaps.push(`${input.incompleteDocuments.length} source document(s) have no eligible stored extraction; no processing was rerun.`);
  if (periods.includes(null) || periods.includes("")) gaps.push("Some sources have no recorded reporting period; upload time is not substituted.");
  if (conflicts.length) gaps.push("Conflicting evidence is preserved; no value has been selected as authoritative.");
  if (scope.offset + 20 < input.totalDocuments) gaps.push("More document pages remain; this is not an exhaustive institutional answer.");
  if (allPassages.length > 100) gaps.push("Passage display is limited to 100 matches within this document page.");
  return { schema: "iiaf-knowledge/1" as const, scope, temporalSemantics: scope.period ? "exact_recorded_reporting_period" : "recorded_periods_separate_not_as_of", periods, passages: allPassages.slice(0, 100), passageMatches: allPassages.length, facts, conflicts, gaps, page: { offset: scope.offset, limit: 20, totalDocuments: input.totalDocuments, hasMore: scope.offset + 20 < input.totalDocuments }, release: "not_authorized" as const, limitations: ["Stored source text is not verified evidence. Review, mappings and privacy checks are separate.", "No valid-time/as-of inference, entity merge, automatic conflict resolution or OCR was performed.", "Facts from earlier extraction snapshots are labelled historical, not promoted to current evidence."] };
}
export type KnowledgeBundle = ReturnType<typeof buildKnowledgeBundle>;