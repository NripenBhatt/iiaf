export type ChartKind = "bar" | "line" | "donut" | "radar" | "heatmap" | "flow" | "network" | "timeline";
export type Datum = { name: string; value: number; secondary?: number | undefined };
export type Visualization = { title: string; subtitle: string; kind: ChartKind; data: Datum[]; series?: string[] };
export type AnalyticalPage = "overview" | "institutional" | "meetings" | "evidence" | "relationships" | "reports" | "review" | "audit" | "help";
const points = (labels: string[], values: number[], secondary?: number[]): Datum[] => labels.map((name, i) => ({ name, value: values[i] ?? 0, secondary: secondary?.[i] }));
export function getVisualizations(page: AnalyticalPage, university: boolean): Visualization[] {
  const scope = university ? "Demo University" : "Illustrative operator portfolio";
  const specs: Record<AnalyticalPage, Visualization[]> = {
    overview: university ? [
      { title: "Record readiness", subtitle: "Records complete / expected · 0–100% · not an agency score", kind: "radar", data: points(["Profile", "People", "Governance", "Evidence", "Outputs"], [85, 72, 90, 64, 80]), series: ["Complete (%)"] },
      { title: "Evidence coverage", subtitle: "Sample framework coverage · status counts", kind: "heatmap", data: points(["NAAC", "NIRF", "QS", "THE"], [18, 14, 8, 6], [5, 4, 6, 4]) },
      { title: "Institution workflow", subtitle: "Sample monthly records · Apr–Sep 2026", kind: "line", data: points(["Apr", "May", "Jun", "Jul", "Aug", "Sep"], [12, 18, 15, 25, 29, 34], [8, 12, 14, 18, 24, 28]), series: ["Uploaded", "Reviewed"] },
    ] : [
      { title: "Institutional portfolio", subtitle: "Sample source records by institution", kind: "bar", data: points(["Demo Uni", "Sample A", "Sample B", "Sample C"], [340, 310, 286, 348], [84, 79, 72, 77]), series: ["Sources", "Evidence"] },
      { title: "Portfolio evidence coverage", subtitle: "Illustrative institution coverage · status counts", kind: "heatmap", data: points(["Demo Uni", "Sample A", "Sample B", "Sample C"], [18, 14, 8, 6], [5, 4, 6, 4]) },
      { title: "Operational workload", subtitle: "Monthly sample records · Apr–Sep 2026", kind: "line", data: points(["Apr", "May", "Jun", "Jul", "Aug", "Sep"], [42, 55, 49, 63, 74, 81], [32, 40, 44, 51, 60, 68]), series: ["Received", "Reviewed"] },
    ],
    institutional: [
      { title: "Domain completeness", subtitle: `${scope} · sample complete records (%)`, kind: "bar", data: points(["Profile", "People", "Programmes", "Placements", "Policies"], [85, 72, 80, 62, 90]), series: ["Complete (%)"] },
      { title: "Department record coverage", subtitle: "Sample department records · verified / review / gap", kind: "heatmap", data: points(["Science", "Engineering", "Arts", "Business"], [18, 14, 8, 6], [5, 4, 6, 4]) },
      { title: "Awaiting verification", subtitle: "Sample pending records · count", kind: "donut", data: points(["Faculty", "Placements", "Contacts", "Policies"], [8, 5, 4, 3]) },
    ],
    meetings: [
      { title: "Action implementation", subtitle: "Illustrative action items · count", kind: "donut", data: points(["Completed", "In progress", "Open", "Overdue"], [22, 20, 12, 6]) },
      { title: "Overdue by owner", subtitle: "6 illustrative overdue action items", kind: "bar", data: points(["IQAC", "Research", "Placements", "Engineering"], [1, 2, 2, 1]), series: ["Overdue actions"] },
      { title: "Decision follow-through", subtitle: "Sample monthly decisions and completed actions", kind: "line", data: points(["Apr", "May", "Jun", "Jul", "Aug", "Sep"], [8, 12, 10, 14, 18, 20], [4, 7, 8, 11, 15, 17]), series: ["Decisions", "Completed actions"] },
    ],
    evidence: [
      { title: "Evidence domain coverage", subtitle: "Sample framework records · no official criterion mapping", kind: "heatmap", data: points(["NAAC", "NIRF", "QS", "THE"], [18, 14, 8, 6], [5, 4, 6, 4]) },
      { title: "Evidence review states", subtitle: "Illustrative evidence records · count", kind: "donut", data: points(["Verified", "Under review", "Unprocessed", "Gap"], [46, 19, 12, 7]) },
      { title: "Evidence to dossier", subtitle: "Sample record links · widths show link counts", kind: "flow", data: points(["Documents", "Facts", "Requirements", "Dossiers"], [20, 20, 20, 12]) },
    ],
    relationships: [
      { title: "Record relationship network", subtitle: "Inspect a sample node · solid approved / dashed candidate", kind: "network", data: points(["Ledger", "Grants fact", "Requirement", "Council decision", "Report"], [1, 3, 2, 2, 2]) },
      { title: "Relationship review states", subtitle: "Illustrative typed links · count", kind: "donut", data: points(["Approved", "Candidate", "Rejected", "Blocked"], [42, 18, 5, 3]) },
      { title: "Source-to-output lineage", subtitle: "Sample links · not executed relationship rules", kind: "flow", data: points(["Sources", "Facts", "Requirements", "Outputs"], [20, 20, 20, 12]) },
    ],
    reports: [
      { title: "Output lifecycle", subtitle: university ? "Institution-authorized sample items only · count" : "Sample portfolio outputs · count", kind: "bar", data: points(["Draft", "In review", "Approved", "Released", "Published"], university ? [2, 1, 1, 2, 1] : [12, 8, 5, 9, 3]), series: ["Outputs"] },
      { title: "Output production", subtitle: "Sample outputs per month · Apr–Sep 2026", kind: "line", data: points(["Apr", "May", "Jun", "Jul", "Aug", "Sep"], university ? [1, 2, 1, 3, 2, 4] : [4, 6, 5, 8, 9, 12], university ? [0, 1, 1, 1, 2, 2] : [1, 2, 3, 4, 5, 9]), series: ["Prepared", "Released"] },
      { title: "Output categories", subtitle: "Illustrative lifecycle inventory · count", kind: "donut", data: points(university ? ["Profiles", "Dossiers", "Meeting outputs"] : ["Profiles", "Dossiers", "Meeting outputs", "Internal briefs"], university ? [3, 2, 2] : [10, 12, 8, 7]) },
    ],
    review: [
      { title: "Review queue", subtitle: "Illustrative packages · count · no actual signatures", kind: "donut", data: points(["Prepared", "In review", "Corrections", "Awaiting signer"], [9, 8, 6, 4]) },
      { title: "Review completion", subtitle: "Sample checks complete (%) · not certification", kind: "bar", data: points(["NAAC", "NIRF", "GreenMetric"], [72, 84, 45]), series: ["Checks complete (%)"] },
      { title: "Package review history", subtitle: "Illustrative NAAC dossier v1 · human checkpoints", kind: "timeline", data: points(["Prepared · v1", "IQAC review", "Corrections requested", "Registrar review pending"], [12, 14, 16, 20]) },
    ],
    audit: [
      { title: "Activity volume", subtitle: "Sample events per day · October 2026", kind: "line", data: points(["13 Oct", "14 Oct", "15 Oct", "16 Oct", "17 Oct", "18 Oct"], [18, 24, 16, 32, 27, 38]), series: ["Events"] },
      { title: "Events by type", subtitle: "Illustrative events · count", kind: "donut", data: points(["Upload", "Review", "Mapping", "Draft", "Release"], [42, 38, 24, 19, 12]) },
      { title: "Activity by module", subtitle: "Illustrative events · count", kind: "bar", data: points(["Information", "Meetings", "Evidence", "Reports"], [30, 22, 54, 29]), series: ["Events"] },
    ],
    help: [
      { title: "Institution activity", subtitle: "Sample daily events · October 2026", kind: "line", data: points(["13 Oct", "14 Oct", "15 Oct", "16 Oct", "17 Oct", "18 Oct"], [3, 5, 4, 8, 6, 9]), series: ["Events"] },
      { title: "Notification categories", subtitle: "Sample notices · count", kind: "donut", data: points(["Review", "Actions", "Released outputs"], [3, 2, 2]) },
      { title: "Recent institution activity", subtitle: "Sample institution-scoped history", kind: "timeline", data: points(["Faculty roster received", "IQAC review requested", "Profile released", "Meeting action reminder"], [14, 16, 18, 20]) },
    ],
  };
  return specs[page];
}