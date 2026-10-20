import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DataTable, PageHeader, PlaceholderNotice, PlannedButton, Stat, Status } from "@/components/iiaf/ui";

export const Route = createFileRoute("/meetings")({
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
        actions={<PlannedButton><Upload className="size-4" /> Upload meeting record</PlannedButton>}
      />
      <PlaceholderNotice>Meeting capture and action tracking are planned for a later phase.</PlaceholderNotice>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Meetings this term" value="14" />
        <Stat label="Open actions" value="38" />
        <Stat label="Overdue" value="6" />
      </div>
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
