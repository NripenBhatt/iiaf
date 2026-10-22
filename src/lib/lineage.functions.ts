import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Lineage = Awaited<ReturnType<typeof readLineage>>;

/** Read-only readback of what is actually stored for one document, under the caller's RLS. */
async function readLineage(supabase: any, documentId: string) {
  const { data: doc, error } = await supabase.from("uploaded_documents").select("id,organization_id,original_filename,file_extension,sha256_hash,reporting_period,document_date_raw,processing_status,module").eq("id", documentId).maybeSingle();
  if (error || !doc) throw new Error("Document not found or not accessible.");
  const { data: job } = await supabase.from("document_processing_jobs").select("id,state,processor,processor_version,segment_count,fact_count,started_at").eq("document_id", documentId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const { data: methods } = job ? await supabase.from("document_segments").select("method").eq("job_id", job.id).limit(1000) : { data: [] };
  const methodCounts: Record<string, number> = {};
  for (const m of (methods ?? []) as { method: string }[]) methodCounts[m.method] = (methodCounts[m.method] ?? 0) + 1;
  const { data: facts } = await supabase.from("proposed_facts").select("id,source_label,canonical_field,extracted_value,state,locator_key,integrity,segment_id").eq("document_id", documentId).order("created_at", { ascending: false }).limit(200);
  const factRows = (facts ?? []) as { id: string; source_label: string; canonical_field: string | null; extracted_value: string; state: string; locator_key: string; integrity: string; segment_id: string }[];
  const ids = [documentId, ...factRows.map(f => f.id)];
  const { data: rels } = await supabase.from("relationships").select("id,source_type,source_label,relation_type,target_type,target_label,rule_id,status").or(`source_id.in.(${ids.join(",")}),target_id.in.(${ids.join(",")})`).limit(200);
  const { count: reviews } = factRows.length ? await supabase.from("fact_reviews").select("id", { count: "exact", head: true }).in("fact_id", factRows.map(f => f.id)) : { count: 0 };
  const { data: out } = await supabase.from("document_outputs").select("id,created_at,phase2_quarantined").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { document: doc, job: job ?? null, methodCounts, facts: factRows, relationships: (rels ?? []) as { id: string; source_type: string; source_label: string; relation_type: string; target_type: string; target_label: string; rule_id: string; status: string }[], reviewCount: reviews ?? 0, outputRecord: out ?? null };
}

export const getLineage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(({ context, data }) => readLineage(context.supabase, data.documentId));

export const recordBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), module: z.enum(["institutional", "meeting", "evidence"]), documentIds: z.string().uuid().array().max(20), requestedOutputs: z.string().max(40).array().max(40), instruction: z.string().max(1000).nullable(), fileResults: z.object({ name: z.string().max(255), status: z.string().max(40), documentId: z.string().uuid().nullable(), error: z.string().max(500).nullable() }).array().max(20) }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("upload_batches").insert({ organization_id: data.organizationId, module: data.module, document_ids: data.documentIds, requested_outputs: data.requestedOutputs, instruction: data.instruction, file_results: data.fileResults, created_by: context.userId }).select("id,created_at").single();
    if (error) throw new Error("The batch record could not be saved.");
    return row;
  });
