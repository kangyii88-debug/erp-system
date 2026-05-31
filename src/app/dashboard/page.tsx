"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CircleAlert, CircleCheck } from "lucide-react";
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

type ViewMode = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
type TrendMetric = "quantity" | "revenue";
type SalesPoint = { date: string; label: string; quantity: number; revenue: number; profit: number };
type AlertItem = { level: "danger" | "warning" | "success"; text: string };
type MovementRow = { type: string; quantity: number; happened_at: string; memo: string | null };

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
  const [salesRows, setSalesRows] = useState<SaleDaily[]>([]);
  const [salesYearRows, setSalesYearRows] = useState<SaleDaily[]>([]);
  const [salesAllRows, setSalesAllRows] = useState<SaleDaily[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("revenue");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const anchorDate = parseDateKey(selectedDate);
  const range = buildRange(viewMode, anchorDate);
  const comparisonRange = buildComparisonRange(range);

  useEffect(() => {
    setSelectedYear(parseDateKey(selectedDate).getFullYear());
  }, [selectedDate]);

  useEffect(() => {
    load();
  }, [selectedDate, selectedYear]);

  async function load() {
    setLoading(true);

    const anchor = parseDateKey(selectedDate);
    const salesStart = daysAgoKey(anchor, 89);
    const salesEnd = toDateKey(anchor);
    const replenishStart = daysAgoKey(anchor, SALES_ANALYSIS_DAYS - 1);
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const [
      { data: products },
      { data: sales90 },
      { data: sales30 },
      { data: salesYear },
      { data: allSales },
      { data: purchases },
      { data: movementRows }
    ] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("created_at", { ascending: false }),
      supabase.from("sales_daily").select("*").gte("sale_date", salesStart).lte("sale_date", salesEnd),
      supabase.from("sales_daily").select("*").gte("sale_date", replenishStart).lte("sale_date", salesEnd),
      supabase.from("sales_daily").select("*").gte("sale_date", yearStart).lte("sale_date", yearEnd),
      supabase.from("sales_daily").select("*"),
      supabase.from("purchase_orders").select("*, products(name, sku)"),
      supabase.from("stock_movements").select("type, quantity, happened_at, memo")
    ]);

    setRows(
      buildReplenishmentRows(
        (products ?? []) as ProductWithStock[],
        (sales30 ?? []) as SaleDaily[],
        (purchases ?? []) as PurchaseOrder[]
      )
    );
    setSalesRows((sales90 ?? []) as SaleDaily[]);
    setSalesYearRows((salesYear ?? []) as SaleDaily[]);
    setSalesAllRows((allSales ?? []) as SaleDaily[]);
    setMovements((movementRows ?? []) as MovementRow[]);
    setLoading(false);
  }

  const productMap = useMemo(() => new Map(rows.map((row) => [row.product.id, row.product])), [rows]);
  const rangeSales = salesAllRows.filter((sale) => isBetween(sale.sale_date, range.start, range.end));
  const comparisonSales = salesAllRows.filter((sale) => isBetween(sale.sale_date, comparisonRange.start, comparisonRange.end));
  const selectedDayMovements = movements.filter((movement) => movement.happened_at.slice(0, 10) === range.end);
  const salesWindowRows = salesRows.filter((sale) => isBetween(sale.sale_date, daysAgoKey(anchorDate, 29), range.end));
  const salesSummary = summarizeSales(salesWindowRows);
  const trendDays = viewMode === "30d" ? 30 : viewMode === "month" ? daysInRange(range) : 7;

  const totalStock = rows.reduce((sum, row) => sum + row.currentStock, 0);
  const skuCount = rows.length;
  const stockValue = rows.reduce((sum, row) => sum + row.currentStock * money(row.product.purchase_price), 0);
  const saleableDays = salesSummary.averageDailySales > 0 ? Math.floor(totalStock / salesSummary.averageDailySales) : 0;
  const rangeMetrics = buildSalesMetrics(rangeSales, productMap);
  const comparisonMetrics = buildSalesMetrics(comparisonSales, productMap);
  const refundOrders = countTypedMovements(selectedDayMovements, "return_inbound");
  const cancelOrders = 0;
  const replenishRows = buildSmartReplenishment(rows);
  const riskyRows = replenishRows.filter((row) => row.status !== "normal").sort((a, b) => a.saleableDays - b.saleableDays).slice(0, 12);
  const alerts = buildAlerts({
    rows: replenishRows,
    rangeRevenue: rangeMetrics.revenue,
    comparisonRevenue: comparisonMetrics.revenue,
    rangeProfit: rangeMetrics.profit,
    comparisonProfit: comparisonMetrics.profit
  });
  const trendData = buildDailySalesPoints(salesRows, productMap, trendDays, anchorDate);
  const annualData = buildMonthlySalesPoints(salesYearRows, productMap, selectedYear);
  const topSales = buildTopSales(rangeSales, productMap, "quantity");
  const topProfit = buildTopSales(rangeSales, productMap, "profit");
  const slowMoving = rows
    .filter((row) => row.currentStock > 0 && !hasRecentSale(row.product.id, salesWindowRows))
    .sort((a, b) => b.currentStock * money(b.product.purchase_price) - a.currentStock * money(a.product.purchase_price))
    .slice(0, 10);
  const health = buildInventoryHealth(replenishRows, slowMoving);
  const lifecycleRows = buildLifecycleRows(rows, salesRows, anchorDate);

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader title="经营驾驶舱" />
        <DateControl
          selectedDate={selectedDate}
          viewMode={viewMode}
          rangeLabel={formatRangeLabel(range)}
          onDateChange={(date) => {
            setSelectedDate(date);
            setViewMode("custom");
          }}
          onModeChange={(mode) => {
            setViewMode(mode);
            if (mode === "today") setSelectedDate(toDateKey(new Date()));
            if (mode === "yesterday") setSelectedDate(daysAgoKey(new Date(), 1));
          }}
        />
      </div>

      <div className={`space-y-6 transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ExecutiveKpi label={`${range.label}销售额`} value={won(rangeMetrics.revenue)} compare={compare(rangeMetrics.revenue, comparisonMetrics.revenue)} />
          <ExecutiveKpi label={`${range.label}订单数`} value={rangeMetrics.quantity} compare={compare(rangeMetrics.quantity, comparisonMetrics.quantity)} />
          <ExecutiveKpi label={`${range.label}销量`} value={rangeMetrics.quantity} compare={compare(rangeMetrics.quantity, comparisonMetrics.quantity)} />
          <ExecutiveKpi label={`${range.label}利润`} value={won(rangeMetrics.profit)} compare={compare(rangeMetrics.profit, comparisonMetrics.profit)} />
          <ExecutiveKpi label="退款订单" value={refundOrders} />
          <ExecutiveKpi label="取消订单" value={cancelOrders} muted />
          <ExecutiveKpi label="当前库存金额" value={won(stockValue)} />
          <ExecutiveKpi label="当前SKU总数" value={skuCount} />
        </section>

        <section>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <DashboardSectionTitle eyebrow="今日重点提醒" title="需要负责人优先处理的事项" />
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

        <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <DashboardSectionTitle eyebrow="销售趋势中心" title={`${trendData[0]?.label ?? ""} - ${trendData[trendData.length - 1]?.label ?? ""}`} />
              <div className="flex gap-2">
                <SegmentButton active={trendMetric === "revenue"} onClick={() => setTrendMetric("revenue")}>销售额</SegmentButton>
                <SegmentButton active={trendMetric === "quantity"} onClick={() => setTrendMetric("quantity")}>销量</SegmentButton>
              </div>
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

        <section>
          <Card>
            <DashboardSectionTitle eyebrow="智能补货中心" title="哪些商品要补货" />
            <div className="mt-4">
              {loading ? (
                <div className="rounded border border-line bg-panel p-6 text-sm text-ink/60">数据加载中...</div>
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
                    {!replenishRows.length ? <EmptyRow columns={8} /> : null}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
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

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <DashboardSectionTitle eyebrow="库存健康中心" title="库存健康度" />
            <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
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
                    <Td>{stockoutDate(row.saleableDays, anchorDate)}</Td>
                    <Td>{won(Math.max(0, (REPLENISHMENT_CYCLE_DAYS - row.saleableDays) * row.dailyAverage * money(row.product.sale_price)))}</Td>
                  </tr>
                ))}
                {!riskyRows.length ? <EmptyRow columns={5} /> : null}
              </tbody>
            </Table>
          </Card>
        </section>

        <section>
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
      </div>
    </>
  );
}

function DateControl({
  selectedDate,
  viewMode,
  rangeLabel,
  onDateChange,
  onModeChange
}: {
  selectedDate: string;
  viewMode: ViewMode;
  rangeLabel: string;
  onDateChange: (date: string) => void;
  onModeChange: (mode: ViewMode) => void;
}) {
  const buttons: Array<{ key: ViewMode; label: string }> = [
    { key: "today", label: "今天" },
    { key: "yesterday", label: "昨天" },
    { key: "7d", label: "近7天" },
    { key: "30d", label: "近30天" },
    { key: "month", label: "本月" }
  ];

  return (
    <div className="rounded border border-line bg-white p-3 shadow-soft">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarDays size={16} />
        日期选择查看模式
        <span className="ml-auto text-xs font-medium text-ink/55">{rangeLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="w-40" type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
        {buttons.map((button) => (
          <SegmentButton key={button.key} active={viewMode === button.key} onClick={() => onModeChange(button.key)}>
            {button.label}
          </SegmentButton>
        ))}
      </div>
    </div>
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
  rangeRevenue: number;
  comparisonRevenue: number;
  rangeProfit: number;
  comparisonProfit: number;
}): AlertItem[] {
  const dangerCount = input.rows.filter((row) => row.saleableDays < 7).length;
  const warningCount = input.rows.filter((row) => row.saleableDays >= 7 && row.saleableDays < 15).length;
  const stockoutCount = input.rows.filter((row) => row.dailyAverage > 0 && row.currentStock <= row.dailyAverage * 3).length;
  const suggestedCount = input.rows.filter((row) => row.suggestedQty > 0).length;
  const revenueGrowth = compare(input.rangeRevenue, input.comparisonRevenue);
  const profitGrowth = compare(input.rangeProfit, input.comparisonProfit);
  const alerts: AlertItem[] = [];

  if (dangerCount) alerts.push({ level: "danger", text: `${dangerCount}个SKU库存低于7天` });
  if (stockoutCount) alerts.push({ level: "danger", text: `${stockoutCount}个SKU即将断货` });
  if (warningCount) alerts.push({ level: "warning", text: `${warningCount}个SKU需要关注库存` });
  if (suggestedCount) alerts.push({ level: "warning", text: `${suggestedCount}个SKU建议补货` });
  if (revenueGrowth != null && revenueGrowth > 0) alerts.push({ level: "success", text: `销售额增长${revenueGrowth.toFixed(1)}%` });
  if (profitGrowth != null && profitGrowth > 0) alerts.push({ level: "success", text: `利润增长${profitGrowth.toFixed(1)}%` });

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

function buildLifecycleRows(rows: ReplenishmentRow[], salesRows: SaleDaily[], anchorDate: Date) {
  const productSales = new Map<string, { recent: number; previous: number }>();
  const recentStart = daysAgoKey(anchorDate, 29);
  const previousStart = daysAgoKey(anchorDate, 89);

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

function buildDailySalesPoints(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>, days: number, anchorDate: Date): SalesPoint[] {
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(anchorDate);
    date.setDate(anchorDate.getDate() - (days - 1 - index));
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

function countTypedMovements(movements: MovementRow[], target: "return_inbound" | "loss") {
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

type DateRange = { start: string; end: string; label: string };

function buildRange(mode: ViewMode, anchorDate: Date): DateRange {
  const end = toDateKey(anchorDate);
  if (mode === "7d") return { start: daysAgoKey(anchorDate, 6), end, label: "近7天" };
  if (mode === "30d") return { start: daysAgoKey(anchorDate, 29), end, label: "近30天" };
  if (mode === "month") return { start: monthStartKey(anchorDate), end, label: "本月" };
  if (mode === "yesterday") return { start: end, end, label: "昨日" };
  if (mode === "custom") return { start: end, end, label: "所选日期" };
  return { start: end, end, label: "今日" };
}

function buildComparisonRange(range: DateRange): DateRange {
  const start = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  const days = daysInRange(range);
  const comparisonEnd = new Date(start);
  comparisonEnd.setDate(start.getDate() - 1);
  const comparisonStart = new Date(comparisonEnd);
  comparisonStart.setDate(comparisonEnd.getDate() - (days - 1));
  return { start: toDateKey(comparisonStart), end: toDateKey(comparisonEnd), label: "对比周期" };
}

function daysInRange(range: DateRange) {
  const start = parseDateKey(range.start).getTime();
  const end = parseDateKey(range.end).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function formatRangeLabel(range: DateRange) {
  return range.start === range.end ? range.end : `${range.start} ~ ${range.end}`;
}

function isBetween(dateKey: string, start: string, end: string) {
  return dateKey >= start && dateKey <= end;
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

function stockoutDate(days: number, anchorDate: Date) {
  if (days >= 999) return "暂无风险";
  const date = new Date(anchorDate);
  date.setDate(anchorDate.getDate() + Math.max(0, days));
  return toDateKey(date);
}

function buildYearOptions() {
  return [2025, 2026, 2027];
}

function monthStartKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function daysAgoKey(today: Date, daysAgo: number) {
  const date = new Date(today);
  date.setDate(today.getDate() - daysAgo);
  return toDateKey(date);
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
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
