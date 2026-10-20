import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
export const Route=createFileRoute("/access-pending")({head:()=>pageHead("Organization access pending","An administrator must assign IIAF organization membership."),component:Pending});
function Pending(){const navigate=useNavigate();return <main className="mx-auto max-w-md px-6 py-20"><h1 className="text-2xl">Organization access pending</h1><p className="my-5 text-muted-foreground">Your account has no active organization role. Contact your administrator to assign access.</p><Button onClick={()=>navigate({to:"/"})}>Check access again</Button><Button variant="outline" className="ml-3" onClick={async()=>{await supabase.auth.signOut();await navigate({to:"/auth",replace:true});}}>Sign out</Button></main>;}