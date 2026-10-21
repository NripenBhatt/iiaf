/** Browser-side downloads of generated outputs. Content is exported exactly as generated; nothing is edited in IIAF. */
import { Document, HeadingLevel, Packer, Paragraph, Table, TableRow, TableCell } from "docx";
import JSZip from "jszip";
import type { GeneratedOutput } from "./outputs.functions";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "output";
export const outputFileBase = (o: GeneratedOutput, source: string) => `${slug(source.replace(/\.[^.]+$/, ""))}-${o.type}`;
const footer = (o: GeneratedOutput, source: string) => `DRAFT — NOT APPROVED — ${o.manifest?.classification ?? "Classification unknown / unverified"}. Not verified coverage.\nSource document: ${source}. Check against the original before publishing.${o.manifest ? `\nDocument ${o.manifest.documentId}; job ${o.manifest.jobId}; original SHA-256 ${o.manifest.originalHash}; parser ${o.manifest.parserVersion}; contract ${o.manifest.contractVersion}.\nSource locators: ${o.manifest.locators.join(", ")}` : "\nHistorical output: exact source manifest not recorded."}`;
const tableText = (o: GeneratedOutput) => (o.tables ?? []).map(t => `\n${t.name}\n${t.rows.map(r => `[${r.locator}] ${r.cells.map(c => `[${c.ref}] ${c.value}${c.formula ? ` (stored formula: ${c.formula}; raw: ${c.raw})` : ""}`).join(" | ")}`).join("\n")}`).join("\n");

/** Guard spreadsheet formula injection in CSV; originals remain unchanged in the manifest/Word table. */
const csvCell = (v: string) => `"${(/^[\s]*[=+@-]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
export function outputCsv(o: GeneratedOutput) {
  const rows = [["Classification", o.manifest?.classification ?? "unverified", "DRAFT — NOT APPROVED"], ["Table", "Row", "Column", "Cell reference", "Value", "Raw", "Stored formula (not executed)", "Source locator"]];
  for (const t of o.tables ?? []) for (const r of t.rows) for (const c of r.cells) rows.push([t.name, String(r.row), String(c.column), c.ref, c.value, c.raw, c.formula ?? "", r.locator]);
  return rows.map(r => r.map(csvCell).join(",")).join("\r\n");
}

export function outputText(o: GeneratedOutput, source: string) {
  return `${footer(o, source)}\n\n${o.title}\n\n${o.body}${tableText(o)}\n`;
}
export async function outputDocx(o: GeneratedOutput, source: string) {
  const doc = new Document({ creator: "IIAF", title: o.title, sections: [{ children: [
    new Paragraph({ text: o.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: footer(o, source), style: "Caption" }),
    ...o.body.split(/\n/).map(l => new Paragraph(l)),
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
    if (o.tables?.length) zip.file(`${base}.csv`, outputCsv(o));
    if (o.manifest) zip.file(`${base}.manifest.json`, JSON.stringify({ ...o.manifest, qualification: o.qualification ?? [], tables: o.tables ?? [] }, null, 2));
  }
  return zip.generateAsync({ type: "blob" });
}
