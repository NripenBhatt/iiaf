import { assessReadiness, PURPOSE_RULES, type ReadinessResult } from "./output-readiness";
import type { GeneratedOutput, SourceLine } from "./output-contract";

/** Shared Output Quality Standard. Statuses are categorical, never a numeric score:
 * COMPLETE — every output-specific requirement passed against the authorized source.
 * PARTIAL — a useful draft exists but named requirements remain unmet.
 * BLOCKED — essential source data or authorization is missing; nothing was generated.
 * NOT_IMPLEMENTED — no generation functionality exists for the catalogue ID. */
export type QualityStatus = "COMPLETE" | "PARTIAL" | "BLOCKED" | "NOT_IMPLEMENTED";
export type QualityCheck = { name: string; passed: boolean; detail: string };
export type QualityDimension = { name: string; status: QualityStatus; findings: string[] };
export type QualityResult = { catalogueId: string; status: QualityStatus; checks: QualityCheck[]; missing: string[]; dimensions?: QualityDimension[]; readiness?: ReadinessResult; nextAction?: string; release?: "not_authorized" };

/** Output-specific requirements: intended purpose, the exact section headings a complete
 * deliverable must contain, minimum developed length, minimum traced citations and the
 * export formats the persisted contract supports. These are per-output rules, not one
 * generic checklist. */
export type QualityRule = { purpose: string; requiredSections: string[]; minBodyChars: number; minCitations: number; exportFormats: string[] };
const TEXT_EXPORTS = ["TXT", "DOCX", "HTML", "CSV", "XLSX", "ZIP"];

export const QUALITY_REQUIREMENTS: Record<string, QualityRule> = {
  "OUT-001": { purpose: "Complete institutional profile, not a list of source passages.", requiredSections: ["Institution identity", "Academic provision", "Facilities and governance"], minBodyChars: 600, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-002": { purpose: "Structured contact directory with role, affiliation and available contact details.", requiredSections: ["People and units", "Source-recorded contact points", "Validity and privacy review"], minBodyChars: 400, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-003": { purpose: "Structured employer/recruiter directory.", requiredSections: ["Employers and sectors", "Recruitment relationships", "Employer contacts"], minBodyChars: 400, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-004": { purpose: "Placement and internship summary with reporting period and actual statistics.", requiredSections: ["Reporting scope", "Placements and offers", "Internships", "Duplicates and verification"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-005": { purpose: "Meeting notice and agenda pack.", requiredSections: ["Notice", "Agenda", "Briefing references"], minBodyChars: 300, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-006": { purpose: "Proper minutes, resolutions and decisions from explicit records.", requiredSections: ["Meeting record", "Proceedings", "Resolutions"], minBodyChars: 400, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-007": { purpose: "Action tracker with owners, deadlines and implementation status.", requiredSections: ["Actions", "Owners and deadlines", "Action-taken evidence"], minBodyChars: 300, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-008": { purpose: "Complete professional news article / website release.", requiredSections: ["Programme focus", "Event information", "Source and verification", "Cited source passages"], minBodyChars: 700, minCitations: 3, exportFormats: TEXT_EXPORTS },
  "OUT-009": { purpose: "Distinct platform-ready Facebook, Instagram, LinkedIn and X content.", requiredSections: [], minBodyChars: 80, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-010": { purpose: "Complete reel/story storyboard with scenes, timing, voiceover, on-screen text and creative direction; never claimed as rendered video.", requiredSections: ["Hook — 0–5 seconds", "Source context — 5–15 seconds", "Programme detail — 15–30 seconds", "Closing — 30–45 seconds"], minBodyChars: 400, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-011": { purpose: "Substantial LinkedIn thought-leadership article.", requiredSections: ["Context", "What the programme covers", "Looking ahead"], minBodyChars: 600, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-012": { purpose: "Complete email campaign draft with subject, body and CTA; no sending without authorization.", requiredSections: ["Subject"], minBodyChars: 300, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-013": { purpose: "WhatsApp-ready message variants with consent and eligibility gates.", requiredSections: ["Message draft"], minBodyChars: 200, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-014": { purpose: "Properly structured newsletter with multiple relevant content blocks and image/layout requirements.", requiredSections: ["In this issue", "Featured announcement", "Details at a glance", "Editorial notes"], minBodyChars: 600, minCitations: 3, exportFormats: TEXT_EXPORTS },
  "OUT-015": { purpose: "Comprehensive annual institutional report using actual reporting-period data.", requiredSections: ["Executive overview", "Reporting scope", "Academic activities", "Research and outreach", "Placement and outcomes", "Evidence gaps and conclusion"], minBodyChars: 800, minCitations: 3, exportFormats: TEXT_EXPORTS },
  "OUT-016": { purpose: "Department/academic analysis based on authorized academic records and validated methodology.", requiredSections: ["Scope", "Academic provision", "Source metrics", "Denominators and limitations"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-017": { purpose: "Accreditation/ranking evidence matrix using actual approved agency requirements and evidence mappings.", requiredSections: ["Methodology version", "Requirement references", "Source evidence", "Unresolved mapping"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-018": { purpose: "Agency submission dataset/report with required field validation.", requiredSections: ["Agency and cycle", "Submission fields", "Reconciliation", "Sign-off gaps"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-019": { purpose: "Thematic/SDG report with explicit methodology and evidence.", requiredSections: ["Theme and scope", "Source-supported activity", "Methodology", "Findings and limitations"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-020": { purpose: "Custom report based on a validated user-defined scope and authorized data.", requiredSections: ["Source scope", "Source-linked findings", "Tables and references", "Limits and conclusion"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-021": { purpose: "Data quality and conflict report with actual reconciliation findings.", requiredSections: ["Extraction reconciliation", "Review cautions", "Source findings"], minBodyChars: 400, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-022": { purpose: "Evidence bundle with source files, references and manifests.", requiredSections: ["Bundle index", "Source lineage", "Requirement references", "Rights and completeness"], minBodyChars: 400, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-023": { purpose: "Professional institutional web profile.", requiredSections: ["Institution overview", "Academic provision", "Public contact review"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-024": { purpose: "Employer outreach pack with appropriate audience-specific content.", requiredSections: ["Employer segmentation", "Outreach message", "Relationship context", "Recipient eligibility"], minBodyChars: 400, minCitations: 1, exportFormats: TEXT_EXPORTS },
  "OUT-025": { purpose: "Governance compliance report based on decisions, actions and implementation evidence.", requiredSections: ["Governance scope", "Decisions", "Action status", "Implementation evidence"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-026": { purpose: "Complete event publicity pack with article, invitations, social content and visual creative requirements.", requiredSections: ["Poster copy", "Website blurb", "Press note", "Email invitation", "WhatsApp invitation"], minBodyChars: 800, minCitations: 3, exportFormats: TEXT_EXPORTS },
  "OUT-027": { purpose: "Research/publication profile with verified records and identifiers.", requiredSections: ["Research scope", "Publications", "Projects and grants", "Identifiers and duplicates"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-028": { purpose: "Professional department brochure/prospectus content.", requiredSections: ["Department introduction", "Programmes", "Faculty and facilities", "Prospectus verification"], minBodyChars: 500, minCitations: 2, exportFormats: TEXT_EXPORTS },
  "OUT-029": { purpose: "Professional social media campaign calendar.", requiredSections: ["Campaign overview and objectives", "Communication goals", "Target audiences", "Campaign phases", "Content pillars", "Publication schedule", "Platform-specific strategy", "Post copy", "Creative and image requirements", "Hashtag and CTA strategy", "Source references", "Approval, publishing and scheduling status", "Performance indicators"], minBodyChars: 1500, minCitations: 3, exportFormats: TEXT_EXPORTS },
  "OUT-030": { purpose: "Communication performance report using actual analytics data.", requiredSections: ["Platform and date window", "Recorded engagement", "Performance analysis", "Data limitations"], minBodyChars: 400, minCitations: 1, exportFormats: TEXT_EXPORTS },
};

/** Repetitive/generic filler detection: a sentence repeated three or more times, or a body
 * whose unique lines are under half of all lines, fails the developed-content check. */
function fillerFinding(body: string): string | null {
  const sentences = body.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 30);
  const counts = new Map<string, number>();
  for (const s of sentences) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const [s, n] of counts) if (n >= 3) return `Sentence repeated ${n} times: “${s.slice(0, 60)}…”`;
  const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length >= 8 && new Set(lines).size < lines.length / 2) return "More than half of the body lines are duplicates.";
  return null;
}

export type QualityContext = { lines: SourceLine[]; segmentIds: string[]; period?: string | null };

/** Assess one generated output against its catalogue-specific rule. Persisted payloads are
 * never modified; this is a computed assessment layered on generation and readback. */
export function assessOutput(id: string, output: GeneratedOutput, ctx: QualityContext): QualityResult {
  const rule = QUALITY_REQUIREMENTS[id];
  if (!rule) return { catalogueId: id, status: "NOT_IMPLEMENTED", checks: [{ name: "Generation functionality", passed: false, detail: "No quality rule or handler exists for this catalogue ID." }], missing: ["Generation functionality"] };
  const checks: QualityCheck[] = [];
  const body = output.body ?? "";

  const absentSections = rule.requiredSections.filter(s => !body.includes(s));
  checks.push({ name: "Required sections", passed: absentSections.length === 0, detail: absentSections.length ? `Missing sections: ${absentSections.join("; ")}` : `All ${rule.requiredSections.length} required sections present.` });

  const developed = body.length >= rule.minBodyChars;
  checks.push({ name: "Content development", passed: developed, detail: developed ? `Body length ${body.length} characters meets the ${rule.minBodyChars} minimum for this output.` : `Body length ${body.length} characters is below the ${rule.minBodyChars} minimum; content is not sufficiently developed.` });

  const filler = fillerFinding(body);
  checks.push({ name: "No repetitive or generic filler", passed: !filler, detail: filler ?? "No repeated-sentence or duplicate-line filler detected." });

  const citations = output.draft?.citations ?? [];
  const validCitations = citations.filter(c => ctx.segmentIds.includes(c.segmentId) && ctx.lines.some(l => l.locator_key === c.locatorKey && l.content === c.raw && ctx.segmentIds[ctx.lines.indexOf(l)] === c.segmentId));
  checks.push({ name: "Citation traceability", passed: citations.length > 0 && validCitations.length === citations.length, detail: citations.length ? `${validCitations.length}/${citations.length} citations trace exactly to authorized source segments.` : "No citations recorded." });
  checks.push({ name: "Citation coverage", passed: validCitations.length >= rule.minCitations, detail: `${validCitations.length} traced citations against a minimum of ${rule.minCitations} for this output.` });

  const missing = output.draft?.missing ?? [];
  checks.push({ name: "Missing data declared", passed: true, detail: missing.length ? `Declared missing inputs: ${missing.join("; ")}` : "No missing inputs declared." });

  const isText = output.contract.mimeType === "text/markdown";
  checks.push({ name: "Format and export availability", passed: isText || output.contract.mimeType === "image/png", detail: isText ? `Text draft; exports available: ${rule.exportFormats.join(", ")}.` : `Persisted ${output.contract.mimeType} artifact with PNG download.` });

  const restrictionsPreserved = output.contract.release === "not_authorized" && output.contract.approver === null && output.manifest?.verifiedCoverage === false;
  checks.push({ name: "Approval and publication restrictions preserved", passed: restrictionsPreserved, detail: restrictionsPreserved ? "Release not authorized, no approver, zero verified coverage." : "Restriction state weakened — this output must not be treated as releasable." });

  const fields = PURPOSE_RULES[id];
  const readiness = assessReadiness(id, { lines:ctx.lines, period:ctx.period ?? null, event:/announc|programme|workshop/i.test(body) });
  const alternative = /explicitly selected alternative|Single-item Bulletin|Data Collection Draft/i.test(`${output.name} ${output.title} ${body}`);
  const factualNumbers = [...body.matchAll(/\b\d+(?:\.\d+)?%/g)].map(m=>m[0]);
  const unsupportedNumbers = factualNumbers.filter(n=>!ctx.lines.some(l=>l.content.includes(n)));
  const claimLines = body.split(/\n|(?<=[.!?])\s+/).filter(line=>!/^\s*(?:>|Source:)/.test(line)&&!/(?:not |no |unconfirmed|not confirmation|not established|requires? .*review|not authorized)/i.test(line));
  const substantiveClaims = claimLines.some(line=>/(?:was held|took place|achieved|attended by|approved by|certified compliant|placement rate is)\s/i.test(line)&&!ctx.lines.some(source=>source.content.includes(line.trim())));
  checks.push({ name:"Unsupported factual claims",passed:unsupportedNumbers.length===0&&!substantiveClaims,detail:unsupportedNumbers.length||substantiveClaims?"Unattested outcome/approval claim or percentage requires exact source support and calculation provenance.":"No recognized unsupported outcome/approval claim or percentage detected; this is a bounded check, not semantic fact verification." });
  checks.push({name:"Correct document classification",passed:!((id==="OUT-014"||id==="OUT-015")&&readiness.status==="ALTERNATIVE"&&!alternative),detail:alternative?"Clearly identified alternative; never the completed requested deliverable.":readiness.status==="ALTERNATIVE"?"Source does not justify the requested document classification.":"Requested classification remains subject to source sufficiency."});
  const traced = checks.find(c=>c.name==="Citation traceability")?.passed ?? false;
  const functional = readiness.status==="READY"&&!alternative&&!!fields&&output.meeting?.validation!=="incomplete"&&output.meeting?.validation!=="ambiguous";
  const dimension=(name:string,passed:boolean,findings:string[]):QualityDimension=>({name,status:passed?"COMPLETE":"PARTIAL",findings});
  const dimensions:QualityDimension[]=[
   dimension("Structural completeness",absentSections.length===0,[checks[0]?.detail??"Structure unassessed"]),
   dimension("Factual integrity",false,[traced?"Citations match exact authorized segment/locator/value triples.":"Citation traceability failed.","Human factual verification is not established; source citations alone cannot prove every generated claim.",...unsupportedNumbers.map(n=>`Unsupported percentage: ${n}`)]),
   dimension("Functional completeness",functional,[fields?.acceptance??"No purpose rule",...readiness.reasons,alternative?"Alternative purpose only; requested deliverable remains incomplete.":"Purpose-specific readiness required."]),
   dimension("Professional quality",false,[filler??"No recognized repetitive filler detected.","Professional editorial acceptance has not been recorded; length and headings are supporting checks only."]),
   dimension("Practical usability",functional&&!filler,[functional?"Relevant required source fields available; intended-team acceptance remains separate.":readiness.nextAction]),
   dimension("Release readiness",false,[restrictionsPreserved?"Restrictions preserved: approval, consent and publication remain unauthorized.":"Release safeguards failed; reject this output."]),
  ];
  const hardFailed=!traced||!restrictionsPreserved||unsupportedNumbers.length>0||substantiveClaims;
  const status:QualityStatus=hardFailed?"BLOCKED":readiness.status==="BLOCKED"&&!alternative?"BLOCKED":"PARTIAL";
  return { catalogueId:id,status,checks,missing:[...new Set([...missing,...readiness.missing])],dimensions,readiness,nextAction:hardFailed?"Resolve citation/factual/release failures before use.":readiness.nextAction,release:"not_authorized" };

}

/** Assess every catalogue ID in a generation result: generated outputs are assessed against
 * their rules; skipped IDs are BLOCKED with the recorded reason; unknown IDs are NOT_IMPLEMENTED. */
export function assessSet(outputs: GeneratedOutput[], skipped: { name: string; reason: string }[], ctx: QualityContext): Record<string, QualityResult> {
  const results: Record<string, QualityResult> = {};
  for (const output of outputs) {
    const id = output.catalogue?.catalogueId;
    if (!id) continue;
    const result = assessOutput(id, output, ctx);
    const existing = results[id];
    // A successful channel cannot hide a sibling failure; aggregate conservatively.
    if (!existing) results[id] = result;
    else results[id] = {...existing,status:existing.status === "BLOCKED" || result.status === "BLOCKED" ? "BLOCKED" : "PARTIAL",checks:[...existing.checks,...result.checks],missing:[...new Set([...existing.missing,...result.missing])]};
  }
  for (const skip of skipped) {
    const id = skip.name.split(":")[0] ?? skip.name;
    if (results[id]) continue;
    results[id] = { catalogueId: id, status: QUALITY_REQUIREMENTS[id] ? "BLOCKED" : "NOT_IMPLEMENTED", checks: [{ name: "Source data and authorization", passed: false, detail: skip.reason }], missing: [skip.reason] };
  }
  return results;
}
