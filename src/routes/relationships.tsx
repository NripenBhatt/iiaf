import { Analytics } from "@/components/iiaf/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DataTable, InternalOnly, PageHeader, Panel, PlaceholderNotice, Status } from "@/components/iiaf/ui";

export const Route = createFileRoute("/relationships")({
  head: () => pageHead("Relationship Intelligence", "Connections between facts, documents, evidence, meetings and outputs."),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Intelligence · Internal"
        title="Relationship Intelligence"
        description="How facts, sources, evidence, meetings and outputs connect. Candidate links are never treated as approved."
      />
      <InternalOnly>
        <PlaceholderNotice>No relationship rules run yet. Node inspection changes the illustration only; approved and candidate states are samples.</PlaceholderNotice>
        <Analytics page="relationships" />
        <DataTable caption="Link queue" columns={["From", "To", "State"]} rows={[
          ["Grants fact", "NAAC 3.2.1 · unverified label", <Status tone="gold">Candidate</Status>],
          ["Ledger", "Grants fact", <Status tone="success">Approved · sample</Status>],
          ["Grants fact", "Council decision", <Status tone="gold">Candidate</Status>],
        ]} />
      </InternalOnly>
    </>
  );
}
