import { Administration } from "@/components/iiaf/administration";
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
      <PageHeader eyebrow="Assurance · Internal" title="Audit & Activity" description="Persisted security and administrative events; analytical examples remain labelled samples." />
      <InternalOnly>
        <Administration view="audit" />
        <PlaceholderNotice>The analytical charts and workflow entries below are samples; document workflows are not implemented.</PlaceholderNotice>
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
