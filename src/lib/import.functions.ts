import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getImportInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: org } = await context.supabase.from("organizations").select("kind").eq("id", data.organizationId).maybeSingle();
    const { data: member } = await context.supabase.from("organization_memberships").select("id").eq("user_id", context.userId).eq("organization_id", data.organizationId).eq("active", true).maybeSingle();
    if (!org || org.kind !== "internal" || !member) throw new Error("Access denied");
    const { data: roles, error } = await context.supabase.from("user_roles").select("role").eq("membership_id", member.id).eq("user_id", context.userId);
    if (error || !roles?.some(r => ["super_admin", "authorized_operator", "internal_reviewer"].includes(r.role))) throw new Error("Access denied");
    const { default: inspection } = await import("@/data/master-inspection.json");
    return inspection;
  });