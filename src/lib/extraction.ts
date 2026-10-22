import { unzipSync, strFromU8 } from "fflate";
import fieldSpec from "@/data/fact-fields.json";
import { wordTree, children, descendants, wordText, val } from "./docx-structure";

/** Extraction output is untrusted data: it is stored and displayed, never executed or interpreted as instructions. */
export const PROCESSOR = "iiaf-extractor";
export const PROCESSOR_VERSION = "1.4.3";
export const MAX_SEGMENTS = 2000;
/** Added to every proposed fact whose text came from OCR rather than an embedded text layer. */
export const OCR_CAUTION = "Recognised by OCR from an image or scanned page; verify against the original before approving.";

export type SourceCell = { column: number; ref: string; raw: string; value: string; formula: string | null; type: string | null; rowSpan?: number; columnSpan?: number; verticalMerge?: string; mergeOrigin?: string | null };
export type Locator = Record<string, string | number | null | SourceCell[]>;
export type Segment = { seq: number; locator_key: string; locator: Locator; page: number | null; sheet: string | null; cell: string | null; content: string };
export type Fact = { label: string; field: string | null; spec: string | null; value: string; locator_key: string; locator: Locator; issues: string[] };
export type ExtractStatus = "extracted" | "needs_review" | "ocr_required" | "processing_failed";
export type Extraction = { status: ExtractStatus; method: string; segments: Segment[]; error: string | null; ocrPages?: number[] };

/** Builds source-located segments from OCR output. Locators are page-level: the OCR provider supplies no line coordinates. */
export function ocrSegments(pageLines: { page: number | null; lines: string[] }[], seqStart: number): Segment[] {
  const segments: Segment[] = [];
  for (const { page, lines } of pageLines) {
    lines.forEach((content, i) => segments.push({
      seq: seqStart + segments.length,
      locator_key: page === null ? `ocr:l${i + 1}` : `ocr:p${page}:l${i + 1}`,
      locator: { page, line: i + 1, source: "ocr", precision: "page-level" },
      page, sheet: null, cell: null, content,
    }));
  }
  return segments.slice(0, MAX_SEGMENTS);
}

/** Marks proposed facts that rest on OCR-recognised text so reviewers verify them against the original. */
export function tagOcrFacts(facts: Fact[]): Fact[] {
  for (const f of facts) if (f.locator["source"] === "ocr" && !f.issues.includes(OCR_CAUTION)) f.issues.push(OCR_CAUTION);
  return facts;
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
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

const PAIR = /^\s*([\p{L}][\p{L}\p{M}\p{N} _/&().-]{1,60}?)\s*[:=]\s*(.{1,500})$/u;
/** Proposes facts only from explicit "Label: value" pairs or labelled spreadsheet cells; no keyword inference. */
export function proposeFacts(segments: Segment[]): Fact[] {
  const facts: Fact[] = [];
  const headers = new Map<string, { column: number; label: string }[]>();
  const add = (s: Segment, label: string, value: string, cell?: SourceCell) => {
    if (facts.length >= 300) return;
    const f = matchField(label);
    facts.push({ label, field: f?.field ?? null, spec: f?.spec ?? null, value, locator_key: s.locator_key, locator: cell ? { ...s.locator, cell: cell.ref, column: cell.column } : s.locator, issues: validateFact(f?.field ?? null, value) });
  };
  for (const s of segments) {
    const cells = s.locator["cells"];
    if (Array.isArray(cells)) {
      const group = String(s.locator["sheet"] ?? s.locator["table"] ?? "csv");
      const knownHeaders = headers.get(group);
      if (knownHeaders) {
        for (const h of knownHeaders) {
          const cell = cells.find(c => c.column === h.column);
          if (cell?.value.trim()) add(s, h.label, cell.value, cell);
        }
        continue;
      }
      const labelled = cells.filter(c => matchField(c.value));
      if (cells.length === 2 && labelled.length === 1 && matchField(cells[0]?.value ?? "")) {
        const label = cells[0]; const value = cells[1];
        if (label && value) add(s, label.value, value.value, value);
        continue;
      }
      if (labelled.length >= 2) {
        headers.set(group, labelled.map(c => ({ column: c.column, label: c.value })));
        continue;
      }
    }
    if (/^\s*https?:\/\//i.test(s.content)) continue;
    const m = s.content.match(PAIR);
    if (!m) continue;
    const label = m[1]?.trim(); const value = m[2]?.trim();
    if (label && value) add(s, label, value);
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
  const pageLines = pages.map(p => lines(p));
  const segments: Segment[] = [];
  pageLines.forEach((ls, i) => ls.forEach((l, j) => segments.push({ seq: segments.length, locator_key: `p${i + 1}:l${j + 1}`, locator: { page: i + 1, line: j + 1 }, page: i + 1, sheet: null, cell: null, content: l })));
  // Pages with insufficient embedded text are scanned/image-only and routed to OCR by the caller.
  const deficient = pageLines.map((ls, i) => ({ n: i + 1, chars: ls.join("").length })).filter(p => p.chars < 20).map(p => p.n);
  if (deficient.length === pages.length) return { status: "ocr_required", method: "pdf-text-layer", segments: [], error: `No usable text layer on ${pages.length} page(s); scanned pages need OCR.`, ocrPages: deficient };
  if (deficient.length) return { status: "extracted", method: "pdf-text-layer", segments, error: null, ocrPages: deficient };
  return { status: "extracted", method: "pdf-text-layer", segments, error: null };
}

const xmlText = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&#(x[0-9a-f]+|\d+);/gi, (entity: string, code: string) => {
  const point = code.toLowerCase().startsWith("x") ? parseInt(code.slice(1), 16) : Number(code);
  return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
}).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function docx(bytes: Uint8Array): Extraction {
  const files = unzipSync(bytes, { filter: f => f.name === "word/document.xml" });
  const xml = files["word/document.xml"]; if (!xml) return { status: "processing_failed", method: "docx-xml", segments: [], error: "word/document.xml missing; not a valid DOCX." };
  const root = wordTree(strFromU8(xml)); const body = descendants(root, "w:body")[0];
  const segments: Segment[] = []; let heading: string | null = null; let p = 0; let table = 0;
  type WordNode = ReturnType<typeof wordTree>;
  function readTable(node: WordNode, parentCell: string | null) {
    const id = ++table; const active = new Map<number, SourceCell>();
    children(node, "w:tr").forEach((tr, index) => {
      const row = index + 1; let column = 1; const nested: { node: WordNode; ref: string }[] = [];
      const cells: SourceCell[] = children(tr, "w:tc").map(tc => {
        const value = children(tc, "w:p").map(wordText).join("\n");
        const props = children(tc, "w:tcPr")[0];
        const span = Math.max(1, Number(val(props ? children(props, "w:gridSpan")[0] : undefined) ?? 1));
        const merge = props ? children(props, "w:vMerge")[0] : undefined;
        const ref = `table${id}:r${row}:c${column}`;
        const origin = active.get(column);
        const cell: SourceCell = { column, ref, raw: value, value, formula: null, type: "text", columnSpan: span };
        if (merge) {
          cell.verticalMerge = val(merge) === "restart" ? "restart" : "continue";
          cell.mergeOrigin = cell.verticalMerge === "restart" ? ref : origin?.ref ?? null;
          if (cell.verticalMerge === "restart") { cell.rowSpan = 1; active.set(column, cell); }
          else if (origin) origin.rowSpan = (origin.rowSpan ?? 1) + 1;
        } else active.delete(column);
        for (const child of children(tc, "w:tbl")) nested.push({ node: child, ref });
        column += span; return cell;
      });
      segments.push({ seq: segments.length, locator_key: `table${id}:row${row}`, locator: { table: id, row, heading, parent_cell: parentCell, cells, header_status: "unverified" }, page: null, sheet: null, cell: null, content: cells.map(c => c.value).join(" | ") });
      for (const n of nested) readTable(n.node, n.ref);
    });
  }
  for (const node of body?.children ?? []) {
    if (node.tag === "w:tbl") readTable(node, null);
    if (node.tag !== "w:p") continue;
    p++; const t = wordText(node).replace(/\s+/g, " ").trim(); if (!t) continue;
    const style = val(descendants(node, "w:pStyle")[0]) ?? null;
    if (style && /heading|title/i.test(style)) heading = t;
    segments.push({ seq: segments.length, locator_key: `para${p}`, locator: { paragraph: p, style, heading, table: null }, page: null, sheet: null, cell: null, content: t });
  }
  const embedded = descendants(root, "w:drawing").length + descendants(root, "w:pict").length;
  return { status: embedded || !segments.length ? "needs_review" : "extracted", method: "docx-xml", segments, error: embedded ? "Partial extraction: embedded images are not transcribed; review the original." : segments.length ? null : "DOCX contains no text paragraphs." };
}

function colIndex(ref: string) { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + c.charCodeAt(0) - 64; return n; }
async function xlsx(bytes: Uint8Array): Promise<Extraction> {
  const { SSF } = await import("xlsx");
  const files = unzipSync(bytes, { filter: f => f.name === "xl/styles.xml" || f.name === "xl/workbook.xml" || f.name === "xl/sharedStrings.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name.startsWith("xl/worksheets/sheet") });
  const wb = files["xl/workbook.xml"]; if (!wb) return { status: "processing_failed", method: "xlsx-xml", segments: [], error: "xl/workbook.xml missing; not a valid XLSX." };
  const shared = (files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]).match(/<si>[\s\S]*?<\/si>/g) ?? [] : []).map(s => xmlText((s.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? []).join("")));
  const rels = files["xl/_rels/workbook.xml.rels"] ? strFromU8(files["xl/_rels/workbook.xml.rels"]) : "";
  const segments: Segment[] = [];
  const styles = files["xl/styles.xml"] ? strFromU8(files["xl/styles.xml"]) : "";
  const formats = Object.fromEntries((styles.match(/<numFmt [^>]*\/>/g) ?? []).map(x => [Number(x.match(/numFmtId="(\d+)"/)?.[1]), xmlText(x.match(/formatCode="([^"]+)"/)?.[1] ?? "")]));
  const styleFormats = (styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1]?.match(/<xf\b[^>]*>/g) ?? []).map(x => Number(x.match(/numFmtId="(\d+)"/)?.[1] ?? 0));
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
        const format = styleFormats[Number(c.match(/\bs="(\d+)"/)?.[1] ?? 0)] ?? 0;
        let display = value;
        if ((!t || t === "n") && value !== "" && Number.isFinite(Number(value)) && format) {
          try { display = SSF.format(formats[format] || format, Number(value), { date1904: /date1904="(?:1|true)"/.test(strFromU8(wb)) }); } catch { display = value; }
        }
        return { ref, col: colIndex(ref), value: display, raw: value, formula: c.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1] ?? null, type: t ?? "n" };
      });
      if (!cells.some(c => c.value || c.formula)) continue;
      if (first) { headers = Object.fromEntries(cells.map(c => [c.col, c.value])); first = false; }
      const content = cells.length === 2 && !headers[cells[1]!.col]?.length ? `${cells[0]!.value}: ${cells[1]!.value}` : cells.map(c => c.value).join(" | ");
      const range = `${cells[0]!.ref}:${cells[cells.length - 1]!.ref}`;
      segments.push({ seq: segments.length, locator_key: `${name}!${range}`, locator: { sheet: name, row: +r, range, cells: cells.map(c => ({ column: c.col, ref: c.ref, raw: c.raw, value: c.value, formula: c.formula, type: c.type })), header_status: "unverified", merged_ranges: (strFromU8(file).match(/<mergeCell\s+ref="([^"]+)"/g) ?? []).join("; ") }, page: null, sheet: name, cell: range, content: cells.length === 2 ? `${cells[0]!.value}: ${cells[1]!.value}` : content });
      if (segments.length >= MAX_SEGMENTS) break;
    }
  }
  return { status: segments.length ? "extracted" : "needs_review", method: "xlsx-xml", segments, error: segments.length ? null : "Workbook contains no cell values." };
}

/** PPTX: reads slides in presentation order, preserving slide and paragraph references. */
function pptx(bytes: Uint8Array): Extraction {
  const files = unzipSync(bytes, { filter: f => f.name === "ppt/presentation.xml" || f.name === "ppt/_rels/presentation.xml.rels" || /^ppt\/slides\/slide\d+\.xml$/.test(f.name) });
  const pres = files["ppt/presentation.xml"]; if (!pres) return { status: "processing_failed", method: "pptx-xml", segments: [], error: "ppt/presentation.xml missing; not a valid PPTX." };
  const rels = files["ppt/_rels/presentation.xml.rels"] ? strFromU8(files["ppt/_rels/presentation.xml.rels"]) : "";
  const targetOf = (rid: string) => {
    const t = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
    return t ? (t.startsWith("/") ? t.slice(1) : t.startsWith("ppt/") ? t : `ppt/${t}`) : undefined;
  };
  const order = (strFromU8(pres).match(/<p:sldId [^>]*\/>/g) ?? []).map(s => targetOf(s.match(/r:id="([^"]+)"/)?.[1] ?? "")).filter((t): t is string => Boolean(t));
  const slideFiles = order.length ? order : Object.keys(files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
  const segments: Segment[] = [];
  let omittedVisuals = false;
  slideFiles.forEach((file, i) => {
    const xml = files[file]; if (!xml) return;
    if (/<p:pic\b|<a:tbl\b|<c:chart\b|<a:graphicData\b/.test(strFromU8(xml))) omittedVisuals = true;
    const slide = i + 1; let para = 0;
    for (const p of strFromU8(xml).match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []) {
      para++;
      const t = xmlText((p.match(/<a:t>[\s\S]*?<\/a:t>/g) ?? []).join("")).replace(/\s+/g, " ").trim();
      if (!t) continue;
      segments.push({ seq: segments.length, locator_key: `slide${slide}:p${para}`, locator: { slide, paragraph: para, part: file }, page: slide, sheet: null, cell: null, content: t });
      if (segments.length >= MAX_SEGMENTS) return;
    }
  });
  return { status: omittedVisuals || !segments.length ? "needs_review" : "extracted", method: "pptx-xml", segments, error: omittedVisuals ? "Partial extraction: slide images, charts and table structure are not extracted; review the original presentation." : segments.length ? null : "Presentation contains no slide text." };
}

/** Legacy DOC (OLE compound file): text via the validated word-extractor library. */
async function doc(bytes: Uint8Array): Promise<Extraction> {
  const B = (globalThis as { Buffer?: typeof import("node:buffer").Buffer }).Buffer;
  if (!B) return { status: "needs_review", method: "doc-ole", segments: [], error: "Legacy .doc extraction is unavailable in this runtime; convert the file to DOCX or PDF and upload again." };
  const WordExtractor = (await import("word-extractor")).default;
  const extracted = await new WordExtractor().extract(B.from(bytes));
  const segments = extracted.getBody().split(/\r?\n/).map((l, i) => ({ l: l.replace(/\s+/g, " ").trim(), i })).filter(x => x.l)
    .map((x, n) => ({ seq: n, locator_key: `l${x.i + 1}`, locator: { line: x.i + 1 }, page: null, sheet: null, cell: null, content: x.l }));
  return { status: segments.length ? "extracted" : "needs_review", method: "doc-ole", segments: segments.slice(0, MAX_SEGMENTS), error: segments.length ? null : "DOC contains no extractable text." };
}

/** Legacy XLS (BIFF): cell values via the validated SheetJS library, preserving sheet and cell references. */
async function xls(bytes: Uint8Array): Promise<Extraction> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "array" });
  const segments: Segment[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]; if (!sheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let r = range.s.r; r <= range.e.r && segments.length < MAX_SEGMENTS; r++) {
      const cells: SourceCell[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const ref = XLSX.utils.encode_cell({ r, c }); const source = sheet[ref];
        cells.push({ column: c + 1, ref, raw: String(source?.v ?? ""), value: source ? XLSX.utils.format_cell(source) : "", formula: source?.f ?? null, type: source?.t ?? null });
      }
      if (!cells.some(c => c.value || c.formula)) continue;
      const vals = cells.map(c => c.value);
      const content = vals.length === 2 && vals[0] && vals[1] ? `${vals[0]}: ${vals[1]}` : vals.join(" | ");
      segments.push({ seq: segments.length, locator_key: `${name}!row${r + 1}`, locator: { sheet: name, row: r + 1, cells, header_status: "unverified" }, page: null, sheet: name, cell: `row ${r + 1}`, content });
    }
    if (segments.length >= MAX_SEGMENTS) break;
  }
  return { status: segments.length ? "extracted" : "needs_review", method: "xls-biff", segments: segments.slice(0, MAX_SEGMENTS), error: segments.length ? null : "Workbook contains no cell values." };
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
    segments.push({ seq: segments.length, locator_key: `row${i + 1}`, locator: { row: i + 1, columns: vals.length, cells: cells.map((raw, c) => ({ column: c + 1, ref: `row${i + 1}:col${c + 1}`, raw, value: vals[c] ?? "", formula: null, type: "text" })), header_status: "unverified" }, page: null, sheet: "csv", cell: `row ${i + 1}`, content });
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
    const result = await extractNative(ext, bytes);
    const limited = result.segments.length >= MAX_SEGMENTS || result.segments.some(s => s.content.length > 8000);
    if (limited) return { ...result, status: "needs_review", segments: result.segments.slice(0, MAX_SEGMENTS), error: "Partial extraction: segment or stored-text limit reached; remaining content requires review of the original. No completeness claim." };
    return result;
  } catch (e) {
    return { status: "processing_failed", method: ext, segments: [], error: `Extraction failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}` };
  }
}

async function extractNative(ext: string, bytes: Uint8Array): Promise<Extraction> {
    switch (ext) {
      case "pdf": return await pdf(bytes);
      case "docx": return docx(bytes);
      case "doc": return await doc(bytes);
      case "xlsx": return await xlsx(bytes);
      case "xls": return await xls(bytes);
      case "pptx": return pptx(bytes);
      case "csv": return csv(bytes);
      case "txt": return txt(bytes);
      case "jpg": case "jpeg": case "png": return { status: "ocr_required", method: "none", segments: [], error: "Image has no embedded text; the processing step runs OCR on it." };
      default: return { status: "needs_review", method: "none", segments: [], error: `.${ext} is stored but not supported by extractor ${PROCESSOR_VERSION}; manual review required.` };
    }
}
