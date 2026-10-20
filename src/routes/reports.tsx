import { createFileRoute } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DataTable, PageHeader, PlaceholderNotice, PlannedButton, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";

export const Route = createFileRoute("/reports")({
  head: () => pageHead("Reports & Outputs", "Reports, profiles, meeting outputs and evidence dossiers with distinct release states."),
  component: Page,
});

function Page() {
  const { workspace } = useWorkspace();
  const isUni = workspace.kind === "university";
  const rows = [
    ["Annual Institutional Profile 2025–26", "Profile", "v3", <Status tone="success">Released</Status>, true],
    ["NAAC Criterion 3 dossier", "Evidence dossier", "v1", <Status tone="warning">In review</Status>, false],
    ["Leadership risk brief — Q1", "Internal analysis", "v2", <Status tone="teal">Generated</Status>, false],
    ["IQAC meeting summary — Mar", "Meeting output", "v1", <Status tone="success">Released</Status>, true],
  ] as const;
  const visible = rows.filter((r) => !isUni || r[4]);

  return (
    <>
      <PageHeader
        eyebrow="Output engine"
        title="Reports & Outputs"
        description="Generated, approved, released, published and submitted are distinct states."
        actions={!isUni && <PlannedButton><FilePlus2 className="size-4" /> New report</PlannedButton>}
      />
      <PlaceholderNotice>
        Report generation is not built. {isUni ? "University view lists only outputs marked as released (sample)." : "Company-only analyses are not shown to university workspaces."}
      </PlaceholderNotice>
      <DataTable
        caption={isUni ? "Outputs released to your institution" : "All outputs"}
        columns={["Output", "Type", "Version", "State"]}
        rows={visible.map((r) => [r[0], r[1], <span className="font-mono text-xs">{r[2]}</span>, r[3]])}
      />
    </>
  );
}
