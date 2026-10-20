import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DocumentUploads } from "@/components/iiaf/document-uploads";
import { FactReview } from "@/components/iiaf/fact-review";
import { DataTable, PageHeader, PlaceholderNotice, Stat, Status } from "@/components/iiaf/ui";

export const Route = createFileRoute("/_authenticated/meetings")({
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
      <PlaceholderNotice>Meeting files upload and are stored privately. Text and labelled fields can be extracted for review; meeting decisions and action items are not yet parsed into linked records. Figures below are samples.</PlaceholderNotice>
      <DocumentUploads module="meeting" label="Meeting records" />
      <FactReview module="meeting" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Meetings this term" value="14" />
        <Stat label="Open actions" value="38" />
        <Stat label="Overdue" value="6" />
      </div>
      <Analytics page="meetings" />
      <DataTable
        caption="Meeting register"
        columns={["Meeting", "Agenda", "Minutes", "Decision", "State"]}
        rows={[["Academic Council · 12 Mar 2026", "Research incentive policy", "Minutes v1 · sample", "Revise policy", <Status tone="warning">Implementation pending</Status>], ["IQAC · 04 Mar 2026", "Placement outcomes", "Minutes v2 · sample", "Publish summary", <Status tone="gold">Action overdue</Status>]]}
      />
      <div className="h-5" />
      <DataTable
        caption="Action items"
        columns={["Action", "Meeting", "Owner", "Due", "Status"]}
        rows={[
          ["Revise research incentive policy", "Academic Council · 12 Mar", "Dean, Research", "30 Apr", <Status tone="warning">In progress</Status>],
          ["Publish placement summary", "IQAC · 04 Mar", "Placement Officer", "15 Mar", <Status tone="danger">Overdue</Status>],
          ["Upload completion evidence", "Board of Studies · 20 Feb", "HoD, CSE", "10 Mar", <Status tone="success">Completed</Status>],
        ]}
      />
    </>
  );
}
