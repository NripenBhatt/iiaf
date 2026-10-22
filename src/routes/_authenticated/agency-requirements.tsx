import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { FieldMappings } from "@/components/iiaf/field-mappings";
import { PackageDownloads } from "@/components/iiaf/package-actions";
import { pageHead } from "@/lib/seo";
import { DataTable, InternalOnly, PageHeader, Panel, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAgencyCatalogue, getRequirementEvidence, generatePackage, reviewPackage } from "@/lib/agency.functions";
import { getDocumentLink } from "@/lib/documents.functions";
import { locatorText, type PackageContent } from "@/lib/package-format";

export const Route = createFileRoute("/_authenticated/agency-requirements")({
  head: () => pageHead("Agency Requirement Explorer", "Browse imported agency requirements, retrieve approved evidence with exact source locators, and generate draft requirement packages."),
  component: Page,
});

const MAP_TONE: Record<string, "success" | "gold" | "warning" | "danger" | "neutral"> = { approved: "success", candidate: "gold", requires_review: "warning", missing_evidence_record: "danger", rejected: "danger" };
const MAP_LABEL: Record<string, string> = { approved: "Approved mapping", candidate: "Candidate mapping", requires_review: "Requires review", missing_evidence_record: "Missing evidence record", rejected: "Rejected" };

function Page() {
  return <>
    <PageHeader eyebrow="Intelligence · Internal" title="Agency Requirement Explorer" description="Imported requirements only. Evidence counts only when the mapping, identification, fact and provenance are all approved." />
    <InternalOnly><Explorer /></InternalOnly>
  </>;
}

function Explorer() {
  const { workspace } = useWorkspace();
  const list = useServerFn(listAgencyCatalogue);
  const { data, isLoading, error } = useQuery({ queryKey: ["agency-catalogue", workspace.id], queryFn: () => list({ data: { organizationId: workspace.id } }) });
  const [agency, setAgency] = useState("all"); const [version, setVersion] = useState("all"); const [q, setQ] = useState(""); const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null); const [period, setPeriod] = useState("");
  const reqs = useMemo(() => (data?.requirements ?? []).filter(r => (agency === "all" || r.agencyId === agency) && (version === "all" || r.version === version) && `${r.id} ${r.metric} ${r.pillar} ${r.subparameter}`.toLowerCase().includes(q.toLowerCase()) && (status === "all" || (status === "approved" ? r.approvedLinks > 0 : status === "candidate" ? r.candidateLinks > 0 : status === "unmapped" ? r.sourceMappings === 0 : r.sourceMappings > 0 && r.approvedLinks === 0))), [data, agency, version, q, status]);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading imported requirements…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Imported agency records could not be loaded.</p>;
  const versions = [...new Set(data.requirements.filter(r => agency === "all" || r.agencyId === agency).map(r => r.version))];
  return <div className="space-y-6">
    {!data.fullImportVerified && <p className="border-l-4 border-warning bg-warning-soft p-3 text-sm">Only the controlled sample is imported ({data.agencies.length} agencies, {data.requirements.length} requirements). The full master import has not run, so most requirements and mappings are absent here — absence is a gap, not a finding.</p>}
    <div className="flex flex-wrap gap-3">
      <label className="text-xs">Agency<select className="mt-1 block h-9 border bg-background px-2 text-sm" value={agency} onChange={e => { setAgency(e.target.value); setVersion("all"); }}><option value="all">All agencies</option>{data.agencies.map(a => <option key={a.id} value={a.id}>{a.name} · {a.authority}</option>)}</select></label>
      <label className="text-xs">Methodology / version<select className="mt-1 block h-9 border bg-background px-2 text-sm" value={version} onChange={e => setVersion(e.target.value)}><option value="all">All versions</option>{versions.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <label className="text-xs">Mapping status<select className="mt-1 block h-9 border bg-background px-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All</option><option value="approved">Has approved mapping</option><option value="candidate">Has candidate mapping</option><option value="review">Source mapping, none approved</option><option value="unmapped">No mapping imported</option></select></label>
      <label className="text-xs">Search<Input className="mt-1 w-64" placeholder="ID, metric or parameter" value={q} onChange={e => setQ(e.target.value)} /></label>
    </div>
    <DataTable live caption={`Requirements · ${reqs.length}`} columns={["Requirement", "Agency / version", "Parameter", "Mappings", "Select"]} rows={reqs.map(r => [
      <div className="text-xs"><p className="font-mono font-medium">{r.id}</p><p>{r.metric}</p><p className="text-muted-foreground">{r.level}</p></div>,
      <div className="text-xs"><p>{data.agencies.find(a => a.id === r.agencyId)?.name ?? r.agencyId}</p><p className="text-muted-foreground">{r.version}</p><p className="text-muted-foreground">{r.versionLock}</p></div>,
      <span className="text-xs">{r.pillar} {r.subparameter && `· ${r.subparameter}`}</span>,
      <div className="space-y-1 text-xs"><p>{r.sourceMappings} source mapping rows · {r.fieldCount} fields</p>{r.approvedLinks > 0 && <Status tone="success">{r.approvedLinks} approved</Status>} {r.candidateLinks > 0 && <Status tone="gold">{r.candidateLinks} candidate</Status>}{r.sourceMappings === 0 && <Status tone="danger">Missing mapping</Status>}</div>,
      <Button size="sm" variant={selected === r.recordId ? "secondary" : "outline"} onClick={() => setSelected(r.recordId)}>{selected === r.recordId ? "Selected" : "Open"}</Button>])} />
    {selected && <RequirementDetail recordId={selected} period={period} setPeriod={setPeriod} />}
  </div>;
}

function RequirementDetail({ recordId, period, setPeriod }: { recordId: string; period: string; setPeriod: (p: string) => void }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const get = useServerFn(getRequirementEvidence); const gen = useServerFn(generatePackage); const review = useServerFn(reviewPackage); const link = useServerFn(getDocumentLink);
  const key = ["requirement", workspace.id, recordId, period];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => get({ data: { organizationId: workspace.id, recordId, period } }) });
  const [busy, setBusy] = useState(false); const [note, setNote] = useState("");
  if (isLoading) return <p className="text-sm text-muted-foreground">Retrieving mapped evidence…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Retrieval failed"}</p>;
  const r = data.retrieval; const current = data.packages.find(p => p.status !== "superseded");
  const canReview = workspace.roles.some(x => x === "super_admin" || x === "internal_reviewer");
  async function open(id: string) { try { const { url } = await link({ data: { id } }); window.open(url, "_blank", "noopener"); } catch (e) { toast.error(e instanceof Error ? e.message : "Unavailable"); } }
  async function generate() {
    setBusy(true);
    try { const s = await gen({ data: { organizationId: workspace.id, recordId, period } }); toast.success(s.unchanged ? `Content unchanged; version ${s.version} kept.` : `Draft package version ${s.version} generated.`); await cache.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Generation failed"); } finally { setBusy(false); }
  }
  async function decide(decision: "reviewed" | "changes_requested") {
    if (!current) return; setBusy(true);
    try { await review({ data: { id: current.id, decision, sha: current.content_sha256, note } }); toast.success("Review recorded against this exact content hash."); setNote(""); await cache.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Review failed"); } finally { setBusy(false); }
  }
  return <div className="space-y-6 border-t pt-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow text-muted-foreground">{r.agency.name} · {r.requirement.level}</p><h2 className="text-xl font-semibold">{r.requirement.id} — {r.requirement.metric}</h2><p className="mt-1 text-xs text-muted-foreground">Source: {r.requirement.workbook} row {r.requirement.sourceRow}</p></div>
      <label className="text-xs">Reporting period filter<Input className="mt-1 w-48" placeholder="e.g. 2025-26 (blank = all)" defaultValue={period} onBlur={e => setPeriod(e.target.value.trim())} /></label>
    </div>
    <Panel title="Requirement as imported"><dl className="grid gap-2 text-xs md:grid-cols-2">{([["Description", r.requirement.description], ["Official label", r.requirement.officialLabel], ["Mandatory", r.requirement.mandatory], ["Validation rule", r.requirement.validationRule], ["Missing value rule", r.requirement.missingValueRule], ["Mismatch rule", r.requirement.mismatchRule], ["Reporting period rule", r.requirement.reportingPeriodRule], ["Version lock", r.requirement.versionLock], ["Human verification", r.requirement.humanVerification], ["Notes", r.requirement.notes]] as const).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v || "Not stated in source"}</dd></div>)}</dl></Panel>
    <FieldMappings organizationId={workspace.id} requirementId={r.requirement.id} fields={r.fields} roles={workspace.roles} onChange={() => void cache.invalidateQueries({ queryKey: key })} />
    <DataTable live caption={`Evidence mappings · ${r.mappings.length}`} columns={["Mapping (source row)", "Evidence template", "Status", "Retrieved evidence & locators"]} rows={r.mappings.map(m => [
      <div className="text-xs"><p className="font-mono">{m.mappingId}</p><p className="text-muted-foreground">row {m.sourceRow} · {m.coverage} · {m.role}</p><p className="text-muted-foreground">Framework version: {m.frameworkVersion ?? "not stated"}</p></div>,
      <div className="max-w-xs text-xs"><p className="font-mono">{m.evidenceId}</p><p>{m.evidenceName}</p></div>,
      <Status tone={MAP_TONE[m.status] ?? "neutral"}>{MAP_LABEL[m.status] ?? m.status}</Status>,
      <div className="space-y-2 text-xs">{m.evidence.length === 0 && <p className="text-warning">No uploaded document identifies this evidence yet.</p>}{m.evidence.map(e => <div key={e.factId} className="border-l-2 pl-2"><p><span className="font-medium">{e.filename}</span> · {e.value} · period {e.reportingPeriod ?? "not stated"}</p><p className="font-mono text-muted-foreground">{locatorText(e.locator)} · {e.method}</p><p>{e.usable ? <Status tone="success">Usable evidence</Status> : <span className="text-warning">Excluded: {e.reasons.join("; ")}</span>}</p>{e.documentId && <Button size="sm" variant="ghost" onClick={() => { if (e.documentId) void open(e.documentId); }}><FileText /> Open source</Button>}</div>)}</div>])} />
    {r.conflicts.length > 0 && <Panel title="Conflicting values">{r.conflicts.map((c, i) => <div key={i} className="mb-3 space-y-1 text-sm"><p>{c.from} ↔ {c.to} · {c.status}</p>{[c.source, c.target].map((e, j) => <p key={j} className="break-words text-xs text-muted-foreground">{e?.available ? `${e.filename} · period ${e.reportingPeriod ?? "not stated"} · value ${e.value} · ${locatorText(e.locator)} · ${e.state} / ${e.integrity}` : "Source endpoint unavailable"}</p>)}</div>)}</Panel>}
    <Panel title="Draft requirement package">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void generate()}>Generate draft package</Button>{current && <PackageDownloads content={current.content as unknown as PackageContent} meta={{ version: current.version, sha256: current.content_sha256, generatedAt: new Date(current.generated_at).toISOString(), status: current.status }} baseName={`IIAF_${r.requirement.id}_${period || "all-periods"}`} />}</div>
        {current ? <PackageReview pkg={current} reviews={data.reviews.filter(x => x.package_id === current.id)} /> : <p className="text-muted-foreground">No package generated for this requirement and period.</p>}
        {current && canReview && current.status === "draft" && <div className="space-y-2"><Input aria-label="Package review note" placeholder="Review note (required)" value={note} onChange={e => setNote(e.target.value)} /><div className="flex gap-2"><Button size="sm" disabled={busy || note.trim().length < 5} onClick={() => void decide("reviewed")}>Mark reviewed</Button><Button size="sm" variant="outline" disabled={busy || note.trim().length < 5} onClick={() => void decide("changes_requested")}>Request changes</Button></div></div>}
        {data.packages.filter(p => p.status === "superseded").length > 0 && <p className="text-xs text-muted-foreground">Earlier versions superseded (reviews invalidated): {data.packages.filter(p => p.status === "superseded").map(p => `v${p.version}`).join(", ")}</p>}
        <p className="text-xs text-muted-foreground">Registrar certification is not implemented. Each version is bound to its SHA-256 content hash, so a future certification can attach to one exact version.</p>
      </div>
    </Panel>
  </div>;
}

function PackageReview({ pkg, reviews }: { pkg: { version: number; status: string; content_sha256: string; generated_at: string; content: unknown }; reviews: { decision: string; note: string; created_at: string }[] }) {
  const c = pkg.content as PackageContent;
  return <div className="space-y-3">
    <p>Version {pkg.version} · <Status tone={pkg.status === "reviewed" ? "success" : pkg.status === "changes_requested" ? "danger" : "gold"}>{pkg.status === "reviewed" ? "Draft · reviewed" : pkg.status === "changes_requested" ? "Changes requested" : "Draft · not reviewed"}</Status> · generated {new Date(pkg.generated_at).toLocaleString()}</p>
    <p className="break-all font-mono text-[11px] text-muted-foreground">SHA-256 {pkg.content_sha256}</p>
    <div className="grid gap-4 md:grid-cols-3 text-xs">
      <div><h4 className="font-semibold">Evidence index ({c.evidenceIndex.length})</h4>{c.evidenceIndex.map(e => <p key={e.number}>{e.number}. {e.evidenceId}: {e.value} · A{e.attachment} · {e.locator}</p>)}</div>
      <div><h4 className="font-semibold">Attachments ({c.attachments.length})</h4>{c.attachments.map(a => <p key={a.number}>A{a.number}. {a.filename}</p>)}</div>
      <div><h4 className="font-semibold">Issues ({c.issues.length})</h4>{c.issues.slice(0, 8).map(i => <p key={i} className="text-warning">{i}</p>)}{c.issues.length > 8 && <p>…{c.issues.length - 8} more in download</p>}</div>
    </div>
    {reviews.map(v => <p key={v.created_at} className="border-l-2 pl-2 text-xs">{v.decision} · {new Date(v.created_at).toLocaleString()} · {v.note}</p>)}
  </div>;
}
