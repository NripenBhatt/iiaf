import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
export const recordSessionEvent = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({organizationId:z.string().uuid(),event:z.enum(["session.sign_in","session.sign_out","workspace.selected"])})).handler(async({context,data})=>{
  const {error}=await context.supabase.rpc("record_security_event",{_org:data.organizationId,_event:data.event});
  if(error)throw new Error("Unable to record security event");return {ok:true};
});