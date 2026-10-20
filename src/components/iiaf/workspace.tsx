import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter, useNavigate } from "@tanstack/react-router";
import { selectOrganization } from "@/lib/workspace-selection";
import { recordSessionEvent } from "@/lib/session.functions";
import type { AppRole } from "@/lib/access";
import type { getAccess } from "@/lib/security.functions";

export type WorkspaceKind = "internal" | "university";

export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  name: string;
  short: string;
  caption: string;
  roles: AppRole[];
}

interface Ctx {
  workspace: Workspace;
  workspaces: Workspace[];
  userId: string;
  displayName: string;
  setWorkspaceId: (id: string) => Promise<void>;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children, access, initialWorkspace }: { children: ReactNode; access: Awaited<ReturnType<typeof getAccess>>; initialWorkspace: Workspace }) {
  const router = useRouter(); const navigate = useNavigate();
  const [id, setId] = useState(initialWorkspace.id);
  const workspace = access.workspaces.find(w => w.id === id) ?? initialWorkspace;
  async function setWorkspaceId(nextId: string) {
    if (!access.workspaces.some(w => w.id === nextId)) return;
    selectOrganization(nextId); setId(nextId);
    await recordSessionEvent({ data: { organizationId: nextId, event: "workspace.selected" } });
    await router.invalidate(); await navigate({ to: "/" });
  }
  return (
    <WorkspaceContext.Provider value={{ workspace, workspaces: access.workspaces, userId: access.userId, displayName: access.displayName, setWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
