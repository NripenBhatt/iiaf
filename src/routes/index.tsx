import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DemoTag, PageHeader, Panel, Stat, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";
import { getNavGroups } from "@/components/iiaf/nav";

export const Route = createFileRoute("/")({
  head: () => pageHead("Overview", "Workspace overview of institutional information, evidence, reviews and outputs."),
  component: Overview,
});

function Overview() {
  const { workspace } = useWorkspace();
  const isUni = workspace.kind === "university";
  const modules = getNavGroups(workspace.kind).flatMap((g) => g.items).filter(
    (i) => i.url !== "/" && !(isUni && i.internalOnly),
  );

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={isUni ? "University workspace · demonstration" : "Operator workspace · demonstration"} title={isUni ? "University Overview" : "Rafts and Rivers Overview"} description={isUni ? "Demo University · institutional records, evidence, actions and designated outputs." : "Institutional portfolio, evidence coverage and operational review priorities."} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Source documents" value={isUni ? "340" : "1,284"} hint="Illustrative count" />
        <Stat label="Evidence items" value={isUni ? "84" : "312"} hint={isUni ? "Institution sample inventory" : "Across 4 frameworks"} />
        <Stat label="Open reviews" value={isUni ? "8" : "27"} hint="Awaiting reviewer" />
        <Stat label="Released outputs" value={isUni ? "2" : "9"} hint="Illustrative release count" />
      </div>

      <Analytics page="overview" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Modules" description="Navigate the workspace" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((m) => (
              <Link
                key={m.url}
                to={m.url}
                className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-teal/50 hover:bg-teal-soft/50"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-muted text-primary">
                  <m.icon className="size-4" />
                </span>
                <span className="flex-1 text-sm font-medium">{m.title}</span>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Recent activity" aside={<DemoTag />}>
          <ul className="space-y-4 text-sm">
            {[
              ["IQAC minutes — Mar 2026", "Uploaded", "neutral"],
              ["NAAC 3.2.1 research funding", "In review", "warning"],
              ["Annual profile 2025–26", "Draft", "teal"],
              ["Placement data 2025", "Verified", "success"],
            ].map(([t, s, tone]) => (
              <li key={t} className="flex items-start justify-between gap-3">
                <span>{t}</span>
                <Status tone={tone as "neutral"}>{s}</Status>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
