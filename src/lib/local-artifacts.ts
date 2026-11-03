import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { authoredEventDrafts, type AuthoredDraft, type DraftSource } from "./authored-drafts";
import { eventContent } from "./source-authored";
import { publicationCopy } from "./publication-copy";

export type LocalDraft = Omit<AuthoredDraft, "type" | "catalogueId"> & { type: AuthoredDraft["type"] | "profile_section"; catalogueId: "OUT-001" | "OUT-008" | "OUT-009"; classification: "DEMO" | "unverified"; originalHash: string; parserVersion: string; cautions: string[] };

/** Local drafts are never inserted into the guarded saved-output store. */
export function localDrafts(source: DraftSource): LocalDraft[] {
  const cautions = ["DRAFT — human review required; release not authorized; not verified coverage.", ...(source.lines.some(l => /^ocr[:!]/i.test(l.locator_key) || /ocr/i.test(l.method ?? "")) ? ["OCR_CAUTION: compare transcription against the unchanged original."] : [])];
  const attach = (draft: Omit<LocalDraft, "classification" | "originalHash" | "parserVersion" | "cautions">): LocalDraft => ({ ...draft, classification: source.classification, originalHash: source.originalHash, parserVersion: source.parserVersion, cautions });
  const drafts = authoredEventDrafts(source).map(attach);
  // Reuse saved contextual poster passages without another extraction. These
  // richer drafts remain explicitly local; source-event-1 persistence is intact.
  if (!drafts.length) {
    const event = eventContent(source.lines, source.lines.map((_, i) => `local:${i}`));
    if (event && !/[\u0900-\u097f]/.test(event.fields.map(f => f.value).join(""))) {
      const fields = Object.fromEntries(event.fields.map(f => [f.role, f.value]));
      const limits = { linkedin: 1200, facebook: 800, x_post: 270 };
      for (const type of ["press_release", "website_event", "linkedin", "facebook", "instagram", "x_post"] as const) {
        const body = publicationCopy(type, fields);
        const limit = type in limits ? limits[type as keyof typeof limits] : undefined;
        if (limit && Array.from(body).length > limit) continue;
        const draft = attach({ type, catalogueId: ["press_release", "website_event"].includes(type) ? "OUT-008" : "OUT-009", title: fields["title"] ?? "Event announcement", body, citations: event.fields.flatMap(f => f.citations.map(c => ({ documentId: source.documentId, jobId: source.jobId, filename: source.filename, locatorKey: c.locatorKey, raw: c.raw }))), missing: ["Attendance, outcomes and completion are unconfirmed."], review: "human_review_required", release: "not_authorized", persisted: false });
        drafts.push({ ...draft, cautions: [...draft.cautions, ...event.cautions] });
      }
    }
  }
  const profileLabels = ["Institution Name", "Established", "Campus"];
  const fields = profileLabels.map(label => ({ label, lines: source.lines.filter(l => l.content.toLowerCase().startsWith(`${label.toLowerCase()}:`)) }));
  const name = fields[0];
  if (!name || name.lines.length !== 1) return drafts;
  const usable = fields.filter(f => f.lines.length === 1);
  // An explicit profile is not an event or a inferred catalogue binding.
  const body = usable.map(f => `${f.label}: ${f.lines[0]?.content.split(":").slice(1).join(":").trim() ?? ""}.`).join("\n\n");
  drafts.push(attach({ type: "profile_section", catalogueId: "OUT-001", title: "Institutional profile draft", body,
    citations: usable.flatMap(f => f.lines.map(l => ({ documentId: source.documentId, jobId: source.jobId, filename: source.filename, locatorKey: l.locator_key, raw: l.content }))),
    missing: fields.filter(f => f.lines.length !== 1).map(f => `${f.label}: missing or ambiguous`), review: "human_review_required", release: "not_authorized", persisted: false }));
  return drafts;
}

export function localDraftText(draft: LocalDraft) {
  return `${draft.classification} · LOCAL UNSAVED DRAFT\n${draft.cautions.join("\n")}\nCatalogue reference ${draft.catalogueId}; not an approved mapping.\n\n${draft.title}\n\n${draft.body}\n\nMissing / ambiguous: ${draft.missing.join("; ") || "None in this limited template"}\nOriginal hash: ${draft.originalHash}\nParser: ${draft.parserVersion}\n${draft.citations.map(c => `${c.filename} · document ${c.documentId} · job ${c.jobId} · ${c.locatorKey}\n${c.raw}`).join("\n")}`;
}

export async function localDraftWord(draft: LocalDraft) {
  return Packer.toBlob(new Document({ sections: [{ children: [new Paragraph({ text: draft.title, heading: HeadingLevel.HEADING_1 }), ...localDraftText(draft).split("\n").map(text => new Paragraph(text))] }] }));
}

/** Canvas runs only on user action, with theme tokens and bounded source text. */
export async function renderDraftImage(draft: LocalDraft, text = draft.body, forPersistence = false): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable in this browser.");
  const theme = getComputedStyle(document.documentElement);
  const color = (token: string) => theme.getPropertyValue(token).trim();
  ctx.fillStyle = color("--card"); ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = color("--primary"); ctx.fillRect(0, 0, 1080, 16);
  ctx.font = "bold 24px sans-serif"; ctx.fillText(`IIAF · ${draft.classification} · ${forPersistence ? "REVIEW DRAFT" : "UNSAVED DRAFT"}`, 60, 75);
  const wrap = (value: string, size: number, top: number, maxLines: number) => {
    ctx.font = `${size}px sans-serif`; let y = top; let count = 0;
    for (const paragraph of value.split(/\n+/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (ctx.measureText(word).width > 950) throw new Error("A source value is too wide for this image; use the text download.");
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > 950) { if (++count > maxLines) throw new Error("Content does not fit; no truncated image was created."); ctx.fillText(line, 60, y); y += size * 1.45; line = word; } else line = next;
      }
      if (line) { if (++count > maxLines) throw new Error("Content does not fit; no truncated image was created."); ctx.fillText(line, 60, y); y += size * 1.45; }
    }
    return y;
  };
  ctx.fillStyle = color("--foreground"); const titleEnd = wrap(draft.title, 42, 155, 3);
  const end = wrap(text, 30, titleEnd + 30, 12);
  if (end > 850) throw new Error("Content does not fit; no truncated image was created.");
  ctx.fillStyle = color("--muted-foreground");
  wrap(forPersistence ? "Announced event · OCR review required · Date/weekday conflict" : "Human review required · Not approved for release", 22, 930, 1);
  wrap(`${draft.catalogueId} · Source citations in companion manifest`, 22, 975, 1);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image encoding failed.")), "image/png"));
}

export async function localVisualZip(draft: LocalDraft, carousel: boolean) {
  const zip = new JSZip();
  const panels = carousel ? [draft.title, ...draft.body.split(/\n\n+/).filter(Boolean)] : [draft.body];
  for (const [index, text] of panels.entries()) zip.file(`panel-${index + 1}.png`, await renderDraftImage(draft, text));
  zip.file("source-manifest.json", JSON.stringify({ ...draft, artifact: carousel ? "local_carousel" : "local_image", panelCount: panels.length, persisted: false }, null, 2));
  zip.file("review-and-source.txt", localDraftText(draft));
  return zip.generateAsync({ type: "blob" });
}