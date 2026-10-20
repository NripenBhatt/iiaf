import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DemoTag, Panel, Stat, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";
import { NAV_GROUPS } from "@/components/iiaf/nav";

export const Route = createFileRoute("/")({
  head: () => pageHead("Overview", "Workspace overview of institutional information, evidence, reviews and outputs."),
  component: Overview,
});

function Overview() {
  const { workspace } = useWorkspace();
  const isUni = workspace.kind === "university";
  const modules = NAV_GROUPS.flatMap((g) => g.items).filter(
    (i) => i.url !== "/" && !(isUni && i.internalOnly),
  );

  return (
    <div className="space-y-8">
      <section className="bg-hero relative overflow-hidden rounded-2xl p-8 text-primary-foreground sm:p-10">
        <p className="eyebrow text-sidebar-primary">{workspace.caption}</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-medium leading-tight sm:text-5xl">
          {isUni ? "Your institution, authorised outputs only." : "One traceable layer of institutional intelligence."}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-primary-foreground/75">
          {isUni
            ? "University workspaces will show only the information and outputs released to this institution."
            : "Institutional facts, meetings and accreditation evidence — preserved at source, connected, reviewed and released under control."}
        </p>
        <p className="mt-6 text-xs text-primary-foreground/60">
          Phase 0 design preview. Figures below are illustrative demonstration values.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Source documents" value="1,284" hint="Illustrative count" />
        <Stat label="Evidence items" value="312" hint="Across 4 frameworks" />
        <Stat label="Open reviews" value="27" hint="Awaiting reviewer" />
        <Stat label="Released outputs" value="9" hint="This academic year" />
      </div>

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
