import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./workspace";
import { recordHeldReviewsBulk } from "@/lib/import.functions";

type Issue = { sheet: string; row: number; kind: string };
const DECISIONS = { keep_held: "Keep held", source_correction_required: "Source correction required", escalate_for_expert_review: "Escalate for investigation", exclude_documented: "Exclude with documented reason (Super Admin)" } as const;

/** Compact workflow: apply one reasoned decision to all unreviewed held records of a finding type. */
export function HeldBulkReview({ issues, reviewed }: { issues: Issue[]; reviewed: (i: Issue) => boolean }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient(); const save = useServerFn(recordHeldReviewsBulk);
  const canReview = workspace.roles.some(r => r === "super_admin" || r === "internal_reviewer");
  const kinds = [...new Set(issues.map(i => i.kind))];
  const [kind, setKind] = useState(kinds[0] ?? ""); const [decision, setDecision] = useState<keyof typeof DECISIONS>("source_correction_required");
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const pending = issues.filter(i => i.kind === kind && !reviewed(i));
  if (!canReview) return null;
  async function apply() {
    if (!window.confirm(`Record “${DECISIONS[decision]}” for ${pending.length} held records? Each remains held.`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < pending.length; i += 300) await save({ data: { organizationId: workspace.id, records: pending.slice(i, i + 300).map(p => ({ sheet: p.sheet, row: p.row })), decision, explanation: text } });
      toast.success(`${pending.length} decisions recorded. Records stay held until corrected and revalidated.`); setText("");
      await cache.invalidateQueries({ queryKey: ["held-reviews"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Reviews not saved"); } finally { setBusy(false); }
  }
  return <section className="space-y-3 border bg-card p-4 text-sm" aria-label="Bulk held-record review">
    <h3 className="font-semibold">Review by finding type</h3>
    <p className="text-xs text-muted-foreground">Each record gets its own audited decision with its finding and fields. No decision makes a record importable; approval for import is only possible after the source is corrected and re-inspected.</p>
    <div className="flex flex-wrap gap-3">
      <label className="text-xs">Finding<select className="mt-1 block h-9 border bg-background px-2 text-sm" value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(k => <option key={k} value={k}>{k} · {issues.filter(i => i.kind === k && !reviewed(i)).length} unreviewed</option>)}</select></label>
      <label className="text-xs">Decision<select className="mt-1 block h-9 border bg-background px-2 text-sm" value={decision} onChange={e => setDecision(e.target.value as keyof typeof DECISIONS)}>{Object.entries(DECISIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    </div>
    <Textarea aria-label="Bulk explanation" placeholder="Explanation applied to every selected record (at least 10 characters)" value={text} onChange={e => setText(e.target.value)} />
    <Button size="sm" disabled={busy || !pending.length || text.trim().length < 10} onClick={() => void apply()}>Record decision for {pending.length} records</Button>
  </section>;
}
