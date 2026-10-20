import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DataTable, PageHeader, PlaceholderNotice, PlannedButton, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";

export const Route = createFileRoute("/users")({
  head: () => pageHead("Users & Permissions", "Roles, module access and workspace boundaries."),
  component: Page,
});

function Page() {
  const { workspace } = useWorkspace();
  const internal = [
    ["A. Menon (sample)", "Operator · Admin", "All modules", <Status tone="success">Active</Status>],
    ["R. Iyer (sample)", "Analyst", "Intelligence, Reports", <Status tone="success">Active</Status>],
  ];
  const uni = [
    ["Registrar (sample)", "Decision-maker", "Reports, Review", <Status tone="success">Active</Status>],
    ["IQAC Coordinator (sample)", "Uploader", "Evidence upload", <Status tone="success">Active</Status>],
    ["Dean, Research (sample)", "Uploader", "Institutional upload", <Status tone="warning">Invited</Status>],
  ];
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users & Permissions"
        description={`People and roles in ${workspace.name}.`}
        actions={<PlannedButton><UserPlus className="size-4" /> Invite user</PlannedButton>}
      />
      <PlaceholderNotice>No sign-in or permission checks exist yet. Users shown are fictional.</PlaceholderNotice>
      <DataTable
        caption="Members"
        columns={["Name", "Role", "Module access", "Status"]}
        rows={workspace.kind === "internal" ? internal : uni}
      />
    </>
  );
}
