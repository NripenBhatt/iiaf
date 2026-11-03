import type { SourceLine } from './output-contract';
import { sourceFields } from './output-readiness';

/** Rendering never promotes source assertions to verified institutional facts. */
const values = (lines: SourceLine[], key: string) => [...new Set(sourceFields(lines).get(key.toLowerCase()) ?? [])];
const section = (heading: string, content: string) => `## ${heading}\n\n${content}`;
const statement = (lines: SourceLine[], label: string, lead: string) => {
  const v = values(lines, label);
  if (!v.length) return `${label}: no attributable information supplied.`;
  if (v.length > 1) return `${label} has alternative source values requiring review:\n${v.map(s => `- ${s}`).join('\n')}`;
  return `${lead} ${v[0]}.`;
};
const join = (parts: string[]) => parts.join('\n\n');
const list = (lines: SourceLine[], keys: string[]) => keys.map(k => statement(lines, k, `${k} recorded in the source:`)).join('\n\n');

/** Row association is retained; flattened lists are not zipped into invented records. */
export function labelledRecords(lines: SourceLine[], anchor: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  for (const line of lines) {
    const m = line.content.match(/^([^:|]{2,60}):\s*(.+)$/);
    if (!m?.[1] || !m[2]) continue;
    const key = m[1].trim().toLowerCase();
    if (key === anchor.toLowerCase() && current[anchor.toLowerCase()]) { result.push(current); current = {}; }
    if (current[key] && current[key] !== m[2].trim()) current[key] = `${current[key]} [CONFLICT] ${m[2].trim()}`;
    else current[key] = m[2].trim();
  }
  if (current[anchor.toLowerCase()]) result.push(current);
  const groups = new Map<string, SourceLine[]>();
  for (const line of lines) {
    const p = line.locator as { cells?: { column: number; value: string }[]; sheet?: string; table?: number };
    if (!p?.cells) continue;
    const key = JSON.stringify([p.sheet ?? '', p.table ?? 0]);
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  for (const rows of groups.values()) {
    const headers = (rows[0]?.locator as { cells?: { column: number; value: string }[] })?.cells ?? [];
    for (const row of rows.slice(1)) {
      const record: Record<string, string> = {};
      for (const cell of (row.locator as { cells?: { column: number; value: string }[] })?.cells ?? []) {
        const header = headers.find(h => h.column === cell.column)?.value.toLowerCase();
        if (header) record[header] = cell.value;
      }
      if (record[anchor.toLowerCase()]) result.push(record);
    }
  }
  return result;
}

export type DerivedRate = { label: string; numerator: number; denominator: number; basis: string; value: string };
const numeric = (raw: string | undefined): number | null => raw !== undefined && /^\d+(?:\.\d+)?$/.test(raw.trim()) ? Number(raw) : null;
export function derivedRate(label: string, numeratorRaw: string | undefined, denominatorRaw: string | undefined, basis: string): DerivedRate | null {
  const numerator = numeric(numeratorRaw), denominator = numeric(denominatorRaw);
  if (numerator === null || denominator === null || denominator <= 0 || numerator > denominator) return null;
  return { label, numerator, denominator, basis, value: `${(numerator / denominator * 100).toFixed(2)}%` };
}
export function sourceRates(id: string, lines: SourceLine[], period: string | null): DerivedRate[] {
  if (!period) return [];
  const anchor = id === 'OUT-004' ? 'Programme' : 'Channel';
  return labelledRecords(lines, anchor).flatMap(r => {
    if (r['reporting period'] !== period || !r['methodology'] || Object.values(r).some(v => v.includes('[CONFLICT]'))) return [];
    const basis = `${r[anchor.toLowerCase()]}; ${period}; ${r['methodology']}`;
    const rates = id === 'OUT-004'
      ? [derivedRate('Placement rate', r['placed students'], r['eligible students'], basis)]
      : [derivedRate('Engagement rate (reach basis)', r['engagements'], r['reach'], basis), derivedRate('Click-through rate (impressions basis)', r['clicks'], r['impressions'], basis), derivedRate('Conversion rate (click basis)', r['conversions'], r['clicks'], basis)];
    return rates.filter((v): v is DerivedRate => v !== null);
  });
}
const rateText = (r: DerivedRate) => `${r.label}: ${r.value} — derived = ${r.numerator} ÷ ${r.denominator} × 100; basis: ${r.basis}. This is calculated from source-recorded, unverified figures, not a measured platform percentage.`;

export function editorialBody(lines: SourceLine[], bulletin: boolean): string {
  const records = labelledRecords(lines, 'News Item');
  const title = bulletin ? 'Single-item Bulletin' : 'Institutional Newsletter — editorial review draft';
  const categories = [...new Set(records.map(r => r['editorial category'] ?? 'Editorial grouping unconfirmed'))];
  return join([
    `# ${title}`,
    `Issue preparation date: ${new Date().toISOString().slice(0, 10)} (not a source event date or approved issue date).\nAudience: ${values(lines, 'Audience').join('; ') || 'Not supplied'}.`,
    section('Editorial introduction', `This issue brings together ${records.length} source-recorded development${records.length === 1 ? '' : 's'} across ${categories.join(' and ')}. The selection below explains the relevance recorded for readers; all items remain subject to factual and editorial review.`),
    section('In this issue', records.map((r, i) => `${i + 1}. ${r['news item']}`).join('\n')),
    section('Featured announcement', records[0]?.['news item'] ?? 'No attributable item supplied.'),
    ...categories.map(category => section(category, records.filter(r => (r['editorial category'] ?? 'Editorial grouping unconfirmed') === category).map(r => join([
      `### ${r['news item']}`,
      `The source records: ${r['news item']}.`,
      r['news detail'] ? r['news detail'] : 'Further details have not been supplied; no expansion of the announcement is inferred.',
      `Why this matters to readers: ${r['reader value'] ?? 'Reader value not established for this item.'}`,
      `Recorded item date: ${r['news date'] ?? 'Not supplied'}.`,
      r['approved link'] && /^https:\/\//.test(r['approved link']) ? `Source-recorded link (review required): ${r['approved link']}` : 'No reviewed item link supplied.',
    ])).join('\n\n'))),
    section('Details at a glance', `${records.length} distinct items; ${categories.length} recorded editorial categories. Images, links, item details and issue date require editorial confirmation; none are invented.`),
    section('Closing editorial section', 'Readers can use the source-recorded updates to identify relevant developments. Check the original references before acting; corrections and fuller item details should be obtained from the issuing unit.'),
    section('Editorial notes', `${bulletin ? 'Explicitly selected alternative: this is not a full institutional newsletter.' : 'Composed multi-item issue, not a field listing. Content sufficiency and institutional acceptance remain separate.'} Human review required. No public release or sending authorized.`),
  ]);
}

/** Purpose-specific deterministic documents. Unsupported categories remain explicit gaps. */
export function purposeBody(id: string, lines: SourceLine[], period: string | null): string | null {
  const scope = `Reporting scope: ${period ?? 'not supplied'}. Only the current source is used; institutional completeness and factual verification are not established.`;
  if (id === 'OUT-001') return join([
    '# Institutional profile — source-supported draft',
    section('Institution identity', statement(lines, 'Institution Name', 'This profile concerns')),
    section('Background and historical development', statement(lines, 'History', 'The recorded institutional background is')),
    section('Vision, mission and institutional philosophy', list(lines, ['Vision', 'Mission'])),
    section('Governance and leadership', statement(lines, 'Leadership', 'The source identifies the following leadership or governance body:')),
    section('Academic provision', statement(lines, 'Programmes', 'The institution’s recorded academic provision comprises')),
    section('Research, innovation and initiatives', list(lines, ['Research', 'Initiatives'])),
    section('Facilities and governance', list(lines, ['Infrastructure', 'Student Support'])),
    section('Distinctive strengths and positioning', statement(lines, 'Achievements', 'The source records the following institutional development:') + '\nThese assertions do not establish comparative standing, ranking or independently verified achievement.'),
    section('Information gaps', 'Confirm current snapshot, governance authority, historical dates, student support and approval. Missing categories remain unavailable rather than being filled with promotional claims.'),
  ]);
  if (id === 'OUT-004') return join([
    '# Placement and internship summary — unverified source cohort', section('Reporting scope', scope),
    section('Placements and offers', labelledRecords(lines, 'Programme').map(r => `### ${r['programme']}\nRecorded placed students: ${r['placed students'] ?? 'Missing'}; eligible students: ${r['eligible students'] ?? 'Missing'}. Offers are not counted as placed students; individual verification and duplicate reconciliation have not been demonstrated.`).join('\n\n')),
    section('Derived cohort indicators', sourceRates(id, lines, period).map(rateText).join('\n') || 'Rates withheld: aligned cohort, positive denominator and calculation methodology are required.'),
    section('Internships', statement(lines, 'Internships', 'The source separately records internships:')),
    section('Employer engagement', statement(lines, 'Employers', 'The source names the following employers:')),
    section('Duplicates and verification', 'Aggregates do not demonstrate unique-student verification. Reconcile student IDs, offer/placement status and same-period eligibility before institutional use. No completion or placement outcome is inferred from a recruiter list.'),
    section('Recommended follow-up', 'Ask the placement unit to validate the cohort and reconcile duplicates; obtain internship duration/status and attributable offer records. This is a review action, not an approved institutional decision.'),
  ]);
  if (id === 'OUT-015') return join([
    '# Annual institutional report — source-supported review draft',
    section('Executive overview', `${scope}\n${statement(lines, 'Institution Name', 'The reporting institution is')} ${statement(lines, 'Academic Activities', 'Recorded academic work includes')} This report organizes supplied records; it does not certify annual coverage.`),
    section('Reporting scope', scope),
    section('Institutional overview', list(lines, ['Institution Name', 'History', 'Mission'])),
    section('Governance and administration', list(lines, ['Governance', 'Leadership'])),
    section('Academic activities', statement(lines, 'Academic Activities', 'During the selected source period, the academic record describes')),
    section('Students and human resources', list(lines, ['Student Enrolment', 'Faculty'])),
    section('Research and outreach', list(lines, ['Research', 'Outreach'])),
    section('Placement and outcomes', statement(lines, 'Placements', 'The recorded placement information is')),
    section('Quality assurance', statement(lines, 'Quality Assurance', 'The source describes the following quality work:')),
    section('Infrastructure and financial resources', list(lines, ['Infrastructure', 'Financial Resources'])),
    section('Indicators and comparisons', list(lines, ['Indicators', 'Comparisons']) + '\nNo year-on-year percentage or chart is created without aligned definitions, periods and numeric records.'),
    section('Challenges and improvement priorities', list(lines, ['Challenges', 'Strategic Priorities']) + '\nProposed follow-up: ask responsible units to confirm scope, attribution and supporting records; these recommendations are not approved actions.'),
    section('Evidence gaps and conclusion', 'The supplied institutional record is not proof of a complete annual evidence base. Confirm every chapter’s period and source coverage, financial authority, student progression and quantitative definitions before approving the report.'),
  ]);
  if (id === 'OUT-017') return join([
    '# Requirement-to-evidence gap matrix — not compliance certification',
    section('Methodology version', list(lines, ['Agency', 'Framework Version']) + '\nSource-recorded framework labels are not independently authenticated official definitions.'),
    section('Requirement references', list(lines, ['Criterion', 'Metric', 'Evidence Requirement'])),
    section('Source evidence', labelledRecords(lines, 'Agency').map(r => `Requirement: ${r['evidence requirement'] ?? 'Missing'}\nEvidence reference: ${r['evidence reference'] ?? 'Missing'}\nMapping status as recorded: ${r['mapping status'] ?? 'Missing'}\nReview state: ${r['review state'] ?? 'Missing'}`).join('\n\n')),
    section('Unresolved mapping', 'Candidate or unresolved references remain gaps. Document existence is not coverage, compliance or approval. Use only independently reviewed official edition and approved bindings in an authorized submission.'),
    section('Reviewer worklist', 'Confirm exact criterion wording and edition; review evidence sufficiency and scope; record missing files and decisions through the existing governed review process. No mapping is changed by this document.'),
  ]);
  if (id === 'OUT-021') return join([
    '# Data quality and conflict report',
    section('Extraction reconciliation', `${lines.length} current-run segments. This count does not prove completeness of the original document.`),
    section('Source findings', labelledRecords(lines, 'Affected Record').map(r => `### Record ${r['affected record']}\nIssue: ${r['issue'] ?? 'Not supplied'}.\nRecorded severity: ${r['severity'] ?? 'Not assessed'}.\nConflicting values: ${r['conflict values'] ?? 'Not supplied'}.\nProposed correction: ${r['recommended correction'] ?? 'Request reviewer diagnosis; do not change the source.'}`).join('\n\n') || 'No attributable issue records supplied; no clean-data verdict can be made.'),
    section('Review cautions', 'Severity and suggested corrections are source assertions, not authorized dispositions. Preserve both conflict values and compare the unchanged original; absence of detected conflicts is not validation.'),
    section('Correction worklist', 'Assign a reviewer, confirm the affected locator, resolve the discrepancy with the issuing unit, and append an audited decision using existing review controls. This draft changes no records.'),
  ]);
  if (id === 'OUT-025') return join([
    '# Governance compliance review — recorded states only',
    section('Governance scope', scope),
    section('Decisions and requirements', labelledRecords(lines, 'Requirement').map(r => `### ${r['requirement']}\nPolicy reference: ${r['policy reference'] ?? 'Missing'}\nResponsible authority: ${r['responsible authority'] ?? 'Missing'}\nRecorded compliance state: ${r['compliance status'] ?? 'Not assessed'}\nEvidence: ${r['evidence reference'] ?? 'Missing'}\nCorrective action as recorded: ${r['corrective action'] ?? 'Not supplied'}`).join('\n\n')),
    section('Action status', 'A recorded policy or proposed corrective action does not establish compliance or implementation. Assigned, completed and independently verified actions must remain separate.'),
    section('Implementation evidence', statement(lines, 'Evidence Reference', 'Implementation-related source reference:') + '\nOriginal sufficiency and approved compliance review have not been demonstrated.'),
    section('Recommended review', 'Ask the responsible authority to verify each explicit state, identify overdue or unsupported requirements, and attach dated implementation proof before concluding compliance. No state is silently upgraded.'),
  ]);
  if (id === 'OUT-027') return join([
    '# Research and publication profile — attributable review draft', section('Research scope', scope + '\n' + list(lines, ['Researcher', 'Department', 'Research Area'])),
    section('Publications', labelledRecords(lines, 'Researcher').map(r => `Researcher as recorded: ${r['researcher']}\nPublication: ${r['publication'] ?? 'Missing'}\nIdentifier as recorded: ${r['doi'] ?? 'Missing'}. Authorship and identifier registration require verification; no external registry lookup has been performed.`).join('\n\n')),
    section('Projects and grants', list(lines, ['Grant', 'Collaboration'])),
    section('Research indicators', statement(lines, 'Indicators', 'Research indicators as recorded:') + '\nA publication list does not establish citation impact, ranking or research excellence.'),
    section('Identifiers and duplicates', 'Compare full title, authors, year and registered identifier before merging records. Retain unresolved identifiers and alternatives. No citation counts, grants or endorsements are inferred.'),
  ]);
  if (id === 'OUT-030') return join([
    '# Communication performance report — source-recorded metrics', section('Platform and date window', scope),
    section('Recorded engagement', labelledRecords(lines, 'Channel').map(r => `### ${r['channel']}\nReach: ${r['reach'] ?? 'Missing'}; engagements: ${r['engagements'] ?? 'Missing'}; impressions: ${r['impressions'] ?? 'Missing'}; clicks: ${r['clicks'] ?? 'Missing'}; conversions: ${r['conversions'] ?? 'Missing'}.\nSource methodology: ${r['methodology'] ?? 'Missing'}.`).join('\n\n')),
    section('Performance analysis', sourceRates(id, lines, period).map(rateText).join('\n\n') || 'Derived rates withheld: missing or conflicting denominators, scope or methodology.'),
    section('Comparative performance', statement(lines, 'Comparison', 'Comparative information supplied:') + '\nNo uplift or channel ranking is inferred without paired windows and equivalent measurement definitions.'),
    section('Strengths, limitations and recommendations', 'Available reach, interactions and clicks describe different stages of response, not proven impact. Where conversion counts exist, examine the click-to-conversion step separately; where impressions are absent, obtain them before claiming CTR. Proposed follow-up: reconcile channel exports and campaign IDs, review attribution windows, and compare equivalent periods before allocating resources.'),
    section('Data limitations', 'Rates are deterministic calculations from unverified source records. DEMO figures are illustrative only, never actual institutional performance. Repeated engagement counts may require a different approved methodology; unsupported or ambiguous calculations are withheld. Platform authentication, campaign effectiveness and release approval are not established.'),
  ]);
  // Remaining non-event outputs receive named operational records, not a common field/value table.
  const specifications: Record<string, [string, string[]][]> = {
    'OUT-002': [['People and units', ['Name','Role','Department']], ['Source-recorded contact points',['Official Email','Official Phone']], ['Validity and privacy review',['Contact Validity']]],
    'OUT-003': [['Employers and sectors',['Employer','Sector']], ['Recruitment relationships',['Opportunities','Engagement History']], ['Employer contacts',['Recruiter Contact','Contact Validity']]],
    'OUT-016': [['Scope',['Department','Methodology']], ['Academic provision',['Programmes']], ['Source metrics',['Student Count','Faculty Count','Indicators']], ['Denominators and limitations',['Comparisons']]],
    'OUT-018': [['Agency and cycle',['Agency','Framework Version']], ['Submission fields',['Field Definition','Required Format','Validated Value']], ['Reconciliation',['Lineage','Missing Fields']], ['Sign-off gaps',['Review State']]],
    'OUT-019': [['Theme and scope',['Theme','Objectives','Methodology']], ['Source-supported activity',['Activities','Beneficiaries']], ['Methodology',['Mapping Status']], ['Findings and limitations',['Outcomes','Evidence Reference']]],
    'OUT-020': [['Source scope',['Report Scope','Filters','Methodology']], ['Source-linked findings',['Findings']], ['Tables and references',['Selected Metrics']], ['Limits and conclusion',['Evidence Reference']]],
    'OUT-023': [['Institution overview',['Institution Name','Infrastructure']], ['Academic provision',['Programmes','Leadership']], ['Public contact review',['Official Link','Public Review']]],
    'OUT-024': [['Employer segmentation',['Employer']], ['Outreach message',['Engagement Proposition','Partnership Opportunities']], ['Relationship context',['Institution Name','Capability']], ['Recipient eligibility',['Recruiter Contact']]],
    'OUT-028': [['Department introduction',['Department']], ['Programmes',['Programmes','Opportunities']], ['Faculty and facilities',['Faculty','Facilities','Research']], ['Prospectus verification',['Student Information','Approved Assets']]],
  };
  const spec = specifications[id];
  return spec ? join([`# Purpose-specific source review draft`, scope, ...spec.map(([heading, keys]) => section(heading, list(lines, keys))), section('Practical review actions', 'Confirm each recorded assertion with its issuing unit and current scope; missing values are not inferred. This source review document does not establish professional acceptance, approved mappings, consent or release.')]) : null;
}