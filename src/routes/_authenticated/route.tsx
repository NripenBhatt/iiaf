import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getAccess, authorizePage } from "@/lib/security.functions";
import { selectedOrganizationId, selectOrganization } from "@/lib/workspace-selection";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const access = await getAccess();
    const workspace = access.workspaces.find(w => w.id === selectedOrganizationId()) ?? access.workspaces[0];
    if (!workspace) throw redirect({ to: "/access-pending" });
    selectOrganization(workspace.id);
    try { await authorizePage({ data: { organizationId: workspace.id, path: location.pathname } }); }
    catch { throw redirect({ to: "/unauthorized" }); }
    return { access, workspace };
  },
  component: AuthenticatedLayout,
});
function AuthenticatedLayout() { return <Outlet />; }