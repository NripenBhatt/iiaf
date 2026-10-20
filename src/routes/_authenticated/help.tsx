import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { Analytics } from "@/components/iiaf/analytics";
import { PageHeader, PlaceholderNotice, Panel, Status, DemoTag } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/help")({ head: () => pageHead("Help, Notifications & Activity", "Workspace help, illustrative notices and institution-scoped activity."), component: Page });
function Page() {
  const { workspace } = useWorkspace();
  const [read, setRead] = useState(false);
  return <><PageHeader eyebrow="Workspace support" title="Help, Notifications & Activity" description={`${workspace.name} · notices, activity and support topics.`} /><PlaceholderNotice>Notifications and activity are fictional. Marking sample notices read changes this preview only and resets on reload.</PlaceholderNotice><Analytics page="help" /><div className="grid gap-5 lg:grid-cols-2"><Panel title="Notifications" aside={<DemoTag />}><div className="mb-4 flex items-center justify-between gap-3"><Status tone={read ? "neutral" : "warning"}>{read ? "All sample notices read" : "3 sample unread notices"}</Status><Button variant="outline" size="sm" onClick={() => setRead(true)} disabled={read}><CheckCheck />Mark read · demo</Button></div><ul className="divide-y text-sm">{["IQAC review requested — faculty roster", "Placement action due — assigned owner", "Annual profile released — Demo University"].map(t => <li key={t} className="py-3">{t}</li>)}</ul></Panel><Panel title="Help topics"><div className="divide-y">{[["Evidence status", "Uploaded sources, reviewed mappings and verified evidence are separate states. Official methodology editions remain unconfirmed."], ["Output visibility", "An institution draft may be visible to its own authorized contributors. Release and publication are separate actions; company-only analysis is excluded from this university demonstration."], ["Support", "No support service is connected in Phase 0. No request is sent from this preview."]].map(([t, body]) => <details key={t} className="py-3 text-sm"><summary className="cursor-pointer font-medium">{t}</summary><p className="mt-2 text-muted-foreground">{body}</p></details>)}</div></Panel></div></>;
}