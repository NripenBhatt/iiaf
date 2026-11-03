# Existing catalogue conversion architecture

Scope: the thirty unchanged definitions in `src/data/output-reference-catalogue.json`. Phase 3 acceptance is not granted; Phase 4 is not started.

## Runtime path
`generateOutputs` authorizes the caller with `may_upload`, reads `latestSource` once, derives source tables and draft classification, and invokes `generateCatalogue`. Catalogue-specific source signals, sections and gaps live in `catalogue-handlers.ts`. Meeting outputs reuse `structuredMeetings`; no proceedings or decisions are inferred. Company-only definitions require `is_operator` on the server and in database validation.

Catalogue handlers currently include complete event transformations and conservative, sectioned source drafts for other categories. The latter are **not complete professional entity reports**: they do not yet assemble all approved cross-document facts, agency mappings or analytics. Presence of a handler is not acceptance. See the delivered matrix.

## Persistence and revisions
Migration `0015_versioned_catalogue_drafts.sql` preserves the exact previous validator as `output_source_event_v1`. The legacy branch is unchanged. New `catalogue-draft-1` outputs carry handler ID, revision, previous set ID, review cautions, missing inputs and exact document-segment citations. `save_catalogue_draft` validates caller permission, latest job, original hash, parser version, complete locator sequence, exact citations, company restrictions, draft/release state and exact immutable payload attestation, then inserts into the existing output store. No UPDATE permission was added. `reviseOutput` saves an append-only version and reads it back.

Attestation establishes saved payload equality and source attribution, **not semantic truth or factual approval**. Authored/manual text requires human review; no reviewed fact, mapping or readiness coverage is promoted. Tables remain intact and formulas are not executed.

`getOutputs` combines newest accessible variants across up to 100 saved sets for a document, preserving per-output saved set IDs. This fixes an image-only set hiding earlier article/newsletter variants. Historical quarantine and current-source RLS remain enforced. Very long output histories need pagination before this bound is exceeded.

Rollback: `.lovable/catalogue-draft-rollback.sql` revokes the new save RPC and restores the exact preserved validator. It deletes nothing. New drafts remain stored but become hidden until the new validation branch is re-enabled. Rollback SQL is supplied, not executed against the running application.

## Files and visuals
Existing private `institution-documents` source/job/hash paths store immutable real 1080-square PNGs. `savedPng` requires an accessible current saved output reference and verifies downloaded SHA-256 and length. The browser Canvas renderer makes no paid image calls. This cycle verified one actual square event PNG, not all channel dimensions, carousel panels, original-photo reuse, or video.

Downloads: source-preserving TXT, DOCX, HTML, CSV, XLSX, manifest JSON and ZIP. HTML escapes all source/editor text. CSV blocks formula injection. XLSX cells are strings. PDF generation and full media packages remain incomplete; HTML is not a PDF.

## AI configuration
Existing server secret: `LOVABLE_API_KEY`, configured through Lovable's secret management; never frontend environment variables. No new key or dependency was needed. New optional explicit-action long-form improvement uses `catalogue-writing.server.ts`, the existing AI SDK and run-ID helper, `openai/gpt-6-luna` Responses, zero-retention endpoint, strict JSON schema, streaming upstream, low reasoning, 3500 output-token maximum and zero automatic retries. One request was actually exercised and saved; no OCR, image model or repeated model generations occurred. UI asks before each paid improvement; default deterministic generation costs no model credits.

AI cannot validate absent facts. Structured source text, review cautions and missing fields are supplied; output remains an AI/editorial draft. A returned source-cited draft still needs factual review. Broader durable AI denial/cost pause orchestration and a quality rubric for every catalogue output are not completed here.

## Acceptance evidence
University A session: existing poster `b046dc44-7896-4d70-9eec-b861d457d954`, job `3f22ae50-e164-431c-9685-048c0e8dbbb6`. Initial catalogue set `09397280-3fec-4b3e-9960-a44d10d0f15c`; AI article revision `8de17c16-bfbf-4e48-9b80-1ead26c6a2e2`; edited revision `56741a4d-0e1a-476d-befb-e63edb06ba8d` reopened after refresh. PNG set `3d4c2112-9668-4564-ab0c-840561196a3b`. Actual ZIP contains 121 entries, including PNG and per-variant files/manifests. These prove saved draft functionality, not full thirty-output acceptance or publication readiness.

Original 43 output payloads remained byte-semantically unchanged: digest `a1bc062478b6a811a7fb013d7f6809cd` before and after. No extraction engine, originals, memberships, review/mapping states or master controls were edited. Focused command: `bunx vitest run src/test/catalogue-handlers.test.ts src/test/source-authored.test.ts src/test/output-cache.test.ts src/test/output-selection.test.ts src/test/output-opportunities.test.ts` — 26/26 passed. Build evidence is the automatic harness log, not a manually invoked build.

Changes remain in the connected repository working tree; Lovable manages synchronization. No manual git commit/push, deployment or Phase 4 work was performed.