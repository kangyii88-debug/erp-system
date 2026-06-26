"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  CalendarRange,
  ChevronRight,
  Download,
  Edit3,
  LineChart,
  Megaphone,
  Plus,
  Radar,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart
} from "recharts";

import {
  buildAdMetricsGrid,
  buildGlobalDailyRows,
  buildGlobalNotes,
  buildGlobalSkuRows,
  buildMetricChoices,
  useAdvertisingAdDetail,
  useAdvertisingData
} from "./useAdvertisingData";
import {
  CORE_ADS,
  formatCompactCurrency,
  formatCount,
  formatCurrency,
  formatPercent,
  pickMetric,
  todayKst
} from "@/lib/advertising";
import type {
  AdvertisingAdCard,
  AdvertisingDailyMetric,
  AdvertisingDailyNote,
  AdvertisingDailyNoteInput,
  AdvertisingMetricKey,
  AdvertisingPreset,
  AdvertisingRange,
  AdvertisingRecommendation,
  AdvertisingSkuMetric
} from "@/lib/advertising-types";

type DashboardMode = "overview" | "daily" | "sku" | "rankings" | "notes" | "import" | "rules";

export function AdvertisingDashboard({ mode = "overview" }: { mode?: DashboardMode }) {
  const [preset, setPreset] = useState<AdvertisingPreset>("last30");
  const [customRange, setCustomRange] = useState<AdvertisingRange>({ start: todayKst(), end: todayKst() });
  const [metric, setMetric] = useState<AdvertisingMetricKey>("adSales");
  const data = useAdvertisingData(preset, customRange);
  const dailyRows = useMemo(() => buildGlobalDailyRows(data.filteredMetrics), [data.filteredMetrics]);
  const skuRows = useMemo(() => buildGlobalSkuRows(data.filteredMetrics), [data.filteredMetrics]);
  const notes = useMemo(
    () => (data.notesCrud.notes.length ? data.notesCrud.notes : buildGlobalNotes(data.metrics)),
    [data.metrics, data.notesCrud.notes]
  );

  return (
    <div className="space-y-6">
      <HeroHeader
        title="广告智能中心"
        subtitle="按广告名称统一管理 Coupang 广告数据、SKU表现、ROAS趋势和每日运营记录。"
        preset={preset}
        onPresetChange={setPreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {mode === "overview" ? (
        <>
          <AdSummaryCards items={data.overviewKpis} loading={data.loading} />
          <section className="grid gap-5 xl:grid-cols-[1.4fr,0.9fr]">
            <div className="erp-card p-5">
              <SectionTitle
                eyebrow="核心广告"
                title="广告名称第一入口"
                description="点击任一广告卡片，直接进入该广告的独立运营中心。"
              />
              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                {data.cards.map((card) => (
                  <AdNameCard key={card.ad.id} card={card} />
                ))}
              </div>
            </div>
            <div className="erp-card p-5">
              <SectionTitle eyebrow="辅助分析" title="排行榜与提醒" description="排行榜是辅助入口，广告卡片始终保持第一优先级。" />
              <div className="mt-5 space-y-4">
                <AdRankingPanel
                  title="ROAS最高广告"
                  items={data.rankings.roas.slice(0, 3)}
                  formatter={(value) => formatPercent(value)}
                />
                <AdRankingPanel
                  title="需要优化广告"
                  items={data.cards.filter((card) => card.healthScore < 55).map((card) => ({
                    adId: card.ad.id,
                    adName: card.ad.adName,
                    value: card.healthScore,
                    secondary: `健康分 ${card.healthScore}`
                  }))}
                  formatter={(value) => `${Math.round(value ?? 0)}`}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.45fr,0.85fr]">
            <AdTrendChart title="整体趋势总览" points={data.trend} metric={metric} onMetricChange={setMetric} />
            <div className="erp-card p-5">
              <SectionTitle eyebrow="经营洞察" title="运营建议" description="基于近 30 天整体数据给出控制预算和优化素材建议。" />
              <div className="mt-5 grid gap-3">
                <AdRecommendationCard
                  title="预算方向"
                  detail={(data.overview.roas ?? 0) >= 300 ? "整体 ROAS 已经达到可放量区间，可优先扩投高健康分广告。" : "整体 ROAS 仍需优化，建议先聚焦 CTR 和转化率。"}
                  tone={(data.overview.roas ?? 0) >= 300 ? "good" : "warn"}
                />
                <AdRecommendationCard
                  title="异常监控"
                  detail={data.cards.some((card) => card.healthScore < 55) ? "检测到低健康分广告，请优先检查低ROAS广告的素材和详情页。" : "当前没有明显异常广告，继续观察近 3 天趋势。"}
                  tone={data.cards.some((card) => card.healthScore < 55) ? "danger" : "neutral"}
                />
              </div>
            </div>
          </section>
        </>
      ) : null}

      {mode === "daily" ? <AdDailyMetricsTable rows={dailyRows} showAdColumn /> : null}
      {mode === "sku" ? <AdSkuPerformanceTable rows={skuRows} showAdColumn /> : null}
      {mode === "rankings" ? <RankingsPage cards={data.cards} /> : null}
      {mode === "notes" ? <AdDailyNotes notes={notes} notesCrud={data.notesCrud} /> : null}
      {mode === "import" ? <AdImportMapping /> : null}
      {mode === "rules" ? <RulesPage /> : null}
    </div>
  );
}

export function AdvertisingDetailPage({ adId }: { adId: string }) {
  const [preset, setPreset] = useState<AdvertisingPreset>("last30");
  const [customRange, setCustomRange] = useState<AdvertisingRange>({ start: todayKst(), end: todayKst() });
  const [metric, setMetric] = useState<AdvertisingMetricKey>("adSales");
  const data = useAdvertisingAdDetail(adId, preset, customRange);

  return (
    <div className="space-y-6">
      <HeroHeader
        title={`广告详情：${data.ad.adName}`}
        subtitle="围绕单个广告查看 KPI、趋势图、日报表、SKU表现和每日运营记录。"
        preset={preset}
        onPresetChange={setPreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        leading={
          <Link href="/advertising" className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft">
            <ArrowLeft className="h-4 w-4" />
            返回广告智能中心
          </Link>
        }
      />

      <section className="erp-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="premium-section-eyebrow">广告概览</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{data.ad.adName}</h2>
            <p className="mt-2 text-sm text-muted">状态：{statusText(data.ad.status)} · 数据来源：Coupang Ads / 手动导入 / API同步兼容层</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdHealthBadge score={data.cards.find((card) => card.ad.id === data.ad.id)?.healthScore ?? 0} />
            <span className="rounded-full border border-line bg-[#f7f7f4] px-3 py-2 text-xs font-semibold text-muted">
              最后同步 {data.cards.find((card) => card.ad.id === data.ad.id)?.latestSyncLabel ?? "未同步"}
            </span>
          </div>
        </div>
      </section>

      <AdMetricsGrid items={buildAdMetricsGrid(data.summary)} />
      <AdTrendChart title="广告趋势分析" points={data.trend} metric={metric} onMetricChange={setMetric} />

      <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <AdSkuPerformanceTable rows={data.skuMetrics} />
        <div className="space-y-5">
          <div className="erp-card p-5">
            <SectionTitle eyebrow="诊断建议" title="广告诊断卡片" description="基于近 30 天表现自动标记预算方向、风险和优化动作。" />
            <div className="mt-5 grid gap-3">
              {data.recommendations.map((item) => (
                <AdRecommendationCard key={item.title} title={item.title} detail={item.detail} tone={item.tone} />
              ))}
            </div>
          </div>
          <AdDailyNotes notes={data.notes} notesCrud={data.notesCrud} adId={data.ad.id} compact />
        </div>
      </section>

      <AdDailyMetricsTable rows={data.filteredAdMetrics} />
    </div>
  );
}

function HeroHeader({
  title,
  subtitle,
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  leading
}: {
  title: string;
  subtitle: string;
  preset: AdvertisingPreset;
  onPresetChange: (value: AdvertisingPreset) => void;
  customRange: AdvertisingRange;
  onCustomRangeChange: (value: AdvertisingRange) => void;
  leading?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-[#d9ded6] bg-[#fbfaf6] px-6 py-7 shadow-[0_22px_70px_rgba(18,31,27,0.08)]">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/[0.04] blur-3xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          {leading}
          <div className="premium-section-eyebrow mt-0">Advertising Intelligence Center</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">{title}</h1>
          <p className="mt-3 text-base text-muted">{subtitle}</p>
        </div>
        <AdDateRangeFilter
          preset={preset}
          onPresetChange={onPresetChange}
          customRange={customRange}
          onCustomRangeChange={onCustomRangeChange}
        />
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <div className="premium-section-eyebrow">{eyebrow}</div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

export function AdDateRangeFilter({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange
}: {
  preset: AdvertisingPreset;
  onPresetChange: (value: AdvertisingPreset) => void;
  customRange: AdvertisingRange;
  onCustomRangeChange: (value: AdvertisingRange) => void;
}) {
  const options: Array<{ key: AdvertisingPreset; label: string }> = [
    { key: "today", label: "今日" },
    { key: "yesterday", label: "昨日" },
    { key: "last7", label: "近7天" },
    { key: "last30", label: "近30天" },
    { key: "thisMonth", label: "本月" },
    { key: "custom", label: "自定义日期" }
  ];

  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-white/90 p-4 shadow-soft">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarRange className="h-4 w-4" />
        日期筛选器
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onPresetChange(option.key)}
            className={`rounded-full px-3 py-2 text-xs font-semibold ${preset === option.key ? "bg-[#111827] text-white shadow-soft" : "border border-line bg-white text-muted"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="grid gap-2 md:grid-cols-2">
          <input type="date" value={customRange.start} onChange={(event) => onCustomRangeChange({ ...customRange, start: event.target.value })} />
          <input type="date" value={customRange.end} onChange={(event) => onCustomRangeChange({ ...customRange, end: event.target.value })} />
        </div>
      ) : null}
    </div>
  );
}

export function AdSummaryCards({
  items,
  loading
}: {
  items: Array<{ key: string; label: string; value: string; tone?: "default" | "good" | "warn" | "danger" }>;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-[22px] border border-line bg-white/65" />)}</div>;
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="premium-dashboard-card p-5">
          <div className="text-sm font-semibold text-muted">{item.label}</div>
          <div className="mt-3 premium-number text-3xl font-semibold tracking-tight text-ink">{item.value}</div>
          <div className={`mt-2 text-xs font-semibold ${toneClass(item.tone)}`}>{toneText(item.tone)}</div>
        </div>
      ))}
    </section>
  );
}

export function AdNameCard({ card }: { card: AdvertisingAdCard }) {
  const icon = card.trend === "up" ? TrendingUp : card.trend === "down" ? TrendingDown : ArrowRight;
  const TrendIcon = icon;

  return (
    <Link href={`/advertising/ads/${card.ad.id}`} className="premium-dashboard-card group flex h-full flex-col justify-between p-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Ad Object</div>
            <h3 className="mt-2 line-clamp-3 text-xl font-semibold leading-7 text-ink" title={card.ad.adName}>
              {card.ad.adName}
            </h3>
          </div>
          <AdHealthBadge score={card.healthScore} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <MetricMini label="今日广告费" value={formatCompactCurrency(card.today.adCost)} />
          <MetricMini label="今日销售额" value={formatCompactCurrency(card.today.adSales)} />
          <MetricMini label="今日 ROAS" value={formatPercent(card.today.roas)} />
          <MetricMini label="近7天 ROAS" value={formatPercent(card.last7.roas)} />
          <MetricMini label="CTR" value={formatPercent(card.last7.ctr)} />
          <MetricMini label="转化率" value={formatPercent(card.last7.conversionRate)} />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <TrendIcon className="h-4 w-4" />
          {statusText(card.ad.status)} · {card.latestSyncLabel}
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
          查看详情
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-[#fafaf9] px-3 py-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

export function AdHealthBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : score >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200";
  return <span className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-bold ${tone}`}>健康分 {score}</span>;
}

export function AdTrendChart({
  title,
  points,
  metric,
  onMetricChange
}: {
  title: string;
  points: Array<Record<string, string | number | null>>;
  metric: AdvertisingMetricKey;
  onMetricChange: (value: AdvertisingMetricKey) => void;
}) {
  const options = buildMetricChoices();
  return (
    <section className="erp-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionTitle eyebrow="趋势图" title={title} description="默认展示选定日期范围内的日趋势，可切换关键指标。" />
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onMetricChange(option.key)}
              className={`rounded-full px-3 py-2 text-xs font-semibold ${metric === option.key ? "bg-[#111827] text-white shadow-soft" : "border border-line bg-white text-muted"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points}>
            <defs>
              <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" stroke="#6b7280" tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7280" tickLine={false} axisLine={false} />
            <Tooltip content={<TrendTooltip metric={metric} />} />
            <Legend />
            <Area type="monotone" dataKey="adSales" name="广告销售额" stroke="#1d4ed8" fill="url(#salesArea)" strokeWidth={2.4} />
            <Line type="monotone" dataKey={metric} name={metricLabel(metric)} stroke="#111827" dot={false} strokeWidth={2.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function TrendTooltip({ active, payload, label, metric }: { active?: boolean; payload?: Array<{ value: number; payload: Record<string, number | string | null> }>; label?: string; metric: AdvertisingMetricKey }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-line bg-white/95 p-4 text-sm shadow-lift">
      <div className="font-semibold text-ink">{label}</div>
      <div className="mt-2 space-y-1 text-muted">
        <div>广告费：{formatCurrency(Number(point.adCost ?? 0))}</div>
        <div>广告销售额：{formatCurrency(Number(point.adSales ?? 0))}</div>
        <div>{metricLabel(metric)}：{metricFormat(metric, point[metric] as number | null)}</div>
      </div>
    </div>
  );
}

export function AdMetricsGrid({ items }: { items: ReadonlyArray<{ label: string; value: number | null; kind: "currency" | "count" | "percent" }> }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="premium-dashboard-card p-5">
          <div className="text-sm font-semibold text-muted">{item.label}</div>
          <div className="mt-3 premium-number text-3xl font-semibold tracking-tight text-ink">{formatByKind(item.value, item.kind)}</div>
        </div>
      ))}
    </section>
  );
}

export function AdDailyMetricsTable({ rows, showAdColumn = false }: { rows: AdvertisingDailyMetric[]; showAdColumn?: boolean }) {
  return (
    <section className="erp-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-[#fafaf9] px-5 py-4">
        <div>
          <div className="premium-section-eyebrow">日报表</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">广告日报中心</h2>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft">
          <Download className="h-4 w-4" />
          导出报表
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1280px] w-full text-left text-sm">
          <thead className="bg-white text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-4 py-3">日期</th>
              {showAdColumn ? <th className="px-4 py-3">广告名称</th> : null}
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">商品名称</th>
              <th className="px-4 py-3 text-right">广告费</th>
              <th className="px-4 py-3 text-right">广告销售额</th>
              <th className="px-4 py-3 text-right">曝光数</th>
              <th className="px-4 py-3 text-right">点击数</th>
              <th className="px-4 py-3 text-right">CTR</th>
              <th className="px-4 py-3 text-right">转化率</th>
              <th className="px-4 py-3 text-right">订单数</th>
              <th className="px-4 py-3 text-right">ROAS</th>
              <th className="px-4 py-3">备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="premium-table-row border-t border-line/70">
                  <td className="px-4 py-3">{row.date}</td>
                  {showAdColumn ? (
                    <td className="px-4 py-3">
                      <Link href={`/advertising/ads/${row.adId}`} className="font-semibold text-ink hover:text-[#1d4ed8]">
                        {CORE_ADS.find((ad) => ad.id === row.adId)?.adName ?? row.adId}
                      </Link>
                    </td>
                  ) : null}
                  <td className="px-4 py-3">{row.rawPayload?.sku ?? "-"}</td>
                  <td className="px-4 py-3">{row.rawPayload?.product_name ?? "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.adCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.adSales)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCount(row.impressions)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCount(row.clicks)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.ctr)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.conversionRate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCount(row.adConversionOrderCount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.roas)}</td>
                  <td className="px-4 py-3 text-muted">{row.remark ?? "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showAdColumn ? 13 : 12} className="px-4 py-12 text-center text-sm text-muted">
                  暂无广告数据，请先导入 Coupang Ads 数据，或检查当前日期范围。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdSkuPerformanceTable({ rows, showAdColumn = false }: { rows: AdvertisingSkuMetric[]; showAdColumn?: boolean }) {
  return (
    <section className="erp-card overflow-hidden">
      <div className="border-b border-line bg-[#fafaf9] px-5 py-4">
        <div className="premium-section-eyebrow">SKU表现</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">广告 SKU 分析</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-white text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              {showAdColumn ? <th className="px-4 py-3">广告名称</th> : null}
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">商品名称</th>
              <th className="px-4 py-3 text-right">广告费</th>
              <th className="px-4 py-3 text-right">广告销售额</th>
              <th className="px-4 py-3 text-right">ROAS</th>
              <th className="px-4 py-3 text-right">点击数</th>
              <th className="px-4 py-3 text-right">曝光数</th>
              <th className="px-4 py-3 text-right">CTR</th>
              <th className="px-4 py-3 text-right">转化率</th>
              <th className="px-4 py-3 text-right">广告后利润</th>
              <th className="px-4 py-3">建议动作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.adId}-${row.skuCode}`} className="premium-table-row border-t border-line/70">
                  {showAdColumn ? (
                    <td className="px-4 py-3">
                      <Link href={`/advertising/ads/${row.adId}`} className="font-semibold text-ink hover:text-[#1d4ed8]">
                        {CORE_ADS.find((ad) => ad.id === row.adId)?.adName ?? row.adId}
                      </Link>
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-semibold text-ink">{row.skuCode}</td>
                  <td className="px-4 py-3">{row.productNameCn}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.adCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.adSales)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.roas)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCount(row.clicks)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCount(row.impressions)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.ctr)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.conversionRate)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.profitAfterAds >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(row.profitAfterAds)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-line bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-ink">{row.suggestion}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showAdColumn ? 12 : 11} className="px-4 py-12 text-center text-sm text-muted">
                  当前广告范围暂无 SKU 数据。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdRankingPanel({
  title,
  items,
  formatter
}: {
  title: string;
  items: Array<{ adId: string; adName: string; value: number | null; secondary: string }>;
  formatter: (value: number | null) => string;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-white p-4 shadow-soft">
      <div className="text-sm font-semibold text-muted">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <Link key={`${item.adId}-${title}`} href={`/advertising/ads/${item.adId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-[#fafaf9] px-3 py-3 transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">#{index + 1}</div>
                <div className="mt-1 truncate text-sm font-semibold text-ink" title={item.adName}>{item.adName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-ink">{formatter(item.value)}</div>
                <div className="text-xs text-muted">{item.secondary}</div>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">暂无可用排行数据</div>
        )}
      </div>
    </div>
  );
}

const emptyNoteForm = (adId?: string): AdvertisingDailyNoteInput => ({
  adId: adId ?? CORE_ADS[0].id,
  date: todayKst(),
  operator: "ERP Operator",
  observation: "",
  actionTaken: "",
  budgetChange: "",
  bidChange: "",
  skuChange: "",
  issue: "",
  nextPlan: ""
});

export function AdDailyNotes({
  notes,
  notesCrud,
  adId,
  compact = false
}: {
  notes: AdvertisingDailyNote[];
  notesCrud?: {
    loading: boolean;
    error: string | null;
    createNote: (input: AdvertisingDailyNoteInput) => Promise<{ ok: boolean; error: string | null }>;
    updateNote: (id: string, input: AdvertisingDailyNoteInput) => Promise<{ ok: boolean; error: string | null }>;
    deleteNote: (id: string) => Promise<{ ok: boolean; error: string | null }>;
  };
  adId?: string;
  compact?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<AdvertisingDailyNoteInput>(emptyNoteForm(adId));

  const filteredNotes = useMemo(() => (adId ? notes.filter((note) => note.adId === adId) : notes), [adId, notes]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyNoteForm(adId));
    setFormError(null);
    setShowForm(true);
  }

  function startEdit(note: AdvertisingDailyNote) {
    setEditingId(note.id);
    setForm({
      adId: note.adId,
      date: note.date,
      operator: note.operator,
      observation: note.observation,
      actionTaken: note.actionTaken,
      budgetChange: note.budgetChange ?? "",
      bidChange: note.bidChange ?? "",
      skuChange: note.skuChange ?? "",
      issue: note.issue,
      nextPlan: note.nextPlan
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notesCrud) return;
    setSaving(true);
    const result = editingId ? await notesCrud.updateNote(editingId, form) : await notesCrud.createNote(form);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyNoteForm(adId));
    setFormError(null);
  }

  async function handleDelete(id: string) {
    if (!notesCrud) return;
    if (!window.confirm("确定删除这条广告日报记录吗？")) return;
    const result = await notesCrud.deleteNote(id);
    if (!result.ok) {
      setFormError(result.error);
    }
  }

  return (
    <section className="erp-card p-5">
      <SectionTitle eyebrow="运营日志" title="广告日报记录" description="把原本散乱的日报，统一绑定到广告名称之下。" />
      {notesCrud ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={startCreate} className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            新增日报
          </button>
          {notesCrud.error ? <div className="text-sm text-red-700">日志表暂不可用：{notesCrud.error}</div> : null}
        </div>
      ) : null}
      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-5 rounded-[24px] border border-line bg-[#fafaf9] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            {!adId ? (
              <label className="grid gap-1.5 text-xs font-bold text-muted">
                广告名称
                <select value={form.adId} onChange={(event) => setForm({ ...form, adId: event.target.value })}>
                  {CORE_ADS.map((ad) => (
                    <option key={ad.id} value={ad.id}>
                      {ad.adName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              日期
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              运营人员
              <input value={form.operator} onChange={(event) => setForm({ ...form, operator: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              预算调整
              <input value={form.budgetChange} onChange={(event) => setForm({ ...form, budgetChange: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              出价调整
              <input value={form.bidChange} onChange={(event) => setForm({ ...form, bidChange: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              SKU调整
              <input value={form.skuChange} onChange={(event) => setForm({ ...form, skuChange: event.target.value })} />
            </label>
          </div>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              今日观察
              <textarea rows={3} value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              调整动作
              <textarea rows={2} value={form.actionTaken} onChange={(event) => setForm({ ...form, actionTaken: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              问题记录
              <textarea rows={2} value={form.issue} onChange={(event) => setForm({ ...form, issue: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              明日计划
              <textarea rows={2} value={form.nextPlan} onChange={(event) => setForm({ ...form, nextPlan: event.target.value })} />
            </label>
          </div>
          {formError ? <div className="mt-3 text-sm text-red-700">{formError}</div> : null}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="erp-button-primary px-4 py-2 text-sm font-semibold">
              {saving ? "保存中..." : editingId ? "保存修改" : "创建日报"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyNoteForm(adId));
                setFormError(null);
              }}
              className="erp-button-subtle px-4 py-2 text-sm font-semibold"
            >
              取消
            </button>
          </div>
        </form>
      ) : null}
      <div className={`mt-5 grid gap-3 ${compact ? "" : "xl:grid-cols-2"}`}>
        {filteredNotes.length ? (
          filteredNotes.map((note) => (
            <div key={note.id} className="rounded-[22px] border border-line bg-[#fafaf9] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{note.date}</div>
                  {!adId ? (
                    <div className="mt-1 text-xs text-muted">
                      {CORE_ADS.find((ad) => ad.id === note.adId)?.adName ?? note.adId}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-muted">{note.operator}</div>
                  {notesCrud ? (
                    <>
                      <button type="button" onClick={() => startEdit(note)} className="rounded-full border border-line bg-white p-2 text-muted">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(note.id)} className="rounded-full border border-line bg-white p-2 text-muted">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 text-sm font-semibold text-ink">今日观察</div>
              <p className="mt-1 text-sm leading-6 text-muted">{note.observation}</p>
              {note.actionTaken ? (
                <>
                  <div className="mt-3 text-sm font-semibold text-ink">调整动作</div>
                  <p className="mt-1 text-sm leading-6 text-muted">{note.actionTaken}</p>
                </>
              ) : null}
              <div className="mt-3 text-sm font-semibold text-ink">问题记录</div>
              <p className="mt-1 text-sm leading-6 text-muted">{note.issue}</p>
              <div className="mt-3 text-sm font-semibold text-ink">明日计划</div>
              <p className="mt-1 text-sm leading-6 text-muted">{note.nextPlan}</p>
              {(note.budgetChange || note.bidChange || note.skuChange) ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                  {note.budgetChange ? <span className="rounded-full border border-line bg-white px-3 py-1">预算 {note.budgetChange}</span> : null}
                  {note.bidChange ? <span className="rounded-full border border-line bg-white px-3 py-1">出价 {note.bidChange}</span> : null}
                  {note.skuChange ? <span className="rounded-full border border-line bg-white px-3 py-1">SKU {note.skuChange}</span> : null}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
            暂无广告日报记录。
          </div>
        )}
      </div>
    </section>
  );
}

export function AdRecommendationCard({ title, detail, tone }: AdvertisingRecommendation) {
  const toneMap = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-yellow-50 text-yellow-700 border-yellow-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-slate-50 text-slate-700 border-line"
  } as const;
  const icon = tone === "good" ? Sparkles : tone === "warn" ? BadgeAlert : tone === "danger" ? AlertTriangle : Radar;
  const Icon = icon;

  return (
    <div className={`rounded-[22px] border p-4 ${toneMap[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-1 text-sm leading-6">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export function AdImportMapping() {
  const rows = [
    ["광고비", "ad_cost"],
    ["광고 전환 매출", "ad_sales"],
    ["노출수", "impressions"],
    ["클릭수", "clicks"],
    ["클릭률", "ctr"],
    ["광고 전환 판매수", "ad_conversion_sales_count"],
    ["광고 전환 주문수", "ad_conversion_order_count"],
    ["광고수익률", "roas"],
    ["전환율", "conversion_rate"]
  ];

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr,0.95fr]">
      <div className="erp-card p-5">
        <SectionTitle eyebrow="数据导入" title="数据导入与同步" description="第一阶段先完成导入映射规范，后续即可接 CSV / Excel / API。" />
        <div className="mt-5 rounded-[24px] border border-dashed border-line bg-[#fafaf9] p-6">
          <div className="text-sm font-semibold text-ink">支持内容</div>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>上传 CSV / Excel</li>
            <li>映射韩文字段到标准广告指标</li>
            <li>选择广告名称并导入预览</li>
            <li>识别重复的同日同广告数据并跳过</li>
          </ul>
        </div>
      </div>
      <div className="erp-card overflow-hidden">
        <div className="border-b border-line bg-[#fafaf9] px-5 py-4">
          <div className="premium-section-eyebrow">Mapping</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Coupang 字段映射</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-white text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-4 py-3">原字段</th>
              <th className="px-4 py-3">标准字段</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([source, target]) => (
              <tr key={source} className="border-t border-line/70">
                <td className="px-4 py-3 font-semibold text-ink">{source}</td>
                <td className="px-4 py-3 text-muted">{target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankingsPage({ cards }: { cards: AdvertisingAdCard[] }) {
  const panels = [
    { title: "ROAS排行榜", items: [...cards].sort((a, b) => Number(b.last30.roas ?? 0) - Number(a.last30.roas ?? 0)), formatter: (card: AdvertisingAdCard) => formatPercent(card.last30.roas) },
    { title: "销售额排行榜", items: [...cards].sort((a, b) => b.last30.adSales - a.last30.adSales), formatter: (card: AdvertisingAdCard) => formatCurrency(card.last30.adSales) },
    { title: "广告费排行榜", items: [...cards].sort((a, b) => b.last30.adCost - a.last30.adCost), formatter: (card: AdvertisingAdCard) => formatCurrency(card.last30.adCost) },
    { title: "CTR排行榜", items: [...cards].sort((a, b) => Number(b.last30.ctr ?? 0) - Number(a.last30.ctr ?? 0)), formatter: (card: AdvertisingAdCard) => formatPercent(card.last30.ctr) }
  ];

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      {panels.map((panel) => (
        <div key={panel.title} className="erp-card p-5">
          <SectionTitle eyebrow="广告排行" title={panel.title} description="所有广告名称都可以点击进入对应广告详情页。" />
          <div className="mt-5 space-y-3">
            {panel.items.map((card, index) => (
              <Link key={card.ad.id} href={`/advertising/ads/${card.ad.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-[#fafaf9] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">#{index + 1}</div>
                  <div className="mt-1 font-semibold text-ink">{card.ad.adName}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-ink">{panel.formatter(card)}</div>
                  <div className="text-xs text-muted">健康分 {card.healthScore}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function RulesPage() {
  const rules = [
    "ROAS 高于目标值，建议适当提高预算",
    "ROAS 高但点击少，建议提升曝光",
    "点击高转化低，检查商品页、价格、评论和主图",
    "花费高且 ROAS 低，建议降低预算或暂停",
    "曝光高 CTR 低，建议优化主图和标题"
  ];

  return (
    <section className="erp-card p-5">
      <SectionTitle eyebrow="规则中心" title="广告规则设置" description="当前版本先把规则清晰展示出来，后续可以直接接入 `ad_rules` 配置表。" />
      <div className="mt-5 grid gap-3">
        {rules.map((rule) => (
          <div key={rule} className="rounded-2xl border border-line bg-[#fafaf9] px-4 py-4 text-sm text-ink">
            {rule}
          </div>
        ))}
      </div>
    </section>
  );
}

function statusText(status: string) {
  if (status === "running") return "运行中";
  if (status === "paused") return "暂停";
  if (status === "warning") return "观察中";
  return "未同步";
}

function metricLabel(metric: AdvertisingMetricKey) {
  return buildMetricChoices().find((item) => item.key === metric)?.label ?? metric;
}

function metricFormat(metric: AdvertisingMetricKey, value: number | null) {
  if (metric === "adCost" || metric === "adSales") return formatCurrency(value);
  if (metric === "clicks" || metric === "impressions") return formatCount(value);
  return formatPercent(value);
}

function formatByKind(value: number | null, kind: "currency" | "count" | "percent") {
  if (kind === "currency") return formatCurrency(value);
  if (kind === "count") return formatCount(value);
  return formatPercent(value);
}

function toneClass(tone?: "default" | "good" | "warn" | "danger") {
  if (tone === "good") return "text-emerald-700";
  if (tone === "warn") return "text-yellow-700";
  if (tone === "danger") return "text-red-700";
  return "text-muted";
}

function toneText(tone?: "default" | "good" | "warn" | "danger") {
  if (tone === "good") return "表现稳定";
  if (tone === "warn") return "建议观察";
  if (tone === "danger") return "需重点处理";
  return "持续监控";
}
