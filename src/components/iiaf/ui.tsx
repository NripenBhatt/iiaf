import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Construction, Lock, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./workspace";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-2 text-teal">{eyebrow}</p>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex shrink-0 items-center whitespace-nowrap rounded border border-gold/40 bg-gold-soft px-1.5 py-0.5 text-[10px] text-foreground",
        className,
      )}
    >
      Demo data
    </span>
  );
}

/** Disabled control that clearly says it is not functional yet. */
export function PlannedButton({ children }: { children: ReactNode }) {
  return (
    <Button
      variant="outline"
      disabled
      title="Not available in Phase 0"
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-input bg-card px-3 py-2 text-sm text-muted-foreground"
    >
      {children}
      <span className="eyebrow text-[9px]">Later phase</span>
    </Button>
  );
}

export function PlaceholderNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex gap-3 rounded-md border-l-4 border-l-gold border border-input bg-gold-soft/50 p-4 text-sm text-muted-foreground">
      <Construction className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <span className="font-medium text-foreground">Non-functional placeholder. </span>
        {children}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  aside,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {aside}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-muted-foreground">{label}</p>
        <DemoTag />
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type Tone = "neutral" | "teal" | "success" | "warning" | "danger" | "gold";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  teal: "bg-teal-soft text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  gold: "bg-gold-soft text-foreground",
};

export function Status({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function DataTable({
  columns,
  rows,
  caption,
  live = false,
}: {
  columns: string[];
  rows: ReactNode[][];
  caption?: string;
  /** Rows come from persisted records, so the demo label must not be shown. */
  live?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card shadow-card">
      {caption && (
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-semibold">{caption}</p>
          {live ? <span className="text-[11px] font-medium uppercase tracking-wide text-success">Live records</span> : <DemoTag />}
        </div>
      )}
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-secondary/40 text-left">
            {columns.map((c) => (
              <th key={c} className="eyebrow px-5 py-2.5 font-normal text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
              {r.map((cell, j) => (
                <td key={j} className={cn("px-5 py-3 align-top", j === 0 && "font-medium")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="hatch flex flex-col items-center rounded-md border border-dashed px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border bg-card shadow-card">
        <Icon className="size-5 text-teal" />
      </span>
      <h3 className="mt-4 text-xl font-medium">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/** Shown when a company-only page is opened from a university workspace. */
export function InternalOnly({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace();
  if (workspace.kind === "internal") return <>{children}</>;
  return (
    <EmptyState icon={Lock} title="Not available in this workspace">
      This module is reserved for the Rafts and Rivers internal workspace. University access is not granted to this module.
    </EmptyState>
  );
}
