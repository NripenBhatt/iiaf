import { generateCatalogue, CATALOGUE_HANDLERS, type HandlerContext } from "@/lib/catalogue-handlers";
import reference from "@/data/output-reference-catalogue.json";
import { writeFileSync, mkdirSync } from "fs";

const text = ["From Ideas to","Enterprises","Understanding Legal Entity Formation for Startups:","Why, How, Benefits and Goals","13 October 2026","(Thursday)","Khwaja Moinuddin Chishti Language University, Lucknow","Organised by Awadh Incubation Foundation"];
const c: HandlerContext = { lines: text.map((content, seq) => ({ content, seq, locator_key: `ocr:${seq}`, method_version: "ocr-1", locator: { page: 1 } })), segmentIds: text.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`), company: false, period: null, manifest: { documentId: "00000000-0000-4000-8000-000000000099", jobId: "00000000-0000-4000-8000-000000000098", originalHash: "a".repeat(64), parserVersion: "ocr-1", contractVersion: "iiaf-output-2.2", classification: "DEMO", approval: "draft", locators: text.map((_, i) => `ocr:${i}`), verifiedCoverage: false } };

const dir = "/mnt/documents/IIAF_Improved_Examples_2026_11_03";
mkdirSync(dir, { recursive: true });

// All 30 requested against the DEMO event poster — the truthful matrix.
const all = generateCatalogue({ ...c, company: true }, reference.outputs.map(e => e.Output_ID));
const names = new Map(reference.outputs.map(e => [e.Output_ID, e.Output_Name]));
const generated = new Map<string, string[]>();
for (const o of all.outputs) {
  const id = o.catalogue?.catalogueId ?? "";
  generated.set(id, [...(generated.get(id) ?? []), o.type]);
}
const skippedBy = new Map(all.skipped.map(s => [s.name, s.reason]));

const rows = reference.outputs.map(e => {
  const id = e.Output_ID;
  const handler = CATALOGUE_HANDLERS[id];
  const variants = generated.get(id) ?? [];
  const status = variants.length ? "Draft generated (source-derived, review required)" : `Blocked — ${skippedBy.get(id) ?? "no eligible source"}`;
  return { id, name: e.Output_Name, category: handler?.category ?? "?", inputs: e.Principal_Input_Entities, variants: variants.join(", ") || "—", status };
});

const md = ["# IIAF 30-output status matrix — 2026-11-03 (DEMO event poster source)", "", "Source: synthetic DEMO workshop poster (8 OCR segments). Company-authorized context used so that category gating, not access class, is what is measured. Handler presence is not acceptance; blocked outputs are honestly marked, never padded.", "", "| ID | Output | Source category | Required inputs | Variants generated | Status on this source |", "| --- | --- | --- | --- | --- | --- |", ...rows.map(r => `| ${r.id} | ${r.name} | ${r.category} | ${r.inputs} | ${r.variants} | ${r.status.replace(/\|/g, "/")} |`)].join("\n");
writeFileSync(`${dir}/IIAF_Final_Status_Matrix_2026_11_03.md`, md);
writeFileSync(`${dir}/IIAF_Final_Status_Matrix_2026_11_03.csv`, ["ID,Output,Category,Required inputs,Variants,Status", ...rows.map(r => [r.id, r.name, r.category, r.inputs, r.variants, r.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"));

// Actual example files for the improved outputs.
const wanted: Record<string, string> = { news_article: "OUT-008_News_Article.md", facebook: "OUT-009_Facebook.txt", instagram: "OUT-009_Instagram.txt", linkedin: "OUT-009_LinkedIn_post.txt", x_post: "OUT-009_X_post.txt", linkedin_article: "OUT-011_LinkedIn_Article.md", newsletter: "OUT-014_Newsletter.md", event_publicity: "OUT-026_Event_Publicity_Pack.md", social_calendar: "OUT-029_Social_Media_Calendar.md", reel_script: "OUT-010_Reel_Script.md" };
for (const o of all.outputs) {
  const file = wanted[o.type];
  if (file) writeFileSync(`${dir}/${file}`, `DEMO — DRAFT — NOT APPROVED — human review required\nCatalogue: ${o.catalogue?.catalogueId} · revision ${o.draft?.revision} · release: ${o.contract.release}\n\n${o.body}\n\n---\nCitations:\n${o.draft?.citations.map(x => `${x.segmentId} · ${x.locatorKey} · ${x.raw}`).join("\n")}`);
}
console.log("generated variants:", all.outputs.length, "skipped:", all.skipped.length);
console.log("files:", rows.filter(r => r.variants !== "—").length, "of 30 have drafts on this source");
