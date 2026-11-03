import { assessReadiness, sourceFields, PURPOSE_RULES, type DraftChoice } from "./output-readiness";
import reference from "@/data/output-reference-catalogue.json";
import { eventContent } from "./source-authored";
import { publicationCopy } from "./publication-copy";
import { sourceTables, type GeneratedOutput, type SourceLine, type SourceManifest } from "./output-contract";
import { structuredMeetings } from "./meeting-contract";
import { editorialBody, purposeBody } from "./purpose-content";

export type HandlerContext = { lines: SourceLine[]; segmentIds: string[]; manifest: SourceManifest; company: boolean; period: string | null; choices?: Record<string, DraftChoice> };

/** Source categories an output may draw on. Retrieval is category-aware: an event
 * poster can never satisfy placement, institutional, evidence or analytics outputs. */
export type SourceCategory = "event" | "meeting" | "placement" | "contacts" | "institution" | "research" | "evidence" | "analytics" | "general";
type Definition = { type: string; signal: RegExp; category: SourceCategory; sections: string[]; missing: string[] };

/** Each catalogue handler has its own source category, structure and unmet input gates. */
export const CATALOGUE_HANDLERS: Record<string, Definition> = {
  "OUT-001": { type:"institutional_profile", category:"institution", signal:/institution name|university|campus|programme/i, sections:["Institution identity","Academic provision","Facilities and governance"], missing:["Profile approval and current snapshot"] },
  "OUT-002": { type:"contact_directory", category:"contacts", signal:/email|phone|contact|@[\w.-]+\./i, sections:["People and units","Source-recorded contact points","Validity and privacy review"], missing:["Verified contact validity; consent and purpose"] },
  "OUT-003": { type:"employer_directory", category:"placement", signal:/employer|recruiter|company|placement/i, sections:["Employers and sectors","Recruitment relationships","Employer contacts"], missing:["Contact purpose, confidentiality and source dates"] },
  "OUT-004": { type:"placement_summary", category:"placement", signal:/placement|internship|offer|recruiter/i, sections:["Reporting scope","Placements and offers","Internships","Duplicates and verification"], missing:["Verified placement status and complete reporting period"] },
  "OUT-005": { type:"agenda_summary", category:"meeting", signal:/agenda|कार्यसूची/i, sections:["Notice","Agenda","Briefing references"], missing:["Meeting metadata and access classification"] },
  "OUT-006": { type:"meeting_report", category:"meeting", signal:/minutes|proceedings|resolution|कार्यवृत्त|निर्णय/i, sections:["Meeting record","Proceedings","Resolutions"], missing:["Minutes approval and supplied attendance"] },
  "OUT-007": { type:"action_items", category:"meeting", signal:/action|due date|owner|कार्य/i, sections:["Actions","Owners and deadlines","Action-taken evidence"], missing:["Owner, status, period and implementation evidence"] },
  "OUT-008": { type:"news_article", category:"event", signal:/event|workshop|seminar|conference|कार्यशाला/i, sections:["Lead","Programme focus","People and institutions","Event information","Source and verification"], missing:["Factual and public-release approval; occurrence unconfirmed"] },
  "OUT-009": { type:"social_variants", category:"event", signal:/event|workshop|research|achievement/i, sections:["Platform variants"], missing:["Channel approval and publication rights"] },
  "OUT-010": { type:"reel_script", category:"event", signal:/event|workshop|seminar/i, sections:["Hook — 0–5 seconds","Source context — 5–15 seconds","Programme detail — 15–30 seconds","Closing — 30–45 seconds"], missing:["Approved assets, rights, voiceover and participant consent; not rendered video"] },
  "OUT-011": { type:"linkedin_article", category:"event", signal:/research|workshop|leadership|institution/i, sections:["Opening","Context","What the programme covers","Organizers","Looking ahead"], missing:["Author approval; no attributed quote unless supplied"] },
  "OUT-012": { type:"email_campaign", category:"event", signal:/event|workshop|email|audience/i, sections:["Subject","Email body","Recipient segment","Schedule and opt-out review"], missing:["Lawful basis, opt-out, sender authorization and actual recipients; no sending"] },
  "OUT-013": { type:"whatsapp_campaign", category:"event", signal:/event|workshop|phone|contact/i, sections:["Message draft","Audience and purpose","Follow-up plan"], missing:["Verified WhatsApp eligibility, consent and template approval; no sending"] },
  "OUT-014": { type:"newsletter", category:"event", signal:/event|workshop|research|achievement|institution/i, sections:["Masthead","In this issue","Featured announcement","Details at a glance","Editorial notes"], missing:["Editorial approval and approved public assets"] },
  "OUT-015": { type:"annual_report", category:"institution", signal:/annual|report|institution|university/i, sections:["Executive overview","Reporting scope","Academic activities","Research and outreach","Placement and outcomes","Evidence gaps and conclusion"], missing:["Annual scope, complete reporting period and source completeness"] },
  "OUT-016": { type:"academic_analysis", category:"institution", signal:/department|programme|faculty|academic/i, sections:["Scope","Academic provision","Source metrics","Denominators and limitations"], missing:["Approved formulas, denominators and privacy thresholds"] },
  "OUT-017": { type:"evidence_matrix", category:"evidence", signal:/requirement|NAAC|NIRF|AICTE|UGC|criterion/i, sections:["Methodology version","Requirement references","Source evidence","Unresolved mapping"], missing:["Official methodology and approved requirement-to-evidence bindings"] },
  "OUT-018": { type:"agency_submission", category:"evidence", signal:/requirement|NAAC|NIRF|AICTE|UGC|criterion/i, sections:["Agency and cycle","Submission fields","Reconciliation","Sign-off gaps"], missing:["Version lock, verified agency-ready values and authorized sign-off"] },
  "OUT-019": { type:"thematic_report", category:"general", signal:/SDG|sustainab|theme|outreach|environment/i, sections:["Theme and scope","Source-supported activity","Methodology","Findings and limitations"], missing:["Explicit thematic methodology; no invented SDG mapping"] },
  "OUT-020": { type:"custom_report", category:"general", signal:/\S/, sections:["Source scope","Source-linked findings","Tables and references","Limits and conclusion"], missing:["Approved query scope and report approval"] },
  "OUT-021": { type:"quality_report", category:"general", signal:/\S/, sections:["Extraction reconciliation","Structured completeness","Potential contradictions","Review disposition"], missing:["Reviewer decisions and approved reconciliation rules"] },
  "OUT-022": { type:"evidence_bundle", category:"evidence", signal:/evidence|requirement|criterion|NAAC/i, sections:["Bundle index","Source lineage","Requirement references","Rights and completeness"], missing:["Approved mappings, current requirement version and artifact rights"] },
  "OUT-023": { type:"web_profile", category:"institution", signal:/institution name|university|campus|programme/i, sections:["Institution overview","Academic provision","Public contact review"], missing:["Approved public-field allowlist and currentness"] },
  "OUT-024": { type:"employer_outreach", category:"placement", signal:/employer|recruiter|placement|collaboration/i, sections:["Employer segmentation","Outreach message","Relationship context","Recipient eligibility"], missing:["Contact permissions and approved outreach purpose"] },
  "OUT-025": { type:"governance_report", category:"meeting", signal:/meeting|decision|action|resolution/i, sections:["Governance scope","Decisions","Action status","Implementation evidence"], missing:["Complete period and verified implementation evidence"] },
  "OUT-026": { type:"event_publicity", category:"event", signal:/event|workshop|seminar/i, sections:["Poster copy","Website blurb","Press note","Email invitation","WhatsApp invitation"], missing:["Speaker/image consent, event status and release approval"] },
  "OUT-027": { type:"research_profile", category:"research", signal:/research|publication|patent|grant|DOI/i, sections:["Research scope","Publications","Projects and grants","Identifiers and duplicates"], missing:["Verified identifiers, authorship and reporting period"] },
  "OUT-028": { type:"department_brochure", category:"institution", signal:/department|programme|academic|faculty/i, sections:["Department introduction","Programmes","Faculty and facilities","Prospectus verification"], missing:["Current approved academic facts; no invented admission promises"] },
  "OUT-029": { type:"social_calendar", category:"event", signal:/event|workshop|communication|calendar/i, sections:["Channel schedule","Schedule conflicts and gaps","Missing information and release gates"], missing:["Approved publishing dates and schedule-conflict review"] },
  "OUT-030": { type:"communication_performance", category:"analytics", signal:/impressions|engagement|reach|clicks|analytics/i, sections:["Platform and date window","Recorded engagement","Performance analysis","Data limitations"], missing:["Authenticated platform data and complete date window"] },
};

const CATEGORY_LABELS: Record<SourceCategory, string> = {
  event: "dated event", meeting: "meeting", placement: "placement/employer", contacts: "contact",
  institution: "institutional profile", research: "research", evidence: "accreditation/requirement",
  analytics: "platform analytics", general: "source",
};

/** Detect which authorised record categories the current source actually contains.
 * Keyword echoes are not enough: data-dependent categories require record-like evidence. */
export function detectCategories(lines: SourceLine[], event: unknown, meetings: unknown[]): Set<SourceCategory> {
  const cats = new Set<SourceCategory>(["general"]);
  const text = lines.map(l => l.content);
  const joined = text.join(" ");
  const count = (re: RegExp) => text.filter(t => re.test(t)).length;
  if (event || (count(/workshop|seminar|conference|event|कार्यशाला|सम्मेलन/i) >= 1 && /\b20\d{2}\b/.test(joined))) cats.add("event");
  if (meetings.length || count(/agenda|minutes|proceedings|resolution|कार्यसूची|कार्यवृत्त|निर्णय/i) >= 1) cats.add("meeting");
  if (count(/placement|internship|recruiter|employer|job offer/i) >= 2) cats.add("placement");
  if (count(/@[\w.-]+\.[a-z]{2,}|\+?\d[\d -]{9,}\d/i) >= 1) cats.add("contacts");
  if (count(/^(institution name|established|campus|affiliated|accredited)\s*:/i) >= 1 || count(/university|campus|department|faculty|programme/i) >= 3) cats.add("institution");
  if (count(/research|publication|patent|grant|\bdoi\b/i) >= 2) cats.add("research");
  if (count(/NAAC|NIRF|AICTE|UGC|criterion|requirement/i) >= 1) cats.add("evidence");
  if (count(/impressions|engagement|reach|clicks|analytics/i) >= 1 && /\d/.test(joined)) cats.add("analytics");
  return cats;
}

export function catalogueEligible(id: string, c: HandlerContext) {
  const entry = reference.outputs.find(e => e.Output_ID === id); const handler = CATALOGUE_HANDLERS[id];
  if (!entry || !handler) return false;
  if (/Company|internal/i.test(entry.Default_Access_Class) && !c.company) return false;
  const event = eventContent(c.lines, c.segmentIds);
  const cats = detectCategories(c.lines, event, structuredMeetings(c.lines));
  if (!cats.has(handler.category)) return false;
  const eventIds = ["OUT-008","OUT-009","OUT-010","OUT-011","OUT-012","OUT-013","OUT-014","OUT-026","OUT-029"];
  return c.lines.some(l => handler.signal.test(l.content)) || (eventIds.includes(id) && !!event);
}

const isEventRecord = (id:string) => PURPOSE_RULES[id]?.category === "event" || id === "OUT-014";

type Fields = Partial<Record<string, string | undefined>>;
const sentenceValue = (value: string) => value.trim().replace(/[.:;]+$/, "");
const labelledValue = (value: string, label: RegExp) => sentenceValue(value.replace(label, ""));
function fieldHelpers(f: Fields) {
  const title = f["title"] ?? "";
  const subject = f["subject"] ? sentenceValue(f["subject"]) : undefined;
  const organizer = f["organizer"] ? labelledValue(f["organizer"], /^organis?ed by\s+/i) : undefined;
  const host = f["host"] ? labelledValue(f["host"], /^hosted by\s+/i) : undefined;
  const facilitator = f["facilitator"] ? labelledValue(f["facilitator"], /^and conducted by\s+/i) : undefined;
  const audience = f["audience"] ? sentenceValue(f["audience"]) : undefined;
  const lead = `${title} is announced${f["date"] ? ` for ${f["date"]}` : " in the source document"}${f["venue"] ? `, at ${sentenceValue(f["venue"])}` : ""}.`;
  const people = [organizer ? `The source names ${organizer} as the organizer.` : undefined, host ? `${host} is named as the host.` : undefined, facilitator ? `The source identifies ${facilitator} as conducting the programme.` : undefined].filter(Boolean).join(" ");
  const details = [f["date"] ? `- Printed date: ${f["date"]}` : undefined, f["venue"] ? `- Venue: ${sentenceValue(f["venue"])}` : undefined, organizer ? `- Organizer: ${organizer}` : undefined, host ? `- Host: ${host}` : undefined, facilitator ? `- Conducting organization: ${facilitator}` : undefined].filter(Boolean).join("\n");
  return { title, subject, organizer, host, facilitator, audience, lead, people, details };
}

const REVIEW_NOTE = "This is an announcement, not confirmation that the event took place. Attendance, outcomes and completion are not established by the source. Human review is required before publication.";

/** OUT-008: news article — headline, standfirst, lead, focus, people, facts box, verification. */
function newsArticleBody(f: Fields, sourceParagraphs: string) {
  const h = fieldHelpers(f);
  return [
    `# ${h.title}`,
    h.subject ? `*${h.subject} — announced programme, occurrence unconfirmed.*` : "*Announced programme; occurrence unconfirmed.*",
    `${h.lead} ${h.subject ? `The notice sets out a learning focus on ${h.subject}, bringing the programme’s purpose into view before readers review the logistical details.` : "The notice provides the basis for this announcement; it does not establish event completion."}`,
    "## Programme focus",
    [h.subject ? `The announced programme focuses on ${h.subject}.` : undefined, h.audience ? `The source describes the intended audience as “${h.audience}”.` : undefined].filter(Boolean).join(" ") || "The source does not state a programme focus beyond the title.",
    h.people ? "## People and institutions" : undefined,
    h.people || undefined,
    h.details ? "## Event information" : undefined,
    h.details || undefined,
    "## Source and verification",
    REVIEW_NOTE,
    "## Cited source passages",
    sourceParagraphs,
    "## Closing",
    "Readers should consult the original notice and obtain confirmation of current arrangements before acting on this announcement. Any account of participation or results requires a separate source-backed follow-up.",
    `Suggested URL slug: ${h.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}`,
    `Editorial review: pending. Publication status: not authorized.`,
    `SEO title: ${h.title}`,
    `Meta description: ${h.subject ?? "Source-backed workshop announcement; details require review."}`,
  ].filter(Boolean).join("\n\n");
}

/** OUT-011: LinkedIn article — essay structure, distinct from the news article. */
function linkedinArticleBody(f: Fields, caution: string) {
  const h = fieldHelpers(f);
  return [
    `# ${h.title}`,
    `Why this programme matters: ${h.subject ? `the source describes a focus on ${h.subject}, a topic with direct practical consequences for the intended participants.` : "the source announces a structured learning programme."}`,
    "## Context",
    h.lead,
    h.audience ? `The programme is described as “${h.audience}”.` : undefined,
    "## What the programme covers",
    h.subject ? `According to the source, the programme addresses ${h.subject}.` : "The source does not detail the curriculum beyond the title.",
    h.people ? "## Organizers" : undefined,
    h.people || undefined,
    "## Looking ahead",
    `An announcement establishes intent, not outcomes. Whether the programme took place, who attended and what it achieved remain unconfirmed. ${caution}`,
  ].filter(Boolean).join("\n\n");
}

/** OUT-014: newsletter edition — masthead, contents, feature, facts panel, editorial note. */
function newsletterBody(f: Fields, caution: string) {
  const h = fieldHelpers(f);
  const masthead = h.host ?? h.organizer ?? "Institution";
  return [
    `# ${masthead} — Single-item Bulletin (explicitly selected alternative)`,
    `*Source-derived draft · ${f["date"] ? `feature date ${f["date"]}` : "date unconfirmed"} · human review required*`,
    "## In this issue",
    `- Featured announcement: ${h.title}`,
    "## Featured announcement",
    publicationCopy("website_event", f),
    "## Details at a glance",
    h.details || "No event details recorded in the source.",
    "## Editorial notes",
    `This bulletin contains one announcement, not a full institutional newsletter. A full issue needs recent academic, research, student/faculty or opportunity updates with reader value, dates and attributable details; approved links and visual assets should be supplied where relevant. ${caution}`,
  ].filter(Boolean).join("\n\n");
}

/** OUT-026: publicity pack — five independently written channel artifacts. */
function publicityPackBody(f: Fields) {
  const h = fieldHelpers(f);
  const artifacts: [string, string][] = [
    ["Poster copy", `${h.title}\n${h.subject ?? ""}\n${[f["date"], f["venue"] ? sentenceValue(f["venue"]) : undefined].filter(Boolean).join(" · ")}\n${h.organizer ? `Organized by ${h.organizer}` : ""}`.trim()],
    ["Website blurb", publicationCopy("website_event", f)],
    ["Press note", publicationCopy("press_release", f)],
    ["Email invitation", `Subject: Invitation — ${h.title}\n\n${h.lead}\n\n${h.subject ? `The programme focuses on ${h.subject}.` : ""}\n\n${h.details}\n\nRecipient list, sender authorization and opt-out handling are not confirmed. Draft only; no message sent.`],
    ["WhatsApp invitation", publicationCopy("facebook", f)],
  ];
  return artifacts.map(([label, copy]) => `## ${label}\n${copy}`).join("\n\n") + "\n\nEach artifact is a separate channel draft; speaker/image consent, event status and release approval are unconfirmed.";
}

/** OUT-029: professional social media campaign calendar. Embeds the actual OUT-009 channel
 * copy (not reference labels), classifies past source dates as retrospective/demo, and uses
 * clearly labelled proposed planning slots instead of invented approved dates. */
function socialCalendarBody(f: Fields, eventCautions: string[], missing: string[], now = new Date()) {
  const h = fieldHelpers(f);
  const parsedDate = f["date"] ? new Date(f["date"]) : null;
  const dateValid = parsedDate !== null && !Number.isNaN(parsedDate.getTime());
  const retrospective = dateValid && parsedDate.getTime() < now.getTime();
  const timing = retrospective
    ? `The only source-recorded date (${f["date"]}) is in the past relative to generation. This calendar is a retrospective/demo planning artifact, not a future campaign schedule.`
    : dateValid
      ? `The source records one date (${f["date"]}). All other slots below are proposed relative phases, not approved publication dates.`
      : "No date is recorded in the source. All slots below are proposed relative phases, not approved publication dates.";
  const channels = [
    { key: "facebook" as const, label: "Facebook", strategy: "Community announcement with full event details and a comment prompt; suited to longer copy and the event creative." },
    { key: "instagram" as const, label: "Instagram", strategy: "Visual-first caption led by the event creative; details move to the caption body with a link-in-bio CTA placeholder." },
    { key: "linkedin" as const, label: "LinkedIn", strategy: "Professional announcement framing the programme's practical value for the intended audience; suited to the OUT-011 long-form article as a follow-up." },
    { key: "x_post" as const, label: "X", strategy: "Short announcement within 270 characters; detail deferred to a linked page rather than compressed copy." },
  ];
  const phases = [
    ["Awareness","T-7","Facebook","Community introduction","Learn the programme focus"],
    ["Main announcement","T-5","LinkedIn","Professional context","Read the source notice"],
    ["Engagement","T-3","Instagram","Proposed carousel","Save the verified details"],
    ["Reminder","T-1","X","Short reminder","Check current arrangements"],
    ["Event-day","T0","Instagram","Proposed story","Only publish after occurrence confirmation"],
    ["Post-event","T+1","Facebook","Verification-gated follow-up","Supply attendance/outcome records first"],
    ["Follow-up","T+7","LinkedIn","Evidence-led reflection","Supply verified impact records first"],
  ];
  const offsets = [-7,-5,-3,-1,0,1,7];
  const scheduleRows = phases.map(([phase,slot,platform],i) => {
    const d = dateValid && parsedDate ? new Date(parsedDate.getTime() + (offsets[i] ?? 0)*86400000) : null;
    const proposedDate = d ? `${d.toISOString().slice(0,10)} (${d.toLocaleDateString('en-GB',{weekday:'long',timeZone:'UTC'})})` : 'Date unavailable';
    return `| ${phase} | ${retrospective ? "Retrospective DEMO " : "Proposed "}${slot} | ${proposedDate} — not approved | ${platform} | ${i>=4?'Withheld pending source verification':'Draft; review required'} |`;
  });
  const schedule = ["| Phase | Relative slot | Proposed date / weekday | Platform | State |", "| --- | --- | --- | --- | --- |", ...scheduleRows].join("\n");
  const slotCopy = phases.map(([phase,slot,platform,format,cta],i) => {
    const copy = i>=4 ? 'Copy withheld: occurrence, attendance and outcomes are not confirmed. Obtain authorized follow-up evidence before writing this phase.' : i===0 ? `Workshop announcement: ${h.title}. ${h.subject ? `Explore the announced focus: ${h.subject}.` : ''} See the source notice for details.` : i===1 ? publicationCopy('linkedin',f) : i===2 ? `What would you like to understand about ${h.subject ?? h.title}? The notice announces ${h.title}${f['date']?` for ${f['date']}`:''}. Suggested discussion prompt only; no replies or participation recorded.` : `Source-notice check: ${h.title}${f['date']?` — announced for ${f['date']}`:''}. Verify current arrangements with the issuing unit before acting.`;
    return `### ${phase} · ${slot} · ${platform}\n${copy}\n\nFormat / creative direction: ${format}; source-backed typography and approved assets only.\nProposed CTA: ${cta}.\nResponsible roles (proposed, unassigned): editorial writer; source reviewer; authorized communications publisher.\nApproval: pending. Publishing: not scheduled. Measurement requirement (suggested, not measured): ${i<2?'reach and source-link clicks':i<4?'saves and attributable link clicks':'verified follow-up engagement'}.`;
  }).join('\n\n');
  const postCopy = channels.map(c => `### ${c.label}\n${publicationCopy(c.key, f)}`).join("\n\n");
  const creative = channels.map(c => `- ${c.label}: source-backed typographic creative (no photographs or logos are invented); ${c.key === "instagram" ? "square 1080×1080 or portrait 1080×1350" : c.key === "x_post" ? "landscape 1920×1080" : "square 1080×1080"}; alt text required; DEMO/review ribbon retained until release approval.`).join("\n");
  return [
    `# Social media calendar — ${h.title}`,
    "## Campaign overview and objectives",
    `${h.lead} The campaign objective supported by the source is awareness of this announced programme among its intended audience. Attendance, outcomes and occurrence are not established; no objective beyond the announcement is invented.`,
    "## Communication goals",
    `- Announce the programme accurately from the source notice.\n- Direct interested readers to the original notice for details.\n- Avoid any claim of occurrence, attendance, outcomes or endorsement until verified.`,
    "## Target audiences and audience segments",
    h.audience ? `The source describes the intended audience as “${h.audience}”. Proposed segments (recommendations, not approved decisions): prospective founders seeking formation basics; students exploring entrepreneurship; academic/incubation teams seeking a shareable notice. Tailor introductory messaging to each segment without attributing attendance or endorsements.` : "The source does not record an intended audience. Audience definition is a missing input listed below.",
    "## Campaign phases",
    `- Pre-event: announcement posts across all four channels.${dateValid ? `\n- Event day (${f["date"]}): day-of reminder, only if occurrence is confirmed by an authorized reviewer.` : "\n- Event day: no source date; slot retained as a relative phase."}\n- Post-event: follow-up only from verified outcomes; no outcome content exists in the source.\n- ${timing}`,
    "## Content pillars and themes",
    h.subject ? `Single source-supported pillar: ${h.subject}. Proposed supporting pillars: practical learning questions, source-notice details, and verification-led follow-up. These are editorial recommendations, not recorded institutional strategy.` : "The source supports one announcement pillar only; the title does not establish a broader theme.",
    "## Publication schedule",
    schedule,
    "Proposed dates are deterministic offsets from the printed event date, not approved publishing dates. No publication date is invented as an authorized decision. Resolve source date/weekday conflicts before using any slot.",
    "## Platform-specific strategy",
    channels.map(c => `- ${c.label}: ${c.strategy}`).join("\n"),
    "## Post copy (actual OUT-009 generated content)",
    postCopy,
    "## Individual seven-slot copy and responsibilities",
    slotCopy,
    "## Creative and image requirements",
    creative,
    "## Hashtag and CTA strategy",
    "- No approved hashtags are recorded in the source; proposed placeholders: event-name hashtag derived from the approved title, plus one institutional hashtag once branding is approved.\n- CTA: “See the original event notice for details” until a registration link is authorized. No registration link exists in the source.",
    "## Source references and factual qualifications",
    ...eventCautions.map(caution => `- ${caution}`),
    `- ${REVIEW_NOTE}`,
    "## Approval, publishing and scheduling status",
    "- No channel is approved for publication; no post is scheduled; no message has been sent. Human review and release authorization are required for every slot above.",
    "## Performance indicators (suggested, not measured)",
    "- Suggested indicators once published: reach, link clicks and saves per channel. No analytics data exists in the source; these are measurement requirements, not results.",
    "## Missing information and release gates",
    ...missing.map(m => `- ${m}`),
  ].join("\n\n");
}

export function generateCatalogue(c: HandlerContext, requested: string[]) {
  const readiness: Record<string, ReturnType<typeof assessReadiness>> = {};
  const outputs: GeneratedOutput[] = []; const skipped: { name: string; reason: string }[] = [];
  const ids = requested.length ? [...new Set(requested)] : reference.outputs.filter(e => catalogueEligible(e.Output_ID, c)).map(e => e.Output_ID);
  const event = eventContent(c.lines, c.segmentIds);
  const eventFields = Object.fromEntries(event?.fields.map(f => [f.role, f.value]) ?? []);
  const meetings = structuredMeetings(c.lines);
  const cats = detectCategories(c.lines, event, meetings);
  for (const id of ids) {
    const entry = reference.outputs.find(e => e.Output_ID === id); const handler = CATALOGUE_HANDLERS[id];
    if (!entry || !handler) { skipped.push({ name: id, reason: "Unknown catalogue ID." }); continue; }
    if (/Company|internal/i.test(entry.Default_Access_Class) && !c.company) { skipped.push({ name: id, reason: "Company-only output; server authorization denied." }); continue; }
    const assessment = assessReadiness(id, { lines:c.lines, period:c.period, event:!!event, categories:cats });
    readiness[id] = assessment;
    const choice = c.choices?.[id] ?? "requested";
    if (assessment.status === "BLOCKED" || (assessment.status === "ALTERNATIVE" && choice !== "alternative") || (assessment.status === "LIMITED" && choice !== "limited")) {
      skipped.push({name:id,reason:assessment.reasons.join(" ") + " " + assessment.nextAction}); continue;
    }
    if (choice === "alternative" && !assessment.alternative) { skipped.push({name:id,reason:"No appropriate alternative is available; requested output was not silently changed."});continue; }
    if (["OUT-005","OUT-006","OUT-007"].includes(id)) {
      const kinds = id === "OUT-006" ? ["meeting_report","decisions"] : [handler.type];
      const drafts = meetings.filter(m => kinds.includes(m.kind));
      if (!drafts.length) { skipped.push({ name: id, reason: "Missing explicit source table headers; proceedings and decisions are not inferred." }); continue; }
      for (const m of drafts) outputs.push({ type: m.kind, name: entry.Output_Name, title: entry.Output_Name, body: m.body, meeting: m.meeting, tables: sourceTables(c.lines), manifest: c.manifest, catalogue: { catalogueId: id, contractId: m.meeting.contractId, support: "source-review", reason: "Explicit-source structured draft; approval remains separate." }, contract: { template: null, mimeType: "text/markdown", dimensions: null, approver: null, release: "not_authorized" } });
      continue;
    }
    const matches = c.lines.flatMap((line, i) => (!isEventRecord(id) || handler.signal.test(line.content)) ? [{ line, id: c.segmentIds[i] }] : []).filter((r): r is { line: SourceLine; id: string } => !!r.id);
    const isEventOutput = ["OUT-008","OUT-009","OUT-010","OUT-011","OUT-012","OUT-013","OUT-014","OUT-026","OUT-029"].includes(id);
    const selected = event && isEventOutput ? event.fields.flatMap(f => f.citations) : matches.map(r => ({ segmentId: r.id, locatorKey: r.line.locator_key, raw: r.line.content }));
    const citations = [...new Map(selected.map(s => [s.segmentId, s])).values()];
    if (!citations.length) { skipped.push({ name: id, reason: "No attributable source passages." }); continue; }
    const sourceParagraphs = citations.map(s => `> ${s.raw}\nSource: ${s.locatorKey}`).join("\n\n");
    const missing = [...assessment.missing, ...handler.missing, ...(!c.period && /OUT-004|OUT-015|OUT-016|OUT-027|OUT-030/.test(id) ? ["Reporting period not recorded"] : [])];
    const caution = "Human review required. Source-derived draft, not verified evidence. Release and external communication are not authorized.";
    let body = "";
    if (event && id === "OUT-008") body = newsArticleBody(eventFields, sourceParagraphs);
    else if (event && id === "OUT-011") body = linkedinArticleBody(eventFields, caution);
    else if (id === "OUT-014") body = event && choice === "alternative" ? newsletterBody(eventFields, caution) : editorialBody(c.lines, choice === "alternative");
    else if (event && id === "OUT-026") body = publicityPackBody(eventFields);
    else if (event && id === "OUT-029") body = socialCalendarBody(eventFields, event.cautions, missing);
    else if (event && id === "OUT-012") body = `Subject: ${eventFields["title"]}\n\n${publicationCopy("website_event", eventFields)}\n\nRecipients, sender, opt-out and schedule: unconfirmed. Draft only; no message sent.`;
    else if (event && id === "OUT-013") body = `Message draft\n\n${publicationCopy("facebook", eventFields)}\n\nRecipients and WhatsApp eligibility: unconfirmed. No message sent.`;
    else if (event && id === "OUT-010") body = handler.sections.map((h, i) => `## ${h}\nOn-screen text / voiceover draft: ${event.fields[i]?.value ?? "Check the original notice before release."}\nVisual direction: source-backed typography; no invented people or photographs.`).join("\n\n") + `\n\n${caution}\nNot a rendered video.`;
    else if (purposeBody(id, c.lines, c.period)) body = purposeBody(id, c.lines, c.period) ?? "";
    else {
      const fields = sourceFields(c.lines);
      const purpose = PURPOSE_RULES[id];
      const records = (purpose?.fields ?? []).flatMap(field => (fields.get(field.toLowerCase()) ?? []).map(value => `| ${field} | ${value.replace(/\|/g, "\\|")} |`));
      body = `# ${entry.Output_Name} — source-recorded review draft\n\n## Purpose and scope\n${purpose?.acceptance ?? entry.Output_Name}\n${c.period ? `Selected reporting period: ${c.period}. Only matching-period records support reporting.` : "Reporting scope must be confirmed before analytical use."}\n\n## Source-recorded information\n| Field | Source value |\n| --- | --- |\n${records.join("\n")}\n\n## Interpretation and practical next steps\n${purpose?.acceptance ?? "Review source values before use."} Interpretation is not an institutional decision; no unsupported conclusions, calculated indicators or approvals are inferred.\n\n## Source references\n${sourceParagraphs}\n\n## Missing information and verification\n${assessment.missing.map(m => `- ${m}`).join("\n")}\n${assessment.verification.join("\n")}\n\n${caution}`;

    }
    if (choice === "alternative" && assessment.alternative) {
      body = id === "OUT-014" ? body : `# ${assessment.alternative}\n\nExplicitly selected alternative to ${entry.Output_Name}; not a completed requested deliverable.\n\n## Available information\n${assessment.available.join("; ") || "The source supports no substantive requested-report fields."}\n\n## Data collection plan\n| Required record | Purpose | Action |\n| --- | --- | --- |\n${assessment.missing.map(m => `| ${m} | Support ${entry.Output_Name} | Supply dated, attributable records and verify values |`).join("\n")}\n\n## Available source references\n${sourceParagraphs}\n\n${caution}`;
    }
    const emit = (type: string, copy: string) => outputs.push({ type, name: choice === "alternative" ? `${entry.Output_Name} — alternative: ${assessment.alternative}` : assessment.status === "LIMITED" ? `${entry.Output_Name} — explicitly limited draft` : entry.Output_Name, title: choice === "alternative" ? assessment.alternative ?? entry.Output_Name : eventFields["title"] ?? entry.Output_Name, body: copy, manifest: c.manifest, tables: sourceTables(c.lines), draft: { version: "catalogue-draft-1", handler: id, revision: 1, parentSetId: null, edited: false, missing, cautions: [caution, ...(event?.cautions ?? [])], citations }, catalogue: { catalogueId: id, contractId: null, support: "stored-draft-only", reason: "Source-linked catalogue draft; all approval, consent and official mapping gates remain unmet." }, contract: { template: "catalogue-draft-1", mimeType: "text/markdown", dimensions: null, approver: null, release: "not_authorized" } });
    if (event && id === "OUT-009") {
      for (const channel of ["facebook","instagram","linkedin","x_post"] as const) {
        let copy = publicationCopy(channel, eventFields); const limit = { facebook: 800, instagram: 2200, linkedin: 1200, x_post: 270 }[channel];
        if (Array.from(copy).length > limit) copy = publicationCopy(channel, { title: eventFields["title"], date: eventFields["date"] });
        if (Array.from(copy).length > limit) { skipped.push({ name: `${id}:${channel}`, reason: `Source title cannot fit ${limit} characters without truncation.` }); continue; }
        emit(channel, copy);
      }
      continue;
    }
    emit(handler.type, body);
  }
  return { outputs, skipped, readiness };
}
