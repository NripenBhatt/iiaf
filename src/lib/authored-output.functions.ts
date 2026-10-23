import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { latestSource } from "./document-source";
import { CONTRACT_VERSION, generatedOutputSchema } from "./output-contract";
import { authoredOutputs, eventContent } from "./source-authored";
import { storedOutputSetSchema } from "./output-cache";

export const saveEventOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid(), png: z.string().max(7000000) }))
  .handler(async ({ context, data }) => {
    const { data: doc } = await context.supabase.from("uploaded_documents").select("id,organization_id,sha256_hash,original_filename").eq("id", data.documentId).maybeSingle();
    if (!doc) throw new Error("Source document is unavailable.");
    const { data: may } = await context.supabase.rpc("may_upload", { _org: doc.organization_id });
    if (!may) throw new Error("Your role cannot save outputs.");
    const source = await latestSource(context.supabase, doc.id);
    if (!source) throw new Error("The latest saved reading is unavailable.");
    const authored = eventContent(source.lines, source.segmentIds);
    if (!authored) throw new Error("The saved source does not support this event-writing contract.");
    const binary = atob(data.png); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    if (bytes.length < 32 || bytes.length > 5000000 || ![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) || view.getUint32(16) !== 1080 || view.getUint32(20) !== 1080) throw new Error("A valid 1080 × 1080 PNG is required.");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2,"0")).join("");
    const key = `${doc.organization_id}/${doc.id}/outputs/${source.job.id}/${hash}.png`;
    const { data: organization } = await context.supabase.from("organizations").select("name").eq("id", doc.organization_id).single();
    const classification = /synthetic|demo|fictional|dummy/i.test(`${organization?.name} ${doc.original_filename}`) ? "DEMO" as const : "unverified" as const;
    const manifest = { documentId: doc.id, jobId: source.job.id, originalHash: doc.sha256_hash, parserVersion: source.version, contractVersion: CONTRACT_VERSION, classification, approval: "draft" as const, locators: source.lines.map(l => l.locator_key), verifiedCoverage: false as const };
    const article = generatedOutputSchema.parse(authoredOutputs(authored, manifest));
    const image = generatedOutputSchema.parse({ ...article, type: "image_creative", name: "Event news creative", artifact: { bucket: "institution-documents", key, sha256: hash, size: bytes.length, mimeType: "image/png", width:1080, height:1080, renderer:"iiaf-canvas-1" }, catalogue: { ...article.catalogue, catalogueId: "OUT-009" }, contract: { ...article.contract, mimeType:"image/png", dimensions:{width:1080,height:1080} } });
    const set = storedOutputSetSchema.parse({ outputs:[article,image], skipped:[], limitations:authored.cautions, segmentCount:source.lines.length, qualification:[], manifest, contractVersion:CONTRACT_VERSION });
    const cacheHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(set))))].map(b => b.toString(16).padStart(2,"0")).join("");
    const { error: uploadError } = await context.supabase.storage.from("institution-documents").upload(key, bytes, { contentType:"image/png", upsert:false });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw new Error(`PNG could not be stored: ${uploadError.message}`);
    const { error: saveError } = await context.supabase.from("document_outputs").upsert({ organization_id:doc.organization_id, document_id:doc.id, source_version:source.version, source_hash:cacheHash, model:"none:source-event-1+canvas-1", outputs:JSON.parse(JSON.stringify(set)) }, {onConflict:"document_id,source_hash",ignoreDuplicates:true});
    if (saveError) throw new Error(`Outputs were not saved: ${saveError.message}`);
    const { data: saved, error: readError } = await context.supabase.from("document_outputs").select("id,outputs,created_at").eq("document_id",doc.id).eq("source_hash",cacheHash).single();
    if (readError || !saved) throw new Error("Saved output readback failed.");
    const readback = storedOutputSetSchema.parse(saved.outputs);
    if (JSON.stringify(readback) !== JSON.stringify(set)) throw new Error("Stored winner differs from the generated content.");
    return { ...readback, setId:saved.id, createdAt:saved.created_at };
  });

export const reopenEventOutputs = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId:z.string().uuid() }))
  .handler(async ({context,data}) => {
    const {data:rows,error} = await context.supabase.from("document_outputs").select("id,outputs,created_at").eq("document_id",data.documentId).eq("model","none:source-event-1+canvas-1").order("created_at",{ascending:false}).limit(1);
    if(error) throw new Error("Saved event outputs could not be read.");
    const row=rows?.[0]; return row ? {...storedOutputSetSchema.parse(row.outputs),setId:row.id,createdAt:row.created_at}:null;
  });