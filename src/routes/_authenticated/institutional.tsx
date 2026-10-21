import { validateListSearch } from "@/lib/list-filters";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DocumentUploads } from "@/components/iiaf/document-uploads";
import { FactReview } from "@/components/iiaf/fact-review";
import { PageHeader } from "@/components/iiaf/ui";

export const Route = createFileRoute("/_authenticated/institutional")({
  validateSearch: validateListSearch,
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
    </>
  );
}
