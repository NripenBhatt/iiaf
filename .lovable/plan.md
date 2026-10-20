# Phase 2 controlled master import

## Inspected source and preview
The actual workbook has **23 worksheets**, **1,881 evidence templates**, **20 agencies**, **112 requirement families**, **125 field rows** and **9,915 canonical source mapping candidates**. The protected **Master Data Import** page now shows the worksheet inventory, exact original columns, row counts, proposed targets, source status/version distributions, source row examples and downloadable validation details.

Of 12,053 canonical rows, **11,809 are proposed** and **244 are held**. Other 20,117 populated rows are projections, notes, lists or future-phase structures and are not proposed as a second canonical import.

## Mapping proposed for approval
- Import only AGENCY_MASTER, EVIDENCE_MASTER, AGENCY_REQUIREMENT_MASTER, AGENCY_FIELD_MASTER and EVIDENCE_REQUIREMENT_MAPPING as company-restricted, agency-wide reference records. Evidence rows are requirement templates, not uploaded university evidence.
- Preserve every original column and value, including nulls, in source fields. Preserve original identifiers, workbook SHA-256, worksheet and physical row provenance. Status labels are source labels, never official approval.
- Do not duplicate PARAMETER_EVIDENCE_MAPPING or the identical PARAMETER_DOCUMENT_BUNDLE projection. Inspect/archive supporting sheets; do not execute extraction, submission or relationship rules.
- Require original primary identifiers and necessary explicit references. Domain_ID, Framework_Version and other unpopulated optional fields remain null; do not manufacture values.

## Human-resolution items
- AGENCY_REQUIREMENT_MASTER row 95, NIRF-INNOV-REQ-001, lacks Agency_ID. Hold it, its one dependent field and 182 dependent junction rows. No automatic agency assignment.
- Hold all **60 rows** in 30 repeated relationship pairs; preserve their distinct Mapping_ID values. Two rows overlap with the dependency hold, producing 244 total held canonical rows.
- Retain distinct Evidence_ID values in 158 repeated package/evidence-name groups; name equality is not proof of duplication.
- The innovation requirement's source Document_Count is 140 while the junction contains 182 rows. Preserve both and flag the mismatch; do not rewrite the source.
- Source-labelled exact NIRF fields and pending official bindings are not independently verified. This phase does not approve them.

## After this mapping review
1. Add the minimum protected reference store and import-run/outcome records without changing Phase 1 identities or access policies.
2. Run a dependency-complete representative sample from actual source rows, including normal records, optional nulls, repeated relationship candidates and held references.
3. Show inserted, unchanged/skipped, conflicted and rejected sample outcomes in the app. Verify database readback, original identifiers/statuses, valid relationships and a second identical import with zero duplicates.
4. Verify direct-action denial and data visibility for university accounts and company roles, plus original dashboard and sign-in regressions.
5. Only after the sample passes, offer authorized operators a separate explicit full-import approval and execution action. Do not execute the full import automatically on plan approval.
6. Deliver persisted results, row-level errors and a Phase 2 acceptance report with PASS/PARTIAL/FAIL/NOT IMPLEMENTED classifications.

## Technical details
- Use an authenticated transactional database function for writes; independently validate active internal operator membership. Reviewers may inspect but not run imports. RLS denies university/anonymous reads and writes to this Phase 2 reference store.
- Proposed structures: `master_reference_records` for original IDs/source JSON and verified target references, `master_import_runs` for source hash, initiating user, timestamps, approval and verification state, and `master_import_outcomes` for row-level outcomes and mapping logs.
- Enforce stable source entity + source identifier uniqueness. Exact matches are skipped; changed existing payloads become conflicts, never silent overwrites. No deletions or fabricated updates.
- Staged/chunked runs record incomplete/failed state explicitly; only a final persisted count/reference verification marks a run verified.
- Retain source row identity and outcome logs for excluded and held rows too. Original worksheet terminology remains visible even where storage uses a generic reference entity.

## Boundaries
No full import has occurred. Sample import, database changes, idempotency and live university isolation checks for new records remain unimplemented pending this review. No document upload, OCR, meeting ingestion, Relationship Engine, official scoring, AI or report-generation services are included.