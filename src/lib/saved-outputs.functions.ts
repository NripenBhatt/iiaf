import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listFilterSchema, dateBounds } from "./list-filters";
import { generatedOutputSchema } from "./output-contract";

const savedRow = z.object({
  setId: z.string().uuid(), documentId: z.string().uuid(), sourceName: z.string(), module: z.string(), category: z.string(),
  generatedAt: z.string(), sourceHash: z.string(), sourceVersion: z.string(), index: z.number(), status: z.literal("draft"),
  output: generatedOutputSchema,
});
export const listSavedOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), filters: listFilterSchema }))
  .handler(async ({ context, data }) => {
    dateBounds(data.filters);
    const { data: member, error: memberError } = await context.supabase.rpc("is_member", { _org: data.organizationId });
    if (memberError || !member) throw new Error("Access denied");
    const { data: rows, error } = await context.supabase.rpc("list_saved_outputs", { _org: data.organizationId, _filters: data.filters });
    if (error) throw new Error("Saved outputs could not be loaded.");
    return z.object({ total: z.number(), rows: savedRow.array() }).parse(rows);
  });