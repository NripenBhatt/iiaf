import reference from "@/data/output-reference-catalogue.json";

/** Verbatim catalogue references, not approved evidence bindings or access grants. */
export const OUTPUT_REFERENCE = reference;
export type OutputSupport = "source-review" | "stored-draft-only" | "blocked";
export type OutputBinding = { catalogueId: string | null; contractId: string | null; support: OutputSupport; reason: string };
const mappings: Record<string, [string | null, string | null]> = {
  extraction_review: [null, "O13"], structured_tables: [null, "O10"],
  press_release: ["OUT-008", "O01"], website_event: ["OUT-008", "O02"], website_content: ["OUT-023", "O02"],
  linkedin: ["OUT-009", null], facebook: ["OUT-009", null], instagram: ["OUT-009", null], x_post: ["OUT-009", null],
  reel_script: ["OUT-010", "O05"], social_image: ["OUT-009", "O03"], carousel: ["OUT-009", "O04"],
  profile_section: ["OUT-001", null], decisions: ["OUT-006", "O08"], action_items: ["OUT-007", "O09"],
  agenda_summary: ["OUT-005", "O06"], meeting_report: ["OUT-006", "O07"],
};
const internalDrafts = new Set(["document_summary", "event_summary", "meeting_summary", "follow_up", "evidence_note"]);
const structuredOrRendered = new Set(["reel_script", "social_image", "carousel", "decisions", "action_items", "agenda_summary", "meeting_report"]);
export function outputBinding(type: string): OutputBinding {
  const mapping = mappings[type];
  if (!mapping && !internalDrafts.has(type)) return { catalogueId: null, contractId: null, support: "blocked", reason: "Unknown output type; no reconciled catalogue contract." };
  const [catalogueId, contractId] = mapping ?? [null, null];
  if (structuredOrRendered.has(type)) return { catalogueId, contractId, support: "blocked", reason: "Required structured register, agenda/minutes fields or visual package not validated; prose alone does not satisfy this contract." };
  return { catalogueId, contractId, support: ["extraction_review", "structured_tables"].includes(type) ? "source-review" : "stored-draft-only", reason: "Draft review/export only; catalogue reference is not approval, verified coverage or public release. New authored content is not generated." };
}

/** All 30 source entries are accounted for, even when unavailable in this phase. */
export const RECONCILED_OUTPUT_CATALOGUE = reference.outputs.map(entry => {
  const variants = Object.keys(mappings).filter(type => mappings[type]?.[0] === entry.Output_ID);
  const hasDraft = variants.some(type => outputBinding(type).support === "stored-draft-only");
  return { ...entry, variants, support: hasDraft ? "stored-draft-only" as const : "blocked" as const, reason: hasDraft ? "Partial draft variants only; all original generation/release gates still apply." : "Not implemented in this phase; requires catalogue inputs, gates and authorization. No output is fabricated." };
});