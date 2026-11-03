import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CONTRACT_VERSION, repairOutputSet } from "./output-contract";
import { latestSource } from "./document-source";
export type { GeneratedOutput } from "./output-contract";
import type { GeneratedOutput } from "./output-contract";
import { confirmedCacheWinner, storedOutputSetSchema } from "./output-cache";
import { selectedDrafts, selectionKeySuffix, selectionOutcomes } from "./output-selection";
import { eventContent, selectedEventOutputs } from "./source-authored";
import { generateCatalogue } from "./catalogue-handlers";
import { writeCatalogueDraft } from "./catalogue-writing.server";
import { assessSet, type QualityResult } from "./output-quality";

export type OutputSet = { outputs: GeneratedOutput[]; skipped: { name: string; reason: string }[]; limitations: string[]; sourceVersion: string; segmentCount: number; createdAt: string; cached: boolean; setId?: string; outcomes?: ReturnType<typeof selectionOutcomes>; quality?: Record<string, QualityResult> };

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const stored = storedOutputSetSchema;

export const getOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.from("document_outputs").select("id,outputs,source_version,created_at").eq("document_id", data.documentId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Outputs could not be read.");
    const row=rows?.find(r=>stored.parse(r.outputs).outputs.some(o=>o.draft))??rows?.[0];
    if (!row) return null;
    const source = await latestSource(context.supabase, data.documentId);
    if (!source) throw new Error("The latest document reading is unavailable; saved drafts were not presented as current.");
    const set = stored.parse(row.outputs);
    const combined=new Map(set.outputs.map(o=>[o.type,{...o,persistedSetId:row.id}]));
    for(const candidate of rows??[])for(const o of stored.parse(candidate.outputs).outputs){if(!combined.has(o.type))combined.set(o.type,{...o,persistedSetId:candidate.id});}
    const outputs=[...combined.values()];
    return { ...set, outputs, setId: row.id, limitations: [...set.limitations, ...(source.job.error ? [source.job.error] : [])], sourceVersion: row.source_version, createdAt: row.created_at, cached: true, quality: assessSet(outputs, set.skipped, { lines: source.lines, segmentIds: source.segmentIds }) };
  });

/** No-credit repair: reuse historical drafts and stored text, persist qualification/lineage in the existing JSON cache. */
export const generateOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid(), requested: z.string().max(40).array().max(40).default([]) }))
  .handler(async ({ context, data }): Promise<OutputSet> => {
    const { data: doc } = await context.supabase.from("uploaded_documents").select("id,organization_id,sha256_hash,original_filename,declared_purpose,reporting_period").eq("id", data.documentId).maybeSingle();
    if (!doc) throw new Error("Document not found.");
    const { data: may } = await context.supabase.rpc("may_upload", { _org: doc.organization_id });
    if (!may) throw new Error("Your role cannot generate outputs.");
    const sourceResult = await latestSource(context.supabase, doc.id);
    if (!sourceResult) throw new Error("No stored text could be read; processing was not rerun.");
    const { lines, version, job } = sourceResult;
    const source = lines.map(l => `[${l.locator_key}] ${l.content}`).join("\n");
    const { data: organization } = await context.supabase.from("organizations").select("name").eq("id", doc.organization_id).single();
    const classification = /synthetic|demo|fictional|dummy|काल्पनिक|नमूना/i.test(`${organization?.name ?? ""} ${doc.original_filename} ${doc.declared_purpose} ${source}`) ? "DEMO" as const : "unverified" as const;
    const authored = eventContent(lines, sourceResult.segmentIds);
    const authoredSelection = authored && data.requested.some(id => ["OUT-008", "OUT-009"].includes(id));
    const hash = await sha256(`${CONTRACT_VERSION}\n${job.id}\n${classification}\n${source}\n${JSON.stringify(lines.map(l => l.locator))}${selectionKeySuffix(data.requested)}\ncatalogue-dispatch-1`);
    const { data: cached, error: cacheError } = await context.supabase.from("document_outputs").select("id,outputs,source_version,created_at").eq("document_id", doc.id).eq("source_hash", hash).maybeSingle();
    if (cacheError) throw new Error("Saved output cache could not be read.");
    if (cached) { const set = stored.parse(cached.outputs); return { ...set, setId: cached.id, outcomes: selectionOutcomes(data.requested, set.outputs), sourceVersion: cached.source_version, createdAt: cached.created_at, cached: true }; }

    const originalTextHash = await sha256(source);
    const { data: previous, error: previousError } = await context.supabase.from("document_outputs").select("outputs").eq("document_id", doc.id).eq("source_hash", originalTextHash).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (previousError) throw new Error("Existing outputs could not be read.");
    const repaired = repairOutputSet(previous ? stored.parse(previous.outputs).outputs : [], lines, { documentId: doc.id, jobId: job.id, originalHash: doc.sha256_hash, parserVersion: version, contractVersion: CONTRACT_VERSION, classification, approval: "draft", locators: lines.map(l => l.locator_key), verifiedCoverage: false });
    const {data: company} = await context.supabase.rpc("is_operator",{_roles:["super_admin","authorized_operator","internal_reviewer"]});
    const generated = generateCatalogue({lines,segmentIds:sourceResult.segmentIds,manifest:repaired.manifest,company:!!company,period:doc.reporting_period},data.requested);
    const set = stored.parse({ ...repaired, skipped:generated.skipped, outputs: [...selectedDrafts(repaired.outputs, data.requested).filter(o=>!generated.outputs.some(n=>n.type===o.type)), ...generated.outputs] });
    const {data:savedId,error}=await context.supabase.rpc("save_catalogue_draft",{_doc:doc.id,_version:version,_hash:hash,_payload:JSON.parse(JSON.stringify(set))});
    if (error) throw new Error(`Outputs were not saved: ${error.message}`);
    const {data:saved,error:savedError}=await context.supabase.from("document_outputs").select("id,created_at").eq("id",savedId??"").maybeSingle();
    if(savedError) throw new Error("Saved output readback failed.");
    if (!saved) {
      const { data: existing, error: readbackError } = await context.supabase.from("document_outputs").select("id,outputs,source_version,created_at").eq("document_id", doc.id).eq("source_hash", hash).maybeSingle();
      if (readbackError) throw new Error("Saved output winner could not be read.");
      if (!existing) throw new Error("Saved output winner could not be read; no unsaved output was returned.");
      const winner = confirmedCacheWinner(set, existing, version);
      return { ...winner, setId: existing.id, outcomes: selectionOutcomes(data.requested, winner.outputs) };
    }
    return { ...set, setId: saved.id, outcomes: selectionOutcomes(data.requested, set.outputs), sourceVersion: version, createdAt: saved.created_at, cached: false };
  });

/** Individual revisions append a new set; previous content and source records are never updated. */
export const reviseOutput = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator(z.object({setId:z.string().uuid(),type:z.string(),body:z.string().min(1).max(200000)}))
  .handler(async({context,data})=>{
    const {data:row}=await context.supabase.from("document_outputs").select("document_id,source_version,outputs").eq("id",data.setId).single();
    if(!row)throw new Error("Saved output is unavailable.");
    const set=stored.parse(row.outputs);const output=set.outputs.find(o=>o.type===data.type);
    if(!output?.draft)throw new Error("This historical or structured output cannot be edited through the catalogue draft editor.");
    const draft=output.draft;
    const next=stored.parse({...set,outputs:set.outputs.map(o=>o.type===data.type?{...o,body:data.body,draft:{...draft,revision:draft.revision+1,parentSetId:data.setId,edited:true,cautions:[...draft.cautions,"Manual editorial revision; factual review is still required."]}}:o)});
    const hash=await sha256(JSON.stringify(next));
    const {data:id,error}=await context.supabase.rpc("save_catalogue_draft",{_doc:row.document_id,_version:row.source_version,_hash:hash,_payload:JSON.parse(JSON.stringify(next))});
    if(error)throw new Error(`Revision not saved: ${error.message}`);
    const {data:saved}=await context.supabase.from("document_outputs").select("id,outputs,created_at,source_version").eq("id",id??"").single();
    if(!saved)throw new Error("Revision readback failed.");
    return {...stored.parse(saved.outputs),setId:saved.id,createdAt:saved.created_at,sourceVersion:saved.source_version,cached:false};
  });

export const improveOutputWriting=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator(z.object({setId:z.string().uuid(),type:z.string()}))
 .handler(async({context,data})=>{
   const {data:row}=await context.supabase.from("document_outputs").select("document_id,outputs,source_version").eq("id",data.setId).single();
   if(!row)throw new Error("Saved draft not accessible.");
   const {data:doc}=await context.supabase.from("uploaded_documents").select("organization_id").eq("id",row.document_id).single();
   if(!doc)throw new Error("Source not accessible.");
   const {data:may}=await context.supabase.rpc("may_upload",{_org:doc.organization_id});if(!may)throw new Error("Your role cannot author outputs.");
   const set=stored.parse(row.outputs),output=set.outputs.find(o=>o.type===data.type);
   if(!output?.draft||!["news_article","newsletter","linkedin_article","annual_report","department_brochure","event_publicity","social_calendar"].includes(output.type))throw new Error("This output does not use long-form AI writing.");
   const source=await latestSource(context.supabase,row.document_id);if(!source||source.job.id!==output.manifest?.jobId)throw new Error("Source changed; generate a current draft before writing.");
   const key=process.env["LOVABLE_API_KEY"];if(!key)throw new Error("Lovable AI server configuration is missing; no call was made.");
   const written=await writeCatalogueDraft(output,key);
   const draft=output.draft;
   const next=stored.parse({...set,outputs:set.outputs.map(o=>o.type===data.type?{...o,body:written.body,draft:{...draft,revision:draft.revision+1,parentSetId:data.setId,edited:true,cautions:[...draft.cautions,"AI-authored editorial draft; source/factual review required before use."]}}:o)});
   const hash=await sha256(JSON.stringify(next));const {data:id,error}=await context.supabase.rpc("save_catalogue_draft",{_doc:row.document_id,_version:row.source_version,_hash:hash,_payload:JSON.parse(JSON.stringify(next))});
   if(error)throw new Error(`AI draft not saved: ${error.message}`);
   const {data:saved}=await context.supabase.from("document_outputs").select("id,outputs,created_at").eq("id",id??"").single();if(!saved)throw new Error("AI draft save readback failed.");
   return {...stored.parse(saved.outputs),setId:saved.id,createdAt:saved.created_at,sourceVersion:row.source_version,cached:false};
 });
