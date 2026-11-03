# Existing catalogue conversion architecture

Scope: the thirty unchanged definitions in `src/data/output-reference-catalogue.json`. Phase 3 acceptance is not granted; Phase 4 is not started.

## Runtime path
`generateOutputs` authorizes the caller with `may_upload`, reads `latestSource` once, derives source tables and draft classification, and invokes `generateCatalogue`. Catalogue-specific source signals, categories, sections and gaps live in `catalogue-handlers.ts`. Meeting outputs reuse `structuredMeetings`; no proceedings or decisions are inferred. Company-only definitions require `is_operator` on the server and in database validation.

## Source-category-aware retrieval
Every handler declares the record category it may draw on (`detectCategories` in `catalogue-handlers.ts`):

| Category | Detection rule | Outputs |
| --- | --- | --- |
| event | cited event content, or dated event signal | OUT-008–OUT-014, OUT-026, OUT-029 |
| meeting | structured meeting records or agenda/minutes markers | OUT-005–OUT-007, OUT-025 |
| placement | two or more placement/employer record lines | OUT-003, OUT-004, OUT-024 |
| contacts | email/phone patterns | OUT-002 |
| institution | explicit profile labels or 3+ institutional description lines | OUT-001, OUT-015, OUT-016, OUT-023, OUT-028 |
| research | 2+ research/publication/grant lines | OUT-027 |
| evidence | NAAC/NIRF/AICTE/UGC/criterion references | OUT-017, OUT-018, OUT-022 |
| analytics | engagement metric terms with numbers | OUT-030 |
| general | any source | OUT-019–OUT-021 |

A single event poster therefore cannot produce an annual report, employer directory, placement summary or accreditation matrix: those outputs are **blocked** with an explicit reason naming the missing inputs. Missing sections are never filled with generic text; generic-path drafts list unavailable sections under "Unavailable in the authorized source" instead of padding them.

## The 30 handlers
Each of OUT-001–OUT-030 has its own handler entry: source category, detection signal, section structure, and missing-input gates. Dedicated purpose-specific builders exist for the event family:

- **OUT-008 news article** — headline, standfirst, lead, programme focus, people/institutions, event information, verification note, SEO fields.
- **OUT-009 social variants** — per-channel copy (Facebook/Instagram/LinkedIn/X) with enforced channel length limits; over-limit copy is skipped, never truncated.
- **OUT-010 reel script** — timed storyboard sections; explicitly not a rendered video.
- **OUT-011 LinkedIn article** — essay structure (opening, context, coverage, organizers, honest closing), distinct from the news article.
- **OUT-012/013 email/WhatsApp drafts** — marked unsent; recipients, consent and sender authorization unconfirmed.
- **OUT-014 newsletter** — masthead, in-this-issue, feature story, details-at-a-glance, editorial note.
- **OUT-026 event publicity pack** — five independently written artifacts (poster copy, website blurb, press note, email invitation, WhatsApp invitation).
- **OUT-029 social media calendar** — schedule table using only source-recorded dates; conflicts (e.g. weekday/date) listed; no invented publication dates.

Data-dependent outputs (placement, institutional, evidence, analytics, research) generate only when their category is present in the authorized source, and even then remain source-derived drafts with explicit missing-input gates.

## Persistence and revisions
Migration `0015_versioned_catalogue_drafts.sql` preserves the exact previous validator as `output_source_event_v1`. The legacy branch is unchanged. New `catalogue-draft-1` outputs carry handler ID, revision, previous set ID, review cautions, missing inputs and exact document-segment citations. `save_catalogue_draft` validates caller permission, latest job, original hash, parser version, complete locator sequence, exact citations, company restrictions, draft/release state and exact immutable payload attestation, then inserts into the existing output store. No UPDATE permission was added. `reviseOutput` saves an append-only version and reads it back.

Attestation establishes saved payload equality and source attribution, **not semantic truth or factual approval**. Authored/manual text requires human review; no reviewed fact, mapping or readiness coverage is promoted. Tables remain intact and formulas are not executed.

The output contract state is fail-closed and now strictly validated: `template` is limited to the known draft templates (`catalogue-draft-1`, `source-event-1`) or null; `image/png` requires rendered 1080×1080 dimensions and text drafts must carry none; approver is always null and release is always `not_authorized`.

`getOutputs` combines newest accessible variants across up to 100 saved sets for a document, preserving per-output saved set IDs. Historical quarantine and current-source RLS remain enforced. Very long output histories need pagination before this bound is exceeded.

Rollback: `.lovable/catalogue-draft-rollback.sql` revokes the new save RPC and restores the exact preserved validator. It deletes nothing. New drafts remain stored but become hidden until the new validation branch is re-enabled. Rollback SQL is supplied, not executed against the running application.

## Files and visuals
Existing private `institution-documents` source/job/hash paths store immutable real 1080-square PNGs. `savedPng` requires an accessible current saved output reference and verifies downloaded SHA-256 and length. The persisted artifact contract remains locked to 1080×1080 by the server-side validator; changing it requires a separately authorized migration.

The browser Canvas renderer (`renderDraftImage` in `local-artifacts.ts`) makes no paid image calls and now produces a professional layout: branding band with typographic wordmark (no invented logos), kicker, title hierarchy with automatic size step-down, accent rule, body block and a review footer ribbon. Local (unsaved) downloads additionally include platform-size variants — square 1080×1080, portrait 1080×1350, landscape 1920×1080, story 1080×1920 — in the visual ZIP, each clearly marked as an unsaved draft. Content that does not fit throws; no truncated image is ever created.

Extracted-image reuse is not yet possible: the extraction pipeline stores text and table cells only, no image assets. The renderer therefore uses typography and theme tokens exclusively and does not substitute unrelated imagery.

Downloads: source-preserving TXT, DOCX, HTML, CSV, XLSX, manifest JSON and ZIP. HTML escapes all source/editor text. CSV blocks formula injection. XLSX cells are strings. PDF generation and full media packages remain incomplete; HTML is not a PDF.

## AI configuration
Existing server secret: `LOVABLE_API_KEY`, configured through Lovable's secret management; never frontend environment variables. Optional explicit-action long-form improvement uses `catalogue-writing.server.ts`, the existing AI SDK and run-ID helper, `openai/gpt-6-luna` Responses, zero-retention endpoint, strict JSON schema, streaming upstream, low reasoning, 3500 output-token maximum and zero automatic retries. Eligible types: news_article, newsletter, linkedin_article, annual_report, department_brochure, event_publicity, social_calendar. Each type carries purpose- and audience-specific writing guidance; the prompt forbids repeating source information under different headings and forbids invented facts. UI asks before each paid improvement; default deterministic generation costs no model credits.

AI cannot validate absent facts. Structured source text, review cautions and missing fields are supplied; output remains an AI/editorial draft. A returned source-cited draft still needs factual review. Broader durable AI denial/cost pause orchestration and a quality rubric for every catalogue output are not completed here.

## Acceptance evidence
University A session: existing poster `b046dc44-7896-4d70-9eec-b861d457d954`, job `3f22ae50-e164-431c-9685-048c0e8dbbb6`. Initial catalogue set `09397280-3fec-4b3e-9960-a44d10d0f15c`; AI article revision `8de17c16-bfbf-4e48-9b80-1ead26c6a2e2`; edited revision `56741a4d-0e1a-476d-befb-e63edb06ba8d` reopened after refresh. PNG set `3d4c2112-9668-4564-ab0c-840561196a3b`. Actual ZIP contains 121 entries, including PNG and per-variant files/manifests. These prove saved draft functionality, not full thirty-output acceptance or publication readiness.

2026-11-03 correction cycle: category-aware retrieval blocks all 19 non-event outputs on a poster-only source; dedicated builders produce distinct article/LinkedIn/newsletter/publicity-pack/calendar drafts; one AI verification call (run `01a1a08a-5a5e-702f-a6ba-897ecba5d33d`) confirmed the improved writing prompt returns professional source-grounded copy. Full suite 219/219 passed. Examples and the truthful status matrix: `/mnt/documents/IIAF_Improved_Examples_2026_11_03/`.

## Known limitations and remaining dependencies
- 11 of 30 outputs can draft from a single event poster; the other 19 are correctly blocked until their institutional records exist.
- Most non-event handlers produce conservative cited drafts, not complete cross-document professional reports; approved mappings, agency Q12/Q14 bindings and analytics remain missing.
- Persisted PNGs remain 1080×1080 only; platform sizes are local unsaved downloads. No extracted-image reuse (no image assets in storage). No PDF, carousel persistence, or video.
- No official mappings, approval, publication, consent or verified coverage is generated by any path.

Changes remain in the connected repository working tree; Lovable manages synchronization. No manual git commit/push, deployment or Phase 4 work was performed.

## 2026-11-03 quality engine cycle
Shared quality layer `src/lib/output-quality.ts` assesses every catalogue output against its own rule (required sections, developed length, citation traceability/coverage, filler, format, release restrictions) with categorical COMPLETE/PARTIAL/BLOCKED/NOT_IMPLEMENTED — computed at generation/readback, never persisted, so the 0015 attestation is untouched. OUT-029 is a full 13-section campaign calendar embedding actual OUT-009 copy with retrospective/demo classification for past dates and proposed-slot labelling. Generic builder distributes lines across sections by keyword affinity. Dispatcher key bumped to catalogue-dispatch-2. 16 focused + 225 full tests pass; tsgo clean; build OK. Examples and matrix: /mnt/documents/IIAF_Output_Quality_Engine_Acceptance_2026_11_03.md and IIAF_Quality_Engine_Examples_2026_11_03/. No AI calls this cycle; hosted save/readback not rerun (contract unchanged).


## Final master cycle (3 November 2026)
# IIAF Final Master Implementation — 3 November 2026

## Verdict: PARTIAL — not whole-product completion
Readiness gates and explicit limited/alternative selection are implemented for OUT-001–OUT-030. Six quality dimensions are independently displayed; headings, length, citations, a saved row and exports never establish COMPLETE. Authentication, tenant policies, source review, release restrictions and the existing catalogue are preserved.

## Verification
- Full suite passed 270/270 before the final refinements; final focused readiness/catalogue/contract/cache suite passed 84/84, including the additional occurrence-denial test.
- Automatic preview build OK at 11:13:05 UTC.
- Thirty category-purpose DEMO cases exercised. Twenty-nine categories produced actual draft files (32 variants); OUT-022 correctly produced no bundle because original bytes are absent.
- Actual DOCX and XLSX files opened structurally; DOCX converted by LibreOffice to 62 PDF pages. Every rendered page was visually inspected. Small dense tables remain a usability limitation; these are review examples, not professionally accepted deliverables. PDF examples are offline conversions; the app does not have a direct PDF download implementation.
- Authorized University A UI explicitly chose Single-item Bulletin. New saved set bef0e025-6f3d-43ea-a8a2-8584c44c28d0, newsletter revision 1, from saved poster job 3f22ae50-e164-431c-9685-048c0e8dbbb6. It reopened after full refresh; the correct newsletter Word download completed. No console errors or alert errors observed.
- Newly changed article, annual framework and calendar hosted-save checks were attempted but their expected buttons were not found in the test state; they are UNVERIFIED, not passed. Reopened historical versions are not evidence that the new bodies were saved.

## What changed and what remains
OUT-008 has announcement context, verified-source cautions, closing and SEO. OUT-014 refuses silent full-newsletter creation from one announcement and requires an explicit bulletin choice. OUT-015 offers a clearly labelled data-collection framework, never a fake full report. OUT-029 has proposed phased slots, retrospective treatment for past events, distinct channel copy and separate publishing/review states. Generic non-event handlers still emit source-field review drafts rather than complete professional reports; they require further purpose-specific development and acceptance. Approved assets, original evidence files, official agency bindings, actual analytics and appropriate institutional records remain dependencies. Every quality result remains PARTIAL or BLOCKED; no full catalogue or product acceptance is claimed.

No model/OCR requests, migrations, permissions widening, protected fact/mapping changes, full imports, deployment or Phase 4 work occurred. The only new hosted write was the authorized append-only bulletin draft. W1 remains pending; Phase 3 remains NO-GO; Phase 4 is unstarted.

