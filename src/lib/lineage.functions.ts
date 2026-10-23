import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { archiveReconciliation, contactCandidates } from "./structured-records";
import { sourceTables } from "./output-contract";
import { storedOutputSetSchema } from "./output-cache";

export type Lineage = Awaited<ReturnType<typeof readLineage>>;

/** Read-only readback of what is actually stored for one document, under the caller's RLS. */
async function readLineage(supabase: SupabaseClient<Database>, documentId: string) {
  const { data: doc, error } = await supabase.from("uploaded_documents").select("id,organization_id,original_filename,file_extension,sha256_hash,reporting_period,document_date_raw,processing_status,module").eq("id", documentId).maybeSingle();
  if (error || !doc) throw new Error("Document not found or not accessible.");
  const { data: job, error: jobError } = await supabase.from("document_processing_jobs").select("id,state,processor,processor_version,segment_count,fact_count,started_at").eq("document_id", documentId).order("started_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (jobError) throw new Error("Extraction run could not be read.");
  async function pages<T>(read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
    const rows: T[] = [];
    for (let offset = 0; offset < 50000; offset += 500) {
      const result = await read(offset);
      if (result.error) throw new Error("Structured readback could not be completed; no partial export was returned.");
      rows.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 500) return rows;
    }
    throw new Error("Structured readback exceeds the bounded export limit; narrower scope is required.");
  }
  const segments = job ? await pages(offset => supabase.from("document_segments").select("id,job_id,seq,locator_key,locator,content,method,method_version").eq("document_id", documentId).eq("job_id", job.id).order("seq").order("id").range(offset, offset + 499)) : [];
  if (job && segments.length !== job.segment_count) throw new Error("Extraction archive count differs from the saved run; reconciliation is incomplete.");
  const methodCounts: Record<string, number> = {};
  for (const segment of segments) methodCounts[segment.method] = (methodCounts[segment.method] ?? 0) + 1;
  const facts = await pages(offset => supabase.from("proposed_facts").select("id,source_label,canonical_field,extracted_value,reviewed_value,state,locator_key,locator,integrity,segment_id,created_at").eq("document_id", documentId).eq("organization_id", doc.organization_id).order("created_at").order("id").range(offset, offset + 499));
  const ids = [documentId, ...facts.map(f => f.id)];
  const relationshipMap = new Map<string, Database["public"]["Tables"]["relationships"]["Row"]>();
  const reviews: Database["public"]["Tables"]["fact_reviews"]["Row"][] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    const rels = await pages(offset => supabase.from("relationships").select("*").eq("organization_id", doc.organization_id).or(`source_id.in.(${chunk.join(",")}),target_id.in.(${chunk.join(",")})`).order("created_at").order("id").range(offset, offset + 499));
    for (const rel of rels) relationshipMap.set(rel.id, rel);
    const factIds = chunk.filter(id => id !== documentId);
    if (factIds.length) reviews.push(...await pages(offset => supabase.from("fact_reviews").select("*").eq("organization_id", doc.organization_id).in("fact_id", factIds).order("created_at").order("id").range(offset, offset + 499)));
  }
  const outputRecords = await pages(offset => supabase.from("document_outputs").select("id,created_at,phase2_quarantined,source_version,source_hash,outputs").eq("document_id", documentId).eq("organization_id", doc.organization_id).order("created_at", { ascending: false }).order("id").range(offset, offset + 499));
  const contacts = contactCandidates(documentId, doc.original_filename, segments);
  const reconciliation = archiveReconciliation(segments, job?.segment_count ?? 0, facts, contacts);
  const newest = outputRecords[0];
  const parsed = newest ? storedOutputSetSchema.safeParse(newest.outputs) : null;
  return { document: doc, job: job ?? null, methodCounts, segments, tables: sourceTables(segments), contacts, reconciliation, facts, relationships: [...relationshipMap.values()], reviews, reviewCount: reviews.length, outputRecords, outputRecord: newest ?? null, generatedOutputCount: parsed?.success ? parsed.data.outputs.length : 0, outputReadbackStatus: newest ? parsed?.success ? "schema_validated" : "invalid_saved_contract" : "none" };
}

export const getLineage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(({ context, data }) => readLineage(context.supabase, data.documentId));

export const getDocumentBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("upload_batches")
      .select("id,document_ids,requested_outputs,instruction,created_at")
      .contains("document_ids", [data.documentId]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error("Saved output selections could not be read.");
    return row;
  });

export const recordBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), module: z.enum(["institutional", "meeting", "evidence"]), documentIds: z.string().uuid().array().max(20), requestedOutputs: z.string().max(40).array().max(40), instruction: z.string().max(1000).nullable(), fileResults: z.object({ name: z.string().max(255), status: z.string().max(40), documentId: z.string().uuid().nullable(), error: z.string().max(500).nullable() }).array().max(20) }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("upload_batches").insert({ organization_id: data.organizationId, module: data.module, document_ids: data.documentIds, requested_outputs: data.requestedOutputs, instruction: data.instruction, file_results: data.fileResults, created_by: context.userId }).select("id,created_at").single();
    if (error) throw new Error("The batch record could not be saved.");
    return row;
  });
