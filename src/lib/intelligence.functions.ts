import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { UPLOAD_BUCKET } from "./upload-rules";
import { PROCESSOR, PROCESSOR_VERSION, extract, ocrSegments, proposeFacts, tagOcrFacts } from "./extraction";
import { MAX_OCR_PAGES, OCR_MODEL, OCR_VERSION, OcrConfigError, ocrImage, ocrPdf } from "./ocr.server";
import { latestSource } from "./document-source";

/** Runs extraction on the stored original (never modified) and records results through audited database functions. */
export const processDocument = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), retryReason: z.string().trim().min(5).max(500).optional() }))
  .handler(async ({ context, data }) => {
    const { data: document } = await context.supabase.from("uploaded_documents").select("organization_id,processing_status").eq("id", data.id).maybeSingle();
    if (!document) throw new Error("Document not found.");
    const [{ data: upload }, { data: review }] = await Promise.all([context.supabase.rpc("may_upload", { _org: document.organization_id }), context.supabase.rpc("may_review_facts", { _org: document.organization_id })]);
    if (!upload && !review) throw new Error("Your role cannot process this document.");
    if (!data.retryReason) {
      const cached = await latestSource(context.supabase, data.id);
      if (cached) return { status: cached.job.state, error: cached.job.error, cached: true, job_id: cached.job.id, segment_count: cached.lines.length };
      if (["extracted", "needs_review", "processing_failed", "ocr_required"].includes(document.processing_status)) throw new Error("No usable stored extraction. An explicit retry reason is required; processing was not rerun.");
    }
    const { data: job, error } = await context.supabase.rpc("begin_processing", { _doc: data.id });
    if (error || !job) throw new Error(error?.code === "42501" ? "Your role cannot process this document." : error?.message ?? "Processing could not start.");
    // Results are written only by this trusted server process (service role) after the caller was authorized by begin_processing.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const finish = (status: string, processor: string, version: string, segments: unknown[], facts: unknown[], err: string | null) =>
      supabaseAdmin.rpc("complete_processing_trusted", { _actor: context.userId, _job: job, _status: status, _processor: processor, _version: version, _segments: JSON.parse(JSON.stringify(segments)), _facts: JSON.parse(JSON.stringify(facts)), _error: err ?? "" });
    try {
      const { data: doc } = await context.supabase.from("uploaded_documents").select("storage_object_key,file_extension").eq("id", data.id).single();
      const { data: blob } = doc ? await context.supabase.storage.from(UPLOAD_BUCKET).download(doc.storage_object_key) : { data: null };
      if (!doc || !blob) { await finish("processing_failed", `${PROCESSOR}:none`, PROCESSOR_VERSION, [], [], "Stored original could not be read."); throw new Error("Stored original could not be read."); }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const result = await extract(doc.file_extension, bytes);
      let { status, method, segments, error } = result;
      const isImage = ["jpg", "jpeg", "png"].includes(doc.file_extension);
      const ocrPages = isImage ? [] : (result.ocrPages ?? []);
      if (isImage || ocrPages.length) {
        try {
          if (isImage) {
            const lines = await ocrImage(bytes, doc.file_extension === "png" ? "image/png" : "image/jpeg");
            segments = ocrSegments([{ page: null, lines }], 0);
            method = `ocr-image(${OCR_MODEL})`;
            status = lines.length ? "extracted" : "needs_review";
            error = lines.length ? null : "OCR found no readable text in the image.";
          } else if (ocrPages.length > MAX_OCR_PAGES) {
            status = "needs_review";
            error = `${ocrPages.length} page(s) need OCR, above the ${MAX_OCR_PAGES}-page limit per run; embedded-text pages were extracted, scanned pages were not.`;
          } else {
            const { data: signed, error: signError } = await context.supabase.storage.from(UPLOAD_BUCKET).createSignedUrl(doc.storage_object_key, 300);
            if (signError || !signed) throw new Error("A temporary read link for OCR could not be created.");
            const pageLines = await ocrPdf(signed.signedUrl, ocrPages);
            const ocrSegs = ocrSegments(pageLines, segments.length);
            segments = [...segments, ...ocrSegs];
            method = `${result.segments.length ? "pdf-text-layer+" : ""}ocr-pdf(${OCR_MODEL})`;
            status = segments.length ? "extracted" : "needs_review";
            error = segments.length ? null : "OCR found no readable text on the scanned page(s).";
          }
        } catch (e) {
          if (e instanceof OcrConfigError) { status = "ocr_required"; error = e.message; }
          else throw e;
        }
      }
      const facts = status === "extracted" ? tagOcrFacts(proposeFacts(segments)) : [];
      const finalStatus = status === "extracted" && facts.length ? "needs_review" : status;
      const processor = method.startsWith("ocr") || method.includes("+ocr") ? `${PROCESSOR}+ocr:${method}` : `${PROCESSOR}:${method}`;
      const version = method.includes("ocr") ? `${PROCESSOR_VERSION}+ocr-${OCR_VERSION}` : PROCESSOR_VERSION;
      const { data: outcome, error: finishError } = await finish(finalStatus, processor, version, segments, facts, data.retryReason ? `${error ?? ""} Retry requested: ${data.retryReason}` : error);
      if (finishError) throw new Error("Results could not be recorded; the job stays retryable.");
      return { ...(outcome as Record<string, unknown>), error };
    } catch (e) {
      await finish("processing_failed", `${PROCESSOR}:none`, PROCESSOR_VERSION, [], [], e instanceof Error ? e.message : "Processing failed");
      throw e instanceof Error ? e : new Error("Processing failed");
    }
  });

export const listFacts = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: facts, error } = await context.supabase.from("proposed_facts")
      .select("id,document_id,integrity,source_label,canonical_field,spec_source,extracted_value,reviewed_value,state,validation_issues,confidence,locator_key,locator,method,method_version,reviewer_id,reviewed_at,review_note,created_at,uploaded_documents(original_filename,module,processing_status)")
      .eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("Unable to load proposed facts");
    const { data: canReview } = await context.supabase.rpc("may_review_facts", { _org: data.organizationId });
    const { data: reviews } = await context.supabase.from("fact_reviews").select("fact_id,decision,previous_state,value,note,reviewer_id,created_at").eq("organization_id", data.organizationId).order("created_at");
    const { data: links } = await context.supabase.from("relationships").select("id,source_id,relation_type,target_label,status,rule_id,provenance").eq("organization_id", data.organizationId).eq("source_type", "fact").limit(2000);
    const { data: runs } = await context.supabase.from("rule_runs").select("rule_id,input_ref,gaps,created_at").eq("organization_id", data.organizationId).eq("rule_id", "R-AGENCY-001").order("created_at", { ascending: false }).limit(500);
    return { canReview: !!canReview, facts: facts ?? [], reviews: reviews ?? [], links: links ?? [], runs: runs ?? [] };
  });

export const reviewFact = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), decision: z.enum(["approve", "correct", "reject"]), value: z.string().max(2000).default(""), note: z.string().trim().min(5).max(1000) }))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("review_fact", { _fact: data.id, _decision: data.decision, _value: data.value, _note: data.note });
    if (error) throw new Error(error.code === "42501" ? "Your role cannot review facts in this workspace." : error.message);
    return (result ?? {}) as { gaps?: { gap: string }[] };
  });

export const listRelationships = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const [{ data: rels, error }, { data: runs }, { data: canReview }, { data: audit }] = await Promise.all([
      context.supabase.from("relationships").select("*").eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(1000),
      context.supabase.from("rule_runs").select("*").eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(100),
      context.supabase.rpc("may_review_facts", { _org: data.organizationId }),
      context.supabase.from("audit_events").select("event,outcome,details,created_at").eq("organization_id", data.organizationId).in("event", ["relationship.reviewed", "fact.reviewed", "document.processing_started", "document.processing_finished"]).order("created_at", { ascending: false }).limit(300),
    ]);
    if (error) throw new Error("Unable to load relationships");
    return { canReview: !!canReview, relationships: rels ?? [], runs: runs ?? [], audit: audit ?? [] };
  });

export const reviewRelationship = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().min(5).max(1000) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("review_relationship", { _rel: data.id, _decision: data.decision, _note: data.note });
    if (error) throw new Error(error.code === "42501" ? "Your role cannot review relationships." : error.message);
    return { ok: true };
  });
