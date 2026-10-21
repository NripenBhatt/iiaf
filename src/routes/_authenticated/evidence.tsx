import { validateListSearch } from "@/lib/list-filters";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DocumentUploads } from "@/components/iiaf/document-uploads";
import { FactReview } from "@/components/iiaf/fact-review";
import { PageHeader } from "@/components/iiaf/ui";

export const Route = createFileRoute("/_authenticated/evidence")({
  validateSearch: validateListSearch,
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
      <DocumentUploads module="evidence" label="Evidence files" />
      <details className="mb-8 border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">Reviewer tools · extracted facts awaiting human review</summary><div className="mt-4"><FactReview module="evidence" /></div></details>
      <div className="mb-6 flex flex-wrap gap-2">
        {frameworks.map((f, i) => (
          <span key={f} className={i === 0 ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" : "rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"}>
            {f}
          </span>
        ))}
      </div>
      <div className="border-t py-5"><h2 className="font-semibold">Official requirement mapping · Blocked</h2><p className="mt-2 text-sm text-muted-foreground">An exact official methodology edition, requirement identifier and reviewed source linkage are required. Declared frameworks and uploaded drafts do not establish verified coverage.</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Edition / effective period</dt><dd>Not verified</dd></div><div><dt className="text-muted-foreground">Criterion / metric / unit</dt><dd>Not established</dd></div><div><dt className="text-muted-foreground">Owner / package / deadline</dt><dd>Not assigned</dd></div><div><dt className="text-muted-foreground">Mapping / approval</dt><dd>Blocked pending authoritative details and review</dd></div></dl></div>
    </>
  );
}
