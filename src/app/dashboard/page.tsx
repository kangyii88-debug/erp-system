"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CircleAlert, CircleCheck } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { money, profitMargin, totalProfit, unitProfit } from "@/lib/profit";
import {
  buildReplenishmentRows,
  REPLENISHMENT_CYCLE_DAYS,
  SALES_ANALYSIS_DAYS,
  summarizeSales,
  type ReplenishmentRow
} from "@/lib/replenishment";
import type { ProductWithStock, PurchaseOrder, SaleDaily } from "@/lib/types";

type ViewMode = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
type TrendMetric = "orders" | "quantity";
type AnnualMetric = "quantity" | "orders" | "revenue";
type SalesPoint = { date: string; label: string; orders: number; quantity: number; revenue: number; profit: number };
type AnnualPoint = SalesPoint & {
  month: number;
  previousOrders: number;
  previousQuantity: number;
  previousRevenue: number;
  previousProfit: number;
};
type AlertItem = { level: "danger" | "warning" | "success"; text: string };
type MovementRow = { type: string; quantity: number; happened_at: string; memo: string | null };
type TFunction = ReturnType<typeof useLanguage>["t"];

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { t, formatCurrency, formatDate, formatNumber } = useLanguage();
  const [rows, setRows] = useState<ReplenishmentRow[]>([]);
  const [salesRows, setSalesRows] = useState<SaleDaily[]>([]);
  const [salesYearRows, setSalesYearRows] = useState<SaleDaily[]>([]);
  const [salesPreviousYearRows, setSalesPreviousYearRows] = useState<SaleDaily[]>([]);
  const [salesAllRows, setSalesAllRows] = useState<SaleDaily[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("quantity");
  const [annualMetric, setAnnualMetric] = useState<AnnualMetric>("quantity");
  const [comparePreviousYear, setComparePreviousYear] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const anchorDate = parseDateKey(selectedDate);
  const range = buildRange(viewMode, anchorDate, t);
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
    const previousYearStart = `${selectedYear - 1}-01-01`;
    const previousYearEnd = `${selectedYear - 1}-12-31`;

    const [
      { data: products },
      { data: sales90 },
      { data: sales30 },
      { data: salesYear },
      { data: salesPreviousYear },
      { data: allSales },
      { data: purchases },
      { data: movementRows }
    ] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("created_at", { ascending: false }),
      supabase.from("sales_daily").select("*").gte("sale_date", salesStart).lte("sale_date", salesEnd),
      supabase.from("sales_daily").select("*").gte("sale_date", replenishStart).lte("sale_date", salesEnd),
      supabase.from("sales_daily").select("*").gte("sale_date", yearStart).lte("sale_date", yearEnd),
      supabase.from("sales_daily").select("*").gte("sale_date", previousYearStart).lte("sale_date", previousYearEnd),
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
    setSalesPreviousYearRows((salesPreviousYear ?? []) as SaleDaily[]);
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
  const trendDays = viewMode === "30d" ? 30 : viewMode === "month" ? daysInRange(range) : viewMode === "custom" ? 7 : viewMode === "7d" ? 7 : 7;

  const totalStock = rows.reduce((sum, row) => sum + row.currentStock, 0);
  const skuCount = rows.length;
  const stockValue = rows.reduce((sum, row) => sum + row.currentStock * money(row.product.purchase_price), 0);
  const saleableDays = salesSummary.averageDailySales > 0 ? Math.floor(totalStock / salesSummary.averageDailySales) : 0;
  const rangeMetrics = buildSalesMetrics(rangeSales, productMap);
  const comparisonMetrics = buildSalesMetrics(comparisonSales, productMap);
  const refundOrders = countTypedMovements(selectedDayMovements, "return_inbound");
  const cancelOrders = 0;
  const replenishRows = buildSmartReplenishment(rows, t);
  const riskyRows = replenishRows.filter((row) => row.status !== "normal").sort((a, b) => a.saleableDays - b.saleableDays).slice(0, 12);
  const alerts = buildAlerts({
    rows: replenishRows,
    rangeRevenue: rangeMetrics.revenue,
    comparisonRevenue: comparisonMetrics.revenue,
    rangeProfit: rangeMetrics.profit,
    comparisonProfit: comparisonMetrics.profit
  }, t);
  const trendData = buildDailySalesPoints(salesRows, productMap, trendDays, anchorDate);
  const comparisonTrendData = buildDailySalesPoints(salesAllRows, productMap, trendDays, parseDateKey(comparisonRange.end));
  const annualData = buildAnnualTrendPoints(salesYearRows, salesPreviousYearRows, productMap, selectedYear, t);
  const topSales = buildTopSkuPerformance(rangeSales, productMap, "quantity");
  const topProfit = buildTopSkuPerformance(rangeSales, productMap, "profit");
  const slowMoving = rows
    .filter((row) => row.currentStock > 0 && !hasRecentSale(row.product.id, salesWindowRows))
    .sort((a, b) => b.currentStock * money(b.product.purchase_price) - a.currentStock * money(a.product.purchase_price))
    .slice(0, 10);
  const health = buildInventoryHealth(replenishRows, slowMoving, t);
  const lifecycleRows = buildLifecycleRows(rows, salesRows, anchorDate, t);

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader title={t("dashboard.title")} />
        <DateControl
          selectedDate={selectedDate}
          viewMode={viewMode}
          rangeLabel={formatRangeLabel(range, formatDate)}
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
          <ExecutiveKpi label={`${range.label}${t("common.revenue")}`} value={formatCurrency(rangeMetrics.revenue)} compare={compare(rangeMetrics.revenue, comparisonMetrics.revenue)} />
          <ExecutiveKpi label={`${range.label}${t("common.orderCount")}`} value={rangeMetrics.quantity} compare={compare(rangeMetrics.quantity, comparisonMetrics.quantity)} />
          <ExecutiveKpi label={`${range.label}${t("common.salesQuantity")}`} value={rangeMetrics.quantity} compare={compare(rangeMetrics.quantity, comparisonMetrics.quantity)} />
          <ExecutiveKpi label={`${range.label}${t("common.profit")}`} value={formatCurrency(rangeMetrics.profit)} compare={compare(rangeMetrics.profit, comparisonMetrics.profit)} />
          <ExecutiveKpi label={t("dashboard.kpi.refundOrders")} value={refundOrders} />
          <ExecutiveKpi label={t("dashboard.kpi.cancelOrders")} value={cancelOrders} muted />
          <ExecutiveKpi label={t("dashboard.kpi.stockValue")} value={formatCurrency(stockValue)} />
          <ExecutiveKpi label={t("dashboard.kpi.currentSkuCount")} value={skuCount} />
        </section>

        <section>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <DashboardSectionTitle eyebrow={t("dashboard.section.reminders")} title={t("dashboard.section.remindersTitle")} />
              <span className="rounded bg-panel px-3 py-1 text-sm font-semibold text-ink">{alerts.length} {t("unit.item")}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {alerts.map((alert) => (
                <AlertPill key={alert.text} alert={alert} />
              ))}
              {!alerts.length ? <AlertPill alert={{ level: "success", text: t("dashboard.alert.allGood") }} /> : null}
            </div>
          </Card>
        </section>

        <section className="grid gap-4">
          <Card>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <DashboardSectionTitle eyebrow={t("dashboard.trend.center")} title={`${trendData[0]?.label ?? ""} - ${trendData[trendData.length - 1]?.label ?? ""}`} />
              <div className="flex flex-wrap gap-2">
                <SegmentButton active={trendMetric === "orders"} onClick={() => setTrendMetric("orders")}>{t("common.orderCount")}</SegmentButton>
                <SegmentButton active={trendMetric === "quantity"} onClick={() => setTrendMetric("quantity")}>{t("common.salesQuantity")}</SegmentButton>
                <span className="mx-1 h-9 w-px bg-line" />
                {(["7d", "30d", "month", "custom"] as ViewMode[]).map((mode) => (
                  <SegmentButton key={mode} active={viewMode === mode} onClick={() => setViewMode(mode)}>
                    {mode === "7d" ? t("period.7d") : mode === "30d" ? t("period.30d") : mode === "month" ? t("period.month") : t("period.custom")}
                  </SegmentButton>
                ))}
              </div>
            </div>
            <TrendChart data={trendData} comparisonData={comparisonTrendData} metric={trendMetric} />
          </Card>

          <Card>
            <div className="hidden">
              <DashboardSectionTitle eyebrow={t("dashboard.annual.trend")} title={t("dashboard.annual.trend")} />
              <div className="flex rounded-xl border border-line bg-panel p-1">
                {buildYearOptions().map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${selectedYear === year ? "bg-brand text-white shadow-soft" : "text-ink/65 hover:bg-white"}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
            <AnnualTrendModule
              data={annualData}
              year={selectedYear}
              metric={annualMetric}
              comparePreviousYear={comparePreviousYear}
              onMetricChange={setAnnualMetric}
              onYearChange={setSelectedYear}
              onCompareChange={setComparePreviousYear}
            />
          </Card>
        </section>

        <section>
          <Card>
            <DashboardSectionTitle eyebrow={t("dashboard.replenishment.section")} title={t("dashboard.replenishment.title")} />
            <div className="mt-4">
              {loading ? (
                <div className="rounded border border-line bg-panel p-6 text-sm text-ink/60">{t("common.loading")}...</div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("common.sku")}</Th>
                      <Th>{t("common.productName")}</Th>
                      <Th>{t("common.currentStock")}</Th>
                      <Th>{t("common.salesQuantity")}</Th>
                      <Th>{t("unit.day")}</Th>
                      <Th>{t("common.status")}</Th>
                      <Th>{t("dashboard.replenishment.action")}</Th>
                      <Th>{t("common.quantity")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {replenishRows.slice(0, 14).map((row) => (
                      <tr key={row.product.id}>
                        <Td>{row.product.sku}</Td>
                        <Td>{row.product.name}</Td>
                        <Td>{row.currentStock}</Td>
                        <Td>{row.dailyAverage}</Td>
                        <Td>{formatSaleableDays(row.saleableDays, t)}</Td>
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
          <TopSalesTable rows={topSales} />
          <TopProfitTable rows={topProfit} />
          <Card>
            <DashboardSectionTitle eyebrow={t("dashboard.section.skuAnalysis")} title={t("dashboard.slowMoving.title")} />
            <Table>
              <thead>
                <tr>
                  <Th>{t("common.sku")}</Th>
                  <Th>{t("common.currentStock")}</Th>
                  <Th>{t("dashboard.kpi.stockValue")}</Th>
                </tr>
              </thead>
              <tbody>
                {slowMoving.map((row) => (
                  <tr key={row.product.id}>
                    <Td>{row.product.sku}</Td>
                    <Td>{row.currentStock}</Td>
                    <Td>{formatCurrency(row.currentStock * money(row.product.purchase_price))}</Td>
                  </tr>
                ))}
                {!slowMoving.length ? <EmptyRow columns={3} /> : null}
              </tbody>
            </Table>
          </Card>
        </section>

        <section className="grid gap-4">
          <InventoryHealthCenter summary={health} formatCurrency={formatCurrency} formatNumber={formatNumber} />
          <Card>
            <DashboardSectionTitle eyebrow={t("dashboard.risk.title")} title={t("dashboard.risk.title")} />
            <Table>
              <thead>
                <tr>
                  <Th>{t("common.sku")}</Th>
                  <Th>{t("common.currentStock")}</Th>
                  <Th>{t("unit.day")}</Th>
                  <Th>{t("dashboard.risk.stockoutDate")}</Th>
                  <Th>{t("dashboard.risk.lostRevenue")}</Th>
                </tr>
              </thead>
              <tbody>
                {riskyRows.map((row) => (
                  <tr key={row.product.id}>
                    <Td>{row.product.sku}</Td>
                    <Td>{row.currentStock}</Td>
                    <Td>{formatSaleableDays(row.saleableDays, t)}</Td>
                    <Td>{stockoutDate(row.saleableDays, anchorDate, t)}</Td>
                    <Td>{formatCurrency(Math.max(0, (REPLENISHMENT_CYCLE_DAYS - row.saleableDays) * row.dailyAverage * money(row.product.sale_price)))}</Td>
                  </tr>
                ))}
                {!riskyRows.length ? <EmptyRow columns={5} /> : null}
              </tbody>
            </Table>
          </Card>
        </section>

        <section>
          <Card>
            <DashboardSectionTitle eyebrow={t("dashboard.lifecycle.title")} title={t("dashboard.lifecycle.title")} />
            <Table>
              <thead>
                <tr>
                  <Th>{t("common.sku")}</Th>
                  <Th>{t("common.productName")}</Th>
                  <Th>{t("common.currentStock")}</Th>
                  <Th>{t("common.salesQuantity")}</Th>
                  <Th>{t("common.salesQuantity")}</Th>
                  <Th>{t("unit.day")}</Th>
                  <Th>{t("dashboard.lifecycle.trend")}</Th>
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
                    <Td>{formatSaleableDays(row.saleableDays, t)}</Td>
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
  const { t } = useLanguage();
  const buttons: Array<{ key: ViewMode; label: string }> = [
    { key: "today", label: t("period.today") },
    { key: "yesterday", label: t("period.yesterday") },
    { key: "7d", label: t("period.7d") },
    { key: "30d", label: t("period.30d") },
    { key: "month", label: t("period.month") }
  ];

  return (
    <div className="rounded border border-line bg-white p-3 shadow-soft">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarDays size={16} />
        {t("dashboard.dateControl")}
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

function TrendChart({ data, comparisonData, metric }: { data: SalesPoint[]; comparisonData: SalesPoint[]; metric: TrendMetric }) {
  const { t } = useLanguage();
  const currentTotal = sumMetric(data, metric);
  const previousTotal = sumMetric(comparisonData, metric);
  const growth = compare(currentTotal, previousTotal);
  const bestDay = data.reduce((best, item) => item[metric] > best[metric] ? item : best, data[0] ?? emptyPoint());
  const worstDay = data.reduce((worst, item) => item[metric] < worst[metric] ? item : worst, data[0] ?? emptyPoint());
  const hasData = data.some((item) => item.quantity > 0 || item.orders > 0);
  const trendLabel = metric === "orders" ? t("common.orderCount") : t("common.salesQuantity");
  const analysisText = growth == null
    ? t("dashboard.trend.analysisNoComparison")
    : growth >= 0
      ? t("dashboard.trend.analysisGrowth", { metric: trendLabel, growth: growth.toFixed(1) })
      : t("dashboard.trend.analysisDecline", { metric: trendLabel, growth: Math.abs(growth).toFixed(1) });

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-line bg-gradient-to-br from-white to-panel p-6">
        <TrendSummary data={data} metric={metric} growth={growth} bestDay={bestDay} worstDay={worstDay} />
        <div className="mt-6 flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/70 text-center">
          <div className="text-lg font-semibold text-ink">{t("dashboard.sales.emptyTitle")}</div>
          <div className="mt-2 text-sm text-ink/55">{t("dashboard.sales.emptyHint")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-card via-card to-[#eef3ee] p-5 shadow-soft">
      <TrendSummary data={data} metric={metric} growth={growth} bestDay={bestDay} worstDay={worstDay} />
      <div className="mt-5 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 6 }}>
            <defs>
              <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#17483f" stopOpacity={0.34} />
                <stop offset="55%" stopColor="#17483f" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#17483f" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#d7d9cf" strokeDasharray="4 7" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} width={36} />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#17483f", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="#17483f"
              strokeWidth={3}
              fill="url(#salesTrendFill)"
              activeDot={{ r: 6, stroke: "#fffdf8", strokeWidth: 3, fill: "#17483f" }}
              dot={{ r: 3, stroke: "#17483f", strokeWidth: 2, fill: "#fffdf8" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${growth != null && growth < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
        {analysisText}
      </div>
    </div>
  );
}

function TrendSummary({
  data,
  metric,
  growth,
  bestDay,
  worstDay
}: {
  data: SalesPoint[];
  metric: TrendMetric;
  growth: number | null;
  bestDay: SalesPoint;
  worstDay: SalesPoint;
}) {
  const { t } = useLanguage();
  const peakLabel = metric === "orders" ? t("common.orderCount") : t("common.salesQuantity");
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <MiniTrendCard label={t("dashboard.trend.currentOrders")} value={sumMetric(data, "orders")} />
      <MiniTrendCard label={t("dashboard.trend.currentQuantity")} value={sumMetric(data, "quantity")} />
      <MiniTrendCard label={t("dashboard.trend.periodGrowth")} value={growth == null ? "-" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`} tone={growth != null && growth < 0 ? "down" : "up"} />
      <MiniTrendCard label={t("dashboard.trend.bestMetric", { metric: peakLabel })} value={`${bestDay.label} / ${bestDay[metric]}`} sub={t("dashboard.trend.lowPoint", { label: worstDay.label, value: worstDay[metric] })} />
    </div>
  );
}

function MiniTrendCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-line bg-white/85 p-3">
      <div className="text-xs font-semibold text-ink/55">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone === "down" ? "text-red-600" : tone === "up" ? "text-emerald-700" : "text-ink"}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-ink/55">{sub}</div> : null}
    </div>
  );
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: SalesPoint }> }) {
  const { t, formatCurrency } = useLanguage();
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as SalesPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
      <div className="text-sm font-semibold text-ink">{point.date}</div>
      <div className="mt-2 grid gap-1 text-sm text-ink/75">
        <div>{t("dashboard.tooltip.orders")}: <span className="font-semibold text-ink">{point.orders}</span></div>
        <div>{t("dashboard.tooltip.quantity")}: <span className="font-semibold text-ink">{point.quantity}</span></div>
        <div>{t("dashboard.tooltip.revenue")}: <span className="font-semibold text-ink">{formatCurrency(point.revenue)}</span></div>
      </div>
    </div>
  );
}

function AnnualTrendModule({
  data,
  year,
  metric,
  comparePreviousYear,
  onMetricChange,
  onYearChange,
  onCompareChange
}: {
  data: AnnualPoint[];
  year: number;
  metric: AnnualMetric;
  comparePreviousYear: boolean;
  onMetricChange: (metric: AnnualMetric) => void;
  onYearChange: (year: number) => void;
  onCompareChange: (enabled: boolean) => void;
}) {
  const { t, formatCurrency, formatNumber } = useLanguage();
  const metricKey = metric;
  const previousKey = annualPreviousKey(metric);
  const annualQuantity = sumAnnualMetric(data, "quantity");
  const annualOrders = sumAnnualMetric(data, "orders");
  const currentTotal = sumAnnualMetric(data, metric);
  const previousTotal = sumAnnualPreviousMetric(data, metric);
  const growth = compare(currentTotal, previousTotal);
  const hasData = data.some((item) => item.quantity > 0 || item.orders > 0 || item.revenue > 0);
  const bestMonth = data.reduce((best, item) => item[metricKey] > best[metricKey] ? item : best, data[0] ?? emptyAnnualPoint(year));
  const worstMonth = data.reduce((worst, item) => item[metricKey] < worst[metricKey] ? item : worst, data[0] ?? emptyAnnualPoint(year));
  const insight = buildAnnualInsight(data, metric, growth, bestMonth, worstMonth, t);

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-card via-card to-[#eef3ee] p-5 shadow-soft">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <DashboardSectionTitle eyebrow={t("dashboard.annual.trend")} title={t("dashboard.annual.title", { year })} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-line bg-panel p-1">
            {buildYearOptions().map((optionYear) => (
              <button
                key={optionYear}
                type="button"
                onClick={() => onYearChange(optionYear)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${year === optionYear ? "bg-brand text-white shadow-soft" : "text-ink/65 hover:bg-white"}`}
              >
                {optionYear}
              </button>
            ))}
          </div>
          <SegmentButton active={metric === "quantity"} onClick={() => onMetricChange("quantity")}>{t("dashboard.annual.metricQuantity")}</SegmentButton>
          <SegmentButton active={metric === "orders"} onClick={() => onMetricChange("orders")}>{t("dashboard.annual.metricOrders")}</SegmentButton>
          <SegmentButton active={metric === "revenue"} onClick={() => onMetricChange("revenue")}>{t("dashboard.annual.metricRevenue")}</SegmentButton>
          <button
            type="button"
            onClick={() => onCompareChange(!comparePreviousYear)}
            className={`rounded border px-3 py-2 text-sm font-semibold transition ${comparePreviousYear ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"}`}
          >
            {t("dashboard.annual.comparePreviousYear")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <MiniTrendCard label={t("dashboard.annual.totalQuantity")} value={formatNumber(annualQuantity)} />
        <MiniTrendCard label={t("dashboard.annual.totalOrders")} value={formatNumber(annualOrders)} />
        <MiniTrendCard label={t("dashboard.annual.totalGrowth")} value={growth == null ? "-" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`} tone={growth != null && growth < 0 ? "down" : "up"} />
        <MiniTrendCard label={t("dashboard.annual.bestMonth")} value={bestMonth.label} sub={formatAnnualMetricValue(bestMonth[metricKey], metric, formatCurrency, formatNumber)} />
        <MiniTrendCard label={t("dashboard.annual.worstMonth")} value={worstMonth.label} sub={formatAnnualMetricValue(worstMonth[metricKey], metric, formatCurrency, formatNumber)} />
      </div>

      <div className="mt-6 h-[360px] rounded-2xl border border-line bg-white/80 p-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="annualTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#17483f" stopOpacity={0.32} />
                  <stop offset="55%" stopColor="#17483f" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#17483f" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="annualPreviousFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b9489" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#8b9489" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d7d9cf" strokeDasharray="4 7" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#66706a", fontSize: 12 }}
                width={metric === "revenue" ? 78 : 44}
                tickFormatter={(value) => metric === "revenue" ? shortWon(Number(value)) : formatNumber(Number(value))}
              />
              <Tooltip content={<AnnualTooltip year={year} metric={metric} comparePreviousYear={comparePreviousYear} />} cursor={{ stroke: "#17483f", strokeWidth: 1, strokeDasharray: "4 4" }} />
              {comparePreviousYear ? (
                <Area
                  type="monotone"
                  dataKey={previousKey}
                  name={`${year - 1}`}
                  stroke="#8b9489"
                  strokeWidth={2}
                  fill="url(#annualPreviousFill)"
                  activeDot={{ r: 5, stroke: "#fffdf8", strokeWidth: 2, fill: "#8b9489" }}
                  dot={{ r: 2, stroke: "#8b9489", strokeWidth: 1, fill: "#fffdf8" }}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey={metricKey}
                name={`${year}`}
                stroke="#17483f"
                strokeWidth={3}
                fill="url(#annualTrendFill)"
                activeDot={{ r: 7, stroke: "#fffdf8", strokeWidth: 3, fill: "#17483f" }}
                dot={{ r: 3, stroke: "#17483f", strokeWidth: 2, fill: "#fffdf8" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-line bg-panel/60 text-center">
            <div className="text-lg font-semibold text-ink">{t("dashboard.annual.emptyTitle")}</div>
            <div className="mt-2 text-sm text-ink/55">{t("dashboard.annual.emptyHint")}</div>
          </div>
        )}
      </div>

      <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${growth != null && growth < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
        {insight}
      </div>
    </div>
  );
}

function AnnualTooltip({
  active,
  payload,
  year,
  metric,
  comparePreviousYear
}: {
  active?: boolean;
  payload?: Array<{ payload?: AnnualPoint }>;
  year: number;
  metric: AnnualMetric;
  comparePreviousYear: boolean;
}) {
  const { t, formatCurrency, formatNumber } = useLanguage();
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as AnnualPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
      <div className="text-sm font-semibold text-ink">{year}{t("unit.month")} {point.month}</div>
      <div className="mt-2 grid gap-1 text-sm text-ink/75">
        <div>{t("common.salesQuantity")}: <span className="font-semibold text-ink">{formatNumber(point.quantity)}</span></div>
        <div>{t("common.orderCount")}: <span className="font-semibold text-ink">{formatNumber(point.orders)}</span></div>
        <div>{t("common.revenue")}: <span className="font-semibold text-ink">{formatCurrency(point.revenue)}</span></div>
        {comparePreviousYear ? (
          <div className="mt-1 border-t border-line pt-2 text-ink/60">
            {t("dashboard.annual.previousMonth")}: {formatAnnualMetricValue(point[annualPreviousKey(metric)] as number, metric, formatCurrency, formatNumber)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AnalysisTable({ title, rows, valueLabel, valueKey }: { title: string; rows: TopSkuPerformanceRow[]; valueLabel: string; valueKey: "quantity" | "profit" }) {
  const { t, formatCurrency } = useLanguage();
  return (
    <Card>
      <DashboardSectionTitle eyebrow={t("dashboard.section.skuAnalysis")} title={title} />
      <Table>
        <thead>
          <tr>
            <Th>{t("common.rank")}</Th>
            <Th>{t("common.sku")}</Th>
            <Th>{t("common.salesQuantity")}</Th>
            <Th>{valueLabel}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sku}>
              <Td>{index + 1}</Td>
              <Td>{row.sku}</Td>
              <Td>{row.quantity}</Td>
              <Td>{valueKey === "profit" ? formatCurrency(row.profit) : row[valueKey]}</Td>
            </tr>
          ))}
          {!rows.length ? <EmptyRow columns={4} /> : null}
        </tbody>
      </Table>
    </Card>
  );
}

function TopSalesTable({ rows }: { rows: TopSkuPerformanceRow[] }) {
  const { t, formatCurrency } = useLanguage();
  return (
    <Card>
      <DashboardSectionTitle eyebrow={t("dashboard.section.skuAnalysis")} title={t("dashboard.topSales.title")} />
      <Table>
        <thead>
          <tr>
            <Th>{t("common.rank")}</Th>
            <Th>{t("common.sku")}</Th>
            <Th>{t("common.productName")}</Th>
            <Th>{t("common.salesQuantity")}</Th>
            <Th>{t("common.orderCount")}</Th>
            <Th>{t("common.revenue")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sku}>
              <Td>{index + 1}</Td>
              <Td>{row.sku}</Td>
              <Td>{row.name}</Td>
              <Td>{row.quantity}</Td>
              <Td>{row.orders}</Td>
              <Td>{formatCurrency(row.revenue)}</Td>
            </tr>
          ))}
          {!rows.length ? <EmptyRow columns={6} /> : null}
        </tbody>
      </Table>
    </Card>
  );
}

function TopProfitTable({ rows }: { rows: TopSkuPerformanceRow[] }) {
  const { t, formatCurrency } = useLanguage();
  return (
    <Card>
      <DashboardSectionTitle eyebrow={t("dashboard.section.skuAnalysis")} title={t("dashboard.topProfit.title")} />
      <Table>
        <thead>
          <tr>
            <Th>{t("common.rank")}</Th>
            <Th>{t("common.sku")}</Th>
            <Th>{t("common.productName")}</Th>
            <Th>{t("common.salesQuantity")}</Th>
            <Th>{t("common.revenue")}</Th>
            <Th>{t("common.profit")}</Th>
            <Th>{t("common.profitMargin")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.sku}>
              <Td>{index + 1}</Td>
              <Td>{row.sku}</Td>
              <Td>{row.name}</Td>
              <Td>{row.quantity}</Td>
              <Td>{formatCurrency(row.revenue)}</Td>
              <Td>{formatCurrency(row.profit)}</Td>
              <Td>{row.margin.toFixed(1)}%</Td>
            </tr>
          ))}
          {!rows.length ? <EmptyRow columns={7} /> : null}
        </tbody>
      </Table>
    </Card>
  );
}

function InventoryHealthCenter({
  summary,
  formatCurrency,
  formatNumber
}: {
  summary: InventoryHealthSummary;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  const { t } = useLanguage();

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-line/70 bg-card/70 px-5 py-5 backdrop-blur md:px-6">
        <DashboardSectionTitle eyebrow={t("dashboard.section.health")} title={t("dashboard.section.healthTitle")} />
      </div>
      <div className="grid gap-5 p-5 xl:grid-cols-[360px_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(135deg,#102923,#173f37_48%,#203b3d)] p-6 text-white shadow-lift">
          <div className="absolute inset-x-8 top-0 h-24 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-5">
            <InventoryHealthGauge score={summary.score} />
            <div className="w-full rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-white/55">{t("dashboard.health.grade")}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-wide">{summary.grade}</div>
                </div>
                <div>
                  <div className="text-xs text-white/55">{t("dashboard.health.totalSku")}</div>
                  <div className="mt-1 text-2xl font-semibold">{formatNumber(summary.totalSku)}</div>
                </div>
                <div className="col-span-2 border-t border-white/10 pt-3">
                  <div className="text-xs text-white/55">{t("dashboard.health.totalValue")}</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(summary.totalStockValue)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summary.items.map((item) => (
            <HealthMetricCard key={item.key} item={item} formatCurrency={formatCurrency} formatNumber={formatNumber} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function InventoryHealthGauge({ score }: { score: number }) {
  const { t } = useLanguage();
  const angle = Math.round((Math.max(0, Math.min(100, score)) / 100) * 360);

  return (
    <div className="relative flex h-64 w-64 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full shadow-[inset_0_0_32px_rgba(255,255,255,0.12),0_24px_80px_rgba(2,20,18,0.42)] transition-all duration-700"
        style={{
          background: `conic-gradient(from 220deg, #1E5A4E 0deg, #406A7A ${Math.max(18, angle)}deg, rgba(220,225,216,0.18) ${Math.max(18, angle)}deg 360deg)`
        }}
      />
      <div className="absolute inset-5 rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.18),transparent_30%),linear-gradient(145deg,rgba(11,31,29,0.95),rgba(17,48,43,0.98))]" />
      <div className="relative text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">{t("dashboard.health.centerLabel")}</div>
        <div className="mt-3 text-6xl font-semibold leading-none text-white">{score}</div>
        <div className="mt-3 text-sm text-white/60">{t("dashboard.health.score")}</div>
      </div>
    </div>
  );
}

function HealthMetricCard({
  item,
  formatCurrency,
  formatNumber
}: {
  item: HealthItem;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  const { t } = useLanguage();
  const detail = item.key === "inTransit"
    ? t("dashboard.health.inTransitUnits", { count: formatNumber(item.quantity ?? 0) })
    : item.saleableDays == null
      ? t("dashboard.health.stockAmount", { value: formatCurrency(item.stockValue) })
      : t("dashboard.health.saleableDays", { days: item.saleableDays });

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line/80 bg-card/85 p-4 shadow-soft backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: item.color }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
          <div className="mt-4 text-3xl font-semibold tracking-tight text-ink">{formatNumber(item.skuCount)}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/40">SKU</div>
        </div>
        <div className="h-10 w-10 rounded-2xl opacity-90" style={{ background: `linear-gradient(135deg, ${item.color}24, ${item.color}08)` }} />
      </div>
      <div className="mt-5 space-y-2 border-t border-line/70 pt-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink/55">{t("dashboard.health.stockValue")}</span>
          <span className="font-semibold text-ink">{formatCurrency(item.stockValue)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink/55">{t("dashboard.health.keyMetric")}</span>
          <span className="font-semibold text-ink">{detail}</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SmartReplenishmentRow["status"] }) {
  const { t } = useLanguage();
  const config = {
    danger: [t("dashboard.status.danger"), "bg-red-50 text-red-700 border-red-200"],
    warning: [t("dashboard.status.warning"), "bg-amber-50 text-amber-700 border-amber-200"],
    normal: [t("dashboard.status.normal"), "bg-emerald-50 text-emerald-700 border-emerald-200"]
  }[status];
  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${config[1]}`}>{config[0]}</span>;
}

function LifecycleBadge({ label }: { label: string }) {
  const { t } = useLanguage();
  const color = label === t("dashboard.lifecycle.growing") ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    label === t("dashboard.lifecycle.warning") ? "bg-amber-50 text-amber-700 border-amber-200" :
      label === t("dashboard.lifecycle.slow") ? "bg-red-50 text-red-700 border-red-200" :
        "bg-panel text-ink border-line";
  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function EmptyRow({ columns }: { columns: number }) {
  const { t } = useLanguage();
  return (
    <tr>
      {Array.from({ length: columns }, (_, index) => (
        <Td key={index}>{index === 0 ? t("common.empty") : "-"}</Td>
      ))}
    </tr>
  );
}

type SmartReplenishmentRow = ReplenishmentRow & {
  saleableDays: number;
  status: "danger" | "warning" | "normal";
  action: string;
};

function buildSmartReplenishment(rows: ReplenishmentRow[], t: TFunction): SmartReplenishmentRow[] {
  return rows.map((row) => {
    const saleableDays = row.dailyAverage > 0 ? Math.floor(row.currentStock / row.dailyAverage) : 999;
    const status: SmartReplenishmentRow["status"] = saleableDays < 7 ? "danger" : saleableDays < 15 ? "warning" : "normal";
    const action = status === "danger" ? t("dashboard.replenishment.immediate") : status === "warning" ? t("dashboard.replenishment.within7Days") : t("dashboard.replenishment.noNeed");

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
}, t: TFunction): AlertItem[] {
  const dangerCount = input.rows.filter((row) => row.saleableDays < 7).length;
  const warningCount = input.rows.filter((row) => row.saleableDays >= 7 && row.saleableDays < 15).length;
  const stockoutCount = input.rows.filter((row) => row.dailyAverage > 0 && row.currentStock <= row.dailyAverage * 3).length;
  const suggestedCount = input.rows.filter((row) => row.suggestedQty > 0).length;
  const revenueGrowth = compare(input.rangeRevenue, input.comparisonRevenue);
  const profitGrowth = compare(input.rangeProfit, input.comparisonProfit);
  const alerts: AlertItem[] = [];

  if (dangerCount) alerts.push({ level: "danger", text: t("dashboard.alert.dangerSku", { count: dangerCount }) });
  if (stockoutCount) alerts.push({ level: "danger", text: t("dashboard.alert.stockoutSku", { count: stockoutCount }) });
  if (warningCount) alerts.push({ level: "warning", text: t("dashboard.alert.warningSku", { count: warningCount }) });
  if (suggestedCount) alerts.push({ level: "warning", text: t("dashboard.alert.suggestedSku", { count: suggestedCount }) });
  if (revenueGrowth != null && revenueGrowth > 0) alerts.push({ level: "success", text: t("dashboard.alert.revenueGrowth", { value: revenueGrowth.toFixed(1) }) });
  if (profitGrowth != null && profitGrowth > 0) alerts.push({ level: "success", text: t("dashboard.alert.profitGrowth", { value: profitGrowth.toFixed(1) }) });

  return alerts;
}

type TopSkuPerformanceRow = {
  sku: string;
  name: string;
  quantity: number;
  orders: number;
  revenue: number;
  profit: number;
  margin: number;
};

function buildTopSkuPerformance(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>, sortBy: "quantity" | "profit") {
  const map = new Map<string, TopSkuPerformanceRow>();

  for (const sale of validSales(salesRows)) {
    const product = productMap.get(sale.product_id);
    if (!product) continue;
    const current = map.get(product.sku) ?? {
      sku: product.sku,
      name: product.name,
      quantity: 0,
      orders: 0,
      revenue: 0,
      profit: 0,
      margin: 0
    };
    const quantity = Number(sale.quantity);
    const revenue = quantity * money(product.sale_price);
    const singleProfit = unitProfit(product);
    current.quantity += quantity;
    current.orders += quantity;
    current.revenue += revenue;
    current.profit += singleProfit * quantity;
    current.margin = profitMargin(product, singleProfit);
    map.set(product.sku, current);
  }

  return Array.from(map.values()).sort((a, b) => b[sortBy] - a[sortBy]).slice(0, 8);
}

type HealthItemKey = "healthy" | "danger" | "warning" | "slow" | "inTransit";
type HealthItem = {
  key: HealthItemKey;
  label: string;
  skuCount: number;
  quantity?: number;
  stockValue: number;
  saleableDays: number | null;
  color: string;
};
type InventoryHealthSummary = {
  score: number;
  grade: string;
  totalSku: number;
  totalStockValue: number;
  items: HealthItem[];
};

function buildInventoryHealth(rows: SmartReplenishmentRow[], slowMoving: ReplenishmentRow[], t: TFunction): InventoryHealthSummary {
  const totalSku = rows.length;
  const safeTotal = Math.max(1, totalSku);
  const slowIds = new Set(slowMoving.map((row) => row.product.id));
  const dangerRows = rows.filter((row) => row.status === "danger");
  const warningRows = rows.filter((row) => row.status === "warning");
  const slowRows = rows.filter((row) => slowIds.has(row.product.id));
  const inTransitRows = rows.filter((row) => row.openPurchaseQty > 0);
  const excludedIds = new Set([...dangerRows, ...warningRows, ...slowRows].map((row) => row.product.id));
  const healthyRows = rows.filter((row) => !excludedIds.has(row.product.id));
  const totalStockValue = rows.reduce((sum, row) => sum + row.currentStock * money(row.product.purchase_price), 0);
  const score = Math.max(0, Math.min(100, Math.round(
    ((healthyRows.length + warningRows.length * 0.55 + slowRows.length * 0.35 + dangerRows.length * 0.15) / safeTotal) * 100
  )));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "D";

  const makeItem = (key: HealthItemKey, label: string, itemRows: SmartReplenishmentRow[], color: string, quantity?: number): HealthItem => ({
    key,
    label,
    skuCount: itemRows.length,
    quantity,
    stockValue: itemRows.reduce((sum, row) => {
      const stockQuantity = key === "inTransit" ? row.openPurchaseQty : row.currentStock;
      return sum + stockQuantity * money(row.product.purchase_price);
    }, 0),
    saleableDays: averageSaleableDays(itemRows),
    color
  });

  return {
    score,
    grade,
    totalSku,
    totalStockValue,
    items: [
      makeItem("healthy", t("dashboard.health.healthy"), healthyRows, "#1E5A4E"),
      makeItem("danger", t("dashboard.health.danger"), dangerRows, "#A65A52"),
      makeItem("warning", t("dashboard.health.warning"), warningRows, "#B38A45"),
      makeItem("slow", t("dashboard.health.slow"), slowRows, "#6D756F"),
      makeItem("inTransit", t("dashboard.health.inTransit"), inTransitRows, "#406A7A", inTransitRows.reduce((sum, row) => sum + row.openPurchaseQty, 0))
    ]
  };
}

function averageSaleableDays(rows: SmartReplenishmentRow[]) {
  const values = rows.map((row) => row.saleableDays).filter((value) => Number.isFinite(value) && value < 999);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildLifecycleRows(rows: ReplenishmentRow[], salesRows: SaleDaily[], anchorDate: Date, t: TFunction) {
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
    const lifecycle = stats.recent === 0 ? t("dashboard.lifecycle.slow") :
      stats.previous > 0 && stats.recent >= stats.previous * 1.3 ? t("dashboard.lifecycle.growing") :
        stats.previous > 0 && stats.recent <= stats.previous * 0.7 ? t("dashboard.lifecycle.warning") :
          t("dashboard.lifecycle.stable");
    const saleableDays = row.dailyAverage > 0 ? Math.floor(row.currentStock / row.dailyAverage) : 999;

    return { ...row, saleableDays, lifecycle };
  }).sort((a, b) => b.salesInWindow - a.salesInWindow);
}

function buildSalesMetrics(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>) {
  return validSales(salesRows).reduce((metrics, sale) => {
    const product = productMap.get(sale.product_id);
    if (!product) return metrics;
    const quantity = Number(sale.quantity);
    const salePrice = money(product.sale_price);

    metrics.quantity += quantity;
    metrics.revenue += quantity * salePrice;
    metrics.profit += totalProfit(product, quantity);
    return metrics;
  }, { quantity: 0, revenue: 0, profit: 0 });
}

function buildDailySalesPoints(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>, days: number, anchorDate: Date): SalesPoint[] {
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(anchorDate);
    date.setDate(anchorDate.getDate() - (days - 1 - index));
    const key = toDateKey(date);
    return { date: key, label: `${date.getMonth() + 1}/${date.getDate()}`, orders: 0, quantity: 0, revenue: 0, profit: 0 };
  });
  const map = new Map(points.map((point) => [point.date, point]));

  for (const sale of validSales(salesRows)) {
    const point = map.get(sale.sale_date);
    const product = productMap.get(sale.product_id);
    if (!point || !product) continue;
    point.orders += sale.quantity;
    point.quantity += sale.quantity;
    point.revenue += sale.quantity * money(product.sale_price);
    point.profit += totalProfit(product, sale.quantity);
  }

  return points;
}

function buildAnnualTrendPoints(
  currentRows: SaleDaily[],
  previousRows: SaleDaily[],
  productMap: Map<string, ProductWithStock>,
  year: number,
  t: TFunction
): AnnualPoint[] {
  const months: AnnualPoint[] = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    date: `${year}-${String(index + 1).padStart(2, "0")}`,
    label: `${index + 1}${t("unit.month")}`,
    orders: 0,
    quantity: 0,
    revenue: 0,
    profit: 0,
    previousOrders: 0,
    previousQuantity: 0,
    previousRevenue: 0,
    previousProfit: 0
  }));

  addMonthlySales(months, currentRows, productMap, year, false);
  addMonthlySales(months, previousRows, productMap, year - 1, true);
  return months;
}

function addMonthlySales(
  months: AnnualPoint[],
  salesRows: SaleDaily[],
  productMap: Map<string, ProductWithStock>,
  year: number,
  previous: boolean
) {
  for (const sale of validSales(salesRows)) {
    const [saleYear, saleMonth] = sale.sale_date.split("-").map(Number);
    const product = productMap.get(sale.product_id);
    if (saleYear !== year || !saleMonth || !product) continue;
    const point = months[saleMonth - 1];
    const quantity = Number(sale.quantity);
    const revenue = quantity * money(product.sale_price);
    const profit = totalProfit(product, quantity);

    if (previous) {
      point.previousOrders += quantity;
      point.previousQuantity += quantity;
      point.previousRevenue += revenue;
      point.previousProfit += profit;
    } else {
      point.orders += quantity;
      point.quantity += quantity;
      point.revenue += revenue;
      point.profit += profit;
    }
  }
}

function buildMonthlySalesPoints(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>, year: number): SalesPoint[] {
  const months = Array.from({ length: 12 }, (_, index) => ({
    date: `${year}-${String(index + 1).padStart(2, "0")}`,
    label: String(index + 1),
    orders: 0,
    quantity: 0,
    revenue: 0,
    profit: 0
  }));

  for (const sale of validSales(salesRows)) {
    const [saleYear, saleMonth] = sale.sale_date.split("-").map(Number);
    const product = productMap.get(sale.product_id);
    if (saleYear !== year || !saleMonth || !product) continue;
    const point = months[saleMonth - 1];
    point.orders += sale.quantity;
    point.quantity += sale.quantity;
    point.revenue += sale.quantity * money(product.sale_price);
    point.profit += totalProfit(product, sale.quantity);
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

function buildRange(mode: ViewMode, anchorDate: Date, t: TFunction): DateRange {
  const end = toDateKey(anchorDate);
  if (mode === "7d") return { start: daysAgoKey(anchorDate, 6), end, label: t("period.7d") };
  if (mode === "30d") return { start: daysAgoKey(anchorDate, 29), end, label: t("period.30d") };
  if (mode === "month") return { start: monthStartKey(anchorDate), end, label: t("period.month") };
  if (mode === "yesterday") return { start: end, end, label: t("period.yesterday") };
  if (mode === "custom") return { start: end, end, label: t("period.custom") };
  return { start: end, end, label: t("period.today") };
}

function buildComparisonRange(range: DateRange): DateRange {
  const start = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  const days = daysInRange(range);
  const comparisonEnd = new Date(start);
  comparisonEnd.setDate(start.getDate() - 1);
  const comparisonStart = new Date(comparisonEnd);
  comparisonStart.setDate(comparisonEnd.getDate() - (days - 1));
  return { start: toDateKey(comparisonStart), end: toDateKey(comparisonEnd), label: "" };
}

function daysInRange(range: DateRange) {
  const start = parseDateKey(range.start).getTime();
  const end = parseDateKey(range.end).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function formatRangeLabel(range: DateRange, formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string) {
  return range.start === range.end ? formatDate(`${range.end}T12:00:00`) : `${formatDate(`${range.start}T12:00:00`)} ~ ${formatDate(`${range.end}T12:00:00`)}`;
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

function sumMetric(data: SalesPoint[], metric: TrendMetric) {
  return data.reduce((sum, item) => sum + item[metric], 0);
}

function annualPreviousKey(metric: AnnualMetric) {
  if (metric === "orders") return "previousOrders";
  if (metric === "revenue") return "previousRevenue";
  return "previousQuantity";
}

function sumAnnualMetric(data: AnnualPoint[], metric: AnnualMetric) {
  return data.reduce((sum, item) => sum + item[metric], 0);
}

function sumAnnualPreviousMetric(data: AnnualPoint[], metric: AnnualMetric) {
  const key = annualPreviousKey(metric);
  return data.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
}

function formatAnnualMetricValue(
  value: number,
  metric: AnnualMetric,
  formatCurrency: (value: number) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
) {
  if (metric === "revenue") return formatCurrency(value);
  return formatNumber(Math.round(value));
}

function buildAnnualInsight(data: AnnualPoint[], metric: AnnualMetric, growth: number | null, bestMonth: AnnualPoint, worstMonth: AnnualPoint, t: TFunction) {
  const hasData = data.some((item) => item.quantity > 0 || item.orders > 0 || item.revenue > 0);
  const metricLabel = metric === "revenue" ? t("common.revenue") : metric === "orders" ? t("common.orderCount") : t("common.salesQuantity");
  if (!hasData) return t("dashboard.annual.insightNoData");
  if (growth == null) return t("dashboard.annual.insightNoComparison", { month: bestMonth.label, metric: metricLabel });
  if (growth >= 0) return t("dashboard.annual.insightGrowth", { month: yearlessLabel(bestMonth.label), metric: metricLabel, growth: growth.toFixed(1) });
  return t("dashboard.annual.insightDecline", { month: yearlessLabel(worstMonth.label), metric: metricLabel, growth: Math.abs(growth).toFixed(1) });
}

function yearlessLabel(label: string) {
  return label || "-";
}

function emptyPoint(): SalesPoint {
  return { date: "", label: "-", orders: 0, quantity: 0, revenue: 0, profit: 0 };
}

function emptyAnnualPoint(year: number): AnnualPoint {
  return {
    ...emptyPoint(),
    date: `${year}-01`,
    label: "-",
    month: 1,
    previousOrders: 0,
    previousQuantity: 0,
    previousRevenue: 0,
    previousProfit: 0
  };
}

function formatSaleableDays(days: number, t: TFunction) {
  return days >= 999 ? t("unit.noSales") : `${days}${t("unit.day")}`;
}

function stockoutDate(days: number, anchorDate: Date, t: TFunction) {
  if (days >= 999) return t("unit.noRisk");
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

function won(value: number) {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function shortWon(value: number) {
  if (value >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₩${Math.round(value / 1_000)}K`;
  return won(value);
}
