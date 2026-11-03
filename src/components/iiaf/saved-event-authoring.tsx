import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveEventOutputs, reopenEventOutputs } from "@/lib/authored-output.functions";
import { eventContent } from "@/lib/source-authored";
import { renderDraftImage, type LocalDraft } from "@/lib/local-artifacts";
import { savedPng } from "@/lib/artifact-download";
import { outputDocx, outputText } from "@/lib/output-export";
import { saveBlob } from "@/lib/package-export";
import type { Lineage } from "@/lib/lineage.functions";

export function SavedEventAuthoring({ lineage }: { lineage: Lineage }) {
  const save = useServerFn(saveEventOutputs); const reopen = useServerFn(reopenEventOutputs);
  const [set,setSet] = useState<Awaited<ReturnType<typeof reopenEventOutputs>>>(null);
  const [url,setUrl] = useState(""); const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const content = eventContent(lineage.segments,lineage.segments.map(s=>s.id));
  useEffect(()=>{ void reopen({data:{documentId:lineage.document.id}}).then(setSet).catch(e=>setError(String(e))); },[lineage.document.id]);
  useEffect(()=>{let active=true;let objectUrl="";const image=set?.outputs.find(o=>o.artifact); if(image) void savedPng(image).then(blob=>{objectUrl=URL.createObjectURL(blob);if(active)setUrl(objectUrl);}).catch(e=>setError(String(e)));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[set]);
  if(!content) return null;
  async function generate() {
    if(!content || !lineage.job)return;
    setBusy(true);setError("");
    try {
      const field=(role:string)=>content.fields.find(f=>f.role===role)?.value;
      const draft:LocalDraft={type:"press_release",catalogueId:"OUT-009",title:field("title")??"Event announcement",body:"",citations:[],missing:[],review:"human_review_required",release:"not_authorized",persisted:false,classification:lineage.outputRecord?(/"classification":"DEMO"/.test(JSON.stringify(lineage.outputRecord.outputs))?"DEMO":"unverified"):"unverified",originalHash:lineage.document.sha256_hash,parserVersion:lineage.job.processor_version??"",cautions:content.cautions};
      const text=[field("subject"),field("date")?`Printed date: ${field("date")}`:null,field("venue"),field("organizer")].filter(Boolean).join("\n\n");
      const blob=await renderDraftImage(draft,text,true);
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
      await save({data:{documentId:lineage.document.id,png:btoa(binary)}});
      setSet(await reopen({data:{documentId:lineage.document.id}}));
    }catch(e){setError(e instanceof Error?e.message:"Saving failed.");}finally{setBusy(false);}
  }
  return <section className="my-5 space-y-3" aria-label="Saved news article and image">
    <div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto font-semibold">News article & image</h3><Button disabled={busy} onClick={()=>void generate()}><Save/>Generate & save article + PNG</Button><Button variant="outline" aria-label="Reopen saved article and PNG" onClick={()=>void reopen({data:{documentId:lineage.document.id}}).then(setSet).catch(e=>setError(String(e)))}><RefreshCw/></Button></div>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {busy&&<p role="status">Rendering and saving source-backed drafts…</p>}
    {set&&<><p className="break-all text-xs text-muted-foreground">Saved set {set.setId} · {set.createdAt} · DEMO / unverified draft · Human review required</p><div className="grid gap-4 lg:grid-cols-2">{set.outputs.map(o=><article key={o.type} className="border p-4"><h4 className="font-semibold">{o.name}: {o.title}</h4>{o.artifact?url&&<img src={url} alt={`${o.title} — saved draft creative`} className="mt-3 w-full"/>:<p className="mt-3 whitespace-pre-wrap text-sm">{o.body}</p>}<p className="mt-3 text-xs text-muted-foreground">{o.authored?.cautions.join(" ")}</p><details className="mt-3 text-xs"><summary>Saved source references</summary><p className="break-all">Document {o.manifest?.documentId} · job {o.manifest?.jobId} · {o.manifest?.originalHash}</p>{o.authored?.fields.map(f=><p key={f.role} className="mt-2">{f.role}: {f.value} · {f.citations.map(c=>`${c.segmentId} / ${c.locatorKey}`).join(", ")}</p>)}</details><div className="mt-3 flex gap-2">{o.artifact?<Button variant="outline" onClick={()=>void savedPng(o).then(b=>saveBlob(b,"event-news-saved.png")).catch(e=>setError(String(e)))}><Download/>Download saved PNG</Button>:<><Button variant="outline" onClick={()=>saveBlob(new Blob([outputText(o,lineage.document.original_filename)],{type:"text/plain"}),"news-article-saved.txt")}><Download/>Article text</Button><Button variant="outline" onClick={()=>void outputDocx(o,lineage.document.original_filename).then(b=>saveBlob(b,"news-article-saved.docx"))}><Download/>Article Word</Button></>}</div></article>)}</div></>}
  </section>;
}