/** Browser-side downloads of generated outputs. Content is exported exactly as generated; nothing is edited in IIAF. */
import { Document, HeadingLevel, Packer, Paragraph, Table, TableRow, TableCell, Header, Footer, TextRun, PageNumber, PageOrientation, WidthType } from "docx";
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
  const doc = new Document({ creator: "IIAF", title: o.title, sections: [{ properties:{page:{...(o.type==="social_calendar"?{size:{orientation:PageOrientation.LANDSCAPE}}:{}),margin:{top:1134,bottom:1134,left:1134,right:1134}}}, headers:{default:new Header({children:[new Paragraph("IIAF · Source-traceable review draft")]})}, footers:{default:new Footer({children:[new Paragraph({children:[new TextRun("DRAFT · NOT APPROVED · Page "),new TextRun({children:[PageNumber.CURRENT]})]})]})}, children: [
    new Paragraph({ text: o.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `DRAFT — NOT APPROVED · ${o.manifest?.classification ?? "unverified"} · Source: ${source}`, style: "Caption" }),
    ...markdownDocx(o.body),
    new Paragraph({text:`${footer(o,source)}${catalogueText(o)}`,style:"Caption"}),
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
/** Semantic, escaped print-ready HTML. Browser Print / Save as PDF is explicit,
 * not an advertised direct PDF file generator. */
export function outputHtml(o:GeneratedOutput,source:string){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(o.title)}</title><style>:root{--paper:#fff;--ink:#172b32;--muted:#52636b;--line:#c7d2d6;--accent:#146b64}body{color:var(--ink);background:var(--paper);font-family:Georgia,serif;font-size:11pt;line-height:1.55;max-width:900px;margin:32px auto;padding:0 24px}h1,h2,h3{font-family:Arial,sans-serif;color:var(--accent);break-after:avoid}h1{font-size:24pt}h2{font-size:16pt;margin-top:24px}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%;font:9pt Arial,sans-serif;table-layout:fixed}td,th{border:1px solid var(--line);padding:7px;overflow-wrap:anywhere;vertical-align:top}blockquote{border-left:2px solid var(--line);margin-left:0;padding-left:14px;color:var(--muted)}.review{font:9pt Arial,sans-serif;border-block:1px solid var(--line);padding:12px;overflow-wrap:anywhere}.sources{font-size:9pt;overflow-wrap:anywhere}@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0;max-width:none}tr{break-inside:avoid}thead{display:table-header-group}}</style></head><body><h1>${escapeHtml(o.title)}</h1><div class="review">${escapeHtml(footer(o,source)).replace(/\n/g,"<br>")}</div>${markdownHtml(o.body)}<section class="sources"><h2>Source citations and review notes</h2>${(o.draft?.citations??[]).map(c=>`<p>${escapeHtml(`${c.segmentId} · ${c.locatorKey} · ${c.raw}`)}</p>`).join("")}<p>${escapeHtml(o.draft?.missing.join("; ")??"")}</p><p>${escapeHtml(o.draft?.cautions.join(" ")??"")}</p></section></body></html>`;}
function markdownHtml(body:string){let result="",rows:string[][]=[];const flush=()=>{if(rows.length){result+='<table>'+rows.map((row,i)=>`<tr>${row.map(v=>`<${i===0?'th':'td'}>${escapeHtml(v)}</${i===0?'th':'td'}>`).join('')}</tr>`).join('')+'</table>';rows=[];}};for(const line of body.split('\n')){if(/^\|/.test(line)){if(!/^\|[\s:-]+\|/.test(line))rows.push(line.split('|').slice(1,-1).map(v=>v.trim()));continue;}flush();const h=line.match(/^(#{1,3})\s+(.+)/);if(h)result+=`<h${h[1]?.length}>${escapeHtml(h[2]??'')}</h${h[1]?.length}>`;else if(line.startsWith('> '))result+=`<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;else if(line.trim())result+=`<p>${escapeHtml(line)}</p>`;}flush();return result;}
function markdownDocx(body:string):Array<Paragraph|Table>{const blocks:Array<Paragraph|Table>=[];let rows:string[][]=[];const flush=()=>{if(rows.length){blocks.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:rows.map((row,i)=>new TableRow({tableHeader:i===0,children:row.map(v=>new TableCell({children:[new Paragraph({children:[new TextRun({text:v,size:18})]})]}))}))}));rows=[];}};for(const line of body.split('\n')){if(/^\|/.test(line)){if(!/^\|[\s:-]+\|/.test(line))rows.push(line.split('|').slice(1,-1).map(v=>v.trim()));continue;}flush();const h=line.match(/^(#{1,3})\s+(.+)/);blocks.push(new Paragraph({text:h?.[2]??line,...(h?{heading:h[1]?.length===1?HeadingLevel.HEADING_1:h[1]?.length===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3}:{}),spacing:{after:120}}));}flush();return blocks;}

export function outputWorkbook(o:GeneratedOutput,source:string){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Catalogue","Type","Title","Body"],[o.catalogue?.catalogueId??"",o.type,o.title,o.body]]),"Output");XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Source and review"],[footer(o,source)],...[...(o.draft?.citations??[])].map(c=>[c.segmentId,c.locatorKey,c.raw])]),"Source lineage");for(const [i,t] of (o.tables??[]).entries())XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Locator","Row","Cell","Value","Raw","Formula (not executed)"],...t.rows.flatMap(r=>r.cells.map(c=>[r.locator,String(r.row),c.ref,c.value,c.raw,c.formula??""]))]),`Table ${i+1}`);return new Blob([XLSX.write(book,{type:"array",bookType:"xlsx"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});}
