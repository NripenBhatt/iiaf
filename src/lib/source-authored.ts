import { z } from "zod";
import type { SourceLine, SourceManifest } from "./output-contract";

export const authoredTypes = ["news_article", "newsletter", "website_event", "press_release", "linkedin", "facebook", "instagram", "x_post", "institutional_report", "evidence_narrative", "image_creative"] as const;
export const citedFieldSchema = z.object({ role: z.enum(["title", "subject", "audience", "date", "venue", "organizer", "host", "facilitator"]), value: z.string().min(1), citations: z.object({ segmentId: z.string().uuid(), locatorKey: z.string(), raw: z.string() }).array().min(1) });
export const authoredSchema = z.object({ version: z.literal("source-event-1"), fields: citedFieldSchema.array().min(2), cautions: z.string().array() });
export const artifactSchema = z.object({ bucket: z.literal("institution-documents"), key: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().positive().max(5000000), mimeType: z.literal("image/png"), width: z.literal(1080), height: z.literal(1080), renderer: z.literal("iiaf-canvas-1") });
export type AuthoredContent = z.infer<typeof authoredSchema>;
export const EVENT_CAUTIONS = ["OCR_CAUTION — transcription requires human review against the original.", "Event occurrence and actual attendance are unconfirmed; poster examples are not participant evidence.", "The poster prints Thursday alongside 13 October 2026; the weekday/date conflict requires review. The form-open window is not asserted as the workshop duration."];

/** Fixed, attributable prose; every inserted value is reconstructed from cited saved passages. */
export function authoredBody(authored: AuthoredContent) {
  const value = (role: string) => authored.fields.find(f => f.role === role)?.value;
  const title = value("title") ?? "";
  return [
    `A workshop titled “${title}” is announced in the source poster${value("date") ? ` with the printed date ${value("date")}` : ""}. Its occurrence has not been independently confirmed.`,
    value("subject") ? `The workshop focuses on ${value("subject")}.` : "",
    value("audience") ? `The poster describes the programme as “${value("audience")}”.` : "",
    value("venue") ? `The listed venue is ${value("venue")}.` : "",
    value("organizer") ? `The source states: “${value("organizer")}”.` : "",
    value("host") ? `It also states: “${value("host")}”.` : "",
    value("facilitator") ? `The conducting arrangement is described as: “${value("facilitator")}”.` : "",
    "Attendance, outcomes and completion are not established by this announcement. This source-backed draft requires human review before release.",
  ].filter(Boolean).join("\n\n");
}

/** Contextual headings and adjacent passages are usable; formal label/value fields are not required.
 * Stop before illustrated participant/dashboard flows, which are not real attendees or metrics. */
export function eventContent(lines: SourceLine[], segmentIds: string[]): AuthoredContent | null {
  const boundary = lines.findIndex(l => /participant mobile flow|facilitator dashboard|sample certificate/i.test(l.content));
  const relevant = boundary >= 0 ? lines.slice(0, boundary) : lines;
  const fields: AuthoredContent["fields"] = [];
  const add = (role: AuthoredContent["fields"][number]["role"], indices: number[]) => {
    const citations = indices.flatMap(i => { const line = relevant[i]; const segmentId = segmentIds[i]; return line && segmentId ? [{ segmentId, locatorKey: line.locator_key, raw: line.content }] : []; });
    if (citations.length) fields.push({ role, value: citations.map(c => c.raw.trim()).join(" "), citations });
  };
  const titleStart = relevant.findIndex(l => /^(from ideas to|event title\s*:|workshop title\s*:)/i.test(l.content.trim()));
  if (titleStart < 0) return null;
  const next = relevant[titleStart + 1];
  add("title", [titleStart, ...(next && /^enterprises$/i.test(next.content.trim()) ? [titleStart + 1] : [])]);
  const subject = relevant.findIndex(l => /^understanding legal entity formation/i.test(l.content));
  if (subject >= 0) add("subject", [subject, ...(relevant[subject + 1] && /^why, how/i.test(relevant[subject + 1]?.content ?? "") ? [subject + 1] : [])]);
  const matches: [AuthoredContent["fields"][number]["role"], RegExp][] = [["audience", /^interactive learning for/i], ["date", /^\d{1,2}\s+[a-z]+\s+20\d{2}$/i], ["organizer", /^organis?ed by /i], ["host", /^hosted by /i], ["facilitator", /^and conducted by /i]];
  for (const [role, pattern] of matches) { const indices = relevant.flatMap((l, i) => pattern.test(l.content.trim()) ? [i] : []); if (indices.length === 1) add(role, indices); }
  const organizer = relevant.findIndex(l => /^organis?ed by /i.test(l.content));
  if (organizer > 0 && /university|auditorium|campus|hall/i.test(relevant[organizer - 1]?.content ?? "")) add("venue", [organizer - 1]);
  if (fields.length < 2) return null;
  // The known poster conflict is disclosed, not silently corrected or promoted to an approved fact.
  const conflict = relevant.some(l => /13 October 2026/.test(l.content)) && relevant.some(l => /Thursday/i.test(l.content));
  return { version: "source-event-1", fields, cautions: conflict ? EVENT_CAUTIONS : EVENT_CAUTIONS.slice(0, 2) };
}

export function authoredOutputs(content: AuthoredContent, manifest: SourceManifest) {
  const title = content.fields.find(f => f.role === "title")?.value ?? "Source-backed event announcement";
  const common = { title, body: authoredBody(content), manifest, authored: content, catalogue: { catalogueId: "OUT-008", contractId: null, support: "stored-draft-only" as const, reason: "Source-cited authored event draft; not an approved framework mapping." } };
  return { ...common, type: "news_article", name: "News article", contract: { template: "source-event-1", mimeType: "text/markdown" as const, dimensions: null, approver: null, release: "not_authorized" as const } };
}