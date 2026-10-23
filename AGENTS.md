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
- Subdirectories src/components/iiaf and src/lib have their own AGENTS.md; read them before changing files there.
- Company-only modules remain flagged `internalOnly`; server authorization through authorizePage plus organization-scoped RLS protects access, while nav filtering is only presentation.
- Phases require separate authorization. Offline G3 decimal/SQL proofs use disposable local clusters, never runtime cache code or hosted migrations.
- Original public addresses live under the _authenticated pathless layout with client-only validated session gating and server page authorization; public auth/reset/invitation routes render without the workspace shell.
- Output fixtures have explicit institution, audience and lifecycle fields and are filtered through `visibleOutputs`, so every demo output view uses the same visibility rule.
- Persistent foundation uses organizations, profiles, organization_memberships, user_roles and audit_events; roles never come from editable profiles or metadata, and app reads/writes use the authenticated RLS client.
- First-operator provisioning is service-role-only for a confirmed account; ongoing roles use transactional set_member_role with last-admin protection.
- Server functions live in src/lib/*.functions.ts and use the generated bearer middleware; service-role access is reserved for trusted provisioning/tests, never ordinary application reads.
- Master inspection is offline/read-only and served after company-role authorization; proposed mappings preserve source JSON, not approved bindings or executed imports.
- Master imports use bounded offline batches and authenticated transactions; approval, readback and repeat samples gate full import. Source IDs/fields stay immutable; log conflicts, never overwrite.
- Document uploads for all modules share one component, upload-rules and documents.functions; originals go to a private bucket keyed by organization/document ID and every state change passes through security-definer database functions that verify the stored object, so the browser can never mark an upload successful itself. Results/mapping use upload-results.tsx and destination-map.ts, keeping qualified/candidate/persisted/generated distinct; batches persist in upload_batches.
- Held reviews are append-only, never change importability, and gate full import server-side until every held row has a decision.
- Document intelligence: extraction runs server-side in src/lib/extraction.ts on the unchanged stored original; the user client authorizes via begin_processing, then only the trusted server process writes results with the service role through complete_processing_trusted (the one sanctioned non-provisioning service-role use); facts carry an integrity flag and legacy unverified facts never support packages; idempotent by document + locator + processor version, so retries never duplicate segments or facts.
- Facts use explicit labels or exact table headers from fact-fields.json; value-cell locators retain row provenance. Unknown labels stay unresolved; approval is separately audited.
- Relationship rules use persisted records in security-definer functions: provenance links auto-approve, mapping/conflict links require review, endpoints cannot dangle or cross tenants.
- Packages use deterministic agency retrieval; reviews bind to version hashes. Retrieval excludes stale, conflicting and recognizable synthetic facts and preserves periods/endpoints; this is not transactional invalidation. Certification is unavailable.
- Canonical mappings are organization-scoped, changed only by propose_field_mapping/review_field_mapping. Populate packages only from an approved mapping and one usable value; Word/PDF export stored content verbatim.
- OCR in ocr.server.ts uses the server-only AI Gateway for images/scanned PDF pages; locators are page-level, facts carry OCR_CAUTION and use trusted processing/human review.
- Native parsers read stored originals; typed word-extractor/Buffer DOC has conversion fallback. Synthetic offline fixtures are distinct from missing originals.
- Outputs/search/packages reuse paginated newest-started-job segments; failed/pending jobs never fall back to old success. No model calls; draft manifests retain lineage/cells in downloads.
- Shared filters subscribe to committed router location and retain pending edits until navigation finishes, preventing intermediate route matches from erasing typed input.
- Output writes/reads validate source references and draft contracts; authored drafts/artifacts share document_outputs and private source/job/hash storage. Legacy guards remain intact; equal stored winners only. Extraction and pixels require review.
- Table cells persist in locator JSON; flattened historical/OCR tables stay partial. Default processing reuses saved extraction; rereading requires an explicit retry reason.
- Catalogue/crosswalk matches are source references, not executed behavior or approved bindings; retain unresolved fields and fail closed for unsupported contracts.
- Automatic output opportunities are recomputed from current RLS-scoped saved segments via output-opportunities; Desired Output only adds entries. A saved output record, never a rule match or local rendering, establishes generated/persisted status; protected output-contract gates must not be bypassed by relabelling deliverables as review artifacts.
- Historical output quarantine is persisted, immutable and enforced by RLS; new sets require source-linked draft manifests and the Phase 3 output gate remains fail-closed to prevent legacy/prose labels granting eligibility.
- Meeting contracts use explicit source table headers only, retaining per-field provenance, missing values and alternatives; deterministic drafts never infer proceedings or promote facts.
- DOCX uses a depth-aware OOXML tree for nested tables and merge-origin metadata; embedded-image omissions force manual review and existing originals are never automatically reread.
