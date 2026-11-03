/** Browser-side downloads of generated outputs. Content is exported exactly as generated; nothing is edited in IIAF. */
import { Document, HeadingLevel, Packer, Paragraph, Table, TableRow, TableCell } from "docx";
import JSZip from "jszip";
import type { GeneratedOutput } from "./outputs.functions";
import { savedPng } from "./artifact-download";
import * as XLSX from "xlsx";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "output";
export const outputFileBase = (o: Pick<GeneratedOutput, "type">, source: string) => `${slug(source.replace(/\.[^.]+$/, ""))}-${o.type}`;
const footer = (o: GeneratedOutput, source: string) => `DRAFT — NOT APPROVED — ${o.manifest?.classification ?? "Classification unknown / unverified"}. Not verified coverage.\nSource document: ${source}. Check against the original before publishing.${o.manifest ? `\nDocument ${o.manifest.documentId}; job ${o.manifest.jobId}; original SHA-256 ${o.manifest.originalHash}; parser ${o.manifest.parserVersion}; contract ${o.manifest.contractVersion}.\nSource locators: ${o.manifest.locators.join(", ")}` : "\nHistorical output: exact source manifest not recorded."}${o.qualification?.some(q => q.rules.some(r => r.ruleId === "Q13")) || o.manifest?.locators.some(l => /^ocr[:!]/i.test(l)) ? "\nOCR_CAUTION: image-derived transcription is unverified; compare against the unchanged original. No confidence or approval is inferred." : ""}`;
const tableText = (o: GeneratedOutput) => (o.tables ?? []).map(t => `\n${t.name}\n${t.rows.map(r => `[${r.locator}] ${r.cells.map(c => `[${c.ref}] ${c.value}${c.formula ? ` (stored formula: ${c.formula}; raw: ${c.raw})` : ""}`).join(" | ")}`).join("\n")}`).join("\n");

/** Guard spreadsheet formula injection in CSV; originals remain unchanged in the manifest/Word table. */
const csvCell = (v: string) => `"${(/^[\s]*[=+@-]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
export function outputCsv(o: GeneratedOutput) {
  const rows = [["Classification", o.manifest?.classification ?? "unverified", "DRAFT — NOT APPROVED"], ["Source lineage and review cautions", footer(o, o.manifest?.documentId ?? "Not recorded")], ["Table", "Row", "Column", "Cell reference", "Value", "Raw", "Stored formula (not executed)", "Source locator"]];
  if(!o.tables?.length) rows.push([o.catalogue?.catalogueId??"",o.type,o.title,o.body]);
  for (const t of o.tables ?? []) for (const r of t.rows) for (const c of r.cells) rows.push([t.name, String(r.row), String(c.column), c.ref, c.value, c.raw, c.formula ?? "", r.locator]);
  return rows.map(r => r.map(csvCell).join(",")).join("\r\n");
}

export function outputText(o: GeneratedOutput, source: string) {
  return `${footer(o, source)}${catalogueText(o)}\n\n${o.title}\n\n${o.body}${tableText(o)}\n${o.draft?`${o.draft.cautions.join("\n")}\nMissing: ${o.draft.missing.join("; ")}\nRevision: ${o.draft.revision}\n${o.draft.citations.map(c=>`${c.segmentId} · ${c.locatorKey} · ${c.raw}`).join("\n")}`:""}${o.authored ? `\n${o.authored.cautions.join("\n")}\n${o.authored.fields.map(f => `${f.role}: ${f.value}\n${f.citations.map(c => `${c.segmentId} · ${c.locatorKey} · ${c.raw}`).join("\n")}`).join("\n")}` : ""}`;
}
const catalogueText = (o: GeneratedOutput) => o.catalogue ? `\nCatalogue reference: ${o.catalogue.catalogueId ?? "local review"}; blueprint ${o.catalogue.contractId ?? "no exact contract"}; ${o.catalogue.support}. ${o.catalogue.reason}` : "";
export async function outputDocx(o: GeneratedOutput, source: string) {
  const doc = new Document({ creator: "IIAF", title: o.title, sections: [{ children: [
    new Paragraph({ text: o.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `${footer(o, source)}${catalogueText(o)}`, style: "Caption" }),
    ...o.body.split(/\n/).map(l => new Paragraph(l)),
    ...(o.draft ? [new Paragraph({text:"Source citations and review gaps",heading:HeadingLevel.HEADING_2}),new Paragraph(o.draft.missing.join("; ")),...o.draft.cautions.map(t=>new Paragraph(t)),...o.draft.citations.map(c=>new Paragraph(`${c.segmentId} · ${c.locatorKey} · ${c.raw}`))] : []),
    ...(o.authored ? [new Paragraph({text:"Field-level source citations",heading:HeadingLevel.HEADING_2}), ...o.authored.cautions.map(text=>new Paragraph(text)), ...o.authored.fields.map(f=>new Paragraph(`${f.role}: ${f.value}\n${f.citations.map(c=>`${c.segmentId} · ${c.locatorKey} · ${c.raw}`).join("\n")}`))] : []),
    ...(o.tables ?? []).flatMap(t => [new Paragraph({ text: t.name, heading: HeadingLevel.HEADING_2 }), new Table({ rows: [new TableRow({ children: ["Row / source", "Column / cell", "Value", "Raw / stored formula"].map(v => new TableCell({ children: [new Paragraph(v)] })) }), ...t.rows.flatMap(r => r.cells.map(c => new TableRow({ children: [`${r.row} · ${r.locator}`, `${c.column} · ${c.ref}`, c.value, `${c.raw}${c.formula ? ` · ${c.formula} (not executed)` : ""}`].map(v => new TableCell({ children: [new Paragraph(v)] })) }))) ] })]),
  ] }] });
  return Packer.toBlob(doc);
}
export async function outputsZip(list: GeneratedOutput[], source: string) {
  const zip = new JSZip();
  for (const o of list) {
    const base = outputFileBase(o, source);
    zip.file(`${base}.txt`, outputText(o, source));
    zip.file(`${base}.docx`, await outputDocx(o, source));
    zip.file(`${base}.html`,outputHtml(o,source));
    zip.file(`${base}.xlsx`,outputWorkbook(o,source));
    if (o.artifact) zip.file(`${base}.png`, await savedPng(o));
    zip.file(`${base}.csv`, outputCsv(o));
    if (o.manifest) zip.file(`${base}.manifest.json`, JSON.stringify({ ...o.manifest, catalogue: o.catalogue ?? null, qualification: o.qualification ?? [], tables: o.tables ?? [], meeting: o.meeting ?? null, draft:o.draft??null,persistedSetId:o.persistedSetId??null,authored:o.authored??null,artifact:o.artifact??null }, null, 2));
  }
  return zip.generateAsync({ type: "blob" });
}

const escapeHtml=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export function outputHtml(o:GeneratedOutput,source:string){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(o.title)}</title></head><body><h1>${escapeHtml(o.title)}</h1><pre style="white-space:pre-wrap">${escapeHtml(outputText(o,source))}</pre></body></html>`;}
export function outputWorkbook(o:GeneratedOutput,source:string){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Catalogue","Type","Title","Body"],[o.catalogue?.catalogueId??"",o.type,o.title,o.body]]),"Output");XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Source and review"],[footer(o,source)],...[...(o.draft?.citations??[])].map(c=>[c.segmentId,c.locatorKey,c.raw])]),"Source lineage");for(const [i,t] of (o.tables??[]).entries())XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Locator","Row","Cell","Value","Raw","Formula (not executed)"],...t.rows.flatMap(r=>r.cells.map(c=>[r.locator,String(r.row),c.ref,c.value,c.raw,c.formula??""]))]),`Table ${i+1}`);return new Blob([XLSX.write(book,{type:"array",bookType:"xlsx"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});}
