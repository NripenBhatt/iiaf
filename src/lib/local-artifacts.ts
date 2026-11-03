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

/** Platform canvas sizes for local (unsaved) downloads. The persisted artifact
 * contract remains locked to 1080 × 1080 by the server-side validator. */
export const PLATFORM_SIZES = { square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }, landscape: { width: 1920, height: 1080 }, story: { width: 1080, height: 1920 } } as const;
export type PlatformSize = keyof typeof PLATFORM_SIZES;

/** Canvas runs only on user action, with theme tokens and bounded source text.
 * Professional layout: branding band, kicker, title hierarchy, accent rule,
 * body block and a review footer. No logos or photographs are invented; the
 * wordmark is typographic text only. */
export async function renderDraftImage(draft: LocalDraft, text = draft.body, forPersistence = false, size: PlatformSize = "square"): Promise<Blob> {
  await document.fonts.ready;
  const { width, height } = PLATFORM_SIZES[size];
  const scale = width / 1080;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable in this browser.");
  const theme = getComputedStyle(document.documentElement);
  const color = (token: string) => theme.getPropertyValue(token).trim() || undefined;
  const fontFamily = color("--font-sans") ?? "sans-serif";
  const margin = 72 * scale;
  const contentWidth = width - margin * 2;
  const background = color("--card") ?? "#ffffff";
  const primary = color("--primary") ?? "#1f3a5f";
  const foreground = color("--foreground") ?? "#1a1a1a";
  const muted = color("--muted-foreground") ?? "#5a5a5a";

  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  // Branding band: typographic wordmark only — no invented logo.
  const bandHeight = 132 * scale;
  ctx.fillStyle = primary; ctx.fillRect(0, 0, width, bandHeight);
  ctx.fillStyle = background;
  ctx.font = `bold ${30 * scale}px ${fontFamily}`;
  ctx.fillText("IIAF", margin, 54 * scale);
  ctx.font = `${22 * scale}px ${fontFamily}`;
  ctx.fillText(`${draft.classification} · ${forPersistence ? "REVIEW DRAFT" : "UNSAVED DRAFT"} · ${draft.catalogueId}`, margin, 96 * scale);

  const wrap = (value: string, sizePx: number, top: number, maxLines: number, weight = "") => {
    ctx.font = `${weight ? `${weight} ` : ""}${sizePx}px ${fontFamily}`; let y = top; let count = 0;
    for (const paragraph of value.split(/\n+/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (ctx.measureText(word).width > contentWidth) throw new Error("A source value is too wide for this image; use the text download.");
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > contentWidth) { if (++count > maxLines) throw new Error("Content does not fit; no truncated image was created."); ctx.fillText(line, margin, y); y += sizePx * 1.45; line = word; } else line = next;
      }
      if (line) { if (++count > maxLines) throw new Error("Content does not fit; no truncated image was created."); ctx.fillText(line, margin, y); y += sizePx * 1.45; }
    }
    return y;
  };

  // Kicker + title hierarchy with automatic size step-down.
  ctx.fillStyle = primary;
  ctx.font = `600 ${22 * scale}px ${fontFamily}`;
  ctx.fillText("SOURCE-BACKED ANNOUNCEMENT", margin, bandHeight + 64 * scale);
  ctx.fillStyle = foreground;
  let titleSize = 58 * scale;
  let titleEnd = 0;
  for (const candidate of [58, 50, 42]) {
    titleSize = candidate * scale;
    ctx.font = `bold ${titleSize}px ${fontFamily}`;
    const lines = draft.title.split(/\s+/).reduce<string[]>((acc, word) => { const last = acc[acc.length - 1] ?? ""; const next = last ? `${last} ${word}` : word; if (ctx.measureText(next).width > contentWidth && last) acc.push(word); else acc[acc.length - 1] = next; return acc; }, [""]);
    if (lines.length <= 3 || candidate === 42) { titleEnd = wrap(draft.title, titleSize, bandHeight + 140 * scale, 3, "bold"); break; }
  }
  // Accent rule separating title from body.
  ctx.fillStyle = primary; ctx.fillRect(margin, titleEnd + 8 * scale, 120 * scale, 6 * scale);
  ctx.fillStyle = foreground;
  const bodyTop = titleEnd + 56 * scale;
  const footerReserve = 170 * scale;
  const maxBodyLines = Math.max(4, Math.floor((height - bodyTop - footerReserve) / (30 * scale * 1.45)));
  const end = wrap(text, 30 * scale, bodyTop, maxBodyLines);
  if (end > height - footerReserve) throw new Error("Content does not fit; no truncated image was created.");

  // Footer band with review ribbon and lineage reference.
  ctx.fillStyle = primary; ctx.fillRect(0, height - 96 * scale, width, 96 * scale);
  ctx.fillStyle = background;
  ctx.font = `${22 * scale}px ${fontFamily}`;
  ctx.fillText(forPersistence ? "Announced event · OCR review required · Date/weekday conflict" : "Human review required · Not approved for release", margin, height - 52 * scale);
  ctx.fillStyle = muted;
  wrap(`${draft.catalogueId} · Source citations in companion manifest`, 20 * scale, height - 112 * scale, 1);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image encoding failed.")), "image/png"));
}

export async function localVisualZip(draft: LocalDraft, carousel: boolean) {
  const zip = new JSZip();
  const panels = carousel ? [draft.title, ...draft.body.split(/\n\n+/).filter(Boolean)] : [draft.body];
  for (const [index, text] of panels.entries()) zip.file(`panel-${index + 1}.png`, await renderDraftImage(draft, text));
  // Platform-size variants of the lead panel for local channel use; persisted artifacts stay 1080 × 1080.
  for (const size of Object.keys(PLATFORM_SIZES) as PlatformSize[]) {
    if (size === "square") continue;
    zip.file(`platform-${size}.png`, await renderDraftImage(draft, panels[0] ?? draft.body, false, size));
  }
  zip.file("source-manifest.json", JSON.stringify({ ...draft, artifact: carousel ? "local_carousel" : "local_image", panelCount: panels.length, platformSizes: Object.keys(PLATFORM_SIZES), persisted: false }, null, 2));
  zip.file("review-and-source.txt", localDraftText(draft));
  return zip.generateAsync({ type: "blob" });
}