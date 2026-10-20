export type SourceRow = { sheet: string; row: number; identifier: string | null; fields: Record<string, unknown>; disposition: string; reason: string };
export async function importSource() {
  const { default: compressed } = await import("@/data/master-import-source.json");
  const bytes = Uint8Array.from(atob(compressed.gzipBase64), char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as { source: string; sha256: string; rows: SourceRow[]; sample: SourceRow[] };
}