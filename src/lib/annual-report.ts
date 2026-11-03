import type { SourceLine } from './output-contract';

/** OUT-015 only. Exact labels and row headers are source references, never approved mappings. */
export const ANNUAL_SECTIONS = [
 ['Institutional Profile and Reporting Context', ['Institution Name','History','Established','Campus','Mission']],
 ['Governance and Institutional Administration', ['Governance','Leadership']],
 ['Academic Programmes and Activities', ['Academic Activities','Programmes']],
 ['Student Enrolment and Progression', ['Student Enrolment','Student Progression']],
 ['Faculty and Human Resources', ['Faculty','Human Resources']],
 ['Research, Publications and Innovation', ['Research','Publications','Innovation']],
 ['Extension, Outreach and Community Engagement', ['Outreach']],
 ['Student Development and Placements', ['Placements','Student Development']],
 ['Quality Assurance and Institutional Development', ['Quality Assurance']],
 ['Infrastructure and Learning Resources', ['Infrastructure','Learning Resources']],
 ['Financial and Resource Utilisation Overview', ['Financial Resources']],
 ['Performance Indicators and Comparative Analysis', ['Indicators']],
 ['Major Achievements and Institutional Milestones', ['Achievements']],
 ['Challenges and Areas Requiring Improvement', ['Challenges']],
 ['Priorities and Recommendations for the Next Reporting Period', ['Strategic Priorities']],
] as const;
export type AnnualField = { value:string; locator:string };
const unavailable = /^(?:none|not supplied|not provided|unknown|missing|n\/a)\b|withheld|pending authority/i;
export function annualFields(lines:SourceLine[]) {
 const fields = new Map<string,AnnualField[]>();
 const add=(key:string,value:string,locator:string)=>{if(value.trim())fields.set(key.toLowerCase(),[...(fields.get(key.toLowerCase())??[]),{value:value.trim(),locator}]);};
 const groups=new Map<string,SourceLine[]>();
 for(const line of lines){const m=line.content.match(/^([^:|]{2,60}):\s*(.+)$/);if(m?.[1]&&m[2])add(m[1].trim(),m[2],line.locator_key);const p=line.locator as {cells?:{column:number;value:string}[];sheet?:string;table?:number};if(p?.cells){const key=JSON.stringify([p.sheet??'',p.table??0]);groups.set(key,[...(groups.get(key)??[]),line]);}}
 for(const rows of groups.values()){const headers=(rows[0]?.locator as {cells?:{column:number;value:string}[]})?.cells??[];for(const row of rows.slice(1))for(const cell of (row.locator as {cells?:{column:number;value:string}[]}).cells??[]){const h=headers.find(v=>v.column===cell.column);if(h)add(h.value,cell.value,row.locator_key);}}
 return fields;
}
export type AnnualRate = {label:string;value:string;numerator:number;denominator:number;basis:string;locators:string[]};
/** A metric record starts at Indicator. Multiple records are never zipped together. */
export function annualRates(lines:SourceLine[],period:string|null):AnnualRate[]{
 if(!period)return [];
 const records:Map<string,AnnualField[]>[]=[];let block:SourceLine[]=[];
 for(const l of lines){if(/^Indicator:\s*/i.test(l.content)){if(block.length)records.push(annualFields(block));block=[l];}else if(block.length)block.push(l);}
 if(block.some(v=>/^Indicator:\s*/i.test(v.content)))records.push(annualFields(block));
 // Structured indicator rows carry their own reporting scope and exact headers.
 const tables=new Map<string,SourceLine[]>();for(const l of lines){const p=l.locator as {cells?:unknown[];sheet?:string;table?:number};if(p?.cells){const key=JSON.stringify([p.sheet??'',p.table??0]);tables.set(key,[...(tables.get(key)??[]),l]);}}
 for(const rows of tables.values())for(const row of rows.slice(1))records.push(annualFields(rows[0]?[rows[0],row]:[]));
 return records.flatMap(f=>{const get=(k:string)=>{const v=f.get(k);return v?.length===1?v[0]:undefined;};const label=get('indicator'),n=get('numerator'),d=get('denominator'),p=get('reporting period'),scope=get('indicator scope'),method=get('methodology'),formula=get('formula');
 if(!label||!n||!d||p?.value!==period||!scope||!method||formula?.value!=='numerator / denominator * 100'||!/^\d+(\.\d+)?$/.test(n.value)||!/^\d+(\.\d+)?$/.test(d.value))return [];
 const numerator=Number(n.value),denominator=Number(d.value);if(denominator<=0||numerator>denominator)return [];
 return [{label:label.value,value:`${(numerator/denominator*100).toFixed(2)}%`,numerator,denominator,basis:`${scope.value}; ${period}; ${method.value}`,locators:[label,n,d,p,scope,method,formula].flatMap(v=>v?[v.locator]:[])}];});
}
export function annualEvidence(lines:SourceLine[],period:string|null){
 const fields=annualFields(lines);const usable=(key:string)=>(fields.get(key.toLowerCase())??[]).filter(v=>!unavailable.test(v.value)&&!/%/.test(v.value));
 const present=ANNUAL_SECTIONS.filter(([,keys])=>keys.some(k=>usable(k).length));
 const gaps=ANNUAL_SECTIONS.flatMap(([heading,keys])=>keys.some(k=>usable(k).length)?[]:[`${heading}: supply dated ${keys.join(' / ')} records for the selected institution and reporting period`]);
 for(const key of ['Student Progression','Achievements','Financial Resources'])if(!usable(key).length&&!gaps.some(g=>g.includes(key)))gaps.push(`${key}: supply dated institutional records; no outcomes or figures inferred`);
 const periods=[...new Set((fields.get('reporting period')??[]).map(v=>v.value))];
 const conflict=!!period&&periods.some(p=>p!==period);
 const alternatives=['Institution Name','Student Enrolment','Faculty','Financial Resources'].filter(k=>new Set(usable(k).map(v=>v.value)).size>1);
 const rates=annualRates(lines,period);
 if(!period||!periods.length)gaps.push('Reporting context: selected period and explicit source Reporting Period required');
 if(!rates.length&&!usable('Indicators').some(v=>/\d/.test(v.value)))gaps.push('Performance indicators: supply numeric measurements with definitions, scope and methodology');
 if((fields.get('indicator')?.length??0)>rates.length)gaps.push('Calculated indicators: numerator, positive denominator, exact percentage formula, methodology and same-period scope required; percentages withheld');
 for(const [key,entries]of fields)if(ANNUAL_SECTIONS.some(([,keys])=>keys.some(k=>k.toLowerCase()===key))&&entries.some(v=>/%/.test(v.value)))gaps.push(`${key}: reported percentage excluded from narrative; supply its numerator, positive denominator, exact formula and same-period scope before use`);
 const relevant=usable('Institution Name').length>0&&(present.some(([h])=>h!==ANNUAL_SECTIONS[0][0])||['History','Established','Campus','Mission'].some(k=>usable(k).length));
 const status=conflict||alternatives.length?'BLOCKED':!relevant?'ALTERNATIVE':gaps.length?'LIMITED':'READY';
 return {fields,usable,present,gaps,rates,status,conflict,alternatives,periods} as const;
}
const clean=(s:string)=>s.trim().replace(/[.]+$/,'');
export function annualReport(lines:SourceLine[],period:string|null){
 const a=annualEvidence(lines,period);const institution=a.usable('Institution Name')[0]?.value??'Institution not identified';
 const title=a.status==='READY'?'Annual Report — Evidence-supported Review Draft':'Annual Report — Partial Draft';
 const leads:Record<string,string>={'Institution Name':'The reporting institution is','History':'The institutional history records','Mission':'The stated mission is','Governance':'The governance record describes','Leadership':'Institutional administration is recorded as','Academic Activities':'During the reporting period, the academic record describes','Programmes':'The institution reports the following academic provision:','Student Enrolment':'The source records an enrolment of','Student Progression':'The progression record states','Faculty':'The source records a faculty headcount of','Research':'Research activity is documented as','Outreach':'The community engagement record describes','Placements':'The placement record states','Quality Assurance':'The internal quality record describes','Infrastructure':'The inventory records','Financial Resources':'The resource utilisation record states','Indicators':'The recorded quantitative indicators are','Achievements':'The milestone register records','Challenges':'The documented improvement issue is','Strategic Priorities':'For the next reporting period, the source proposes'};
 const para=(k:string)=>a.usable(k).map(v=>`${leads[k]??`${k} recorded in the source:`} ${clean(v.value)}. [${v.locator}]`).join('\n\n');
 const summary=[`This annual report concerns ${institution} for ${period??'a reporting period not yet confirmed'}.`,...['Academic Activities','Student Enrolment','Faculty','Research','Achievements'].flatMap(k=>a.usable(k).length?[para(k)]:[])].join('\n\n');
 const comparison=a.usable('Comparison Period').length===1&&a.usable('Comparison Definition').length===1&&a.usable('Current Value').length===1&&a.usable('Previous Value').length===1?a.usable('Comparison Period')[0]:undefined;
 const current=Number(a.usable('Current Value')[0]?.value),previous=Number(a.usable('Previous Value')[0]?.value);
 const comparable=comparison&&comparison.value!==period&&a.usable('Current Period').length===1&&a.usable('Current Period')[0]?.value===period&&a.usable('Comparison Scope').length===1&&/^\d+(\.\d+)?$/.test(a.usable('Current Value')[0]?.value??'')&&/^\d+(\.\d+)?$/.test(a.usable('Previous Value')[0]?.value??'')&&a.periods.length===1;
 const parts=[`# ${title}`,`${institution} · ${period??'Period unconfirmed'}\nSource-recorded facts are unverified; DEMO remains DEMO. Human review and release authorization are separate.`, `## Executive Summary\n\n${summary}\n\n${a.gaps.length?`Coverage is partial: ${a.gaps.length} specific evidence requirements remain. See the evidence worklist.`:'The supplied records cover the applicable reporting areas; this is not professional acceptance or verified institutional coverage.'}`];
 for(const [heading,keys]of a.present){let content=keys.filter(k=>a.usable(k).length).map(para).join('\n\n');if(heading==='Performance Indicators and Comparative Analysis'){content+='\n\n'+a.rates.map(r=>`${r.label}: ${r.value} — derived = ${r.numerator} ÷ ${r.denominator} × 100; basis: ${r.basis}. [${r.locators.join('; ')}]`).join('\n\n');if(comparable)content+=`\n\nComparable measure: ${para('Comparison Definition')}\n${para('Comparison Scope')}\n${para('Current Period')}\n${para('Current Value')}\n${para('Previous Value')}\n${para('Comparison Period')}\nDerived absolute change: ${current-previous} (current ${current} minus prior ${previous}); identical definition as explicitly recorded. ${current>previous?'The recorded measure increased.':current<previous?'The recorded measure decreased.':'The recorded measure is unchanged.'} Causes and institutional impact are not established by these figures.`;else content+='\n\nHistorical comparison withheld: paired numeric values, current and prior periods, identical scope and an explicit unchanged measurement definition are required.';}
 parts.push(`## ${heading}\n\n${content}`);}
 if(a.gaps.length)parts.push(`## Section-specific Evidence Gaps and Improvement Worklist\n\n${a.gaps.map(g=>`- ${g}.`).join('\n')}\n\nEditorial recommendation (not an approved institutional action): obtain these records from the responsible units before extending or releasing the report.`);
 parts.push(`## Conclusion\n\n${institution}'s supplied record supports ${a.present.length} reporting areas for ${period??'an unconfirmed period'}. ${a.gaps.length?'This partial draft must not be represented as a complete annual report.':'Content coverage is distinct from independent factual verification and professional acceptance.'} Strengths and challenges above are source assertions; no ranking, causal explanation or outcomes are invented.`, `## Evidence and Source References\n\nInline brackets refer to exact stored source locators. Full segment IDs, original hash, source job, raw evidence and review restrictions are retained in the separate export appendix. No original was reprocessed. Release: not authorized.`);
 return {title,body:parts.join('\n\n'),evidence:a};
}