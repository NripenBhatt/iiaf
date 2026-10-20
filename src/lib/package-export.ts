/** Browser-side Word and print/PDF renderings of a stored package. Both render the stored content verbatim; nothing is recalculated. */
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { PackageContent } from "./package-format";

export type PackageMeta = { version: number; sha256: string; generatedAt: string; status: string };
const statusLine = (c: PackageContent, m: PackageMeta) => `${m.status === "reviewed" ? "DRAFT — reviewed (not certified)" : c.status} · package version ${m.version}`;

function sections(c: PackageContent, m: PackageMeta) {
  return {
    title: `${c.agency.name} · ${c.requirement.id} — ${c.requirement.metric}`,
    facts: [["Status", statusLine(c, m)], ["Agency", `${c.agency.name} (${c.agency.id}) ${c.agency.authority}`], ["Methodology / version", c.methodology.join("; ")], ["Requirement", `${c.requirement.id} · ${c.requirement.level} · ${c.requirement.pillar}`], ["Reporting period", c.reportingPeriod], ["Generated", m.generatedAt], ["Content SHA-256", m.sha256]] as [string, string][],
    instructions: [["Description", c.requirement.description], ["Official label", c.requirement.officialLabel], ["Validation rule", c.requirement.validationRule], ["Missing value rule", c.requirement.missingValueRule], ["Reporting period rule", c.requirement.reportingPeriodRule], ["Version lock", c.requirement.versionLock]] as [string, string][],
    data: [["Field", "Label", "Type", "Unit", "Mandatory", "Value / status"], ...c.dataTable.map(d => [d.fieldId, d.label, d.dataType, d.unit ?? "—", d.mandatory, d.value ?? d.valueStatus])],
    evidence: [["#", "Evidence", "Value", "Attachment", "Source locator"], ...c.evidenceIndex.map(e => [String(e.number), `${e.mappingId} · ${e.evidenceId}`, e.value, e.attachment ? `A${e.attachment}` : "—", `${e.filename}: ${e.locator}`])],
    attachments: [["#", "File", "SHA-256", "Period"], ...c.attachments.map(a => [`A${a.number}`, a.filename, a.sha256 ?? "—", a.reportingPeriod ?? "—"])],
    provenance: [["Mapping", "Source row", "Status"], ...c.provenance.mappingRows.map(p => [p.mappingId, String(p.row), p.status])],
  };
}

const cell = (t: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t || "—", bold, size: 18 })] })] });
const table = (rows: string[][]) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map((r, i) => new TableRow({ children: r.map(x => cell(x, i === 0)) })) });

export async function packageDocx(c: PackageContent, m: PackageMeta) {
  const s = sections(c, m);
  const h = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
  const doc = new Document({ creator: "IIAF", title: s.title, sections: [{ children: [
    new Paragraph({ children: [new TextRun({ text: "DRAFT — NOT CERTIFIED", bold: true, color: "B45309" })] }),
    new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }),
    table([["Item", "Value"], ...s.facts]),
    h("1. Requirement and reporting instructions"), table([["Item", "As imported"], ...s.instructions.map(([k, v]) => [k, v || "Not stated in source"])]),
    h("2. Data table"), table(s.data),
    h("3. Evidence index"), s.evidence.length > 1 ? table(s.evidence) : new Paragraph("No approved, trusted evidence."),
    h("4. Attachment references"), s.attachments.length > 1 ? table(s.attachments) : new Paragraph("No attachments. Source files are referenced, not bundled."),
    h("5. Issues, exclusions and limitations"), ...(c.issues.length ? c.issues.map(i => new Paragraph({ text: i, bullet: { level: 0 } })) : [new Paragraph("None recorded.")]),
    h("6. Provenance"), new Paragraph(`Workbook ${c.provenance.workbook} (SHA-256 ${c.provenance.workbookSha256}), requirement row ${c.provenance.requirementSourceRow}.`), table(s.provenance),
    h("7. Certification"), new Paragraph(c.certification),
  ] }] });
  return Packer.toBlob(doc);
}

const esc = (v: string) => v.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
export function packageHtml(c: PackageContent, m: PackageMeta) {
  const s = sections(c, m);
  const t = (rows: string[][]) => `<table>${rows.map((r, i) => `<tr>${r.map(x => i === 0 ? `<th>${esc(x)}</th>` : `<td>${esc(x || "—")}</td>`).join("")}</tr>`).join("")}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.title)}</title><style>body{font:11pt Georgia,serif;margin:2cm;color:#111}h1{font-size:16pt}h2{font-size:12pt;margin-top:18pt}table{border-collapse:collapse;width:100%;font-size:9pt}td,th{border:1px solid #999;padding:3pt;text-align:left;vertical-align:top}.draft{color:#b45309;font-weight:bold}</style></head><body>
<p class="draft">DRAFT — NOT CERTIFIED</p><h1>${esc(s.title)}</h1>${t([["Item", "Value"], ...s.facts])}
<h2>1. Requirement and reporting instructions</h2>${t([["Item", "As imported"], ...s.instructions.map(([k, v]) => [k, v || "Not stated in source"])])}
<h2>2. Data table</h2>${t(s.data)}<h2>3. Evidence index</h2>${s.evidence.length > 1 ? t(s.evidence) : "<p>No approved, trusted evidence.</p>"}
<h2>4. Attachment references</h2>${s.attachments.length > 1 ? t(s.attachments) : "<p>No attachments.</p>"}
<h2>5. Issues, exclusions and limitations</h2><ul>${c.issues.map(i => `<li>${esc(i)}</li>`).join("") || "<li>None recorded.</li>"}</ul>
<h2>6. Provenance</h2><p>Workbook ${esc(c.provenance.workbook)} (SHA-256 ${esc(c.provenance.workbookSha256)}), row ${c.provenance.requirementSourceRow}.</p>${t(s.provenance)}
<h2>7. Certification</h2><p>${esc(c.certification)}</p></body></html>`;
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function printPackage(c: PackageContent, m: PackageMeta) {
  const w = window.open("", "_blank"); if (!w) throw new Error("Allow pop-ups to open the printable PDF view.");
  w.document.write(packageHtml(c, m)); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
