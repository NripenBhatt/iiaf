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
- Master imports use bounded offline batches and authenticated transactions; approval, readback and repeat samples gate full import. Source IDs/fields stay immutable; log conflicts, never overwrite.
- Document uploads for all modules share one component, upload-rules and documents.functions; originals go to a private bucket keyed by organization/document ID and every state change passes through security-definer database functions that verify the stored object, so the browser can never mark an upload successful itself.
- Held reviews are append-only, never change importability, and gate full import server-side until every held row has a decision.
- Document intelligence: extraction runs server-side in src/lib/extraction.ts on the unchanged stored original; the user client authorizes via begin_processing, then only the trusted server process writes results with the service role through complete_processing_trusted (the one sanctioned non-provisioning service-role use); facts carry an integrity flag and legacy unverified facts never support packages; idempotent by document + locator + processor version, so retries never duplicate segments or facts.
- Proposed facts come only from explicit labels matched to upload-spec fields (src/data/fact-fields.json); unmatched labels stay unresolved and cannot be approved, and approval is a separate audited human step.
- Relationship rules use persisted records in security-definer functions: provenance links auto-approve, mapping/conflict links require review, endpoints cannot dangle or cross tenants.
- Requirement packages are built deterministically in src/lib/package-format.ts from src/lib/agency.functions.ts retrieval; each version is stored with its SHA-256, reviews bind to that hash, and any content change creates a new version that supersedes (invalidates) prior reviews. Certification is not implemented.
- Conversational Engine: /api/assistant streams through the AI gateway with tools that call the same retrieve/catalogue/savePackage helpers in agency.functions.ts using the caller's RLS client, so chat can never bypass or duplicate reporting authorization; it has no approval, review, import or certification tools by design.
- Assistant threads/messages use per-user/organization RLS; /conversation/$threadId shares /conversation access. Browser WAV dictation uses /api/transcribe; audio is never stored.
- Canonical mappings are organization-scoped, changed only by propose_field_mapping/review_field_mapping. Populate packages only from an approved mapping and one usable value; Word/PDF export stored content verbatim.
- OCR in ocr.server.ts uses the server-only AI Gateway for images/scanned PDF pages; locators are page-level, facts carry OCR_CAUTION and use trusted processing/human review.
- Native parsers read stored originals; typed word-extractor/Buffer DOC has conversion fallback. Synthetic offline fixtures are distinct from missing originals.
- Outputs reuse paginated latest-job segments and drafts without model calls; qualification/manifests persist in document_outputs JSON. Downloads retain draft/classification/lineage and real cell tables; invoker SQL lists drafts without generation.
- Table cells persist in locator JSON; flattened historical/OCR tables stay partial. Default processing reuses saved extraction; rereading requires an explicit retry reason.
- Output catalogue rows are verbatim references; variant bindings grant no approval/access and unsupported contracts fail closed.
- Historical output quarantine is persisted, immutable and enforced by RLS; new sets require source-linked draft manifests and the Phase 3 output gate remains fail-closed to prevent legacy/prose labels granting eligibility.
- Meeting contracts use explicit source table headers only, retaining per-field provenance, missing values and alternatives; deterministic drafts never infer proceedings or promote facts.
- DOCX uses a depth-aware OOXML tree for nested tables and merge-origin metadata; embedded-image omissions force manual review and existing originals are never automatically reread.
