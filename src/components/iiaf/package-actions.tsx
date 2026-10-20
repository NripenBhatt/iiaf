import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { packageMarkdown, type PackageContent } from "@/lib/package-format";
import { packageDocx, printPackage, saveBlob, type PackageMeta } from "@/lib/package-export";

export function PackageDownloads({ content, meta, baseName }: { content: PackageContent; meta: PackageMeta; baseName: string }) {
  const name = `${baseName}_v${meta.version}_DRAFT`;
  return <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" onClick={async () => { try { saveBlob(await packageDocx(content, meta), `${name}.docx`); } catch { toast.error("Word file could not be created."); } }}><FileText /> Word v{meta.version}</Button>
    <Button size="sm" variant="outline" onClick={() => { try { printPackage(content, meta); } catch (e) { toast.error(e instanceof Error ? e.message : "Print view unavailable"); } }}><Printer /> PDF (print) v{meta.version}</Button>
    <Button size="sm" variant="ghost" onClick={() => saveBlob(new Blob([packageMarkdown(content, meta)], { type: "text/markdown;charset=utf-8" }), `${name}.md`)}><Download /> Markdown</Button>
  </div>;
}
