export type OutputState = "Draft" | "In review" | "Approved" | "Released" | "Published";
export type OutputRecord = { title: string; category: string; version: string; state: OutputState; institution: string; universityVisible: boolean };
export const outputs: OutputRecord[] = [
  { title: "Annual Institutional Profile 2025–26", category: "Profile", version: "v3", state: "Released", institution: "demo-uni", universityVisible: true },
  { title: "NAAC Criterion 3 dossier", category: "Evidence dossier", version: "v1", state: "In review", institution: "demo-uni", universityVisible: true },
  { title: "Leadership risk brief — Q1", category: "Internal analysis", version: "v2", state: "Draft", institution: "rr", universityVisible: false },
  { title: "IQAC meeting summary — Mar", category: "Meeting output", version: "v1", state: "Released", institution: "demo-uni", universityVisible: true },
  { title: "Department profile — Science", category: "Profile", version: "v1", state: "Draft", institution: "demo-uni", universityVisible: true },
  { title: "Placement summary 2025", category: "Profile", version: "v2", state: "Approved", institution: "demo-uni", universityVisible: true },
  { title: "University annual highlights", category: "Profile", version: "v1", state: "Published", institution: "demo-uni", universityVisible: true },
  { title: "Green campus dossier", category: "Evidence dossier", version: "v1", state: "Draft", institution: "demo-uni", universityVisible: true },
  { title: "Sample A confidential analysis", category: "Internal analysis", version: "v1", state: "Approved", institution: "sample-a", universityVisible: false },
];
export function visibleOutputs(university: boolean, institution: string) {
  return outputs.filter(output => !university || (output.universityVisible && output.institution === institution));
}