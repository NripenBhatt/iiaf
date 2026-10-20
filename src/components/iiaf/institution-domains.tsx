import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, Status } from "./ui";
const domains = [
  { id: "profile", label: "Profile", rows: [["University profile", "Demo University · illustrative", "Registrar"], ["Institutional records", "Annual report 2025–26", "Administration"], ["Policies", "Research policy v3", "Dean, Research"]] },
  { id: "academic", label: "Academic", rows: [["Departments", "Science, Engineering, Arts, Business", "Department Heads"], ["Programmes", "BSc, BTech, BA, MBA · sample", "Academic Office"], ["Faculty / staff", "Faculty roster · 2025–26", "HR Office"]] },
  { id: "leadership", label: "Leadership & contacts", rows: [["Leadership", "Vice-Chancellor · sample role", "University Administration"], ["Authorized contacts", "Registrar / IQAC Manager · sample roles", "Registrar"], ["Department leadership", "Dean, Research · sample role", "Academic Office"]] },
  { id: "placements", label: "Placements", rows: [["Placement information", "Placement report 2025", "Placement Officer"], ["Recruiter contacts", "Recruiter directory · illustrative", "Placement Office"], ["Company contacts", "Employer liaison records · no real contact data", "Authorized liaison"]] },
];
export function InstitutionDomains() {
  return <Tabs defaultValue="profile" className="mb-6"><div className="overflow-x-auto"><TabsList className="h-auto gap-1 bg-transparent p-0">{domains.map(d => <TabsTrigger key={d.id} value={d.id} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-secondary/30 data-[state=active]:shadow-none">{d.label}</TabsTrigger>)}</TabsList></div>{domains.map(d => <TabsContent key={d.id} value={d.id}><DataTable caption={`${d.label} · sample institutional register`} columns={["Domain", "Record", "Owner", "State"]} rows={d.rows.map(row => [...row, <Status tone="gold">Sample record</Status>])} /></TabsContent>)}</Tabs>;
}