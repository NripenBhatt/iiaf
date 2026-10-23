import type { SourceLine } from "./output-contract";
import { sourceTables } from "./output-contract";

export type ArchivedSegment = SourceLine & { id: string; job_id: string };
export type ContactCandidate = { candidateKey: string; kind: "email" | "phone"; raw: string; normalized: string; documentId: string; jobId: string; segmentId: string; filename: string; locatorKey: string; locator: unknown; review: "human_review_required"; persisted: false; consent: "not_established"; affiliation: null };

/** Read-only proposals from saved text, never contact ownership, consent or a new truth store. */
export function contactCandidates(documentId: string, filename: string, segments: ArchivedSegment[]): ContactCandidate[] {
  return segments.flatMap(segment => {
    const found: ContactCandidate[] = [];
    const expressions = [
      ["email", /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi],
      // Only explicitly international numbers; dates, metrics and unlabelled local digits stay raw.
      ["phone", /\+\d[\d ()-]{6,}\d/g],
    ] as const;
    for (const [kind, expression] of expressions) for (const match of segment.content.matchAll(expression)) {
      const raw = match[0];
      const normalized = kind === "phone" ? raw.replace(/[ ()-]/g, "") : raw.replace(/@([^@]+)$/, (_, domain: string) => `@${domain.toLowerCase()}`);
      if (kind === "phone" && !/^\+[1-9]\d{7,14}$/.test(normalized)) continue;
      found.push({ candidateKey: `${segment.id}:${kind}:${match.index}`, kind, raw, normalized, documentId, filename, jobId: segment.job_id, segmentId: segment.id, locatorKey: segment.locator_key, locator: segment.locator, review: "human_review_required", persisted: false, consent: "not_established", affiliation: null });
    }
    return found;
  });
}

export function archiveReconciliation(segments: ArchivedSegment[], expected: number, facts: { segment_id: string; state: string }[], contacts: ContactCandidate[]) {
  const ids = new Set(segments.map(s => s.id));
  const tables = sourceTables(segments);
  return { expectedSegments: expected, persistedSegments: segments.length, complete: segments.length === expected,
    structuredTables: tables.length, structuredRows: tables.reduce((n, t) => n + t.rows.length, 0), structuredCells: tables.reduce((n, t) => n + t.rows.reduce((m, r) => m + r.cells.length, 0), 0),
    persistedFacts: facts.length, currentFacts: facts.filter(f => ids.has(f.segment_id)).length, historicalFacts: facts.filter(f => !ids.has(f.segment_id)).length,
    approvedFacts: facts.filter(f => f.state === "approved").length, contactCandidates: contacts.length, persistedContacts: 0,
    segmentsWithoutFact: segments.filter(s => !facts.some(f => f.segment_id === s.id)).length,
    structuredStorage: "Cells persist in segment locator JSON; table/row/cell views are derived, not independent database rows." };
}

/** All columns are exported as text; spreadsheet formulas are never executable. */
export function recordsCsv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const cell = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${(/^[\s]*[=+@-]/.test(raw) ? "'" : "")}${raw.replace(/"/g, '""')}"`;
  };
  return [keys, ...rows.map(row => keys.map(key => row[key]))].map(row => row.map(cell).join(",")).join("\r\n");
}