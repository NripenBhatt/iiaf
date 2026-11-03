import { describe, expect, it } from "vitest";
import { eventContent, authoredBody, authoredOutputs, artifactSchema, selectedEventOutputs } from "@/lib/source-authored";
import { generatedOutputSchema } from "@/lib/output-contract";

const text=["From Ideas to","Enterprises","Understanding Legal Entity Formation for Startups:","Why, How, Benefits and Goals","13 October 2026","(Thursday)","Khwaja Moinuddin Chishti Language University, Lucknow","Organised by Awadh Incubation Foundation","PARTICIPANT MOBILE FLOW","Organised by Fabricated Foundation"];
const lines=(values=text)=>values.map((content,seq)=>({content,seq,locator_key:`ocr:${seq}`,locator:{page:1},method_version:"ocr-1"}));
const ids=text.map((_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`);
describe("saved source-authored event",()=>{
  it("dispatches OUT-008 and OUT-009 to cited article and bounded Facebook drafts",()=>{
    const a=eventContent(lines(),ids);if(!a)throw new Error("Missing event");
    const manifest={documentId:ids[0]??"",jobId:ids[1]??"",originalHash:"hash",parserVersion:"ocr-1",contractVersion:"iiaf-output-2.2",classification:"DEMO" as const,approval:"draft" as const,locators:[],verifiedCoverage:false as const};
    const outputs=selectedEventOutputs(a,manifest,["OUT-008","OUT-009"]);
    expect(outputs.map(o=>o.type)).toEqual(["news_article","facebook"]);
    expect(outputs[1]?.catalogue.catalogueId).toBe("OUT-009");
    expect(Array.from(outputs[1]?.body??"").length).toBeLessThanOrEqual(800);
    expect(selectedEventOutputs(a,manifest,[])).toEqual([]);
  });
  it("uses readable adjacent headings and source citations without formal fields",()=>{
    const a=eventContent(lines(),ids);expect(a?.fields.find(f=>f.role==="title")).toMatchObject({value:"From Ideas to Enterprises",citations:[{segmentId:ids[0],raw:"From Ideas to"},{segmentId:ids[1],raw:"Enterprises"}]});
    expect(a?.fields.find(f=>f.role==="date")?.value).toBe("13 October 2026");
  });
  it("excludes participant examples, flags the weekday conflict and never asserts occurrence",()=>{
    const a=eventContent(lines(),ids);if(!a)throw new Error("Missing event");expect(authoredBody(a)).toContain("Organised by Awadh Incubation Foundation");expect(authoredBody(a)).not.toContain("Fabricated Foundation");expect(authoredBody(a)).not.toContain("was held");expect(a.cautions.join(" ")).toContain("weekday/date conflict");
  });
  it("omits missing dates without blocking a useful article",()=>{
    const a=eventContent(lines(text.filter(t=>!t.includes("October")&&!t.includes("Thursday"))),ids);if(!a)throw new Error("Missing event");expect(a.fields.some(f=>f.role==="date")).toBe(false);expect(authoredBody(a)).not.toContain("2026");
  });
  it("keeps saved authored outputs draft with no approver or coverage",()=>{
    const a=eventContent(lines(),ids);if(!a)throw new Error("Missing event");const o=generatedOutputSchema.parse(authoredOutputs(a,{documentId:ids[0]??"",jobId:ids[1]??"",originalHash:"hash",parserVersion:"ocr-1",contractVersion:"iiaf-output-2.2",classification:"DEMO",approval:"draft",locators:[],verifiedCoverage:false}));expect(o.type).toBe("news_article");expect(o.contract.release).toBe("not_authorized");expect(o.contract.approver).toBeNull();expect(o.manifest?.verifiedCoverage).toBe(false);
  });
  it("accepts only bounded PNG metadata for the existing private bucket",()=>{
    const a={bucket:"institution-documents",key:"path",sha256:"a".repeat(64),size:120631,mimeType:"image/png",width:1080,height:1080,renderer:"iiaf-canvas-1"};expect(artifactSchema.safeParse(a).success).toBe(true);expect(artifactSchema.safeParse({...a,size:5000001}).success).toBe(false);expect(artifactSchema.safeParse({...a,mimeType:"video/mp4"}).success).toBe(false);
  });
});