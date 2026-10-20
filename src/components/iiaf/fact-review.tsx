import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Status } from "./ui";
import { useWorkspace } from "./workspace";
import { listFacts, reviewFact } from "@/lib/intelligence.functions";
import type { UploadModule } from "@/lib/upload-rules";

type Data = Awaited<ReturnType<typeof listFacts>>;
type FactRow = Data["facts"][number];
const STATE: Record<string, { label: string; tone: "neutral" | "teal" | "success" | "warning" | "danger" | "gold" }> = {
  proposed: { label: "Proposed · not reviewed", tone: "gold" }, unresolved_mapping: { label: "Unresolved mapping", tone: "warning" },
  approved: { label: "Human-approved", tone: "success" }, corrected: { label: "Human-corrected", tone: "success" }, rejected: { label: "Rejected", tone: "danger" },
};
const locatorText = (l: unknown) => Object.entries((l ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${k} ${v}`).join(" · ");

export function FactReview({ module }: { module: UploadModule }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const list = useServerFn(listFacts);
  const { data, isLoading } = useQuery({ queryKey: ["facts", workspace.id], queryFn: () => list({ data: { organizationId: workspace.id } }) });
  const [filter, setFilter] = useState("open");
  const facts = (data?.facts ?? []).filter(f => (f.uploaded_documents as { module?: string } | null)?.module === module)
    .filter(f => filter === "all" || (filter === "open" ? ["proposed", "unresolved_mapping"].includes(f.state) : !["proposed", "unresolved_mapping"].includes(f.state)));
  return <section id="fact-review" className="mt-8 space-y-3 border-t pt-6" aria-label="Extracted fact review">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-semibold">Extracted facts · human review</h2><p className="text-sm text-muted-foreground">Raw text stays with the document. Only explicit “Label: value” pairs become proposed facts; nothing is approved without a reviewer.</p></div>
      <div className="flex gap-1">{[["open", "Awaiting review"], ["done", "Reviewed"], ["all", "All"]].map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? "secondary" : "ghost"} onClick={() => setFilter(k!)}>{l}</Button>)}</div>
    </div>
    {isLoading ? <p className="text-sm text-muted-foreground">Loading facts…</p> : facts.length === 0 ? <p className="text-sm text-muted-foreground">No facts in this view. Process a stored document to extract text.</p> :
      <DataTable columns={["Source document / locator", "Extracted value", "Proposed field", "Validation", "State & lineage"]} rows={facts.map(f => [
        <div className="max-w-[14rem] text-xs"><p className="break-all font-medium">{(f.uploaded_documents as { original_filename?: string } | null)?.original_filename}</p><p className="mt-1 font-mono text-muted-foreground">{locatorText(f.locator)}</p><p className="mt-1 text-muted-foreground">{f.method} v{f.method_version}</p></div>,
        <div className="max-w-xs text-xs"><p className="text-muted-foreground">{f.source_label}</p><p className="mt-1 break-words font-medium">{f.extracted_value}</p>{f.reviewed_value && <p className="mt-1">Corrected to: <span className="font-medium">{f.reviewed_value}</span></p>}</div>,
        <div className="text-xs">{f.canonical_field ? <><p className="font-mono">{f.canonical_field}</p><p className="mt-1 text-muted-foreground">{f.spec_source}</p></> : <Status tone="warning">No spec field</Status>}<p className="mt-1 text-muted-foreground">Confidence: not calculated</p></div>,
        <div className="max-w-xs space-y-1 text-xs">{(f.validation_issues as string[]).length ? (f.validation_issues as string[]).map(i => <p key={i} className="text-destructive">{i}</p>) : <p className="text-success">No validation issues</p>}</div>,
        <FactActions fact={f} data={data!} onDone={() => void cache.invalidateQueries({ queryKey: ["facts", workspace.id] })} />,
      ])} />}
  </section>;
}

function FactActions({ fact, data, onDone }: { fact: FactRow; data: Data; onDone: () => void }) {
  const review = useServerFn(reviewFact);
  const [note, setNote] = useState(""); const [value, setValue] = useState(""); const [busy, setBusy] = useState(false);
  const open = ["proposed", "unresolved_mapping"].includes(fact.state);
  const links = data.links.filter(l => l.source_id === fact.id);
  const history = data.reviews.filter(r => r.fact_id === fact.id);
  const gaps = data.runs.filter(r => (r.input_ref as { fact_id?: string }).fact_id === fact.id).flatMap(r => r.gaps as { gap: string }[]);
  async function act(decision: "approve" | "correct" | "reject") {
    setBusy(true);
    try { const r = await review({ data: { id: fact.id, decision, value, note } }); toast.success(`Fact ${decision === "reject" ? "rejected" : decision === "correct" ? "corrected" : "approved"}.${r.gaps?.length ? ` Gap: ${r.gaps.map(g => g.gap).join("; ")}` : ""}`); onDone(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Review failed"); } finally { setBusy(false); }
  }
  const s = STATE[fact.state] ?? { label: fact.state, tone: "neutral" as const };
  return <div className="min-w-[14rem] space-y-2 text-xs">
    <Status tone={s.tone}>{s.label}</Status>
    {links.map(l => <p key={l.id}><span className="font-mono">{l.relation_type}</span> → {l.target_label} · <span className={l.status === "approved" ? "text-success" : "text-warning"}>{l.status}</span> · {l.rule_id}</p>)}
    {gaps.map((g, i) => <p key={i} className="text-warning">Gap: {g.gap}</p>)}
    {history.map(h => <p key={h.created_at} className="border-l-2 pl-2">{h.decision} · {new Date(h.created_at).toLocaleString()}<br />{h.note}</p>)}
    {open && data.canReview && <div className="space-y-1">
      <Input aria-label="Review note" placeholder="Review note (required)" value={note} onChange={e => setNote(e.target.value)} />
      {fact.canonical_field && <Input aria-label="Corrected value" placeholder="Corrected value (for Correct)" value={value} onChange={e => setValue(e.target.value)} />}
      <div className="flex flex-wrap gap-1">
        {fact.canonical_field && <Button size="sm" disabled={busy || note.trim().length < 5} onClick={() => void act("approve")}>Approve</Button>}
        {fact.canonical_field && <Button size="sm" variant="outline" disabled={busy || note.trim().length < 5 || !value.trim()} onClick={() => void act("correct")}>Correct</Button>}
        <Button size="sm" variant="ghost" disabled={busy || note.trim().length < 5} onClick={() => void act("reject")}>Reject</Button>
      </div></div>}
    {open && !data.canReview && <p className="text-muted-foreground">Awaiting an authorized reviewer.</p>}
  </div>;
}
