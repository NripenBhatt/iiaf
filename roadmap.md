# Phase 1 security and persistence
- [x] Inspect existing application and connect supported Lovable Cloud.
- [x] Create organization, profile, membership, protected role and audit schema with tenant policies.
- [x] Add sign-in/out and protected routes while preserving existing URLs and light layouts.
- [x] Connect workspace, users, organization records and security audit to persisted data.
- [x] Establish controlled first-admin provisioning and authorized administration.
- [x] Execute auth, permission and two-university isolation tests plus UI regression checks.
- [x] Deliver schema, permissions, test results, setup steps and limitations; stop before Phase 2.

# Phase 2 controlled master import
- [x] Inspect actual workbook inventory, identifiers, references and validation issues.
- [x] Provide a protected import preview, exact field mappings and downloadable inspection summary.
- [x] Review proposed mapping before data writes — plan approved by user.
- [x] Add minimum approved staging/import records and run a representative sample with idempotency and two-university access tests.
- [x] Enable separately approved full import after verified sample, with persisted results and downloadable row outcomes.
- [ ] Execute and verify full import — waiting for separate authorized operator approval in the import page.
- [x] Deliver current Phase 2 acceptance and limitations report.
# Combined Phase 2 closure + Phase 3 upload foundation
- [x] A1 Execute import authorization tests with real accounts (company roles, university, unassigned, direct API).
- [x] A2 Held-record review log (decision, explanation, reviewer, timestamp) without changing importability.
- [x] A3 Separate import counts: inserted, existing identical, excluded, held, rejected, conflicts, updated.
- [x] A4 Keep full import gated; do not run it.
- [x] B1–B6 Shared secure upload pipeline for Institutional, Meetings and Evidence pages with metadata, hash duplicates, honest states, audit.
- [x] Acceptance tests 1–11 and one combined completion report.
- [ ] Record review decisions for all 244 held records — waiting on an authorized reviewer.
- [ ] Full import — waiting on explicit operator approval after reviews.
# Phase 4 combined
- [x] A2 Extended held-record decisions (finding, fields, correction, revalidation; approval blocked while source issue persists).
- [x] A3 Live access tests for new records and functions (48/48).
- [ ] A4 Full import — blocked: 244 held records have no reviewer decisions yet.
- [x] B1–B6 Extraction (PDF text, DOCX, XLSX, CSV, TXT), lifecycle, provenance, proposed facts, review queue.
- [x] C1–C5 Rules R-ENTITY-001, R-AGENCY-001, R-CONFLICT-001; live relationships page; lineage demonstrated.
- [x] OCR for scans/images — via Lovable AI Gateway vision model (no paid OCR service); page-level locators, human review required.
# Phase 5 criterion-to-evidence
- [x] Bulk held-record review workflow by finding type.
- [ ] Full import — blocked: 244 held records still need reviewer decisions and operator approval.
- [x] Agency Requirement Explorer, retrieval, draft package, hash-bound review, trusted extraction.

# Phase 6 extraction repair
- [x] Add precise declarations for the installed Word parser and verify automatic compiler/build results.
- [x] Re-run extraction tests and real-file OCR processing; verify locators and pending human review.
- [x] Report tested formats and remaining limitations without changing import gates or permissions.
