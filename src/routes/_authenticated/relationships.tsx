import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { DataTable, InternalOnly, PageHeader, Panel, PlaceholderNotice, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRelationships, reviewRelationship } from "@/lib/intelligence.functions";

export const Route = createFileRoute("/_authenticated/relationships")({
  head: () => pageHead("Relationship Intelligence", "Persisted, rule-generated links between documents, extracted facts, evidence templates and agency requirements, with provenance and review."),
  component: Page,
});

type Data = Awaited<ReturnType<typeof listRelationships>>;
type Rel = Data["relationships"][number];
const tone = (s: string) => s === "approved" ? "success" : s === "candidate" ? "gold" : s === "rejected" ? "danger" : "neutral";
const RULES: Record<string, string> = {
  "R-ENTITY-001": "Fact → source document (provenance, auto-approved when locator present)",
  "R-AGENCY-001": "Approved Evidence_ID fact → evidence template → requirement via explicit mapping row (candidate)",
  "R-CONFLICT-001": "Same field/category/period with different approved values (candidate conflict)",
};

function Page() {
  return <>
    <PageHeader eyebrow="Intelligence · Internal" title="Relationship Intelligence" description="Real links produced by deterministic rules from persisted records. Candidates stay candidates until a reviewer decides." />
    <InternalOnly><RealRelationships />
      <section className="mt-10 border-t pt-6"><PlaceholderNotice>Illustrative analytics below are demonstration data, not database records.</PlaceholderNotice><Analytics page="relationships" /></section>
    </InternalOnly>
  </>;
}

function RealRelationships() {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const list = useServerFn(listRelationships); const review = useServerFn(reviewRelationship);
  const { data, isLoading, error } = useQuery({ queryKey: ["relationships", workspace.id], queryFn: () => list({ data: { organizationId: workspace.id } }) });
  const [f, setF] = useState({ entity: "all", type: "all", status: "all", rule: "all" });
  const [selected, setSelected] = useState<string | null>(null); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const rels = useMemo(() => (data?.relationships ?? []).filter(r => (f.entity === "all" || r.source_type === f.entity || r.target_type === f.entity) && (f.type === "all" || r.relation_type === f.type) && (f.status === "all" || r.status === f.status) && (f.rule === "all" || r.rule_id === f.rule)), [data, f]);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading relationships…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Relationships could not be loaded.</p>;
  const sel = data.relationships.find(r => r.id === selected) ?? null;
  const all = data.relationships;
  async function decide(decision: "approved" | "rejected") {
    if (!sel) return; setBusy(true);
    try { await review({ data: { id: sel.id, decision, note } }); toast.success(`Relationship ${decision}.`); setNote(""); await cache.invalidateQueries({ queryKey: ["relationships", workspace.id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Review failed"); } finally { setBusy(false); }
  }
  const opts = (vals: string[]) => ["all", ...new Set(vals)];
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-4">{[["Persisted relationships", all.length], ["Candidates awaiting review", all.filter(r => r.status === "candidate").length], ["Approved", all.filter(r => r.status === "approved").length], ["Rule executions logged", data.runs.length]].map(([l, n]) => <div key={l} className="border-b pb-3"><p className="text-xs text-muted-foreground">{l}</p><p className="font-mono text-2xl">{n}</p></div>)}</div>
    <div className="flex flex-wrap gap-3" role="group" aria-label="Filters">
      {([["entity", "Entity type", opts(all.flatMap(r => [r.source_type, r.target_type]))], ["type", "Relationship type", opts(all.map(r => r.relation_type))], ["status", "Status", opts(all.map(r => r.status))], ["rule", "Source rule", opts(all.map(r => r.rule_id))]] as const).map(([k, l, o]) =>
        <label key={k} className="text-xs"><span className="block text-muted-foreground">{l}</span><select className="mt-1 h-9 border bg-background px-2 text-sm" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}>{o.map(v => <option key={v} value={v}>{v}</option>)}</select></label>)}
    </div>
    {all.length === 0 ? <Panel title="No relationships yet"><p className="text-sm text-muted-foreground">Process a document and review its facts in this workspace; rules run on those persisted records.</p></Panel> : <>
      <Panel title="Relationship network · live records"><Network rels={rels} selected={selected} onSelect={setSelected} /></Panel>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <DataTable caption="Relationships" columns={["From", "Type", "To", "Rule", "Status"]} rows={rels.map(r => [
          <button className="text-left text-xs underline-offset-2 hover:underline" onClick={() => setSelected(r.id)}>{r.source_label}<span className="block text-muted-foreground">{r.source_type}</span></button>,
          <span className="font-mono text-xs">{r.relation_type}</span>, <span className="text-xs">{r.target_label}<span className="block text-muted-foreground">{r.target_type}</span></span>,
          <span className="font-mono text-xs">{r.rule_id}</span>, <Status tone={tone(r.status)}>{r.status}</Status>])} />
        <Panel title="Relationship detail">{sel ? <div className="space-y-3 text-xs">
          <p><span className="font-medium">{sel.source_label}</span> <span className="font-mono">{sel.relation_type}</span> <span className="font-medium">{sel.target_label}</span></p>
          <p><Status tone={tone(sel.status)}>{sel.status}</Status> · {sel.rule_id} v{sel.rule_version}</p>
          <p className="text-muted-foreground">{RULES[sel.rule_id]}</p>
          <p>Confidence: {sel.confidence ?? "not calculated (deterministic rule)"}</p>
          <p>Created {new Date(sel.created_at).toLocaleString()}{sel.reviewed_at ? ` · reviewed ${new Date(sel.reviewed_at).toLocaleString()}: ${sel.review_note}` : ""}</p>
          <h3 className="font-semibold">Provenance</h3><pre className="max-h-64 overflow-auto bg-muted p-2 text-[11px]">{JSON.stringify(sel.provenance, null, 2)}</pre>
          <h3 className="font-semibold">Audit</h3>{data.audit.filter(a => (a.details as { relationship_id?: string }).relationship_id === sel.id).map(a => <p key={a.created_at}>{a.event} · {(a.details as { decision?: string }).decision} · {new Date(a.created_at).toLocaleString()}</p>)}
          {sel.status === "candidate" && data.canReview && <div className="space-y-2"><Input aria-label="Review note" placeholder="Review note (required)" value={note} onChange={e => setNote(e.target.value)} /><div className="flex gap-2"><Button size="sm" disabled={busy || note.trim().length < 5} onClick={() => void decide("approved")}>Approve</Button><Button size="sm" variant="outline" disabled={busy || note.trim().length < 5} onClick={() => void decide("rejected")}>Reject</Button></div><p className="text-muted-foreground">To correct a link, reject it and correct the underlying fact; the rules re-run on the corrected value.</p></div>}
        </div> : <p className="text-sm text-muted-foreground">Select a relationship to see its provenance.</p>}</Panel>
      </div></>}
    <DataTable caption="Rule execution log" columns={["Rule", "Trigger", "Created / existing", "Gaps", "When"]} rows={data.runs.slice(0, 30).map(r => [<span className="font-mono text-xs">{r.rule_id}</span>, r.trigger_event, `${r.created_count} / ${r.existing_count}`, <div className="max-w-xs text-xs">{(r.gaps as { gap: string }[]).map((g, i) => <p key={i} className="text-warning">{g.gap}</p>)}{!(r.gaps as unknown[]).length && "—"}</div>, new Date(r.created_at).toLocaleString()])} />
    <p className="text-xs text-muted-foreground">Not yet runnable: governance rules R-GOV-001 to R-GOV-004 need parsed meeting, agenda, decision and action records, which the extractor does not create. Output, outreach and metric rules await later phases.</p>
  </div>;
}

function Network({ rels, selected, onSelect }: { rels: Rel[]; selected: string | null; onSelect: (id: string) => void }) {
  const cols = { document: 60, fact: 300, master_record: 560 } as Record<string, number>;
  const nodes = new Map<string, { x: number; y: number; label: string; type: string }>();
  const count: Record<string, number> = {};
  const add = (type: string, id: string, label: string) => { const k = `${type}:${id}`; if (!nodes.has(k)) { const n = count[type] = (count[type] ?? 0) + 1; nodes.set(k, { x: cols[type] ?? 300, y: n * 34, label, type }); } return nodes.get(k)!; };
  const edges = rels.slice(0, 120).map(r => ({ r, a: add(r.source_type, r.source_id, r.source_label), b: add(r.target_type, r.target_id, r.target_label) }));
  const h = Math.max(...Object.values(count), 1) * 34 + 30;
  return <div className="overflow-x-auto"><svg viewBox={`0 0 760 ${h}`} className="min-w-[640px]" role="img" aria-label={`Network of ${edges.length} relationships`}>
    {["Documents", "Facts", "Master records"].map((t, i) => <text key={t} x={[60, 300, 560][i]} y={14} className="fill-muted-foreground text-[11px]">{t}</text>)}
    {edges.map(({ r, a, b }) => <line key={r.id} x1={a.x + 6} y1={a.y + 10} x2={b.x} y2={b.y + 10} strokeWidth={r.id === selected ? 3 : 1.4} strokeDasharray={r.status === "candidate" ? "4 3" : undefined} className={r.status === "approved" ? "stroke-success" : r.status === "rejected" ? "stroke-destructive" : "stroke-warning"} onClick={() => onSelect(r.id)} style={{ cursor: "pointer" }}><title>{`${r.relation_type} · ${r.status}`}</title></line>)}
    {[...nodes.values()].map((n, i) => <g key={i}><circle cx={n.x} cy={n.y + 10} r={6} className={n.type === "document" ? "fill-teal" : n.type === "fact" ? "fill-primary" : "fill-gold"} /><text x={n.x + 10} y={n.y + 14} className="fill-foreground text-[10px]">{n.label.slice(0, 34)}</text></g>)}
  </svg><p className="mt-2 text-xs text-muted-foreground">Solid lines: approved · dashed: candidate · click a line for provenance.</p></div>;
}
