import { ROLE_LABELS, mayOpen, mayManage, type AppRole } from "@/lib/access";
import { DataTable, DemoTag } from "./ui";
import { useWorkspace } from "./workspace";
export const universityRoles = ["University Administrator", "Registrar", "IQAC Manager", "Department Head / Dean", "Faculty / Staff Uploader", "Read-only Decision-maker"];
export function PermissionSummary() {
  const { workspace } = useWorkspace();
  const roles = (Object.keys(ROLE_LABELS) as AppRole[]).filter(r => workspace.kind === "internal" ? ["super_admin","authorized_operator","internal_reviewer"].includes(r) : !["super_admin","authorized_operator","internal_reviewer"].includes(r));
  return <div className="my-6"><h2 className="mb-3 font-sans text-sm font-semibold">Phase 1 permission matrix</h2><DataTable columns={["Role", "Records", "Administration", "Intelligence", "Security audit", "Later workflows"]} rows={roles.map(role=>[ROLE_LABELS[role], role === "authorized_operator" || role === "super_admin" ? "Organization records across portfolio" : "Authorized organization only", mayManage([role]) ? "Manage organization & memberships" : "Own profile only", mayOpen("/relationships",workspace.kind,[role]) ? "Internal sample screens" : "Not granted", mayOpen("/audit",workspace.kind,[role]) ? "Read organization audit" : role === "university_administrator" ? "Own organization events" : "Not granted", "Upload / mapping / approval / release not implemented"])} /></div>;
}
