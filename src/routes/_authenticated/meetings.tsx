import { validateListSearch } from "@/lib/list-filters";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DocumentUploads } from "@/components/iiaf/document-uploads";
import { FactReview } from "@/components/iiaf/fact-review";
import { PageHeader } from "@/components/iiaf/ui";

export const Route = createFileRoute("/_authenticated/meetings")({
  validateSearch: validateListSearch,
  head: () => pageHead("Meeting Information", "Notices, agendas, minutes, decisions and action items with owners and deadlines."),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Upload engine · Meetings"
        title="Meeting Information"
        description="Agenda, discussion, decision, action and completion proof are kept as separate records."
      />
      <DocumentUploads module="meeting" label="Meeting records" />
      <details className="mb-8 border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">Reviewer tools · extracted facts awaiting human review</summary><div className="mt-4"><FactReview module="meeting" /></div></details>
      <p className="mb-6 text-sm text-muted-foreground">Meeting actions, assignments and deadlines are not yet recorded separately. An uploaded agenda is not proof of a decision or completed action.</p>
    </>
  );
}
