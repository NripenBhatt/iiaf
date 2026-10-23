import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Upload, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RECONCILED_OUTPUT_CATALOGUE } from "@/lib/output-reference";
import { recordBatch } from "@/lib/lineage.functions";
import { StepIndicator, UploadResults, type FileResult } from "./upload-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import catalogue from "@/data/upload-catalogue.json";
import { Status } from "./ui";
import { useWorkspace } from "./workspace";
import { listDocuments, registerDocument, finalizeDocument, markDocumentFailed, getDocumentLink } from "@/lib/documents.functions";
import { processDocument } from "@/lib/intelligence.functions";
import { generateOutputs, getOutputs } from "@/lib/outputs.functions";
import { ALLOWED_EXTENSIONS, isStored, UPLOAD_BUCKET, sha256Hex, validateSelection, type UploadModule } from "@/lib/upload-rules";
import { ListFilterControls, useListFilters } from "./list-filters";
import intakeGuidance from "@/data/intake-guidance.json";

const EVIDENCE_FRAMEWORKS = ["NAAC", "NIRF", "QS", "THE", "UI GreenMetric", "Other / not stated"];
function categoriesFor(module: UploadModule) {
  if (module === "evidence") return EVIDENCE_FRAMEWORKS.map(f => ({ code: `EVID-${(f.split(" ")[0] ?? f).toUpperCase()}`, name: `Declared framework: ${f}` }));
  return catalogue[module === "institutional" ? "institutional" : "meeting"].categories;
}
function typesFor(module: UploadModule, category: string) {
  if (module === "evidence") return [];
  return catalogue[module === "institutional" ? "institutional" : "meeting"].documentTypes.filter(t => t.category === category);
}
const blank = { declared_purpose: "", reporting_period: "", document_date_raw: "" };
const READ_FAILED = ["processing_failed", "ocr_required", "upload_failed", "validation_failed"];
const simpleStatus = (s: string) => READ_FAILED.includes(s) ? { tone: "danger" as const, text: "Could not be read" } : s === "needs_review" ? { tone: "warning" as const, text: "Review required" } : s === "extracted" ? { tone: "success" as const, text: "Read" } : { tone: "neutral" as const, text: "Reading…" };

export function DocumentUploads({ module, label }: { module: UploadModule; label: string }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const { filters, update } = useListFilters();
  const list = useServerFn(listDocuments); const register = useServerFn(registerDocument); const finalize = useServerFn(finalizeDocument);
  const process = useServerFn(processDocument); const fail = useServerFn(markDocumentFailed); const link = useServerFn(getDocumentLink);
  const generate = useServerFn(generateOutputs); const load = useServerFn(getOutputs); const batch = useServerFn(recordBatch);
  const key = ["documents", workspace.id, module];
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: [...key, filters], queryFn: () => list({ data: { organizationId: workspace.id, module, filters } }), placeholderData: (previous, query) => query?.queryKey[1] === workspace.id && query.queryKey[2] === module ? previous : undefined });
  type Queued = { file: File; status: "selected" | "uploading" | "reading" | "read" | "failed"; error: string | null; documentId: string | null };
  const [queue, setQueue] = useState<Queued[]>([]); const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState(""); const [docType, setDocType] = useState("UNKNOWN");
  const [meta, setMeta] = useState(blank); const [stage, setStage] = useState<string | null>(null); const [dragging, setDragging] = useState(false);
  const [requested, setRequested] = useState<string[]>([]); const [instruction, setInstruction] = useState("");
  const [results, setResults] = useState<FileResult[] | null>(null);
  const categories = categoriesFor(module); const types = typesFor(module, category);
  const guidance = module === "evidence" ? null : intakeGuidance[module].categories.find(c => c.code === category);
  const anyErrors = queue.some(q => validateSelection(q.file).length > 0);
  const first = queue[0]?.file ?? null;

  useEffect(() => {
    if (queue.length !== 1 || !first?.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(first); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [first, queue.length]);

  const addFiles = (list: FileList | null) => { if (!list) return; const add = [...list].map(f => ({ file: f, status: "selected" as const, error: null, documentId: null })); setQueue(q => [...q, ...add].slice(0, 20)); };
  const patch = (i: number, v: Partial<Queued>) => setQueue(q => q.map((x, j) => j === i ? { ...x, ...v } : x));

  async function outputsFor(id: string, name: string): Promise<FileResult> {
    try { return { documentId: id, name, set: await generate({ data: { documentId: id } }), error: null }; }
    catch (e) { return { documentId: id, name, set: null, error: e instanceof Error ? e.message : "Outputs could not be generated." }; }
  }
  async function showOutputs(id: string, name: string) {
    setResults(null); setStage("Reading saved outputs…");
    try {
      const existing = await load({ data: { documentId: id } });
      if (existing) setResults([{ documentId: id, name, set: existing, error: null }]);
      else if (data?.canUpload) setResults([await outputsFor(id, name)]);
      else setResults([{ documentId: id, name, set: null, error: "No saved outputs are available. An authorized uploader must create them." }]);
    } catch (e) { setResults([{ documentId: id, name, set: null, error: e instanceof Error ? e.message : "Saved outputs could not be read." }]); }
    finally { setStage(null); }
  }

  /** Same governed path for one or many files; each file keeps its own identity, hash and job. */
  async function upload() {
    if (!queue.length || !category || anyErrors) return;
    setResults(null); const done: FileResult[] = []; const fileResults: { name: string; status: string; documentId: string | null; error: string | null }[] = [];
    for (let i = 0; i < queue.length; i++) {
      const file = queue[i]!.file; let docId: string | null = null;
      try {
        patch(i, { status: "uploading", error: null }); setStage(`Uploading ${i + 1} of ${queue.length}: ${file.name}`);
        const sha256 = await sha256Hex(await file.arrayBuffer());
        const reg = await register({ data: { organizationId: workspace.id, module, category, documentType: docType, filename: file.name, mime: file.type, size: file.size, sha256, meta: { ...meta, department_or_owner: "", document_version_or_status: "", language: "" } } });
        docId = reg.id;
        const { error: upErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(reg.storage_object_key, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) { await fail({ data: { id: reg.id, reason: "Storage did not accept the file" } }); throw new Error("The file could not be stored."); }
        const { status } = await finalize({ data: { id: reg.id } });
        if (status !== "awaiting_processing") throw new Error("The file did not pass the upload checks.");
        patch(i, { status: "reading", documentId: reg.id }); setStage(`Reading ${file.name}…`);
        const r = await process({ data: { id: reg.id } }) as { status?: string; error?: string | null };
        if (r.status && READ_FAILED.includes(r.status)) throw new Error(r.error || "The document could not be read.");
        setStage(`Writing outputs for ${file.name}…`);
        done.push(await outputsFor(reg.id, file.name)); patch(i, { status: "read" });
        fileResults.push({ name: file.name, status: "read", documentId: reg.id, error: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        patch(i, { status: "failed", error: msg }); fileResults.push({ name: file.name, status: "failed", documentId: docId, error: msg.slice(0, 500) });
      }
    }
    await cache.invalidateQueries({ queryKey: key }); await cache.invalidateQueries({ queryKey: ["facts", workspace.id] });
    try { await batch({ data: { organizationId: workspace.id, module, documentIds: fileResults.flatMap(f => f.documentId && f.status === "read" ? [f.documentId] : []), requestedOutputs: requested, instruction: instruction.trim() || null, fileResults } }); }
    catch { toast.error("Files were processed, but the batch record could not be saved."); }
    const failed = fileResults.filter(f => f.status === "failed").length;
    if (failed) toast.error(`${failed} of ${fileResults.length} file(s) failed; the others were kept.`); else toast.success(`${fileResults.length} file(s) uploaded and read.`);
    setStage(null); setResults(done); setQueue(q => q.filter(x => x.status === "failed")); setMeta(blank);
  }
  async function open(id: string) {
    try { const { url } = await link({ data: { id } }); const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download denied"); }
  }

  const field = (k: keyof typeof blank, l: string, hint: string) => <div className="space-y-1"><Label htmlFor={`${module}-${k}`}>{l}</Label><Input id={`${module}-${k}`} placeholder={hint} value={meta[k]} onChange={e => setMeta({ ...meta, [k]: e.target.value })} /></div>;
  const busy = stage !== null;
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm text-left transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary"}`;
  return <section className="mb-8 space-y-5" aria-label={`${label} uploads`}>
    {data?.canUpload ? <div className="space-y-5 border bg-card p-5">
      <StepIndicator current={results ? 4 : 0} />
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">Upload one or several files</h2><p className="text-xs text-muted-foreground">Up to 20 files · 20 MB each · {ALLOWED_EXTENSIONS.join(", ")}</p></div>
      <fieldset><legend className="mb-2 text-sm font-medium">What kind of document is it? (required)</legend>
        <div className="flex flex-wrap gap-2">{categories.map(c => <button type="button" key={c.code} aria-pressed={category === c.code} className={chip(category === c.code)} onClick={() => { setCategory(c.code); setDocType("UNKNOWN"); }}>{c.name}</button>)}</div></fieldset>
      {guidance && <div className="border-l-2 border-primary pl-3 text-sm"><p className="font-medium">{guidance.name}</p><p className="mt-1 text-muted-foreground">{guidance.description}</p>{guidance.examples && <p className="mt-1 text-muted-foreground">Examples: {guidance.examples}</p>}</div>}
      {module === "evidence" && <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">Declared framework only. Exact methodology edition, requirement and evidence approval are not established by this upload.</p>}
      <details className="text-sm"><summary className="cursor-pointer font-medium">Optional details (title, period, date{types.length > 0 ? ", document type" : ""})</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {types.length > 0 && <div className="space-y-1"><Label htmlFor={`${module}-type`}>Document type</Label>
            <select id={`${module}-type`} className="h-9 w-full border bg-background px-2 text-sm" value={docType} onChange={e => setDocType(e.target.value)}>
              <option value="UNKNOWN">Not sure</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>}
          {field("declared_purpose", "Title or description", "e.g. Startup workshop poster")}
          {field("reporting_period", "Reporting period", "Only if known")}
          {field("document_date_raw", module === "meeting" ? "Meeting date" : "Event / document date", "As stated in the source")}
        </div></details>
      <label htmlFor={`${module}-file`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-wrap items-center gap-4 border-2 border-dashed p-5 text-sm ${dragging ? "border-primary bg-primary/5" : "border-border"}`}>
        {preview ? <img src={preview} alt="Selected file preview" className="h-24 w-24 border object-cover" /> : <FileText className="size-8 text-muted-foreground" />}
        <span>Drag one or more files here, or <span className="font-medium underline">choose files</span></span>
        <input id={`${module}-file`} type="file" multiple className="sr-only" accept={ALLOWED_EXTENSIONS.map(e => `.${e}`).join(",")} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
      </label>
      {queue.length > 0 && <ul className="divide-y border" aria-label="Selected files">{queue.map((q, i) => { const errs = validateSelection(q.file); return <li key={`${q.file.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="min-w-0"><span className="block break-all font-medium">{q.file.name}</span><span className="text-xs text-muted-foreground">{q.file.name.split(".").pop()?.toUpperCase()} · {(q.file.size / 1024).toFixed(0)} KB</span>
          {(errs.length > 0 || q.error) && <span role="alert" className="block text-xs text-destructive">{[...errs, q.error].filter(Boolean).join(" ")}</span>}</span>
        <span className="flex items-center gap-2"><Status tone={q.status === "failed" || errs.length ? "danger" : q.status === "read" ? "success" : q.status === "selected" ? "neutral" : "warning"}>{errs.length ? "Not accepted" : { selected: "Ready", uploading: "Uploading", reading: "Reading", read: "Read", failed: "Failed" }[q.status]}</Status>
          <Button size="sm" variant="ghost" disabled={busy} aria-label={`Remove ${q.file.name}`} onClick={() => setQueue(x => x.filter((_, j) => j !== i))}><X /></Button></span>
      </li>; })}</ul>}
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Desired output (optional)</legend>
        <p className="text-xs text-muted-foreground">Leave empty and the system checks every output automatically. Picks are added to that check, not a replacement. Cards marked "not available" cannot be produced yet and will say why.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{RECONCILED_OUTPUT_CATALOGUE.map(o => { const on = requested.includes(o.Output_ID); return <button type="button" key={o.Output_ID} aria-pressed={on} onClick={() => setRequested(r => on ? r.filter(x => x !== o.Output_ID) : [...r, o.Output_ID])} className={`border p-3 text-left text-sm ${on ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background hover:border-primary"}`}>
          <span className="flex items-start justify-between gap-2"><span className="font-medium">{o.Output_Name}</span><span className="text-xs text-muted-foreground">{o.Output_ID}</span></span>
          <span className="mt-1 block text-xs text-muted-foreground">{["OUT-005", "OUT-006", "OUT-007"].includes(o.Output_ID) ? "Requires explicit meeting fields" : "Generation unavailable under current safety gate"} · Catalogue formats: {o.Output_Formats}</span></button>; })}</div>
        <Label htmlFor={`${module}-instruction`}>Additional instruction (optional)</Label>
        <Textarea id={`${module}-instruction`} maxLength={1000} placeholder="e.g. Combine these files into one event report" value={instruction} onChange={e => setInstruction(e.target.value)} />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3"><Button size="lg" disabled={busy || !category || !queue.length || anyErrors} onClick={() => void upload()}><Upload /> {queue.length > 1 ? `Upload and process ${queue.length} files` : "Upload and process"}</Button>
        {stage ? <span role="status" className="text-sm text-muted-foreground">{stage}</span> : !category && queue.length > 0 && <span className="text-sm text-muted-foreground">Choose a document kind first.</span>}</div>
    </div> : data && <p className="border-l-4 border-border bg-muted p-3 text-sm">Your role in this workspace can view documents but cannot upload.</p>}

    {!data?.canUpload && stage && <p role="status" className="text-sm text-muted-foreground">{stage}</p>}
    {results && <UploadResults results={results} requested={requested} instruction={instruction.trim()} />}
    {error ? <p role="alert" className="text-sm text-destructive">Documents could not be loaded.</p> : isLoading ? <p className="text-sm text-muted-foreground">Loading documents…</p> :
      <div className="border bg-card"><h2 className="border-b px-5 py-3 font-semibold">Your {label.toLowerCase()}</h2>
        <ListFilterControls filters={filters} update={update} total={isFetching ? undefined : data?.total} categories={categories.map(c => ({ value: c.code, label: c.name }))} types={module === "evidence" ? [] : catalogue[module].documentTypes.map(t => ({ value: t.id, label: t.name }))} />
        {data?.documents.length === 0 && <p className="p-5 text-sm text-muted-foreground">No documents match these filters. Clear filters to see other documents.</p>}
        <ul className="divide-y">{(data?.documents ?? []).map(d => { const st = simpleStatus(d.processing_status); return <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
          <div><p className="break-all font-medium">{d.original_filename}</p><p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()} · {(d.file_size_bytes / 1024).toFixed(0)} KB · {d.reporting_period || d.document_date_raw || "Period/date not stated"}</p><p className="text-xs text-muted-foreground">Latest activity: {new Date(d.updated_at).toLocaleString()} · Owner: {d.department_or_owner || "not recorded"}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Status tone={st.tone}>{st.text}</Status>
            {isStored(d.processing_status) && <Button size="sm" variant="ghost" onClick={() => void open(d.id)}>Original</Button>}
            {["extracted", "needs_review"].includes(d.processing_status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => void showOutputs(d.id, d.original_filename)}>View outputs</Button>}</div>
        </li>; })}</ul></div>}
  </section>;
}
