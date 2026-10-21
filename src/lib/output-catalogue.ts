import type { UploadModule } from "./upload-rules";
import { outputBinding, type OutputBinding } from "./output-reference";
export { OUTPUT_REFERENCE, RECONCILED_OUTPUT_CATALOGUE } from "./output-reference";

/** Output types offered per upload module. The document's actual content decides which ones qualify. */
export type OutputType = { id: string; name: string; guidance: string };

const EVENT: OutputType[] = [
  { id: "press_release", name: "News article / press release", guidance: "Announced for the stated date; occurrence must be separately verified." },
  { id: "website_event", name: "Website event listing", guidance: "Title, summary, date, time, venue, organisers, how to participate." },
  { id: "linkedin", name: "LinkedIn post", guidance: "Professional tone, up to 1,200 characters." },
  { id: "facebook", name: "Facebook post", guidance: "Friendly tone, up to 800 characters." },
  { id: "instagram", name: "Instagram caption", guidance: "Short caption with a few relevant hashtags." },
  { id: "x_post", name: "X (Twitter) post", guidance: "At most 270 characters." },
  { id: "reel_script", name: "Reel / short-video script", guidance: "30–45 second script with numbered shots and on-screen text." },
  { id: "event_summary", name: "Event summary", guidance: "Neutral factual summary of what the source states." },
];
const DOCUMENT_SUMMARY: OutputType = { id: "document_summary", name: "Document summary", guidance: "Neutral executive summary of the document." };
const REVIEW: OutputType[] = [{ id: "extraction_review", name: "Stored extraction review", guidance: "Unchanged source text with locators." }, { id: "structured_tables", name: "Source tables", guidance: "Actual stored cells; no inferred values or approved evidence." }];

const MODULE_OUTPUTS: Record<UploadModule, OutputType[]> = {
  institutional: [
    ...REVIEW,
    ...EVENT,
    { id: "profile_section", name: "Institutional profile section", guidance: "Only for documents describing the institution, departments, programmes, faculty or facilities." },
    { id: "website_content", name: "Website content", guidance: "Web page copy for non-event institutional information." },
    DOCUMENT_SUMMARY,
  ],
  meeting: [
    ...REVIEW,
    { id: "meeting_summary", name: "Meeting summary", guidance: "What the meeting covered, per the source." },
    { id: "agenda_summary", name: "Agenda summary", guidance: "Only if an agenda is present." },
    { id: "decisions", name: "Decisions and resolutions", guidance: "Only decisions explicitly recorded." },
    { id: "action_items", name: "Action-item list", guidance: "Only actions explicitly recorded, with owners/dates only if stated." },
    { id: "meeting_report", name: "Meeting report", guidance: "Formal report of the meeting record." },
    { id: "follow_up", name: "Follow-up communication draft", guidance: "Email to participants restating recorded decisions/actions." },
  ],
  evidence: [
    ...REVIEW,
    DOCUMENT_SUMMARY,
    { id: "evidence_note", name: "Evidence description note", guidance: "Describe what the document evidences, for a reviewer. Never claim compliance, scores or approval." },
  ],
};

export const OUTPUT_CATALOGUE = Object.fromEntries(
  Object.entries(MODULE_OUTPUTS).map(([module, outputs]) => [module, outputs.map(output => ({ ...output, ...outputBinding(output.id) }))]),
) as Record<UploadModule, (OutputType & OutputBinding)[]>;
