import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CONTRACT_VERSION, repairOutputSet } from "./output-contract";
import { latestSource } from "./document-source";
export type { GeneratedOutput } from "./output-contract";
import type { GeneratedOutput } from "./output-contract";
import { confirmedCacheWinner, storedOutputSetSchema } from "./output-cache";
import { selectedDrafts, selectionKeySuffix, selectionOutcomes } from "./output-selection";

export type OutputSet = { outputs: GeneratedOutput[]; skipped: { name: string; reason: string }[]; limitations: string[]; sourceVersion: string; segmentCount: number; createdAt: string; cached: boolean; setId?: string; outcomes?: ReturnType<typeof selectionOutcomes> };

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const stored = storedOutputSetSchema;

export const getOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("document_outputs").select("id,outputs,source_version,created_at").eq("document_id", data.documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error("Outputs could not be read.");
    if (!row) return null;
    const source = await latestSource(context.supabase, data.documentId);
    if (!source) throw new Error("The latest document reading is unavailable; saved drafts were not presented as current.");
    const set = stored.parse(row.outputs);
    return { ...set, setId: row.id, limitations: [...set.limitations, ...(source.job.error ? [source.job.error] : [])], sourceVersion: row.source_version, createdAt: row.created_at, cached: true };
  });

/** No-credit repair: reuse historical drafts and stored text, persist qualification/lineage in the existing JSON cache. */
export const generateOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid(), requested: z.string().max(40).array().max(40).default([]), diagnostic: z.boolean().default(false) }))
  .handler(async ({ context, data }): Promise<OutputSet> => {
    const trace = (stage: string, result: unknown) => { if (data.diagnostic) console.info("IIAF_CONVERSION_TRACE", JSON.stringify({ stage, documentId: data.documentId, result })); };
    trace("generateOutputs.input", { requested: data.requested });
    const { data: doc } = await context.supabase.from("uploaded_documents").select("id,organization_id,sha256_hash,original_filename,declared_purpose").eq("id", data.documentId).maybeSingle();
    if (!doc) throw new Error("Document not found.");
    const { data: may } = await context.supabase.rpc("may_upload", { _org: doc.organization_id });
    if (!may) throw new Error("Your role cannot generate outputs.");
    const sourceResult = await latestSource(context.supabase, doc.id);
    if (!sourceResult) throw new Error("No stored text could be read; processing was not rerun.");
    const { lines, version, job } = sourceResult;
    trace("latestSource", { status: "PASS", jobId: job.id, segmentCount: lines.length, version, locatorSample: lines.slice(0, 2).map(l => l.locator_key) });
    const source = lines.map(l => `[${l.locator_key}] ${l.content}`).join("\n");
    const { data: organization } = await context.supabase.from("organizations").select("name").eq("id", doc.organization_id).single();
    const classification = /synthetic|demo|fictional|dummy|काल्पनिक|नमूना/i.test(`${organization?.name ?? ""} ${doc.original_filename} ${doc.declared_purpose} ${source}`) ? "DEMO" as const : "unverified" as const;
    const hash = await sha256(`${CONTRACT_VERSION}\n${job.id}\n${classification}\n${source}\n${JSON.stringify(lines.map(l => l.locator))}${selectionKeySuffix(data.requested)}`);
    const { data: cached, error: cacheError } = await context.supabase.from("document_outputs").select("id,outputs,source_version,created_at").eq("document_id", doc.id).eq("source_hash", hash).maybeSingle();
    if (cacheError) throw new Error("Saved output cache could not be read.");
    if (cached) { const set = stored.parse(cached.outputs); return { ...set, setId: cached.id, outcomes: selectionOutcomes(data.requested, set.outputs), sourceVersion: cached.source_version, createdAt: cached.created_at, cached: true }; }

    const originalTextHash = await sha256(source);
    const { data: previous, error: previousError } = await context.supabase.from("document_outputs").select("outputs").eq("document_id", doc.id).eq("source_hash", originalTextHash).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (previousError) throw new Error("Existing outputs could not be read.");
    const repaired = repairOutputSet(previous ? stored.parse(previous.outputs).outputs : [], lines, { documentId: doc.id, jobId: job.id, originalHash: doc.sha256_hash, parserVersion: version, contractVersion: CONTRACT_VERSION, classification, approval: "draft", locators: lines.map(l => l.locator_key), verifiedCoverage: false });
    const set = { ...repaired, outputs: selectedDrafts(repaired.outputs, data.requested) };
    trace("repairOutputSet -> selectedDrafts", { status: "PASS", outputs: set.outputs.map(o => ({ type: o.type, catalogueId: o.catalogue?.catalogueId, bodyCharacters: o.body.length })), outcomes: selectionOutcomes(data.requested, set.outputs) });
    const { data: saved, error } = await context.supabase.from("document_outputs").upsert({ organization_id: doc.organization_id, document_id: doc.id, source_version: version, source_hash: hash, model: "none:stored-source-contract", outputs: JSON.parse(JSON.stringify(set)) }, { onConflict: "document_id,source_hash", ignoreDuplicates: true }).select("id,created_at").maybeSingle();
    trace("document_outputs.upsert", { status: error ? "FAILED" : "PASS", response: saved, error: error ? { message: error.message, code: error.code } : null });
    if (error) throw new Error(`Outputs were not saved: ${error.message}`);
    if (!saved) {
      const { data: existing, error: readbackError } = await context.supabase.from("document_outputs").select("id,outputs,source_version,created_at").eq("document_id", doc.id).eq("source_hash", hash).maybeSingle();
      if (readbackError) throw new Error("Saved output winner could not be read.");
      if (!existing) throw new Error("Saved output winner could not be read; no unsaved output was returned.");
      const winner = confirmedCacheWinner(set, existing, version);
      return { ...winner, setId: existing.id, outcomes: selectionOutcomes(data.requested, winner.outputs) };
    }
    return { ...set, setId: saved.id, outcomes: selectionOutcomes(data.requested, set.outputs), sourceVersion: version, createdAt: saved.created_at, cached: false };
  });
