import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Pencil, Save, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviseOutput, improveOutputWriting, type OutputSet } from "@/lib/outputs.functions";
import type { GeneratedOutput } from "@/lib/output-contract";
import { savedPng } from "@/lib/artifact-download";
import { outputCsv, outputDocx, outputFileBase, outputHtml, outputText, outputWorkbook } from "@/lib/output-export";
import { saveBlob } from "@/lib/package-export";
import { OutputPreview } from "./output-preview";
import { Status } from "./ui";
import type { QualityResult } from "@/lib/output-quality";

export function SavedOutputCard({output:o,setId,source,onSaved,quality}:{output:GeneratedOutput;setId:string|undefined;source:string;onSaved:(set:OutputSet)=>void;quality?:QualityResult|undefined}){
  const revise=useServerFn(reviseOutput);const [editing,setEditing]=useState(false);const [body,setBody]=useState(o.body);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [url,setUrl]=useState("");
  const improve=useServerFn(improveOutputWriting);
  useEffect(()=>{let active=true;let objectUrl="";if(o.artifact)void savedPng(o).then(blob=>{objectUrl=URL.createObjectURL(blob);if(active)setUrl(objectUrl);}).catch(e=>setError(String(e)));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[o.artifact?.key]);
  async function save(){if(!setId)return;setBusy(true);setError("");try{onSaved(await revise({data:{setId,type:o.type,body}}));setEditing(false);}catch(e){setError(e instanceof Error?e.message:"Revision could not be saved.");}finally{setBusy(false);}}
  const base=outputFileBase(o,source);
  return <article className="flex flex-col border bg-background p-4" aria-label={`${o.name} saved output`}>
    <div className="flex items-start justify-between gap-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">{o.name}</p><div className="flex gap-1">{quality&&<Status tone={quality.status==="COMPLETE"?"success":quality.status==="BLOCKED"?"danger":"warning"}>Quality: {quality.status}</Status>}<Status tone="warning">Draft · review required</Status></div></div>
    <h3 className="mt-1 font-semibold">{o.title}</h3>
    {setId&&<p className="mt-1 break-all text-xs text-muted-foreground">Output ID {setId}:{o.type}{o.draft&&` · revision ${o.draft.revision}`}</p>}
    {error&&<p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {o.artifact&&url&&<img src={url} alt={`${o.title} — source-backed review creative`} className="mt-3 w-full"/>}
    {editing?<Textarea aria-label={`Edit ${o.name}`} className="mt-3 min-h-72" value={body} onChange={e=>setBody(e.target.value)}/>:<div className="mt-2 max-h-96 min-w-0 flex-1 overflow-auto"><OutputPreview output={o}/></div>}
    <p className="mt-3 text-xs text-muted-foreground">Source: {source} · {o.catalogue?.catalogueId??"Source review"}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {o.draft&&setId&&["news_article","newsletter","linkedin_article","annual_report","department_brochure"].includes(o.type)&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(!window.confirm("Use one paid Lovable AI request to improve this source-backed draft? It will save a new review revision."))return;setBusy(true);setError("");void improve({data:{setId,type:o.type}}).then(onSaved).catch(e=>setError(e instanceof Error?e.message:"AI writing failed; no draft saved.")).finally(()=>setBusy(false));}}><Sparkles/>{busy?"Writing…":"Improve writing · AI credits"}</Button>}
      {o.draft&&setId&&(editing?<><Button size="sm" disabled={busy} onClick={()=>void save()}><Save/>{busy?"Saving…":"Save new revision"}</Button><Button size="sm" variant="ghost" onClick={()=>setEditing(false)}><X/>Cancel</Button></>:<Button size="sm" variant="outline" onClick={()=>{setBody(o.body);setEditing(true);}}><Pencil/>Edit draft</Button>)}
      <Button size="sm" variant="outline" onClick={()=>void outputDocx(o,source).then(b=>saveBlob(b,`${base}.docx`))}><Download/>Word</Button>
      <Button size="sm" variant="ghost" onClick={()=>saveBlob(new Blob([outputText(o,source)],{type:"text/plain"}),`${base}.txt`)}><Download/>Text</Button>
      <Button size="sm" variant="ghost" onClick={()=>saveBlob(new Blob([outputHtml(o,source)],{type:"text/html"}),`${base}.html`)}><Download/>HTML</Button>
      <Button size="sm" variant="ghost" onClick={()=>saveBlob(new Blob([outputCsv(o)],{type:"text/csv"}),`${base}.csv`)}><Download/>CSV</Button>
      <Button size="sm" variant="ghost" onClick={()=>saveBlob(outputWorkbook(o,source),`${base}.xlsx`)}><Download/>Excel</Button>
      {o.artifact&&<Button size="sm" variant="outline" onClick={()=>void savedPng(o).then(b=>saveBlob(b,`${base}.png`)).catch(e=>setError(String(e)))}><Download/>PNG</Button>}
    </div>
  </article>;
}