import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPTY_FILTERS, validateListSearch, PAGE_SIZE, type ListFilters } from "@/lib/list-filters";

export function useListFilters() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const filters = validateListSearch(search);
  const update = (patch: Partial<ListFilters>) => {
    if (pathname !== "/reports" && pathname !== "/institutional" && pathname !== "/meetings" && pathname !== "/evidence") return;
    void navigate({ to: pathname, search: { ...filters, ...patch, page: patch.page ?? 1 } });
  };
  return { filters, update };
}
type Choice = { value: string; label: string };
export function ListFilterControls({ filters, update, total, categories = [], types = [], outputs = false }: {
  filters: ListFilters; update: (patch: Partial<ListFilters>) => void; total?: number; categories?: Choice[]; types?: Choice[]; outputs?: boolean;
}) {
  const select = (key: keyof ListFilters, label: string, choices: Choice[]) => <label className="space-y-1 text-xs text-muted-foreground"><span>{label}</span><select aria-label={label} className="h-9 w-full border bg-background px-2 text-sm text-foreground" value={String(filters[key])} onChange={e => update({ [key]: e.target.value })}><option value="">All</option>{choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>;
  const active = Object.entries(filters).filter(([k, v]) => !["page", "sort", "dateField"].includes(k) && v !== "");
  return <div className="space-y-3 border-b p-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 text-xs text-muted-foreground"><span>Search {outputs ? "outputs and source filenames" : "filenames and titles"}</span><Input aria-label="Search records" value={filters.q} onChange={e => update({ q: e.target.value })} /></label>
      {outputs && select("module", "Module", [{ value: "institutional", label: "Institutional" }, { value: "meeting", label: "Meeting" }, { value: "evidence", label: "Evidence" }])}
      {categories.length > 0 && select("category", "Category", categories)}
      {types.length > 0 && select("type", outputs ? "Output type" : "Document type", types)}
      {select("status", "Status", outputs ? [{ value: "draft", label: "Draft" }] : ["needs_review", "extracted", "awaiting_processing", "processing_failed", "ocr_required", "upload_failed", "validation_failed"].map(value => ({ value, label: value.replaceAll("_", " ") })))}
      <label className="space-y-1 text-xs text-muted-foreground"><span>Date meaning · UTC</span><select aria-label="Date meaning" className="h-9 w-full border bg-background px-2 text-sm text-foreground" value={filters.dateField} onChange={e => update({ dateField: e.target.value as ListFilters["dateField"] })}><option value="created">Source record created</option><option value="uploaded">Source uploaded</option>{outputs && <option value="generated">Output generated</option>}</select></label>
      <label className="space-y-1 text-xs text-muted-foreground"><span>From</span><Input aria-label="From date" type="date" value={filters.from} onChange={e => update({ from: e.target.value })} /></label>
      <label className="space-y-1 text-xs text-muted-foreground"><span>Through</span><Input aria-label="Through date" type="date" value={filters.to} onChange={e => update({ to: e.target.value })} /></label>
      <label className="space-y-1 text-xs text-muted-foreground"><span>Order · {outputs ? "generated date" : "selected date"}</span><select aria-label="Order" className="h-9 w-full border bg-background px-2 text-sm text-foreground" value={filters.sort} onChange={e => update({ sort: e.target.value as ListFilters["sort"] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div>
    <div className="flex flex-wrap items-center gap-2">{active.map(([key, value]) => <Button key={key} size="sm" variant="outline" onClick={() => update({ [key]: "" })} aria-label={`Remove ${key} filter`}>{key}: {String(value)}<X className="size-3" /></Button>)}<Button size="sm" variant="ghost" onClick={() => update(EMPTY_FILTERS)}><RotateCcw /> Clear all</Button></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span aria-live="polite">{total === undefined ? "Count not yet confirmed" : `${total} matching ${outputs ? "outputs" : "documents"} · Page ${filters.page} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}</span><div className="flex gap-1"><Button size="icon" variant="outline" aria-label="Previous page" disabled={total === undefined || filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}><ChevronLeft /></Button><Button size="icon" variant="outline" aria-label="Next page" disabled={total === undefined || filters.page * PAGE_SIZE >= total} onClick={() => update({ page: filters.page + 1 })}><ChevronRight /></Button></div></div>
  </div>;
}