import { InstitutionDomains } from "@/components/iiaf/institution-domains";
import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DataTable, PageHeader, PlaceholderNotice, PlannedButton, Status } from "@/components/iiaf/ui";

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
        actions={<PlannedButton><Upload className="size-4" /> Upload documents</PlannedButton>}
      />
      <PlaceholderNotice>
        Uploading, parsing and extraction are not built yet. The table shows sample rows for layout review.
      </PlaceholderNotice>
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
