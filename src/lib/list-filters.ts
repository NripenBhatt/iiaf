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
export function validateListSearch(search: Record<string, unknown>): ListFilters {
  const result = listFilterSchema.safeParse({ ...EMPTY_FILTERS, ...search });
  return result.success ? result.data : EMPTY_FILTERS;
}
export function dateBounds(filters: Pick<ListFilters, "from" | "to">) {
  const start = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : null;
  const end = filters.to ? new Date(`${filters.to}T00:00:00.000Z`) : null;
  if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime())) || (start && end && start > end)) throw new Error("Choose a valid date range.");
  if (end) end.setUTCDate(end.getUTCDate() + 1);
  return { start: start?.toISOString() ?? null, end: end?.toISOString() ?? null };
}
/** Literal search text only: never let search syntax change the query predicates. */
export function literalSearch(q: string) { return q.replace(/[\\%_*(),.]/g, " ").trim(); }