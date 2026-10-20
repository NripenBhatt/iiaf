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
    | "/users"
    | "/audit"
    | "/settings";
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
      { title: "Review & Certification", url: "/review", icon: BadgeCheck },
      { title: "Audit & Activity", url: "/audit", icon: History, internalOnly: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Permissions", url: "/users", icon: Users },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];
