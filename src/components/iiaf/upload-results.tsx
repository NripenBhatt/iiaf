import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLineage } from "@/lib/lineage.functions";
import { consolidatedReview, mappingCards, type MapStatus } from "@/lib/destination-map";
import { outputCsv, outputDocx, outputFileBase, outputText, outputsZip } from "@/lib/output-export";
import { saveBlob } from "@/lib/package-export";
import type { OutputSet } from "@/lib/outputs.functions";
import { OutputPreview } from "./output-preview";
import { Status } from "./ui";

export type FileResult = { documentId: string; name: string; set: OutputSet | null; error: string | null };

const STEPS = ["Upload", "Review extraction", "See qualifications", "Review mapping", "View outputs"];
export function StepIndicator({ current }: { current: number }) {
  return <ol className="flex flex-wrap gap-2 text-sm" aria-label="Workflow steps">{STEPS.map((s, i) => <li key={s} aria-current={i === current ? "step" : undefined} className={`flex items-center gap-2 rounded-full border px-3 py-1 ${i === current ? "border-primary bg-primary text-primary-foreground" : i < current ? "border-primary text-primary" : "text-muted-foreground"}`}><span className="font-semibold">{i + 1}</span>{s}</li>)}</ol>;
}

const tone = (s: MapStatus) => s === "Output generated" || s === "Persisted" || s === "Approved mapping" ? "success" as const : s === "Qualified" || s === "Candidate mapping" || s === "Review required" ? "warning" as const : s === "Failed" ? "danger" as const : "neutral" as const;
const METHOD_LABEL: Record<string, string> = { ocr: "OCR / image-based text", native: "Native text extraction" };
const methodLabel = (m: string) => METHOD_LABEL[m] ?? (/ocr|vision|image/i.test(m) ? `OCR / image-based text (${m})` : `Native text extraction (${m})`);

function OneFile({ r, requested, detailed }: { r: FileResult; requested: string[]; detailed: boolean }) {
  const read = useServerFn(getLineage);
  const { data: lineage, error } = useQuery({ queryKey: ["lineage", r.documentId, r.set?.createdAt], queryFn: () => read({ data: { documentId: r.documentId } }) });
  const cards = mappingCards(r.set, lineage ?? null, requested);
  const review = r.set?.outputs.find(o => o.type === "extraction_review");
  const isImage = lineage && ["png", "jpg", "jpeg"].includes(lineage.document.file_extension);
  if (r.error) return <p role="alert" className="text-sm text-destructive">{r.error}</p>;
  return <Tabs defaultValue="outputs">
    <TabsList className="flex h-auto flex-wrap">
      <TabsTrigger value="extraction">2 · Extraction</TabsTrigger>
      <TabsTrigger value="mapping">3–4 · Where this information goes ({cards.length})</TabsTrigger>
      <TabsTrigger value="brain">University Brain</TabsTrigger>
      <TabsTrigger value="outputs">5 · Outputs ({r.set?.outputs.length ?? 0})</TabsTrigger>
    </TabsList>
    <TabsContent value="extraction" className="space-y-3 pt-3 text-sm">
      {error && <p role="alert" className="text-destructive">Stored records could not be read.</p>}
      {lineage && <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="text-muted-foreground">File</dt><dd className="break-all">{lineage.document.original_filename} · {lineage.document.file_extension.toUpperCase()}</dd></div>
        <div><dt className="text-muted-foreground">Status</dt><dd>{lineage.document.processing_status.replace(/_/g, " ")}</dd></div>
        <div><dt className="text-muted-foreground">How text was read</dt><dd>{Object.keys(lineage.methodCounts).length ? Object.entries(lineage.methodCounts).map(([m, n]) => `${methodLabel(m)}: ${n} segments`).join("; ") : "No stored text"}</dd></div>
        <div><dt className="text-muted-foreground">Recorded period</dt><dd>{lineage.document.reporting_period || lineage.document.document_date_raw || "Not stated (upload time is not used as a period)"}</dd></div>
        {isImage && <div className="sm:col-span-2"><dt className="text-muted-foreground">Image asset</dt><dd>Original image is stored and downloadable from the document list. No image or video creative is generated; only text read from the image is used.</dd></div>}
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
    </TabsContent>
    <TabsContent value="outputs" className="pt-3">
      {r.set && r.set.outputs.length > 0 && <Button size="sm" variant="outline" className="mb-3" onClick={() => void outputsZip(r.set!.outputs, r.name).then(b => saveBlob(b, `${outputFileBase({ type: "outputs" }, r.name)}.zip`))}><Download /> Download all (ZIP)</Button>}
      <div className="grid gap-4 lg:grid-cols-2">{(r.set?.outputs ?? []).map(o => <article key={o.type} className="flex flex-col border bg-background p-4">
        <div className="flex items-start justify-between gap-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">{o.name}</p><Status tone="warning">Draft · review required</Status></div>
        <h3 className="mt-1 font-semibold">{o.title}</h3>
        <div className="mt-2 max-h-64 min-w-0 flex-1 overflow-auto"><OutputPreview output={o} /></div>
        <p className="mt-3 text-xs text-muted-foreground">Source: {r.name}{o.catalogue?.catalogueId ? ` · ${o.catalogue.catalogueId}` : ""}{o.catalogue?.contractId ? ` · ${o.catalogue.contractId}` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void outputDocx(o, r.name).then(b => saveBlob(b, `${outputFileBase(o, r.name)}.docx`))}><Download /> Word</Button>
          <Button size="sm" variant="ghost" onClick={() => saveBlob(new Blob([outputText(o, r.name)], { type: "text/plain" }), `${outputFileBase(o, r.name)}.txt`)}><Download /> Text</Button>
          {o.tables?.length ? <Button size="sm" variant="ghost" onClick={() => saveBlob(new Blob([outputCsv(o)], { type: "text/csv" }), `${outputFileBase(o, r.name)}.csv`)}><Download /> CSV</Button> : null}</div>
      </article>)}</div>
      {r.set && r.set.skipped.length > 0 && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Not produced ({r.set.skipped.length}) and why</summary><ul className="mt-2 list-disc pl-5">{r.set.skipped.map(s => <li key={s.name}>{s.name}: {s.reason}</li>)}</ul></details>}
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
    <Tabs defaultValue={results[0]?.documentId}>
      {results.length > 1 && <TabsList className="flex h-auto flex-wrap">{results.map(r => <TabsTrigger key={r.documentId} value={r.documentId}>{r.name}</TabsTrigger>)}</TabsList>}
      {results.map(r => <TabsContent key={r.documentId} value={r.documentId}><h2 className="mb-2 font-semibold break-all">{r.name}</h2><OneFile r={r} requested={requested} detailed={detailed} /></TabsContent>)}
    </Tabs>
  </div>;
}
