import { supabase } from "@/integrations/supabase/client";
import type { GeneratedOutput } from "./output-contract";

export async function savedPng(output: GeneratedOutput): Promise<Blob> {
  const a = output.artifact;
  if (!a) throw new Error("No saved PNG exists.");
  const {data: rows,error:readError}=await supabase.from("document_outputs").select("outputs").eq("document_id",output.manifest?.documentId??"").eq("model","none:source-event-1+canvas-1");
  if(readError || !rows?.some(row=>JSON.stringify(row.outputs).includes(a.sha256))) throw new Error("This artifact no longer has a current, accessible saved output.");
  const { data, error } = await supabase.storage.from(a.bucket).download(a.key);
  if (error || !data) throw new Error("Saved PNG could not be downloaded.");
  const bytes = await data.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");
  if (hash !== a.sha256 || bytes.byteLength !== a.size) throw new Error("Saved image integrity check failed.");
  return new Blob([bytes],{type:"image/png"});
}