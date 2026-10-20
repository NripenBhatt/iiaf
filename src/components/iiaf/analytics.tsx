import { useState, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { DemoTag } from "./ui";
import { useWorkspace } from "./workspace";
import { getVisualizations, type AnalyticalPage, type Visualization } from "./analytics-data";

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;
function Frame({ spec, children }: { spec: Visualization; children: ReactNode }) {
  return <section className="chart-frame" aria-label={spec.title} data-visualization={spec.kind}>
    <div className="mb-1 flex items-start justify-between gap-2"><h2 className="font-sans text-sm font-semibold">{spec.title}</h2><DemoTag /></div>
    <p className="mb-3 min-h-8 text-[11px] leading-relaxed text-muted-foreground">{spec.subtitle}</p>
    {children}
    <details className="chart-data"><summary>View data table</summary><table><caption className="sr-only">{spec.title} — demonstration data</caption><thead><tr><th scope="col">Item</th><th scope="col">{spec.series?.[0] ?? "Count"}</th>{spec.data.some(d => d.secondary !== undefined) && <th scope="col">{spec.series?.[1] ?? "In review"}</th>}</tr></thead><tbody>{spec.data.map(d => <tr key={d.name}><th scope="row">{d.name}</th><td>{d.value}</td>{d.secondary !== undefined && <td>{d.secondary}</td>}</tr>)}</tbody></table></details>
  </section>;
}
function Legend({ labels, kind }: { labels: string[]; kind?: string }) { return <div className={`chart-legend ${kind === "heatmap" ? "legend-status" : kind === "radar" ? "legend-readiness" : ""}`}>{labels.map(label => <span key={label}><i aria-hidden />{label}</span>)}</div>; }
function Heatmap({ spec }: { spec: Visualization }) {
  return <><div className="chart-canvas pt-3"><div className="heatmap"><span>Scope</span><span>Verified</span><span>Review</span><span>Gaps</span>{spec.data.map((d, i) => <div key={d.name} className="contents"><span>{d.name}</span><span className="heat-cell heat-verified" title={`${d.name}: ${d.value} verified records`}>{d.value}</span><span className="heat-cell heat-review" title={`${d.name}: ${d.secondary} in review`}>{d.secondary}</span><span className="heat-cell heat-gap" title={`${d.name}: ${i + 2} missing records`}>{i + 2}</span></div>)}</div><p className="mt-4 text-[11px] text-muted-foreground">Cell values are record counts, not readiness scores.</p></div><Legend kind="heatmap" labels={["Verified", "Review required", "Missing evidence"]} /><p className="sr-only">Gap counts: {spec.data.map((d, i) => `${d.name} ${i + 2}`).join(", ")}</p></>;
}
function Flow({ spec }: { spec: Visualization }) {
  return <><div className="chart-canvas"><svg viewBox="0 0 360 230" className="size-full" role="img" aria-label="Sankey demonstration: 20 source links split into 12 reviewed and 8 candidate links; 12 continue to a draft output">
    <path d="M27 90 C75 90 55 65 108 65" stroke="var(--chart-2)" strokeWidth="30" fill="none" opacity="0.28"><title>12 reviewed links</title></path>
    <path d="M27 125 C75 125 55 157 108 157" stroke="var(--chart-3)" strokeWidth="20" fill="none" opacity="0.28"><title>8 candidate links</title></path>
    <path d="M123 65 C155 65 170 65 216 65" stroke="var(--chart-2)" strokeWidth="30" fill="none" opacity="0.28" />
    <path d="M123 157 C155 157 170 157 216 157" stroke="var(--chart-3)" strokeWidth="20" fill="none" opacity="0.28" strokeDasharray="5 3" />
    <path d="M231 65 C275 65 275 100 330 100" stroke="var(--chart-2)" strokeWidth="30" fill="none" opacity="0.28" />
    <rect x="16" y="75" width="12" height="65" rx="2" fill="var(--chart-1)" /><rect x="108" y="47" width="15" height="36" rx="2" fill="var(--chart-2)" /><rect x="108" y="142" width="15" height="30" rx="2" fill="var(--chart-3)" /><rect x="216" y="47" width="15" height="36" rx="2" fill="var(--chart-2)" /><rect x="216" y="142" width="15" height="30" rx="2" fill="var(--chart-3)" /><rect x="330" y="80" width="12" height="40" rx="2" fill="var(--chart-4)" />
    {spec.data.map((d, i) => <text key={d.name} x={[22, 116, 225, 330][i]} y="210" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{d.name}</text>)}
    <text x="114" y="34" fontSize="10" textAnchor="middle" fill="var(--foreground)">12 reviewed</text><text x="114" y="189" fontSize="10" textAnchor="middle" fill="var(--foreground)">8 candidate</text><text x="225" y="189" fontSize="10" textAnchor="middle" fill="var(--foreground)">Pending</text><text x="327" y="67" fontSize="10" textAnchor="middle" fill="var(--foreground)">12 draft</text>
  </svg></div><Legend labels={["Source links", "Reviewed", "Candidate / pending", "Draft output"]} /><details className="chart-data"><summary>View flow links</summary><p className="mt-2">Sources → reviewed facts: 12; sources → candidate facts: 8; reviewed facts → reviewed requirements: 12; candidate facts → pending requirements: 8; reviewed requirements → draft outputs: 12. Pending links do not enter the draft output.</p></details></>;
}
function Network({ spec }: { spec: Visualization }) {
  const [selected, setSelected] = useState("Grants fact");
  const positions = [[42, 48], [152, 93], [271, 45], [65, 180], [280, 180]];
  return <><div className="chart-canvas"><svg viewBox="0 0 340 230" className="size-full" role="img" aria-label="Approved and candidate record relationships"><g stroke="var(--chart-2)" strokeWidth="2"><line x1="42" y1="48" x2="152" y2="93" /><line x1="152" y1="93" x2="271" y2="45" /><line x1="271" y1="45" x2="280" y2="180" /></g><g stroke="var(--chart-3)" strokeWidth="2" strokeDasharray="5 4"><line x1="152" y1="93" x2="65" y2="180" /><line x1="65" y1="180" x2="280" y2="180" /></g>{spec.data.map((d, i) => <g key={d.name}><circle cx={positions[i]?.[0]} cy={positions[i]?.[1]} r="12" fill={selected === d.name ? "var(--chart-1)" : "var(--secondary)"} stroke="var(--primary)" /><text x={positions[i]?.[0]} y={(positions[i]?.[1] ?? 0) + 27} textAnchor="middle" fontSize="10" fill="var(--foreground)">{d.name}</text></g>)}</svg></div><div className="flex flex-wrap gap-1">{spec.data.map(d => <Button key={d.name} size="sm" variant={selected === d.name ? "secondary" : "ghost"} aria-pressed={selected === d.name} onClick={() => setSelected(d.name)} className="h-7 px-2 text-[10px]">{d.name}</Button>)}</div><p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">{selected}: {spec.data.find(d => d.name === selected)?.value} illustrative connections.</p><Legend labels={["Selected record", "Approved · solid", "Candidate · dashed"]} /></>;
}
function Plot({ spec }: { spec: Visualization }) {
  if (spec.kind === "heatmap") return <Heatmap spec={spec} />;
  if (spec.kind === "flow") return <Flow spec={spec} />;
  if (spec.kind === "network") return <Network spec={spec} />;
  if (spec.kind === "timeline") return <div className="chart-canvas"><ol className="chart-timeline">{spec.data.map(d => <li key={d.name}><time>{d.value} Oct 2026 · sample</time>{d.name}</li>)}</ol></div>;
  const config = { value: { label: spec.series?.[0] ?? "Records", color: colors[0] }, secondary: { label: spec.series?.[1] ?? "Reviewed", color: colors[1] } };
  const tooltip = <ChartTooltip content={<ChartTooltipContent />} />;
  const grid = <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />;
  return <><ClientOnly fallback={<div className="chart-canvas bg-muted/30" />}><ChartContainer config={config} className="chart-canvas aspect-auto">
    {spec.kind === "radar" ? <RadarChart data={spec.data} outerRadius="65%"> <PolarGrid stroke="var(--border)" /><PolarAngleAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><PolarRadiusAxis domain={[0, 100]} tickCount={3} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} /><Radar dataKey="value" name="Complete (%)" stroke={colors[1]} fill={colors[1]} fillOpacity={0.2} isAnimationActive={false} />{tooltip}</RadarChart>
    : spec.kind === "donut" ? <PieChart><Pie data={spec.data} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="75%" paddingAngle={3} isAnimationActive={false}>{spec.data.map((d, i) => <Cell key={d.name} fill={colors[i % colors.length]} />)}</Pie>{tooltip}</PieChart>
    : spec.kind === "line" ? <LineChart data={spec.data} margin={{ left: -20, right: 8, top: 10, bottom: 5 }}>{grid}<XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />{tooltip}<Line dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />{spec.data.some(d => d.secondary !== undefined) && <Line dataKey="secondary" stroke={colors[1]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />}</LineChart>
    : <BarChart data={spec.data} layout="vertical" margin={{ left: 0, right: 12, top: 5, bottom: 5 }}>{grid}<XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} domain={spec.subtitle.includes("(%)") ? [0, 100] : [0, "auto"]} /><YAxis type="category" dataKey="name" width={80} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />{tooltip}<Bar dataKey="value" fill={colors[0]} radius={[0, 3, 3, 0]} barSize={12} isAnimationActive={false} />{spec.data.some(d => d.secondary !== undefined) && <Bar dataKey="secondary" fill={colors[1]} radius={[0, 3, 3, 0]} barSize={10} isAnimationActive={false} />}</BarChart>}
  </ChartContainer></ClientOnly><Legend kind={spec.kind} labels={spec.kind === "donut" ? spec.data.map(d => `${d.name} · ${d.value}`) : spec.series ?? ["Records"]} /></>;
}
export function Analytics({ page }: { page: AnalyticalPage }) {
  const { workspace } = useWorkspace();
  return <div className="analytics-grid">{getVisualizations(page, workspace.kind === "university").map(spec => <Frame key={spec.title} spec={spec}><Plot spec={spec} /></Frame>)}</div>;
}