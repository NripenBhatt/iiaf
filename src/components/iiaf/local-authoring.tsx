import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localDrafts, localDraftText, localDraftWord, localVisualZip, renderDraftImage } from "@/lib/local-artifacts";
import { saveBlob } from "@/lib/package-export";
import type { Lineage } from "@/lib/lineage.functions";
import { SavedEventAuthoring } from "./saved-event-authoring";

export function LocalAuthoring({ lineage }: { lineage: Lineage }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  const drafts = useMemo(() => lineage.job && ["extracted", "needs_review"].includes(lineage.job.state) ? localDrafts({ documentId: lineage.document.id, jobId: lineage.job.id, filename: lineage.document.original_filename, originalHash: lineage.document.sha256_hash, parserVersion: lineage.job.processor_version ?? "", classification: /synthetic|demo|fictional|dummy|काल्पनिक|नमूना/i.test(lineage.document.original_filename + lineage.segments.map(s => s.content).join("\n")) ? "DEMO" : "unverified", lines: lineage.segments }) : [], [lineage]);
  async function download(key: string, task: () => Promise<Blob>, filename: string) {
    setBusy(key); setError(""); try { saveBlob(await task(), filename); } catch (e) { setError(e instanceof Error ? e.message : "The download could not be created."); } finally { setBusy(null); }
  }
  return <><SavedEventAuthoring lineage={lineage}/><section className="my-5 space-y-3" aria-label="Local authored drafts">
    <h3 className="font-semibold">Authored drafts · not saved</h3>
    <p className="text-xs text-muted-foreground">Human review required. These drafts are not saved outputs, approved mappings or released content. Saving requires separate approval of the output safeguards.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!drafts.length && <p className="text-sm text-muted-foreground">No unambiguous explicit event title/date or institution profile fields support the available writing templates. Saved source text remains available; missing values are not invented.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{drafts.map(d => <article key={d.type} className="border bg-background p-4">
      <p className="text-xs text-muted-foreground">{d.classification} · {d.catalogueId} · {d.type.replace(/_/g, " ")} · Not persisted</p>
      <h4 className="mt-2 font-semibold">{d.title}</h4><p className="mt-3 whitespace-pre-wrap text-sm">{d.body}</p>
      <p className="mt-3 text-xs text-muted-foreground">{d.cautions.join(" ")}</p>
      <details className="mt-3 text-xs"><summary>Source citations and missing values</summary>{d.citations.map(c => <p key={c.locatorKey} className="mt-1 break-all">{c.filename} · {c.locatorKey} · {c.raw}</p>)}<p className="mt-2">{d.missing.join("; ") || "No missing fields in this limited template"}</p></details>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => saveBlob(new Blob([localDraftText(d)], { type: "text/plain" }), `${d.type}-unsaved.txt`)}><Download /> Draft text</Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(d.type, () => localDraftWord(d), `${d.type}-unsaved.docx`)}><Download /> Draft Word</Button>
        {d.type === "press_release" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(d.type + "-png", () => renderDraftImage(d, `${d.title}\n\n${d.body}`), "news-creative-unsaved.png")}><Download /> PNG creative</Button>}
        {d.type === "instagram" && <><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(d.type, () => localVisualZip(d, false), "local-image-with-lineage.zip")}><Download /> Image + lineage</Button><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(d.type, () => localVisualZip(d, true), "local-carousel-with-lineage.zip")}><Download /> Carousel + lineage</Button></>}
      </div>
    </article>)}</div>
    {busy && <p role="status" className="text-sm">Creating {busy.replace(/_/g, " ")} download…</p>}
  </section></>;
}