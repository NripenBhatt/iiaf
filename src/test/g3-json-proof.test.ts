import { describe, expect, it } from "vitest";
import { canonicalDecimal, proposedJsonEncoding } from "../../scripts/g3-json-proof";
describe("offline full JSON decimal proposal — not runtime migration acceptance", () => {
  it("preserves fractional values without restricting legitimate payload numbers", () => {
    expect(proposedJsonEncoding({ cell: 0.1, x: -12.50 })).toBe("o2:s4:celld1e-1;s1:xd-125e-1;");
  });
  it("canonicalizes equivalent exact tokens including negative zero", () => {
    for (const token of ["1", "1.00", "1e0", "10e-1"]) expect(canonicalDecimal(token)).toBe("d1e0;");
    expect(canonicalDecimal("-0.00e+100")).toBe("d0e0;");
    expect(canonicalDecimal("9007199254740993")).toBe("d9007199254740993e0;");
  });
  it("covers finite numeric boundaries and retains raw-token precision separately", () => {
    expect(proposedJsonEncoding(Number.MIN_VALUE)).toBe("d5e-324;");
    expect(proposedJsonEncoding(Number.MAX_VALUE)).toBe("d17976931348623157e292;");
    expect(canonicalDecimal("9007199254740993")).not.toBe(proposedJsonEncoding(Number("9007199254740993")));
  });
  it("orders UTF8 keys independently of insertion while preserving nested array order", () => {
    expect(proposedJsonEncoding({ "😀": [0.1, null], "हिंदी": true })).toBe(proposedJsonEncoding({ "हिंदी": true, "😀": [0.1, null] }));
    expect(proposedJsonEncoding([1, 2])).not.toBe(proposedJsonEncoding([2, 1]));
  });
  it("rejects unsupported JS structures rather than silently dropping them", () => {
    const cycle: unknown[] = []; cycle.push(cycle);
    for (const value of [NaN, Infinity, undefined, 1n, { a: undefined }, new Date(), cycle, Array(2), { [Symbol("x")]: 1 }, "\ud800"]) expect(() => proposedJsonEncoding(value)).toThrow();
  });
  it("is key-order independent where JSON.stringify is not — the exact runtime gap 0013 would close", () => {
    const a = { x: 1, y: [2, 3] }; const b = { y: [2, 3], x: 1 };
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(proposedJsonEncoding(a)).toBe(proposedJsonEncoding(b));
  });
  it("two concurrent writers with equal content in different key order produce one canonical winner", () => {
    const writerA = { outputs: [{ name: "n", body: "b" }], segmentCount: 2, skipped: [] };
    const writerB = { segmentCount: 2, skipped: [], outputs: [{ body: "b", name: "n" }] };
    expect(JSON.stringify(writerA)).not.toBe(JSON.stringify(writerB));
    expect(proposedJsonEncoding(writerA)).toBe(proposedJsonEncoding(writerB));
  });
  it("still distinguishes semantically different payloads that share a key set", () => {
    expect(proposedJsonEncoding({ v: 1 })).not.toBe(proposedJsonEncoding({ v: "1" }));
    expect(proposedJsonEncoding({ v: 1 })).not.toBe(proposedJsonEncoding({ v: 1.5 }));
  });
});