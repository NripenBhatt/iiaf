import type { HandlerContext } from '@/lib/catalogue-handlers';
/** Synthetic test evidence only, never uploaded, approved or presented as actual institution data. */
export const annualDemoText=[
 'DEMO SYNTHETIC ANNUAL RECORD — NOT REAL UNIVERSITY DATA',
 'Institution Name: DEMO Riverbend University', 'Reporting Period: 2026',
 'History: DEMO established in 2001 for multidisciplinary education',
 'Mission: DEMO teaching, research and public service',
 'Governance: DEMO Academic Council reviewed programme and laboratory-access records at four meetings',
 'Academic Activities: DEMO Computing and Languages departments revised two curricula and documented laboratory teaching',
 'Student Enrolment: 200', 'Student Progression: DEMO progression register records 180 continuing students; no completion claim',
 'Faculty: 20', 'Research: DEMO methods project documented two study reports',
 'Outreach: DEMO literacy programme documented 25 participants in its attendance register',
 'Placements: DEMO placement register records 20 unique students placed from the 40 eligible Computing cohort',
 'Quality Assurance: DEMO internal review identified laboratory-access scheduling as a follow-up item; no accreditation asserted',
 'Infrastructure: DEMO inventory records two teaching laboratories and a library',
 'Financial Resources: DEMO ledger records 100000 units allocated and 80000 units used for learning resources; ledger unit is fictional',
 'Indicators: 200 enrolled students and 20 faculty; same institution-wide headcount definition as the comparison register',
 'Achievements: DEMO two curriculum revisions documented as completed in the curriculum register',
 'Challenges: DEMO access logs document competing laboratory timetable requests',
 'Strategic Priorities: DEMO council proposed a laboratory scheduling review for the next reporting period; not an approved action',
 'Comparison Period: 2025', 'Comparison Definition: institution-wide unique enrolled students; unchanged headcount scope',
 'Current Value: 200', 'Previous Value: 180',
 'Current Period: 2026', 'Comparison Scope: DEMO institution-wide unique enrolled students; both periods use same register definition',
 'Indicator: Placement rate', 'Reporting Period: 2026', 'Numerator: 20', 'Denominator: 40',
 'Indicator Scope: DEMO Computing unique eligible student cohort; offers excluded',
 'Methodology: count distinct placed student IDs divided by distinct eligible student IDs',
 'Formula: numerator / denominator * 100',
];
export function annualContext(text=annualDemoText):HandlerContext{
 const lines=text.map((content,seq)=>({content,seq,locator_key:`demo:annual:${seq}`,locator:{line:seq+1},method_version:'demo-native-1'}));
 return {lines,segmentIds:lines.map((_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`),company:true,period:'2026',choices:{'OUT-015':'limited'},manifest:{documentId:'00000000-0000-4000-8000-000000000099',jobId:'00000000-0000-4000-8000-000000000098',originalHash:'a'.repeat(64),parserVersion:'demo-native-1',contractVersion:'iiaf-output-2.2',classification:'DEMO',approval:'draft',locators:lines.map(l=>l.locator_key),verifiedCoverage:false}};
}