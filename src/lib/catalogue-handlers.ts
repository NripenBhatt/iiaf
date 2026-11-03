import reference from "@/data/output-reference-catalogue.json";
import { eventContent } from "./source-authored";
import { publicationCopy } from "./publication-copy";
import { sourceTables, type GeneratedOutput, type SourceLine, type SourceManifest } from "./output-contract";
import { structuredMeetings } from "./meeting-contract";

export type HandlerContext = { lines: SourceLine[]; segmentIds: string[]; manifest: SourceManifest; company: boolean; period: string | null };
type Definition = { type: string; signal: RegExp; sections: string[]; missing: string[] };
/** Each catalogue handler has its own source category, structure and unmet input gates. */
export const CATALOGUE_HANDLERS: Record<string, Definition> = {
  "OUT-001": { type:"institutional_profile", signal:/institution name|university|campus|programme/i, sections:["Institution identity","Academic provision","Facilities and governance"], missing:["Profile approval and current snapshot"] },
  "OUT-002": { type:"contact_directory", signal:/email|phone|contact|@[\w.-]+\./i, sections:["People and units","Source-recorded contact points","Validity and privacy review"], missing:["Verified contact validity; consent and purpose"] },
  "OUT-003": { type:"employer_directory", signal:/employer|recruiter|company|placement/i, sections:["Employers and sectors","Recruitment relationships","Employer contacts"], missing:["Contact purpose, confidentiality and source dates"] },
  "OUT-004": { type:"placement_summary", signal:/placement|internship|offer|recruiter/i, sections:["Reporting scope","Placements and offers","Internships","Duplicates and verification"], missing:["Verified placement status and complete reporting period"] },
  "OUT-005": { type:"agenda_summary", signal:/agenda|कार्यसूची/i, sections:["Notice","Agenda","Briefing references"], missing:["Meeting metadata and access classification"] },
  "OUT-006": { type:"meeting_report", signal:/minutes|proceedings|resolution|कार्यवृत्त|निर्णय/i, sections:["Meeting record","Proceedings","Resolutions"], missing:["Minutes approval and supplied attendance"] },
  "OUT-007": { type:"action_items", signal:/action|due date|owner|कार्य/i, sections:["Actions","Owners and deadlines","Action-taken evidence"], missing:["Owner, status, period and implementation evidence"] },
  "OUT-008": { type:"news_article", signal:/event|workshop|seminar|conference|कार्यशाला/i, sections:["Summary","Programme focus","Event information","Source and verification"], missing:["Factual and public-release approval; occurrence unconfirmed"] },
  "OUT-009": { type:"social_variants", signal:/event|workshop|research|achievement/i, sections:["Platform variants"], missing:["Channel approval and publication rights"] },
  "OUT-010": { type:"reel_script", signal:/event|workshop|seminar/i, sections:["Hook — 0–5 seconds","Source context — 5–15 seconds","Programme detail — 15–30 seconds","Closing — 30–45 seconds"], missing:["Approved assets, rights, voiceover and participant consent; not rendered video"] },
  "OUT-011": { type:"linkedin_article", signal:/research|workshop|leadership|institution/i, sections:["Introduction","Source-grounded context","Institutional perspective","Limits and conclusion"], missing:["Author approval; no attributed quote unless supplied"] },
  "OUT-012": { type:"email_campaign", signal:/event|workshop|email|audience/i, sections:["Subject","Email body","Recipient segment","Schedule and opt-out review"], missing:["Lawful basis, opt-out, sender authorization and actual recipients; no sending"] },
  "OUT-013": { type:"whatsapp_campaign", signal:/event|workshop|phone|contact/i, sections:["Message draft","Audience and purpose","Follow-up plan"], missing:["Verified WhatsApp eligibility, consent and template approval; no sending"] },
  "OUT-014": { type:"newsletter", signal:/event|workshop|research|achievement|institution/i, sections:["In this issue","Featured announcement","Programme detail","Institutional notices","Editorial review"], missing:["Editorial approval and approved public assets"] },
  "OUT-015": { type:"annual_report", signal:/annual|report|institution|university/i, sections:["Executive overview","Reporting scope","Academic activities","Research and outreach","Placement and outcomes","Evidence gaps and conclusion"], missing:["Annual scope, complete reporting period and source completeness"] },
  "OUT-016": { type:"academic_analysis", signal:/department|programme|faculty|academic/i, sections:["Scope","Academic provision","Source metrics","Denominators and limitations"], missing:["Approved formulas, denominators and privacy thresholds"] },
  "OUT-017": { type:"evidence_matrix", signal:/requirement|NAAC|NIRF|AICTE|UGC|criterion/i, sections:["Methodology version","Requirement references","Source evidence","Unresolved mapping"], missing:["Official methodology and approved requirement-to-evidence bindings"] },
  "OUT-018": { type:"agency_submission", signal:/requirement|NAAC|NIRF|AICTE|UGC|criterion/i, sections:["Agency and cycle","Submission fields","Reconciliation","Sign-off gaps"], missing:["Version lock, verified agency-ready values and authorized sign-off"] },
  "OUT-019": { type:"thematic_report", signal:/SDG|sustainab|theme|outreach|environment/i, sections:["Theme and scope","Source-supported activity","Methodology","Findings and limitations"], missing:["Explicit thematic methodology; no invented SDG mapping"] },
  "OUT-020": { type:"custom_report", signal:/\S/, sections:["Source scope","Source-linked findings","Tables and references","Limits and conclusion"], missing:["Approved query scope and report approval"] },
  "OUT-021": { type:"quality_report", signal:/\S/, sections:["Extraction reconciliation","Structured completeness","Potential contradictions","Review disposition"], missing:["Reviewer decisions and approved reconciliation rules"] },
  "OUT-022": { type:"evidence_bundle", signal:/evidence|requirement|criterion|NAAC/i, sections:["Bundle index","Source lineage","Requirement references","Rights and completeness"], missing:["Approved mappings, current requirement version and artifact rights"] },
  "OUT-023": { type:"web_profile", signal:/institution name|university|campus|programme/i, sections:["Institution overview","Academic provision","Public contact review"], missing:["Approved public-field allowlist and currentness"] },
  "OUT-024": { type:"employer_outreach", signal:/employer|recruiter|placement|collaboration/i, sections:["Employer segmentation","Outreach message","Relationship context","Recipient eligibility"], missing:["Contact permissions and approved outreach purpose"] },
  "OUT-025": { type:"governance_report", signal:/meeting|decision|action|resolution/i, sections:["Governance scope","Decisions","Action status","Implementation evidence"], missing:["Complete period and verified implementation evidence"] },
  "OUT-026": { type:"event_publicity", signal:/event|workshop|seminar/i, sections:["Poster copy","Website blurb","Press note","Email invitation","WhatsApp invitation"], missing:["Speaker/image consent, event status and release approval"] },
  "OUT-027": { type:"research_profile", signal:/research|publication|patent|grant|DOI/i, sections:["Research scope","Publications","Projects and grants","Identifiers and duplicates"], missing:["Verified identifiers, authorship and reporting period"] },
  "OUT-028": { type:"department_brochure", signal:/department|programme|academic|faculty/i, sections:["Department introduction","Programmes","Faculty and facilities","Prospectus verification"], missing:["Current approved academic facts; no invented admission promises"] },
  "OUT-029": { type:"social_calendar", signal:/event|workshop|communication|calendar/i, sections:["Content inventory","Channel plan","Source-recorded dates","Schedule conflicts"], missing:["Approved publishing dates and schedule-conflict review"] },
  "OUT-030": { type:"communication_performance", signal:/impressions|engagement|reach|clicks|analytics/i, sections:["Platform and date window","Recorded engagement","Performance analysis","Data limitations"], missing:["Authenticated platform data and complete date window"] },
};

export function catalogueEligible(id: string, c: HandlerContext) {
  const entry=reference.outputs.find(e=>e.Output_ID===id); const handler=CATALOGUE_HANDLERS[id];
  if(!entry||!handler) return false;
  const eventIds=["OUT-008","OUT-009","OUT-010","OUT-011","OUT-012","OUT-013","OUT-014","OUT-026","OUT-029"];
  return (!/Company|internal/i.test(entry.Default_Access_Class)||c.company)&&(c.lines.some(l=>handler.signal.test(l.content))||(eventIds.includes(id)&&!!eventContent(c.lines,c.segmentIds)));
}

export function generateCatalogue(c: HandlerContext, requested: string[]) {
  const outputs:GeneratedOutput[]=[]; const skipped:{name:string;reason:string}[]=[];
  const ids=requested.length?[...new Set(requested)]:reference.outputs.filter(e=>catalogueEligible(e.Output_ID,c)).map(e=>e.Output_ID);
  const event=eventContent(c.lines,c.segmentIds);
  const eventFields=Object.fromEntries(event?.fields.map(f=>[f.role,f.value])??[]);
  const meetings=structuredMeetings(c.lines);
  for(const id of ids){
    const entry=reference.outputs.find(e=>e.Output_ID===id); const handler=CATALOGUE_HANDLERS[id];
    if(!entry||!handler){skipped.push({name:id,reason:"Unknown catalogue ID."});continue;}
    if(!catalogueEligible(id,c)){skipped.push({name:id,reason:/Company|internal/i.test(entry.Default_Access_Class)&&!c.company?"Company-only output; server authorization denied.":`Missing source category: ${entry.Principal_Input_Entities}`});continue;}
    if(["OUT-005","OUT-006","OUT-007"].includes(id)){
      const kinds=id==="OUT-006"?["meeting_report","decisions"]:[handler.type];
      const drafts=meetings.filter(m=>kinds.includes(m.kind));
      if(!drafts.length){skipped.push({name:id,reason:"Missing explicit source table headers; proceedings and decisions are not inferred."});continue;}
      for(const m of drafts) outputs.push({type:m.kind,name:entry.Output_Name,title:entry.Output_Name,body:m.body,meeting:m.meeting,tables:sourceTables(c.lines),manifest:c.manifest,catalogue:{catalogueId:id,contractId:m.meeting.contractId,support:"source-review",reason:"Explicit-source structured draft; approval remains separate."},contract:{template:null,mimeType:"text/markdown",dimensions:null,approver:null,release:"not_authorized"}});
      continue;
    }
    const matches=c.lines.flatMap((line,i)=>handler.signal.test(line.content)?[{line,id:c.segmentIds[i]}]:[]).filter((r):r is {line:SourceLine;id:string}=>!!r.id);
    const selected=event&&["OUT-008","OUT-009","OUT-010","OUT-011","OUT-012","OUT-013","OUT-014","OUT-026","OUT-029"].includes(id)?event.fields.flatMap(f=>f.citations):matches.map(r=>({segmentId:r.id,locatorKey:r.line.locator_key,raw:r.line.content}));
    const citations=[...new Map(selected.map(s=>[s.segmentId,s])).values()];
    if(!citations.length){skipped.push({name:id,reason:"No attributable source passages."});continue;}
    const sourceParagraphs=citations.map(s=>`> ${s.raw}\nSource: ${s.locatorKey}`).join("\n\n");
    const missing=[...handler.missing,...(!c.period&&/OUT-004|OUT-015|OUT-016|OUT-027|OUT-030/.test(id)?["Reporting period not recorded"]:[])];
    const caution="Human review required. Source-derived draft, not verified evidence. Release and external communication are not authorized.";
    let body=`# ${entry.Output_Name}\n\n${handler.sections.map((heading,i)=>`## ${heading}\n\n${i===0?sourceParagraphs:"No additional validated records for this section; see cited source material above."}`).join("\n\n")}\n\n## Missing information and release gates\n${missing.map(m=>`- ${m}`).join("\n")}\n\n${caution}`;
    const emit=(type:string,copy:string)=>outputs.push({type,name:entry.Output_Name,title:eventFields["title"]??entry.Output_Name,body:copy,manifest:c.manifest,tables:sourceTables(c.lines),draft:{version:"catalogue-draft-1",handler:id,revision:1,parentSetId:null,edited:false,missing,cautions:[caution,...(event?.cautions??[])],citations},catalogue:{catalogueId:id,contractId:null,support:"stored-draft-only",reason:"Source-linked catalogue draft; all approval, consent and official mapping gates remain unmet."},contract:{template:"catalogue-draft-1",mimeType:"text/markdown",dimensions:null,approver:null,release:"not_authorized"}});
    if(event&&id==="OUT-009"){
      for(const channel of ["facebook","instagram","linkedin","x_post"] as const){
        let copy=publicationCopy(channel,eventFields); const limit={facebook:800,instagram:2200,linkedin:1200,x_post:270}[channel];
        if(Array.from(copy).length>limit) copy=publicationCopy(channel,{title:eventFields["title"],date:eventFields["date"]});
        if(Array.from(copy).length>limit){skipped.push({name:`${id}:${channel}`,reason:`Source title cannot fit ${limit} characters without truncation.`});continue;}
        emit(channel,copy);
      }
      continue;
    }
    if(event&&id==="OUT-008") body=`# ${eventFields["title"]}\n\n${publicationCopy("press_release",eventFields)}\n\nSEO title: ${eventFields["title"]}\nMeta description: ${eventFields["subject"]??"Source-backed workshop announcement; details require review."}`;
    if(event&&id==="OUT-011") body=`# ${eventFields["title"]}\n\n${publicationCopy("linkedin",eventFields)}\n\n## Programme context\n${sourceParagraphs}\n\n## Conclusion\nThe announcement establishes the stated programme focus, not its outcomes. ${caution}`;
    if(event&&id==="OUT-014") body=`# Institutional newsletter — review edition\n\n## Featured announcement\n${publicationCopy("website_event",eventFields)}\n\n## Programme detail\n${sourceParagraphs}\n\n## Editorial notes\nNo other verified news items supplied. ${caution}`;
    if(event&&id==="OUT-012") body=`Subject: ${eventFields["title"]}\n\n${publicationCopy("website_event",eventFields)}\n\nRecipients, sender, opt-out and schedule: unconfirmed. Draft only; no message sent.`;
    if(event&&id==="OUT-013") body=`Message draft\n\n${publicationCopy("facebook",eventFields)}\n\nRecipients and WhatsApp eligibility: unconfirmed. No message sent.`;
    if(event&&id==="OUT-026") body=handler.sections.map((h,i)=>`## ${h}\n${publicationCopy(i===2?"press_release":i===0?"instagram":i===4?"facebook":"website_event",eventFields)}`).join("\n\n");
    if(event&&id==="OUT-010") body=handler.sections.map((h,i)=>`## ${h}\nOn-screen text / voiceover draft: ${event.fields[i]?.value??"Check the original notice before release."}\nVisual direction: source-backed typography; no invented people or photographs.`).join("\n\n")+`\n\n${caution}\nNot a rendered video.`;
    if(id==="OUT-021") body=`# Data quality and conflict report\n\n## Extraction reconciliation\n${c.lines.length} current-run source segments; ${sourceTables(c.lines).length} structured tables.\n\n## Review cautions\n${event?.cautions.join("\n")??"Contradiction decisions are not available; absence of a detected conflict is not validation."}\n\n## Source findings\n${sourceParagraphs}\n\n${caution}`;
    emit(handler.type,body);
  }
  return {outputs,skipped};
}