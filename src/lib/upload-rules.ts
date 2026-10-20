export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const UPLOAD_BUCKET = "institution-documents";
export const ALLOWED_EXTENSIONS = ["pdf", "docx", "doc", "xlsx", "xls", "csv", "pptx", "txt", "jpg", "jpeg", "png"] as const;
export type UploadModule = "institutional" | "meeting" | "evidence";
export type ProcessingStatus = "uploading" | "uploaded" | "validation_failed" | "upload_failed" | "awaiting_processing";
export const STATUS_LABELS: Record<ProcessingStatus, string> = {
  uploading: "Uploading", uploaded: "Uploaded", validation_failed: "Validation Failed", upload_failed: "Upload Failed", awaiting_processing: "Awaiting Processing",
};
const ZIP_TYPES = ["docx", "xlsx", "pptx"];
const OLE_TYPES = ["doc", "xls"];
const TEXT_TYPES = ["csv", "txt"];

export function extensionOf(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Rejects a selection before anything is stored. Returns human-readable reasons. */
export function validateSelection(file: { name: string; size: number }): string[] {
  const errors: string[] = [];
  const ext = extensionOf(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) errors.push(`Format “.${ext || "none"}” is not accepted. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`);
  if (file.size <= 0) errors.push("File is empty.");
  if (file.size > MAX_UPLOAD_BYTES) errors.push("File is larger than the 20 MB limit.");
  if (file.name.length > 255) errors.push("File name is longer than 255 characters.");
  return errors;
}

/** Detects the content family from file signature bytes. */
export function detectMime(bytes: Uint8Array): string {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "application/pdf";
  if (b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04) return "application/zip";
  if (b(0) === 0xd0 && b(1) === 0xcf && b(2) === 0x11 && b(3) === 0xe0) return "application/x-ole-storage";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  const head = bytes.slice(0, 512);
  if (head.length && head.every(c => c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127) )) return "text/plain";
  return "application/octet-stream";
}

/** Compares detected content with the declared extension (spec VAL-001 / AT-005). */
export function contentMatchesExtension(ext: string, detected: string) {
  if (ext === "pdf") return detected === "application/pdf";
  if (ZIP_TYPES.includes(ext)) return detected === "application/zip";
  if (OLE_TYPES.includes(ext)) return detected === "application/x-ole-storage";
  if (ext === "png") return detected === "image/png";
  if (ext === "jpg" || ext === "jpeg") return detected === "image/jpeg";
  if (TEXT_TYPES.includes(ext)) return detected === "text/plain";
  return false;
}

export async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

/** Master-import counts must reconcile to the source rows processed. */
export function reconcileImportCounts(c: Record<string, unknown>) {
  const n = (k: string) => Number(c[k] ?? 0);
  const parts = n("inserted") + n("updated") + n("existing_identical") + n("excluded") + n("held") + n("rejected_validation") + n("conflicts");
  return { parts, total: n("source_rows"), reconciles: parts === n("source_rows") };
}
