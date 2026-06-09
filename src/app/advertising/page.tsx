"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  CircleAlert,
  Download,
  EyeOff,
  Gauge,
  LineChart as LineIcon,
  PauseCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { activeProducts } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import type { LucideIcon } from "lucide-react";
import type { ProductWithStock } from "@/lib/types";

type AdStatus = "running" | "learning" | "paused" | "issue" | "运行中" | "学习中" | "暂停" | "异常";
type DatePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";
type Grain = "day" | "week" | "month";
type SortKey = "campaign_name" | "status" | "budget" | "spend" | "sales" | "roas" | "profit" | "ctr" | "conversionRate" | "last_updated_at";
type HiddenKey = "budget" | "ctr" | "conversionRate" | "last_updated_at";
type CampaignColumn = { key: SortKey; label: string; hide?: HiddenKey; render: (row: CampaignAgg) => ReactNode };

type AdRow = {
  id: string;
  campaign_name: string;
  status: AdStatus;
  budget: number;
  spend: number;
  sales: number;
  profit: number;
  orders: number;
  impressions: number;
  clicks: number;
  conversions: number;
  sku: string | null;
  product_name: string | null;
  record_date: string;
  last_updated_at: string;
};

type StockRow = ProductWithStock & {
  inventory_balances?: { current_stock: number } | { current_stock: number }[] | null;
};

const pageSize = 8;
const hiddenOptions: { key: HiddenKey; label: string }[] = [
  { key: "budget", label: "预算" },
  { key: "ctr", label: "CTR" },
  { key: "conversionRate", label: "转化率" },
  { key: "last_updated_at", label: "最后更新时间" }
];

export default function AdvertisingPage() {
  return (
    <AppShell>
      <AdvertisingContent />
    </AppShell>
  );
}

function AdvertisingContent() {
  const [rows, setRows] = useState<AdRow[]>([]);
  const [products, setProducts] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [preset, setPreset] = useState<DatePreset>("last30");
  const [grain, setGrain] = useState<Grain>("day");
  const [customStart, setCustomStart] = useState(toDateInput(daysAgo(29)));
  const [customEnd, setCustomEnd] = useState(toDateInput(new Date()));
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState<HiddenKey[]>([]);
  const [expandedHealth, setExpandedHealth] = useState(false);
  const [openInsight, setOpenInsight] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: productRows }] = await Promise.all([
      supabase.from("advertising_campaigns").select("*").order("record_date", { ascending: false }).order("last_updated_at", { ascending: false }),
      supabase.from("products").select("*, inventory_balances(current_stock)")
    ]);

    if (error) {
      setMessage(formatAdError(error.message));
      setRows([]);
    } else {
      setRows((data ?? []) as AdRow[]);
      setMessage("");
    }

    setProducts(activeProducts((productRows ?? []) as StockRow[]));
    setLoading(false);
  }

  const range = useMemo(() => dateRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const filtered = useMemo(() => rows.filter((row) => inRange(row.record_date, range.start, range.end)), [rows, range]);
  const comparison = useMemo(() => previousPeriod(rows, range.start, range.end), [rows, range]);
  const metrics = useMemo(() => buildMetrics(filtered), [filtered]);
  const previousMetrics = useMemo(() => buildMetrics(comparison), [comparison]);
  const trend = useMemo(() => buildTrend(filtered, grain), [filtered, grain]);
  const campaignRows = useMemo(() => aggregateCampaigns(filtered), [filtered]);
  const skuRows = useMemo(() => aggregateSku(filtered, products), [filtered, products]);
  const searchedCampaigns = useMemo(() => sortCampaigns(campaignRows.filter((row) => matches(row, search)), sort), [campaignRows, search, sort]);
  const pagedCampaigns = searchedCampaigns.slice((page - 1) * pageSize, page * pageSize);
  const bestAds = useMemo(() => campaignRows.filter((row) => row.spend > 0).sort((a, b) => b.roas - a.roas || b.profit - a.profit).slice(0, 10), [campaignRows]);
  const riskAds = useMemo(() => campaignRows.filter((row) => row.profit < 0 || row.roas < 1).sort((a, b) => a.roas - b.roas || a.profit - b.profit).slice(0, 10), [campaignRows]);
  const health = useMemo(() => buildHealth(metrics), [metrics]);
  const insights = useMemo(() => buildInsights(filtered, metrics, previousMetrics, skuRows, products), [filtered, metrics, previousMetrics, skuRows, products]);
  const decisions = useMemo(() => buildDecisions(campaignRows, skuRows), [campaignRows, skuRows]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#dfe2da] bg-[#fbfaf6]/92 px-6 py-7 shadow-[0_22px_70px_rgba(18,31,27,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#101815]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#17483f]/30 to-transparent" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="premium-section-eyebrow">Advertising Intelligence Center</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink dark:text-white md:text-5xl">广告分析中心</h1>
            <p className="mt-3 text-base text-muted dark:text-white/62">监控广告表现、利润贡献及投放效率</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-3 py-2 text-xs font-semibold text-muted shadow-[0_12px_30px_rgba(18,31,27,0.05)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60">
            <Activity className="h-4 w-4 text-brand" />
            真实数据驱动 · 无示例数据
          </div>
        </div>

        {loading ? <SkeletonKpis /> : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AppleKpi icon={WalletCards} label="广告花费" value={won(metrics.spend)} change={changeRate(metrics.spend, previousMetrics.spend)} />
            <AppleKpi icon={TrendingUp} label="广告销售额" value={won(metrics.sales)} change={changeRate(metrics.sales, previousMetrics.sales)} />
            <AppleKpi icon={Gauge} label="ROAS" value={metrics.roas.toFixed(2)} helper="目标 4.0" good={metrics.roas >= 4} />
            <AppleKpi icon={Target} label="广告利润" value={won(metrics.profit)} helper={`利润率 ${metrics.margin.toFixed(1)}%`} good={metrics.profit >= 0} />
          </div>
        )}
      </section>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="premium-section-eyebrow">Core Trends</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink dark:text-white">核心趋势分析</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented value={preset} options={[
              ["today", "今天"], ["yesterday", "昨天"], ["last7", "近7天"], ["last30", "近30天"], ["thisMonth", "本月"], ["lastMonth", "上月"], ["custom", "自定义"]
            ]} onChange={(value) => setPreset(value as DatePreset)} />
            <Segmented value={grain} options={[["day", "日"], ["week", "周"], ["month", "月"]]} onChange={(value) => setGrain(value as Grain)} />
          </div>
        </div>
        {preset === "custom" ? (
          <div className="mb-4 flex flex-wrap gap-3">
            <input className="premium-input max-w-48" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            <input className="premium-input max-w-48" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
          </div>
        ) : null}
        {loading ? <SkeletonBlock /> : trend.length ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="adSales" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#17483f" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#17483f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(197,201,189,0.55)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => compactWon(Number(value))} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(23,72,63,0.28)" }} />
                <Area type="monotone" dataKey="sales" name="销售额" stroke="#17483f" strokeWidth={2.5} fill="url(#adSales)" animationDuration={650} />
                <Line type="monotone" dataKey="spend" name="广告花费" stroke="#b89b5e" strokeWidth={2.2} dot={false} animationDuration={700} />
                <Line type="monotone" dataKey="roas" name="ROAS" stroke="#3577c9" strokeWidth={2.2} dot={false} yAxisId={0} animationDuration={750} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <PremiumEmpty title="暂无广告趋势数据" text="导入或录入 advertising_campaigns 后，这里会自动生成销售额、花费和 ROAS 趋势。" />}
      </section>

      <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="premium-section-eyebrow">Campaign Grid</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink dark:text-white">广告账户总览列表</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="premium-input w-64 pl-9" placeholder="搜索广告系列 / SKU" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </label>
            <ColumnMenu hidden={hidden} onChange={setHidden} />
            <button className="erp-button-subtle inline-flex h-10 items-center gap-2 px-3 text-sm font-bold" onClick={() => exportCampaigns(searchedCampaigns)}>
              <Download className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>
        <CampaignTable rows={pagedCampaigns} sort={sort} setSort={setSort} hidden={hidden} />
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>共 {searchedCampaigns.length} 条真实记录</span>
          <div className="flex gap-2">
            <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
            <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page * pageSize >= searchedCampaigns.length} onClick={() => setPage((value) => value + 1)}>下一页</button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankPanel title="最佳广告 TOP10" rows={bestAds} mode="best" />
        <RankPanel title="待优化广告 TOP10" rows={riskAds} mode="risk" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
          <p className="premium-section-eyebrow">Health Center</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-ink dark:text-white">广告健康度中心</h2>
              <p className="mt-1 text-sm text-muted">ROAS、CTR、转化率、利润率、增长率综合评分</p>
            </div>
            <button className={`rounded-2xl px-4 py-2 text-2xl font-bold ${healthClass(health.grade)}`} onClick={() => setExpandedHealth((value) => !value)}>{health.grade}</button>
          </div>
          <div className="mt-6 text-6xl font-semibold tabular-nums text-ink dark:text-white">{health.score}</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7e5da]">
            <div className="h-full rounded-full bg-[#17483f] transition-all duration-700" style={{ width: `${health.score}%` }} />
          </div>
          {expandedHealth ? (
            <div className="mt-5 grid gap-2">
              {health.parts.map((part) => <MetricMini key={part.label} label={part.label} value={`${part.value}分`} />)}
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
          <p className="premium-section-eyebrow">Insight Cards</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink dark:text-white">广告洞察中心</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {insights.length ? insights.map((insight) => (
              <button key={insight.title} className="group rounded-2xl border border-line bg-white/70 p-4 text-left shadow-[0_10px_28px_rgba(18,31,27,0.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,31,27,0.08)] dark:border-white/10 dark:bg-white/[0.05]" onClick={() => setOpenInsight(openInsight === insight.title ? null : insight.title)}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${insight.tone}`}><insight.icon className="h-5 w-5" /></span>
                  <div>
                    <div className="font-semibold text-ink dark:text-white">{insight.title}</div>
                    <p className="mt-1 text-sm text-muted">{insight.summary}</p>
                  </div>
                </div>
                {openInsight === insight.title ? <p className="mt-4 rounded-xl bg-[#f6f5f0] p-3 text-sm leading-6 text-muted dark:bg-white/[0.06]">{insight.detail}</p> : null}
              </button>
            )) : <PremiumEmpty title="暂无可生成洞察" text="有足够广告记录后，系统会基于真实趋势自动生成洞察。" />}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="premium-section-eyebrow">SKU Intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink dark:text-white">广告 SKU 分析表</h2>
          </div>
          <span className="text-sm font-semibold text-muted">日期联动：{range.start} - {range.end}</span>
        </div>
        <SkuTable rows={skuRows} />
      </section>

      <section className="rounded-[28px] border border-line bg-[#102b27] p-5 text-white shadow-[0_24px_70px_rgba(16,43,39,0.22)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d6c28b]">Decision Center</p>
            <h2 className="mt-2 text-2xl font-semibold">广告决策中心</h2>
          </div>
          <Sparkles className="h-6 w-6 text-[#d6c28b]" />
        </div>
        {decisions.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {decisions.map((item) => (
              <div key={`${item.action}-${item.name}`} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold">{item.action}</div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70">{item.metric}</span>
                </div>
                <div className="mt-2 font-semibold text-[#d6c28b]">{item.name}</div>
                <p className="mt-3 text-sm leading-6 text-white/68">{item.reason}</p>
                <p className="mt-3 text-sm font-semibold text-white">预计影响：{item.impact}</p>
              </div>
            ))}
          </div>
        ) : <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 text-center text-sm font-semibold text-white/60">暂无可推荐动作。系统只基于真实广告数据输出建议。</div>}
      </section>
    </div>
  );
}

function AppleKpi({ icon: Icon, label, value, change, helper, good = true }: { icon: LucideIcon; label: string; value: string; change?: number; helper?: string; good?: boolean }) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="group rounded-[22px] border border-[#dfe2da] bg-white/78 p-5 shadow-[0_14px_38px_rgba(18,31,27,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(18,31,27,0.10)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e8f1ed] text-brand"><Icon className="h-5 w-5" /></span>
        {change !== undefined ? <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(change).toFixed(1)}%</span> : null}
        {helper ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{helper}</span> : null}
      </div>
      <div className="mt-5 text-sm font-semibold text-muted">{label}</div>
      <div className="premium-number mt-2 text-3xl font-semibold tabular-nums text-ink dark:text-white">{value}</div>
      <div className="mt-2 text-xs text-muted">较上一周期变化</div>
    </div>
  );
}

function CampaignTable({ rows, sort, setSort, hidden }: { rows: CampaignAgg[]; sort: { key: SortKey; dir: "asc" | "desc" }; setSort: (sort: { key: SortKey; dir: "asc" | "desc" }) => void; hidden: HiddenKey[] }) {
  const cols: CampaignColumn[] = ([
    { key: "campaign_name", label: "广告系列名称", render: (row) => <div className="font-semibold text-ink dark:text-white">{row.campaign_name}</div> },
    { key: "status", label: "状态", render: (row) => <StatusBadge status={row.status} /> },
    { key: "budget", label: "预算", hide: "budget", render: (row) => won(row.budget) },
    { key: "spend", label: "花费", render: (row) => won(row.spend) },
    { key: "sales", label: "销售额", render: (row) => won(row.sales) },
    { key: "roas", label: "ROAS", render: (row) => row.roas.toFixed(2) },
    { key: "profit", label: "利润", render: (row) => <span className={row.profit < 0 ? "text-red-700" : "text-emerald-700"}>{won(row.profit)}</span> },
    { key: "ctr", label: "CTR", hide: "ctr", render: (row) => `${row.ctr.toFixed(2)}%` },
    { key: "conversionRate", label: "转化率", hide: "conversionRate", render: (row) => `${row.conversionRate.toFixed(2)}%` },
    { key: "last_updated_at", label: "最后更新时间", hide: "last_updated_at", render: (row) => new Date(row.last_updated_at).toLocaleString("zh-CN") }
  ] satisfies CampaignColumn[]).filter((col) => !col.hide || !hidden.includes(col.hide));

  if (!rows.length) return <PremiumEmpty title="暂无广告系列数据" text="当前筛选范围没有真实广告数据。" />;

  return (
    <div className="max-h-[520px] overflow-auto rounded-2xl border border-line bg-white/65 dark:border-white/10 dark:bg-white/[0.03]">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="sticky top-0 z-[1] bg-[#f6f5f0]/95 backdrop-blur dark:bg-[#17211d]/95">
          <tr>
            {cols.map((col) => (
              <th key={col.key} className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                <button className="inline-flex items-center gap-1" onClick={() => setSort({ key: col.key, dir: sort.key === col.key && sort.dir === "desc" ? "asc" : "desc" })}>{col.label}<ChevronDown className="h-3 w-3" /></button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.campaign_name} className="border-t border-line/70 transition hover:bg-[#f8f7f1] dark:border-white/10 dark:hover:bg-white/[0.04]">
              {cols.map((col) => <td key={col.key} className="px-4 py-3 font-medium text-muted">{col.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankPanel({ title, rows, mode }: { title: string; rows: CampaignAgg[]; mode: "best" | "risk" }) {
  return (
    <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
      <p className="premium-section-eyebrow">{mode === "best" ? "Top Performers" : "Optimization Queue"}</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink dark:text-white">{title}</h2>
      <div className="mt-5 space-y-3">
        {rows.length ? rows.map((row, index) => (
          <div key={row.campaign_name} className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 p-3 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(18,31,27,0.07)] dark:border-white/10 dark:bg-white/[0.05]">
            <RankMedal rank={index + 1} mode={mode} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink dark:text-white">{row.campaign_name}</div>
              <div className="mt-1 text-xs text-muted">{mode === "best" ? `ROAS ${row.roas.toFixed(2)} · 利润 ${won(row.profit)} · 销售额 ${won(row.sales)}` : `花费 ${won(row.spend)} · ROAS ${row.roas.toFixed(2)} · 亏损 ${won(Math.min(0, row.profit))}`}</div>
            </div>
            {mode === "risk" ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">风险</span> : null}
          </div>
        )) : <PremiumEmpty title="暂无排行数据" text="有真实广告记录后自动生成。" />}
      </div>
    </section>
  );
}

function SkuTable({ rows }: { rows: SkuAgg[] }) {
  if (!rows.length) return <PremiumEmpty title="暂无 SKU 广告数据" text="记录包含 SKU 后，这里会自动生成广告 SKU 分析。" />;
  return (
    <div className="overflow-auto rounded-2xl border border-line bg-white/65 dark:border-white/10 dark:bg-white/[0.03]">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="bg-[#f6f5f0]/95 dark:bg-[#17211d]/95">
          <tr>{["SKU", "产品名称", "广告销售额", "广告订单数", "广告花费", "ROAS", "利润", "CTR", "转化率", "库存状态"].map((head) => <th key={head} className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">{head}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sku} className="border-t border-line/70 hover:bg-[#f8f7f1] dark:border-white/10 dark:hover:bg-white/[0.04]">
              <td className="px-4 py-3 font-semibold text-ink dark:text-white"><Link href={`/products?sku=${encodeURIComponent(row.sku)}`}>{row.sku}</Link></td>
              <td className="px-4 py-3 text-muted">{row.product_name || "-"}</td>
              <td className="px-4 py-3 text-muted">{won(row.sales)}</td>
              <td className="px-4 py-3 text-muted">{row.orders}</td>
              <td className="px-4 py-3 text-muted">{won(row.spend)}</td>
              <td className="px-4 py-3 font-semibold text-ink dark:text-white">{row.roas.toFixed(2)}</td>
              <td className={`px-4 py-3 font-semibold ${row.profit < 0 ? "text-red-700" : "text-emerald-700"}`}>{won(row.profit)}</td>
              <td className="px-4 py-3 text-muted">{row.ctr.toFixed(2)}%</td>
              <td className="px-4 py-3 text-muted">{row.conversionRate.toFixed(2)}%</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.stockTone}`}>{row.stockStatus}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColumnMenu({ hidden, onChange }: { hidden: HiddenKey[]; onChange: (hidden: HiddenKey[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="erp-button-subtle inline-flex h-10 items-center gap-2 px-3 text-sm font-bold" onClick={() => setOpen((value) => !value)}><EyeOff className="h-4 w-4" />列隐藏</button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-52 rounded-2xl border border-line bg-card p-3 shadow-lift">
          {hiddenOptions.map((option) => (
            <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-muted hover:bg-[#f6f5f0]">
              <input type="checkbox" checked={!hidden.includes(option.key)} onChange={() => onChange(hidden.includes(option.key) ? hidden.filter((item) => item !== option.key) : [...hidden, option.key])} />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div className="flex flex-wrap gap-1 rounded-2xl border border-line bg-white/70 p-1 dark:border-white/10 dark:bg-white/[0.05]">{options.map(([key, label]) => <button key={key} className={`rounded-xl px-3 py-2 text-xs font-bold ${value === key ? "bg-[#102b27] text-white shadow-[0_8px_20px_rgba(16,43,39,0.18)]" : "text-muted hover:bg-white"}`} onClick={() => onChange(key)}>{label}</button>)}</div>;
}

function StatusBadge({ status }: { status: AdStatus }) {
  const normalized = normalizeStatus(status);
  const style = normalized === "running" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : normalized === "learning" ? "bg-blue-50 text-blue-700 border-blue-200" : normalized === "issue" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-600 border-gray-200";
  const label = normalized === "running" ? "运行中" : normalized === "learning" ? "学习中" : normalized === "issue" ? "异常" : "暂停";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${style}`}>{label}</span>;
}

function SkeletonKpis() {
  return <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-[22px] bg-white/60" />)}</div>;
}

function SkeletonBlock() {
  return <div className="h-[360px] animate-pulse rounded-3xl bg-white/60 dark:bg-white/[0.05]" />;
}

function PremiumEmpty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-[24px] border border-dashed border-[#cfd6cd] bg-white/55 px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.04]"><LineIcon className="mx-auto h-7 w-7 text-brand" /><div className="mt-3 font-semibold text-ink dark:text-white">{title}</div><p className="mt-2 text-sm text-muted">{text}</p></div>;
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.05]"><span className="text-muted">{label}</span><span className="font-bold text-ink dark:text-white">{value}</span></div>;
}

function RankMedal({ rank, mode }: { rank: number; mode: "best" | "risk" }) {
  const medals = ["bg-[#d6b96f] text-white", "bg-[#bfc5c7] text-white", "bg-[#b97a4b] text-white"];
  return <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${mode === "best" && rank <= 3 ? medals[rank - 1] : "bg-[#eef1ed] text-muted"}`}>{rank}</div>;
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-2xl border border-line bg-card/95 p-4 text-sm shadow-lift backdrop-blur">
      <div className="font-bold text-ink">{label}</div>
      <div className="mt-2 grid gap-1 text-muted">
        <span>广告花费：{won(row.spend)}</span>
        <span>销售额：{won(row.sales)}</span>
        <span>ROAS：{row.roas.toFixed(2)}</span>
        <span>利润：{won(row.profit)}</span>
      </div>
    </div>
  );
}

type Metrics = ReturnType<typeof buildMetrics>;
type CampaignAgg = ReturnType<typeof aggregateCampaigns>[number];
type SkuAgg = ReturnType<typeof aggregateSku>[number];

function buildMetrics(rows: AdRow[]) {
  const spend = sum(rows, "spend");
  const sales = sum(rows, "sales");
  const profit = sum(rows, "profit");
  const impressions = sum(rows, "impressions");
  const clicks = sum(rows, "clicks");
  const conversions = sum(rows, "conversions");
  return {
    spend,
    sales,
    profit,
    orders: sum(rows, "orders"),
    roas: spend > 0 ? sales / spend : 0,
    margin: sales > 0 ? (profit / sales) * 100 : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0
  };
}

function aggregateCampaigns(rows: AdRow[]) {
  const map = new Map<string, AdRow[]>();
  rows.forEach((row) => map.set(row.campaign_name, [...(map.get(row.campaign_name) ?? []), row]));
  return Array.from(map.entries()).map(([campaign_name, items]) => {
    const metrics = buildMetrics(items);
    return {
      campaign_name,
      status: items[0]?.status ?? "running",
      budget: sum(items, "budget"),
      spend: metrics.spend,
      sales: metrics.sales,
      profit: metrics.profit,
      roas: metrics.roas,
      ctr: metrics.ctr,
      conversionRate: metrics.conversionRate,
      last_updated_at: items.map((item) => item.last_updated_at).sort().at(-1) ?? ""
    };
  });
}

function aggregateSku(rows: AdRow[], products: StockRow[]) {
  const productMap = new Map(products.map((product) => [product.sku, product]));
  const map = new Map<string, AdRow[]>();
  rows.filter((row) => row.sku).forEach((row) => map.set(row.sku!, [...(map.get(row.sku!) ?? []), row]));
  return Array.from(map.entries()).map(([sku, items]) => {
    const metrics = buildMetrics(items);
    const product = productMap.get(sku);
    const stock = currentStock(product);
    const low = Number(product?.low_stock_threshold ?? 10);
    const stockStatus = stock <= 0 ? "缺货" : stock <= low ? "低库存" : "充足";
    const stockTone = stock <= 0 ? "bg-red-50 text-red-700" : stock <= low ? "bg-yellow-50 text-yellow-800" : "bg-emerald-50 text-emerald-700";
    return {
      sku,
      product_name: items.find((item) => item.product_name)?.product_name ?? product?.name ?? "",
      sales: metrics.sales,
      orders: metrics.orders,
      spend: metrics.spend,
      roas: metrics.roas,
      profit: metrics.profit,
      ctr: metrics.ctr,
      conversionRate: metrics.conversionRate,
      stock,
      stockStatus,
      stockTone
    };
  }).sort((a, b) => b.sales - a.sales);
}

function buildTrend(rows: AdRow[], grain: Grain) {
  const map = new Map<string, AdRow[]>();
  rows.forEach((row) => {
    const key = grainKey(row.record_date, grain);
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, items]) => ({ label, ...buildMetrics(items) }));
}

function buildHealth(metrics: Metrics) {
  const roasScore = score(metrics.roas, 1, 5);
  const ctrScore = score(metrics.ctr, 0.5, 4);
  const conversionScore = score(metrics.conversionRate, 1, 8);
  const marginScore = score(metrics.margin, 0, 35);
  const growthScore = metrics.sales > 0 ? 70 : 0;
  const total = Math.round((roasScore + ctrScore + conversionScore + marginScore + growthScore) / 5);
  return {
    score: total,
    grade: total >= 90 ? "A+" : total >= 80 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : "D",
    parts: [
      { label: "ROAS", value: roasScore },
      { label: "CTR", value: ctrScore },
      { label: "转化率", value: conversionScore },
      { label: "利润率", value: marginScore },
      { label: "销量增长率", value: growthScore }
    ]
  };
}

function buildInsights(rows: AdRow[], metrics: Metrics, previous: Metrics, skus: SkuAgg[], products: StockRow[]) {
  if (!rows.length) return [];
  const result: { icon: typeof Sparkles; title: string; summary: string; detail: string; tone: string }[] = [];
  const roasChange = changeRate(metrics.roas, previous.roas);
  const ctrChange = changeRate(metrics.ctr, previous.ctr);
  const spendChange = changeRate(metrics.spend, previous.spend);
  const bestSku = skus[0];
  const lowStock = skus.find((sku) => sku.stockStatus !== "充足");
  if (roasChange > 0) result.push({ icon: TrendingUp, title: "ROAS 持续提升", summary: `较上一周期提升 ${roasChange.toFixed(1)}%`, detail: "建议检查高 ROAS 广告的预算承接能力和库存情况。", tone: "bg-emerald-50 text-emerald-700" });
  if (ctrChange < 0) result.push({ icon: CircleAlert, title: "CTR 下降", summary: `较上一周期下降 ${Math.abs(ctrChange).toFixed(1)}%`, detail: "建议复核主图、标题、优惠表达和投放人群匹配度。", tone: "bg-yellow-50 text-yellow-800" });
  if (spendChange > 15) result.push({ icon: WalletCards, title: "广告成本增加", summary: `广告花费增加 ${spendChange.toFixed(1)}%`, detail: "成本上升时需要同步观察 ROAS 与利润，否则预算扩张可能侵蚀利润。", tone: "bg-blue-50 text-blue-700" });
  if (metrics.conversionRate > 0) result.push({ icon: ShieldCheck, title: "转化率可追踪", summary: `当前转化率 ${metrics.conversionRate.toFixed(2)}%`, detail: "转化率来自真实 clicks/conversions 字段，后续可按 SKU 拆解落地页质量。", tone: "bg-emerald-50 text-emerald-700" });
  if (bestSku) result.push({ icon: Target, title: "利润贡献最高 SKU", summary: `${bestSku.sku} · ${won(bestSku.profit)}`, detail: "该 SKU 是当前筛选周期内广告利润贡献最高的商品。", tone: "bg-[#eef1ed] text-brand" });
  if (lowStock) result.push({ icon: CircleAlert, title: "库存不足 SKU", summary: `${lowStock.sku} · ${lowStock.stockStatus}`, detail: "广告表现与库存联动，库存不足时不建议继续扩量。", tone: "bg-red-50 text-red-700" });
  if (!result.length && products.length) result.push({ icon: Sparkles, title: "数据已连接", summary: "广告数据与商品库存已联动", detail: "继续沉淀广告记录后，系统会自动输出更多经营洞察。", tone: "bg-[#eef1ed] text-brand" });
  return result.slice(0, 6);
}

function buildDecisions(campaigns: CampaignAgg[], skus: SkuAgg[]) {
  const skuMap = new Map(skus.map((sku) => [sku.sku, sku]));
  return campaigns.flatMap((item) => {
    const high = item.roas >= 5 && item.profit > 0;
    const weak = item.spend > 0 && item.roas < 1.5;
    const maintain = item.roas >= 3 && item.roas < 5;
    if (high) return [{ action: "建议增加预算", name: item.campaign_name, metric: `ROAS ${item.roas.toFixed(2)}`, reason: "ROAS 高于 5 且利润为正，具备放量基础。", impact: `若库存充足，优先测试 10%-20% 预算提升。` }];
    if (weak) return [{ action: "建议暂停广告", name: item.campaign_name, metric: `ROAS ${item.roas.toFixed(2)}`, reason: "广告花费已产生，但 ROAS 偏低，继续投放可能扩大亏损。", impact: `预计减少低效花费 ${won(item.spend)}。` }];
    if (maintain) return [{ action: "建议维持预算", name: item.campaign_name, metric: `利润 ${won(item.profit)}`, reason: "广告效率处于可观察区间，适合继续积累样本。", impact: "保持预算，观察 CTR 与转化率是否改善。" }];
    return [];
  }).slice(0, 8);
}

function sortCampaigns(rows: CampaignAgg[], sort: { key: SortKey; dir: "asc" | "desc" }) {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort.key as keyof CampaignAgg] ?? "";
    const bv = b[sort.key as keyof CampaignAgg] ?? "";
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

function exportCampaigns(rows: CampaignAgg[]) {
  const headers = ["campaign_name", "status", "budget", "spend", "sales", "roas", "profit", "ctr", "conversion_rate", "last_updated_at"];
  const csv = [headers.join(","), ...rows.map((row) => [row.campaign_name, normalizeStatus(row.status), row.budget, row.spend, row.sales, row.roas, row.profit, row.ctr, row.conversionRate, row.last_updated_at].map(csvCell).join(","))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `advertising-campaigns-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function matches(row: CampaignAgg, search: string) {
  const keyword = search.trim().toLowerCase();
  if (!keyword) return true;
  return row.campaign_name.toLowerCase().includes(keyword);
}

function dateRange(preset: DatePreset, customStart: string, customEnd: string) {
  const today = new Date();
  if (preset === "today") return { start: toDateInput(today), end: toDateInput(today) };
  if (preset === "yesterday") return { start: toDateInput(daysAgo(1)), end: toDateInput(daysAgo(1)) };
  if (preset === "last7") return { start: toDateInput(daysAgo(6)), end: toDateInput(today) };
  if (preset === "thisMonth") return { start: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), end: toDateInput(today) };
  if (preset === "lastMonth") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: toDateInput(start), end: toDateInput(end) };
  }
  if (preset === "custom") return { start: customStart, end: customEnd };
  return { start: toDateInput(daysAgo(29)), end: toDateInput(today) };
}

function previousPeriod(rows: AdRow[], start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const previousEnd = new Date(startDate);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return rows.filter((row) => inRange(row.record_date, toDateInput(previousStart), toDateInput(previousEnd)));
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function grainKey(date: string, grain: Grain) {
  const current = new Date(date);
  if (grain === "month") return date.slice(0, 7);
  if (grain === "week") {
    const first = new Date(current);
    first.setDate(current.getDate() - current.getDay());
    return toDateInput(first);
  }
  return date;
}

function normalizeStatus(status: AdStatus) {
  if (status === "运行中") return "running";
  if (status === "学习中") return "learning";
  if (status === "异常") return "issue";
  if (status === "暂停") return "paused";
  return status;
}

function currentStock(product?: StockRow) {
  const balance = product?.inventory_balances;
  if (Array.isArray(balance)) return Number(balance[0]?.current_stock ?? 0);
  return Number(balance?.current_stock ?? 0);
}

function score(value: number, min: number, max: number) {
  if (value <= min) return 0;
  if (value >= max) return 100;
  return Math.round(((value - min) / (max - min)) * 100);
}

function sum(rows: AdRow[], key: keyof Pick<AdRow, "spend" | "sales" | "profit" | "orders" | "impressions" | "clicks" | "conversions" | "budget">) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function changeRate(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function healthClass(grade: string) {
  if (grade === "A+" || grade === "A") return "bg-emerald-50 text-emerald-700";
  if (grade === "B") return "bg-blue-50 text-blue-700";
  if (grade === "C") return "bg-yellow-50 text-yellow-800";
  return "bg-red-50 text-red-700";
}

function won(value: number) {
  return `₩${Math.round(Number(value || 0)).toLocaleString("ko-KR")}`;
}

function compactWon(value: number) {
  if (Math.abs(value) >= 100000000) return `₩${(value / 100000000).toFixed(1)}억`;
  if (Math.abs(value) >= 10000) return `₩${(value / 10000).toFixed(0)}만`;
  return `₩${value}`;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function formatAdError(message: string) {
  if (message.includes("Could not find the table") || message.includes("schema cache")) {
    return "数据库表尚未创建：advertising_campaigns。请先在 Supabase SQL Editor 执行 supabase/migrations/create-advertising-campaigns.sql，然后刷新页面。";
  }
  return message;
}
