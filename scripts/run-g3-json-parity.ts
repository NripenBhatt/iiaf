/** Local-only acceptance harness; requires an explicit disposable-cluster socket argument. */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { canonicalDecimal, proposedJsonEncoding } from "./g3-json-proof";
const socket = process.argv[2];
if (!socket?.startsWith("/tmp/iiaf-g3-")) throw new Error("Disposable local cluster socket required");
const vectors: { json: string; expected: string }[] = [];
function vector(value: unknown) { vectors.push({ json: JSON.stringify(value), expected: proposedJsonEncoding(value) }); }
for (const value of [null, true, false, "", "हिंदी", "😀", "é", "e\u0301", "a:b;\n\"\\", 0, -0, 0.1, -12.5, Number.MIN_VALUE, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, 1e21, 1e-7, [], {}, [1, 2], [2, 1], { b: 2, a: 1 }, { a: 1, b: 2 }, { "😀": [0.25, null], "हिंदी": { cells: [{ column: 1, ref: "A1", raw: "1.25", value: "1.25", formula: null, type: "n" }], locator: { x: 0.125, y: -0.5 } } }]) vector(value);
for (const token of ["9007199254740993", "1.230000", "123e-2", "-0.000e100", "1e1000", "1e-1000"]) vectors.push({ json: token, expected: canonicalDecimal(token) });
for (let i = 0; i < 200; i++) vector({ index: i, value: (i - 100) / 37, nested: [null, { "नाम": `Synthetic ${i}`, cells: [{ ref: `A${i + 1}`, formula: "=1/37", raw: "0.027", value: "0.027", column: 1 }] }] });
const literal = (s: string) => "'" + s.replace(/'/g, "''") + "'";
const reference = readFileSync("scripts/g3-json-proof.sql", "utf8");
const query = reference + "\n" + vectors.map(v => `SELECT encode(convert_to(pg_temp.iiaf_json_proof(${literal(v.json)}::jsonb),'UTF8'),'hex');`).join("\n");
const result = execFileSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", socket, "-p", "55439", "-U", "lovable", "-d", "postgres"], { input: query, encoding: "utf8" });
const rows = result.trim().split("\n");
if (rows.length !== vectors.length) throw new Error("Incomplete SQL parity output");
vectors.forEach((v, i) => { if (Buffer.from(v.expected, "utf8").toString("hex") !== rows[i]) throw new Error(`Parity mismatch at synthetic vector ${i}`); });
const report = { vectors: vectors.length, passed: rows.length, comparison: "exact UTF8 bytes, independent JS/PLpgSQL encoders", scope: "offline supported parsed-JSON numbers plus separately preserved raw exact decimal tokens", unresolved: ["PostgreSQL jsonb rejects U+0000; product disposition needed", "Raw arbitrary decimals cannot be reconstructed from rounded JS numbers", "Hosted concurrency, source race, audit, compatibility and rollback not verified", "No runtime key change or migration"] };
writeFileSync(`${socket}/parity-result.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));