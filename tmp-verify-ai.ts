import { generateCatalogue, type HandlerContext } from "@/lib/catalogue-handlers";
import { writeCatalogueDraft } from "@/lib/catalogue-writing.server";

const text = ["From Ideas to","Enterprises","Understanding Legal Entity Formation for Startups:","Why, How, Benefits and Goals","13 October 2026","(Thursday)","Khwaja Moinuddin Chishti Language University, Lucknow","Organised by Awadh Incubation Foundation"];
const c: HandlerContext = { lines: text.map((content, seq) => ({ content, seq, locator_key: `ocr:${seq}`, method_version: "ocr-1", locator: { page: 1 } })), segmentIds: text.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`), company: false, period: null, manifest: { documentId: "00000000-0000-4000-8000-000000000099", jobId: "00000000-0000-4000-8000-000000000098", originalHash: "a".repeat(64), parserVersion: "ocr-1", contractVersion: "iiaf-output-2.2", classification: "DEMO", approval: "draft", locators: text.map((_, i) => `ocr:${i}`), verifiedCoverage: false } };

const { outputs } = generateCatalogue(c, ["OUT-008"]);
const article = outputs.find(o => o.type === "news_article");
if (!article) throw new Error("no article generated");
const key = process.env["LOVABLE_API_KEY"];
if (!key) throw new Error("no key");
const written = await writeCatalogueDraft(article, key);
console.log("RUN_ID:", written.runId);
console.log("LENGTH:", written.body.length);
console.log("---BODY START---");
console.log(written.body.slice(0, 1500));
console.log("---BODY END---");
