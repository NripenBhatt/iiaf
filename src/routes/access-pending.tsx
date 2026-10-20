import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { useQueryClient } from "@tanstack/react-query";
import { clearOrganization } from "@/lib/workspace-selection";
export const Route=createFileRoute("/access-pending")({head:()=>pageHead("Organization access pending","An administrator must assign IIAF organization membership."),component:Pending});
function Pending(){const navigate=useNavigate();const queryClient=useQueryClient();return <main className="mx-auto max-w-md px-6 py-20"><h1 className="text-2xl">Organization access pending</h1><p className="my-5 text-muted-foreground">Your account has no active organization role. Contact your administrator to assign access.</p><Button onClick={()=>navigate({to:"/"})}>Check access again</Button><Button variant="outline" className="ml-3" onClick={async()=>{await queryClient.cancelQueries();queryClient.clear();clearOrganization();await supabase.auth.signOut();await navigate({to:"/auth",replace:true});}}>Sign out</Button></main>;}