# First saved article and PNG — 23 October 2026

- Applied migration: `drizzle/migrations/0014_source_authored_artifacts.sql`. Exact prior deployed function captured as `output_source_legacy`. Existing rows, quarantine, original storage rules, memberships and roles unchanged. New object policies are tenant-scoped, insert/select only; no public storage or overwrite/delete authority.
- Authorized environment: current Lovable Cloud used by preview; no publishing/deployment. Existing private `institution-documents` bucket and completed saved extraction are prerequisites. No new provider, dependency or billing.
- Rollback: disable the new authoring entry point, then apply `.lovable/authored-output-rollback.sql` through the migration tool. It restores the exact captured validator and removes only additive artifact policies. Keep rows/objects for audit, hidden by fail-closed legacy reads. Rollback prepared, not applied or live-tested.

## Observed acceptance

University A used the existing same-original workshop poster `bd95644b-0600-49b4-b504-3d6ba5fa3e69`, saved job `fadc7ed4-f1c9-4ab9-8374-a9264900f08d`, parser `1.4.3+ocr-1.0.0`, **178 saved segments**. This is not the historical 183-line record or the initially inspected 182-line duplicate. The UI resolved an existing identically named source with the same original SHA-256 `715779b49308eadd9bffc4ee65d732c57ef5cfaa301b0d0197fa843106b1af39`; no upload or OCR was performed.

- PASS: genuine composed source-cited draft article and canvas PNG saved in existing set **23340dc1-8a51-4ae5-bab2-73c39472d3dd** at `2026-10-23T10:28:00.812901+00:00`.
- Article ID: `23340dc1-8a51-4ae5-bab2-73c39472d3dd:news_article`.
- Image ID: `23340dc1-8a51-4ae5-bab2-73c39472d3dd:image_creative`.
- PASS: source-backed title, subject, printed date, venue, organizer, host and conducting arrangement; unavailable actual attendance/outcomes omitted. Weekday/date inconsistency disclosed. The form-open window is not falsely asserted as the workshop duration. Poster sample dashboards are not real participants/statistics.
- PASS: both outputs reopened after a full browser reload in Institutional Information; actual TXT/Word/PNG downloads completed. PNG opened independently through Pillow, **1080×1080**, **120,631 bytes**, SHA-256 `5db3b398833b9ec778965987a54095446a7c67b86c03c21b53a5ef6174e1c895`.
- PASS: authenticated current-source validator accepts stored set and rejects body/source/raw/coverage/release/object/tenant/parser tampering (1 positive, 7 negative vectors).
- PASS: an existing legacy output remained readable. Focused command `bunx vitest run src/test/source-authored.test.ts src/test/output-cache.test.ts src/test/output-contract.test.ts src/test/local-artifacts.test.ts`: **30/30**.
- Source preservation: initially inspected 182-line record's document/jobs/segments/facts/relationships/mappings match pre-generation snapshot exactly; generation service writes only private artifact bytes and document_outputs. Selected 178-line source references read back correctly; no pre-generation full snapshot was captured for that duplicate, so byte-for-byte historical comparison of that duplicate is not claimed. No facts, contacts, tables, mappings or Brain records are rewritten by this path.

Evidence: `/tmp/browser/real-output/final-reopened.png`, `event-news-saved.png`, `news-article-saved.txt`, `news-article-saved.docx`, `guard-results.json`, `preservation.json`.

## Limits

This verifies the first event article + PNG workflow, not every authored category. The additive envelope admits cited event drafts for named authored types but dedicated newsletter/report/evidence/social generators are not completed or validated. Multi-source/media types beyond PNG stay unsupported. OCR and image pixels require human review; the server validates PNG header/metadata/hash references, not semantic truth of arbitrary client-rendered pixels. Draft release, approval and verified coverage remain prohibited. W1 evidence preserved; Phase 3 NO-GO, Phase 4 not started.