import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sha256Hex } from "./upload-rules";
import { buildPackageContent, type Retrieval } from "./package-format";

type Fields = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const COMPANY = ["super_admin", "authorized_operator", "internal_reviewer"];

async function requireCompanyRole(supabase: any, userId: string, org: string) {
  const { data: m } = await supabase.from("organization_memberships").select("id,organizations(kind)").eq("user_id", userId).eq("organization_id", org).eq("active", true).maybeSingle();
  if (!m || m.organizations?.kind !== "internal") throw new Error("Access denied");
  const { data: roles } = await supabase.from("user_roles").select("role").eq("membership_id", m.id);
  if (!roles?.some((r: { role: string }) => COMPANY.includes(r.role))) throw new Error("Access denied");
}

export const listAgencyCatalogue = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await requireCompanyRole(context.supabase, context.userId, data.organizationId);
    const { data: rows, error } = await context.supabase.from("master_reference_records").select("id,source_sheet,source_identifier,source_row,source_fields")
      .in("source_sheet", ["AGENCY_MASTER", "AGENCY_REQUIREMENT_MASTER", "EVIDENCE_REQUIREMENT_MAPPING", "AGENCY_FIELD_MASTER"]).limit(20000);
    if (error) throw new Error("Unable to read imported agency records");
    const { data: rels } = await context.supabase.from("relationships").select("target_id,status").eq("organization_id", data.organizationId).eq("relation_type", "MAPS_TO_REQUIREMENT");
    const { data: runs } = await context.supabase.from("master_import_runs").select("mode,state").eq("mode", "full").eq("state", "verified");
    const all = rows ?? [];
    const agencies = all.filter(r => r.source_sheet === "AGENCY_MASTER").map(r => { const f = r.source_fields as Fields; return { id: r.source_identifier, name: str(f["Agency_Name"]), authority: str(f["Authority"]), type: str(f["Agency_Type"]), frameworkVersion: str(f["Framework_Version"]) || null, versionLock: str(f["Version_Lock_Status"]) }; });
    const requirements = all.filter(r => r.source_sheet === "AGENCY_REQUIREMENT_MASTER").map(r => {
      const f = r.source_fields as Fields; const id = r.source_identifier;
      const maps = all.filter(m => m.source_sheet === "EVIDENCE_REQUIREMENT_MAPPING" && str((m.source_fields as Fields)["Requirement_ID"]) === id).length;
      const fields = all.filter(m => m.source_sheet === "AGENCY_FIELD_MASTER" && str((m.source_fields as Fields)["Requirement_ID"]) === id);
      const linked = (rels ?? []).filter(l => l.target_id === r.id);
      return { recordId: r.id, id, agencyId: str(f["Agency_ID"]), metric: str(f["Metric"]), level: str(f["Level"]), pillar: str(f["Parameter_Pillar"]), subparameter: str(f["Subparameter_Indicator"]),
        version: Array.from(new Set(fields.map(x => str((x.source_fields as Fields)["Framework_Version"])).filter(Boolean))).join("; ") || str(f["Agency_Version_Edition"]) || "Not stated in source",
        versionLock: str(f["Version_Lock_Status"]), sourceMappings: maps, approvedLinks: linked.filter(l => l.status === "approved").length, candidateLinks: linked.filter(l => l.status === "candidate").length, fieldCount: fields.length };
    });
    return { agencies, requirements, fullImportVerified: (runs ?? []).length > 0 };
  });

/** Retrieves everything known for one requirement. Only approved, trusted, same-organization, same-period chains count as usable evidence. */
export async function retrieve(supabase: any, org: string, recordId: string, period: string): Promise<Retrieval> {
  const { data: req } = await supabase.from("master_reference_records").select("*").eq("id", recordId).eq("source_sheet", "AGENCY_REQUIREMENT_MASTER").maybeSingle();
  if (!req) throw new Error("Requirement not found among imported records");
  const rid = req.source_identifier as string;
  const [{ data: fieldRows }, { data: mapRows }, { data: agencyRow }] = await Promise.all([
    supabase.from("master_reference_records").select("source_identifier,source_row,source_fields").eq("source_sheet", "AGENCY_FIELD_MASTER").eq("source_fields->>Requirement_ID", rid),
    supabase.from("master_reference_records").select("id,source_identifier,source_row,source_fields").eq("source_sheet", "EVIDENCE_REQUIREMENT_MAPPING").eq("source_fields->>Requirement_ID", rid),
    supabase.from("master_reference_records").select("source_identifier,source_fields").eq("source_sheet", "AGENCY_MASTER").eq("source_identifier", str((req.source_fields as Fields)["Agency_ID"])).maybeSingle(),
  ]);
  const evIds = [...new Set((mapRows ?? []).map((m: any) => str(m.source_fields["Evidence_ID"])))] as string[];
  const { data: evRows } = evIds.length ? await supabase.from("master_reference_records").select("id,source_identifier,source_row,source_fields").eq("source_sheet", "EVIDENCE_MASTER").in("source_identifier", evIds) : { data: [] };
  const evById = new Map((evRows ?? []).map((e: any) => [e.source_identifier, e]));
  const evRecordIds = (evRows ?? []).map((e: any) => e.id);
  const { data: rels } = evRecordIds.length ? await supabase.from("relationships").select("*").eq("organization_id", org).or(`target_id.in.(${evRecordIds.join(",")}),source_id.in.(${evRecordIds.join(",")})`) : { data: [] };
  const identifies = (rels ?? []).filter((r: any) => r.relation_type === "IDENTIFIES");
  const factIds = identifies.map((r: any) => r.source_id);
  const [{ data: facts }, { data: prov }, { data: conflicts }] = factIds.length ? await Promise.all([
    supabase.from("proposed_facts").select("id,document_id,source_label,canonical_field,extracted_value,reviewed_value,state,integrity,locator,method,method_version,reviewed_at").in("id", factIds),
    supabase.from("relationships").select("source_id,target_id,status,provenance").eq("organization_id", org).eq("relation_type", "EXTRACTED_FROM").in("source_id", factIds),
    supabase.from("relationships").select("source_id,target_id,source_label,target_label,status").eq("organization_id", org).eq("relation_type", "CONFLICTS_WITH").or(`source_id.in.(${factIds.join(",")}),target_id.in.(${factIds.join(",")})`),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const docIds = [...new Set((facts ?? []).map((f: any) => f.document_id))];
  const { data: docs } = docIds.length ? await supabase.from("uploaded_documents").select("id,original_filename,reporting_period,sha256_hash,processing_status,module,category_code,uploaded_at").eq("organization_id", org).in("id", docIds) : { data: [] };

  const mappings = (mapRows ?? []).map((m: any) => {
    const f = m.source_fields as Fields; const ev = evById.get(str(f["Evidence_ID"])) as any;
    const link = ev ? (rels ?? []).find((r: any) => r.relation_type === "MAPS_TO_REQUIREMENT" && r.source_id === ev.id && r.target_id === recordId) : null;
    const status = !ev ? "missing_evidence_record" : !link ? "requires_review" : link.status === "approved" ? "approved" : link.status === "candidate" ? "candidate" : link.status;
    const evidence = !ev ? [] : identifies.filter((i: any) => i.target_id === ev.id).map((i: any) => {
      const fact = (facts ?? []).find((x: any) => x.id === i.source_id); const p = (prov ?? []).find((x: any) => x.source_id === i.source_id); const doc = fact ? (docs ?? []).find((d: any) => d.id === fact.document_id) : null;
      const reasons: string[] = [];
      if (status !== "approved") reasons.push("Requirement mapping is not approved");
      if (i.status !== "approved") reasons.push(`Evidence identification is ${i.status}`);
      if (!fact || !["approved", "corrected"].includes(fact.state)) reasons.push("Fact is not human-approved");
      if (fact?.integrity !== "trusted_processor") reasons.push("Extraction result is not from the trusted processor");
      if (!doc) reasons.push("Source document not available in this organization");
      if (period && doc && (doc.reporting_period ?? "") !== period) reasons.push(`Reporting period is “${doc.reporting_period || "not stated"}”, not ${period}`);
      if (p?.status !== "approved") reasons.push("Provenance link is not approved");
      return { factId: i.source_id, documentId: doc?.id ?? null, filename: doc?.original_filename ?? "Unavailable", documentSha256: doc?.sha256_hash ?? null, reportingPeriod: doc?.reporting_period ?? null,
        value: fact ? str(fact.reviewed_value ?? fact.extracted_value) : "", field: fact?.canonical_field ?? null, locator: fact?.locator ?? null, method: fact ? `${fact.method} v${fact.method_version}` : null, integrity: fact?.integrity ?? null, factState: fact?.state ?? null, identificationStatus: i.status, usable: reasons.length === 0, reasons };
    });
    return { mappingId: m.source_identifier, sourceRow: m.source_row, evidenceId: str(f["Evidence_ID"]), evidenceName: ev ? str(ev.source_fields["Evidence_Record"] ?? ev.source_fields["Evidence_Name"] ?? ev.source_fields["Package_Name"]) : "", packageName: str(f["Package_Name"]), coverage: str(f["Coverage_Type"]), role: str(f["Evidence_Role"]), sourceMappingStatus: str(f["Mapping_Status"]), frameworkVersion: str(f["Framework_Version"]) || null, status, evidence };
  });
  const rf = req.source_fields as Fields;
  return {
    organizationId: org, period,
    agency: { id: str(rf["Agency_ID"]), name: str(rf["Agency"]), authority: str((agencyRow?.source_fields as Fields | undefined)?.["Authority"]) },
    requirement: { recordId, id: rid, sourceRow: req.source_row, workbook: req.source_workbook, workbookSha256: req.source_sha256, metric: str(rf["Metric"]), level: str(rf["Level"]), pillar: str(rf["Parameter_Pillar"]), description: str(rf["Requirement_Description"]), officialLabel: str(rf["Official_Label"]), mandatory: str(rf["Mandatory"]), validationRule: str(rf["Validation_Rule"]), missingValueRule: str(rf["Missing_Value_Rule"]), mismatchRule: str(rf["Mismatch_Rule"]), reportingPeriodRule: str(rf["Reporting_Period_Rule"]), versionLock: str(rf["Version_Lock_Status"]), humanVerification: str(rf["Human_Verification_Required"]), notes: str(rf["Notes"]), officialSource: str(rf["Official_Source"]) },
    fields: (fieldRows ?? []).map((x: any) => { const f = x.source_fields as Fields; return { id: x.source_identifier, sourceRow: x.source_row, label: str(f["Official_Field_Label"]), dataType: str(f["Data_Type"]), unit: str(f["Unit"]) || null, mandatory: str(f["Mandatory_Status"]), frameworkVersion: str(f["Framework_Version"]), reportingPeriod: str(f["Reporting_Period"]), fieldLevel: str(f["Field_Level_Status"]), versionLock: str(f["Version_Lock_Status"]), officialSource: str(f["Official_Source"]), canonicalMapping: null as string | null }; }),
    mappings,
    conflicts: (conflicts ?? []).map((c: any) => ({ from: c.source_label, to: c.target_label, status: c.status })),
  };
}

export const getRequirementEvidence = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), recordId: z.string().uuid(), period: z.string().trim().max(40).default("") }))
  .handler(async ({ context, data }) => {
    await requireCompanyRole(context.supabase, context.userId, data.organizationId);
    const r = await retrieve(context.supabase, data.organizationId, data.recordId, data.period);
    const { data: packages } = await context.supabase.from("evidence_packages").select("id,version,content_sha256,status,certification_status,generated_at,reporting_period,content").eq("organization_id", data.organizationId).eq("requirement_record_id", data.recordId).order("version", { ascending: false }).limit(20);
    const ids = (packages ?? []).map(p => p.id);
    const { data: reviews } = ids.length ? await context.supabase.from("package_reviews").select("package_id,decision,content_sha256,note,created_at").in("package_id", ids).order("created_at") : { data: [] };
    return { retrieval: r, packages: packages ?? [], reviews: reviews ?? [] };
  });

export const generatePackage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), recordId: z.string().uuid(), period: z.string().trim().max(40).default("") }))
  .handler(async ({ context, data }) => {
    await requireCompanyRole(context.supabase, context.userId, data.organizationId);
    const content = buildPackageContent(await retrieve(context.supabase, data.organizationId, data.recordId, data.period));
    const sha = await sha256Hex(new TextEncoder().encode(JSON.stringify(content)).buffer as ArrayBuffer);
    const { data: saved, error } = await context.supabase.rpc("save_evidence_package", { _org: data.organizationId, _req: data.recordId, _period: data.period, _content: JSON.parse(JSON.stringify(content)), _sha: sha });
    if (error) throw new Error(error.code === "42501" ? "Your role cannot generate packages." : error.message);
    return saved as { id: string; version: number; unchanged: boolean };
  });

export const reviewPackage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), decision: z.enum(["reviewed", "changes_requested"]), sha: z.string().regex(/^[0-9a-f]{64}$/), note: z.string().trim().min(5).max(1000) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("review_evidence_package", { _pkg: data.id, _decision: data.decision, _sha: data.sha, _note: data.note });
    if (error) throw new Error(error.code === "42501" ? "Only a Super Admin or Internal Reviewer can review packages." : error.message);
    return { ok: true };
  });
