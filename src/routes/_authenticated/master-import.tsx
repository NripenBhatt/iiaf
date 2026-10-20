import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Database, ShieldCheck, AlertTriangle } from "lucide-react";
import { getImportInspection, listHeldReviews } from "@/lib/import.functions";
import { HeldReview } from "@/components/iiaf/held-review";
import { useQuery } from "@tanstack/react-query";
import { selectedOrganizationId } from "@/lib/workspace-selection";
import { pageHead } from "@/lib/seo";
import { PageHeader, DataTable, Status } from "@/components/iiaf/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportControls } from "@/components/iiaf/import-controls";

function inspectionOptions() {
  const organizationId = selectedOrganizationId();
  if (!organizationId) throw new Error("Select an authorized workspace");
  return queryOptions({ queryKey: ["master-inspection", organizationId], queryFn: () => getImportInspection({ data: { organizationId } }) });
}
export const Route = createFileRoute("/_authenticated/master-import")({
  head: () => pageHead("Master Data Import", "Actual IIAF master-workbook inventory, reviewed mappings, controlled sample results and separately approved full imports."),
  loader: ({ context }) => context.queryClient.ensureQueryData(inspectionOptions()),
  component: MasterImport,
});

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}
function MasterImport() {
  const { data } = useSuspenseQuery(inspectionOptions());
  const reviewsQuery = useQuery({ queryKey: ["held-reviews"], queryFn: () => listHeldReviews() });
  const reviews = reviewsQuery.data ?? [];
  const reviewedCount = data.issues.filter(i => reviews.some(r => r.source_sheet === i.sheet && r.source_row === i.row)).length;
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"inventory" | "validation" | "sample">("inventory");
  const summary = data.summary;
  const worksheets = data.worksheets.filter(s => `${s.name} ${s.purpose}`.toLowerCase().includes(search.toLowerCase()));
  const issues = data.issues.filter(i => `${i.sheet} ${i.identifier} ${i.kind}`.toLowerCase().includes(search.toLowerCase()));
  function errorsCsv() {
    const headers = ["Worksheet", "Physical row", "Source identifier", "Issue", "Field", "Reason"];
    const escape = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
    download("IIAF_master_import_held_rows.csv", [headers, ...data.issues.map(i => [i.sheet, i.row, i.identifier, i.kind, i.field, i.reason])].map(r => r.map(escape).join(",")).join("\n"), "text/csv;charset=utf-8");
  }
  return <div className="space-y-6">
    <PageHeader eyebrow="Phase 2 · actual workbook inspection" title="Master Data Import" description="Agency-wide reference templates and source mapping candidates · no university ownership assigned." actions={<Button variant="outline" onClick={() => download("IIAF_master_import_inspection.json", JSON.stringify(data, null, 2), "application/json")}><Download /> Inspection summary</Button>} />
    <div className="flex flex-wrap items-center gap-3 border-l-4 border-warning bg-warning-soft p-4 text-sm">
      <AlertTriangle className="size-5 shrink-0 text-warning" /><div className="min-w-0 flex-1"><p className="font-semibold">Mapping reviewed · controlled import only</p><p className="mt-1 text-muted-foreground">244 canonical rows remain held. Full import requires a verified sample rerun and separate operator approval.</p></div><Status tone="warning">Held rows excluded</Status>
    </div>
    <section className="border-b pb-5 text-sm" aria-label="Source identity"><p className="break-words font-medium">{data.source}</p><p className="mt-1 text-xs text-muted-foreground">Inspected {data.inspectionDate} · 23 worksheets · header row 1 except architecture notes · no formulas or merged cells</p><p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">SHA-256 · {data.sha256}</p></section>
    <div className="grid gap-4 md:grid-cols-3">
      <section className="border-b pb-4" aria-label="Row disposition"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-teal" /> Source row disposition</h2><dl className="space-y-2 text-sm">{[["All populated data/note rows",summary.sourceRows],["Proposed canonical records",summary.proposedRows],["Held canonical records",summary.heldRows],["Archive / projection / later phase",summary.excludedRows]].map(([name,count])=><div key={name} className="flex justify-between gap-3"><dt className="text-muted-foreground">{name}</dt><dd className="font-mono">{Number(count).toLocaleString()}</dd></div>)}</dl></section>
      <section className="border-b pb-4" aria-label="Validation matrix"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-success" /> Validation matrix</h2><dl className="space-y-2 text-sm">{[["Duplicate source identifiers",summary.duplicateIdentifiers],["Absent referenced identifiers",summary.missingReferences],["Missing required values",summary.missingRequired],["Repeated mapping rows held",summary.repeatedMappingRows]].map(([name,count])=><div key={name} className="flex justify-between gap-3"><dt className="text-muted-foreground">{name}</dt><dd className="font-mono">{count}</dd></div>)}</dl></section>
      <section className="border-b pb-4" aria-label="Binding and evidence states"><h2 className="mb-3 text-sm font-semibold">Source status boundaries</h2><dl className="space-y-2 text-sm">{[["Evidence templates marked Missing",1881],["Operational requirement families",112],["Operational field-family rows",112],["Source-labelled exact NIRF fields",13]].map(([name,count])=><div key={name} className="flex justify-between gap-3"><dt className="text-muted-foreground">{name}</dt><dd className="font-mono">{count}</dd></div>)}</dl><p className="mt-3 text-xs text-muted-foreground">Source labels are not independent verification or official mapping approval.</p></section>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1" role="tablist" aria-label="Import review">{([['inventory','Worksheets & mapping'],['validation','Held rows'],['sample','Controlled sample']] as const).map(([key,label])=><Button key={key} role="tab" aria-selected={section===key} variant={section===key?"secondary":"ghost"} onClick={()=>{setSection(key);setSearch("");}}>{label}</Button>)}</div>{section!=="sample"&&<Input className="max-w-xs" aria-label="Search inspection" placeholder="Search worksheet or source ID" value={search} onChange={e=>setSearch(e.target.value)}/>}</div>
    {section==="inventory"&&<><DataTable columns={["Worksheet / purpose","Source rows","Proposed / held","Target / readiness"]} rows={worksheets.map(s=>[<div className="max-w-sm"><p className="break-all font-mono text-xs">{s.name}</p><p className="mt-1 text-xs font-normal text-muted-foreground">{s.purpose}</p></div>,s.rows.toLocaleString(),`${s.proposed.toLocaleString()} / ${s.held.toLocaleString()}`,<div className="space-y-2"><p className="max-w-xs break-words text-xs">{s.target}</p><Status tone={s.held?"warning":s.proposed?"teal":"neutral"}>{s.held?"Partial · held rows":s.proposed?"Proposed · review pending":"Not imported"}</Status></div>])}/>
      <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">Exact source-to-target field mapping</h2><p className="text-sm text-muted-foreground">Original column names and values → source_fields, unchanged. Original identifier → source_identifier. Worksheet → source_sheet. Physical Excel row → source_row. Workbook name and SHA-256 → source identity. No status, version or relationship is manufactured.</p>{worksheets.map(s=><details key={s.name} className="border-b py-3"><summary className="cursor-pointer break-all text-sm font-medium">{s.name} · {s.headers.length} columns · {s.identifier}</summary><div className="mt-3 space-y-3 text-xs"><p>Header: {s.headerRow??"Not a table header"} · visibility: {s.visibility} · formula cells: {s.formulas} · merged ranges: {s.merged.length}</p><p>Required: {s.required.join(", ")||"Not proposed for entity import"}</p><p>References: {s.references.map(r=>`${r.field} → ${r.target}`).join("; ")||"None enforced in this proposal"}</p><div className="overflow-x-auto"><table className="w-full min-w-[480px]"><thead><tr className="border-b text-left"><th className="py-2">Original column</th><th>Target mapping</th><th>Blank source cells</th></tr></thead><tbody>{s.headers.map((h,i)=><tr key={i} className="border-b"><td className="py-2 pr-4">{h}</td><td className="pr-4">source_fields["{h}"]</td><td>{(s.blankFields as Record<string,number>)[String(h)]??0}</td></tr>)}</tbody></table></div><h3 className="font-semibold">Original status / version distributions</h3><pre className="max-h-60 overflow-auto bg-muted p-3 text-[11px]">{JSON.stringify(s.statuses,null,2)}</pre><h3 className="font-semibold">First source rows · not imported</h3><pre className="max-h-64 overflow-auto bg-muted p-3 text-[11px]">{JSON.stringify(s.samples,null,2)}</pre></div></details>)}</section></>}
    {section==="validation"&&<><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{issues.length} held-row issues · {reviewedCount} of {data.issues.length} reviewed · all remain held until corrected and revalidated.</p><Button variant="outline" onClick={errorsCsv}><Download /> Held-row details</Button></div><DataTable columns={["Worksheet / row","Original identifier","Issue / field","Why held","Review decision"]} rows={issues.map(i=>[<span className="break-all text-xs">{i.sheet} · row {i.row}</span>,i.identifier,<div><p>{i.kind}</p><p className="mt-1 text-xs text-muted-foreground">{i.field}</p></div>,<p className="max-w-sm text-xs">{i.reason}</p>,<HeldReview sheet={i.sheet} row={i.row} history={reviews.filter(r=>r.source_sheet===i.sheet&&r.source_row===i.row)}/>])}/></>}
    {section==="sample"&&<ImportControls runs={data.runs} heldReviewed={reviewedCount} heldTotal={data.issues.length}/>}
    <section className="border-t pt-5"><h2 className="mb-3 text-sm font-semibold">Inspection notes & human resolution</h2><ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">{data.notes.map(note=><li key={note}>{note}</li>)}</ul></section>
  </div>;
}