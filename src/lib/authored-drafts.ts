import type { SourceLine } from "./output-contract";

export type DraftSource = { documentId: string; jobId: string; filename: string; originalHash: string; parserVersion: string; classification: "DEMO" | "unverified"; lines: SourceLine[] };
export type AuthoredDraft = { type: "press_release" | "website_event" | "linkedin" | "facebook" | "instagram" | "x_post"; catalogueId: "OUT-008" | "OUT-009"; title: string; body: string; citations: { documentId: string; jobId: string; filename: string; locatorKey: string; raw: string }[]; missing: string[]; review: "human_review_required"; release: "not_authorized"; persisted: false };
const labels: Record<string, string> = { "event title": "title", "workshop title": "title", "event": "title", "event date": "date", "date": "date", "event time": "time", "venue": "venue", "participating institutions": "institutions", "workshop subject": "subject", "event subject": "subject" };
const limits: Partial<Record<AuthoredDraft["type"], number>> = { linkedin: 1200, facebook: 800, x_post: 270 };

/** Staged no-provider authoring engine. NOT wired to persistence until the exact gate extension is approved.
 * Explicit values only: no event occurrence, affiliation, metric, temporal status or source-language translation inference.
 */
export function authoredEventDrafts(source: DraftSource): AuthoredDraft[] {
  const fields = new Map<string, { value: string; line: SourceLine }[]>();
  for (const line of source.lines) {
    const match = /^\s*([^:\n]{1,80})\s*:\s*(.+)\s*$/.exec(line.content);
    const label = match?.[1]?.trim().toLowerCase(); const value = match?.[2]?.trim();
    const key = label ? labels[label] : undefined;
    if (key && value) fields.set(key, [...(fields.get(key) ?? []), { value, line }]);
  }
  const usable = (key: string) => {
    const entries = fields.get(key) ?? [];
    const values = [...new Set(entries.map(e => e.value))];
    return values.length === 1 ? { value: values[0] ?? "", entries } : null;
  };
  const title = usable("title"); const date = usable("date");
  if (!title || !date) return []; // ambiguous title/date cannot qualify an event draft
  const keys = ["title", "date", "time", "venue", "institutions", "subject"];
  const chosen = keys.flatMap(key => usable(key)?.entries ?? []);
  const citations = chosen.map(({ line }) => ({ documentId: source.documentId, jobId: source.jobId, filename: source.filename, locatorKey: line.locator_key, raw: line.content }));
  const missing = keys.filter(key => !usable(key)).map(key => fields.has(key) ? `${key}: conflicting source values` : `${key}: not explicitly recorded`);
  const statement = `${title.value} is announced for ${date.value}${usable("time") ? ` at ${usable("time")?.value}` : ""}${usable("venue") ? `, at ${usable("venue")?.value}` : ""}.`;
  const subject = usable("subject"); const institutions = usable("institutions");
  const paragraphs = [statement, subject ? `The stated workshop subject is ${subject.value}.` : "", institutions ? `The source lists these participating institutions: ${institutions.value}.` : ""].filter(Boolean);
  const languageCaution = /[\u0900-\u097f]/.test(chosen.map(e => e.line.content).join(""));
  if (languageCaution) return []; // this English template must not silently translate Hindi sources
  return (["press_release", "website_event", "linkedin", "facebook", "instagram", "x_post"] as const).flatMap(type => {
    const body = (type === "x_post" ? [statement] : paragraphs).join("\n\n");
    const limit = limits[type];
    if (limit && Array.from(body).length > limit) return []; // no silent truncation of facts
    return [{ type, catalogueId: type === "press_release" || type === "website_event" ? "OUT-008" as const : "OUT-009" as const, title: title.value, body, citations, missing, review: "human_review_required" as const, release: "not_authorized" as const, persisted: false as const }];
  });
}