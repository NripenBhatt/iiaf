import { describe, it, expect } from "vitest";
import { gunzipSync } from "node:zlib";
import source from "@/data/master-import-source.json";
type Row = { sheet: string; row: number; identifier: string | null; fields: Record<string, unknown>; disposition: string };
const decode = (packed: string): Row[] => JSON.parse(gunzipSync(Buffer.from(packed, "base64")).toString());
describe("Controlled immutable source batches", () => {
 it("accounts for the approved full source without unbounded batches", () => {
  const chunks = source.chunks.map(decode);
  expect(chunks.every(c => c.length <= 100)).toBe(true);
  expect(chunks.flat().length).toBe(32170);
  expect(chunks.flat().filter(r => r.disposition === "ready").length).toBe(11809);
  expect(chunks.flat().filter(r => r.disposition === "held").length).toBe(244);
 });
 it("uses an actual 23-row sample with three held records", () => {
  const sample = decode(source.sample);
  expect(sample.length).toBe(23);
  expect(sample.filter(r => r.disposition === "held").length).toBe(3);
  expect(sample.find(r => r.identifier === "EV-0001")?.fields["Domain_ID"]).toBeNull();
  expect(sample.find(r => r.identifier === "EV-0001")?.fields["Collection_Status"]).toBe("Missing");
  expect(sample.find(r => r.identifier === "NIRF-INNOV-REQ-001")?.fields["Agency_ID"]).toBeNull();
 });
});