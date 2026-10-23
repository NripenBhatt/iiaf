import type { GeneratedOutput } from "@/lib/output-contract";

export function OutputPreview({ output }: { output: GeneratedOutput }) {
  return <div className="space-y-3 text-sm">
    {output.authored&&<p className="text-muted-foreground">{output.authored.cautions.join(" ")}</p>}
    {output.qualification?.some(q => q.rules.some(r => r.ruleId === "Q13")) && <p className="text-muted-foreground">Recognised text requires comparison with the original. Images, logos and graphics are not reproduced in this text draft.</p>}
    <p className="whitespace-pre-wrap break-words">{output.body}</p>
    {output.tables?.map(t => <div key={t.id} className="max-w-full overflow-auto"><h4 className="font-medium">{t.name}</h4><table className="w-full border-collapse text-left text-xs"><thead><tr>{["Row / source", "Column / cell", "Value", "Raw / stored formula"].map(h => <th key={h} className="border bg-muted p-2">{h}</th>)}</tr></thead><tbody>{t.rows.flatMap(r => r.cells.map(c => <tr key={`${r.locator}-${c.column}`}><td className="border p-2">{r.row} · {r.locator}</td><td className="border p-2">{c.column} · {c.ref}</td><td className="whitespace-pre-wrap border p-2">{c.value}</td><td className="border p-2">{c.raw}{c.formula && ` · ${c.formula} (not executed)`}</td></tr>))}</tbody></table></div>)}
    <p className="break-all text-xs text-muted-foreground">DRAFT · {output.manifest?.classification ?? "Classification unknown / unverified"} · Human review required · Not verified coverage{output.manifest && ` · Job ${output.manifest.jobId} · Parser ${output.manifest.parserVersion}`}</p>
  </div>;
}