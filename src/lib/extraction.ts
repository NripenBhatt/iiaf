import { unzipSync, strFromU8 } from "fflate";
import fieldSpec from "@/data/fact-fields.json";

/** Extraction output is untrusted data: it is stored and displayed, never executed or interpreted as instructions. */
export const PROCESSOR = "iiaf-extractor";
export const PROCESSOR_VERSION = "1.0.0";
export const MAX_SEGMENTS = 2000;

export type Locator = Record<string, string | number | null>;
export type Segment = { seq: number; locator_key: string; locator: Locator; page: number | null; sheet: string | null; cell: string | null; content: string };
export type Fact = { label: string; field: string | null; spec: string | null; value: string; locator_key: string; locator: Locator; issues: string[] };
export type ExtractStatus = "extracted" | "needs_review" | "ocr_required" | "processing_failed";
export type Extraction = { status: ExtractStatus; method: string; segments: Segment[]; error: string | null };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const FIELDS = fieldSpec.fields.map(f => ({ ...f, keys: [norm(f.field), norm(f.label ?? "")].filter(Boolean) }));

export function matchField(label: string) {
  const k = norm(label);
  return FIELDS.find(f => f.keys.includes(k)) ?? null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return valid(+m[3]!, +m[2]!, +m[1]!);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (m) { const mo = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()); return mo < 0 ? null : valid(+m[3]!, mo + 1, +m[1]!); }
  return null;
}
function valid(y: number, mo: number, d: number) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
}

/** Validates a value against the field it is proposed for. Returns human-readable issues. */
export function validateFact(field: string | null, value: string): string[] {
  const issues: string[] = [];
  if (!field) issues.push("No canonical field in the upload specification matches this label; mapping unresolved.");
  if (!value.trim()) issues.push("Value is empty.");
  if (field === "Evidence_ID" && !/^EV-\d{4}$/.test(value.trim())) issues.push("Evidence_ID must look like EV-0000.");
  if (field && /date/i.test(field) && field !== "Owner_and_Due_Date" && field !== "Event_Date_Range" && !parseDate(value)) issues.push("Date is not in a recognised unambiguous format (YYYY-MM-DD, DD/MM/YYYY or 12 March 2026).");
  if (field === "Publication_URL" && !/^https?:\/\/\S+$/.test(value.trim())) issues.push("URL must start with http:// or https://.");
  return issues;
}

const PAIR = /^\s*([A-Za-z][A-Za-z0-9 _/&().-]{1,60}?)\s*[:=]\s*(.{1,500})$/;
/** Proposes facts only from explicit "Label: value" pairs or labelled spreadsheet cells; no keyword inference. */
export function proposeFacts(segments: Segment[]): Fact[] {
  const facts: Fact[] = [];
  for (const s of segments) {
    if (s.sheet !== null && s.locator["header_mapped"]) continue;
    const m = s.content.match(PAIR);
    if (!m) continue;
    const label = m[1]!.trim(); const value = m[2]!.trim(); const f = matchField(label);
    facts.push({ label, field: f?.field ?? null, spec: f?.spec ?? null, value, locator_key: s.locator_key, locator: s.locator, issues: validateFact(f?.field ?? null, value) });
    if (facts.length >= 300) break;
  }
  return facts;
}

function lines(text: string) { return text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean); }

async function pdf(bytes: Uint8Array): Promise<Extraction> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const segments: Segment[] = [];
  pages.forEach((p, i) => lines(p).forEach((l, j) => segments.push({ seq: segments.length, locator_key: `p${i + 1}:l${j + 1}`, locator: { page: i + 1, line: j + 1 }, page: i + 1, sheet: null, cell: null, content: l })));
  if (segments.map(s => s.content).join("").length < 20) return { status: "ocr_required", method: "pdf-text-layer", segments: [], error: `No usable text layer on ${pages.length} page(s); scanned PDF needs OCR, which is not configured.` };
  return { status: "extracted", method: "pdf-text-layer", segments, error: null };
}

const xmlText = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function docx(bytes: Uint8Array): Extraction {
  const files = unzipSync(bytes, { filter: f => f.name === "word/document.xml" });
  const xml = files["word/document.xml"]; if (!xml) return { status: "processing_failed", method: "docx-xml", segments: [], error: "word/document.xml missing; not a valid DOCX." };
  const body = strFromU8(xml); const segments: Segment[] = []; let heading: string | null = null; let p = 0; let table = 0;
  const parts = body.split(/(<w:tbl>|<\/w:tbl>)/); let inTable = false;
  for (const part of parts) {
    if (part === "<w:tbl>") { inTable = true; table++; continue; } if (part === "</w:tbl>") { inTable = false; continue; }
    for (const para of part.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
      p++; const t = xmlText((para.match(/<w:t[^>]*>[\s\S]*?<\/w:t>|<w:tab\/>/g) ?? []).map(x => x === "<w:tab/>" ? "\t" : x).join("")).replace(/\s+/g, " ").trim();
      if (!t) continue;
      const style = para.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? null;
      if (style && /heading|title/i.test(style)) heading = t;
      segments.push({ seq: segments.length, locator_key: `para${p}`, locator: { paragraph: p, style, heading, table: inTable ? table : null }, page: null, sheet: null, cell: null, content: t });
    }
  }
  return { status: segments.length ? "extracted" : "needs_review", method: "docx-xml", segments, error: segments.length ? null : "DOCX contains no text paragraphs." };
}

function colIndex(ref: string) { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + c.charCodeAt(0) - 64; return n; }
function xlsx(bytes: Uint8Array): Extraction {
  const files = unzipSync(bytes, { filter: f => f.name === "xl/workbook.xml" || f.name === "xl/sharedStrings.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name.startsWith("xl/worksheets/sheet") });
  const wb = files["xl/workbook.xml"]; if (!wb) return { status: "processing_failed", method: "xlsx-xml", segments: [], error: "xl/workbook.xml missing; not a valid XLSX." };
  const shared = (files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]).match(/<si>[\s\S]*?<\/si>/g) ?? [] : []).map(s => xmlText((s.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? []).join("")));
  const rels = files["xl/_rels/workbook.xml.rels"] ? strFromU8(files["xl/_rels/workbook.xml.rels"]) : "";
  const segments: Segment[] = [];
  for (const s of strFromU8(wb).match(/<sheet [^>]*\/>/g) ?? []) {
    const name = xmlText(s.match(/name="([^"]*)"/)?.[1] ?? "Sheet"); const rid = s.match(/r:id="([^"]+)"/)?.[1];
    const target = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
    const file = target ? files[`xl/${target.replace(/^\/?xl\//, "")}`] : undefined; if (!file) continue;
    let headers: Record<number, string> = {}; let first = true;
    for (const row of strFromU8(file).match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
      const r = row.match(/<row[^>]*r="(\d+)"/)?.[1] ?? "?";
      const cells = (row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []).map(c => {
        const ref = c.match(/r="([A-Z]+\d+)"/)?.[1] ?? ""; const t = c.match(/t="(\w+)"/)?.[1];
        const v = c.match(/<v>([\s\S]*?)<\/v>/)?.[1]; const inline = c.match(/<is>([\s\S]*?)<\/is>/)?.[1];
        const value = t === "s" && v !== undefined ? shared[+v] ?? "" : t === "inlineStr" && inline ? xmlText(inline) : v !== undefined ? xmlText(v) : "";
        return { ref, col: colIndex(ref), value: value.trim() };
      }).filter(c => c.value);
      if (!cells.length) continue;
      if (first) { headers = Object.fromEntries(cells.map(c => [c.col, c.value])); first = false; }
      const content = cells.length === 2 && !headers[cells[1]!.col]?.length ? `${cells[0]!.value}: ${cells[1]!.value}` : cells.map(c => c.value).join(" | ");
      const range = `${cells[0]!.ref}:${cells[cells.length - 1]!.ref}`;
      segments.push({ seq: segments.length, locator_key: `${name}!${range}`, locator: { sheet: name, row: +r, range }, page: null, sheet: name, cell: range, content: cells.length === 2 ? `${cells[0]!.value}: ${cells[1]!.value}` : content });
      if (segments.length >= MAX_SEGMENTS) break;
    }
  }
  return { status: segments.length ? "extracted" : "needs_review", method: "xlsx-xml", segments, error: segments.length ? null : "Workbook contains no cell values." };
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csv(bytes: Uint8Array): Extraction {
  const segments: Segment[] = [];
  parseCsv(new TextDecoder().decode(bytes)).forEach((cells, i) => {
    const vals = cells.map(c => c.trim()); if (!vals.some(Boolean)) return;
    const content = vals.length === 2 && vals[0] && vals[1] ? `${vals[0]}: ${vals[1]}` : vals.join(" | ");
    segments.push({ seq: segments.length, locator_key: `row${i + 1}`, locator: { row: i + 1, columns: vals.length }, page: null, sheet: "csv", cell: `row ${i + 1}`, content });
  });
  return { status: segments.length ? "extracted" : "needs_review", method: "csv-parser", segments: segments.slice(0, MAX_SEGMENTS), error: segments.length ? null : "CSV is empty." };
}

function txt(bytes: Uint8Array): Extraction {
  const segments = new TextDecoder().decode(bytes).split(/\r?\n/).map((l, i) => ({ l: l.trim(), i })).filter(x => x.l)
    .map((x, n) => ({ seq: n, locator_key: `l${x.i + 1}`, locator: { line: x.i + 1 }, page: null, sheet: null, cell: null, content: x.l }));
  return { status: segments.length ? "extracted" : "needs_review", method: "plain-text", segments: segments.slice(0, MAX_SEGMENTS), error: segments.length ? null : "Text file is empty." };
}

export async function extract(ext: string, bytes: Uint8Array): Promise<Extraction> {
  try {
    switch (ext) {
      case "pdf": return await pdf(bytes);
      case "docx": return docx(bytes);
      case "xlsx": return xlsx(bytes);
      case "csv": return csv(bytes);
      case "txt": return txt(bytes);
      case "jpg": case "jpeg": case "png": return { status: "ocr_required", method: "none", segments: [], error: "Image requires OCR. No OCR service is configured; nothing was extracted." };
      default: return { status: "needs_review", method: "none", segments: [], error: `.${ext} is stored but not supported by extractor ${PROCESSOR_VERSION}; manual review required.` };
    }
  } catch (e) {
    return { status: "processing_failed", method: ext, segments: [], error: `Extraction failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}` };
  }
}
