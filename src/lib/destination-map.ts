import destinations from "@/data/destination-catalogue.json";
import { OUTPUT_REFERENCE, RECONCILED_OUTPUT_CATALOGUE } from "./output-reference";
import type { GeneratedOutput } from "./output-contract";

export type MapStatus = "Qualified" | "Candidate mapping" | "Review required" | "Approved mapping" | "Persisted" | "Output generated" | "Unsupported" | "Not applicable" | "Blocked by authorization" | "Failed";
export type MapCard = { key: string; item: string; locator: string | null; destinationCode: string | null; destinationName: string; identifier: string | null; status: MapStatus; reason: string; persisted: boolean; created: boolean };

const DEST = new Map(destinations.destinations.map(d => [d.Destination_Code, d]));
const CAT = new Map(OUTPUT_REFERENCE.outputs.map(o => [o.Output_ID, o]));
export const destinationName = (code: string | null) => (code && DEST.get(code)?.Destination_Name) || "Not catalogued";

type SetLike = { outputs: GeneratedOutput[]; skipped: { name: string; reason: string }[] };
type LineageLike = { facts: { id: string; source_label: string; extracted_value: string; state: string; locator_key: string; canonical_field: string | null }[]; relationships: { id: string; relation_type: string; target_type: string; target_label: string; rule_id: string; status: string }[] } | null;

/** Truthful mapping cards: qualification ≠ approved mapping ≠ persisted record ≠ generated output. */
export function mappingCards(set: SetLike | null, lineage: LineageLike, requested: string[] = []): MapCard[] {
  const cards: MapCard[] = [];
  for (const o of set?.outputs ?? []) {
    const cat = o.catalogue?.catalogueId ? CAT.get(o.catalogue.catalogueId) : undefined;
    const contractOnly = !cat && o.catalogue?.contractId;
    cards.push({ key: `out-${o.type}`, item: o.name, locator: o.manifest?.locators.slice(0, 3).join(", ") ?? null, destinationCode: cat?.Primary_Destination ?? null, destinationName: !o.catalogue ? "Legacy draft — saved before catalogue binding was recorded; no destination claimed" : contractOnly ? `Review output only — Blueprint contract ${o.catalogue!.contractId}; no OUT-001…030 catalogue entry` : destinationName(cat?.Primary_Destination ?? null), identifier: [o.catalogue?.catalogueId, o.catalogue?.contractId].filter(Boolean).join(" · ") || null, status: "Output generated", reason: contractOnly ? "Correctly uncatalogued: the 30-entry output catalogue has no extraction-review or table-extraction output, so this review draft is not mapped to a publication destination. Saved from stored text; not approved." : "Review-labelled draft saved from stored source text; not approved or released.", persisted: true, created: true });
  }
  const rules = new Map<string, { cls: string; locators: string[]; resolution: string; missing: string[] }>();
  for (const q of set?.outputs[0]?.qualification ?? []) for (const r of q.rules) {
    const e = rules.get(r.ruleId) ?? { cls: r.qualificationClass, locators: [], resolution: r.resolution, missing: r.missing };
    e.locators.push(q.locator); rules.set(r.ruleId, e);
  }
  for (const [id, r] of rules) cards.push({ key: `rule-${id}`, item: r.cls, locator: r.locators.slice(0, 3).join(", ") + (r.locators.length > 3 ? ` +${r.locators.length - 3}` : ""), destinationCode: null, destinationName: "Qualification engine", identifier: id, status: r.resolution === "applied" ? "Qualified" : "Unsupported", reason: r.resolution === "applied" ? "Source signal matched; candidate only, human review required." : `Rule ${r.resolution}${r.missing.length ? `; missing: ${r.missing.join(", ")}` : ""}.`, persisted: false, created: false });
  for (const f of lineage?.facts ?? []) cards.push({ key: `fact-${f.id}`, item: `${f.source_label}: ${f.extracted_value}`, locator: f.locator_key, destinationCode: "DST-001", destinationName: destinationName("DST-001"), identifier: f.canonical_field, status: f.state === "approved" ? "Approved mapping" : f.state === "rejected" ? "Not applicable" : "Review required", reason: f.state === "approved" ? "Reviewer approved this fact." : `Proposed fact stored (state: ${f.state}); not approved evidence.`, persisted: true, created: false });
  for (const r of lineage?.relationships ?? []) cards.push({ key: `rel-${r.id}`, item: `${r.relation_type} → ${r.target_label}`, locator: null, destinationCode: null, destinationName: r.target_type, identifier: r.rule_id, status: r.status === "approved" ? "Persisted" : "Candidate mapping", reason: `Stored relationship (status: ${r.status}).`, persisted: true, created: false });
  for (const s of set?.skipped ?? []) cards.push({ key: `skip-${s.name}`, item: s.name, locator: null, destinationCode: null, destinationName: "Output engine", identifier: null, status: /authori/i.test(s.reason) ? "Blocked by authorization" : "Unsupported", reason: s.reason, persisted: false, created: false });
  for (const id of requested) {
    const entry = RECONCILED_OUTPUT_CATALOGUE.find(e => e.Output_ID === id);
    if (!entry) continue;
    const made = (set?.outputs ?? []).some(o => o.catalogue?.catalogueId === id);
    if (!made) cards.push({ key: `req-${id}`, item: `Requested: ${entry.Output_Name}`, locator: null, destinationCode: entry.Primary_Destination, destinationName: destinationName(entry.Primary_Destination), identifier: id, status: "Unsupported", reason: entry.support === "blocked" ? entry.reason : "This source did not qualify for a draft of this output.", persisted: false, created: false });
  }
  return cards;
}

/** Consolidated multi-file review: each line keeps its file and locator; nothing is merged or invented. */
export function consolidatedReview(sets: { name: string; documentId: string; set: SetLike }[]) {
  const parts = sets.map(s => {
    const review = s.set.outputs.find(o => o.type === "extraction_review");
    return `## ${s.name} (document ${s.documentId})\n${review ? review.body.split("\n").map(l => `[${s.name}] ${l}`).join("\n") : "No stored extraction review available."}`;
  });
  return `CONSOLIDATED SOURCE REVIEW — DRAFT, NOT APPROVED\nFiles: ${sets.length}. Each line cites its source file and locator. Conflicts between files are not resolved here; review required.\n\n${parts.join("\n\n")}`;
}
