import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SourceLine } from "./output-contract";

/** Query one job before its pages: never cap all historical runs or silently use an older run. */
export async function latestSource(supabase: SupabaseClient<Database>, documentId: string) {
  const { data: job, error } = await supabase.from("document_processing_jobs").select("id,state,finished_at,processor_version,segment_count,error").eq("document_id", documentId).in("state", ["extracted", "needs_review"]).gt("segment_count", 0).order("finished_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("Stored extraction could not be read.");
  if (!job) return null;
  const lines: SourceLine[] = [];
  const segmentIds: string[] = [];
  for (let offset = 0; offset < job.segment_count; offset += 500) {
    const { data, error: readError } = await supabase.from("document_segments").select("id,seq,locator_key,locator,content,method,method_version").eq("document_id", documentId).eq("job_id", job.id).order("seq").order("id").range(offset, offset + 499);
    if (readError) throw new Error("Stored source passages could not be retrieved.");
    lines.push(...(data ?? []));
    segmentIds.push(...(data ?? []).map(segment => segment.id));
  }
  if (lines.length !== job.segment_count) throw new Error("Stored extraction is incomplete; no output was produced.");
  return { job, lines, segmentIds, version: job.processor_version ?? "" };
}