export type SourceRow = { sheet: string; row: number; identifier: string | null; fields: Record<string, unknown>; disposition: string; reason: string };
export async function importSource() {
  const { default: source } = await import("@/data/master-import-source.json");
  return source;
}
export async function importBatch(mode: "sample" | "full", offset: number) {
  const source = await importSource();
  if (offset % 100 !== 0) throw new Error("Invalid batch offset");
  const packed = mode === "sample" ? (offset === 0 ? source.sample : undefined) : source.chunks[offset / 100];
  if (!packed) throw new Error("Batch is outside source range");
  const bytes = Uint8Array.from(atob(packed), char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as SourceRow[];
}