import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListFilterControls, useListFilters } from "@/components/iiaf/list-filters";
import { PageHeader, Status } from "@/components/iiaf/ui";
import { useWorkspace } from "@/components/iiaf/workspace";
import { validateListSearch } from "@/lib/list-filters";
import { listSavedOutputs } from "@/lib/saved-outputs.functions";
import { OUTPUT_CATALOGUE } from "@/lib/output-catalogue";
import { outputDocx, outputFileBase, outputText, outputsZip } from "@/lib/output-export";
import { saveBlob } from "@/lib/package-export";
import { getDocumentLink } from "@/lib/documents.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/reports")({
  validateSearch: validateListSearch,
  head: () => pageHead("Reports & Outputs", "Saved IIAF output drafts, source lineage, filters and downloads; approval and release remain separate."),
  component: Page,
});
function Page() {
  const { workspace } = useWorkspace();
  const { filters, update } = useListFilters();
  const list = useServerFn(listSavedOutputs); const link = useServerFn(getDocumentLink);
  const { data, error, isFetching } = useQuery({ queryKey: ["saved-outputs", workspace.id, filters], queryFn: () => list({ data: { organizationId: workspace.id, filters } }) });
  const types = Array.from(new Map(Object.values(OUTPUT_CATALOGUE).flat().map(t => [t.id, { value: t.id, label: t.name }])).values());
  async function openOriginal(documentId: string) {
    try { const { url } = await link({ data: { id: documentId } }); window.open(url, "_blank", "noopener"); }
    catch { toast.error("The original could not be opened."); }
  }
  return <>
    <PageHeader eyebrow="Output engine" title="Reports & Outputs" description="Saved text drafts with their source documents. Approval, release and publication are separate." />
    <section className="border bg-card" aria-label="Saved outputs">
      <ListFilterControls outputs filters={filters} update={update} total={error || isFetching ? undefined : data?.total} types={types} />
      {isFetching && <p role="status" className="p-4 text-sm text-muted-foreground">Loading saved outputs…</p>}
      {error && <p role="alert" className="p-4 text-sm text-destructive">Saved outputs could not be loaded. No count or results are confirmed.</p>}
      {!isFetching && !error && data?.rows.length === 0 && <p className="p-5 text-sm text-muted-foreground">No saved outputs match these filters. Clear filters to see other drafts.</p>}
      <div className="divide-y">{!error && data?.rows.map(row => <article key={`${row.setId}-${row.index}`} className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{row.output.name} · {row.module}</p><h2 className="font-semibold">{row.output.title}</h2></div><Status>Draft · not approved</Status></div>
        <p className="text-xs text-muted-foreground">Source: {row.sourceName} · Generated {new Date(row.generatedAt).toLocaleString()} · Parser {row.sourceVersion}</p>
        <p className="text-xs text-muted-foreground">Data classification: not recorded per source. Not verified coverage.{workspace.name.includes("SYNTHETIC") ? " SYNTHETIC DEMO workspace." : ""}</p>
        <details><summary className="cursor-pointer text-sm font-medium">Preview</summary><p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm">{row.output.body}</p></details>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void outputDocx(row.output, row.sourceName).then(b => saveBlob(b, `${outputFileBase(row.output, row.sourceName)}.docx`))}><Download /> Word</Button><Button size="sm" variant="outline" onClick={() => saveBlob(new Blob([outputText(row.output, row.sourceName)], { type: "text/plain" }), `${outputFileBase(row.output, row.sourceName)}.txt`)}><Download /> Text</Button><Button size="sm" variant="ghost" onClick={() => void outputsZip([row.output], row.sourceName).then(b => saveBlob(b, `${outputFileBase(row.output, row.sourceName)}.zip`))}><Download /> ZIP</Button><Button size="sm" variant="ghost" onClick={() => void openOriginal(row.documentId)}>Original</Button><Button size="sm" variant="ghost" onClick={() => update({ source: row.documentId })}>Same source</Button></div>
      </article>)}</div>
    </section>
  </>;
}
