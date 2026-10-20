import { createContext, useContext, useState, type ReactNode } from "react";

export type WorkspaceKind = "internal" | "university";

export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  name: string;
  short: string;
  caption: string;
}

// Demonstration workspaces only — no tenant data or access control exists in Phase 0.
export const WORKSPACES: Workspace[] = [
  {
    id: "rr",
    kind: "internal",
    name: "Rafts and Rivers",
    short: "RR",
    caption: "Internal operator workspace",
  },
  {
    id: "demo-uni",
    kind: "university",
    name: "Demo University (sample)",
    short: "DU",
    caption: "University workspace · illustrative",
  },
];

interface Ctx {
  workspace: Workspace;
  setWorkspaceId: (id: string) => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [id, setWorkspaceId] = useState("rr");
  const workspace = WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[0]!;
  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
