import { InstitutionDomains } from "@/components/iiaf/institution-domains";
import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DocumentUploads } from "@/components/iiaf/document-uploads";
import { FactReview } from "@/components/iiaf/fact-review";
import { DataTable, PageHeader, Status } from "@/components/iiaf/ui";

export const Route = createFileRoute("/_authenticated/institutional")({
  head: () => pageHead("Institutional Information", "Institution profile, departments, programmes, faculty, policies and reports."),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Upload engine · Information"
        title="Institutional Information"
        description="Profile, departments, programmes, faculty, policies, research, placements and institutional reports — preserved at source with extraction and review status."
      />
      <DocumentUploads module="institutional" label="Institutional documents" />
      <details className="mb-8 border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">Reviewer tools · extracted facts awaiting human review</summary><div className="mt-4"><FactReview module="institutional" /></div></details>
      <Analytics page="institutional" />
      <InstitutionDomains />
      <DataTable
        caption="Source documents"
        columns={["Document", "Category", "Period", "Extraction", "Review"]}
        rows={[
          ["Institutional Profile 2025–26.pdf", "Profile", "2025–26", <Status tone="success">Extracted</Status>, <Status tone="success">Verified</Status>],
          ["Faculty roster.xlsx", "Faculty", "2025–26", <Status tone="success">Extracted</Status>, <Status tone="warning">In review</Status>],
          ["Placement report 2025.pdf", "Placements", "2024–25", <Status tone="teal">Processing</Status>, <Status>Not started</Status>],
          ["Research policy v3.docx", "Policy", "—", <Status tone="danger">Needs attention</Status>, <Status>Not started</Status>],
        ]}
      />
    </>
  );
}
