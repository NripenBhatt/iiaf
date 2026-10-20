import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ROLE_LABELS } from "./access";
export const saveOrganization = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({organizationId:z.string().uuid(),name:z.string().trim().min(2).max(160)})).handler(async({context,data})=>{
  const {data:row,error}=await context.supabase.from("organizations").update({name:data.name}).eq("id",data.organizationId).select("id").maybeSingle();if(error||!row)throw new Error("Organization update not permitted");return {ok:true};
});
export const saveProfile=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({displayName:z.string().trim().max(160)})).handler(async({context,data})=>{
  const {error}=await context.supabase.from("profiles").update({display_name:data.displayName}).eq("id",context.userId);if(error)throw new Error("Profile update failed");return {ok:true};
});
export const assignMember=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({organizationId:z.string().uuid(),userId:z.string().uuid(),role:z.enum(Object.keys(ROLE_LABELS) as [keyof typeof ROLE_LABELS,...(keyof typeof ROLE_LABELS)[]]),active:z.boolean()})).handler(async({context,data})=>{
  const {error}=await context.supabase.rpc("set_member_role",{_org:data.organizationId,_user:data.userId,_role:data.role,_active:data.active});if(error)throw new Error("Role change denied. Check organization type and last-administrator protection.");return {ok:true};
});
export const createUniversity=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({name:z.string().trim().min(2).max(160),code:z.string().trim().min(2).max(20)})).handler(async({context,data})=>{
  const {error}=await context.supabase.from("organizations").insert({name:data.name,code:data.code,kind:"university"});if(error)throw new Error("Unable to create university. Check your permissions and organization code.");return {ok:true};
});