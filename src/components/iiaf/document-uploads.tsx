import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import catalogue from "@/data/upload-catalogue.json";
import { DataTable, Status } from "./ui";
import { useWorkspace } from "./workspace";
import { listDocuments, registerDocument, finalizeDocument, markDocumentFailed, retryDocument, getDocumentLink } from "@/lib/documents.functions";
import { ALLOWED_EXTENSIONS, STATUS_LABELS, UPLOAD_BUCKET, sha256Hex, validateSelection, type ProcessingStatus, type UploadModule } from "@/lib/upload-rules";

const EVIDENCE_FRAMEWORKS = ["NAAC", "NIRF", "QS", "THE", "UI GreenMetric", "Other / not stated"];
function categoriesFor(module: UploadModule) {
  if (module === "evidence") return EVIDENCE_FRAMEWORKS.map(f => ({ code: `EVID-${f.split(" ")[0].toUpperCase()}`, name: `Declared framework: ${f}` }));
  return catalogue[module === "institutional" ? "institutional" : "meeting"].categories;
}
function typesFor(module: UploadModule, category: string) {
  if (module === "evidence") return [];
  return catalogue[module === "institutional" ? "institutional" : "meeting"].documentTypes.filter(t => t.category === category);
}
const tone = (s: string) => s === "awaiting_processing" ? "teal" : s === "uploading" ? "neutral" : "danger";
const blank = { declared_purpose: "", department_or_owner: "", reporting_period: "", document_date_raw: "", document_version_or_status: "", language: "" };

export function DocumentUploads({ module, label }: { module: UploadModule; label: string }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const list = useServerFn(listDocuments); const register = useServerFn(registerDocument); const finalize = useServerFn(finalizeDocument);
  const fail = useServerFn(markDocumentFailed); const retry = useServerFn(retryDocument); const link = useServerFn(getDocumentLink);
  const key = ["documents", workspace.id, module];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => list({ data: { organizationId: workspace.id, module } }) });
  const [files, setFiles] = useState<File[]>([]); const [category, setCategory] = useState(""); const [docType, setDocType] = useState("UNKNOWN");
  const [meta, setMeta] = useState(blank); const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; stage: string; ok?: boolean }[]>([]);
  const retryInput = useRef<HTMLInputElement>(null); const [retryId, setRetryId] = useState<string | null>(null);
  const categories = categoriesFor(module); const types = typesFor(module, category);
  const selectionErrors = files.flatMap(f => validateSelection(f).map(e => `${f.name}: ${e}`));

  function stage(name: string, s: string, ok?: boolean) { setProgress(p => p.map(x => x.name === name ? { name, stage: s, ok } : x)); }
  async function store(id: string, storageKey: string, file: File) {
    const { error: upErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(storageKey, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) { await fail({ data: { id, reason: "Storage did not accept the file" } }); return "upload_failed"; }
    return (await finalize({ data: { id } })).status;
  }
  async function uploadAll() {
    if (!category || selectionErrors.length || !files.length) return;
    setBusy(true); setProgress(files.map(f => ({ name: f.name, stage: "Waiting" })));
    for (const file of files) {
      try {
        stage(file.name, "Fingerprinting");
        const sha256 = await sha256Hex(await file.arrayBuffer());
        stage(file.name, "Uploading");
        const reg = await register({ data: { organizationId: workspace.id, module, category, documentType: docType, filename: file.name, mime: file.type, size: file.size, sha256, meta } });
        const status = await store(reg.id, reg.storage_object_key, file);
        const dup = reg.duplicates.length ? ` · duplicate candidate of ${reg.duplicates.map(d => d.filename).join(", ")}` : "";
        stage(file.name, `${STATUS_LABELS[status as ProcessingStatus] ?? status}${dup}`, status === "awaiting_processing");
      } catch (e) { stage(file.name, `Upload Failed · ${e instanceof Error ? e.message : "unknown error"}`, false); }
    }
    await cache.invalidateQueries({ queryKey: key }); setBusy(false); setFiles([]);
  }
  async function retryWith(file: File) {
    if (!retryId) return; setBusy(true);
    try {
      const { storageKey } = await retry({ data: { id: retryId } });
      const status = await store(retryId, storageKey, file);
      if (status === "awaiting_processing") toast.success("Retry verified; file is stored."); else toast.error(`Retry ended as ${STATUS_LABELS[status as ProcessingStatus] ?? status}. A retry must use the original file.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Retry failed"); }
    finally { setRetryId(null); setBusy(false); await cache.invalidateQueries({ queryKey: key }); }
  }
  async function open(id: string) {
    try { const { url } = await link({ data: { id } }); window.open(url, "_blank", "noopener"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download denied"); }
  }

  const field = (k: keyof typeof blank, l: string, hint: string) => <div className="space-y-1"><Label htmlFor={`${module}-${k}`}>{l}</Label><Input id={`${module}-${k}`} placeholder={hint} value={meta[k]} onChange={e => setMeta({ ...meta, [k]: e.target.value })} /></div>;
  return <section className="mb-8 space-y-5" aria-label={`${label} uploads`}>
    {data?.canUpload ? <div className="space-y-4 border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">Upload {label.toLowerCase()}</h2><p className="text-xs text-muted-foreground">Up to 20 MB each · {ALLOWED_EXTENSIONS.join(", ")} · originals are stored unchanged in private storage</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1"><Label htmlFor={`${module}-category`}>Category (required)</Label>
          <select id={`${module}-category`} className="h-9 w-full border bg-background px-2 text-sm" value={category} onChange={e => { setCategory(e.target.value); setDocType("UNKNOWN"); }}>
            <option value="">Select a category</option>{categories.map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </select></div>
        <div className="space-y-1"><Label htmlFor={`${module}-type`}>Document type</Label>
          <select id={`${module}-type`} className="h-9 w-full border bg-background px-2 text-sm" value={docType} onChange={e => setDocType(e.target.value)} disabled={!types.length}>
            <option value="UNKNOWN">Unknown / not classified</option>{types.map(t => <option key={t.id} value={t.id}>{t.id} · {t.name}</option>)}
          </select></div>
        {field("reporting_period", "Reporting period", "e.g. 2025–26, only if stated")}
        {field("document_date_raw", "Document date as written", "Leave blank if absent")}
        {field("department_or_owner", "Department or owner", "Optional")}
        {field("declared_purpose", "Declared purpose", "Optional")}
        {field("document_version_or_status", "Version or status as stated", "e.g. Draft, Approved — only if explicit")}
        <div className="space-y-1"><Label htmlFor={`${module}-file`}>Files (required)</Label><Input id={`${module}-file`} type="file" multiple accept={ALLOWED_EXTENSIONS.map(e => `.${e}`).join(",")} onChange={e => setFiles([...(e.target.files ?? [])])} /></div>
      </div>
      {selectionErrors.length > 0 && <ul role="alert" className="list-disc space-y-1 border-l-4 border-destructive bg-destructive/5 p-3 pl-8 text-sm">{selectionErrors.map(e => <li key={e}>{e}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-3"><Button disabled={busy || !category || !files.length || selectionErrors.length > 0} onClick={() => void uploadAll()}><Upload /> {busy ? "Uploading…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}</Button>{!category && files.length > 0 && <span className="text-sm text-muted-foreground">Choose a category first.</span>}</div>
      {progress.length > 0 && <ul role="status" className="space-y-1 text-sm">{progress.map(p => <li key={p.name} className="flex flex-wrap gap-2"><span className="font-medium break-all">{p.name}</span><span className={p.ok === false ? "text-destructive" : "text-muted-foreground"}>{p.stage}</span></li>)}</ul>}
    </div> : data && <p className="border-l-4 border-border bg-muted p-3 text-sm">Your role in this workspace can view uploaded documents but cannot upload.</p>}
    <input ref={retryInput} type="file" className="hidden" aria-label="Choose original file for retry" onChange={e => { const f = e.target.files?.[0]; if (f) void retryWith(f); e.target.value = ""; }} />
    {error ? <p role="alert" className="text-sm text-destructive">Uploaded documents could not be loaded.</p> : isLoading ? <p className="text-sm text-muted-foreground">Loading uploaded documents…</p> :
      <DataTable caption={`Uploaded ${label.toLowerCase()} · ${data?.documents.length ?? 0} files`} columns={["Document", "Category / type", "Period / date", "Status", "Actions"]}
        rows={(data?.documents ?? []).map(d => [
          <div className="max-w-xs"><p className="break-all font-medium">{d.original_filename}</p><p className="mt-1 text-xs text-muted-foreground">{(d.file_size_bytes / 1024).toFixed(0)} KB · {d.detected_mime_type ?? "not verified"} · {new Date(d.created_at).toLocaleString()}</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">ID {d.id} · SHA-256 {d.sha256_hash.slice(0, 16)}…</p></div>,
          <div className="text-xs"><p>{d.category_code}</p><p className="text-muted-foreground">{d.document_type_id}</p></div>,
          <div className="text-xs"><p>{d.reporting_period ?? "Not stated"}</p><p className="text-muted-foreground">{d.document_date_raw ?? ""}</p></div>,
          <div className="space-y-1"><Status tone={tone(d.processing_status)}>{STATUS_LABELS[d.processing_status as ProcessingStatus] ?? d.processing_status}</Status>{d.duplicateOf.length > 0 && <p className="text-xs text-muted-foreground">Duplicate candidate: same content as {d.duplicateOf.join(", ")}</p>}{(d.validation_errors as string[]).map(e => <p key={e} className="max-w-xs text-xs text-destructive">{e}</p>)}<p className="text-xs text-muted-foreground">Extraction not started</p></div>,
          <div className="flex flex-wrap gap-2">{d.processing_status === "awaiting_processing" && <Button size="sm" variant="outline" onClick={() => void open(d.id)}><Download /> Download</Button>}{d.processing_status === "upload_failed" && d.uploader_id === data?.userId && data?.canUpload && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRetryId(d.id); retryInput.current?.click(); }}><RotateCcw /> Retry</Button>}</div>,
        ])} />}
  </section>;
}
