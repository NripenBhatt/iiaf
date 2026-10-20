import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/seo";
export const Route=createFileRoute("/auth/callback")({head:()=>pageHead("Completing sign-in","Complete secure IIAF sign-in."),component:Callback});
function Callback(){const navigate=useNavigate();const [failed,setFailed]=useState(false);useEffect(()=>{void supabase.auth.getUser().then(({data})=>{if(data.user)void navigate({to:"/"});else setFailed(true);});},[navigate]);return <main className="mx-auto max-w-md px-6 py-20"><h1 className="text-2xl">{failed?"Sign-in could not be completed":"Completing sign-in…"}</h1>{failed&&<Button className="mt-6" onClick={()=>navigate({to:"/auth"})}>Return to sign in</Button>}</main>;}