/** Offline decimal/JSON proposal. Never imported by runtime cache code.
 * Parsed JS numbers encode the decimal token emitted by JSON.stringify; raw exact
 * decimals can use canonicalDecimal directly. This does not recover lost precision.
 */
const encoder = new TextEncoder();
export function canonicalDecimal(token: string): string {
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) throw new Error("Invalid JSON number token");
  const fraction = match[3] ?? "";
  let digits = `${match[2]}${fraction}`.replace(/^0+/, "");
  if (!digits) return "d0e0;";
  let exponent = BigInt(match[4] ?? "0") - BigInt(fraction.length);
  while (digits.endsWith("0")) { digits = digits.slice(0, -1); exponent++; }
  return `d${match[1]}${digits}e${exponent};`;
}
function stringEncoding(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Lone surrogate");
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new Error("Lone surrogate");
  }
  return `s${encoder.encode(value).length}:${value}`;
}
function compareUtf8(a: string, b: string) {
  const x = encoder.encode(a), y = encoder.encode(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) { const delta = (x[i] ?? 0) - (y[i] ?? 0); if (delta) return delta; }
  return x.length - y.length;
}
export function proposedJsonEncoding(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return "n;";
  if (typeof value === "boolean") return value ? "t;" : "f;";
  if (typeof value === "string") return stringEncoding(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Nonfinite JSON number");
    return canonicalDecimal(JSON.stringify(value));
  }
  if (typeof value !== "object" || (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value))) throw new Error("Non-JSON value");
  if (ancestors.has(value)) throw new Error("Cyclic JSON value");
  if (Object.getOwnPropertySymbols(value).length) throw new Error("Symbol properties");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length || !Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean)) throw new Error("Sparse/extended array");
      return `a${value.length}:${value.map(item => proposedJsonEncoding(item, ancestors)).join("")}`;
    }
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort(compareUtf8);
    return `o${keys.length}:${keys.map(key => stringEncoding(key) + proposedJsonEncoding(object[key], ancestors)).join("")}`;
  } finally { ancestors.delete(value); }
}
export function proposedJsonBytes(value: unknown) { return encoder.encode(`iiaf-proof/2:${proposedJsonEncoding(value)}`); }