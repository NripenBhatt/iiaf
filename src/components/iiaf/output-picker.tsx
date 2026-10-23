import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RECONCILED_OUTPUT_CATALOGUE } from "@/lib/output-reference";

/** Presentation grouping of the real catalogue IDs only; no new output definitions. */
const GROUPS: [string, string[]][] = [
  ["Editorial", ["OUT-008", "OUT-011", "OUT-014"]],
  ["Social media", ["OUT-009", "OUT-010", "OUT-029", "OUT-012", "OUT-013"]],
  ["Visual", ["OUT-026"]],
  ["Institutional", ["OUT-001", "OUT-015", "OUT-016", "OUT-017", "OUT-018", "OUT-019", "OUT-020", "OUT-021", "OUT-022", "OUT-023", "OUT-025", "OUT-027", "OUT-028"]],
  ["Meetings", ["OUT-005", "OUT-006", "OUT-007"]],
  ["Directories & other", ["OUT-002", "OUT-003", "OUT-004", "OUT-024", "OUT-030"]],
];

export function OutputPicker({ requested, setRequested }: { requested: string[]; setRequested: (f: (r: string[]) => string[]) => void }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState("");
  const byId = new Map(RECONCILED_OUTPUT_CATALOGUE.map(o => [o.Output_ID, o]));
  const toggle = (id: string) => setRequested(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);
  return <div className="space-y-2">
    <p className="text-sm font-medium">Outputs (optional)</p>
    <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex min-h-9 w-full flex-wrap items-center gap-1 border bg-background px-2 py-1 text-left text-sm">
      {requested.length ? requested.map(id => <span key={id} className="inline-flex items-center gap-1 rounded-full border px-2 text-xs">{byId.get(id)?.Output_Name ?? id}<X className="size-3" aria-label={`Remove ${id}`} onClick={e => { e.stopPropagation(); toggle(id); }} /></span>) : <span className="text-muted-foreground">None selected — eligible outputs are discovered automatically</span>}
      <ChevronDown className="ml-auto size-4" />
    </button>
    {open && <div className="max-h-72 overflow-auto border bg-popover p-2">
      <Input autoFocus placeholder="Search outputs…" value={q} onChange={e => setQ(e.target.value)} className="mb-2" />
      {GROUPS.map(([g, ids]) => { const items = ids.flatMap(id => { const o = byId.get(id); return o && `${o.Output_Name} ${id}`.toLowerCase().includes(q.toLowerCase()) ? [o] : []; }); return items.length ? <div key={g} className="mb-2"><p className="px-1 text-xs font-semibold uppercase text-muted-foreground">{g}</p>
        {items.map(o => <label key={o.Output_ID} className="flex cursor-pointer items-center gap-2 px-1 py-1 text-sm hover:bg-muted"><input type="checkbox" checked={requested.includes(o.Output_ID)} onChange={() => toggle(o.Output_ID)} />{o.Output_Name}<span className="ml-auto text-xs text-muted-foreground">{o.Output_ID}</span></label>)}</div> : null; })}
    </div>}
  </div>;
}
