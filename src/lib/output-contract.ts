import { z } from "zod";
import { outputBinding } from "./output-reference";
import { meetingSchema, structuredMeetings } from "./meeting-contract";
import { classifyLines, ruleApplicationSchema } from "./qualification-rules";

export const CONTRACT_VERSION = "iiaf-output-2.3";
export const sourceCellSchema = z.object({ column: z.number(), ref: z.string(), raw: z.string(), value: z.string(), formula: z.string().nullable(), type: z.string().nullable(), columnSpan: z.number().optional(), rowSpan: z.number().optional(), verticalMerge: z.string().optional(), mergeOrigin: z.string().nullable().optional() });
export const tableRowSchema = z.object({ locator: z.string(), row: z.number(), cells: sourceCellSchema.array() });
export const tableSchema = z.object({ id: z.string(), name: z.string(), parentCell: z.string().nullable().optional(), rows: tableRowSchema.array() });
export const manifestSchema = z.object({ documentId: z.string(), jobId: z.string(), originalHash: z.string(), parserVersion: z.string(), contractVersion: z.string(), classification: z.enum(["DEMO", "unverified"]), approval: z.literal("draft"), locators: z.string().array(), verifiedCoverage: z.literal(false) });
export const qualificationSchema = z.object({ unitId: z.string(), locator: z.string(), ruleVersion: z.string(), status: z.literal("Candidate"), purpose: z.string(), audience: z.string(), channel: z.string(), relevance: z.string(), evidenceValue: z.literal("unverified"), factualSupport: z.literal("source passage only"), verification: z.literal("human review required"), freshness: z.literal("not established"), confidence: z.null(), sensitivity: z.literal("not assessed"), consent: z.literal("not established"), contradiction: z.literal("not assessed"), duplication: z.literal("not assessed"), rationale: z.string(), destinations: z.string().array(), blockers: z.string().array(), rules: ruleApplicationSchema.array().default([]) });
/**
 * v4 output contract (Detailed Concept Note v4.0, "Output contract", page 7): template/version,
 * format/MIME, dimensions, approver and release state are mandatory on every output. Draft
 * outputs fail closed: no template selected, stored body is markdown text, no rendered
 * image/video asset exists, no approver, release not authorized. Literal/null schema members
 * make any stronger claim unparseable.
 */
export const outputContractStateSchema = z.object({ template: z.null(), mimeType: z.literal("text/markdown"), dimensions: z.null(), approver: z.null(), release: z.literal("not_authorized") });
export const DRAFT_CONTRACT_STATE: z.infer<typeof outputContractStateSchema> = { template: null, mimeType: "text/markdown", dimensions: null, approver: null, release: "not_authorized" };
export const generatedOutputSchema = z.object({ type: z.string(), name: z.string(), title: z.string(), body: z.string(), meeting: meetingSchema.optional(), tables: tableSchema.array().optional(), manifest: manifestSchema.optional(), qualification: qualificationSchema.array().optional(), catalogue: z.object({ catalogueId: z.string().nullable(), contractId: z.string().nullable(), support: z.enum(["source-review", "stored-draft-only", "blocked"]), reason: z.string() }).optional(), contract: outputContractStateSchema.default(DRAFT_CONTRACT_STATE) });
export type GeneratedOutput = z.infer<typeof generatedOutputSchema>;
export type SourceLine = { seq: number; locator_key: string; content: string; locator: unknown; method_version: string; method?: string | null };
export type SourceManifest = z.infer<typeof manifestSchema>;

/** Candidates only: source structure is not approval, consent, or official evidence. */
export function qualify(lines: SourceLine[]) {
  return lines.map(l => {
    const structured = z.object({ cells: sourceCellSchema.array() }).safeParse(l.locator).success;
    return qualificationSchema.parse({ unitId: l.locator_key, locator: l.locator_key, ruleVersion: CONTRACT_VERSION, status: "Candidate", purpose: structured ? "table review" : "source review", audience: "authorized workspace reviewers", channel: "internal draft", relevance: structured ? "source table" : "source passage", evidenceValue: "unverified", factualSupport: "source passage only", verification: "human review required", freshness: "not established", confidence: null, sensitivity: "not assessed", consent: "not established", contradiction: "not assessed", duplication: "not assessed", rationale: structured ? "Stored cells retain source row/column identity; headers and semantic roles need review." : "Stored text supports a source-linked draft, not verified evidence.", destinations: ["extraction_review", ...(structured ? ["structured_tables"] : [])], blockers: ["Human verification required", "Public release and outreach not authorized", "Official mapping requires exact authoritative edition/requirement"] });
  });
}

export function sourceTables(lines: SourceLine[]) {
  const tables = new Map<string, z.infer<typeof tableSchema>>();
  for (const l of lines) {
    const p = z.object({ cells: sourceCellSchema.array(), row: z.number(), sheet: z.string().optional(), table: z.number().optional(), parent_cell: z.string().nullable().optional() }).safeParse(l.locator);
    if (!p.success) continue;
    const id = p.data.sheet ?? (p.data.table ? `table${p.data.table}` : "csv");
    const table = tables.get(id) ?? { id, name: id, parentCell: p.data.parent_cell, rows: [] };
    table.rows.push({ locator: l.locator_key, row: p.data.row, cells: p.data.cells }); tables.set(id, table);
  }
  return [...tables.values()];
}

/** Historical copy is reused, never regenerated; prohibited formats/content stay blocked. */
export function repairOutputSet(previous: GeneratedOutput[], lines: SourceLine[], manifest: SourceManifest) {
  const tables = sourceTables(lines); const qualification = qualify(lines);
  const text = lines.map(l => `[${l.locator_key}] ${l.content}`).join("\n");
  const agendaOnly = /agenda|कार्यसूची/i.test(text) && !/minutes|proceedings|कार्यवृत्त|निर्णय|resolution|resolved/i.test(text);
  const hasDatedEvent = /workshop|conference|event|seminar|कार्यशाला|सम्मेलन/i.test(text) && /\b20\d{2}\b/.test(text);
  const skipped: { name: string; reason: string }[] = [];
  const outputs: GeneratedOutput[] = [];
  for (const o of previous) {
    const binding = outputBinding(o.type);
    let reason = "";
    if (/image|carousel|video/.test(o.type) && o.type !== "reel_script") reason = "BLOCKED: no approved renderer or validated image/video artifact.";
    else if (agendaOnly && ["decisions", "action_items", "meeting_report", "follow_up", "meeting_summary"].includes(o.type)) reason = "Agenda alone cannot support minutes, attendance, decisions or completion.";
    else if (["press_release", "website_event", "event_summary"].includes(o.type) && !hasDatedEvent) reason = "No adequately dated event signal; news is not forced.";
    else if (/[\u0900-\u097f]/.test(text) && !/[\u0900-\u097f]/.test(o.body)) reason = "Source contains Hindi; historical translation cannot satisfy source-language preservation.";
    else if (/upcoming|will take place|took place|was held/i.test(o.body)) reason = "Historical copy asserts event occurrence/status without verification; use the stored source review.";
    if (!reason && binding.support === "blocked") reason = `BLOCKED: ${binding.reason}`;
    const characterLimit = { linkedin: 1200, facebook: 800, x_post: 270 }[o.type as "linkedin" | "facebook" | "x_post"];
    if (!reason && characterLimit && Array.from(o.body).length > characterLimit) reason = `Channel limit exceeded (${characterLimit} characters); stored copy is not silently rewritten.`;
    if (reason) { skipped.push({ name: o.name, reason }); continue; }
    if (["extraction_review", "structured_tables"].includes(o.type)) continue;
    outputs.push({ ...o, manifest, qualification, catalogue: binding });
  }
  outputs.push({ type: "extraction_review", name: "Stored extraction review", title: "Stored source text — human review required", body: text, manifest, qualification, catalogue: outputBinding("extraction_review") });
  if (tables.length) outputs.push({ type: "structured_tables", name: "Source tables", title: "Source tables — headers and values require review", body: "Source cells are retained verbatim. No calculated values, inferred owners, decisions or approved evidence.", tables, manifest, qualification, catalogue: outputBinding("structured_tables") });
  for (const draft of structuredMeetings(lines)) {
    outputs.push({ type: draft.kind, name: `${draft.meeting.contractId} structured draft`, title: `${draft.kind.replace(/_/g, " ")} — human review required`, body: draft.body, meeting: draft.meeting, tables: tables.filter(t => t.rows.some(r => draft.meeting.records.some(record => record.locator === r.locator))), manifest, qualification, catalogue: outputBinding(draft.kind, true) });
  }
  for (const name of ["Social image creative", "Carousel", "Rendered video"]) skipped.push({ name, reason: "BLOCKED: no approved renderer; captions and scripts are not image/video artifacts." });
  return { outputs, skipped, limitations: ["Unapproved source-review drafts; no publication, consent or verified readiness established.", ...(tables.length ? ["Table headers, units and semantic roles require review; stored formulas are not executed."] : ["No cell structure in this stored extraction; flattened historical/OCR tables remain partial. Reprocessing requires explicit authorization."]), "Structured meeting drafts require explicit headers; prose-only, missing and ambiguous fields are not inferred. PDF/XLSX meeting renderings are not implemented. Official requirement mappings remain outside this phase."], segmentCount: lines.length, qualification, manifest, contractVersion: CONTRACT_VERSION };
}