import { describe, it, expect } from "vitest";
import { validateSelection, detectMime, contentMatchesExtension, reconcileImportCounts, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
describe("upload intake rules", () => {
  it("accepts a PDF within 20 MB", () => expect(validateSelection({ name: "profile.pdf", size: 1000 })).toEqual([]));
  it("rejects files over 20 MB", () => expect(validateSelection({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1 }).length).toBe(1));
  it("rejects unsupported formats", () => expect(validateSelection({ name: "run.exe", size: 10 }).length).toBe(1));
  it("rejects empty files", () => expect(validateSelection({ name: "a.pdf", size: 0 }).length).toBe(1));
  it("flags a renamed text file posing as PDF", () => expect(contentMatchesExtension("pdf", detectMime(new TextEncoder().encode("hello")))).toBe(false));
  it("recognises a real PDF signature", () => expect(contentMatchesExtension("pdf", detectMime(new TextEncoder().encode("%PDF-1.7")))).toBe(true));
});
describe("import count reconciliation", () => {
  it("reconciles the verified 23-row sample", () => expect(reconcileImportCounts({ source_rows: 23, inserted: 20, existing_identical: 0, excluded: 0, held: 3, rejected_validation: 0, conflicts: 0, updated: 0 }).reconciles).toBe(true));
  it("keeps excluded rows separate from existing identical rows in a full run", () => expect(reconcileImportCounts({ source_rows: 32170, inserted: 11789, existing_identical: 20, excluded: 20117, held: 244, rejected_validation: 0, conflicts: 0 }).reconciles).toBe(true));
  it("detects counts that do not add up", () => expect(reconcileImportCounts({ source_rows: 10, inserted: 3 }).reconciles).toBe(false));
});
