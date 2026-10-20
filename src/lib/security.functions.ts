import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { mayOpen, type AppRole } from "./access";

export const getAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: memberships, error } = await context.supabase.from("organization_memberships").select("id,organization_id,active").eq("user_id", context.userId).eq("active", true);
  if (error) throw new Error("Unable to load organization access");
  const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("membership_id,role").eq("user_id", context.userId);
  if (roleError) throw new Error("Unable to load assigned roles");
  const ids = (memberships ?? []).map(m => m.organization_id);
  const { data: organizations, error: orgError } = ids.length ? await context.supabase.from("organizations").select("id,name,kind,code").in("id", ids) : { data: [], error: null };
  if (orgError) throw new Error("Unable to load organizations");
  const { data: profile } = await context.supabase.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
  return { userId: context.userId, displayName: profile?.display_name ?? "", workspaces: (organizations ?? []).map(o => {
    const membership = memberships?.find(m => m.organization_id === o.id);
    return { id: o.id, name: o.name, kind: o.kind, short: o.code, caption: o.kind === "internal" ? "Operator workspace" : "University workspace", roles: (roles ?? []).filter(r => r.membership_id === membership?.id).map(r => r.role) };
  }).filter(o => o.roles.length > 0) };
});

export const authorizePage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid(), path: z.string().max(100) }))
  .handler(async ({ context, data }) => {
    const { data: org } = await context.supabase.from("organizations").select("kind").eq("id", data.organizationId).maybeSingle();
    const { data: member } = await context.supabase.from("organization_memberships").select("id").eq("user_id", context.userId).eq("organization_id", data.organizationId).eq("active", true).maybeSingle();
    if (!org || !member) throw new Error("Access denied");
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("membership_id", member.id).eq("user_id", context.userId);
    if (!mayOpen(data.path, org.kind, (roles ?? []).map(r => r.role) as AppRole[])) throw new Error("Access denied");
    return { allowed: true };
  });

export const getAdministration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() })).handler(async ({ context, data }) => {
    const { data: org } = await context.supabase.from("organizations").select("id,name,kind,code,created_at").eq("id", data.organizationId).maybeSingle();
    if (!org) throw new Error("Access denied");
    const { data: managed } = await context.supabase.rpc("can_manage", { _org: data.organizationId });
    const { data: portfolio } = await context.supabase.from("organizations").select("id,name,kind").order("name");
    const { data: memberships, error } = await context.supabase.from("organization_memberships").select("id,user_id,active,created_at").eq("organization_id", data.organizationId);
    if (error) throw new Error("Unable to load members");
    const { data: roles } = await context.supabase.from("user_roles").select("user_id,role").eq("organization_id", data.organizationId);
    const { data: profiles } = await context.supabase.from("profiles").select("id,display_name").in("id", (memberships ?? []).map(m => m.user_id));
    const { data: events } = await context.supabase.from("audit_events").select("id,event,actor_id,outcome,created_at").eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(100);
    return { org, portfolio: portfolio ?? [], managed: !!managed, members: (memberships ?? []).map(m => ({ ...m, name: profiles?.find(p => p.id === m.user_id)?.display_name ?? "Member", roles: (roles ?? []).filter(r => r.user_id === m.user_id).map(r => r.role) })), events: events ?? [] };
  });