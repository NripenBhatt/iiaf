import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { latestSource } from "./document-source";
import { buildKnowledgeBundle, knowledgeQuerySchema, type KnowledgeQuery, type KnowledgePassage, type KnowledgeFact } from "./knowledge";

/** One authenticated, tenant-scoped read path for institutional search and company conversation. */
export async function retrieveKnowledge(client: SupabaseClient<Database>, userId: string, scope: KnowledgeQuery) {
  const { data: member, error: membershipError } = await client.from("organization_memberships").select("id").eq("organization_id", scope.organizationId).eq("user_id", userId).eq("active", true).maybeSingle();
  if (membershipError || !member) throw new Error("Access denied.");
  const { data: role, error: roleError } = await client.from("user_roles").select("id").eq("membership_id", member.id).eq("user_id", userId).limit(1).maybeSingle();
  if (roleError || !role) throw new Error("Access denied.");
  let query = client.from("uploaded_documents").select("id,organization_id,original_filename,reporting_period,department_or_owner,sha256_hash,processing_status,uploaded_at", { count: "exact" }).eq("organization_id", scope.organizationId);
  if (scope.period) query = query.eq("reporting_period", scope.period);
  if (scope.department) query = query.eq("department_or_owner", scope.department);
  const { data: documents, error, count } = await query.order("id").range(scope.offset, scope.offset + 19);
  if (error || count === null) throw new Error("Institutional sources could not be read completely.");
  const passages: KnowledgePassage[] = []; const currentSegmentIds: string[] = []; const incompleteDocuments: string[] = [];
  const sources = await Promise.all((documents ?? []).map(async doc => ({ doc, extraction: await latestSource(client, doc.id) })));
  for (const { doc, extraction } of sources) {
    if (!extraction) { incompleteDocuments.push(doc.id); continue; }
    for (const line of extraction.lines) passages.push({ documentId: doc.id, jobId: extraction.job.id, locatorKey: line.locator_key, locator: line.locator, content: line.content, method: line.method ?? "not stated", parserVersion: line.method_version, seq: line.seq });
    const { data: segments, error: segmentsError } = await client.from("document_segments").select("id").eq("organization_id", scope.organizationId).eq("document_id", doc.id).eq("job_id", extraction.job.id).limit(10000);
    if (segmentsError || segments?.length !== extraction.job.segment_count) throw new Error("Current fact lineage could not be reconciled.");
    currentSegmentIds.push(...(segments ?? []).map(s => s.id));
  }
  const ids = (documents ?? []).map(d => d.id);
  const facts: KnowledgeFact[] = [];
  if (ids.length) {
    for (let offset = 0; ; offset += 500) {
      const { data, error: factError } = await client.from("proposed_facts").select("id,organization_id,document_id,source_label,canonical_field,extracted_value,reviewed_value,state,integrity,locator_key,locator,segment_id").eq("organization_id", scope.organizationId).in("document_id", ids).order("id").range(offset, offset + 499);
      if (factError) throw new Error("Stored facts could not be read.");
      facts.push(...(data ?? []));
      if ((data ?? []).length < 500) break;
    }
  }
  const factIds = facts.map(f => f.id);
  const conflicts: { id: string; source_id: string; target_id: string; status: string }[] = [];
  for (let offset = 0; offset < factIds.length; offset += 100) {
    const chunk = factIds.slice(offset, offset + 100).join(",");
    for (let page = 0; ; page += 500) {
      const { data, error: conflictError } = await client.from("relationships").select("id,source_id,target_id,status").eq("organization_id", scope.organizationId).eq("relation_type", "CONFLICTS_WITH").or(`source_id.in.(${chunk}),target_id.in.(${chunk})`).order("id").range(page, page + 499);
      if (conflictError) throw new Error("Conflicting evidence could not be read.");
      conflicts.push(...(data ?? []));
      if ((data ?? []).length < 500) break;
    }
  }
  const endpoints = [...new Set(conflicts.flatMap(c => [c.source_id, c.target_id]))].filter(id => !factIds.includes(id));
  for (let offset = 0; offset < endpoints.length; offset += 100) {
    const { data, error: endpointError } = await client.from("proposed_facts").select("id,organization_id,document_id,source_label,canonical_field,extracted_value,reviewed_value,state,integrity,locator_key,locator,segment_id").eq("organization_id", scope.organizationId).in("id", endpoints.slice(offset, offset + 100));
    if (endpointError) throw new Error("Conflict source details could not be read.");
    facts.push(...(data ?? []));
  }
  const extraDocumentIds = [...new Set(facts.map(f => f.document_id))].filter(id => !ids.includes(id));
  const allDocuments = [...(documents ?? [])];
  for (let offset = 0; offset < extraDocumentIds.length; offset += 100) {
    const { data, error: sourceError } = await client.from("uploaded_documents").select("id,organization_id,original_filename,reporting_period,department_or_owner,sha256_hash,processing_status,uploaded_at").eq("organization_id", scope.organizationId).in("id", extraDocumentIds.slice(offset, offset + 100));
    if (sourceError) throw new Error("Conflict documents could not be read.");
    allDocuments.push(...(data ?? []));
  }
  const { data: organization, error: orgError } = await client.from("organizations").select("name").eq("id", scope.organizationId).maybeSingle();
  if (orgError || !organization) throw new Error("Organization could not be read.");
  return buildKnowledgeBundle({ scope, documents: allDocuments, passages, facts, conflicts: [...new Map(conflicts.map(c => [c.id, c])).values()], currentSegmentIds, incompleteDocuments, totalDocuments: count, organizationName: organization.name });
}

export const searchKnowledge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(knowledgeQuerySchema).handler(({ context, data }) => retrieveKnowledge(context.supabase, context.userId, data));