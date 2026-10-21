# Phase 2 approved repairs

| Requirement | Existing implementation | Repair / boundary |
|---|---|---|
| Native table preservation | extraction.ts; trusted completion stores locator JSON | Extend existing locators with cells, raw/display/formula/row/column; preserve DOCX grid and CSV blanks. Historical flattened tables remain explicitly partial, not reconstructed. |
| URL and multilingual labels | proposeFacts / matchField | Exclude bare URLs; Unicode normalization; unknown labels remain unresolved. |
| Source/job retrieval | outputs.functions.ts | Query latest successful job first, then paginate its segments; fail closed on errors/incomplete results. Never fall back silently to an older job. |
| Unchanged-source cache | processDocument / stored jobs | Default calls return existing completed extraction; explicit retry required to reread; keep trusted completion and approval unchanged. |
| Qualification | output JSON persistence | Versioned conservative content-unit qualifications, destinations, blockers and manifests embedded in existing document_outputs JSON. No new approval states/permissions. |
| Output integrity | output-export, Reports, DocumentUploads | Carry demo/unverified/draft/source lineage into downloads; real Word tables and CSV cells; block image/carousel/video claims without approved rendering. |
| Existing stored poster | stored segments + cached outputs | Reuse without OCR/model calls; deterministic enrichment and readback only. |

## Conflicts and dependencies
- Blueprint lists rendered image/video deliverables, but no approved renderer exists: BLOCKED, no dependency/provider added.
- OCR and legacy DOC/PDF text have page/line rather than table-cell geometry: partial, never manufacture cells.
- Historical records lack source-cell structure: retain originals and explicitly mark partial; no unchanged-source parser reruns.
- Runtime canonical fields remain the explicit reviewed catalogue subset. Unicode labels are retained unresolved unless actually present in that list; no fabricated field mappings.
- Full meeting intelligence and relationships belong to Phase 3, not this repair.
- v4 companion concept note remains absent; do not substitute an older edition.