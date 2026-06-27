"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Download,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  todayKst
} from "@/lib/advertising";
import type {
  AdvertisingAdCard,
  AdvertisingDailyMetric,
  AdvertisingDailyNote,
  AdvertisingDailyNoteInput,
  AdvertisingDailyRecordInput,
  AdvertisingMetricKey,
  AdvertisingPreset,
  AdvertisingRange,
  AdvertisingRecommendation,
  AdvertisingSkuMetric
} from "@/lib/advertising-types";

type DashboardMode = "overview" | "daily" | "sku" | "rankings" | "notes" | "import" | "rules";

export function AdvertisingDashboard({ mode = "overview" }: { mode?: DashboardMode }) {
  const [preset, setPreset] = useState<AdvertisingPreset>("thisMonth");
  const [customRange, setCustomRange] = useState<AdvertisingRange>({ start: todayKst(), end: todayKst() });
  const [metric, setMetric] = useState<AdvertisingMetricKey>("adSales");
  const data = useAdvertisingData(preset, customRange);

  const dailyRows = useMemo(() => buildGlobalDailyRows(data.filteredMetrics), [data.filteredMetrics]);
  const skuRows = useMemo(() => buildGlobalSkuRows(data.filteredMetrics), [data.filteredMetrics]);
  const notes = useMemo(() => (data.notesCrud.notes.length ? data.notesCrud.notes : buildGlobalNotes(data.metrics)), [data.metrics, data.notesCrud.notes]);

  return (
    <div className="space-y-6">
      <HeroHeader
        title="广告智能中心"
        subtitle="围绕广告名称统一查看 Coupang 广告花费、销售表现、SKU贡献、ROAS趋势与每日运营动作。"
        preset={preset}
        onPresetChange={setPreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {mode === "overview" ? (
        <>
          <AdSummaryCards items={data.overviewKpis} loading={data.loading} />
          <AdImportWorkspace recordsCrud={data.recordsCrud} />
          <section className="grid gap-5 xl:grid-cols-[1.45fr,0.85fr]">
            <div className="erp-card p-6">
              <SectionTitle
                eyebrow="核心广告"
                title="广告名称第一入口"
                description="广告名称是第一入口。点击任意广告卡片，即可进入该广告的独立经营中心。"
              />
              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                {data.cards.map((card) => (
                  <AdNameCard key={card.ad.id} card={card} />
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <div className="erp-card p-6">
                <SectionTitle eyebrow="辅助分析" title="排行榜与提醒" description="排行榜用于快速定位问题和机会，但不会替代广告名称作为主入口。" />
                <div className="mt-5 space-y-4">
                  <AdRankingPanel title="本月 ROAS 最高广告" items={data.rankings.roas.slice(0, 3)} formatter={(value) => formatPercent(value)} />
                  <AdRankingPanel
                    title="需要重点优化的广告"
                    items={data.cards
                      .filter((card) => card.healthScore < 60)
                      .map((card) => ({ adId: card.ad.id, adName: card.ad.adName, value: card.healthScore, secondary: `健康分 ${card.healthScore}` }))}
                    formatter={(value) => `${Math.round(value ?? 0)}`}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.45fr,0.85fr]">
            <AdTrendChart title="整体趋势总览" points={data.trend} metric={metric} onMetricChange={setMetric} />
            <div className="erp-card p-6">
              <SectionTitle eyebrow="经营建议" title="本月洞察" description="基于当前筛选范围自动生成预算、素材与转化层面的经营建议。" />
              <div className="mt-5 grid gap-3">
                <AdRecommendationCard
                  title="预算方向"
                  detail={(data.overview.roas ?? 0) >= 300 ? "整体 ROAS 已进入可放量区间，建议优先提升健康分较高广告的预算。" : "整体 ROAS 仍有提升空间，建议优先检查 CTR 与转化率。"}
                  tone={(data.overview.roas ?? 0) >= 300 ? "good" : "warn"}
                />
                <AdRecommendationCard
                  title="异常提醒"
                  detail={data.cards.some((card) => card.healthScore < 60) ? "存在健康分较低的广告，建议优先检查低 ROAS 广告的素材、标题与详情页。" : "当前没有明显异常广告，继续观察近 3 天的走势变化。"}
                  tone={data.cards.some((card) => card.healthScore < 60) ? "danger" : "neutral"}
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
      {mode === "import" ? <AdImportWorkspace recordsCrud={data.recordsCrud} /> : null}
      {mode === "rules" ? <RulesPage /> : null}
    </div>
  );
}

export function AdvertisingDetailPage({ adId }: { adId: string }) {
  const [preset, setPreset] = useState<AdvertisingPreset>("thisMonth");
  const [customRange, setCustomRange] = useState<AdvertisingRange>({ start: todayKst(), end: todayKst() });
  const [metric, setMetric] = useState<AdvertisingMetricKey>("adSales");
  const data = useAdvertisingAdDetail(adId, preset, customRange);

  return (
    <div className="space-y-6">
      <HeroHeader
        title={`广告详情：${data.ad.adName}`}
        subtitle="查看当前广告在选定日期内的 KPI、趋势图、日报明细、SKU表现与每日运营记录。"
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

      <section className="erp-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="premium-section-eyebrow">广告概览</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{data.ad.adName}</h2>
            <p className="mt-2 text-sm text-muted">状态：{statusText(data.ad.status)} · 数据来源：{data.cards.find((card) => card.ad.id === data.ad.id)?.source === "seed" ? "演示数据" : "广告日报兼容层"}</p>
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
          <div className="erp-card p-6">
            <SectionTitle eyebrow="诊断建议" title="广告诊断卡片" description="基于当前广告的实际表现，自动生成预算、素材和转化层面的优化建议。" />
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
          <div className="premium-section-eyebrow mt-0">广告智能中心</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">{title}</h1>
          <p className="mt-3 text-base text-muted">{subtitle}</p>
        </div>
        <AdDateRangeFilter preset={preset} onPresetChange={onPresetChange} customRange={customRange} onCustomRangeChange={onCustomRangeChange} />
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <div className="premium-section-eyebrow">{eyebrow}</div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
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
    { key: "custom", label: "自定义" }
  ];

  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-white/90 p-4 shadow-soft">
      <div className="text-sm font-semibold text-ink">日期筛选</div>
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
  const TrendIcon = card.trend === "up" ? TrendingUp : card.trend === "down" ? TrendingDown : ChevronRight;
  const statusTone =
    card.ad.status === "running"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : card.ad.status === "warning"
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <Link href={`/advertising/ads/${card.ad.id}`} className="premium-dashboard-card premium-ad-card group flex h-full flex-col justify-between p-5">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">广告对象</span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}>{statusText(card.ad.status)}</span>
            </div>
            <h3 className="mt-3 text-[24px] font-semibold leading-8 tracking-[-0.03em] text-ink" title={card.ad.adName}>
              <span className="line-clamp-2 break-keep">{card.ad.adName}</span>
            </h3>
            <p className="mt-2 line-clamp-1 text-sm text-muted">{card.ad.note ?? "以广告名称为入口，查看该广告的独立经营表现。"}</p>
          </div>
          <AdHealthBadge score={card.healthScore} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricMini label="今日花费" value={formatCompactCurrency(card.today.adCost)} tone="strong" />
          <MetricMini label="昨日花费" value={formatCompactCurrency(card.yesterday.adCost)} />
          <MetricMini label="近7天销售额" value={formatCompactCurrency(card.last7.adSales)} tone="strong" />
          <MetricMini label="本月销售额" value={formatCompactCurrency(card.thisMonth.adSales)} />
        </div>

        <div className="rounded-[20px] border border-line bg-[#f8fafc] p-3">
          <div className="grid grid-cols-4 gap-2">
            <MetricStrip label="近7天 ROAS" value={formatPercent(card.last7.roas)} />
            <MetricStrip label="本月 ROAS" value={formatPercent(card.thisMonth.roas)} />
            <MetricStrip label="CTR" value={formatPercent(card.thisMonth.ctr)} />
            <MetricStrip label="转化率" value={formatPercent(card.thisMonth.conversionRate)} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line/70 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <TrendIcon className="h-4 w-4" />
          最近同步 {card.latestSyncLabel}
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
          查看详情
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function MetricMini({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "strong" }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${tone === "strong" ? "border-[#dbe6ff] bg-[#f3f7ff]" : "border-line bg-[#fafaf9]"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function MetricStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
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
    <section className="erp-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionTitle eyebrow="趋势图" title={title} description="按广告名称、日期范围与核心指标查看趋势变化。" />
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
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.2} />
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

function TrendTooltip({
  active,
  payload,
  label,
  metric
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, number | string | null> }>;
  label?: string;
  metric: AdvertisingMetricKey;
}) {
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
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">广告日报明细</h2>
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
                  暂无广告数据。请先导入 Coupang Ads 数据，或检查当前日期范围。
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
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">广告 SKU 表现</h2>
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
                  当前范围暂无 SKU 数据。
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
          <div className="rounded-2xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">暂无可用排行数据。</div>
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
    if (!result.ok) setFormError(result.error);
  }

  return (
    <section className="erp-card p-6">
      <SectionTitle eyebrow="运营日志" title="广告日报记录" description="把原本散乱的日报统一绑定到广告名称之下，便于持续追踪每一次预算、出价和 SKU 调整。" />
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
                    <option key={ad.id} value={ad.id}>{ad.adName}</option>
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
              SKU 调整
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
                  {!adId ? <div className="mt-1 text-xs text-muted">{CORE_ADS.find((ad) => ad.id === note.adId)?.adName ?? note.adId}</div> : null}
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
              <NoteBlock title="今日观察" content={note.observation} />
              <NoteBlock title="调整动作" content={note.actionTaken} />
              <NoteBlock title="问题记录" content={note.issue} />
              <NoteBlock title="明日计划" content={note.nextPlan} />
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
          <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">暂无广告日报记录。</div>
        )}
      </div>
    </section>
  );
}

function NoteBlock({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <>
      <div className="mt-3 text-sm font-semibold text-ink">{title}</div>
      <p className="mt-1 text-sm leading-6 text-muted">{content}</p>
    </>
  );
}

export function AdRecommendationCard({ title, detail, tone }: AdvertisingRecommendation) {
  const toneMap = {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-yellow-50 text-yellow-700 border-yellow-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-slate-50 text-slate-700 border-line"
  } as const;

  return (
    <div className={`rounded-[22px] border p-4 ${toneMap[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70">
          {tone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </span>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-1 text-sm leading-6">{detail}</p>
        </div>
      </div>
    </div>
  );
}

const emptyDailyRecordForm = (): AdvertisingDailyRecordInput => ({
  adId: CORE_ADS[0]?.id ?? "",
  date: todayKst(),
  adCost: 0,
  adSales: 0,
  impressions: 0,
  clicks: 0,
  ctr: 0,
  adConversionSalesCount: 0,
  adConversionOrderCount: 0,
  roas: 0,
  conversionRate: 0,
  remark: ""
});

export function AdImportWorkspace({
  recordsCrud
}: {
  recordsCrud: {
    storedMetrics: AdvertisingDailyMetric[];
    loading: boolean;
    saving: boolean;
    error: string | null;
    saveRecord: (input: AdvertisingDailyRecordInput) => Promise<{ ok: boolean; error: string | null }>;
    deleteRecord: (id: string) => Promise<{ ok: boolean; error: string | null }>;
  };
}) {
  const [form, setForm] = useState<AdvertisingDailyRecordInput>(emptyDailyRecordForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const savedRows = useMemo(
    () => [...recordsCrud.storedMetrics].sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)),
    [recordsCrud.storedMetrics]
  );
  const totalPages = Math.max(1, Math.ceil(savedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return savedRows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, savedRows]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyDailyRecordForm());
    setFormError(null);
  }

  function updateNumber(key: keyof AdvertisingDailyRecordInput, value: string) {
    setForm((current) => ({ ...current, [key]: Number(value || 0) }));
  }

  function startEdit(row: AdvertisingDailyMetric) {
    setEditingId(row.id);
    setForm({
      adId: row.adId,
      date: row.date,
      adCost: row.adCost,
      adSales: row.adSales,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Number(row.ctr ?? 0),
      adConversionSalesCount: row.adConversionSalesCount,
      adConversionOrderCount: row.adConversionOrderCount,
      roas: Number(row.roas ?? 0),
      conversionRate: Number(row.conversionRate ?? 0),
      remark: row.remark ?? ""
    });
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await recordsCrud.saveRecord(form);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setCurrentPage(1);
    resetForm();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这条广告日报记录吗？")) return;
    const result = await recordsCrud.deleteRecord(id);
    if (!result.ok) setFormError(result.error);
  }

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[1.05fr,0.95fr]">
      <div className="erp-card self-start p-6">
        <SectionTitle eyebrow="每日录入" title="每日广告数据录入" description="每天直接在 ERP 中填写广告日报。系统会按日期和广告名称自动覆盖同一条记录。" />
        <div className="mt-5 rounded-[24px] border border-dashed border-line bg-[#fafaf9] px-4 py-4 text-sm leading-7 text-muted">
          同一天 + 同一个广告名称只能保留一条记录。再次保存时，系统会自动更新这条日报，首页、趋势图和排行榜会继续共用这份数据。
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              日期
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
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
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              广告费
              <input type="number" min="0" step="0.01" value={form.adCost} onChange={(event) => updateNumber("adCost", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              广告转化销售额
              <input type="number" min="0" step="0.01" value={form.adSales} onChange={(event) => updateNumber("adSales", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              曝光数
              <input type="number" min="0" step="1" value={form.impressions} onChange={(event) => updateNumber("impressions", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              点击数
              <input type="number" min="0" step="1" value={form.clicks} onChange={(event) => updateNumber("clicks", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              点击率
              <input type="number" min="0" step="0.01" value={form.ctr} onChange={(event) => updateNumber("ctr", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              广告转化销售数量
              <input type="number" min="0" step="1" value={form.adConversionSalesCount} onChange={(event) => updateNumber("adConversionSalesCount", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              广告转化订单数
              <input type="number" min="0" step="1" value={form.adConversionOrderCount} onChange={(event) => updateNumber("adConversionOrderCount", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              ROAS
              <input type="number" min="0" step="0.01" value={form.roas} onChange={(event) => updateNumber("roas", event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-muted">
              转化率
              <input type="number" min="0" step="0.01" value={form.conversionRate} onChange={(event) => updateNumber("conversionRate", event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-bold text-muted">
            备注
            <textarea rows={3} value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} />
          </label>
          {formError ? <div className="text-sm text-red-700">{formError}</div> : null}
          {recordsCrud.error ? <div className="text-sm text-red-700">数据表暂不可用：{recordsCrud.error}</div> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={recordsCrud.saving} className="erp-button-primary px-4 py-2 text-sm font-semibold">
              {recordsCrud.saving ? "保存中..." : editingId ? "更新日报" : "保存日报"}
            </button>
            <button type="button" onClick={resetForm} className="erp-button-subtle px-4 py-2 text-sm font-semibold">
              {editingId ? "取消编辑" : "清空表单"}
            </button>
          </div>
        </form>
      </div>
      <div className="erp-card self-start overflow-hidden">
        <div className="border-b border-line bg-[#fafaf9] px-5 py-4">
          <div className="premium-section-eyebrow">今日记录</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">已录入广告日报</h2>
          <p className="mt-2 text-sm text-muted">你可以随时回头编辑或删除当天记录，不需要重新导入文件。</p>
        </div>
        <div className="divide-y divide-line/70">
          {recordsCrud.loading ? (
            <div className="px-5 py-10 text-sm text-muted">正在加载广告日报...</div>
          ) : savedRows.length ? (
            paginatedRows.map((row) => (
              <div key={row.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{CORE_ADS.find((ad) => ad.id === row.adId)?.adName ?? row.adId}</div>
                    <div className="mt-1 text-xs text-muted">
                      {row.date} · 广告费 {formatCurrency(row.adCost)} · 广告销售额 {formatCurrency(row.adSales)}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted md:grid-cols-2">
                      <div>曝光数 {formatCount(row.impressions)}</div>
                      <div>点击数 {formatCount(row.clicks)}</div>
                      <div>ROAS {formatPercent(row.roas)}</div>
                      <div>转化率 {formatPercent(row.conversionRate)}</div>
                    </div>
                    {row.remark ? <p className="mt-3 text-sm leading-6 text-muted">{row.remark}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => startEdit(row)} className="rounded-full border border-line bg-white p-2 text-muted">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(row.id)} className="rounded-full border border-line bg-white p-2 text-muted">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-10 text-sm text-muted">当前还没有手动录入的广告日报记录。</div>
          )}
        </div>
        {savedRows.length > pageSize ? (
          <div className="flex items-center justify-between border-t border-line bg-[#fafaf9] px-5 py-4">
            <div className="text-sm text-muted">
              第 {currentPage} / {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="erp-button-subtle px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="erp-button-subtle px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
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
      <div className="erp-card p-6">
      <SectionTitle eyebrow="导入计划" title="数据导入与同步" description="支持 CSV / Excel / API 的统一字段映射，后续可以直接接入真实 Coupang Ads 数据流。" />
        <div className="mt-5 rounded-[24px] border border-dashed border-line bg-[#fafaf9] p-6 text-sm leading-7 text-muted">
          当前阶段已经完成映射规范、广告对象结构和数据容错层。下一步可以直接接入上传预览、字段映射与重复校验流程。
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
    { title: "本月 ROAS 排行榜", items: [...cards].sort((a, b) => Number(b.thisMonth.roas ?? 0) - Number(a.thisMonth.roas ?? 0)), formatter: (card: AdvertisingAdCard) => formatPercent(card.thisMonth.roas) },
    { title: "本月销售额排行榜", items: [...cards].sort((a, b) => b.thisMonth.adSales - a.thisMonth.adSales), formatter: (card: AdvertisingAdCard) => formatCurrency(card.thisMonth.adSales) },
    { title: "本月广告费排行榜", items: [...cards].sort((a, b) => b.thisMonth.adCost - a.thisMonth.adCost), formatter: (card: AdvertisingAdCard) => formatCurrency(card.thisMonth.adCost) },
    { title: "本月 CTR 排行榜", items: [...cards].sort((a, b) => Number(b.thisMonth.ctr ?? 0) - Number(a.thisMonth.ctr ?? 0)), formatter: (card: AdvertisingAdCard) => formatPercent(card.thisMonth.ctr) }
  ];

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      {panels.map((panel) => (
        <div key={panel.title} className="erp-card p-6">
          <SectionTitle eyebrow="广告排行" title={panel.title} description="所有广告名称都支持直接点击进入对应的广告详情页。" />
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
    "ROAS 高于目标值：建议适当提高预算",
    "ROAS 高但点击少：建议提升曝光",
    "点击高转化低：检查商品页、价格、评论和主图",
    "花费高且 ROAS 低：建议降低预算或暂停",
    "曝光高 CTR 低：建议优化主图和标题"
  ];

  return (
    <section className="erp-card p-6">
      <SectionTitle eyebrow="规则中心" title="广告规则设置" description="先把规则逻辑清晰沉淀下来，后续可以直接接入 ad_rules 配置表做动态管理。" />
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

