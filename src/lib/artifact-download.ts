import { supabase } from "@/integrations/supabase/client";
import type { GeneratedOutput } from "./output-contract";
import { storedOutputSetSchema } from "./output-cache";

export async function savedPng(output: GeneratedOutput): Promise<Blob> {
  const a = output.artifact;
  if (!a) throw new Error("No saved PNG exists.");
  const {data: rows,error:readError}=await supabase.from("document_outputs").select("outputs").eq("document_id",output.manifest?.documentId??"");
  if(readError || !rows?.some(row=>{const parsed=storedOutputSetSchema.safeParse(row.outputs);return parsed.success&&parsed.data.outputs.some(o=>o.artifact?.key===a.key&&o.artifact.sha256===a.sha256&&o.manifest?.jobId===output.manifest?.jobId);})) throw new Error("This artifact no longer has a current, accessible saved output.");
  const { data, error } = await supabase.storage.from(a.bucket).download(a.key);
  if (error || !data) throw new Error("Saved PNG could not be downloaded.");
  const bytes = await data.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");
  if (hash !== a.sha256 || bytes.byteLength !== a.size) throw new Error("Saved image integrity check failed.");
  return new Blob([bytes],{type:"image/png"});
}