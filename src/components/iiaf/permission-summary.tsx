import { DataTable, DemoTag } from "./ui";
import { useWorkspace } from "./workspace";
export const universityRoles = ["University Administrator", "Registrar", "IQAC Manager", "Department Head / Dean", "Faculty / Staff Uploader", "Read-only Decision-maker"];
export function PermissionSummary() {
  const { workspace } = useWorkspace();
  const roles = workspace.kind === "university" ? universityRoles : ["Company Administrator", "Operator Analyst", "Reviewer", "Output Approver"];
  return <div className="mb-6"><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="font-sans text-sm font-semibold">Illustrative role matrix</h2><DemoTag /><span className="text-xs text-muted-foreground">Proposed responsibilities only · no permissions enforced</span></div><DataTable columns={["Role", "Read", "Contribute", "Review", "Release / certify"]} rows={roles.map((role, i) => [role, "Institution scope", i === roles.length - 1 ? "—" : "Assigned modules", i === 1 || i === 2 ? "Proposed" : "—", role === "Registrar" ? "Formal authority required" : "Not granted by this preview"])} /></div>;
}