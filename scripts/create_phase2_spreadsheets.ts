/** Offline fixture generation with the already-installed SheetJS parser/writer. */
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([
  ["SYNTHETIC DEMO हिन्दी", "Rate", "Date", "Total", "Empty"],
  [142, 0.83, new Date(Date.UTC(2026, 9, 13)), 118, ""],
]);
const rate = sheet["B2"], date = sheet["C2"], total = sheet["D2"];
if (!rate || !date || !total) throw new Error("Fixture cells missing");
rate.z = "0%"; date.z = "yyyy-mm-dd"; total.f = "A2-24";
XLSX.utils.book_append_sheet(workbook, sheet, "Performance");
for (const bookType of ["xlsx", "xls"] as const) {
  writeFileSync(`src/test/fixtures/phase2/synthetic-performance.${bookType}`, XLSX.write(workbook, { type: "buffer", bookType }));
}