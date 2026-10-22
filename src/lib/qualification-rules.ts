import { z } from "zod";
import { meetingHeaderKind, type MeetingKind } from "./meeting-contract";

/**
 * Authoritative source: IIAF_Qualification_and_Relationship_Engine_Blueprint_v1_FIXED.xlsx,
 * sheet "Qualification_Rules" (blueprint v1.1). Rule text is reproduced verbatim; only
 * unambiguous, source-signal-based behaviour is implemented. Everything remains Candidate
 * and requires human review; no rule approves, verifies or releases anything.
 */
export const QUALIFICATION_SOURCE = "IIAF_Qualification_and_Relationship_Engine_Blueprint_v1_FIXED.xlsx#Qualification_Rules";

export type QualificationRule = {
  ruleId: string;
  inputSignal: string;
  qualificationClass: string;
  requiredAttributes: string[];
  eligibleOutputs: string[];
  block: string;
  acceptanceCheck: string;
  /** implemented = deterministic runtime behaviour exists; blocked = dependency missing (fail closed); unresolved = cannot be determined unambiguously yet. */
  resolution: "implemented" | "blocked" | "unresolved";
};

export const QUALIFICATION_RULES: QualificationRule[] = [
  { ruleId: "Q01", inputSignal: "Institutional facts, programmes, services, initiatives", qualificationClass: "Institutional information", requiredAttributes: ["Entity", "topic", "facts", "date", "audience", "language", "source", "demo/sensitivity status"], eligibleOutputs: ["Website update", "profile", "FAQ", "summary", "social content if suitable"], block: "No unsupported claims; do not force a news article", acceptanceCheck: "Every claim traces to source or is labelled suggested copy", resolution: "implemented" },
  { ruleId: "Q02", inputSignal: "Dated event, launch, award, announcement, milestone", qualificationClass: "News candidate", requiredAttributes: ["What", "who", "when", "where", "why", "publication authority", "source"], eligibleOutputs: ["News article", "website announcement", "short brief", "social creative"], block: "No invented event status, quotes, attendance or approval", acceptanceCheck: "Missing essential fields listed; claims source-backed", resolution: "implemented" },
  { ruleId: "Q03", inputSignal: "User requests a social image post", qualificationClass: "Social image creative", requiredAttributes: ["Platform", "placement", "aspect ratio", "language", "brand assets", "CTA", "source"], eligibleOutputs: ["Actual PNG/JPG creative plus separate caption"], block: "Text alone is not a completed image output", acceptanceCheck: "Image file exists, opens, matches required dimensions; caption separate", resolution: "blocked" },
  { ruleId: "Q04", inputSignal: "User requests carousel", qualificationClass: "Social carousel", requiredAttributes: ["Platform", "slide count", "dimensions", "sequence", "brand", "language"], eligibleOutputs: ["Multiple PNG/JPG slides plus caption"], block: "Do not mark complete if only slide text exists", acceptanceCheck: "All slides exported and ordered; claims source-backed", resolution: "blocked" },
  { ruleId: "Q05", inputSignal: "User requests reel/video", qualificationClass: "Video package", requiredAttributes: ["Duration", "hook", "scene sequence", "voice-over", "on-screen text", "CTA", "language"], eligibleOutputs: ["Timed script", "storyboard", "shot list", "cover image", "caption; rendered video only if supported"], block: "Do not claim a script is a finished video", acceptanceCheck: "Rendered video and script are labelled distinctly", resolution: "blocked" },
  { ruleId: "Q06", inputSignal: "Agenda or pre-meeting schedule", qualificationClass: "Meeting agenda", requiredAttributes: ["Meeting details", "item order", "objective", "presenter/owner", "duration", "expected outcome"], eligibleOutputs: ["Formatted agenda DOCX/PDF", "structured table", "meeting brief"], block: "Agenda alone cannot support minutes or decisions", acceptanceCheck: "Items and timings preserved; unknown details remain blank", resolution: "implemented" },
  { ruleId: "Q07", inputSignal: "Proceedings/discussion/minutes", qualificationClass: "Meeting minutes", requiredAttributes: ["Meeting reference/date", "supplied attendance", "agenda-wise discussion", "decisions", "actions"], eligibleOutputs: ["Minutes DOCX/PDF", "decision register", "action tracker"], block: "No invented attendance, proceedings, decisions or owners", acceptanceCheck: "Decisions/actions have source locators; discussion is separate from resolutions", resolution: "implemented" },
  { ruleId: "Q08", inputSignal: "Explicit resolution/decision wording", qualificationClass: "Decision record", requiredAttributes: ["Decision text", "type", "status", "authority if stated", "owner/date if supplied", "conditions"], eligibleOutputs: ["Decision register", "resolution draft", "follow-up tracker"], block: "Proposed/referred/in-principle must not become approved", acceptanceCheck: "Status preserved and auditable", resolution: "implemented" },
  { ruleId: "Q09", inputSignal: "Action with owner and/or due date", qualificationClass: "Action item", requiredAttributes: ["Action", "owner", "deadline", "meeting/decision link", "status", "completion proof"], eligibleOutputs: ["Action tracker; overdue view only when dates support it"], block: "No inferred completion or overdue status", acceptanceCheck: "Missing owner/date/status shown explicitly", resolution: "implemented" },
  { ruleId: "Q10", inputSignal: "Table with headers, rows, cells, totals, footnotes", qualificationClass: "Structured table", requiredAttributes: ["Title", "headers", "rows", "units", "period", "footnotes", "source page/sheet/cell"], eligibleOutputs: ["Structured XLSX/CSV", "readable table", "data-quality report"], block: "Do not flatten important table relationships", acceptanceCheck: "Source rows/columns reconcile with extracted structure", resolution: "implemented" },
  { ruleId: "Q11", inputSignal: "Metric, count, rate, salary, publication number", qualificationClass: "Quantitative fact", requiredAttributes: ["Value", "unit", "definition", "period", "cohort", "denominator", "source", "verification flag"], eligibleOutputs: ["Metric register", "valid chart", "candidate framework evidence"], block: "No silent calculation/comparison with missing definitions", acceptanceCheck: "Formula and provenance shown; discrepancies flagged", resolution: "implemented" },
  { ruleId: "Q12", inputSignal: "Potential evidence for framework requirement", qualificationClass: "Framework evidence candidate", requiredAttributes: ["Agency", "version", "cycle", "exact requirement ID", "period", "source locator", "rationale", "status"], eligibleOutputs: ["Evidence matrix", "coverage view", "index", "gap list"], block: "No keyword-only mapping or unvalidated auto-approval", acceptanceCheck: "Exact catalogue entry and source locator present", resolution: "unresolved" },
  { ruleId: "Q13", inputSignal: "Scanned image/PDF or OCR text", qualificationClass: "OCR-derived content", requiredAttributes: ["Extracted text", "page/segment", "method", "review status; confidence only if measured"], eligibleOutputs: ["Same eligible outputs as text, with review caution"], block: "Do not silently omit unreadable regions", acceptanceCheck: "Reviewer can compare extracted text with original", resolution: "implemented" },
  { ruleId: "Q14", inputSignal: "Sensitive student/personnel/financial data", qualificationClass: "Restricted content", requiredAttributes: ["Sensitivity", "audience", "redaction", "access policy"], eligibleOutputs: ["Restricted report or authorized redacted output"], block: "No uncontrolled public release", acceptanceCheck: "Privacy review passes before public output", resolution: "unresolved" },
  { ruleId: "Q15", inputSignal: "Insufficient source information", qualificationClass: "Blocked output / gap", requiredAttributes: ["Missing fields", "reason", "available fields"], eligibleOutputs: ["Gap report or template with marked blanks"], block: "Never fill gaps with invented content", acceptanceCheck: "Specific missing fields explained", resolution: "implemented" },
  { ruleId: "Q16", inputSignal: "One file contains multiple meaningful items/tables/decisions", qualificationClass: "Multi-unit source", requiredAttributes: ["Stable unit IDs and page/table/row locators"], eligibleOutputs: ["Separate eligible outputs per unit"], block: "Do not classify whole file as one generic blob", acceptanceCheck: "Each output traces to exact source unit(s)", resolution: "implemented" },
];

export const ruleApplicationSchema = z.object({
  ruleId: z.string(),
  qualificationClass: z.string(),
  resolution: z.enum(["applied", "blocked", "unresolved"]),
  present: z.string().array(),
  missing: z.string().array(),
  blockers: z.string().array(),
  source: z.string(),
});
export type RuleApplication = z.infer<typeof ruleApplicationSchema>;

type Line = { seq: number; locator_key: string; content: string; locator: unknown; method?: string | null; method_version: string };

const cellsSchema = z.object({
  cells: z.array(z.object({ column: z.number(), ref: z.string(), value: z.string(), raw: z.string().optional(), formula: z.string().nullable().optional(), type: z.string().nullable().optional() })),
  table: z.number().optional(),
  sheet: z.string().optional(),
});

const MEETING_RULE: Record<MeetingKind, { ruleId: string; qualificationClass: string }> = {
  agenda_summary: { ruleId: "Q06", qualificationClass: "Meeting agenda" },
  meeting_report: { ruleId: "Q07", qualificationClass: "Meeting minutes" },
  decisions: { ruleId: "Q08", qualificationClass: "Decision record" },
  action_items: { ruleId: "Q09", qualificationClass: "Action item" },
};

const rule = (id: string) => {
  const r = QUALIFICATION_RULES.find(q => q.ruleId === id);
  if (!r) throw new Error(`Unknown qualification rule ${id}`);
  return r;
};

const application = (id: string, present: string[], missing: string[], extraBlockers: string[] = []): RuleApplication => {
  const r = rule(id);
  return ruleApplicationSchema.parse({ ruleId: r.ruleId, qualificationClass: r.qualificationClass, resolution: "applied", present, missing, blockers: [r.block, ...extraBlockers], source: `${QUALIFICATION_SOURCE}!${r.ruleId}` });
};

const DATED_EVENT = /workshop|conference|event|seminar|launch|award|announcement|milestone|कार्यशाला|सम्मेलन/i;
const YEAR = /\b20\d{2}\b/;

/**
 * Deterministic source-signal classification. Only explicit signals qualify a unit;
 * absent signals never block or promote. Q03–Q05 stay blocked (no renderer), Q12/Q14
 * stay unresolved (no official mappings / no sensitivity assessment) and are therefore
 * never applied to a unit here.
 */
export function classifyLines(lines: Line[]): Map<string, RuleApplication[]> {
  const groups = new Map<string, Line[]>();
  for (const line of [...lines].sort((a, b) => a.seq - b.seq)) {
    const p = cellsSchema.safeParse(line.locator);
    if (!p.success) continue;
    const id = p.data.sheet ?? `table${p.data.table ?? 0}`;
    groups.set(id, [...(groups.get(id) ?? []), line]);
  }
  const groupKind = new Map<string, MeetingKind>();
  for (const [id, group] of groups) {
    const first = group[0];
    if (!first) continue;
    const header = cellsSchema.parse(first.locator).cells.map(c => c.value);
    const kind = meetingHeaderKind(header);
    if (kind) groupKind.set(id, kind);
  }
  const lineGroup = new Map<string, string>();
  for (const [id, group] of groups) for (const line of group) lineGroup.set(line.locator_key, id);
  const multiUnit = groups.size > 1;

  const result = new Map<string, RuleApplication[]>();
  for (const line of lines) {
    const apps: RuleApplication[] = [];
    const parsed = cellsSchema.safeParse(line.locator);
    if (!line.content.trim()) {
      apps.push(application("Q15", ["Source locator"], ["Missing fields", "reason", "available fields"], ["Insufficient source information; gap reported, never invented"]));
      result.set(line.locator_key, apps);
      continue;
    }
    if (parsed.success) {
      const cells = parsed.data.cells;
      apps.push(application("Q10", ["Headers/rows/cells with source refs", "Source page/sheet/cell"], ["Title", "units", "period", "footnotes"]));
      const quantitative = cells.filter(c => c.formula || c.type === "n" || (c.type == null && /^-?\d[\d,]*(\.\d+)?%?$/.test(c.value.trim())));
      if (quantitative.length) {
        apps.push(application("Q11", ["Value", "source", ...(quantitative.some(c => c.formula) ? ["formula provenance (stored, not executed)"] : [])], ["Unit", "definition", "period", "cohort", "denominator", "verification flag"], ["Stored formulas are never executed"]));
      }
      const gid = lineGroup.get(line.locator_key);
      const kind = gid ? groupKind.get(gid) : undefined;
      if (kind) {
        const m = MEETING_RULE[kind];
        apps.push(application(m.ruleId, ["Explicit source headers", "Source locator"], rule(m.ruleId).requiredAttributes.filter(a => !/source|header/i.test(a)), ["Human review required; explicit source values only"]));
      }
    }
    if (line.method?.includes("ocr")) {
      apps.push(application("Q13", ["Extracted text", "page/segment locator", `method: ${line.method}`], ["Measured confidence", "review status"], ["OCR_CAUTION: reviewer must compare against the original"]));
    }
    if (DATED_EVENT.test(line.content) && YEAR.test(line.content)) {
      apps.push(application("Q02", ["When (year stated in source)", "source"], ["What", "who", "where", "why", "publication authority"], ["Event status unverified; neutral wording required"]));
    }
    if (multiUnit) {
      apps.push(application("Q16", [`Stable unit ID: ${line.locator_key}`, "page/table/row locator"], []));
    }
    if (!apps.length) {
      apps.push(application("Q01", ["Source", "facts (source text)"], ["Entity", "topic", "date", "audience", "language", "demo/sensitivity status"]));
    }
    result.set(line.locator_key, apps);
  }
  return result;
}
