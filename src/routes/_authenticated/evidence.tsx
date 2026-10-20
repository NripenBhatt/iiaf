import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DocumentUploads } from "@/components/iiaf/document-uploads";
import { DataTable, PageHeader, PlaceholderNotice, Status } from "@/components/iiaf/ui";

export const Route = createFileRoute("/_authenticated/evidence")({
  head: () => pageHead("Accreditation & Ranking Evidence", "Demonstration evidence coverage and review states; official agency editions and mappings are unconfirmed."),
  component: Page,
});

const frameworks = ["NAAC", "NIRF", "QS", "THE", "UI GreenMetric"];

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Upload engine · Evidence"
        title="Accreditation & Ranking Evidence"
        description="Evidence is held against an exact agency, product and methodology version. Mappings remain proposed until reviewed."
      />
      <PlaceholderNotice>Evidence files upload and are stored privately with a declared framework only. Agency mapping and scoring are not implemented; criterion rows below are sample labels.</PlaceholderNotice>
      <DocumentUploads module="evidence" label="Evidence files" />
      <div className="mb-6 flex flex-wrap gap-2">
        {frameworks.map((f, i) => (
          <span key={f} className={i === 0 ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" : "rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"}>
            {f}
          </span>
        ))}
      </div>
      <Analytics page="evidence" />
      <DataTable
        caption="NAAC · sample methodology edition"
        columns={["Criterion", "Evidence", "Source", "Mapping", "Review"]}
        rows={[
          ["3.2.1", "Extramural research grants", "Finance ledger 2024–25", <Status tone="gold">Proposed</Status>, <Status tone="warning">In review</Status>],
          ["2.4.2", "Faculty with PhD", "Faculty roster", <Status tone="success">Approved</Status>, <Status tone="success">Verified</Status>],
          ["5.2.1", "Placement of outgoing students", "Placement report 2025", <Status tone="gold">Proposed</Status>, <Status>Not started</Status>],
          ["7.1.3", "Waste management facilities", "—", <Status tone="danger">Gap</Status>, <Status>No evidence</Status>],
        ]}
      />
    </>
  );
}
