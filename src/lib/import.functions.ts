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
    return { ...inspection, runs: runs ?? [] };
  });

export const startMasterImport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), mode: z.enum(["sample", "full"]), approved: z.literal(true) }))
  .handler(async ({ context, data }) => {
    const { importSource } = await import("./import-source.server");
    const source = await importSource();
    const { data: runId, error } = await context.supabase.rpc("begin_master_import", { _org: data.organizationId, _workbook: source.source, _sha: source.sha256, _mode: data.mode, _expected: data.mode === "sample" ? source.sample.length : source.rows.length, _approval: data.approved });
    if (error || !runId) throw new Error("Import not permitted. A verified repeat sample is required before full import.");
    return { runId, total: data.mode === "sample" ? source.sample.length : source.rows.length };
  });
export const processMasterBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ runId: z.string().uuid(), offset: z.number().int().min(0).max(40000) }))
  .handler(async ({ context, data }) => {
    const { data: run, error } = await context.supabase.from("master_import_runs").select("mode,state,source_sha256").eq("id", data.runId).single();
    if (error || run.state !== "running") throw new Error("Run is not available for processing");
    const { importSource } = await import("./import-source.server");
    const source = await importSource();
    if (run.source_sha256 !== source.sha256) throw new Error("Source identity mismatch");
    const rows = run.mode === "sample" ? source.sample : source.rows;
    const chunk = rows.slice(data.offset, data.offset + 100);
    const { error: batchError } = await context.supabase.rpc("process_master_import", { _run: data.runId, _rows: JSON.parse(JSON.stringify(chunk)) });
    if (batchError) throw new Error("Batch did not complete; the run remains incomplete and can be resumed.");
    const nextOffset = data.offset + chunk.length;
    if (nextOffset >= rows.length) {
      const { data: result, error: finishError } = await context.supabase.rpc("finish_master_import", { _run: data.runId });
      if (finishError) throw new Error("Final readback verification failed");
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