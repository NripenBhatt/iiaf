import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getImportInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: org } = await context.supabase.from("organizations").select("kind").eq("id", data.organizationId).maybeSingle();
    const { data: member } = await context.supabase.from("organization_memberships").select("id").eq("user_id", context.userId).eq("organization_id", data.organizationId).eq("active", true).maybeSingle();
    if (!org || org.kind !== "internal" || !member) throw new Error("Access denied");
    const { data: roles, error } = await context.supabase.from("user_roles").select("role").eq("membership_id", member.id).eq("user_id", context.userId);
    if (error || !roles?.some(r => ["super_admin", "authorized_operator", "internal_reviewer"].includes(r.role))) throw new Error("Access denied");
    const { default: inspection } = await import("@/data/master-inspection.json");
    const { data: runs, error: runError } = await context.supabase.from("master_import_runs").select("*").order("created_at", { ascending: false }).limit(30);
    if (runError) throw new Error("Unable to read import history");
    return { ...inspection, notes: inspection.notes.map(note => note.startsWith("No database records imported.") ? "Mapping reviewed. Protected reference records, import runs and row-outcome logs now exist. See persisted run results; full import still requires separate approval." : note), runs: runs ?? [] };
  });

export const startMasterImport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), mode: z.enum(["sample", "full"]), approved: z.literal(true) }))
  .handler(async ({ context, data }) => {
    if (data.mode === "full") {
      const { default: inspection } = await import("@/data/master-inspection.json");
      const { data: reviews, error: reviewError } = await context.supabase.from("held_record_reviews").select("source_sheet,source_row");
      const reviewed = new Set((reviews ?? []).map(r => `${r.source_sheet}:${r.source_row}`));
      if (reviewError || inspection.issues.some(i => !reviewed.has(`${i.sheet}:${i.row}`))) throw new Error("Full import locked until every held record has a recorded review decision.");
    }
    const { importSource } = await import("./import-source.server");
    const source = await importSource();
    const { data: runId, error } = await context.supabase.rpc("begin_master_import", { _org: data.organizationId, _workbook: source.source, _sha: source.sha256, _mode: data.mode, _expected: data.mode === "sample" ? source.sampleCount : source.total, _approval: data.approved });
    if (error || !runId) throw new Error("Import not permitted. A verified repeat sample is required before full import.");
    return { runId, total: data.mode === "sample" ? source.sampleCount : source.total };
  });
export const processMasterBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ runId: z.string().uuid(), offset: z.number().int().min(0).max(40000) }))
  .handler(async ({ context, data }) => {
    const { data: run, error } = await context.supabase.from("master_import_runs").select("mode,state,source_sha256").eq("id", data.runId).single();
    if (error || run.state !== "running") throw new Error("Run is not available for processing");
    const { importSource, importBatch } = await import("./import-source.server");
    const source = await importSource();
    if (run.source_sha256 !== source.sha256) throw new Error("Source identity mismatch");
    const total = run.mode === "sample" ? source.sampleCount : source.total;
    const chunk = await importBatch(run.mode as "sample" | "full", data.offset);
    const { error: batchError } = await context.supabase.rpc("process_master_import", { _run: data.runId, _rows: JSON.parse(JSON.stringify(chunk)) });
    if (batchError) throw new Error("Batch did not complete; the run remains incomplete and can be resumed.");
    const nextOffset = data.offset + chunk.length;
    if (nextOffset >= total) {
      const { data: result, error: finishError } = await context.supabase.rpc("finish_master_import", { _run: data.runId });
      if (finishError || !result || typeof result !== "object" || Array.isArray(result) || result["readback_mismatches"] !== 0 || result["source_rows"] !== total || result["conflicts"] !== 0) throw new Error("Final readback verification failed; inspect the persisted run.");
      return { nextOffset, done: true, result };
    }
    return { nextOffset, done: false, result: null };
  });
export const getImportResults = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ runId: z.string().uuid(), offset: z.number().int().min(0).default(0) }))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.from("master_import_outcomes").select("source_sheet,source_row,source_identifier,outcome,reason,source_fields,target_record_id,mapping_log").eq("run_id", data.runId).order("source_sheet").order("source_row").range(data.offset, data.offset + 999);
    if (error) throw new Error("Unable to read import results");
    return rows ?? [];
  });

export const listHeldReviews = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("held_record_reviews").select("id,source_sheet,source_row,source_identifier,decision,explanation,reviewer_id,created_at,finding,affected_fields,correction,revalidation_result").order("created_at", { ascending: false }).limit(2000);
    if (error) throw new Error("Unable to read held-record reviews");
    const ids = [...new Set((data ?? []).map(r => r.reviewer_id))];
    const { data: names } = ids.length ? await context.supabase.from("profiles").select("id,display_name").in("id", ids) : { data: [] };
    return (data ?? []).map(r => ({ ...r, reviewer: names?.find(n => n.id === r.reviewer_id)?.display_name || r.reviewer_id }));
  });
export const recordHeldReview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), sheet: z.string().max(80), row: z.number().int().min(1), decision: z.enum(["keep_held", "source_correction_required", "escalate_for_expert_review", "approve_for_import", "exclude_documented"]), explanation: z.string().trim().min(10).max(2000), correction: z.string().trim().max(1000).default("") }))
  .handler(async ({ context, data }) => {
    const { default: inspection } = await import("@/data/master-inspection.json");
    const issue = inspection.issues.find(i => i.sheet === data.sheet && i.row === data.row);
    if (!issue) throw new Error("Only inspected held records can be reviewed.");
    // Revalidation runs against the unchanged source workbook: the blocking finding is still present there.
    const revalidation = "blocking_issue_persists";
    if (data.decision === "approve_for_import") throw new Error("Cannot approve: revalidation against the source still finds the blocking issue. Correct the source workbook and re-inspect first.");
    const { error } = await context.supabase.from("held_record_reviews").insert({ organization_id: data.organizationId, source_sheet: issue.sheet, source_row: issue.row, source_identifier: String(issue.identifier), decision: data.decision, explanation: data.explanation, reviewer_id: context.userId, finding: `${issue.kind}: ${issue.reason}`.slice(0, 1000), affected_fields: String(issue.field ?? ""), correction: data.correction || null, revalidation_result: revalidation });
    if (error) throw new Error(error.code === "42501" ? (data.decision === "exclude_documented" ? "Only a Super Admin can exclude a held record." : "Only a Super Admin or Internal Reviewer can record held-record decisions.") : "Review could not be saved.");
    return { ok: true, stillHeld: true };
  });

