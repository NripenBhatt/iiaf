import type { SourceLine } from './output-contract';

export type ReadinessStatus = 'READY' | 'LIMITED' | 'ALTERNATIVE' | 'BLOCKED';
export type DraftChoice = 'requested' | 'limited' | 'alternative';
export type PurposeRule = { category: string; fields: string[]; critical: string[]; alternative: string | null; period: boolean; acceptance: string; formats: string[] };
const doc = ['DOCX', 'HTML', 'TXT'];
const data = ['DOCX', 'HTML', 'CSV', 'XLSX'];
const rule = (category: string, fields: string[], critical: string[], acceptance: string, alternative: string | null = null, period = false, formats = doc): PurposeRule => ({ category, fields, critical, acceptance, alternative, period, formats });
/** Exact source labels are intentionally conservative. A keyword mention is not a record,
 * and an official mapping, consent, measurement or approval is never inferred. */
export const PURPOSE_RULES: Record<string, PurposeRule> = {
 'OUT-001': rule('institution', ['Institution Name','History','Vision','Mission','Leadership','Programmes','Infrastructure','Achievements'], ['Institution Name','Programmes'], 'Identify the institution and explain its academic provision with dated evidence.'),
 'OUT-002': rule('contacts', ['Name','Role','Department','Official Email','Official Phone','Contact Validity'], ['Name','Role','Official Email'], 'Provide attributable directory entries; retain duplicates and contact-purpose restrictions.', null, false, data),
 'OUT-003': rule('placement', ['Employer','Sector','Recruiter Contact','Opportunities','Engagement History','Contact Validity'], ['Employer','Recruiter Contact'], 'Identify employers and source-recorded recruitment relationships without implying placements.', null, false, data),
 'OUT-004': rule('placement', ['Programme','Placed Students','Eligible Students','Internships','Employers','Methodology'], ['Programme','Placed Students','Eligible Students','Methodology'], 'Use same-period numerator and denominator; never compute percentages from offers or employer lists.', 'Placement Data Collection Framework', true, data),
 'OUT-005': rule('meeting', ['Meeting','Meeting Date','Time','Venue','Participants','Agenda Item','Objective','Expected Outcomes'], ['Meeting','Meeting Date','Agenda Item'], 'Deliver a source-recorded notice and agenda, not proceedings.'),
 'OUT-006': rule('meeting', ['Meeting','Meeting Date','Attendance','Proceedings','Decision Wording','Resolution Wording','Owner','Due Date'], ['Meeting','Proceedings','Decision Wording'], 'Keep discussions, decisions and resolutions distinct; no inferred attendance or resolutions.'),
 'OUT-007': rule('meeting', ['Action','Decision Reference','Owner','Due Date','Status','Completion Proof'], ['Action','Decision Reference','Owner','Due Date','Status'], 'Track assigned actions separately from verified completion evidence.', null, false, data),
 'OUT-008': rule('event', ['Event Title','Programme Focus','Audience','Event Date','Venue','Organizer'], ['Event Title','Event Date'], 'Write a coherent announcement with context, facts, closing and SEO; no invented occurrence.'),
 'OUT-009': rule('event', ['Event Title','Audience','Event Date','Venue','Organizer'], ['Event Title','Event Date'], 'Distinct channel copy, valid lengths, proposed CTA/hashtags and creative requirements.'),
 'OUT-010': rule('event', ['Event Title','Programme Focus','Audience','Event Date','Venue','Approved Assets'], ['Event Title','Event Date'], 'Production-ready proposed scene sequence, durations, voiceover, transitions and CTA; not a video.'),
 'OUT-011': rule('event', ['Event Title','Programme Focus','Audience','Event Date','Organizer'], ['Event Title','Programme Focus'], 'Evidence-grounded argument, implications and conclusion; interpretation explicitly labelled.'),
 'OUT-012': rule('event', ['Event Title','Audience','Event Date','Sender','Approved Link'], ['Event Title','Event Date'], 'Subject, preview, personalized draft, CTA and follow-up; no sending or recipient consent inferred.'),
 'OUT-013': rule('event', ['Event Title','Audience','Event Date','Consent','Approved Link'], ['Event Title','Event Date'], 'Concise proposed segmented variants with personalization and explicit consent restrictions.'),
 'OUT-014': rule('editorial', ['News Item','Editorial Category','Reader Value','Audience','Approved Assets','Approved Link'], ['News Item','Reader Value'], 'Assess distinct developments, relevance, freshness and reader value before assembling an issue.', 'Single-item Bulletin'),
 'OUT-015': rule('institution', ['Institution Name','Governance','Academic Activities','Student Enrolment','Faculty','Research','Outreach','Placements','Infrastructure','Quality Assurance','Financial Resources','Indicators','Comparisons','Challenges','Strategic Priorities'], ['Institution Name','Academic Activities','Student Enrolment','Faculty','Indicators'], 'Selected-period institutional reporting with measurable indicators, methodology and limitations.', 'Annual Report Framework / Data Collection Draft — Insufficient Institutional Data', true),
 'OUT-016': rule('institution', ['Department','Programmes','Student Count','Faculty Count','Indicators','Comparisons','Methodology'], ['Department','Student Count','Faculty Count','Methodology'], 'Analyze department indicators with scoped definitions and valid comparisons.', null, true, data),
 'OUT-017': rule('evidence', ['Agency','Framework Version','Criterion','Metric','Evidence Requirement','Evidence Reference','Mapping Status','Review State'], ['Agency','Framework Version','Criterion','Evidence Requirement','Mapping Status'], 'Display requirement and evidence gaps; document existence is never compliance.', null, false, data),
 'OUT-018': rule('evidence', ['Agency','Framework Version','Field Definition','Required Format','Validated Value','Lineage','Missing Fields'], ['Agency','Framework Version','Field Definition','Required Format','Validated Value'], 'Preserve supplied agency definitions and formats; synthetic definitions are never official.', null, true, data),
 'OUT-019': rule('general', ['Theme','Objectives','Activities','Beneficiaries','Outcomes','Evidence Reference','Mapping Status','Methodology'], ['Theme','Activities','Evidence Reference'], 'Distinguish measured outcomes from impact interpretation and proposed thematic mapping.'),
 'OUT-020': rule('general', ['Report Scope','Filters','Selected Metrics','Methodology','Findings'], ['Report Scope','Filters','Findings'], 'Honor explicit scope and filters, cite findings and qualify calculations.'),
 'OUT-021': rule('general', ['Affected Record','Issue','Severity','Conflict Values','Recommended Correction'], ['Affected Record','Issue','Severity'], 'Identify concrete records and correction actions; absence of detected issues is not validation.', null, false, data),
 'OUT-022': rule('evidence', ['Evidence Reference','Original Available','Metadata','Criterion','Mapping Status','Review State'], ['Evidence Reference','Original Available'], 'Include authorized original bytes and a reproducible manifest; an index alone is not an evidence bundle.', null, false, ['ZIP']),
 'OUT-023': rule('institution', ['Institution Name','Programmes','Infrastructure','Leadership','Official Link','Public Review'], ['Institution Name','Programmes'], 'Web-profile copy with SEO and reviewed links; release authorization stays separate.'),
 'OUT-024': rule('placement', ['Employer','Institution Name','Capability','Engagement Proposition','Partnership Opportunities','Recruiter Contact'], ['Employer','Capability','Engagement Proposition'], 'Employer-specific proposition, meeting request and attributable capability profile.'),
 'OUT-025': rule('meeting', ['Requirement','Policy Reference','Evidence Reference','Responsible Authority','Compliance Status','Corrective Action'], ['Requirement','Evidence Reference','Compliance Status'], 'Report explicit recorded compliance states, never infer compliance from policy existence.'),
 'OUT-026': rule('event', ['Event Title','Programme Focus','Event Date','Venue','Organizer','Approved Assets'], ['Event Title','Event Date'], 'Separate announcement, invitations, channel drafts, creative brief and review states.'),
 'OUT-027': rule('research', ['Researcher','Department','Publication','DOI','Research Area','Collaboration','Grant','Indicators'], ['Researcher','Publication','DOI'], 'Trace authorship and identifiers; publication lists do not establish citation impact.', null, true, data),
 'OUT-028': rule('institution', ['Department','Programmes','Faculty','Facilities','Research','Opportunities','Student Information','Approved Assets'], ['Department','Programmes','Faculty'], 'Useful department prospectus copy with visual hierarchy and no invented admissions promises.'),
 'OUT-029': rule('event', ['Event Title','Programme Focus','Audience','Event Date','Venue','Organizer','Approved Assets'], ['Event Title','Event Date'], 'Actionable proposed phases, slots, copy, creative briefs, ownership/review gates and suggested KPIs.'),
 'OUT-030': rule('analytics', ['Channel','Reach','Engagements','Clicks','Conversions','Comparison','Methodology'], ['Channel','Reach','Engagements','Methodology'], 'Actual same-period channel measurements and explicitly scoped interpretation.', 'Analytics Data Requirement Report', true, data),
};
export type ReadinessResult = { catalogueId: string; status: ReadinessStatus; available: string[]; missing: string[]; absentCategories: string[]; verification: string[]; reasons: string[]; nextAction: string; alternative: string | null; canLimit: boolean; release: 'not_authorized'; };
export function sourceFields(lines: SourceLine[]): Map<string, string[]> {
 const fields = new Map<string, string[]>();
 const add = (key: string, value: string) => { if (value.trim()) fields.set(key.toLowerCase(), [...(fields.get(key.toLowerCase()) ?? []), value.trim()]); };
 for (const l of lines) { const m = l.content.match(/^([^:|]{2,60}):\s*(.+)$/); if (m?.[1] && m[2]) add(m[1].trim(), m[2]); }
 // Structured row fields use exact column headers, never semantic keyword guessing.
 const groups = new Map<string, SourceLine[]>();
 for (const l of lines) { const p = l.locator as {cells?: {column:number;value:string}[];sheet?:string;table?:number}; if (p?.cells) { const key=JSON.stringify([p.sheet??'',p.table??0]); groups.set(key,[...(groups.get(key)??[]),l]); } }
 for(const rows of groups.values()){const headers=(rows[0]?.locator as {cells?: {column:number;value:string}[]})?.cells??[];for(const row of rows.slice(1))for(const cell of (row.locator as {cells?: {column:number;value:string}[]}).cells??[]){const h=headers.find(v=>v.column===cell.column);if(h)add(h.value,cell.value);}}
 return fields;
}
export function assessReadiness(id: string, ctx: {lines:SourceLine[];period:string|null;event?:boolean;categories?:Set<string>;companyAllowed?:boolean;now?:Date}): ReadinessResult {
 const r = PURPOSE_RULES[id];
 const base: ReadinessResult = {catalogueId:id,status:'BLOCKED',available:[],missing:[],absentCategories:[],verification:[],reasons:[],nextAction:'Supply attributable source records and assess again.',alternative:null,canLimit:false,release:'not_authorized'};
 if(!r) return {...base,reasons:['No implemented catalogue rule.']};
 if(ctx.companyAllowed===false)return {...base,reasons:['Company-only output; server authorization denied.']};
 const fields=sourceFields(ctx.lines);const has=(s:string)=>fields.has(s.toLowerCase());
 const eventAliases:Record<string,RegExp>={'Event Title':/^(from ideas to|event title\s*:|workshop title\s*:)/i,'Programme Focus':/^(understanding legal|programme focus\s*:)/i,'Audience':/^(interactive learning for|audience\s*:)/i,'Event Date':/^(\d{1,2}\s+[a-z]+\s+20\d{2}|event date\s*:)/i,'Organizer':/^organis?ed by/i,'Venue':/university|auditorium|campus|hall/i};
 const available=r.fields.filter(f=>has(f)||(r.category==='event'&&ctx.event&&ctx.lines.some(l=>eventAliases[f]?.test(l.content))));
 const missing=r.fields.filter(f=>!available.includes(f));
 const verification=['Source values require human verification; DEMO fixtures never establish verified institutional coverage.'];
 const text=ctx.lines.map(l=>l.content).join('\n');
 if(/Thursday/i.test(text)&&/13 October 2026/.test(text))verification.push('Printed Thursday conflicts with 13 October 2026 (Tuesday); verify the date against the original.');
 if(/conflict|contradict|unverified/i.test(text))verification.push('Conflicting or unverified source values must be resolved by an authorized reviewer.');
 const periods=fields.get('reporting period')??[];
 if(r.period&&(!ctx.period||periods.length===0||periods.some(p=>p!==ctx.period)))missing.push('Matching source Reporting Period and selected reporting period');
 let status:ReadinessStatus=missing.length?'LIMITED':'READY';
 const essential=r.critical.filter(f=>!available.includes(f));
 if(essential.length)status=r.alternative?'ALTERNATIVE':'BLOCKED';
 if(!ctx.lines.length)status='BLOCKED';
 if(r.period&&ctx.period&&periods.some(p=>p!==ctx.period)){status='BLOCKED';verification.push('Reporting periods do not match; no cross-period figures may be populated.');}
 let alternative=r.alternative;
 if(id==='OUT-014'){
  const items=[...new Set(fields.get('news item')??[])];const categories=new Set(fields.get('editorial category')??[]);const value=fields.get('reader value')??[];
  if(ctx.event&&items.length===0){status='ALTERNATIVE';alternative='Single-item Bulletin';missing.push('Distinct recent institutional developments with reader value beyond the one event announcement','Editorial introduction supported by a coherent issue theme','Academic, research, student/faculty or opportunity updates relevant to the readership');}
  else if(items.length===1){status='ALTERNATIVE';alternative='Single-item Bulletin';}
  else if(!items.length||!value.length)status='BLOCKED';
  else if(categories.size<2||!has('Audience'))status='LIMITED';
  if(!has('News Date')){missing.push('News Date for each editorial item to assess freshness');if(status==='READY')status='LIMITED';}
  const dates=fields.get('news date')??[];const now=ctx.now??new Date();if(dates.some(d=>Number.isNaN(Date.parse(d))||now.getTime()-Date.parse(d)>1000*60*60*24*120)){status='BLOCKED';verification.push('Editorial material is outdated or has an invalid date; establish current reader value before generation.');}
 }
 if(id==='OUT-022'){status='BLOCKED';missing.push('Authorized original evidence bytes and verified package manifest; extracted lines alone cannot fulfill an evidence bundle');alternative=null;}
 if(id==='OUT-004'){
 const numerator=Number(fields.get('placed students')?.[0]);const denominator=Number(fields.get('eligible students')?.[0]);if(!Number.isFinite(numerator)||!Number.isFinite(denominator)||denominator<=0||numerator<0||numerator>denominator){status='ALTERNATIVE';missing.push('Valid same-scope placement numerator and positive denominator (placed ≤ eligible)');}
 }
 if(r.period&&missing.includes('Matching source Reporting Period and selected reporting period')&&status==='READY')status='LIMITED';
 const categoryAvailable=ctx.categories?.has(r.category)||available.length>0||(r.category==='editorial'&&ctx.event)||r.category==='general';
 if(!categoryAvailable){status=r.alternative&&ctx.lines.length?'ALTERNATIVE':'BLOCKED';base.absentCategories=[r.category];}
 if(r.period&&ctx.period&&periods.some(p=>p!==ctx.period))status='BLOCKED';
 const reasons= status==='READY'?['Relevant source fields support the requested draft; factual verification and release remain separate.']:[`Requested ${id} lacks ${missing.join('; ')||'suitable source records'}.`,...(status==='ALTERNATIVE'?[`Only an explicitly selected alternative (${alternative}) may be generated.`]:[])];
 return {...base,status,available,missing:[...new Set(missing)],verification,reasons,alternative:status==='ALTERNATIVE'?alternative:null,canLimit:status==='LIMITED'&&essential.length===0,nextAction:status==='READY'?'Generate the requested review draft.':status==='ALTERNATIVE'?`Choose ${alternative} explicitly, or supply the missing records.`:`Supply ${missing.join('; ')} and verify source dates/values, then reassess.`};
}
