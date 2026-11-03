import { OUTPUT_REFERENCE, outputBinding } from "./output-reference";
import { classifyLines } from "./qualification-rules";
import { structuredMeetings } from "./meeting-contract";
import type { GeneratedOutput, SourceLine } from "./output-contract";
import { eventContent } from "./source-authored";

export type OutputOpportunity = {
  key: string; name: string; type: string; catalogueId: string | null; contractId: string | null;
  ruleIds: string[]; locators: string[]; reason: string; missing: string[];
  supported: boolean; generated: boolean; persisted: boolean; dependency: string | null;
  artifact: boolean; requested: boolean;
};
const GATE = "Versioned source-linked draft generation is available where the required source category exists. Approval, public release, privacy and official mapping remain separate gates.";
const routes: Record<string, string[]> = {
  "OUT-001": ["Q01"], "OUT-005": ["Q06"], "OUT-006": ["Q07", "Q08"], "OUT-007": ["Q09"],
  "OUT-008": ["Q02"], "OUT-009": ["Q01", "Q02"], "OUT-010": ["Q02"],
  "OUT-011": ["Q01", "Q02"], "OUT-015": ["Q01", "Q10", "Q11"],
  "OUT-017": ["Q12"], "OUT-018": ["Q12"], "OUT-021": ["Q10", "Q11"],
  "OUT-022": ["Q12"], "OUT-023": ["Q01"], "OUT-026": ["Q02"],
};
const variants: Record<string, string[]> = {
  "OUT-001": ["profile_section"], "OUT-005": ["agenda_summary"], "OUT-006": ["meeting_report", "decisions"], "OUT-007": ["action_items"],
  "OUT-008": ["news_article"], "OUT-009": ["linkedin", "facebook", "instagram", "x_post", "image_creative"],
  "OUT-010": ["reel_script"], "OUT-011": ["linkedin_article"], "OUT-015": ["annual_report"], "OUT-023": ["website_content"],
};
const ruleForType: Record<string, string[]> = { agenda_summary: ["Q06"], meeting_report: ["Q07"], decisions: ["Q08"], action_items: ["Q09"] };
const visualDependency: Record<string, string> = {
  social_image: "No persisted PNG/JPG artifact contract or authorized storage/render path exists. Browser Canvas can render locally without provider charges, but a local image is not a persisted deliverable; channel dimensions, layout and lineage/storage contract need review.",
  carousel: "No ordered multi-image artifact/lineage contract or persistence path exists. Local rendering does not establish saved carousel capability.",
  reel_script: "No validated timed-storyboard authoring path exists. Video encoding is unavailable in the deployed runtime; sandbox ffmpeg is not a deployed renderer. Script, storyboard and encoded video must remain distinct.",
};

/** Evaluate all actual catalogue definitions; conservative opportunities are not approved bindings.
 * Requested IDs add entries, never filter automatic discovery. Q13 is a caution, not a blocker.
 * Saved outputs, not qualification cards or rendered previews, establish generation/persistence.
 */
export function discoverOutputOpportunities(lines: SourceLine[], outputs: GeneratedOutput[] = [], requested: string[] = [], sourceName = ""): OutputOpportunity[] {
  const applications = classifyLines(lines, sourceName);
  const meetings = structuredMeetings(lines);
  const found: OutputOpportunity[] = [];
  for (const entry of OUTPUT_REFERENCE.outputs) {
    const ids = routes[entry.Output_ID] ?? [];
    const matches = lines.filter(l => applications.get(l.locator_key)?.some(r => ids.includes(r.ruleId) && r.resolution === "applied"));
    const requestedEntry = requested.includes(entry.Output_ID);
    const saved = outputs.filter(o => o.catalogue?.catalogueId === entry.Output_ID);
    if (!matches.length && !requestedEntry && !saved.length) continue;
    for (const type of variants[entry.Output_ID] ?? [entry.Output_ID]) {
      const relevant = ruleForType[type] ? matches.filter(l => applications.get(l.locator_key)?.some(r => ruleForType[type]?.includes(r.ruleId))) : matches;
      const actual = saved.find(o => o.type === type);
      if (!relevant.length && !requestedEntry && !actual) continue;
      const rules = relevant.flatMap(l => applications.get(l.locator_key) ?? []).filter(r => (ruleForType[type] ?? ids).includes(r.ruleId));
      const supported = meetings.some(m => m.kind === type)|| (!!eventContent(lines,lines.map((_,i)=>`read:${i}`))&&["OUT-008","OUT-009","OUT-010","OUT-011","OUT-012","OUT-013","OUT-014","OUT-026","OUT-029"].includes(entry.Output_ID)&&type!=="image_creative");
      const restricted = /Company|internal/i.test(entry.Default_Access_Class);
      const dependency = actual ? null : restricted ? "Company-restricted catalogue output; University A must not generate it. Required authorized source/field bindings and an allowed output contract are absent." : visualDependency[type] ?? (supported ? null : !relevant.length ? "No implemented source qualification/authoring contract matches this requested definition. Exact source inputs and reviewed behavior are required." : GATE);
      found.push({ key: `${entry.Output_ID}:${type}`, name: entry.Output_Name, type, catalogueId: entry.Output_ID,
        contractId: actual?.catalogue?.contractId ?? outputBinding(type, supported).contractId,
        ruleIds: [...new Set(rules.map(r => r.ruleId))], locators: actual?.manifest?.locators ?? relevant.map(l => l.locator_key),
        reason: relevant.length ? `${relevant.length} saved source units match ${[...new Set(rules.map(r => r.ruleId))].join(", ")}; potential destination only, not an approved mapping.${relevant.some(l => applications.get(l.locator_key)?.some(r => r.ruleId === "Q13")) ? " OCR_CAUTION: compare with the original before approval." : ""}` : actual ? "Existing saved draft; current discovery does not assert additional qualification." : "Requested output; sufficient source support has not been established.",
        missing: [...new Set(rules.flatMap(r => r.missing))], supported: !!actual || supported, generated: !!actual, persisted: !!actual,
        dependency, artifact: false, requested: requestedEntry });
    }
  }
  // Review artifacts never acquire an unrelated OUT catalogue entry.
  for (const [type, contractId, ruleId] of [["extraction_review", "O13", "Q01"], ["structured_tables", "O10", "Q10"]] as const) {
    const actual = outputs.find(o => o.type === type);
    const relevant = type === "extraction_review" ? lines : lines.filter(l => applications.get(l.locator_key)?.some(r => r.ruleId === "Q10"));
    if (!relevant.length && !actual) continue;
    found.push({ key: type, name: type === "extraction_review" ? "Stored extraction review" : "Source tables", type, catalogueId: null, contractId: contractId ?? null, ruleIds: type === "extraction_review" ? [] : [ruleId ?? "Q10"], locators: relevant.map(l => l.locator_key), reason: "Extraction/review artifact only; not an authored catalogue deliverable.", missing: [], supported: true, generated: !!actual, persisted: !!actual, dependency: null, artifact: true, requested: false });
  }
  return found;
}