import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLineage } from "@/lib/lineage.functions";
import { getOutputOpportunities } from "@/lib/output-opportunities.functions";
import { generateOutputs } from "@/lib/outputs.functions";
import { consolidatedReview, mappingCards, type MapStatus } from "@/lib/destination-map";
import { outputCsv, outputDocx, outputFileBase, outputText, outputsZip } from "@/lib/output-export";
import { saveBlob } from "@/lib/package-export";
import type { OutputSet } from "@/lib/outputs.functions";
import { OutputPreview } from "./output-preview";
import { Status } from "./ui";
import { structuredCsvZip, structuredExcel } from "@/lib/structured-export";
import { LocalAuthoring } from "./local-authoring";
import { StructuredRecordBrowser } from "./structured-record-browser";
import { useState } from "react";
import { selectionOutcomes } from "@/lib/output-selection";
import { SavedOutputCard } from "./saved-output-card";

export type FileResult = { documentId: string; name: string; set: OutputSet | null; error: string | null };

const STEPS = ["Upload", "Review extraction", "See qualifications", "Review mapping", "View outputs"];
export function StepIndicator({ current }: { current: number }) {
  return <ol className="flex flex-wrap gap-2 text-sm" aria-label="Workflow steps">{STEPS.map((s, i) => <li key={s} aria-current={i === current ? "step" : undefined} className={`flex items-center gap-2 rounded-full border px-3 py-1 ${i === current ? "border-primary bg-primary text-primary-foreground" : i < current ? "border-primary text-primary" : "text-muted-foreground"}`}><span className="font-semibold">{i + 1}</span>{s}</li>)}</ol>;
}

const tone = (s: MapStatus) => s === "Output generated" || s === "Persisted" || s === "Approved mapping" ? "success" as const : s === "Qualified" || s === "Candidate mapping" || s === "Review required" ? "warning" as const : s === "Failed" ? "danger" as const : "neutral" as const;
const METHOD_LABEL: Record<string, string> = { ocr: "OCR / image-based text", native: "Native text extraction" };
const methodLabel = (m: string) => METHOD_LABEL[m] ?? (/ocr|vision|image/i.test(m) ? `OCR / image-based text (${m})` : `Native text extraction (${m})`);

function OneFile({ r, requested, detailed }: { r: FileResult; requested: string[]; detailed: boolean }) {
  const [generatedSet, setGeneratedSet] = useState<OutputSet | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [generating, setGenerating] = useState(false);
  const set = generatedSet ?? r.set;
  const read = useServerFn(getLineage);
  const discover = useServerFn(getOutputOpportunities);
  const generate = useServerFn(generateOutputs);
  const discovery = useQuery({ queryKey: ["output-opportunities", r.documentId, requested, set?.createdAt], queryFn: () => discover({ data: { documentId: r.documentId, requested } }) });
  const { data: lineage, error } = useQuery({ queryKey: ["lineage", r.documentId, set?.createdAt], queryFn: () => read({ data: { documentId: r.documentId } }) });
  const cards = mappingCards(set, lineage ?? null, requested);
  const review = set?.outputs.find(o => o.type === "extraction_review");
  async function generateDraft() {
    setGenerating(true); setGenerationError("");
      try { setGeneratedSet(await generate({ data: { documentId: r.documentId, requested } })); }
    catch (e) { setGenerationError(e instanceof Error ? e.message : "The draft could not be saved."); }
    finally { setGenerating(false); }
  }
  const isImage = lineage && ["png", "jpg", "jpeg"].includes(lineage.document.file_extension);
  return <Tabs defaultValue="outputs">
    <TabsList className="flex h-auto flex-wrap">
      <TabsTrigger value="extraction">2 · Extraction</TabsTrigger>
      <TabsTrigger value="mapping">3–4 · Where this information goes ({cards.length})</TabsTrigger>
      <TabsTrigger value="brain">University Brain</TabsTrigger>
      <TabsTrigger value="outputs">5 · Outputs ({set?.outputs.length ?? 0})</TabsTrigger>
    </TabsList>
    {r.error && <p role="alert" className="mt-3 text-sm text-destructive">{r.error}</p>}
    {generationError && <p role="alert" className="mt-3 text-sm text-destructive">{generationError}</p>}
    {!requested.length&&<div className="mt-4"><Button size="sm" disabled={generating} onClick={()=>void generateDraft()}>{generating?"Generating and saving…":"Generate eligible outputs from saved source"}</Button></div>}
    {requested.length > 0 && <section className="mt-4 space-y-2" aria-label="Selected output results">
      <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">Saved selections · {requested.join(", ")}</h3><Button size="sm" disabled={generating} onClick={() => void generateDraft()}>{generating ? "Generating and saving…" : "Generate selected outputs"}</Button></div>
      {selectionOutcomes(requested, set?.outputs ?? []).map(o => <p key={o.catalogueId} className="text-sm"><strong>{o.catalogueId} · {generationError ? "Failed" : o.status === "generated_saved" ? "Generated and saved" : o.status === "needs_source_information" ? "Needs source information" : "Not supported"}</strong> — {generationError || o.reason}</p>)}
    </section>}
    <section className="mt-4 space-y-3" aria-label="Automatic output opportunities">
      <h3 className="font-semibold">Automatic output opportunities</h3>
      {discovery.isPending && <p className="text-sm text-muted-foreground">Reading saved source qualifications…</p>}
      {discovery.error && <p role="alert" className="text-sm text-destructive">{discovery.error.message}</p>}
      {discovery.data && <>
        <p className="text-xs text-muted-foreground">{discovery.data.catalogueDefinitionsEvaluated} catalogue definitions evaluated · source run {discovery.data.jobId} · saved output record {discovery.data.outputRecordId ?? "none"}</p>
        <div className="grid gap-3 md:grid-cols-2">{discovery.data.opportunities.filter(o => !o.artifact).map(o => <article key={o.key} className="border bg-background p-3 text-sm">
          <div className="flex items-start justify-between gap-2"><h4 className="font-medium">{o.name} · {o.type.replace(/_/g, " ")}</h4><Status tone={o.generated ? "success" : "warning"}>{o.generated ? "Saved draft" : o.ruleIds.length ? "Candidate opportunity" : "Requested · unqualified"}</Status></div>
          <p className="mt-1 text-xs">{o.catalogueId}{o.contractId ? ` · ${o.contractId}` : ""} · {o.ruleIds.join(", ") || "No rule applied"}{o.requested ? " · Desired Output" : ""}</p>
          <p className="mt-2 text-xs">{o.reason}</p>
          <details className="mt-2 text-xs"><summary className="cursor-pointer">Source citations ({o.locators.length}) and missing attributes</summary><p className="mt-1 break-all">{r.name} · {o.locators.join(", ") || "No qualified source locator"}</p><p className="mt-1">Missing / needs review: {o.missing.join(", ") || "Not established by discovery"}</p></details>
          <p className="mt-2 text-xs">Supported: {o.supported ? "Yes, governed draft path" : "No"} · Generated: {o.generated ? "Yes" : "No"} · Persisted: {o.persisted ? "Yes" : "No"}</p>
          {o.dependency && <p className="mt-2 text-xs text-muted-foreground">{o.dependency}</p>}
          {o.supported && !o.generated && <Button className="mt-2" size="sm" variant="outline" disabled={generating} onClick={() => {setGenerating(true);setGenerationError("");void generate({data:{documentId:r.documentId,requested:o.catalogueId?[o.catalogueId]:[]}}).then(setGeneratedSet).catch(e=>setGenerationError(String(e))).finally(()=>setGenerating(false));}}>{generating ? "Saving draft…" : "Generate governed draft"}</Button>}
        </article>)}</div>
        {!discovery.data.opportunities.some(o => !o.artifact) && <p className="text-sm text-muted-foreground">No catalogue opportunity established from the saved source. Extraction artifacts remain separate.</p>}
      </>}
    </section>
    <TabsContent value="extraction" className="space-y-3 pt-3 text-sm">
      {error && <p role="alert" className="text-destructive">Stored records could not be read.</p>}
      {lineage && <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="text-muted-foreground">File</dt><dd className="break-all">{lineage.document.original_filename} · {lineage.document.file_extension.toUpperCase()}</dd></div>
        <div><dt className="text-muted-foreground">Status</dt><dd>{lineage.document.processing_status.replace(/_/g, " ")}</dd></div>
        <div><dt className="text-muted-foreground">How text was read</dt><dd>{Object.keys(lineage.methodCounts).length ? Object.entries(lineage.methodCounts).map(([m, n]) => `${methodLabel(m)}: ${n} segments`).join("; ") : "No stored text"}</dd></div>
        <div><dt className="text-muted-foreground">Recorded reporting period</dt><dd>{lineage.document.reporting_period || "Not stated (document/upload dates are not substituted)"}</dd></div>
        <div><dt className="text-muted-foreground">Recorded document date</dt><dd>{lineage.document.document_date_raw || "Not stated"}</dd></div>
        {isImage && <div className="sm:col-span-2"><dt className="text-muted-foreground">Image asset</dt><dd>Original image is stored and downloadable from the document list. Saved news creatives, when available, are separate draft artifacts under Outputs.</dd></div>}
      </dl>}
      <p className="text-xs text-muted-foreground">Text shown below is the saved reading with its locators. It was not re-read for this view.</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap border bg-muted/40 p-3 text-xs">{review?.body || "No stored extraction review."}</pre>
    </TabsContent>
    <TabsContent value="mapping" className="pt-3">
      <p className="mb-3 text-xs text-muted-foreground">Qualified ≠ approved mapping ≠ persisted record ≠ generated output. Each card shows which one it is.</p>
      <div className="grid gap-3 md:grid-cols-2">{cards.map(c => <article key={c.key} className="border bg-background p-3 text-sm">
        <div className="flex items-start justify-between gap-2"><p className="font-medium break-words">{c.item}</p><Status tone={tone(c.status)}>{c.status}</Status></div>
        <p className="mt-1 text-muted-foreground">→ {c.destinationName}{c.destinationCode ? ` (${c.destinationCode})` : ""}</p>
        {detailed && <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-muted-foreground">
          <dt>Source</dt><dd className="break-all">{r.name}{c.locator ? ` · ${c.locator}` : ""}</dd>
          <dt>ID</dt><dd>{c.identifier ?? "—"}</dd>
          <dt>Stored</dt><dd>{c.persisted ? "Yes, persisted record" : "No, computed proposal only"}</dd>
          <dt>Output</dt><dd>{c.created ? "Created" : "Not created"}</dd>
        </dl>}
        <p className="mt-2 text-xs">{c.reason}</p>
      </article>)}</div>
    </TabsContent>
    <TabsContent value="brain" className="pt-3 text-sm">
      {lineage && <section className="mb-4 space-y-3" aria-label="Structured record reconciliation">
        <h3 className="font-semibold">Extraction and stored records</h3>
        <p>{lineage.reconciliation.persistedSegments} / {lineage.reconciliation.expectedSegments} saved segments · {lineage.reconciliation.structuredRows} table rows · {lineage.reconciliation.structuredCells} cells · {lineage.reconciliation.currentFacts} current-run facts · {lineage.reconciliation.historicalFacts} historical facts</p>
        <p className="text-xs text-muted-foreground">{lineage.reconciliation.structuredStorage} {lineage.reconciliation.segmentsWithoutFact} segments have no derived fact; their source text remains stored.</p>
        <p>{lineage.contacts.length} contact candidates · 0 structured contact records saved · consent not established</p>
        <p className="text-xs text-muted-foreground">Contact candidates are computed from saved segments, not a saved contact directory. Names, affiliations and permission to contact are not inferred.</p>
        {lineage.contacts.length > 0 && <details><summary>Contact candidates requiring review</summary><ul className="mt-2 space-y-1">{lineage.contacts.map(c => <li key={c.candidateKey} className="break-all">{c.kind}: {c.raw} · {c.locatorKey} · segment {c.segmentId} · human review required</li>)}</ul></details>}
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => saveBlob(structuredExcel(lineage), `${r.documentId}-structured-readback.xlsx`)}><Download /> Structured Excel</Button><Button size="sm" variant="outline" onClick={() => void structuredCsvZip(lineage).then(blob => saveBlob(blob, `${r.documentId}-structured-csv.zip`))}><Download /> Structured CSV (ZIP)</Button></div>
        <p className="text-xs text-muted-foreground">Separate record sheets preserve identifiers, raw locators and relationship endpoints. Exports are readback, not authored deliverables; release is not authorized.</p>
      </section>}
      {lineage ? <table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="py-1">Stored as</th><th>Record type</th><th>Identifier / count</th></tr></thead><tbody className="divide-y">
        <tr><td className="py-1">Original source</td><td>uploaded_documents</td><td className="break-all">{lineage.document.id} · SHA-256 {lineage.document.sha256_hash.slice(0, 16)}…</td></tr>
        <tr><td className="py-1">Extraction run</td><td>document_processing_jobs</td><td className="break-all">{lineage.job ? `${lineage.job.id} · ${lineage.job.processor ?? ""} ${lineage.job.processor_version ?? ""} · ${lineage.job.state}` : "None"}</td></tr>
        <tr><td className="py-1">Text segments with locators</td><td>document_segments</td><td>{lineage.job?.segment_count ?? 0}</td></tr>
        <tr><td className="py-1">Proposed facts</td><td>proposed_facts → DST-001</td><td>{lineage.facts.length} ({lineage.facts.filter(f => f.state === "approved").length} approved)</td></tr>
        <tr><td className="py-1">Correction / review history</td><td>fact_reviews</td><td>{lineage.reviewCount}</td></tr>
        <tr><td className="py-1">Relationships (incl. conflicts)</td><td>relationships</td><td>{lineage.relationships.length}</td></tr>
        <tr><td className="py-1">Saved output set</td><td>document_outputs → DST-014</td><td className="break-all">{lineage.outputRecord ? `${lineage.outputRecord.id}${lineage.outputRecord.phase2_quarantined ? " (quarantined)" : ""}` : "None"}</td></tr>
      </tbody></table> : <p className="text-muted-foreground">Reading stored records…</p>}
      <p className="mt-2 text-xs text-muted-foreground">Everything here is read back from the database under your own access. Proposed facts are not approved evidence.</p>
      {lineage && <StructuredRecordBrowser lineage={lineage} />}
    </TabsContent>
    <TabsContent value="outputs" className="pt-3">
      {set?.setId && <p className="mb-3 break-all text-xs text-muted-foreground">Saved set {set.setId} · {set.createdAt} · source version {set.sourceVersion}</p>}
      {lineage && <LocalAuthoring lineage={lineage} />}
      {set && set.outputs.length > 0 && <Button size="sm" variant="outline" className="mb-3" onClick={() => { if (set) void outputsZip(set.outputs, r.name).then(b => saveBlob(b, `${outputFileBase({ type: "outputs" }, r.name)}.zip`)); }}><Download /> Download saved outputs (ZIP)</Button>}
      <div className="grid gap-4 lg:grid-cols-2">{(set?.outputs ?? []).map(o => <SavedOutputCard key={o.type} output={o} setId={set?.setId} source={r.name} onSaved={setGeneratedSet}/>)}</div>
      {set && set.skipped.length > 0 && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Not produced ({set.skipped.length}) and why</summary><ul className="mt-2 list-disc pl-5">{set.skipped.map(s => <li key={s.name}>{s.name}: {s.reason}</li>)}</ul></details>}
    </TabsContent>
  </Tabs>;
}

export function UploadResults({ results, requested, instruction }: { results: FileResult[]; requested: string[]; instruction: string }) {
  const ok = results.filter(r => r.set) as (FileResult & { set: OutputSet })[];
  const detailed = true;
  return <div className="space-y-4 border bg-card p-5" aria-live="polite">
    <StepIndicator current={4} />
    {instruction && <p className="text-xs text-muted-foreground">Your instruction was saved with this batch. It does not change the drafts, because no AI writing is authorized; drafts use stored source text only.</p>}
    {ok.length > 1 && <div className="flex flex-wrap items-center gap-3 border-l-4 border-primary bg-primary/5 p-3 text-sm"><span>Combined output from {ok.length} files — every line keeps its file and locator; conflicts are not merged.</span>
      <Button size="sm" variant="outline" onClick={() => saveBlob(new Blob([consolidatedReview(ok.map(r => ({ name: r.name, documentId: r.documentId, set: r.set })))], { type: "text/plain" }), "consolidated-source-review.txt")}><Download /> Combined review (Text)</Button></div>}
    <Tabs defaultValue={results[0]?.documentId ?? ""}>
      {results.length > 1 && <TabsList className="flex h-auto flex-wrap">{results.map(r => <TabsTrigger key={r.documentId} value={r.documentId}>{r.name}</TabsTrigger>)}</TabsList>}
      {results.map(r => <TabsContent key={r.documentId} value={r.documentId}><h2 className="mb-2 font-semibold break-all">{r.name}</h2><OneFile r={r} requested={requested} detailed={detailed} /></TabsContent>)}
    </Tabs>
  </div>;
}
