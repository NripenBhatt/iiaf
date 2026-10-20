import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireCompanyRole } from "./agency.functions";

/** Conversation threads are private to their author and organisation (RLS). Retention: kept until the author deletes them. */
export const listThreads = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await requireCompanyRole(context.supabase, context.userId, data.organizationId);
    const { data: rows, error } = await context.supabase.from("assistant_threads").select("id,title,updated_at").eq("organization_id", data.organizationId).eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(100);
    if (error) throw new Error("Conversations could not be loaded");
    return rows ?? [];
  });

export const createThread = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await requireCompanyRole(context.supabase, context.userId, data.organizationId);
    const { data: row, error } = await context.supabase.from("assistant_threads").insert({ organization_id: data.organizationId, user_id: context.userId }).select("id").single();
    if (error) throw new Error("Conversation could not be created");
    return row;
  });

export const getThread = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ threadId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: t } = await context.supabase.from("assistant_threads").select("id,title,organization_id").eq("id", data.threadId).maybeSingle();
    if (!t) throw new Error("Conversation not found");
    const { data: msgs, error } = await context.supabase.from("assistant_messages").select("ui_id,role,parts,created_at").eq("thread_id", data.threadId).order("created_at");
    if (error) throw new Error("Messages could not be loaded");
    return { thread: t, messages: (msgs ?? []).map(m => ({ id: m.ui_id, role: m.role as "user" | "assistant", parts: m.parts as never[] })) };
  });

export const deleteThread = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ threadId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("assistant_threads").delete().eq("id", data.threadId).eq("user_id", context.userId);
    if (error) throw new Error("Conversation could not be deleted");
    return { ok: true };
  });
