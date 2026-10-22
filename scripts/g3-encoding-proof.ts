/** Offline proposal only. Not imported by application code and not a cache-key implementation.
 * Domain: JSON null/booleans, valid Unicode strings, safe integers, ordered arrays and
 * plain objects with UTF-8-byte-sorted keys. Fractions, undefined and lone surrogates fail.
 * Grammar: n; t; f; i<decimal>; s<byteLength>:<UTF8>; a<count>:<items> o<count>:<key,value pairs>.
 */
const encoder = new TextEncoder();
function validString(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Lone surrogate"); }
    else if (code >= 0xdc00 && code <= 0xdfff) throw new Error("Lone surrogate");
  }
}
function compare(a: string, b: string) { const x = encoder.encode(a), y = encoder.encode(b); for (let i = 0; i < Math.min(x.length, y.length); i++) { const delta = (x[i] ?? 0) - (y[i] ?? 0); if (delta) return delta; } return x.length - y.length; }
export function proposedEncoding(value: unknown): string {
  if (value === null) return "n;";
  if (typeof value === "boolean") return value ? "t;" : "f;";
  if (typeof value === "string") { validString(value); return `s${encoder.encode(value).length}:${value}`; }
  if (typeof value === "number") { if (!Number.isSafeInteger(value)) throw new Error("Unsupported number domain"); return `i${Object.is(value, -0) ? 0 : value};`; }
  if (Array.isArray(value)) { if (Object.keys(value).length !== value.length) throw new Error("Sparse/extended array"); return `a${value.length}:${value.map(proposedEncoding).join("")}`; }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>; const keys = Object.keys(object); keys.forEach(validString); keys.sort(compare);
    return `o${keys.length}:${keys.map(key => proposedEncoding(key) + proposedEncoding(object[key])).join("")}`;
  }
  throw new Error("Unsupported encoding domain");
}
export function proposedBytes(value: unknown) { return encoder.encode(`iiaf-proof/1:${proposedEncoding(value)}`); }