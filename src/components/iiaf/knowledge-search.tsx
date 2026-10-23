import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "./workspace";
import { searchKnowledge } from "@/lib/knowledge.functions";
import type { KnowledgeBundle } from "@/lib/knowledge";
import { locatorText } from "@/lib/package-format";

export function KnowledgeSearch() {
  const { workspace } = useWorkspace(); const search = useServerFn(searchKnowledge);
  const [query, setQuery] = useState(""); const [period, setPeriod] = useState(""); const [department, setDepartment] = useState("");
  const [result, setResult] = useState<KnowledgeBundle | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function run(offset = 0) {
    setBusy(true); setError(""); setResult(null);
    try { setResult(await search({ data: { organizationId: workspace.id, query, period, department, offset } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Stored knowledge could not be read."); } finally { setBusy(false); }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "IIAF_knowledge_unverified.json"; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="mb-8 border-t pt-6" aria-label="Institutional knowledge">
    <h2 className="mb-3 text-lg font-semibold">Institutional knowledge</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void run(); }}>
      <label className="text-xs">Source text<Input aria-label="Knowledge source text" className="mt-1 w-64" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="text-xs">Recorded reporting period<Input aria-label="Knowledge reporting period" className="mt-1 w-48" placeholder="All recorded periods" value={period} onChange={e => setPeriod(e.target.value)} /></label>
      <label className="text-xs">Department / owner (exact)<Input aria-label="Knowledge department" className="mt-1 w-48" value={department} onChange={e => setDepartment(e.target.value)} /></label>
      <Button type="submit" disabled={busy}><Search className="size-4" />{busy ? "Reading…" : "Search knowledge"}</Button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {result && <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>{result.passageMatches} matching passages · {result.facts.length} facts · {result.conflicts.length} conflicts · Unverified / not authorized for release</p><Button variant="outline" size="sm" onClick={download}><Download className="size-4" />Evidence bundle</Button></div>
      <p className="text-xs text-muted-foreground">Recorded periods: {result.periods.map(p => p || "Not stated").join(" · ") || "None"}. Upload dates are not event dates.</p>
      {result.gaps.map(g => <p key={g} className="text-sm text-warning">{g}</p>)}
      <div className="divide-y">{result.passages.map(p => <article className="py-3" key={p.citation}><p className="text-sm font-medium">{p.source.filename} · {p.source.classification} · {p.source.period || "Period not stated"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{p.content}</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{p.citation} · {locatorText(p.locator)} · {p.method} · {p.source.sha256}</p></article>)}</div>
      {result.facts.map(f => f.available && <div key={f.factId} className="border-l-2 pl-3 text-sm"><p>{f.label}: {f.value} · {f.state} · {f.currentExtraction ? "Current extraction — review status applies" : "Historical extraction snapshot — not current evidence"}</p><p className="text-xs text-muted-foreground">{f.source.filename} · {f.source.period || "Period not stated"} · {f.locatorKey} · {f.source.classification}</p><p className="text-xs text-muted-foreground">{locatorText(f.locator)}</p><details className="mt-2 text-xs"><summary>Correction / review history ({f.history.length})</summary>{f.history.length ? <ol className="mt-2 space-y-2">{f.history.map((h, i) => <li key={`${h.at}:${i}`}>{h.at} · {h.decision} · previous state {h.previousState || "Not recorded"}<p>Recorded value: {h.value ?? "No replacement value"}</p><p>{h.note || "No review note"}</p></li>)}</ol> : <p className="mt-1">No persisted review history.</p>}</details></div>)}
      {result.conflicts.map(c => <div key={c.id} className="border-l-2 border-warning pl-3 text-sm"><p className="font-medium">Unresolved conflict · {c.status}</p>{[c.from, c.to].map((f, i) => <p key={i}>{f.available ? `${f.value} · ${f.source.filename} · ${f.source.period || "Period not stated"} · ${f.state} · ${f.locatorKey}` : "Endpoint unavailable under current access"}</p>)}</div>)}
      <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || result.page.offset === 0} onClick={() => void run(Math.max(0, result.page.offset - 20))}>Previous sources</Button><Button variant="outline" size="sm" disabled={busy || !result.page.hasMore} onClick={() => void run(result.page.offset + 20)}>Next sources</Button></div>
    </div>}
  </section>;
}