import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Status } from "./ui";
import { useWorkspace } from "./workspace";
import { recordHeldReview, type listHeldReviews } from "@/lib/import.functions";

const DECISIONS = { keep_held: "Keep held", source_correction_required: "Source correction required", escalate_for_expert_review: "Escalate for expert review" } as const;
type Review = Awaited<ReturnType<typeof listHeldReviews>>[number];

export function HeldReview({ sheet, row, history }: { sheet: string; row: number; history: Review[] }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient(); const save = useServerFn(recordHeldReview);
  const canReview = workspace.roles.some(r => r === "super_admin" || r === "internal_reviewer");
  const [decision, setDecision] = useState<keyof typeof DECISIONS>("keep_held"); const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const latest = history[0];
  async function submit() {
    setBusy(true);
    try { await save({ data: { organizationId: workspace.id, sheet, row, decision, explanation: text } }); setText(""); toast.success("Decision recorded. The record stays held until corrected and revalidated."); await cache.invalidateQueries({ queryKey: ["held-reviews"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Review not saved"); } finally { setBusy(false); }
  }
  return <details className="max-w-sm text-xs"><summary className="cursor-pointer">{latest ? <Status tone="gold">{DECISIONS[latest.decision as keyof typeof DECISIONS]}</Status> : <Status>Not reviewed</Status>}</summary>
    <div className="mt-2 space-y-2">
      {history.map(h => <p key={h.id} className="border-l-2 pl-2"><span className="font-medium">{DECISIONS[h.decision as keyof typeof DECISIONS]}</span> · {h.reviewer} · {new Date(h.created_at).toLocaleString()}<br />{h.explanation}</p>)}
      {canReview ? <div className="space-y-2"><select aria-label="Decision" className="h-8 w-full border bg-background px-2" value={decision} onChange={e => setDecision(e.target.value as keyof typeof DECISIONS)}>{Object.entries(DECISIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Textarea aria-label="Explanation" placeholder="Explanation (at least 10 characters)" value={text} onChange={e => setText(e.target.value)} />
        <Button size="sm" disabled={busy || text.trim().length < 10} onClick={() => void submit()}>Record decision</Button>
        <p className="text-muted-foreground">A decision does not make the record importable.</p></div> : <p className="text-muted-foreground">Read-only for your role.</p>}
    </div></details>;
}
