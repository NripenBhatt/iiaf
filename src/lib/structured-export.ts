import * as XLSX from "xlsx";
import JSZip from "jszip";
import { recordsCsv } from "./structured-records";
import type { Lineage } from "./lineage.functions";

export function lineageSheets(lineage: Lineage): Record<string, Record<string, unknown>[]> {
  const source = { document_id: lineage.document.id, filename: lineage.document.original_filename, original_hash: lineage.document.sha256_hash, recorded_period: lineage.document.reporting_period, release: "not_authorized" };
  return {
    documents: [{ ...source, ...lineage.document }],
    jobs: lineage.job ? [{ ...source, ...lineage.job }] : [],
    segments: lineage.segments.map(s => ({ ...source, ...s })),
    cells: lineage.tables.flatMap(t => t.rows.flatMap(r => r.cells.map(c => ({ ...source, job_id: lineage.job?.id, segment_id: lineage.segments.find(s => s.locator_key === r.locator)?.id, table_id: t.id, parent_cell: t.parentCell, row: r.row, locator_key: r.locator, ...c })))),
    facts: lineage.facts.map(f => ({ ...source, ...f, current_extraction: lineage.segments.some(s => s.id === f.segment_id) })),
    reviews: lineage.reviews.map(r => ({ ...source, ...r })),
    relationships: lineage.relationships.map(r => ({ ...source, ...r })),
    contact_candidates: lineage.contacts.map(c => ({ ...source, ...c })),
    outputs: lineage.outputRecords.map(o => ({ ...source, ...o })),
    reconciliation: [{ ...source, ...lineage.reconciliation, review_count: lineage.reviewCount, relationship_count: lineage.relationships.length, output_sets: lineage.outputRecords.length, generated_outputs: lineage.generatedOutputCount, downloaded_count: "Not recorded; download actions are not a persisted delivery log." }],
  };
}

export function structuredExcel(lineage: Lineage) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(lineageSheets(lineage))) {
    // Explicit string values stop formulas and preserve identifiers/raw JSON without coercion.
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const data = [keys, ...rows.map(row => keys.map(key => row[key] == null ? "" : typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key])))];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), name);
  }
  return new Blob([XLSX.write(book, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function structuredCsvZip(lineage: Lineage) {
  const zip = new JSZip();
  for (const [name, rows] of Object.entries(lineageSheets(lineage))) zip.file(`${name}.csv`, recordsCsv(rows));
  zip.file("readback.json", JSON.stringify(lineage, null, 2));
  return zip.generateAsync({ type: "blob" });
}