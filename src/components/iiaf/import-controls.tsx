import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Play, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, Status } from "./ui";
import { useWorkspace } from "./workspace";
import { startMasterImport, processMasterBatch, getImportResults, type getImportInspection } from "@/lib/import.functions";

export function ImportControls({ runs }: { runs: Awaited<ReturnType<typeof getImportInspection>>["runs"] }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const start = useServerFn(startMasterImport); const batch = useServerFn(processMasterBatch); const results = useServerFn(getImportResults);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(""); const [approved, setApproved] = useState(false);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getImportResults>>>([]);
  const canRun = workspace.roles.some(r => ["super_admin", "authorized_operator"].includes(r));
  const samplePassed = runs.some(r => r.mode === "sample" && r.state === "verified" && (r.validation_summary as Record<string, unknown>).idempotency_verified === true);
  async function execute(mode: "sample" | "full", resumeId?: string) {
    setBusy(true); setProgress("Starting controlled import…");
    try {
      const run = resumeId ? { runId: resumeId } : await start({ data: { organizationId: workspace.id, mode, approved: true } });
      let offset = 0;
      while (true) { const result = await batch({ data: { runId: run.runId, offset } }); setProgress(`${result.nextOffset.toLocaleString()} source rows processed`); if (result.done) break; offset = result.nextOffset; }
      await cache.invalidateQueries({ queryKey: ["master-inspection"] });
      setRows(await results({ data: { runId: run.runId, offset: 0 } })); toast.success("Import results read back; see verified status and row outcomes.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); setProgress("Stopped · inspect the run before resuming"); }
    finally { setBusy(false); }
  }
  async function download(runId: string) {
    setBusy(true);
    try {
      const all: Awaited<ReturnType<typeof getImportResults>> = [];
      for (let offset = 0; ; offset += 1000) { const page = await results({ data: { runId, offset } }); all.push(...page); if (page.length < 1000) break; }
      const quote = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
      const text = [["Worksheet", "Physical row", "Original ID", "Outcome", "Reason", "Target ID", "Mapping log"], ...all.map(r => [r.source_sheet, r.source_row, r.source_identifier, r.outcome, r.reason, r.target_record_id, JSON.stringify(r.mapping_log)])].map(r => r.map(quote).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `IIAF_import_${runId}_outcomes.csv`; a.click(); URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }
  return <section className="space-y-5 border-y py-5">
    <h2 className="font-semibold">Controlled sample & import results</h2>
    <p className="text-sm text-muted-foreground">23 actual source rows: dependency-complete templates and candidate links, optional blanks, one source-labelled exact NIRF field, two repeated mapping candidates and the missing agency-reference row. Three held rows are rejected, not fabricated.</p>
    {canRun && <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void execute("sample")}><Play /> Run controlled sample</Button><Button disabled={busy || !runs.some(r => r.mode === "sample" && r.state === "verified")} variant="outline" onClick={() => void execute("sample")}><RotateCcw /> Reimport same sample</Button></div>}
    <p role="status" className="text-sm text-muted-foreground">{progress || (samplePassed ? "Sample readback and repeat-import idempotency verified." : "Full import locked until the sample and identical rerun pass.")}</p>
    {canRun && samplePassed && <div className="space-y-3 border-t pt-4"><label className="flex items-start gap-3 text-sm"><Checkbox checked={approved} onCheckedChange={v => setApproved(v === true)} aria-label="Approve full import" /><span>I approve the full inspected workbook import: 11,809 proposed canonical rows, 244 held rows rejected, and 20,117 excluded rows logged as skipped. Conflicts are never overwritten.</span></label><Button disabled={busy || !approved} onClick={() => void execute("full")}><Play /> Run approved full import</Button></div>}
    <DataTable columns={["Run / time UTC", "Mode / state", "Persisted counts", "Results"]} rows={runs.map(run => {
      const count = run.validation_summary as Record<string, unknown>;
      return [<div className="max-w-xs break-all text-xs">{run.id}<p className="mt-1 text-muted-foreground">{run.created_at}</p><p className="mt-1">Initiator: {run.initiated_by}</p></div>,<div className="space-y-2"><p>{run.mode}</p><Status tone={run.state === "verified" ? "success" : "warning"}>{run.state}</Status></div>,<p className="max-w-xs text-xs">Source {String(count.source_rows ?? 0)} / {run.expected_rows} · inserted {String(count.inserted ?? 0)} · updated 0 · skipped {String(count.skipped ?? 0)} · rejected {String(count.rejected ?? 0)} · conflicts {String(count.conflicts ?? 0)}{count.idempotency_verified === true ? " · Repeat verified" : ""}</p>,<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void results({ data: { runId: run.id, offset: 0 } }).then(setRows)}>Inspect rows</Button><Button size="icon" variant="ghost" disabled={busy} aria-label="Download run outcomes" onClick={() => void download(run.id)}><Download /></Button>{canRun && run.state === "running" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void execute(run.mode as "sample" | "full", run.id)}>Resume run</Button>}</div>];
    })} />
    {rows.length > 0 && <><h3 className="text-sm font-semibold">Persisted row outcomes · first {rows.length.toLocaleString()} rows</h3><DataTable columns={["Worksheet / row", "Original ID", "Outcome", "Reason / original fields"]} rows={rows.map(r => [<span className="break-all text-xs">{r.source_sheet} · {r.source_row}</span>,r.source_identifier,r.outcome,<details className="max-w-md text-xs"><summary>{r.reason}</summary><pre className="mt-2 max-h-60 overflow-auto bg-muted p-3">{JSON.stringify(r.source_fields, null, 2)}</pre></details>])}/></>}
  </section>;
}