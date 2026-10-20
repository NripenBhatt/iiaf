import {
  LayoutDashboard,
  Building2,
  CalendarClock,
  Award,
  Network,
  FileText,
  MessagesSquare,
  BadgeCheck,
  Users,
  History,
  Settings,
  Bell,
  Database,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url:
    | "/"
    | "/institutional"
    | "/meetings"
    | "/evidence"
    | "/relationships"
    | "/reports"
    | "/conversation"
    | "/review"
    | "/agency-requirements"
    | "/users"
    | "/audit"
    | "/settings"
    | "/master-import"
    | "/help";
  icon: LucideIcon;
  /** Company-only: hidden from university workspaces by design. */
  internalOnly?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Workspace", items: [{ title: "Overview", url: "/", icon: LayoutDashboard }] },
  {
    label: "Information",
    items: [
      { title: "Institutional Information", url: "/institutional", icon: Building2 },
      { title: "Meeting Information", url: "/meetings", icon: CalendarClock },
      { title: "Accreditation & Ranking Evidence", url: "/evidence", icon: Award },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Relationship Intelligence", url: "/relationships", icon: Network, internalOnly: true },
      { title: "Conversational Engine", url: "/conversation", icon: MessagesSquare, internalOnly: true },
      { title: "Reports & Outputs", url: "/reports", icon: FileText },
    ],
  },
  {
    label: "Assurance",
    items: [
      { title: "Agency Requirement Explorer", url: "/agency-requirements", icon: Award, internalOnly: true },
      { title: "Review & Certification", url: "/review", icon: BadgeCheck, internalOnly: true },
      { title: "Audit & Activity", url: "/audit", icon: History, internalOnly: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Permissions", url: "/users", icon: Users },
      { title: "Master Data Import", url: "/master-import", icon: Database, internalOnly: true },
      { title: "Settings", url: "/settings", icon: Settings },
      { title: "Help, Notifications & Activity", url: "/help", icon: Bell },
    ],
  },
];

export function getNavGroups(kind: "internal" | "university") {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !(kind === "university" && item.internalOnly)).map((item) => ({
      ...item,
      title: kind === "university" && item.url === "/reports" ? "Reports & Released Outputs"
        : kind === "university" && item.url === "/users" ? "University Users & Roles" : item.title,
    })),
  })).filter((group) => group.items.length > 0);
}
