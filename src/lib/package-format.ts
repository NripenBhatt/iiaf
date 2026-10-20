/** Pure, deterministic package building so the same records always produce the same content hash. */
export type EvidenceItem = { factId: string; documentId: string | null; filename: string; documentSha256: string | null; reportingPeriod: string | null; value: string; field: string | null; locator: unknown; method: string | null; integrity: string | null; factState: string | null; identificationStatus: string; usable: boolean; reasons: string[] };
export type Mapping = { mappingId: string; sourceRow: number; evidenceId: string; evidenceName: string; packageName: string; coverage: string; role: string; sourceMappingStatus: string; frameworkVersion: string | null; status: string; evidence: EvidenceItem[] };
export type Retrieval = {
  organizationId: string; period: string;
  agency: { id: string; name: string; authority: string };
  requirement: { recordId: string; id: string; sourceRow: number; workbook: string; workbookSha256: string; metric: string; level: string; pillar: string; description: string; officialLabel: string; mandatory: string; validationRule: string; missingValueRule: string; mismatchRule: string; reportingPeriodRule: string; versionLock: string; humanVerification: string; notes: string; officialSource: string };
  fields: { id: string; sourceRow: number; label: string; dataType: string; unit: string | null; mandatory: string; frameworkVersion: string; reportingPeriod: string; fieldLevel: string; versionLock: string; officialSource: string; canonicalMapping: string | null }[];
  mappings: Mapping[];
  conflicts: { from: string; to: string; status: string }[];
};
export type PackageContent = ReturnType<typeof buildPackageContent>;

export const locatorText = (l: unknown) => Object.entries((l ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => `${k} ${v}`).join(", ") || "No locator recorded";

export function buildPackageContent(r: Retrieval) {
  const mappings = [...r.mappings].sort((a, b) => a.mappingId.localeCompare(b.mappingId));
  const usable = mappings.flatMap(m => m.evidence.filter(e => e.usable).map(e => ({ ...e, mappingId: m.mappingId, evidenceId: m.evidenceId })))
    .sort((a, b) => (a.mappingId + a.factId).localeCompare(b.mappingId + b.factId));
  const attachments = [...new Map(usable.filter(e => e.documentId).map(e => [e.documentId!, e])).values()]
    .map((e, i) => ({ number: i + 1, documentId: e.documentId!, filename: e.filename, sha256: e.documentSha256, reportingPeriod: e.reportingPeriod }));
  const attachmentNo = (id: string | null) => attachments.find(a => a.documentId === id)?.number ?? null;
  const versions = [...new Set(r.fields.map(f => f.frameworkVersion).filter(Boolean))];
  const issues: string[] = [];
  if (!mappings.length) issues.push("No explicit evidence-to-requirement mapping is imported for this requirement.");
  for (const m of mappings) {
    if (m.status === "missing_evidence_record") issues.push(`${m.mappingId}: evidence record ${m.evidenceId} is not imported.`);
    else if (m.status === "requires_review") issues.push(`${m.mappingId}: source mapping to ${m.evidenceId} has not been evaluated; no approved evidence identifies it yet.`);
    else if (m.status !== "approved") issues.push(`${m.mappingId}: mapping is ${m.status}, not approved; it cannot support this package.`);
    if (!m.frameworkVersion) issues.push(`${m.mappingId}: framework version not stated in the mapping row.`);
    for (const e of m.evidence.filter(x => !x.usable)) issues.push(`${m.mappingId} · ${e.filename}: excluded — ${e.reasons.join("; ")}.`);
  }
  for (const f of r.fields) if (!f.canonicalMapping) issues.push(`${f.id} (${f.label}): no canonical institutional field mapping is established; value not populated.`);
  if (r.requirement.versionLock && !/VERIFIED/i.test(r.requirement.versionLock)) issues.push(`Requirement version lock: ${r.requirement.versionLock}.`);
  for (const c of r.conflicts) issues.push(`Conflict (${c.status}): ${c.from} vs ${c.to}.`);
  if (!usable.length) issues.push("No approved, trusted evidence is available for this requirement and period.");
  return {
    schema: "iiaf-requirement-package/1",
    status: "DRAFT — not reviewed, not certified",
    agency: r.agency,
    methodology: versions.length ? versions : ["Not stated in imported records"],
    requirement: r.requirement,
    reportingPeriod: r.period || "All periods (no filter applied)",
    dataTable: r.fields.map(f => ({ fieldId: f.id, label: f.label, dataType: f.dataType, unit: f.unit, mandatory: f.mandatory, value: null as string | null, valueStatus: "Not populated — no canonical field mapping", sourceRow: f.sourceRow })),
    evidenceIndex: usable.map((e, i) => ({ number: i + 1, mappingId: e.mappingId, evidenceId: e.evidenceId, field: e.field, value: e.value, attachment: attachmentNo(e.documentId), filename: e.filename, locator: locatorText(e.locator), method: e.method })),
    attachments,
    issues,
    provenance: { workbook: r.requirement.workbook, workbookSha256: r.requirement.workbookSha256, requirementSourceRow: r.requirement.sourceRow, mappingRows: mappings.map(m => ({ mappingId: m.mappingId, row: m.sourceRow, status: m.status })) },
    certification: "Registrar certification is not implemented; this package carries no signature or declaration.",
  };
}

const esc = (v: unknown) => String(v ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
export function packageMarkdown(c: PackageContent, meta: { version: number; sha256: string; generatedAt: string; status: string }) {
  const L: string[] = [];
  L.push(`# ${c.agency.name} · ${c.requirement.id} — ${c.requirement.metric}`, "", `**Status:** ${meta.status === "reviewed" ? "DRAFT — reviewed (not certified)" : c.status} · package version ${meta.version}`, "");
  L.push(`| Item | Value |`, `|---|---|`, `| Agency | ${esc(c.agency.name)} (${esc(c.agency.id)}) ${esc(c.agency.authority)} |`, `| Methodology / version | ${esc(c.methodology.join("; "))} |`, `| Requirement | ${esc(c.requirement.id)} · ${esc(c.requirement.level)} · ${esc(c.requirement.pillar)} |`, `| Reporting period | ${esc(c.reportingPeriod)} |`, `| Generated | ${esc(meta.generatedAt)} |`, `| Content SHA-256 | \`${meta.sha256}\` |`, "");
  if (c.requirement.description) L.push(`**Requirement description (source):** ${c.requirement.description}`, "");
  L.push("## Data table", "", "| Field ID | Official label | Type | Unit | Mandatory | Value |", "|---|---|---|---|---|---|");
  for (const d of c.dataTable) L.push(`| ${esc(d.fieldId)} | ${esc(d.label)} | ${esc(d.dataType)} | ${esc(d.unit)} | ${esc(d.mandatory)} | ${esc(d.value ?? d.valueStatus)} |`);
  if (!c.dataTable.length) L.push("| — | No agency fields imported for this requirement | | | | |");
  L.push("", "## Evidence index", "", "| # | Mapping | Evidence ID | Value | Attachment | Locator |", "|---|---|---|---|---|---|");
  for (const e of c.evidenceIndex) L.push(`| ${e.number} | ${esc(e.mappingId)} | ${esc(e.evidenceId)} | ${esc(e.value)} | ${e.attachment ? `A${e.attachment}` : "—"} | ${esc(e.locator)} |`);
  if (!c.evidenceIndex.length) L.push("| — | No approved evidence | | | | |");
  L.push("", "## Attachments", "");
  for (const a of c.attachments) L.push(`${a.number}. **A${a.number}** ${a.filename} · period ${a.reportingPeriod || "not stated"} · SHA-256 \`${a.sha256}\``);
  if (!c.attachments.length) L.push("No attachments.");
  L.push("", "## Missing evidence and unresolved issues", "", ...c.issues.map(i => `- ${i}`), "", "## Provenance", "", `- Workbook: ${c.provenance.workbook} (SHA-256 \`${c.provenance.workbookSha256}\`), requirement row ${c.provenance.requirementSourceRow}`);
  for (const m of c.provenance.mappingRows) L.push(`- ${m.mappingId}: source row ${m.row}, status ${m.status}`);
  L.push("", `> ${c.certification}`, "");
  return L.join("\n");
}
