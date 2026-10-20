import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { PageHeader, Panel, PlaceholderNotice } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Workspace profile, frameworks and preferences."),
  component: Page,
});

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1 border-b py-3 last:border-0 sm:flex-row sm:justify-between">
      <span className="text-sm text-muted-foreground">{k}</span>
      <span className="text-sm font-medium">{v}</span>
    </div>
  );
}

function Page() {
  const { workspace } = useWorkspace();
  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings" description="Workspace profile and configuration." />
      <PlaceholderNotice>Settings are read-only in Phase 0 and cannot be saved.</PlaceholderNotice>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Workspace">
          <Row k="Name" v={workspace.name} />
          <Row k="Type" v={workspace.kind === "internal" ? "Rafts and Rivers internal" : "University"} />
          <Row k="Academic year" v="2025–26 (sample)" />
        </Panel>
        <Panel title="Frameworks in scope">
          <Row k="NAAC" v="Edition to be confirmed" />
          <Row k="NIRF" v="Edition to be confirmed" />
          <Row k="QS / THE" v="Not configured" />
        </Panel>
      </div>
    </>
  );
}
