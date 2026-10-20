export const ROLE_LABELS = {
  super_admin: "Super Admin", authorized_operator: "Authorized Operator", internal_reviewer: "Internal Reviewer",
  university_administrator: "University Administrator", registrar: "Registrar", iqac_manager: "IQAC Manager",
  department_head_dean: "Department Head or Dean", faculty_staff_uploader: "Faculty or Staff Uploader", read_only_decision_maker: "Read-only Decision-maker",
} as const;
export type AppRole = keyof typeof ROLE_LABELS;
export function mayOpen(path: string, kind: string, roles: AppRole[]) {
  if (!roles.length) return false;
  if (path === "/master-import" || path === "/agency-requirements") return kind === "internal" && roles.some(r => ["super_admin", "authorized_operator", "internal_reviewer"].includes(r));
  if (["/relationships", "/conversation"].includes(path)) return kind === "internal" && roles.some(r => ["super_admin", "authorized_operator"].includes(r));
  if (path === "/review") return kind === "internal" && roles.some(r => ["super_admin", "authorized_operator", "internal_reviewer"].includes(r));
  if (path === "/audit") return kind === "internal" && roles.some(r => ["super_admin", "internal_reviewer"].includes(r));
  return ["/", "/institutional", "/meetings", "/evidence", "/reports", "/users", "/settings", "/help"].includes(path);
}
export function mayManage(roles: AppRole[]) { return roles.includes("super_admin") || roles.includes("university_administrator"); }