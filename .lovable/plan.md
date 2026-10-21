# IIAF v4 — Phase 1 only

## Scope
Improve the existing intake pages and replace fictional report listings with saved records. Keep the light design, existing addresses, sign-in, workspace permissions, original documents and extraction results.

1. Reconcile supplied catalogue sheets with current intake fields and prepare an internal requirements-to-files map. Record missing or conflicting inputs without inventing values.
2. Improve existing upload/package cards and dropdowns using catalogue descriptions, examples and supported formats. Show stored ownership, dates, status and latest activity where available; show missing assignments and deadlines honestly rather than inventing them.
3. Add one shared compact filter control for documents and saved outputs/reports: combined predicates, explicit date meaning, removable active filters, clear-all, matching counts and stable paginated ordering. Only expose filters supported by persisted metadata.
4. Replace the Reports page’s fictional register with actual saved output sets, source links and existing Word/text/ZIP downloads. Reuse existing output JSON/cache. Distinguish saved draft outputs from approved/released reports; do not create reports or invoke generation simply to populate the list.
5. Show evidence/format details only from authorized source records. Missing exact methodology editions, requirement metadata or assignments remain blocked/not recorded. University views must not gain access to internal mapping controls.
6. Verify combined filters, counts, date boundaries, tied timestamps, pagination and authorized downloads against stored records. Run focused existing tests plus small rule tests and check the fresh automatic build. Stop after Phase 1 with concise results and remaining blockers.

## Boundaries
- No paid model/provider/service/dependency, OCR rerun, parser rewrite, full master import, held-record decision or candidate-mapping approval.
- No Phase 2–4 implementation before separate authorization. Converse remains company-only.
- No invented image/video artifacts, readiness figures, release states, assignments or dates. Preserve explicit synthetic/draft labels; historical records without durable labels are not treated as verified evidence.
- Three visualizations only where real data supports meaningful measures; fictional analytics are not evidence of live readiness.

## Known dependency
The named **IIAF_Detailed_Concept_Note_v4.docx** is not in the supplied upload inventory or v2 bundle. The exact Converse v1.2 workbook is present in v2. Work can proceed on unambiguous Phase 1 requirements in the uploaded prompt; companion-dependent decisions stay blocked. No request to re-upload existing references.

## Technical implementation map
| Requirement | Existing implementation to reuse | Minimum change |
|---|---|---|
| Intake/catalogue cards | `document-uploads.tsx`, `upload-catalogue.json`, supplied catalogue/spec workbooks | Enrich shared intake presentation from authoritative catalogue data; retain upload pipeline |
| Authorized document list | `documents.functions.ts`, `uploaded_documents` | Server predicates/counts/range with timestamp+ID ordering; preserve authenticated RLS |
| Saved output/report list | `outputs.functions.ts`, `document_outputs`, `reports.tsx`, existing export helpers | Read-only paginated saved-output listing with source lineage; no duplicate output storage or generation |
| Shared filters | Institutional, Meeting, Evidence and Reports routes | Shared controls plus validated URL search state; allowlisted server predicates |
| Evidence detail | `agency.functions.ts`, persisted sources and current internal authorization | Reuse authorized retrieval only; never expose global/internal catalogue paths to university users |
| Acceptance | Existing routing/access/upload tests and stored test-university records | Focused rule tests and authenticated UI/readback checks; report account approval blockers honestly |

Add only additive indexes/metadata if necessary, with guarded migrations and no changes to existing permissions. Record architecture decisions in `AGENTS.md`. Fresh automatic build success is necessary, but not a substitute for actual tenant-scoped list/readback tests.