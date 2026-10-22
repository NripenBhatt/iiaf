import { z } from "zod";

export const meetingFieldSchema = z.object({ value: z.string(), locator: z.string(), cell: z.string().nullable() });
export const meetingRecordSchema = z.object({ order: z.number(), locator: z.string(), fields: z.record(meetingFieldSchema.array()), missing: z.string().array(), issues: z.string().array() });
export const meetingSchema = z.object({ contractId: z.enum(["O06", "O07", "O08", "O09"]), status: z.literal("draft"), validation: z.enum(["complete", "incomplete", "ambiguous"]), records: meetingRecordSchema.array(), issues: z.string().array() });
type Line = { seq: number; locator_key: string; content: string; locator: unknown };
type RecordDraft = z.infer<typeof meetingRecordSchema>;
type Kind = "agenda_summary" | "meeting_report" | "decisions" | "action_items";
const aliases: Record<string, string[]> = {
  number: ["number", "item number", "क्रमांक"], objective: ["objective", "उद्देश्य"], presenter: ["presenter", "प्रस्तुतकर्ता"], duration: ["duration", "अवधि"], preReads: ["pre reads", "pre-reads", "पूर्व पठन"], outcomes: ["expected outcomes", "अपेक्षित परिणाम"],
  meeting: ["meeting", "meeting id", "बैठक"], date: ["meeting date", "बैठक तिथि"], attendance: ["attendance", "उपस्थिति"], proceedings: ["proceedings", "कार्यवृत्त"],
  id: ["decision id", "निर्णय आईडी"], agendaItem: ["agenda item", "कार्यसूची मद"], wording: ["decision wording", "resolution wording", "निर्णय"], status: ["status", "स्थिति"], authority: ["authority", "प्राधिकारी"], owner: ["owner", "उत्तरदायी"], decisionDate: ["decision date", "निर्णय तिथि"],
  action: ["action", "action item", "कार्य"], decision: ["decision reference", "निर्णय संदर्भ"], dueDate: ["due date", "समय सीमा"], completionProof: ["completion proof", "पूर्णता प्रमाण"],
};
const required: Record<Kind, string[]> = { agenda_summary: ["number", "agendaItem", "objective", "presenter", "duration", "preReads", "outcomes"], meeting_report: ["meeting", "date", "attendance", "proceedings"], decisions: ["id", "agendaItem", "wording", "status"], action_items: ["action", "meeting", "decision", "owner", "dueDate", "status", "completionProof"] };
const ids = { agenda_summary: "O06", meeting_report: "O07", decisions: "O08", action_items: "O09" } as const;
const normal = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/[_\s]+/g, " ");
const keyFor = (s: string) => Object.keys(aliases).find(k => aliases[k]?.includes(normal(s)));
const cellsSchema = z.object({ cells: z.array(z.object({ column: z.number(), ref: z.string(), value: z.string() })), table: z.number().optional(), sheet: z.string().optional() });

/** Explicit source labels/headers only. No prose inference, translation, status inference or approval. */
export function structuredMeetings(lines: Line[]) {
  const groups = new Map<string, Line[]>();
  for (const line of [...lines].sort((a, b) => a.seq - b.seq)) {
    const p = cellsSchema.safeParse(line.locator);
    if (!p.success) continue;
    const id = p.data.sheet ?? `table${p.data.table ?? 0}`;
    groups.set(id, [...(groups.get(id) ?? []), line]);
  }
  const records: Record<Kind, RecordDraft[]> = { agenda_summary: [], meeting_report: [], decisions: [], action_items: [] };
  for (const group of groups.values()) {
    const first = group[0]; if (!first) continue;
    const header = cellsSchema.parse(first.locator).cells.map(c => ({ column: c.column, key: keyFor(c.value) }));
    const keys = new Set(header.map(c => c.key));
    const kind: Kind | null = keys.has("wording") ? "decisions" : keys.has("action") ? "action_items" : keys.has("agendaItem") && (keys.has("number") || keys.has("objective")) ? "agenda_summary" : keys.has("proceedings") ? "meeting_report" : null;
    if (!kind) continue;
    for (const line of group.slice(1)) {
      const fields: RecordDraft["fields"] = {};
      for (const c of cellsSchema.parse(line.locator).cells) {
        const key = header.find(h => h.column === c.column)?.key;
        if (key && c.value.trim()) fields[key] = [...(fields[key] ?? []), { value: c.value, locator: line.locator_key, cell: c.ref }];
      }
      if (!Object.keys(fields).length) continue;
      const missing = required[kind].filter(k => !fields[k]?.length);
      const issues = Object.entries(fields).filter(([, v]) => v.length > 1).map(([k]) => `Ambiguous duplicate source columns: ${k}; alternatives retained.`);
      for (const key of ["date", "decisionDate", "dueDate"]) for (const field of fields[key] ?? []) {
        // Do not normalize natural-language or conflicting dates; retain source text and flag it.
        const m = field.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m || !validIso(field.value)) issues.push(`Unvalidated or ambiguous date: ${key}; no overdue inference.`);
      }
      records[kind].push({ order: records[kind].length + 1, locator: line.locator_key, fields, missing, issues });
    }
  }
  return (Object.keys(records) as Kind[]).filter(kind => records[kind].length).map(kind => {
    const rows = records[kind];
    const issues = ["Human review required; explicit source values only; no approval or completion inference."];
    if (kind === "meeting_report") issues.push("Decisions and actions are separate source registers; absence is not evidence of none.");
    const meeting = meetingSchema.parse({ contractId: ids[kind], status: "draft", validation: rows.some(r => r.issues.length) ? "ambiguous" : rows.some(r => r.missing.length) ? "incomplete" : "complete", records: rows, issues });
    const body = rows.map(r => `[${r.locator}]\n${Object.entries(r.fields).map(([k, values]) => `${k}: ${values.map(v => v.value).join(" | ")}`).join("\n")}\nMissing: ${r.missing.join(", ") || "none"}\n${r.issues.join("\n")}`).join("\n\n");
    return { kind, meeting, body };
  });
}
function validIso(value: string) { const d = new Date(`${value}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value; }