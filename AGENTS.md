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
- Company-only modules are flagged `internalOnly` in src/components/iiaf/nav.ts; university workspaces hide them (UI only — real access control must be enforced server-side in a later phase).
- Work is delivered in phases; never start a later phase without explicit user authorization.
