"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleAlert, CircleCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import {
  buildReplenishmentRows,
  REPLENISHMENT_CYCLE_DAYS,
  SALES_ANALYSIS_DAYS,
  summarizeSales,
  type ReplenishmentRow
} from "@/lib/replenishment";
import type { ProductWithStock, PurchaseOrder, SaleDaily } from "@/lib/types";

type TrendMetric = "quantity" | "revenue";
type TrendRange = "7d" | "30d" | "90d" | "year";
type SalesPoint = { date: string; label: string; quantity: number; revenue: number; profit: number };
type AlertItem = { level: "danger" | "warning" | "success"; text: string };

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<ReplenishmentRow[]>([]);
  const [sales90Rows, setSales90Rows] = useState<SaleDaily[]>([]);
  const [salesYearRows, setSalesYearRows] = useState<SaleDaily[]>([]);
  const [salesAllRows, setSalesAllRows] = useState<SaleDaily[]>([]);
  const [returnInboundSaleable, setReturnInboundSaleable] = useState(0);
  const [lossQuantity, setLossQuantity] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("revenue");
  const [trendRange, setTrendRange] = useState<TrendRange>("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [selectedYear]);

  async function load() {
    setLoading(true);

    const today = new Date();
    const todayKey = toDateKey(today);
    const date90d = daysAgoKey(today, 89);
    const date30d = daysAgoKey(today, SALES_ANALYSIS_DAYS - 1);
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const [
      { data: products },
      { data: sales90dRows },
      { data: sales30dRows },
      { data: salesYearRowsData },
      { data: allSales },
      { data: purchases },
      { data: movements }
    ] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("created_at", { ascending: false }),
      supabase.from("sales_daily").select("*").gte("sale_date", date90d).lte("sale_date", todayKey),
      supabase.from("sales_daily").select("*").gte("sale_date", date30d).lte("sale_date", todayKey),
      supabase.from("sales_daily").select("*").gte("sale_date", yearStart).lte("sale_date", yearEnd),
      supabase.from("sales_daily").select("*"),
      supabase.from("purchase_orders").select("*, products(name, sku)"),
      supabase.from("stock_movements").select("type, quantity, memo")
    ]);

    const productRows = (products ?? []) as ProductWithStock[];
    const sales30 = (sales30dRows ?? []) as SaleDaily[];

    setRows(buildReplenishmentRows(productRows, sales30, (purchases ?? []) as PurchaseOrder[]));
    setSales90Rows((sales90dRows ?? []) as SaleDaily[]);
    setSalesYearRows((salesYearRowsData ?? []) as SaleDaily[]);
    setSalesAllRows((allSales ?? []) as SaleDaily[]);
    setReturnInboundSaleable(sumTypedMovements(movements ?? [], "return_inbound"));
    setLossQuantity(sumTypedMovements(movements ?? [], "loss"));
    setLoading(false);
  }

  const productMap = useMemo(() => new Map(rows.map((row) => [row.product.id, row.product])), [rows]);
  const todayKey = toDateKey(new Date());
  const yesterdayKey = daysAgoKey(new Date(), 1);
  const sales30Rows = sales90Rows.filter((sale) => sale.sale_date >= daysAgoKey(new Date(), 29));
  const sales7Rows = sales90Rows.filter((sale) => sale.sale_date >= daysAgoKey(new Date(), 6));
  const salesSummary = summarizeSales(sales30Rows);

  const totalStock = rows.reduce((sum, row) => sum + row.currentStock, 0);
  const skuCount = rows.length;
  const stockValue = rows.reduce((sum, row) => sum + row.currentStock * money(row.product.purchase_price), 0);
  const saleableDays = salesSummary.averageDailySales > 0 ? Math.floor(totalStock / salesSummary.averageDailySales) : 0;
  const todayMetrics = buildSalesMetrics(salesAllRows.filter((sale) => sale.sale_date === todayKey), productMap);
  const yesterdayMetrics = buildSalesMetrics(salesAllRows.filter((sale) => sale.sale_date === yesterdayKey), productMap);
  const monthMetrics = buildSalesMetrics(salesAllRows.filter((sale) => isCurrentMonth(sale.sale_date)), productMap);
  const previousMonthMetrics = buildSalesMetrics(salesAllRows.filter((sale) => isPreviousMonth(sale.sale_date)), productMap);
  const sales30Metrics = buildSalesMetrics(sales30Rows, productMap);
  const sales7Metrics = buildSalesMetrics(sales7Rows, productMap);
  const replenishRows = buildSmartReplenishment(rows);
  const riskyRows = replenishRows
    .filter((row) => row.status !== "normal")
    .sort((a, b) => a.saleableDays - b.saleableDays)
    .slice(0, 12);
  const alerts = buildAlerts({
    rows: replenishRows,
    sales7: sales7Metrics.quantity,
    sales30: sales30Metrics.quantity,
    monthRevenue: monthMetrics.revenue,
    previousMonthRevenue: previousMonthMetrics.revenue,
    monthProfit: monthMetrics.profit,
    previousMonthProfit: previousMonthMetrics.profit
  });
  const trendData = trendRange === "year"
    ? buildMonthlySalesPoints(salesYearRows, productMap, selectedYear)
    : buildDailySalesPoints(sales90Rows, productMap, rangeDays(trendRange));
  const annualData = buildMonthlySalesPoints(salesYearRows, productMap, selectedYear);
  const topSales = buildTopSales(sales30Rows, productMap, "quantity");
  const topProfit = buildTopSales(sales30Rows, productMap, "profit");
  const slowMoving = rows
    .filter((row) => row.currentStock > 0 && !hasRecentSale(row.product.id, sales30Rows))
    .sort((a, b) => b.currentStock * money(b.product.purchase_price) - a.currentStock * money(a.product.purchase_price))
    .slice(0, 10);
  const health = buildInventoryHealth(replenishRows, slowMoving);
  const lifecycleRows = buildLifecycleRows(rows, sales90Rows);

  return (
    <>
      <PageHeader title="经营驾驶舱" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveKpi label="今日销售额" value={won(todayMetrics.revenue)} compare={compare(todayMetrics.revenue, yesterdayMetrics.revenue)} />
        <ExecutiveKpi label="今日订单数" value={todayMetrics.quantity} compare={compare(todayMetrics.quantity, yesterdayMetrics.quantity)} />
        <ExecutiveKpi label="本月销售额" value={won(monthMetrics.revenue)} compare={compare(monthMetrics.revenue, previousMonthMetrics.revenue)} />
        <ExecutiveKpi label="本月利润" value={won(monthMetrics.profit)} compare={compare(monthMetrics.profit, previousMonthMetrics.profit)} />
        <ExecutiveKpi label="广告ROI" value="未接入" muted />
        <ExecutiveKpi label="当前库存金额" value={won(stockValue)} />
        <ExecutiveKpi label="库存可售天数" value={saleableDays > 0 ? `${saleableDays}天` : "暂无销量"} />
        <ExecutiveKpi label="当前SKU总数" value={skuCount} />
      </section>

      <section className="mt-6">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink/55">今日重点提醒</div>
              <h2 className="text-xl font-semibold text-ink">需要负责人优先处理的事项</h2>
            </div>
            <span className="rounded bg-panel px-3 py-1 text-sm font-semibold text-ink">{alerts.length} 项</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {alerts.map((alert) => (
              <AlertPill key={alert.text} alert={alert} />
            ))}
            {!alerts.length ? <AlertPill alert={{ level: "success", text: "当前经营和库存状态正常" }} /> : null}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <DashboardSectionTitle eyebrow="销售趋势中心" title="销售趋势" />
          <div className="mb-4 flex flex-wrap gap-2">
            <SegmentButton active={trendMetric === "revenue"} onClick={() => setTrendMetric("revenue")}>销售额</SegmentButton>
            <SegmentButton active={trendMetric === "quantity"} onClick={() => setTrendMetric("quantity")}>销量</SegmentButton>
            <span className="mx-1 h-9 w-px bg-line" />
            {(["7d", "30d", "90d", "year"] as TrendRange[]).map((range) => (
              <SegmentButton key={range} active={trendRange === range} onClick={() => setTrendRange(range)}>
                {range === "year" ? "年度" : range.replace("d", "天")}
              </SegmentButton>
            ))}
          </div>
          <TrendChart data={trendData} metric={trendMetric} />
        </Card>

        <Card>
          <div className="mb-4 flex items-end justify-between gap-3">
            <DashboardSectionTitle eyebrow="年度经营趋势" title="月度经营" />
            <select className="w-28" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
              {buildYearOptions().map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <MonthlyBars data={annualData} metric={trendMetric} />
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <DashboardSectionTitle eyebrow="智能补货中心" title="哪些商品要补货" />
          {loading ? (
            <div>{t.loading}</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>商品名称</Th>
                  <Th>当前库存</Th>
                  <Th>日均销量</Th>
                  <Th>可售天数</Th>
                  <Th>状态</Th>
                  <Th>建议动作</Th>
                  <Th>建议采购数量</Th>
                </tr>
              </thead>
              <tbody>
                {replenishRows.slice(0, 14).map((row) => (
                  <tr key={row.product.id}>
                    <Td>{row.product.sku}</Td>
                    <Td>{row.product.name}</Td>
                    <Td>{row.currentStock}</Td>
                    <Td>{row.dailyAverage}</Td>
                    <Td>{formatSaleableDays(row.saleableDays)}</Td>
                    <Td><StatusBadge status={row.status} /></Td>
                    <Td>{row.action}</Td>
                    <Td>{row.suggestedQty}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <AnalysisTable title="TOP销量商品" rows={topSales} valueLabel="销量" valueKey="quantity" />
        <AnalysisTable title="TOP利润商品" rows={topProfit} valueLabel="利润" valueKey="profit" />
        <Card>
          <DashboardSectionTitle eyebrow="SKU经营分析" title="滞销商品" />
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>库存</Th>
                <Th>库存金额</Th>
              </tr>
            </thead>
            <tbody>
              {slowMoving.map((row) => (
                <tr key={row.product.id}>
                  <Td>{row.product.sku}</Td>
                  <Td>{row.currentStock}</Td>
                  <Td>{won(row.currentStock * money(row.product.purchase_price))}</Td>
                </tr>
              ))}
              {!slowMoving.length ? <EmptyRow columns={3} /> : null}
            </tbody>
          </Table>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <DashboardSectionTitle eyebrow="库存健康中心" title="库存健康度" />
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <DonutChart items={health} />
            <div className="space-y-3">
              {health.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded border border-line bg-panel px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold text-ink">{item.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <DashboardSectionTitle eyebrow="库存风险分析" title="库存风险排行榜" />
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>库存</Th>
                <Th>可售天数</Th>
                <Th>预计断货日期</Th>
                <Th>预计损失金额</Th>
              </tr>
            </thead>
            <tbody>
              {riskyRows.map((row) => (
                <tr key={row.product.id}>
                  <Td>{row.product.sku}</Td>
                  <Td>{row.currentStock}</Td>
                  <Td>{formatSaleableDays(row.saleableDays)}</Td>
                  <Td>{stockoutDate(row.saleableDays)}</Td>
                  <Td>{won(Math.max(0, (REPLENISHMENT_CYCLE_DAYS - row.saleableDays) * row.dailyAverage * money(row.product.sale_price)))}</Td>
                </tr>
              ))}
              {!riskyRows.length ? <EmptyRow columns={5} /> : null}
            </tbody>
          </Table>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <DashboardSectionTitle eyebrow="SKU生命周期分析" title="SKU详细数据表" />
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>商品名称</Th>
                <Th>库存</Th>
                <Th>近期销量</Th>
                <Th>日均销量</Th>
                <Th>可售天数</Th>
                <Th>生命周期</Th>
              </tr>
            </thead>
            <tbody>
              {lifecycleRows.map((row) => (
                <tr key={row.product.id}>
                  <Td>{row.product.sku}</Td>
                  <Td>{row.product.name}</Td>
                  <Td>{row.currentStock}</Td>
                  <Td>{row.salesInWindow}</Td>
                  <Td>{row.dailyAverage}</Td>
                  <Td>{formatSaleableDays(row.saleableDays)}</Td>
                  <Td><LifecycleBadge label={row.lifecycle} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </section>
    </>
  );
}

function ExecutiveKpi({ label, value, compare: compareValue, muted = false }: { label: string; value: string | number; compare?: number | null; muted?: boolean }) {
  const direction = compareValue == null ? "neutral" : compareValue >= 0 ? "up" : "down";
  return (
    <Card className="min-h-28">
      <div className="text-sm font-medium text-ink/60">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${muted ? "text-ink/45" : "text-ink"}`}>{value}</div>
      {compareValue != null ? (
        <div className={`mt-2 flex items-center gap-1 text-sm font-semibold ${direction === "up" ? "text-emerald-700" : "text-red-600"}`}>
          {direction === "up" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {Math.abs(compareValue).toFixed(1)}%
        </div>
      ) : null}
    </Card>
  );
}

function DashboardSectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-ink/55">{eyebrow}</div>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
    </div>
  );
}

function AlertPill({ alert }: { alert: AlertItem }) {
  const styles = {
    danger: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700"
  }[alert.level];
  const Icon = alert.level === "danger" ? CircleAlert : alert.level === "warning" ? AlertTriangle : CircleCheck;

  return (
    <div className={`flex items-center gap-2 rounded border px-3 py-3 text-sm font-semibold ${styles}`}>
      <Icon size={17} />
      <span>{alert.text}</span>
    </div>
  );
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-2 text-sm font-semibold ${active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"}`}
    >
      {children}
    </button>
  );
}

function TrendChart({ data, metric }: { data: SalesPoint[]; metric: TrendMetric }) {
  const maxValue = Math.max(1, ...data.map((item) => item[metric]));
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
    const y = 100 - (item[metric] / maxValue) * 92;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div>
      <div className="h-72 rounded border border-line bg-panel p-4">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline fill="none" stroke="#217f57" strokeWidth="2.2" points={points} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-ink/60" style={{ gridTemplateColumns: `repeat(${Math.min(data.length, 12)}, minmax(0, 1fr))` }}>
        {sampleLabels(data).map((item) => (
          <span key={item.date}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function MonthlyBars({ data, metric }: { data: SalesPoint[]; metric: TrendMetric }) {
  const maxValue = Math.max(1, ...data.map((item) => item[metric]));
  return (
    <div className="grid grid-cols-6 gap-2 xl:grid-cols-12">
      {data.map((item) => (
        <div key={item.date} className="rounded border border-line bg-panel p-2">
          <div className="text-xs font-semibold text-ink/60">{item.label}</div>
          <div className="mt-1 text-sm font-semibold text-ink">{metric === "revenue" ? shortWon(item.revenue) : item.quantity}</div>
          <div className="mt-3 flex h-24 items-end rounded bg-white px-1">
            <div className="w-full rounded-t bg-brand" style={{ height: `${Math.max(4, (item[metric] / maxValue) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysisTable({ title, rows, valueLabel, valueKey }: { title: string; rows: TopSaleRow[]; valueLabel: string; valueKey: "quantity" | "profit" }) {
  return (
    <Card>
      <DashboardSectionTitle eyebrow="SKU经营分析" title={title} />
      <Table>
        <thead>
          <tr>
            <Th>排名</Th>
            <Th>SKU</Th>
            <Th>销量</Th>
            <Th>{valueLabel}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sku}>
              <Td>{index + 1}</Td>
              <Td>{row.sku}</Td>
              <Td>{row.quantity}</Td>
              <Td>{valueKey === "profit" ? won(row.profit) : row[valueKey]}</Td>
            </tr>
          ))}
          {!rows.length ? <EmptyRow columns={4} /> : null}
        </tbody>
      </Table>
    </Card>
  );
}

function DonutChart({ items }: { items: HealthItem[] }) {
  let start = 0;
  const stops = items.map((item) => {
    const end = start + item.percent;
    const stop = `${item.color} ${start}% ${end}%`;
    start = end;
    return stop;
  }).join(", ");

  return (
    <div className="flex h-44 w-44 items-center justify-center rounded-full" style={{ background: `conic-gradient(${stops || "#e6ece6 0% 100%"})` }}>
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-center">
        <div>
          <div className="text-xs text-ink/55">健康库存</div>
          <div className="text-2xl font-semibold text-ink">{items[0]?.percent ?? 0}%</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SmartReplenishmentRow["status"] }) {
  const config = {
    danger: ["危险", "bg-red-50 text-red-700 border-red-200"],
    warning: ["注意", "bg-amber-50 text-amber-700 border-amber-200"],
    normal: ["正常", "bg-emerald-50 text-emerald-700 border-emerald-200"]
  }[status];
  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${config[1]}`}>{config[0]}</span>;
}

function LifecycleBadge({ label }: { label: string }) {
  const color = label === "爆款增长" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    label === "销量下降" ? "bg-amber-50 text-amber-700 border-amber-200" :
      label === "滞销" ? "bg-red-50 text-red-700 border-red-200" :
        "bg-panel text-ink border-line";
  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function EmptyRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }, (_, index) => (
        <Td key={index}>{index === 0 ? "暂无数据" : "-"}</Td>
      ))}
    </tr>
  );
}

type SmartReplenishmentRow = ReplenishmentRow & {
  saleableDays: number;
  status: "danger" | "warning" | "normal";
  action: string;
};

function buildSmartReplenishment(rows: ReplenishmentRow[]): SmartReplenishmentRow[] {
  return rows.map((row) => {
    const saleableDays = row.dailyAverage > 0 ? Math.floor(row.currentStock / row.dailyAverage) : 999;
    const status: SmartReplenishmentRow["status"] = saleableDays < 7 ? "danger" : saleableDays < 15 ? "warning" : "normal";
    const action = status === "danger" ? "立即采购" : status === "warning" ? "7天内采购" : "无需采购";

    return { ...row, saleableDays, status, action };
  }).sort((a, b) => {
    if (b.suggestedQty !== a.suggestedQty) return b.suggestedQty - a.suggestedQty;
    return a.saleableDays - b.saleableDays;
  });
}

function buildAlerts(input: {
  rows: SmartReplenishmentRow[];
  sales7: number;
  sales30: number;
  monthRevenue: number;
  previousMonthRevenue: number;
  monthProfit: number;
  previousMonthProfit: number;
}): AlertItem[] {
  const dangerCount = input.rows.filter((row) => row.saleableDays < 7).length;
  const warningCount = input.rows.filter((row) => row.saleableDays >= 7 && row.saleableDays < 15).length;
  const stockoutCount = input.rows.filter((row) => row.dailyAverage > 0 && row.currentStock <= row.dailyAverage * 3).length;
  const suggestedCount = input.rows.filter((row) => row.suggestedQty > 0).length;
  const monthRevenueGrowth = compare(input.monthRevenue, input.previousMonthRevenue);
  const monthProfitGrowth = compare(input.monthProfit, input.previousMonthProfit);
  const alerts: AlertItem[] = [];

  if (dangerCount) alerts.push({ level: "danger", text: `${dangerCount}个SKU库存低于7天` });
  if (stockoutCount) alerts.push({ level: "danger", text: `${stockoutCount}个SKU即将断货` });
  if (warningCount) alerts.push({ level: "warning", text: `${warningCount}个SKU需要关注库存` });
  if (suggestedCount) alerts.push({ level: "warning", text: `${suggestedCount}个SKU建议补货` });
  if (monthRevenueGrowth != null && monthRevenueGrowth > 0) alerts.push({ level: "success", text: `本月销售增长${monthRevenueGrowth.toFixed(1)}%` });
  if (monthProfitGrowth != null && monthProfitGrowth > 0) alerts.push({ level: "success", text: `本月利润增长${monthProfitGrowth.toFixed(1)}%` });

  return alerts;
}

type TopSaleRow = { sku: string; quantity: number; revenue: number; profit: number };

function buildTopSales(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>, sortBy: "quantity" | "profit") {
  const map = new Map<string, TopSaleRow>();

  for (const sale of validSales(salesRows)) {
    const product = productMap.get(sale.product_id);
    if (!product) continue;
    const current = map.get(product.sku) ?? { sku: product.sku, quantity: 0, revenue: 0, profit: 0 };
    const quantity = Number(sale.quantity);
    current.quantity += quantity;
    current.revenue += quantity * money(product.sale_price);
    current.profit += quantity * (money(product.sale_price) - money(product.purchase_price));
    map.set(product.sku, current);
  }

  return Array.from(map.values()).sort((a, b) => b[sortBy] - a[sortBy]).slice(0, 8);
}

type HealthItem = { label: string; value: number; percent: number; color: string };

function buildInventoryHealth(rows: SmartReplenishmentRow[], slowMoving: ReplenishmentRow[]): HealthItem[] {
  const total = Math.max(1, rows.length);
  const slowIds = new Set(slowMoving.map((row) => row.product.id));
  const danger = rows.filter((row) => row.status === "danger").length;
  const warning = rows.filter((row) => row.status === "warning").length;
  const slow = rows.filter((row) => slowIds.has(row.product.id)).length;
  const healthy = Math.max(0, total - danger - warning - slow);
  const inTransit = rows.reduce((sum, row) => sum + row.openPurchaseQty, 0);
  const items = [
    { label: "健康库存", value: healthy, color: "#217f57" },
    { label: "危险库存", value: danger, color: "#dc2626" },
    { label: "即将缺货", value: warning, color: "#d97706" },
    { label: "滞销库存", value: slow, color: "#64748b" },
    { label: "在途库存", value: inTransit, color: "#2563eb" }
  ];
  const denominator = Math.max(1, healthy + danger + warning + slow + inTransit);

  return items.map((item) => ({
    ...item,
    percent: Math.round((item.value / denominator) * 100)
  }));
}

function buildLifecycleRows(rows: ReplenishmentRow[], salesRows: SaleDaily[]) {
  const productSales = new Map<string, { recent: number; previous: number }>();
  const today = new Date();
  const recentStart = daysAgoKey(today, 29);
  const previousStart = daysAgoKey(today, 89);

  for (const sale of validSales(salesRows)) {
    const current = productSales.get(sale.product_id) ?? { recent: 0, previous: 0 };
    if (sale.sale_date >= recentStart) current.recent += sale.quantity;
    else if (sale.sale_date >= previousStart) current.previous += sale.quantity;
    productSales.set(sale.product_id, current);
  }

  return rows.map((row) => {
    const stats = productSales.get(row.product.id) ?? { recent: 0, previous: 0 };
    const lifecycle = stats.recent === 0 ? "滞销" :
      stats.previous > 0 && stats.recent >= stats.previous * 1.3 ? "爆款增长" :
        stats.previous > 0 && stats.recent <= stats.previous * 0.7 ? "销量下降" :
          "稳定销售";
    const saleableDays = row.dailyAverage > 0 ? Math.floor(row.currentStock / row.dailyAverage) : 999;

    return { ...row, saleableDays, lifecycle };
  }).sort((a, b) => b.salesInWindow - a.salesInWindow);
}

function buildSalesMetrics(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>) {
  return validSales(salesRows).reduce((metrics, sale) => {
    const product = productMap.get(sale.product_id);
    const quantity = Number(sale.quantity);
    const salePrice = money(product?.sale_price);
    const purchasePrice = money(product?.purchase_price);

    metrics.quantity += quantity;
    metrics.revenue += quantity * salePrice;
    metrics.profit += quantity * (salePrice - purchasePrice);
    return metrics;
  }, { quantity: 0, revenue: 0, profit: 0 });
}

function buildDailySalesPoints(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>, days: number): SalesPoint[] {
  const today = new Date();
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const key = toDateKey(date);
    return { date: key, label: `${date.getMonth() + 1}/${date.getDate()}`, quantity: 0, revenue: 0, profit: 0 };
  });
  const map = new Map(points.map((point) => [point.date, point]));

  for (const sale of validSales(salesRows)) {
    const point = map.get(sale.sale_date);
    const product = productMap.get(sale.product_id);
    if (!point || !product) continue;
    point.quantity += sale.quantity;
    point.revenue += sale.quantity * money(product.sale_price);
    point.profit += sale.quantity * (money(product.sale_price) - money(product.purchase_price));
  }

  return points;
}

function buildMonthlySalesPoints(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>, year: number): SalesPoint[] {
  const months = Array.from({ length: 12 }, (_, index) => ({
    date: `${year}-${String(index + 1).padStart(2, "0")}`,
    label: `${index + 1}月`,
    quantity: 0,
    revenue: 0,
    profit: 0
  }));

  for (const sale of validSales(salesRows)) {
    const [saleYear, saleMonth] = sale.sale_date.split("-").map(Number);
    const product = productMap.get(sale.product_id);
    if (saleYear !== year || !saleMonth || !product) continue;
    const point = months[saleMonth - 1];
    point.quantity += sale.quantity;
    point.revenue += sale.quantity * money(product.sale_price);
    point.profit += sale.quantity * (money(product.sale_price) - money(product.purchase_price));
  }

  return months;
}

function validSales(salesRows: SaleDaily[]) {
  return salesRows
    .map((sale) => ({ ...sale, quantity: Math.max(0, Number(sale.quantity ?? 0)) }))
    .filter((sale) => Boolean(sale.product_id) && Boolean(sale.sale_date) && sale.quantity > 0);
}

function sumTypedMovements(movements: Array<{ type: string; quantity: number; memo: string | null }>, target: "return_inbound" | "loss") {
  return movements.reduce((sum, movement) => {
    const memo = String(movement.memo ?? "");
    const isReturnInbound =
      target === "return_inbound" &&
      (movement.type === "return_inbound" ||
        memo.startsWith("\u9000\u8d27\u5165\u5e93\u5728\u552e") ||
        memo.startsWith("\ubc18\ud488 \uc785\uace0 \ud310\ub9e4\uac00\ub2a5"));
    const isLoss =
      target === "loss" &&
      (movement.type === "loss" ||
        memo.startsWith("\u635f\u8017\u4e22\u5931") ||
        memo.startsWith("\uc190\uc0c1/\ubd84\uc2e4"));

    return isReturnInbound || isLoss ? sum + Math.max(0, Number(movement.quantity ?? 0)) : sum;
  }, 0);
}

function hasRecentSale(productId: string, salesRows: SaleDaily[]) {
  return validSales(salesRows).some((sale) => sale.product_id === productId);
}

function rangeDays(range: TrendRange) {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

function compare(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function sampleLabels(data: SalesPoint[]) {
  if (data.length <= 12) return data;
  const step = Math.ceil(data.length / 12);
  return data.filter((_, index) => index % step === 0 || index === data.length - 1);
}

function formatSaleableDays(days: number) {
  return days >= 999 ? "暂无销量" : `${days}天`;
}

function stockoutDate(days: number) {
  if (days >= 999) return "暂无风险";
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, days));
  return toDateKey(date);
}

function isCurrentMonth(dateKey: string) {
  const now = new Date();
  return dateKey.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
}

function isPreviousMonth(dateKey: string) {
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return dateKey.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`);
}

function buildYearOptions() {
  return [2025, 2026, 2027];
}

function daysAgoKey(today: Date, daysAgo: number) {
  const date = new Date(today);
  date.setDate(today.getDate() - daysAgo);
  return toDateKey(date);
}

function toDateKey(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function money(value: number | null | undefined) {
  return Number(value ?? 0);
}

function won(value: number) {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function shortWon(value: number) {
  if (value >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₩${Math.round(value / 1_000)}K`;
  return won(value);
}
