import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { UPLOAD_BUCKET, isStored, contentMatchesExtension, detectMime, sha256Hex, validateSelection } from "./upload-rules";
import { listFilterSchema, dateBounds, literalSearch, PAGE_SIZE } from "./list-filters";

const moduleSchema = z.enum(["institutional", "meeting", "evidence"]);
const text = z.string().trim().max(300).optional().default("");

export const listDocuments = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), module: moduleSchema, filters: listFilterSchema.optional() }))
  .handler(async ({ context, data }) => {
    const { data: member, error: memberError } = await context.supabase.rpc("is_member", { _org: data.organizationId });
    if (memberError || !member) throw new Error("Access denied");
    const filters = data.filters ?? listFilterSchema.parse({});
    if (filters.dateField === "generated") throw new Error("Documents have no generation date.");
    const bounds = dateBounds(filters);
    let query = context.supabase.from("uploaded_documents")
      .select("id,upload_id,module,category_code,document_type_id,declared_purpose,department_or_owner,reporting_period,document_date_raw,document_version_or_status,original_filename,file_extension,detected_mime_type,file_size_bytes,sha256_hash,processing_status,extraction_status,validation_errors,attempts,uploader_id,created_at,uploaded_at,updated_at,language,schema_version", { count: "exact" })
      .eq("organization_id", data.organizationId).eq("module", data.module);
    const search = literalSearch(filters.q);
    if (search) query = query.or(`original_filename.ilike.%${search}%,declared_purpose.ilike.%${search}%`);
    if (filters.category) query = query.eq("category_code", filters.category);
    if (filters.type) query = query.eq("document_type_id", filters.type);
    if (filters.status) query = query.eq("processing_status", filters.status);
    if (filters.source) query = query.eq("id", filters.source);
    if (filters.owner) query = query.eq("uploader_id", filters.owner);
    const dateColumn = filters.dateField === "uploaded" ? "uploaded_at" : "created_at";
    if (bounds.start) query = query.gte(dateColumn, bounds.start);
    if (bounds.end) query = query.lt(dateColumn, bounds.end);
    const ascending = filters.sort === "oldest";
    const { data: rows, error, count } = await query.order(dateColumn, { ascending }).order("id", { ascending }).range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);
    if (error) throw new Error("Unable to load uploaded documents");
    const { data: canUpload } = await context.supabase.rpc("may_upload", { _org: data.organizationId });
    const all = rows ?? [];
    return { canUpload: !!canUpload, userId: context.userId, total: count ?? 0, documents: all.map(d => ({ ...d, duplicateOf: all.filter(o => o.id !== d.id && o.sha256_hash === d.sha256_hash && isStored(o.processing_status)).map(o => o.original_filename) })) };
  });

export const registerDocument = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    organizationId: z.string().uuid(), module: moduleSchema, category: z.string().trim().min(1).max(40), documentType: z.string().trim().max(40),
    filename: z.string().min(1).max(255), mime: z.string().max(120), size: z.number().int(), sha256: z.string().regex(/^[0-9a-f]{64}$/),
    meta: z.object({ declared_purpose: text, department_or_owner: text, reporting_period: text, document_date_raw: text, document_version_or_status: text, language: text }),
  }))
  .handler(async ({ context, data }) => {
    const errors = validateSelection({ name: data.filename, size: data.size });
    if (errors.length) throw new Error(errors.join(" "));
    const ext = data.filename.slice(data.filename.lastIndexOf(".") + 1).toLowerCase();
    const { data: result, error } = await context.supabase.rpc("register_document", { _org: data.organizationId, _module: data.module, _category: data.category, _type: data.documentType, _filename: data.filename, _ext: ext, _mime: data.mime, _size: data.size, _sha: data.sha256, _meta: data.meta });
    if (error || !result) throw new Error(error?.code === "42501" ? "Your role cannot upload to this workspace." : "Upload could not be registered.");
    return result as { id: string; storage_object_key: string; duplicates: { id: string; filename: string; status: string }[] };
  });

/** Re-reads the stored object, fingerprints it on the server and records the verified outcome. */
export const finalizeDocument = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: doc, error } = await context.supabase.from("uploaded_documents").select("storage_object_key,file_extension").eq("id", data.id).single();
    if (error || !doc) throw new Error("Document not found");
    const { data: blob } = await context.supabase.storage.from(UPLOAD_BUCKET).download(doc.storage_object_key);
    let sha = "", mime = ""; const errors: string[] = [];
    if (blob) {
      const buffer = await blob.arrayBuffer();
      sha = await sha256Hex(buffer); mime = detectMime(new Uint8Array(buffer.slice(0, 512)));
      if (!contentMatchesExtension(doc.file_extension, mime)) errors.push(`File content (${mime}) does not match the .${doc.file_extension} extension.`);
    }
    const { data: status, error: finishError } = await context.supabase.rpc("finalize_document", { _id: data.id, _sha: sha || "0".repeat(64), _detected_mime: mime, _errors: errors });
    if (finishError) throw new Error("Upload verification could not be recorded.");
    return { status: status as string };
  });

export const markDocumentFailed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), reason: z.string().max(300) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("mark_document_failed", { _id: data.id, _reason: data.reason });
    if (error) throw new Error("Unable to record failed upload");
    return { ok: true };
  });

export const retryDocument = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: key, error } = await context.supabase.rpc("retry_document", { _id: data.id });
    if (error || !key) throw new Error("Only your own failed uploads can be retried.");
    return { storageKey: key as string };
  });

export const getDocumentLink = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: doc } = await context.supabase.from("uploaded_documents").select("storage_object_key,original_filename,processing_status").eq("id", data.id).maybeSingle();
    if (!doc || !isStored(doc.processing_status)) throw new Error("Document is not available");
    const { error: auditError } = await context.supabase.rpc("record_document_access", { _id: data.id });
    if (auditError) throw new Error("Access denied");
    const { data: signed, error } = await context.supabase.storage.from(UPLOAD_BUCKET).createSignedUrl(doc.storage_object_key, 60, { download: doc.original_filename });
    if (error || !signed) throw new Error("Unable to create a download link");
    return { url: signed.signedUrl };
  });
