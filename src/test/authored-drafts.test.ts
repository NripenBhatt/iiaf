import { describe, expect, it } from "vitest";
import { authoredEventDrafts, type DraftSource } from "@/lib/authored-drafts";
const source = (text: string[]): DraftSource => ({ documentId: "d1", jobId: "j1", filename: "SYNTHETIC-notice.txt", originalHash: "hash", parserVersion: "v1", classification: "DEMO", lines: text.map((content, seq) => ({ seq, content, locator_key: `line:${seq + 1}`, locator: { line: seq + 1 }, method_version: "v1" })) });
const notice = ["Event title: SYNTHETIC Ideas Workshop", "Event date: 23 October 2026", "Venue: Test Hall", "Workshop subject: Enterprise planning"];
describe("staged source-cited authoring", () => {
  it("accepts explicit Event/Date notice labels only together, without filename inference", () => {
    expect(authoredEventDrafts(source(["Event: Synthetic workshop", "Date: 14 November 2026"]))[0]?.body).toContain("Synthetic workshop is announced for 14 November 2026");
    expect(authoredEventDrafts(source(["Date: 14 November 2026"]))).toEqual([]);
    expect(authoredEventDrafts(source(["Event: Synthetic workshop", "Date: 14 November 2026", "Event date: 15 November 2026"]))).toEqual([]);
  });
  it("authors catalogue text with exact source citations but makes no persistence/release claim", () => {
    const drafts = authoredEventDrafts(source(notice)); expect(drafts).toHaveLength(6);
    expect(drafts[0]).toMatchObject({ type: "press_release", catalogueId: "OUT-008", persisted: false, release: "not_authorized", review: "human_review_required" });
    expect(drafts[0]?.body).toContain("announced for 23 October 2026");
    expect(drafts[0]?.body).not.toContain("was held");
    expect(drafts[0]?.citations[0]).toMatchObject({ documentId: "d1", jobId: "j1", filename: "SYNTHETIC-notice.txt", locatorKey: "line:1" });
    expect(drafts[0]?.missing).toContain("institutions: not explicitly recorded");
  });
  it("blocks ambiguous or missing event dates instead of inventing temporal facts", () => {
    expect(authoredEventDrafts(source([notice[0] ?? ""]))).toEqual([]);
    expect(authoredEventDrafts(source([...notice, "Event date: 24 October 2026"]))).toEqual([]);
  });
  it("does not translate Hindi or use filename as factual support", () => {
    expect(authoredEventDrafts(source(["Event title: नमूना कार्यशाला", "Event date: 2026"]))).toEqual([]);
    expect(authoredEventDrafts({ ...source(["Event date: 2026"]), filename: "Workshop-on-2026.txt" })).toEqual([]);
  });
  it("blocks channel limit overflow rather than truncating source values", () => {
    const drafts = authoredEventDrafts(source([`Event title: ${"a".repeat(300)}`, "Event date: 2026"]));
    expect(drafts.some(d => d.type === "x_post")).toBe(false);
    expect(drafts.some(d => d.type === "press_release")).toBe(true);
  });
});