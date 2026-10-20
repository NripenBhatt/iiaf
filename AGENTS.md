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

- App shell (sidebar, header, workspace switcher) lives in src/components/iiaf and wraps <Outlet /> in __root.tsx; pages reuse shared components from src/components/iiaf/ui.tsx so the design stays consistent.
- Company-only modules remain flagged `internalOnly`; server authorization through authorizePage plus organization-scoped RLS protects access, while nav filtering is only presentation.
- Work is delivered in phases; never start a later phase without explicit user authorization.
- Page analytics use shared `analytics.tsx` renderers and `analytics-data.ts` fixtures with Recharts, so chart semantics and accessible equivalents remain consistent across workspaces.
- Original public addresses live under the _authenticated pathless layout with client-only validated session gating and server page authorization; public auth/reset/invitation routes render without the workspace shell.
- Output fixtures have explicit institution, audience and lifecycle fields and are filtered through `visibleOutputs`, so every demo output view uses the same visibility rule.
- Persistent foundation uses organizations, profiles, organization_memberships, user_roles and audit_events; roles never come from editable profiles or metadata, and app reads/writes use the authenticated RLS client.
- First operator provisioning is a service-role-only one-time database operation for a confirmed account; ongoing roles use the authorized transactional set_member_role function with last-admin protection.
- Server functions live in src/lib/*.functions.ts and use the generated bearer middleware; service-role access is reserved for trusted provisioning/tests, never ordinary application reads.
- Master workbook inspection is generated offline by a read-only script; its exact report is served only through an authenticated company-role check. Proposed import mappings preserve source columns in JSON and do not imply executed imports or approved agency bindings.
- Controlled master imports decode bounded offline source batches only on the server and write through authenticated transactional database functions; run approval, readback and repeat-sample checks gate full imports, while original IDs and fields remain immutable and conflicts are logged rather than overwritten.
