"use client";

import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "good" | "watch" | "risk" | "brand";

const toneMap: Record<Tone, string> = {
  neutral: "border-line bg-white/75 text-ink",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-yellow-200 bg-yellow-50 text-yellow-800",
  risk: "border-red-200 bg-red-50 text-red-700",
  brand: "border-[#17483f]/20 bg-[#e6efeb] text-[#17483f]"
};

export function CenterHero({
  eyebrow,
  title,
  subtitle,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#d7d8cc] bg-[#f9f7ef] px-5 py-6 shadow-[0_24px_70px_rgba(20,33,29,0.10)] md:px-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(188,167,122,0.25),transparent_26rem),radial-gradient(circle_at_12%_16%,rgba(23,72,63,0.13),transparent_24rem)]" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="premium-section-eyebrow">{eyebrow}</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-base">{subtitle}</p>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
      {children ? <div className="relative mt-6">{children}</div> : null}
    </section>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{children}</div>;
}

export function ExecutiveKpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral"
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/78 p-4 shadow-[0_12px_34px_rgba(20,33,29,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-xs font-semibold text-muted">{label}</div>
      <div className={`premium-number mt-1 truncate text-2xl font-semibold tabular-nums ${tone === "risk" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-ink"}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 truncate text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function CenterPanel({
  eyebrow,
  title,
  aside,
  children,
  className = ""
}: {
  eyebrow?: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[26px] border border-line bg-card/90 p-5 shadow-card backdrop-blur ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{eyebrow}</p> : null}
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {aside ? <div className="flex flex-wrap gap-2">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${toneMap[tone]}`}>{children}</span>;
}

export function MetricLine({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className="rounded-2xl border border-line bg-white/70 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${tone === "risk" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-ink"}`}>{value}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  const color = tone === "risk" ? "bg-red-500" : tone === "watch" ? "bg-yellow-500" : tone === "good" ? "bg-emerald-600" : "bg-[#17483f]";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e7e5da]">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/50 px-4 py-8 text-center text-sm font-semibold text-muted">{text}</div>;
}
