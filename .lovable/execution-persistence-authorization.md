# Protected persistence step — NOT AUTHORIZED / NOT APPLIED

23 October update: superseded only for the owner-authorized single-source article/PNG extension in migration 0014_source_authored_artifacts. Existing document_outputs and tenant-private original bucket are reused; legacy guards and quarantine remain intact. The other dependencies below remain unapproved/unimplemented; this does not authorize Phase 4 or release.

The working local authoring and rendering paths deliberately do not write authored content into an extraction-review type or create an alternative store that bypasses the current output safety gate.

## Separate authorization needed

1. Extend the existing `document_outputs` contract and its validating functions/triggers for exact authored types `press_release`, `website_event`, `linkedin`, `facebook`, `instagram`, `x_post`, and `profile_section`. Preserve all O06–O10/O13 validations and quarantine. Do not apply the unresolved G3/cache migration 0013.
2. Validate each substantive field against current organization-scoped document/job/segment/cell references and original hash/parser version. Require DEMO/unverified, draft, human review, no release and no verified coverage. No permission widening or role changes.
3. Add reviewed multi-source dependency and artifact storage contracts before consolidated outputs/PNG/carousel/video become saved outputs. A locally generated image is not storage evidence. Recheck every dependency on read; source changes must fail closed.
4. Add an additive organization-scoped contacts/entity model only after identity, review, consent, suppression and recipient-permission decisions are approved. Existing segment JSON remains the raw archive. Email/phone candidates are not approved recipients.
5. Approved catalogue activation needs a separately reviewed version/reviewer/activation authority model. Workbook references and candidate qualification do not supply approval.

## Risk / cost / rollback

- Risks: unsupported prose accepted as a contract, stale/multi-tenant source dependencies, identity conflation, private contact release, and accidental reclassification of quarantine. Current execution does not change these protections.
- Cost: no model/provider fees for deterministic templates or browser rendering; actual storage/compute usage is not certified as free. No billing is activated.
- Rollback: preserve existing immutable payloads and quarantine; disable newly admitted type writes; retain additive columns/tables and saved records for audit, reject their release/read-current status as appropriate. No destructive migration or role-grant rollback.
- Required tests before any application: exact source/payload positive/negative vectors, cross-tenant denied reads/writes, stale latest-job rejection, wrong cells/hash/parser rejection, ambiguity, payload type equality, concurrent winner handling, unchanged quarantine readback and existing legitimate-output compatibility. Reviewed G3 proof remains a separate blocker.

This is a narrow authorization boundary, not executable migration evidence. Exact executable SQL cannot honestly be presented as ready until the protected source/payload and concurrency validation design is reviewed; no substitute weaker gate is proposed. All independent local code paths continue without this change.