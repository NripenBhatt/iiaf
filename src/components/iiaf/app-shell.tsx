import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronsUpDown, Lock, Check } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_GROUPS } from "./nav";
import { WORKSPACES, useWorkspace } from "./workspace";
import { cn } from "@/lib/utils";

function WorkspaceSwitcher() {
  const { workspace, setWorkspaceId } = useWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold",
              workspace.kind === "internal"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-gold text-primary",
            )}
          >
            {workspace.short}
          </span>
          <span className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {workspace.name}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/70">{workspace.caption}</span>
          </span>
          <ChevronsUpDown className="size-4 opacity-60" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        <DropdownMenuLabel className="eyebrow text-muted-foreground">
          Switch workspace (demo)
        </DropdownMenuLabel>
        {WORKSPACES.map((w) => (
          <DropdownMenuItem key={w.id} onClick={() => setWorkspaceId(w.id)} className="gap-3">
            <span className="flex size-7 items-center justify-center rounded bg-muted font-mono text-[10px] font-semibold">
              {w.short}
            </span>
            <span className="grid flex-1">
              <span className="text-sm">{w.name}</span>
              <span className="text-xs text-muted-foreground">{w.caption}</span>
            </span>
            {w.id === workspace.id && <Check className="size-4 text-teal" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Visual preview of workspace separation only. No access control is enforced yet.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppSidebar() {
  const { workspace } = useWorkspace();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isUni = workspace.kind === "university";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 pt-4">
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:hidden">
          <span className="font-display text-2xl font-semibold tracking-tight text-sidebar-accent-foreground">
            IIAF
          </span>
          <span className="eyebrow text-sidebar-primary">Phase 0</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <WorkspaceSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((i) => !(isUni && i.internalOnly));
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel className="eyebrow text-sidebar-foreground/50">
                {g.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={path === item.url} tooltip={item.title}>
                        <Link to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                          {item.internalOnly && (
                            <Lock className="ml-auto size-3 opacity-50" aria-label="Internal only" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <p className="px-2 pb-2 text-[11px] leading-relaxed text-sidebar-foreground/60">
          <Lock className="mr-1 inline size-3" /> marks company-only modules, hidden in university
          workspaces.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger />
            <span className="h-5 w-px bg-border" />
            <span className="truncate text-sm text-muted-foreground">{workspace.name}</span>
            <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-3 py-1 text-xs font-medium text-foreground">
              <span className="size-1.5 rounded-full bg-gold" />
              <span className="hidden sm:inline">Design preview · demonstration data</span>
              <span className="sm:hidden">Demo</span>
            </span>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
