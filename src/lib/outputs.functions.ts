import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CONTRACT_VERSION, repairOutputSet } from "./output-contract";
import { latestSource } from "./document-source";
export type { GeneratedOutput } from "./output-contract";
import type { GeneratedOutput } from "./output-contract";
import { confirmedCacheWinner, storedOutputSetSchema } from "./output-cache";

export type OutputSet = { outputs: GeneratedOutput[]; skipped: { name: string; reason: string }[]; limitations: string[]; sourceVersion: string; segmentCount: number; createdAt: string; cached: boolean };

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const stored = storedOutputSetSchema;

export const getOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("document_outputs").select("outputs,source_version,created_at").eq("document_id", data.documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error("Outputs could not be read.");
    if (!row) return null;
    const source = await latestSource(context.supabase, data.documentId);
    if (!source) throw new Error("The latest document reading is unavailable; saved drafts were not presented as current.");
    const set = stored.parse(row.outputs);
    return { ...set, limitations: [...set.limitations, ...(source.job.error ? [source.job.error] : [])], sourceVersion: row.source_version, createdAt: row.created_at, cached: true };
  });

/** No-credit repair: reuse historical drafts and stored text, persist qualification/lineage in the existing JSON cache. */
export const generateOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }): Promise<OutputSet> => {
    const { data: doc } = await context.supabase.from("uploaded_documents").select("id,organization_id,sha256_hash,original_filename,declared_purpose").eq("id", data.documentId).maybeSingle();
    if (!doc) throw new Error("Document not found.");
    const { data: may } = await context.supabase.rpc("may_upload", { _org: doc.organization_id });
    if (!may) throw new Error("Your role cannot generate outputs.");
    const sourceResult = await latestSource(context.supabase, doc.id);
    if (!sourceResult) throw new Error("No stored text could be read; processing was not rerun.");
    const { lines, version, job } = sourceResult;
    const source = lines.map(l => `[${l.locator_key}] ${l.content}`).join("\n");
    const { data: organization } = await context.supabase.from("organizations").select("name").eq("id", doc.organization_id).single();
    const classification = /synthetic|demo|fictional|dummy|काल्पनिक|नमूना/i.test(`${organization?.name ?? ""} ${doc.original_filename} ${doc.declared_purpose} ${source}`) ? "DEMO" as const : "unverified" as const;
    const hash = await sha256(`${CONTRACT_VERSION}\n${job.id}\n${classification}\n${source}\n${JSON.stringify(lines.map(l => l.locator))}`);
    const { data: cached, error: cacheError } = await context.supabase.from("document_outputs").select("outputs,source_version,created_at").eq("document_id", doc.id).eq("source_hash", hash).maybeSingle();
    if (cacheError) throw new Error("Saved output cache could not be read.");
    if (cached) return { ...stored.parse(cached.outputs), sourceVersion: cached.source_version, createdAt: cached.created_at, cached: true };

    const originalTextHash = await sha256(source);
    const { data: previous, error: previousError } = await context.supabase.from("document_outputs").select("outputs").eq("document_id", doc.id).eq("source_hash", originalTextHash).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (previousError) throw new Error("Existing outputs could not be read.");
    const set = repairOutputSet(previous ? stored.parse(previous.outputs).outputs : [], lines, { documentId: doc.id, jobId: job.id, originalHash: doc.sha256_hash, parserVersion: version, contractVersion: CONTRACT_VERSION, classification, approval: "draft", locators: lines.map(l => l.locator_key), verifiedCoverage: false });
    const { data: saved, error } = await context.supabase.from("document_outputs").upsert({ organization_id: doc.organization_id, document_id: doc.id, source_version: version, source_hash: hash, model: "none:stored-source-contract", outputs: JSON.parse(JSON.stringify(set)) }, { onConflict: "document_id,source_hash", ignoreDuplicates: true }).select("created_at").maybeSingle();
    if (error) throw new Error("Repaired outputs could not be saved.");
    if (!saved) {
      const { data: existing, error: readbackError } = await context.supabase.from("document_outputs").select("outputs,source_version,created_at").eq("document_id", doc.id).eq("source_hash", hash).maybeSingle();
      if (readbackError) throw new Error("Saved output winner could not be read.");
      return confirmedCacheWinner(set, existing, version);
    }
    return { ...set, sourceVersion: version, createdAt: saved.created_at, cached: false };
  });
