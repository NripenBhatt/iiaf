<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Shell lives in src/components/iiaf around <Outlet /> in __root.tsx; pages reuse iiaf/ui.tsx for consistency.
- Company-only modules remain flagged `internalOnly`; server authorization through authorizePage plus organization-scoped RLS protects access, while nav filtering is only presentation.
- Work is delivered in phases; never start a later phase without explicit user authorization.
- Analytics reuse analytics.tsx, analytics-data.ts and Recharts for consistent semantics and accessible equivalents.
- Original public addresses live under the _authenticated pathless layout with client-only validated session gating and server page authorization; public auth/reset/invitation routes render without the workspace shell.
- Output fixtures have explicit institution, audience and lifecycle fields and are filtered through `visibleOutputs`, so every demo output view uses the same visibility rule.
- Persistent foundation uses organizations, profiles, organization_memberships, user_roles and audit_events; roles never come from editable profiles or metadata, and app reads/writes use the authenticated RLS client.
- First-operator provisioning is service-role-only for a confirmed account; ongoing roles use transactional set_member_role with last-admin protection.
- Server functions live in src/lib/*.functions.ts and use the generated bearer middleware; service-role access is reserved for trusted provisioning/tests, never ordinary application reads.
- Master inspection is offline/read-only and served after company-role authorization; proposed mappings preserve source JSON, not approved bindings or executed imports.
- Controlled master imports decode bounded offline source batches only on the server and write through authenticated transactional database functions; run approval, readback and repeat-sample checks gate full imports, while original IDs and fields remain immutable and conflicts are logged rather than overwritten.
- Document uploads for all modules share one component, upload-rules and documents.functions; originals go to a private bucket keyed by organization/document ID and every state change passes through security-definer database functions that verify the stored object, so the browser can never mark an upload successful itself.
- Held reviews are append-only, never change importability, and gate full import server-side until every held row has a decision.
- Document intelligence: extraction runs server-side in src/lib/extraction.ts on the unchanged stored original; the user client authorizes via begin_processing, then only the trusted server process writes results with the service role through complete_processing_trusted (the one sanctioned non-provisioning service-role use); facts carry an integrity flag and legacy unverified facts never support packages; idempotent by document + locator + processor version, so retries never duplicate segments or facts.
- Proposed facts come only from explicit labels matched to upload-spec fields (src/data/fact-fields.json); unmatched labels stay unresolved and cannot be approved, and approval is a separate audited human step.
- Relationship rules use persisted records in security-definer functions: provenance links auto-approve, mapping/conflict links require review, endpoints cannot dangle or cross tenants.
- Requirement packages are built deterministically in src/lib/package-format.ts from src/lib/agency.functions.ts retrieval; each version is stored with its SHA-256, reviews bind to that hash, and any content change creates a new version that supersedes (invalidates) prior reviews. Certification is not implemented.
- Conversational Engine: /api/assistant streams through the AI gateway with tools that call the same retrieve/catalogue/savePackage helpers in agency.functions.ts using the caller's RLS client, so chat can never bypass or duplicate reporting authorization; it has no approval, review, import or certification tools by design.
- Assistant threads/messages use per-user/organization RLS; /conversation/$threadId shares /conversation access. Browser WAV dictation uses /api/transcribe; audio is never stored.
- Canonical field mappings are organisation-scoped internal interpretations changed only through propose_field_mapping/review_field_mapping; packages populate a field only via an approved mapping and a single unambiguous usable fact value. Word/PDF exports render stored package content verbatim client-side.
- OCR runs server-side in src/lib/ocr.server.ts through the Lovable AI Gateway (openai/gpt-6-astra, Responses API) for PNG/JPEG and scanned or mixed PDF pages; the gateway key never leaves the server. OCR locators are page-level only (no bounding boxes or confidence from the provider), OCR-derived facts carry the OCR_CAUTION review flag, and results flow through the same begin_processing/complete_processing_trusted path as text extraction.
- Native extraction covers PDF text, DOCX, DOC (word-extractor/Buffer with explicit conversion fallback), XLSX, XLS (SheetJS), PPTX slide/paragraphs, CSV and TXT; scans/PNG/JPEG use OCR. Parse stored originals server-side; inspect and report parser dependencies/runtime constraints.
- Type word-extractor's used CommonJS API in src/types/word-extractor.d.ts: Buffer|string to Promise of string getBody, avoiding unsafe casts.
