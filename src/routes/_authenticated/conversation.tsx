import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { InternalOnly, PageHeader } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";
import { Button } from "@/components/ui/button";
import { createThread, deleteThread, listThreads } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/conversation")({
  head: () => pageHead("Conversational Engine", "Type or dictate reporting requests; IIAF retrieves authorised records and generates traceable draft packages."),
  component: Layout,
});

function Layout() {
  return <>
    <PageHeader eyebrow="Intelligence · Internal" title="Conversational Engine" description="Type or dictate a reporting request. Answers come only from authorised IIAF records; the engine cannot approve, review, certify or submit." />
    <InternalOnly><Shell /></InternalOnly>
  </>;
}

function Shell() {
  const { workspace } = useWorkspace();
  const list = useServerFn(listThreads); const create = useServerFn(createThread); const del = useServerFn(deleteThread);
  const navigate = useNavigate(); const params = useParams({ strict: false }) as { threadId?: string };
  const { data = [], refetch } = useQuery({ queryKey: ["threads", workspace.id], queryFn: () => list({ data: { organizationId: workspace.id } }), refetchInterval: 15000 });
  async function start() { try { const t = await create({ data: { organizationId: workspace.id } }); await refetch(); void navigate({ to: "/conversation/$threadId", params: { threadId: t.id } }); } catch (e) { toast.error(e instanceof Error ? e.message : "Unavailable"); } }
  async function remove(id: string) { if (!confirm("Delete this conversation and its saved messages?")) return; try { await del({ data: { threadId: id } }); await refetch(); if (params.threadId === id) void navigate({ to: "/conversation" }); } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); } }
  return <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
    <aside className="space-y-2 rounded-xl border bg-card p-3 shadow-card">
      <Button className="w-full" onClick={() => void start()}><MessageSquarePlus /> New conversation</Button>
      <nav aria-label="Conversations" className="space-y-1">
        {data.length === 0 && <p className="p-2 text-xs text-muted-foreground">No conversations yet.</p>}
        {data.map(t => <div key={t.id} className={`group flex items-center gap-1 rounded-md ${params.threadId === t.id ? "bg-secondary" : "hover:bg-muted"}`}>
          <Link to="/conversation/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm">{t.title}</Link>
          <button aria-label={`Delete ${t.title}`} className="p-1.5 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100" onClick={() => void remove(t.id)}><Trash2 className="size-3.5" /></button>
        </div>)}
      </nav>
      <p className="border-t pt-2 text-[11px] text-muted-foreground">Saved privately to your account in this workspace until you delete them. Audio is never stored — only the text you send.</p>
    </aside>
    <div className="min-w-0"><Outlet /></div>
  </div>;
}
