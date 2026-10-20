import { createFileRoute,useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { Button } from "@/components/ui/button";
export const Route=createFileRoute("/unauthorized")({head:()=>pageHead("Access denied","Your assigned IIAF role does not permit this page."),component:Denied});
function Denied(){const navigate=useNavigate();return <main className="mx-auto max-w-md px-6 py-20"><h1 className="text-2xl">Access denied</h1><p className="my-5 text-muted-foreground">Your assigned organization and role do not permit this page.</p><Button onClick={()=>navigate({to:"/"})}>Return to your workspace</Button></main>;}