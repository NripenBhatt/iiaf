import { it, expect, describe } from "vitest";
import { proposedEncoding, proposedBytes } from "../../scripts/g3-encoding-proof";
describe("G3 offline restricted-domain proposal (not SQL parity)", () => {
  it("uses exact UTF-8 lengths for Hindi and astral Unicode", () => { expect(proposedEncoding("हिंदी")).toBe("s15:हिंदी"); expect(proposedEncoding("😀")).toBe("s4:😀"); });
  it("sorts object keys but preserves array order", () => { expect(proposedEncoding({ b: 2, a: 1 })).toBe("o2:s1:ai1;s1:bi2;"); expect(proposedEncoding([1, 2])).not.toBe(proposedEncoding([2, 1])); });
  it("separates null, missing and empty strings", () => { expect(new Set([proposedEncoding({}), proposedEncoding({ a: null }), proposedEncoding({ a: "" })]).size).toBe(3); });
  it("rejects fractional, unsafe, nonfinite and undefined values", () => { for (const v of [0.1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, undefined, { a: undefined }]) expect(() => proposedEncoding(v)).toThrow(); });
  it("rejects malformed Unicode without replacement or normalization", () => { expect(() => proposedEncoding("\ud800")).toThrow(); expect(proposedEncoding("é")).not.toBe(proposedEncoding("e\u0301")); });
  it("has a separate non-runtime proof domain and unambiguous delimiters", () => { expect(new TextDecoder().decode(proposedBytes(["a:b", "c"]))).toBe("iiaf-proof/1:a2:s3:a:bs1:c"); expect(proposedEncoding(["ab", "c"])).not.toBe(proposedEncoding(["a", "bc"])); });
});