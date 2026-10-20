import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DataTable, InternalOnly, PageHeader, PlaceholderNotice } from "@/components/iiaf/ui";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => pageHead("Audit & Activity", "Who did what, when, to which record."),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader eyebrow="Assurance · Internal" title="Audit & Activity" description="Illustrative operator activity across the platform; no real audit events are stored." />
      <InternalOnly>
        <PlaceholderNotice>No events are recorded yet. Entries below are sample rows.</PlaceholderNotice>
        <Analytics page="audit" />
        <DataTable
          caption="Activity log"
          columns={["Time", "Actor", "Action", "Record"]}
          rows={[
            [<span className="font-mono text-xs">2026-10-18 14:02</span>, "A. Menon", "Changed mapping state", "NAAC 3.2.1"],
            [<span className="font-mono text-xs">2026-10-18 11:47</span>, "R. Iyer", "Generated draft", "Leadership risk brief"],
            [<span className="font-mono text-xs">2026-10-17 16:20</span>, "IQAC Coordinator", "Uploaded file", "IQAC minutes — Mar"],
          ]}
        />
      </InternalOnly>
    </>
  );
}
