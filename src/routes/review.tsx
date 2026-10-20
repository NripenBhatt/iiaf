import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DataTable, InternalOnly, PageHeader, Panel, PlaceholderNotice, Status } from "@/components/iiaf/ui";

export const Route = createFileRoute("/review")({
  head: () => pageHead("Review & Certification", "Review queues and registrar certification of evidence packages."),
  component: Page,
});

const steps = ["Prepared", "Reviewed", "Approved", "Certified by Registrar", "Released"];

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Assurance"
        title="Review & Certification"
        description="Every package moves through explicit, human-controlled states."
      />
      <InternalOnly>
      <PlaceholderNotice>Approvals and signatures are not functional. Nothing on this page certifies anything.</PlaceholderNotice>
      <Analytics page="review" />
      <Panel title="Certification lifecycle" className="mb-6">
        <ol className="flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2 text-sm">
              <span className="flex size-6 items-center justify-center rounded-full border font-mono text-xs">{i + 1}</span>
              {s}
              {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
            </li>
          ))}
        </ol>
      </Panel>
      <DataTable
        caption="Review queue"
        columns={["Package", "Framework", "Assigned to", "Stage"]}
        rows={[
          ["Criterion 3 dossier", "NAAC", "IQAC Coordinator", <Status tone="warning">Reviewed</Status>],
          ["NIRF data capture 2026", "NIRF", "Registrar", <Status tone="gold">Awaiting certification</Status>],
          ["Green campus evidence", "UI GreenMetric", "—", <Status>Prepared</Status>],
        ]}
      />
      </InternalOnly>
    </>
  );
}
