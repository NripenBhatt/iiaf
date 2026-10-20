import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Analytics } from "@/components/iiaf/analytics";
import { visibleOutputs } from "@/components/iiaf/output-data";
import { createFileRoute } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DataTable, PageHeader, PlaceholderNotice, PlannedButton, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => pageHead("Reports & Outputs", "Reports, profiles, meeting outputs and evidence dossiers with distinct release states."),
  component: Page,
});

function Page() {
  const { workspace } = useWorkspace();
  const isUni = workspace.kind === "university";
  const [filter, setFilter] = useState("All");
  const visible = visibleOutputs(isUni, workspace.id).filter(r => filter === "All" || r.state === filter);

  return (
    <>
      <PageHeader
        eyebrow="Output engine"
        title={isUni ? "Reports & Released Outputs" : "Reports & Outputs"}
        description="Generated, approved, released, published and submitted are distinct states."
        actions={!isUni && <PlannedButton><FilePlus2 className="size-4" /> New report</PlannedButton>}
      />
      <PlaceholderNotice>
        Report generation is not built. {isUni ? "University view contains institution-authorized sample drafts and review items, plus designated releases. It excludes company-only analysis." : "Company-only analyses are not shown to university workspaces."}
      </PlaceholderNotice>
      <Analytics page="reports" />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4"><div className="overflow-x-auto"><TabsList className="h-auto bg-transparent p-0">{["All", "Draft", "In review", "Approved", "Released", "Published"].map(state => <TabsTrigger key={state} value={state} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-secondary/30 data-[state=active]:shadow-none">{state}</TabsTrigger>)}</TabsList></div></Tabs>
      <DataTable
        caption={isUni ? "Institution-authorized sample outputs" : "All outputs"}
        columns={["Output", "Type", "Version", "State"]}
        rows={visible.map((r) => [r.title, r.category, <span className="font-mono text-xs">{r.version}</span>, <Status tone={r.state === "Released" || r.state === "Published" ? "success" : r.state === "In review" ? "warning" : "neutral"}>{r.state}</Status>])}
      />
      {visible.length === 0 && <p className="border-x border-b bg-card p-5 text-sm text-muted-foreground">No sample outputs in this state.</p>}
    </>
  );
}
