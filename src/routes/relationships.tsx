import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DataTable, InternalOnly, PageHeader, Panel, PlaceholderNotice, Status } from "@/components/iiaf/ui";

export const Route = createFileRoute("/relationships")({
  head: () => pageHead("Relationship Intelligence", "Connections between facts, documents, evidence, meetings and outputs."),
  component: Page,
});

const nodes = [
  { label: "Grants fact", x: 16, y: 30 },
  { label: "Ledger", x: 14, y: 75 },
  { label: "NAAC 3.2.1", x: 50, y: 18 },
  { label: "Council decision", x: 50, y: 78 },
  { label: "Report", x: 84, y: 45 },
];

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Intelligence · Internal"
        title="Relationship Intelligence"
        description="How facts, sources, evidence, meetings and outputs connect. Candidate links are never treated as approved."
      />
      <InternalOnly>
        <PlaceholderNotice>No relationship rules run yet. The diagram is a static illustration.</PlaceholderNotice>
        <div className="grid gap-6 lg:grid-cols-5">
          <Panel title="Illustrative graph" className="lg:col-span-3">
            <div className="hatch relative h-72 overflow-hidden rounded-lg border">
              <svg className="absolute inset-0 size-full" aria-hidden>
                {([[0, 2], [1, 0], [2, 4], [3, 4], [0, 3]] as const).map(([a, b], i) => (
                  <line key={i} x1={`${nodes[a].x}%`} y1={`${nodes[a].y}%`} x2={`${nodes[b].x}%`} y2={`${nodes[b].y}%`} className="stroke-teal" strokeWidth={1.5} strokeDasharray={i === 4 ? "4 4" : undefined} />
                ))}
              </svg>
              {nodes.map((n) => (
                <span key={n.label} style={{ left: `${n.x}%`, top: `${n.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs shadow-card">
                  {n.label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Dashed line = candidate link awaiting review.</p>
          </Panel>
          <div className="lg:col-span-2">
            <DataTable
              caption="Link queue"
              columns={["From", "To", "State"]}
              rows={[
                ["Grants fact", "NAAC 3.2.1", <Status tone="gold">Candidate</Status>],
                ["Ledger", "Grants fact", <Status tone="success">Approved</Status>],
                ["Grants fact", "Council decision", <Status tone="gold">Candidate</Status>],
              ]}
            />
          </div>
        </div>
      </InternalOnly>
    </>
  );
}
