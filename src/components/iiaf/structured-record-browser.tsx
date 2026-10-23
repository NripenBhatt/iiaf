import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { lineageSheets } from "@/lib/structured-export";
import { recordsCsv } from "@/lib/structured-records";
import { saveBlob } from "@/lib/package-export";
import type { Lineage } from "@/lib/lineage.functions";

export function StructuredRecordBrowser({ lineage }: { lineage: Lineage }) {
  const [type, setType] = useState("segments"); const [query, setQuery] = useState(""); const [page, setPage] = useState(0);
  const sheets = useMemo(() => lineageSheets(lineage), [lineage]);
  const rows = (sheets[type] ?? []).filter(r => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  const visible = rows.slice(page * 20, page * 20 + 20);
  return <section className="mt-5 space-y-3" aria-label="Search structured records">
    <div className="flex flex-wrap items-center gap-2"><label className="text-sm" htmlFor={`records-${lineage.document.id}`}>Record type</label><select id={`records-${lineage.document.id}`} className="border bg-background p-2 text-sm" value={type} onChange={e => { setType(e.target.value); setPage(0); }}>{Object.entries(sheets).map(([name, records]) => <option key={name} value={name}>{name.replace(/_/g, " ")} ({records.length})</option>)}</select><Input className="max-w-sm" aria-label="Search saved record values" value={query} placeholder="Search values, identifiers or locators" onChange={e => { setQuery(e.target.value); setPage(0); }} /><Button size="sm" variant="outline" disabled={!rows.length} onClick={() => saveBlob(new Blob([recordsCsv(rows)], { type: "text/csv" }), `${type}-filtered.csv`)}><Download /> Filtered CSV</Button></div>
    <p className="text-xs text-muted-foreground">{rows.length} matching records · {type === "cells" || type === "contact_candidates" ? "Derived from saved segments; not separate persisted records" : "Saved record readback"}</p>
    <div className="max-h-96 overflow-auto">{visible.map((row, i) => <details key={`${type}-${page}-${i}`} className="border-b py-2 text-xs"><summary className="cursor-pointer break-all">{String(row.id ?? row.candidateKey ?? row.locator_key ?? row.table_id ?? row.document_id)}{row.content ? ` · ${String(row.content).slice(0, 100)}` : ""}</summary><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(row, null, 2)}</pre></details>)}</div>
    {!rows.length && <p className="text-sm text-muted-foreground">No matching records.</p>}
    {rows.length > 20 && <div className="flex items-center gap-3"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs">{page + 1} / {Math.ceil(rows.length / 20)}</span><Button size="sm" variant="outline" disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
  </section>;
}