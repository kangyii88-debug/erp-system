"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  Edit3,
  MousePointerClick,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type DatePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";
type TrendWindow = "7d" | "30d" | "90d" | "year";
type RankingMetric = "roas" | "ctr" | "conversion_rate" | "ad_profit" | "ad_sales";
type SortKey = "sku" | "product_name" | "ad_spend" | "ad_sales" | "roas" | "ctr" | "conversion_rate" | "ad_order_count" | "ad_sales_count" | "ad_profit";

type DailyAdRecord = {
  id: string;
  user_id: string;
  record_date: string;
  campaign_name: string;
  sku: string;
  product_name: string;
  ad_spend: number;
  ad_sales: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  ad_sales_count: number;
  ad_order_count: number;
  roas: number | null;
  conversion_rate: number | null;
  remark: string | null;
  created_at: string;
  updated_at?: string | null;
};

type FormState = {
  record_date: string;
  campaign_name: string;
  sku: string;
  product_name: string;
  ad_spend: string;
  ad_sales: string;
  impressions: string;
  clicks: string;
  ctr: string;
  ad_sales_count: string;
  ad_order_count: string;
  conversion_rate: string;
  remark: string;
};

type Metrics = {
  ad_spend: number;
  ad_sales: number;
  roas: number;
  ctr: number;
  conversion_rate: number;
  ad_order_count: number;
  ad_sales_count: number;
  ad_profit: number;
  cost_ratio: number;
  impressions: number;
  clicks: number;
};

type SkuAgg = Metrics & {
  sku: string;
  product_name: string;
  record_count: number;
  status: "scale" | "keep" | "reduce" | "pause";
};

const emptyForm: FormState = {
  record_date: todayKst(),
  campaign_name: "",
  sku: "",
  product_name: "",
  ad_spend: "",
  ad_sales: "",
  impressions: "",
  clicks: "",
  ctr: "",
  ad_sales_count: "",
  ad_order_count: "",
  conversion_rate: "",
  remark: ""
};

const rankingTabs: { key: RankingMetric; label: string }[] = [
  { key: "roas", label: "TOP10 ROAS" },
  { key: "ctr", label: "TOP10 CTR" },
  { key: "conversion_rate", label: "TOP10 转化率" },
  { key: "ad_profit", label: "TOP10 广告利润" },
  { key: "ad_sales", label: "TOP10 广告销售额" }
];

export default function AdvertisingPage() {
  return (
    <AppShell>
      <AdvertisingDailyCenter />
    </AppShell>
  );
}

function AdvertisingDailyCenter() {
  const [records, setRecords] = useState<DailyAdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [customStart, setCustomStart] = useState(todayKst());
  const [customEnd, setCustomEnd] = useState(todayKst());
  const [trendWindow, setTrendWindow] = useState<TrendWindow>("30d");
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>("roas");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "ad_sales", dir: "desc" });

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from("advertising_daily_records")
      .select("*")
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setRecords([]);
    } else {
      setRecords((data ?? []) as DailyAdRecord[]);
    }
    setLoading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    setSaving(true);
    const payload = buildPayload(form);
    const result = editingId
      ? await supabase.from("advertising_daily_records").update(payload).eq("id", editingId)
      : await supabase.from("advertising_daily_records").insert({ user_id: auth.user.id, ...payload });

    if (!result.error) {
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await loadRecords();
    }
    setSaving(false);
  }

  async function deleteRecord(id: string) {
    if (!window.confirm("确定删除这条广告日报吗？")) return;
    const { error } = await supabase.from("advertising_daily_records").delete().eq("id", id);
    if (!error) await loadRecords();
  }

  function startEdit(record: DailyAdRecord) {
    setEditingId(record.id);
    setForm({
      record_date: record.record_date,
      campaign_name: record.campaign_name,
      sku: record.sku,
      product_name: record.product_name,
      ad_spend: String(record.ad_spend ?? 0),
      ad_sales: String(record.ad_sales ?? 0),
      impressions: String(record.impressions ?? 0),
      clicks: String(record.clicks ?? 0),
      ctr: String(displayCtr(record)),
      ad_sales_count: String(record.ad_sales_count ?? 0),
      ad_order_count: String(record.ad_order_count ?? 0),
      conversion_rate: String(displayConversionRate(record)),
      remark: record.remark ?? ""
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const range = useMemo(() => dateRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const rangeRecords = useMemo(() => records.filter((record) => inRange(record.record_date, range.start, range.end)), [records, range]);
  const comparisonRecords = useMemo(() => previousPeriod(records, range.start, range.end), [records, range]);
  const metrics = useMemo(() => buildMetrics(rangeRecords), [rangeRecords]);
  const comparisonMetrics = useMemo(() => buildMetrics(comparisonRecords), [comparisonRecords]);
  const trendRecords = useMemo(() => filterTrendRecords(records, trendWindow), [records, trendWindow]);
  const trendData = useMemo(() => buildTrend(trendRecords, trendWindow), [trendRecords, trendWindow]);
  const skuRows = useMemo(() => buildSkuRows(rangeRecords), [rangeRecords]);
  const filteredSkuRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortSkuRows(
      skuRows.filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (!query) return true;
        return `${row.sku} ${row.product_name}`.toLowerCase().includes(query);
      }),
      sort
    );
  }, [skuRows, search, statusFilter, sort]);
  const rankingRows = useMemo(() => [...skuRows].sort((a, b) => Number(b[rankingMetric]) - Number(a[rankingMetric])).slice(0, 10), [skuRows, rankingMetric]);
  const insights = useMemo(() => buildInsights(skuRows, metrics, comparisonMetrics), [skuRows, metrics, comparisonMetrics]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#dfe2da] bg-[#fbfaf6]/92 px-6 py-7 shadow-[0_22px_70px_rgba(18,31,27,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#101815]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-900/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#bca77a]/12 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="premium-section-eyebrow">Advertising Daily Center</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink dark:text-white md:text-5xl">广告日报中心</h1>
            <p className="mt-3 max-w-2xl text-base text-muted dark:text-white/62">每天录入 Coupang 广告数据，自动分析广告花费、销售额、ROAS、CTR、转化率和利润贡献。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> 新增广告日报
            </button>
          </div>
        </div>

        <div className="relative mt-7 flex flex-wrap items-center gap-2">
          <DatePresetBar value={preset} onChange={setPreset} />
          {preset === "custom" ? (
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-white/72 p-2 shadow-soft dark:border-white/10 dark:bg-white/[0.06]">
              <input className="premium-input h-10 w-40" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <span className="text-muted">~</span>
              <input className="premium-input h-10 w-40" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </div>
          ) : null}
        </div>

        {loading ? <SkeletonKpis /> : (
          <div className="relative mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={WalletCards} label="今日广告花费" value={won(metrics.ad_spend)} change={changeRate(metrics.ad_spend, comparisonMetrics.ad_spend)} />
            <KpiCard icon={TrendingUp} label="今日广告销售额" value={won(metrics.ad_sales)} change={changeRate(metrics.ad_sales, comparisonMetrics.ad_sales)} />
            <KpiCard icon={Target} label="ROAS" value={formatNumber(metrics.roas, 2)} helper="广告销售额 ÷ 广告花费" good={metrics.roas >= 4} />
            <KpiCard icon={MousePointerClick} label="CTR" value={`${formatNumber(metrics.ctr, 2)}%`} helper={`${formatNumber(metrics.clicks, 0)} 点击 / ${formatNumber(metrics.impressions, 0)} 展示`} good={metrics.ctr >= 1} />
            <KpiCard icon={BarChart3} label="转化率" value={`${formatNumber(metrics.conversion_rate, 2)}%`} helper="成交数 ÷ 点击量" good={metrics.conversion_rate >= 3} />
            <KpiCard icon={CalendarDays} label="广告订单数" value={formatNumber(metrics.ad_order_count, 0)} />
            <KpiCard icon={Sparkles} label="广告成交数" value={formatNumber(metrics.ad_sales_count, 0)} />
            <KpiCard icon={metrics.ad_profit >= 0 ? TrendingUp : TrendingDown} label="广告利润" value={won(metrics.ad_profit)} helper={`成本占比 ${formatNumber(metrics.cost_ratio, 1)}%`} good={metrics.ad_profit >= 0} />
          </div>
        )}
      </section>

      {showForm ? (
        <DailyEntryForm
          form={form}
          editing={Boolean(editingId)}
          saving={saving}
          onChange={setForm}
          onSubmit={submit}
          onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
        />
      ) : null}

      {!loading && records.length === 0 ? (
        <EmptyState onCreate={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} />
      ) : null}

      <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="premium-section-eyebrow">Ad Trend Intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink dark:text-white">广告趋势分析</h2>
          </div>
          <Segmented value={trendWindow} options={[["7d", "7天"], ["30d", "30天"], ["90d", "90天"], ["year", "年度"]]} onChange={(value) => setTrendWindow(value as TrendWindow)} />
        </div>
        {loading ? <SkeletonBlock /> : trendData.length ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="adDailySales" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#17483f" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#17483f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(197,201,189,0.55)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => compactWon(Number(value))} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(23,72,63,0.28)" }} />
                <Area type="monotone" dataKey="ad_sales" name="广告销售额" stroke="#17483f" strokeWidth={2.5} fill="url(#adDailySales)" animationDuration={650} />
                <Line type="monotone" dataKey="ad_spend" name="广告花费" stroke="#b89b5e" strokeWidth={2.2} dot={false} animationDuration={700} />
                <Line type="monotone" dataKey="roas" name="ROAS" stroke="#3577c9" strokeWidth={2.2} dot={false} animationDuration={750} />
                <Line type="monotone" dataKey="ctr" name="CTR" stroke="#21a485" strokeWidth={1.8} dot={false} animationDuration={760} />
                <Line type="monotone" dataKey="conversion_rate" name="转化率" stroke="#c65f5f" strokeWidth={1.8} dot={false} animationDuration={780} />
                <Line type="monotone" dataKey="ad_profit" name="广告利润" stroke="#0d3932" strokeWidth={2} dot={false} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <PanelEmpty title="暂无广告趋势数据" text="新增广告日报后，这里会自动生成花费、销售额、ROAS、CTR、转化率和利润趋势。" />}
      </section>

      <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="premium-section-eyebrow">SKU Advertising Intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink dark:text-white">广告 SKU 分析中心</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="premium-input h-10 w-64 pl-9" placeholder="搜索 SKU / 产品名称" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <select className="premium-input h-10 w-36" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">全部状态</option>
              <option value="scale">增加预算</option>
              <option value="keep">维持预算</option>
              <option value="reduce">降低预算</option>
              <option value="pause">暂停观察</option>
            </select>
            <button className="erp-button-subtle inline-flex h-10 items-center gap-2 px-3 text-sm font-bold" onClick={() => exportSkuRows(filteredSkuRows)}>
              <Download className="h-4 w-4" /> 导出Excel
            </button>
          </div>
        </div>
        <SkuTable rows={filteredSkuRows} sort={sort} onSort={setSort} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="premium-section-eyebrow">Advertising Ranking</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink dark:text-white">广告排行榜</h2>
            </div>
            <Segmented value={rankingMetric} options={rankingTabs.map((item) => [item.key, item.label])} onChange={(value) => setRankingMetric(value as RankingMetric)} />
          </div>
          <RankingList rows={rankingRows} metric={rankingMetric} />
        </section>

        <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
          <p className="premium-section-eyebrow">Business Insights</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink dark:text-white">广告经营洞察</h2>
          <div className="mt-5 grid gap-3">
            {insights.map((item) => (
              <InsightCard key={item.title} icon={item.icon} title={item.title} text={item.text} tone={item.tone} />
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="premium-section-eyebrow">Daily Ledger</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink dark:text-white">广告日报记录</h2>
          </div>
          <button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> 新增广告日报
          </button>
        </div>
        <RecordLedger records={rangeRecords} onEdit={startEdit} onDelete={deleteRecord} />
      </section>
    </div>
  );
}

function DailyEntryForm({ form, editing, saving, onChange, onSubmit, onCancel }: {
  form: FormState;
  editing: boolean;
  saving: boolean;
  onChange: (form: FormState) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const preview = buildMetrics([payloadToPreview(form)]);
  return (
    <section className="rounded-[28px] border border-line bg-card/95 p-5 shadow-card backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="premium-section-eyebrow">{editing ? "Edit Daily Record" : "New Daily Record"}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{editing ? "编辑广告日报" : "新增广告日报"}</h2>
        </div>
        <div className="hidden gap-2 lg:grid lg:grid-cols-3">
          <MiniCalc label="自动 ROAS" value={formatNumber(preview.roas, 2)} />
          <MiniCalc label="广告利润" value={won(preview.ad_profit)} />
          <MiniCalc label="成本占比" value={`${formatNumber(preview.cost_ratio, 1)}%`} />
        </div>
      </div>
      <form className="grid gap-4 lg:grid-cols-4" onSubmit={onSubmit}>
        <Field label="日期"><input className="premium-input" type="date" required value={form.record_date} onChange={(event) => onChange({ ...form, record_date: event.target.value })} /></Field>
        <Field label="广告名称"><input className="premium-input" required value={form.campaign_name} onChange={(event) => onChange({ ...form, campaign_name: event.target.value })} /></Field>
        <Field label="SKU"><input className="premium-input font-mono" required value={form.sku} onChange={(event) => onChange({ ...form, sku: event.target.value })} /></Field>
        <Field label="产品名称"><input className="premium-input" required value={form.product_name} onChange={(event) => onChange({ ...form, product_name: event.target.value })} /></Field>
        <Field label="广告花费"><NumberInput value={form.ad_spend} onChange={(value) => onChange({ ...form, ad_spend: value })} /></Field>
        <Field label="广告销售额"><NumberInput value={form.ad_sales} onChange={(value) => onChange({ ...form, ad_sales: value })} /></Field>
        <Field label="展示量"><NumberInput value={form.impressions} onChange={(value) => onChange({ ...form, impressions: value })} /></Field>
        <Field label="点击量"><NumberInput value={form.clicks} onChange={(value) => onChange({ ...form, clicks: value })} /></Field>
        <Field label="CTR %"><NumberInput step="0.01" value={form.ctr} onChange={(value) => onChange({ ...form, ctr: value })} /></Field>
        <Field label="广告成交数量"><NumberInput value={form.ad_sales_count} onChange={(value) => onChange({ ...form, ad_sales_count: value })} /></Field>
        <Field label="广告订单数"><NumberInput value={form.ad_order_count} onChange={(value) => onChange({ ...form, ad_order_count: value })} /></Field>
        <Field label="转化率 %"><NumberInput step="0.01" value={form.conversion_rate} onChange={(value) => onChange({ ...form, conversion_rate: value })} /></Field>
        <div className="lg:col-span-4">
          <Field label="备注"><input className="premium-input" value={form.remark} onChange={(event) => onChange({ ...form, remark: event.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-4">
          <button className="erp-button-primary h-10 px-4 text-sm font-bold disabled:opacity-60" type="submit" disabled={saving}>{saving ? "保存中..." : editing ? "保存修改" : "创建日报"}</button>
          <button className="erp-button-subtle h-10 px-4 text-sm font-bold" type="button" onClick={onCancel}>取消</button>
        </div>
      </form>
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, helper, change, good = true }: { icon: LucideIcon; label: string; value: string; helper?: string; change?: number | null; good?: boolean }) {
  const positive = change == null ? good : change >= 0;
  return (
    <div className="group rounded-[24px] border border-line bg-white/76 p-5 shadow-[0_16px_46px_rgba(18,31,27,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-lift dark:border-white/10 dark:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17483f] text-white shadow-soft"><Icon className="h-5 w-5" /></span>
        {change != null ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{change >= 0 ? "↗" : "↘"} {formatNumber(Math.abs(change), 1)}%</span> : null}
      </div>
      <div className="mt-5 text-sm font-semibold text-ink dark:text-white">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink dark:text-white">{value}</div>
      {helper ? <div className="mt-2 text-xs font-medium text-muted dark:text-white/55">{helper}</div> : null}
    </div>
  );
}

function SkuTable({ rows, sort, onSort }: { rows: SkuAgg[]; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (sort: { key: SortKey; dir: "asc" | "desc" }) => void }) {
  const columns: { key: SortKey; label: string; render: (row: SkuAgg) => ReactNode }[] = [
    { key: "sku", label: "SKU", render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    { key: "product_name", label: "产品名称", render: (row) => row.product_name },
    { key: "ad_spend", label: "广告花费", render: (row) => won(row.ad_spend) },
    { key: "ad_sales", label: "广告销售额", render: (row) => won(row.ad_sales) },
    { key: "roas", label: "ROAS", render: (row) => formatNumber(row.roas, 2) },
    { key: "ctr", label: "CTR", render: (row) => `${formatNumber(row.ctr, 2)}%` },
    { key: "conversion_rate", label: "转化率", render: (row) => `${formatNumber(row.conversion_rate, 2)}%` },
    { key: "ad_order_count", label: "订单数", render: (row) => formatNumber(row.ad_order_count, 0) },
    { key: "ad_sales_count", label: "成交数", render: (row) => formatNumber(row.ad_sales_count, 0) },
    { key: "ad_profit", label: "广告利润", render: (row) => <span className={row.ad_profit >= 0 ? "text-emerald-700" : "text-red-600"}>{won(row.ad_profit)}</span> }
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
      <table className="min-w-[1120px] w-full text-left text-sm">
        <thead className="sticky top-0 bg-[#f7f5ed] text-xs uppercase tracking-[0.14em] text-muted dark:bg-white/[0.06]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3">
                <button className="font-bold" onClick={() => onSort({ key: column.key, dir: sort.key === column.key && sort.dir === "desc" ? "asc" : "desc" })}>{column.label}</button>
              </th>
            ))}
            <th className="px-4 py-3">状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sku} className="border-t border-line/70 transition hover:bg-emerald-50/45 dark:border-white/10">
              {columns.map((column) => <td key={column.key} className="px-4 py-3 font-medium text-ink dark:text-white">{column.render(row)}</td>)}
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td className="px-4 py-12 text-center text-sm font-semibold text-muted" colSpan={columns.length + 1}>暂无 SKU 广告数据</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function RankingList({ rows, metric }: { rows: SkuAgg[]; metric: RankingMetric }) {
  if (!rows.length) return <PanelEmpty title="暂无排行榜数据" text="录入广告日报后，系统会自动生成 TOP10 排行榜。" />;
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.sku} className="group rounded-2xl border border-line bg-white/72 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${rankClass(index)}`}>{index + 1}</span>
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{row.product_name}</div>
                <div className="mt-1 font-mono text-xs text-muted">{row.sku}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-ink">{formatRankingValue(row, metric)}</div>
              <div className="text-xs text-muted">利润 {won(row.ad_profit)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordLedger({ records, onEdit, onDelete }: { records: DailyAdRecord[]; onEdit: (record: DailyAdRecord) => void; onDelete: (id: string) => void }) {
  if (!records.length) return <PanelEmpty title="当前范围暂无广告日报" text="点击新增广告日报，开始记录今日 Coupang 广告数据。" />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white/70">
      <table className="min-w-[1180px] w-full text-left text-sm">
        <thead className="bg-[#f7f5ed] text-xs uppercase tracking-[0.14em] text-muted">
          <tr>
            {["日期", "广告名称", "SKU", "产品名称", "花费", "销售额", "展示", "点击", "CTR", "成交数", "订单数", "ROAS", "转化率", "操作"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-t border-line/70 transition hover:bg-emerald-50/45">
              <td className="px-4 py-3">{formatDate(record.record_date)}</td>
              <td className="px-4 py-3 font-semibold text-ink">{record.campaign_name}</td>
              <td className="px-4 py-3 font-mono text-xs">{record.sku}</td>
              <td className="px-4 py-3">{record.product_name}</td>
              <td className="px-4 py-3">{won(record.ad_spend)}</td>
              <td className="px-4 py-3">{won(record.ad_sales)}</td>
              <td className="px-4 py-3">{formatNumber(record.impressions, 0)}</td>
              <td className="px-4 py-3">{formatNumber(record.clicks, 0)}</td>
              <td className="px-4 py-3">{formatNumber(displayCtr(record), 2)}%</td>
              <td className="px-4 py-3">{formatNumber(record.ad_sales_count, 0)}</td>
              <td className="px-4 py-3">{formatNumber(record.ad_order_count, 0)}</td>
              <td className="px-4 py-3">{formatNumber(displayRoas(record), 2)}</td>
              <td className="px-4 py-3">{formatNumber(displayConversionRate(record), 2)}%</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="erp-button-subtle inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold" onClick={() => onEdit(record)}><Edit3 className="h-3.5 w-3.5" />编辑</button>
                  <button className="erp-button-subtle inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-700" onClick={() => onDelete(record.id)}><Trash2 className="h-3.5 w-3.5" />删除</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatePresetBar({ value, onChange }: { value: DatePreset; onChange: (value: DatePreset) => void }) {
  const options: { value: DatePreset; label: string }[] = [
    { value: "today", label: "今日" },
    { value: "yesterday", label: "昨日" },
    { value: "last7", label: "近7天" },
    { value: "last30", label: "近30天" },
    { value: "thisMonth", label: "本月" },
    { value: "lastMonth", label: "上月" },
    { value: "custom", label: "自定义" }
  ];
  return <Segmented value={value} options={options.map((item) => [item.value, item.label])} onChange={(next) => onChange(next as DatePreset)} />;
}

function Segmented({ value, options, onChange }: { value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-line bg-white/72 p-1 shadow-soft dark:border-white/10 dark:bg-white/[0.06]">
      {options.map(([key, label]) => (
        <button key={key} className={`rounded-xl px-3 py-2 text-sm font-bold transition ${value === key ? "bg-[#17483f] text-white shadow-soft" : "text-ink/68 hover:bg-white"}`} onClick={() => onChange(key)} type="button">{label}</button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-muted">{label}{children}</label>;
}

function NumberInput({ value, onChange, step = "1" }: { value: string; onChange: (value: string) => void; step?: string }) {
  return <input className="premium-input text-right tabular-nums" type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function MiniCalc({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-white/72 px-4 py-3"><div className="text-xs font-bold text-muted">{label}</div><div className="mt-1 font-semibold text-ink">{value}</div></div>;
}

function InsightCard({ icon: Icon, title, text, tone }: { icon: LucideIcon; title: string; text: string; tone: "good" | "warn" | "risk" | "neutral" }) {
  const className = tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : tone === "risk" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-700";
  return (
    <div className="rounded-2xl border border-line bg-white/72 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${className}`}><Icon className="h-5 w-5" /></span>
        <div>
          <div className="font-semibold text-ink">{title}</div>
          <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-[28px] border border-dashed border-line bg-card/75 px-6 py-14 text-center shadow-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-brand"><BarChart3 className="h-7 w-7" /></div>
      <h2 className="mt-5 text-2xl font-semibold text-ink">暂无广告数据</h2>
      <p className="mt-2 text-sm text-muted">请点击新增广告日报，开始记录今日广告数据。</p>
      <button className="erp-button-primary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={onCreate}><Plus className="h-4 w-4" /> 新增广告日报</button>
    </section>
  );
}

function PanelEmpty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/55 px-4 py-12 text-center"><div className="font-semibold text-ink">{title}</div><p className="mt-2 text-sm text-muted">{text}</p></div>;
}

function StatusBadge({ status }: { status: SkuAgg["status"] }) {
  const map = {
    scale: ["增加预算", "bg-emerald-50 text-emerald-700 border-emerald-100"],
    keep: ["维持预算", "bg-blue-50 text-blue-700 border-blue-100"],
    reduce: ["降低预算", "bg-amber-50 text-amber-700 border-amber-100"],
    pause: ["暂停观察", "bg-red-50 text-red-700 border-red-100"]
  } as const;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${map[status][1]}`}>{map[status][0]}</span>;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Metrics & { label: string; record_date: string } }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-2xl border border-line bg-card/95 p-4 text-sm shadow-lift backdrop-blur">
      <div className="mb-2 font-semibold text-ink">{point.label}</div>
      <div>广告花费：{won(point.ad_spend)}</div>
      <div>广告销售额：{won(point.ad_sales)}</div>
      <div>ROAS：{formatNumber(point.roas, 2)}</div>
      <div>CTR：{formatNumber(point.ctr, 2)}%</div>
      <div>转化率：{formatNumber(point.conversion_rate, 2)}%</div>
      <div>广告利润：{won(point.ad_profit)}</div>
    </div>
  );
}

function SkeletonKpis() {
  return <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-[24px] border border-line bg-white/60" />)}</div>;
}

function SkeletonBlock() {
  return <div className="h-[360px] animate-pulse rounded-2xl border border-line bg-white/55" />;
}

function buildPayload(form: FormState) {
  const spend = money(form.ad_spend);
  const sales = money(form.ad_sales);
  const impressions = int(form.impressions);
  const clicks = int(form.clicks);
  const salesCount = int(form.ad_sales_count);
  return {
    record_date: form.record_date,
    campaign_name: form.campaign_name.trim(),
    sku: form.sku.trim(),
    product_name: form.product_name.trim(),
    ad_spend: spend,
    ad_sales: sales,
    impressions,
    clicks,
    ctr: form.ctr === "" ? calcRate(clicks, impressions) : num(form.ctr),
    ad_sales_count: salesCount,
    ad_order_count: int(form.ad_order_count),
    roas: calcRoas(sales, spend),
    conversion_rate: form.conversion_rate === "" ? calcRate(salesCount, clicks) : num(form.conversion_rate),
    remark: form.remark.trim() || null
  };
}

function payloadToPreview(form: FormState): DailyAdRecord {
  return { id: "preview", user_id: "", created_at: "", ...buildPayload(form), updated_at: null };
}

function buildMetrics(rows: DailyAdRecord[]): Metrics {
  const base = rows.reduce((acc, row) => {
    acc.ad_spend += Number(row.ad_spend ?? 0);
    acc.ad_sales += Number(row.ad_sales ?? 0);
    acc.impressions += Number(row.impressions ?? 0);
    acc.clicks += Number(row.clicks ?? 0);
    acc.ad_sales_count += Number(row.ad_sales_count ?? 0);
    acc.ad_order_count += Number(row.ad_order_count ?? 0);
    return acc;
  }, { ad_spend: 0, ad_sales: 0, impressions: 0, clicks: 0, ad_sales_count: 0, ad_order_count: 0 } as Metrics);
  base.roas = calcRoas(base.ad_sales, base.ad_spend);
  base.ctr = calcRate(base.clicks, base.impressions);
  base.conversion_rate = calcRate(base.ad_sales_count, base.clicks);
  base.ad_profit = base.ad_sales - base.ad_spend;
  base.cost_ratio = calcRate(base.ad_spend, base.ad_sales);
  return base;
}

function buildSkuRows(rows: DailyAdRecord[]): SkuAgg[] {
  const map = new Map<string, DailyAdRecord[]>();
  rows.forEach((row) => {
    const key = row.sku || "未填写SKU";
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return Array.from(map.entries()).map(([sku, group]) => {
    const metrics = buildMetrics(group);
    return {
      ...metrics,
      sku,
      product_name: group[0]?.product_name || "未命名产品",
      record_count: group.length,
      status: decisionStatus(metrics)
    };
  });
}

function buildTrend(rows: DailyAdRecord[], window: TrendWindow) {
  const map = new Map<string, DailyAdRecord[]>();
  rows.forEach((row) => {
    const key = window === "year" ? row.record_date.slice(0, 7) : row.record_date;
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({ record_date: key, label: window === "year" ? key.slice(5) + "月" : key.slice(5), ...buildMetrics(group) }));
}

function buildInsights(rows: SkuAgg[], metrics: Metrics, previous: Metrics) {
  if (!rows.length) {
    return [{ icon: Sparkles, title: "等待广告日报", text: "录入广告日报后，系统会自动判断最佳 SKU、风险 SKU 和预算方向。", tone: "neutral" as const }];
  }
  const best = [...rows].sort((a, b) => b.roas - a.roas || b.ad_profit - a.ad_profit)[0];
  const worst = [...rows].sort((a, b) => a.roas - b.roas || a.ad_profit - b.ad_profit)[0];
  const scale = rows.find((row) => row.status === "scale");
  const pause = rows.find((row) => row.status === "pause");
  const growth = changeRate(metrics.ad_sales, previous.ad_sales);
  return [
    { icon: TrendingUp, title: "最佳广告 SKU", text: `${best.product_name} / ${best.sku}，ROAS ${formatNumber(best.roas, 2)}，广告利润 ${won(best.ad_profit)}。`, tone: "good" as const },
    { icon: TrendingDown, title: "最差广告 SKU", text: `${worst.product_name} / ${worst.sku}，ROAS ${formatNumber(worst.roas, 2)}，建议检查关键词、详情页和预算。`, tone: worst.roas < 2 ? "risk" as const : "warn" as const },
    { icon: Target, title: "预算建议", text: scale ? `${scale.sku} ROAS ${formatNumber(scale.roas, 2)} 且利润为正，建议继续增加预算。` : "暂未发现明确适合加预算的 SKU，先维持观察。", tone: scale ? "good" as const : "neutral" as const },
    { icon: WalletCards, title: "投放效率变化", text: growth == null ? "当前周期缺少对比数据。" : `广告销售额较上一周期 ${growth >= 0 ? "提升" : "下降"} ${formatNumber(Math.abs(growth), 1)}%。`, tone: growth != null && growth < 0 ? "warn" as const : "good" as const },
    { icon: Trash2, title: "暂停候选", text: pause ? `${pause.sku} ROAS ${formatNumber(pause.roas, 2)} 且利润为负，建议暂停或重建广告。` : "当前没有明显需要暂停的广告 SKU。", tone: pause ? "risk" as const : "neutral" as const }
  ];
}

function sortSkuRows(rows: SkuAgg[], sort: { key: SortKey; dir: "asc" | "desc" }) {
  return [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sort.dir === "asc" ? result : -result;
  });
}

function decisionStatus(metrics: Metrics): SkuAgg["status"] {
  if (metrics.ad_spend <= 0 && metrics.ad_sales <= 0) return "keep";
  if (metrics.roas >= 5 && metrics.ad_profit > 0 && metrics.conversion_rate >= 3) return "scale";
  if (metrics.roas >= 3 && metrics.ad_profit >= 0) return "keep";
  if (metrics.roas >= 1.5) return "reduce";
  return "pause";
}

function filterTrendRecords(records: DailyAdRecord[], window: TrendWindow) {
  const today = todayKst();
  if (window === "year") return records.filter((row) => row.record_date.slice(0, 4) === today.slice(0, 4));
  const days = window === "7d" ? 6 : window === "30d" ? 29 : 89;
  return records.filter((row) => inRange(row.record_date, offsetDate(today, -days), today));
}

function previousPeriod(records: DailyAdRecord[], start: string, end: string) {
  const span = diffDays(start, end) + 1;
  const previousEnd = offsetDate(start, -1);
  const previousStart = offsetDate(previousEnd, -(span - 1));
  return records.filter((row) => inRange(row.record_date, previousStart, previousEnd));
}

function dateRange(preset: DatePreset, customStart: string, customEnd: string) {
  const today = todayKst();
  const yesterday = offsetDate(today, -1);
  if (preset === "today") return { start: today, end: today };
  if (preset === "yesterday") return { start: yesterday, end: yesterday };
  if (preset === "last7") return { start: offsetDate(today, -6), end: today };
  if (preset === "last30") return { start: offsetDate(today, -29), end: today };
  if (preset === "thisMonth") return { start: `${today.slice(0, 7)}-01`, end: today };
  if (preset === "lastMonth") {
    const date = parseDate(`${today.slice(0, 7)}-01`);
    date.setMonth(date.getMonth() - 1);
    const start = toDateKey(date);
    const endDate = new Date(date);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    return { start, end: toDateKey(endDate) };
  }
  return { start: customStart, end: customEnd };
}

function exportSkuRows(rows: SkuAgg[]) {
  const headers = ["SKU", "产品名称", "广告花费", "广告销售额", "ROAS", "CTR", "转化率", "广告订单数", "广告成交数", "广告利润", "状态"];
  const csv = [headers.join(","), ...rows.map((row) => [row.sku, row.product_name, row.ad_spend, row.ad_sales, row.roas, row.ctr, row.conversion_rate, row.ad_order_count, row.ad_sales_count, row.ad_profit, row.status].map(csvCell).join(","))].join("\n");
  download(csv, `advertising-sku-${todayKst()}.csv`, "text/csv;charset=utf-8;");
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob(["\uFEFF", content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function rankClass(index: number) {
  if (index === 0) return "bg-[#d6b15e] text-white";
  if (index === 1) return "bg-slate-300 text-slate-800";
  if (index === 2) return "bg-[#b7814f] text-white";
  return "bg-emerald-50 text-emerald-700";
}

function formatRankingValue(row: SkuAgg, metric: RankingMetric) {
  if (metric === "ad_profit" || metric === "ad_sales") return won(row[metric]);
  if (metric === "ctr" || metric === "conversion_rate") return `${formatNumber(row[metric], 2)}%`;
  return formatNumber(row[metric], 2);
}

function displayRoas(record: DailyAdRecord) {
  return record.roas == null ? calcRoas(Number(record.ad_sales ?? 0), Number(record.ad_spend ?? 0)) : Number(record.roas);
}

function displayCtr(record: DailyAdRecord) {
  return record.ctr == null ? calcRate(Number(record.clicks ?? 0), Number(record.impressions ?? 0)) : Number(record.ctr);
}

function displayConversionRate(record: DailyAdRecord) {
  return record.conversion_rate == null ? calcRate(Number(record.ad_sales_count ?? 0), Number(record.clicks ?? 0)) : Number(record.conversion_rate);
}

function calcRoas(sales: number, spend: number) {
  return spend > 0 ? sales / spend : 0;
}

function calcRate(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function changeRate(current: number, previous: number) {
  if (!previous) return current ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function todayKst() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function offsetDate(dateKey: string, days: number) {
  const date = parseDate(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function parseDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  return date.toLocaleDateString("en-CA");
}

function diffDays(start: string, end: string) {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86400000);
}

function won(value: number) {
  return `₩${Math.round(Number(value ?? 0)).toLocaleString("ko-KR")}`;
}

function compactWon(value: number) {
  if (Math.abs(value) >= 1000000) return `₩${Math.round(value / 10000).toLocaleString("ko-KR")}万`;
  if (Math.abs(value) >= 1000) return `₩${Math.round(value / 1000).toLocaleString("ko-KR")}k`;
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function formatNumber(value: number, digits = 1) {
  return Number(value ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? digits : 0 });
}

function formatDate(date: string) {
  return date.replaceAll("-", "/");
}

function money(value: string) {
  return Math.max(0, Number(value || 0));
}

function int(value: string) {
  return Math.max(0, Math.trunc(Number(value || 0)));
}

function num(value: string) {
  return Math.max(0, Number(value || 0));
}
