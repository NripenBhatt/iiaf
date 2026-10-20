import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Status } from "@/components/iiaf/ui";
import { listFieldMappings, proposeFieldMapping, reviewFieldMapping } from "@/lib/agency.functions";
import fieldSpec from "@/data/fact-fields.json";

type Field = { id: string; label: string; dataType: string; unit: string | null; mandatory: string; frameworkVersion: string; fieldLevel: string; versionLock: string };
const CANON = (fieldSpec as { fields: { field: string; label: string }[] }).fields;

/** Governed agency-field → canonical institutional field mappings. Proposals are internal interpretations; only reviewers approve. */
export function FieldMappings({ organizationId, requirementId, fields, roles, onChange }: { organizationId: string; requirementId: string; fields: Field[]; roles: string[]; onChange: () => void }) {
  const list = useServerFn(listFieldMappings); const propose = useServerFn(proposeFieldMapping); const review = useServerFn(reviewFieldMapping);
  const key = ["field-mappings", organizationId, requirementId];
  const { data = [], refetch } = useQuery({ queryKey: key, queryFn: () => list({ data: { organizationId, requirementId } }) });
  const [draft, setDraft] = useState<Record<string, { canonical: string; rationale: string }>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const canReview = roles.some(r => r === "super_admin" || r === "internal_reviewer");
  async function run(p: Promise<unknown>, ok: string) { try { await p; toast.success(ok); await refetch(); onChange(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); } }
  return <DataTable live caption={`Required data fields · ${fields.length}`} columns={["Agency field", "Type / version", "Canonical mapping", "History"]} rows={fields.map(f => {
    const ms = data.filter(m => m.agency_field_id === f.id); const approved = ms.find(m => m.status === "approved"); const cand = ms.find(m => m.status === "candidate");
    const d = draft[f.id] ?? { canonical: "", rationale: "" };
    return [
      <div className="text-xs"><p className="font-mono">{f.id}</p><p>{f.label}</p></div>,
      <div className="text-xs"><p>{f.dataType}{f.unit ? ` · ${f.unit}` : ""} · {f.mandatory}</p><p className="text-muted-foreground">{f.frameworkVersion} · {f.versionLock}</p></div>,
      <div className="min-w-64 space-y-2 text-xs">
        {approved ? <p><Status tone="success">Approved</Status> → <span className="font-mono">{approved.canonical_field}</span></p> : <Status tone="warning">No approved mapping</Status>}
        {cand && <div className="space-y-1 border-l-2 border-gold pl-2"><p><Status tone="gold">Candidate</Status> → <span className="font-mono">{cand.canonical_field}</span> · internal interpretation</p><p className="text-muted-foreground">{cand.rationale}</p>
          {canReview && <><Input aria-label={`Review note for ${f.id}`} placeholder="Review note (required)" value={notes[cand.id] ?? ""} onChange={e => setNotes({ ...notes, [cand.id]: e.target.value })} />
            <div className="flex gap-2"><Button size="sm" disabled={(notes[cand.id] ?? "").trim().length < 5} onClick={() => void run(review({ data: { id: cand.id, decision: "approved", note: notes[cand.id] ?? "" } }), "Mapping approved")}>Approve</Button><Button size="sm" variant="outline" disabled={(notes[cand.id] ?? "").trim().length < 5} onClick={() => void run(review({ data: { id: cand.id, decision: "rejected", note: notes[cand.id] ?? "" } }), "Mapping rejected")}>Reject</Button></div></>}
        </div>}
        <details><summary className="cursor-pointer text-primary">{approved || cand ? "Propose a revision" : "Propose mapping"}</summary>
          <div className="mt-1 space-y-1"><select aria-label={`Canonical field for ${f.id}`} className="h-8 w-full border bg-background px-2" value={d.canonical} onChange={e => setDraft({ ...draft, [f.id]: { ...d, canonical: e.target.value } })}><option value="">Choose canonical field…</option>{CANON.map(c => <option key={c.field} value={c.field}>{c.field} — {c.label}</option>)}</select>
            <Input aria-label={`Rationale for ${f.id}`} placeholder="Rationale (required)" value={d.rationale} onChange={e => setDraft({ ...draft, [f.id]: { ...d, rationale: e.target.value } })} />
            <Button size="sm" variant="outline" disabled={!d.canonical || d.rationale.trim().length < 5} onClick={() => void run(propose({ data: { organizationId, fieldId: f.id, canonicalField: d.canonical, rationale: d.rationale } }).then(() => setDraft({ ...draft, [f.id]: { canonical: "", rationale: "" } })), "Candidate mapping proposed")}>Submit as candidate</Button></div></details>
      </div>,
      <div className="space-y-1 text-[11px] text-muted-foreground">{ms.length === 0 ? "None" : ms.map(m => <p key={m.id}>{m.status} · {m.canonical_field} · {new Date(m.reviewed_at ?? m.proposed_at).toLocaleDateString()}{m.review_note ? ` · ${m.review_note}` : ""}</p>)}</div>,
    ];
  })} />;
}
