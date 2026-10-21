import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import catalogue from "@/data/upload-catalogue.json";
import { Status } from "./ui";
import { useWorkspace } from "./workspace";
import { listDocuments, registerDocument, finalizeDocument, markDocumentFailed, getDocumentLink } from "@/lib/documents.functions";
import { processDocument } from "@/lib/intelligence.functions";
import { generateOutputs, getOutputs, type OutputSet } from "@/lib/outputs.functions";
import { outputCsv, outputDocx, outputFileBase, outputText, outputsZip } from "@/lib/output-export";
import { OutputPreview } from "./output-preview";
import { saveBlob } from "@/lib/package-export";
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
const simpleStatus = (s: string) => READ_FAILED.includes(s) ? { tone: "danger" as const, text: "Could not be read" } : ["needs_review", "extracted"].includes(s) ? { tone: "success" as const, text: "Read" } : { tone: "neutral" as const, text: "Reading…" };

export function DocumentUploads({ module, label }: { module: UploadModule; label: string }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const { filters, update } = useListFilters();
  const list = useServerFn(listDocuments); const register = useServerFn(registerDocument); const finalize = useServerFn(finalizeDocument);
  const process = useServerFn(processDocument); const fail = useServerFn(markDocumentFailed); const link = useServerFn(getDocumentLink);
  const generate = useServerFn(generateOutputs); const load = useServerFn(getOutputs);
  const key = ["documents", workspace.id, module];
  const { data, isLoading, isFetching, error } = useQuery({ queryKey: [...key, filters], queryFn: () => list({ data: { organizationId: workspace.id, module, filters } }) });
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState(""); const [docType, setDocType] = useState("UNKNOWN");
  const [meta, setMeta] = useState(blank); const [stage, setStage] = useState<string | null>(null); const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState<{ id: string; name: string } | null>(null);
  const [outputs, setOutputs] = useState<OutputSet | null>(null); const [outputsError, setOutputsError] = useState<string | null>(null);
  const categories = categoriesFor(module); const types = typesFor(module, category);
  const guidance = module === "evidence" ? null : intakeGuidance[module].categories.find(c => c.code === category);
  const fileErrors = file ? validateSelection(file) : [];

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);

  async function makeOutputs(id: string, name: string) {
    setActive({ id, name }); setOutputs(null); setOutputsError(null); setStage("Writing outputs from the document content…");
    try { setOutputs(await generate({ data: { documentId: id } })); }
    catch (e) { setOutputsError(e instanceof Error ? e.message : "Outputs could not be generated."); }
    finally { setStage(null); }
  }
  async function showOutputs(id: string, name: string) {
    setActive({ id, name }); setOutputsError(null); setOutputs(null);
    const existing = await load({ data: { documentId: id } }).catch(() => null);
    if (existing && (existing.outputs[0]?.manifest || !data?.canUpload)) setOutputs(existing); else await makeOutputs(id, name);
  }

  async function upload() {
    if (!file || !category || fileErrors.length) return;
    try {
      setStage("Uploading…");
      const sha256 = await sha256Hex(await file.arrayBuffer());
      const reg = await register({ data: { organizationId: workspace.id, module, category, documentType: docType, filename: file.name, mime: file.type, size: file.size, sha256, meta: { ...meta, department_or_owner: "", document_version_or_status: "", language: "" } } });
      const { error: upErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(reg.storage_object_key, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) { await fail({ data: { id: reg.id, reason: "Storage did not accept the file" } }); throw new Error("The file could not be stored. Please try again."); }
      const { status } = await finalize({ data: { id: reg.id } });
      if (status !== "awaiting_processing") throw new Error("The file did not pass the upload checks.");
      toast.success(`${file.name} uploaded.`);
      setStage("Reading the document…"); await cache.invalidateQueries({ queryKey: key });
      const r = await process({ data: { id: reg.id } }) as { status?: string; error?: string | null };
      await cache.invalidateQueries({ queryKey: key }); await cache.invalidateQueries({ queryKey: ["facts", workspace.id] });
      if (r.status && READ_FAILED.includes(r.status)) throw new Error(r.error || "The document could not be read.");
      setFile(null); setMeta(blank);
      await makeOutputs(reg.id, file.name);
    } catch (e) { setStage(null); toast.error(e instanceof Error ? e.message : "Upload failed"); }
  }
  async function open(id: string) {
    try { const { url } = await link({ data: { id } }); const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download denied"); }
  }

  const field = (k: keyof typeof blank, l: string, hint: string) => <div className="space-y-1"><Label htmlFor={`${module}-${k}`}>{l}</Label><Input id={`${module}-${k}`} placeholder={hint} value={meta[k]} onChange={e => setMeta({ ...meta, [k]: e.target.value })} /></div>;
  const busy = stage !== null;
  return <section className="mb-8 space-y-5" aria-label={`${label} uploads`}>
    {data?.canUpload ? <div className="space-y-4 border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">1 · Upload a document</h2><p className="text-xs text-muted-foreground">Up to 20 MB · {ALLOWED_EXTENSIONS.join(", ")}</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1"><Label htmlFor={`${module}-category`}>Category (required)</Label>
          <select id={`${module}-category`} className="h-9 w-full border bg-background px-2 text-sm" value={category} onChange={e => { setCategory(e.target.value); setDocType("UNKNOWN"); }}>
            <option value="">Select a category</option>{categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select></div>
        {types.length > 0 && <div className="space-y-1"><Label htmlFor={`${module}-type`}>Document type</Label>
          <select id={`${module}-type`} className="h-9 w-full border bg-background px-2 text-sm" value={docType} onChange={e => setDocType(e.target.value)}>
            <option value="UNKNOWN">Not sure</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>}
        {field("declared_purpose", "Title or description (optional)", "e.g. Startup workshop poster")}
        {field("reporting_period", "Reporting period (optional)", "Only if known")}
        {field("document_date_raw", module === "meeting" ? "Meeting date (optional)" : "Event / document date (optional)", "As stated in the source")}
      </div>
      {guidance && <div className="border-l-2 border-primary pl-3 text-sm"><p className="font-medium">{guidance.name}</p><p className="mt-1 text-muted-foreground">{guidance.description}</p>{guidance.examples && <p className="mt-1 text-muted-foreground">Examples: {guidance.examples}</p>}<p className="mt-1 text-xs text-muted-foreground">{guidance.formats ? `Catalogue formats: ${guidance.formats}. ` : ""}Assignment and due date: not recorded.</p></div>}
      {module === "evidence" && <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">Declared framework only. Exact methodology edition, requirement and evidence approval are not established by this upload.</p>}
      <p className="text-xs text-muted-foreground">Scans and images require legible text; spreadsheet values retain source references and require review.</p>
      <label htmlFor={`${module}-file`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        className={`flex cursor-pointer flex-wrap items-center gap-4 border-2 border-dashed p-5 text-sm ${dragging ? "border-primary bg-primary/5" : "border-border"}`}>
        {preview ? <img src={preview} alt="Selected file preview" className="h-24 w-24 border object-cover" /> : <FileText className="size-8 text-muted-foreground" />}
        {file ? <span><span className="font-medium break-all">{file.name}</span><span className="block text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · {file.name.split(".").pop()?.toUpperCase()}</span></span> : <span>Drag a file here, or <span className="font-medium underline">choose a file</span></span>}
        <input id={`${module}-file`} type="file" className="sr-only" accept={ALLOWED_EXTENSIONS.map(e => `.${e}`).join(",")} onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {fileErrors.length > 0 && <ul role="alert" className="list-disc border-l-4 border-destructive bg-destructive/5 p-3 pl-8 text-sm">{fileErrors.map(e => <li key={e}>{e}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-3"><Button disabled={busy || !category || !file || fileErrors.length > 0} onClick={() => void upload()}><Upload /> Upload</Button>
        {stage ? <span role="status" className="text-sm text-muted-foreground">{stage}</span> : !category && file && <span className="text-sm text-muted-foreground">Choose a category first.</span>}</div>
    </div> : data && <p className="border-l-4 border-border bg-muted p-3 text-sm">Your role in this workspace can view documents but cannot upload.</p>}

    {active && <div className="space-y-4 border bg-card p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">2 · Outputs from {active.name}</h2>
        {outputs && outputs.outputs.length > 0 && <Button size="sm" variant="outline" onClick={() => void outputsZip(outputs.outputs, active.name).then(b => saveBlob(b, `${outputFileBase({ type: "outputs", name: "", title: "", body: "" }, active.name)}.zip`))}><Download /> Download all (ZIP)</Button>}</div>
      {stage && !outputs && <p className="text-sm text-muted-foreground">{stage}</p>}
      {outputsError && <p role="alert" className="text-sm text-destructive">{outputsError}</p>}
      {outputs && <>
        {outputs.outputs.length === 0 && <p className="text-sm">The document did not contain enough information for any output.</p>}
        <div className="grid gap-4 lg:grid-cols-2">{outputs.outputs.map(o => <article key={o.type} className="flex flex-col border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{o.name}</p><h3 className="mt-1 font-semibold">{o.title}</h3>
          <div className="mt-2 max-h-64 min-w-0 flex-1 overflow-auto"><OutputPreview output={o} /></div>
          <p className="mt-3 text-xs text-muted-foreground">Source: {active.name}</p>
          <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => void outputDocx(o, active.name).then(b => saveBlob(b, `${outputFileBase(o, active.name)}.docx`))}><Download /> Word</Button>
            <Button size="sm" variant="ghost" onClick={() => saveBlob(new Blob([outputText(o, active.name)], { type: "text/plain" }), `${outputFileBase(o, active.name)}.txt`)}><Download /> Text</Button>{o.tables?.length ? <Button size="sm" variant="ghost" onClick={() => saveBlob(new Blob([outputCsv(o)], { type: "text/csv" }), `${outputFileBase(o, active.name)}.csv`)}><Download /> CSV</Button> : null}</div>
        </article>)}</div>
        {(outputs.skipped.length > 0 || outputs.limitations.length > 0) && <div className="text-xs text-muted-foreground">
          {outputs.skipped.length > 0 && <p><span className="font-medium">Not produced:</span> {outputs.skipped.map(s => `${s.name} (${s.reason})`).join("; ")}</p>}
          {outputs.limitations.length > 0 && <p className="mt-1"><span className="font-medium">Notes:</span> {outputs.limitations.join(" ")}</p>}
        </div>}
        <p className="text-xs text-muted-foreground">Outputs are drafts written only from the document's text. Download them to edit; check against the original before publishing.</p>
      </>}
    </div>}

    {error ? <p role="alert" className="text-sm text-destructive">Documents could not be loaded.</p> : isLoading ? <p className="text-sm text-muted-foreground">Loading documents…</p> :
      <div className="border bg-card"><h2 className="border-b px-5 py-3 font-semibold">Your {label.toLowerCase()}</h2>
        <ListFilterControls filters={filters} update={update} total={isFetching ? undefined : data?.total} categories={categories.map(c => ({ value: c.code, label: c.name }))} types={module === "evidence" ? [] : catalogue[module].documentTypes.map(t => ({ value: t.id, label: t.name }))} />
        {data?.documents.length === 0 && <p className="p-5 text-sm text-muted-foreground">No documents match these filters. Clear filters to see other documents.</p>}
        <ul className="divide-y">{(data?.documents ?? []).map(d => { const st = simpleStatus(d.processing_status); return <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
          <div><p className="break-all font-medium">{d.original_filename}</p><p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()} · {(d.file_size_bytes / 1024).toFixed(0)} KB · {d.reporting_period || d.document_date_raw || "Period/date not stated"}</p><p className="text-xs text-muted-foreground">Latest activity: {new Date(d.updated_at).toLocaleString()} · Owner: {d.department_or_owner || "not recorded"}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Status tone={st.tone}>{st.text}</Status>
            {isStored(d.processing_status) && <Button size="sm" variant="ghost" onClick={() => void open(d.id)}>Original</Button>}
            {st.text === "Read" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void showOutputs(d.id, d.original_filename)}>View outputs</Button>}</div>
        </li>; })}</ul></div>}
  </section>;
}
