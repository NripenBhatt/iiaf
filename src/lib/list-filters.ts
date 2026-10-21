import { z } from "zod";

export const listFilterSchema = z.object({
  q: z.string().trim().max(200).default(""), category: z.string().max(60).default(""),
  type: z.string().max(80).default(""), status: z.string().max(60).default(""),
  source: z.string().uuid().or(z.literal("")).default(""), owner: z.string().uuid().or(z.literal("")).default(""),
  module: z.enum(["", "institutional", "meeting", "evidence"]).default(""),
  dateField: z.enum(["created", "uploaded", "generated"]).default("created"),
  from: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(""), to: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"), page: z.number().int().min(1).max(10000).default(1),
});
export type ListFilters = z.infer<typeof listFilterSchema>;
export const EMPTY_FILTERS: ListFilters = listFilterSchema.parse({});
export const PAGE_SIZE = 20;
export function validateListSearch(search: Record<string, unknown>) {
  const string = (key: keyof ListFilters) => typeof search[key] === "string" ? String(search[key]) : "";
  return {
    q: string("q").slice(0, 200), category: string("category").slice(0, 60), type: string("type").slice(0, 80),
    status: string("status").slice(0, 60), source: string("source"), owner: string("owner"),
    module: ["institutional", "meeting", "evidence"].includes(string("module")) ? string("module") as ListFilters["module"] : "" as const,
    dateField: ["uploaded", "generated"].includes(string("dateField")) ? string("dateField") as ListFilters["dateField"] : "created" as const,
    from: string("from"), to: string("to"), sort: string("sort") === "oldest" ? "oldest" as const : "newest" as const,
    page: Math.max(1, Math.min(10000, typeof search["page"] === "number" && Number.isFinite(search["page"]) ? Math.trunc(search["page"]) : 1)),
  };
}
export function dateBounds(filters: Pick<ListFilters, "from" | "to">) {
  const start = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : null;
  const end = filters.to ? new Date(`${filters.to}T00:00:00.000Z`) : null;
  if ((start && (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== filters.from)) || (end && (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== filters.to)) || (start && end && start > end)) throw new Error("Choose a valid date range.");
  if (end) end.setUTCDate(end.getUTCDate() + 1);
  return { start: start?.toISOString() ?? null, end: end?.toISOString() ?? null };
}
/** Literal search text only: never let search syntax change the query predicates. */
export function literalSearch(q: string) { return q.replace(/[\\%_*(),.]/g, " ").trim(); }