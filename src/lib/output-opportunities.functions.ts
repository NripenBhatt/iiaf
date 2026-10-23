import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { latestSource } from "./document-source";
import { discoverOutputOpportunities } from "./output-opportunities";
import { storedOutputSetSchema } from "./output-cache";

/** Read-only: recompute discovery from current saved segments, not historical cached rules. */
export const getOutputOpportunities = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid(), requested: z.string().array().max(40) }))
  .handler(async ({ context, data }) => {
    const { data: doc, error } = await context.supabase.from("uploaded_documents").select("id,original_filename").eq("id", data.documentId).maybeSingle();
    if (error || !doc) throw new Error("Document not found or not accessible.");
    const source = await latestSource(context.supabase, doc.id);
    if (!source) throw new Error("Current saved extraction is unavailable; no output opportunities were inferred from an older reading.");
    const { data: row, error: readError } = await context.supabase.from("document_outputs").select("id,outputs").eq("document_id", doc.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (readError) throw new Error("Saved output status could not be verified.");
    return { documentId: doc.id, filename: doc.original_filename, jobId: source.job.id, outputRecordId: row?.id ?? null,
      catalogueDefinitionsEvaluated: 30, opportunities: discoverOutputOpportunities(source.lines, row ? storedOutputSetSchema.parse(row.outputs).outputs : [], data.requested) };
  });