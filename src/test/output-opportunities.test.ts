import { describe, expect, it } from "vitest";
import { discoverOutputOpportunities } from "@/lib/output-opportunities";
import { classifyLines } from "@/lib/qualification-rules";
import type { SourceLine } from "@/lib/output-contract";

const lines = (values: string[]): SourceLine[] => values.map((content, seq) => ({ content, seq, locator_key: `ocr:l${seq + 1}`, locator: { source: "ocr" }, method_version: "saved-ocr" }));
describe("automatic output discovery without unsafe generation", () => {
  it("OCR is a caution and does not suppress institutional opportunities", () => {
    const source = lines(["University offers entrepreneurship support"]);
    const apps = classifyLines(source).get("ocr:l1");
    expect(apps?.map(r => r.ruleId)).toEqual(["Q13", "Q01"]);
    const found = discoverOutputOpportunities(source);
    expect(found.find(o => o.catalogueId === "OUT-001")?.reason).toContain("OCR_CAUTION");
  });
  it("split poster event/date signals discover news/web/social with both citations", () => {
    const found = discoverOutputOpportunities(lines(["Workshop: Ideas to Enterprises", "13 October 2026"]));
    const news = found.find(o => o.type === "news_article");
    expect(news?.locators).toEqual(["ocr:l1", "ocr:l2"]);
    expect(news?.ruleIds).toEqual(["Q02"]);
    expect(found.some(o => o.type === "news_article")).toBe(true);
    expect(found.some(o => o.type === "linkedin")).toBe(true);
    expect(news).toMatchObject({ generated: false, persisted: false, supported: false });
  });
  it("source filename can signal an event but never supplies a missing date", () => {
    const found = discoverOutputOpportunities(lines(["From Ideas to Enterprises", "13 October 2026"]), [], [], "Workshop Board.png");
    expect(found.find(o => o.type === "news_article")?.locators).toEqual(["ocr:l2"]);
    expect(discoverOutputOpportunities(lines(["From Ideas to Enterprises"]), [], [], "Workshop Board.png").some(o => o.type === "news_article")).toBe(false);
  });
  it("Desired Output supplements discovery and never suppresses automatic opportunities", () => {
    const source = lines(["Workshop announced for 2026"]);
    const automatic = discoverOutputOpportunities(source).map(o => o.key);
    const requested = discoverOutputOpportunities(source, [], ["OUT-002"]);
    expect(requested.map(o => o.key)).toEqual(expect.arrayContaining(automatic));
    expect(requested.find(o => o.catalogueId === "OUT-002")).toMatchObject({ requested: true, generated: false, supported: false });
  });
  it("O10/O13 artifacts never gain invented OUT catalogue bindings", () => {
    const found = discoverOutputOpportunities(lines(["Stored source"]));
    expect(found.find(o => o.type === "extraction_review")).toMatchObject({ catalogueId: null, contractId: "O13", artifact: true, generated: false });
  });
  it("qualification never proves generated images or video", () => {
    const found = discoverOutputOpportunities(lines(["Workshop 2026"]));
    expect(found.find(o => o.type === "image_creative")).toMatchObject({ generated: false, persisted: false, supported: false });
    expect(found.find(o => o.type === "reel_script")?.dependency).toContain("not a deployed renderer");
  });
  it("unknown headers never become decisions and table narratives do not grant company access", () => {
    const source: SourceLine[] = [{ seq: 0, locator_key: "row1", content: "Metric | Value", method_version: "native", locator: { table: 1, row: 1, cells: [{ column: 1, ref: "A1", raw: "Metric", value: "Metric", formula: null, type: "text" }] } }];
    const found = discoverOutputOpportunities(source);
    expect(found.some(o => o.type === "decisions")).toBe(false);
    expect(found.find(o => o.catalogueId === "OUT-021")?.dependency).toContain("Company-restricted");
    expect(found.find(o => o.type === "structured_tables")).toMatchObject({ catalogueId: null, contractId: "O10" });
  });
});