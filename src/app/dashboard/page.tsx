"use client";

import type React from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  DollarSign,
  Layers,
  Megaphone,
  PackageCheck,
  Search,
  ShoppingBag,
  TrendingUp,
  type LucideIcon
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
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
import { money, totalProfit } from "@/lib/profit";
import { activeProducts } from "@/lib/products";
import { buildInventoryMetricsByProduct, calculateCurrentStockFromMovements, classifyInventoryMovement } from "@/lib/stock";
import { fetchAllStockMovements } from "@/lib/stock-movements";
import {
  buildReplenishmentRows,
  REPLENISHMENT_CYCLE_DAYS,
  SALES_ANALYSIS_DAYS,
  type ReplenishmentRow
} from "@/lib/replenishment";
import type { ProductWithStock, PurchaseOrder, SaleDaily } from "@/lib/types";

type ViewMode = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
type TrendMetric = "orders" | "quantity";
type AnnualMetric = "quantity" | "orders" | "revenue";
type MonthlySkuMetric = "quantity" | "revenue" | "profit" | "stock";
type DecisionSortKey = "risk" | "stock" | "sales" | "days" | "suggested" | "lostRevenue";
type ActionTab = "immediate" | "soon" | "watch";
type LifecycleStatus = "danger" | "warning" | "stable" | "slow";
type InventoryRiskLevel = "danger" | "warning" | "normal";
type SalesPoint = { date: string; label: string; orders: number; quantity: number; revenue: number; profit: number };
type AnnualPoint = SalesPoint & {
  month: number;
  previousOrders: number;
  previousQuantity: number;
  previousRevenue: number;
  previousProfit: number;
};
type AlertItem = { level: "danger" | "warning" | "success"; text: string };
type MovementRow = { product_id: string; type: string; quantity: number; happened_at: string; memo: string | null };
type TFunction = ReturnType<typeof useLanguage>["t"];
type MonthlySkuRow = {
  product: ProductWithStock;
  currentStock: number;
  monthly: Array<{ quantity: number; revenue: number; profit: number }>;
  annualQuantity: number;
  annualRevenue: number;
  annualProfit: number;
};
type LifecycleRow = ReplenishmentRow & {
  saleableDays: number;
  sales7: number;
  lifecycle: string;
  lifecycleStatus: LifecycleStatus;
  lifecycleAction: string;
  status: SmartReplenishmentRow["status"];
};

const STANDARD_SIZE_OPTIONS = ["58.4x163", "76.2x163", "87.6x163", "91.4x163", "99.1x163"];
const REPLENISHMENT_LEAD_DAYS = REPLENISHMENT_CYCLE_DAYS;

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { language, t, formatCurrency, formatDate, formatNumber } = useLanguage();
  const [rows, setRows] = useState<ReplenishmentRow[]>([]);
  const [salesRows, setSalesRows] = useState<SaleDaily[]>([]);
  const [salesYearRows, setSalesYearRows] = useState<SaleDaily[]>([]);
  const [salesPreviousYearRows, setSalesPreviousYearRows] = useState<SaleDaily[]>([]);
  const [salesAllRows, setSalesAllRows] = useState<SaleDaily[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [customRange, setCustomRange] = useState(() => {
    const today = toDateKey(new Date());
    return { start: today, end: today };
  });
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("quantity");
  const [annualMetric, setAnnualMetric] = useState<AnnualMetric>("quantity");
  const [monthlySkuMetric, setMonthlySkuMetric] = useState<MonthlySkuMetric>("quantity");
  const [monthlyColorFilter, setMonthlyColorFilter] = useState("all");
  const [monthlySizeFilter, setMonthlySizeFilter] = useState("all");
  const [monthlySearch, setMonthlySearch] = useState("");
  const [lifecycleSearch, setLifecycleSearch] = useState("");
  const [lifecycleStatusFilter, setLifecycleStatusFilter] = useState("all");
  const [lifecycleSort, setLifecycleSort] = useState<DecisionSortKey>("risk");
  const [riskSearch, setRiskSearch] = useState("");
  const [riskStatusFilter, setRiskStatusFilter] = useState("all");
  const [riskSort, setRiskSort] = useState<DecisionSortKey>("risk");
  const [actionSearch, setActionSearch] = useState("");
  const [actionSort, setActionSort] = useState<DecisionSortKey>("risk");
  const [actionTab, setActionTab] = useState<ActionTab>("immediate");
  const [selectedMonthlySku, setSelectedMonthlySku] = useState<string | null>(null);
  const [comparePreviousYear, setComparePreviousYear] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const anchorDate = parseDateKey(selectedDate);
  const range = buildRange(viewMode, anchorDate, t, customRange);
  const comparisonRange = buildComparisonRange(range);

  useEffect(() => {
    setSelectedYear(parseDateKey(range.end).getFullYear());
  }, [range.end]);

  useEffect(() => {
    load();
  }, [selectedDate, selectedYear, viewMode, customRange.start, customRange.end]);

  async function load() {
    setLoading(true);

    const anchor = parseDateKey(selectedDate);
    const activeRange = buildRange(viewMode, anchor, t, customRange);
    const salesStart = minDateKey(daysAgoKey(anchor, 89), activeRange.start);
    const salesEnd = toDateKey(anchor);
    const replenishStart = daysAgoKey(anchor, SALES_ANALYSIS_DAYS - 1);
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const previousYearStart = `${selectedYear - 1}-01-01`;
    const previousYearEnd = `${selectedYear - 1}-12-31`;

    const [
      { data: products },
      { data: purchases },
      { data: movementRows }
    ] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("*, products(name, sku)"),
      fetchAllStockMovements<MovementRow>("product_id, type, quantity, happened_at, memo")
    ]);

    const visibleProducts = activeProducts((products ?? []) as ProductWithStock[]);
    const visibleProductIds = new Set(visibleProducts.map((product) => product.id));
    const visibleMovements = ((movementRows ?? []) as MovementRow[]).filter((movement) => visibleProductIds.has(movement.product_id));
    const metricsByProduct = buildInventoryMetricsByProduct(visibleMovements);
    const movementSales = visibleMovements
      .filter((movement) => classifyInventoryMovement(movement) === "sale")
      .map((movement) => ({
        product_id: movement.product_id,
        sale_date: toDateKey(new Date(movement.happened_at)),
        quantity: Math.max(0, Number(movement.quantity ?? 0))
      }))
      .filter((sale) => sale.quantity > 0);
    const filterSalesByDate = (rows: SaleDaily[], start: string, end: string) => rows.filter((sale) => isBetween(sale.sale_date, start, end));

    setRows(
      buildReplenishmentRows(
        visibleProducts,
        filterSalesByDate(movementSales, replenishStart, salesEnd),
        (purchases ?? []) as PurchaseOrder[],
        undefined,
        metricsByProduct
      )
    );
    setSalesRows(filterSalesByDate(movementSales, salesStart, salesEnd));
    setSalesYearRows(filterSalesByDate(movementSales, yearStart, yearEnd));
    setSalesPreviousYearRows(filterSalesByDate(movementSales, previousYearStart, previousYearEnd));
    setSalesAllRows(movementSales);
    setMovements(visibleMovements);
    setLoading(false);
  }

  const productMap = useMemo(() => new Map(rows.map((row) => [row.product.id, row.product])), [rows]);
  const rangeSales = salesAllRows.filter((sale) => isBetween(sale.sale_date, range.start, range.end));
  const comparisonSales = salesAllRows.filter((sale) => isBetween(sale.sale_date, comparisonRange.start, comparisonRange.end));
  const rangeMovements = movements.filter((movement) => isBetween(toDateKey(new Date(movement.happened_at)), range.start, range.end));
  const comparisonMovements = movements.filter((movement) => isBetween(toDateKey(new Date(movement.happened_at)), comparisonRange.start, comparisonRange.end));
  const salesWindowRows = salesRows.filter((sale) => isBetween(sale.sale_date, daysAgoKey(anchorDate, 29), range.end));
  const trendDays = viewMode === "30d" ? 30 : viewMode === "month" ? daysInRange(range) : viewMode === "custom" ? daysInRange(range) : viewMode === "7d" ? 7 : 7;

  const totalStock = calculateCurrentStockFromMovements(movements);
  const skuCount = rows.length;
  const rangeMetrics = buildSalesMetrics(rangeSales, productMap);
  const comparisonMetrics = buildSalesMetrics(comparisonSales, productMap);
  const returnInboundQty = countTypedMovements(rangeMovements, "return_inbound");
  const comparisonReturnInboundQty = countTypedMovements(comparisonMovements, "return_inbound");
  const lossQty = countTypedMovements(rangeMovements, "loss");
  const comparisonLossQty = countTypedMovements(comparisonMovements, "loss");
  const kpiCopy = buildKpiCopy(viewMode, range, language);
  const replenishRows = buildSmartReplenishment(rows, t);
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
  const monthlySkuRows = buildMonthlySkuRows(rows, salesYearRows, productMap);
  const previousYearMonthlySkuRows = buildMonthlySkuRows(rows, salesPreviousYearRows, productMap);
  const filteredMonthlySkuRows = filterMonthlySkuRows(monthlySkuRows, monthlyColorFilter, monthlySizeFilter, monthlySearch);
  const selectedMonthlySkuRow = filteredMonthlySkuRows.find((row) => row.product.id === selectedMonthlySku) ?? null;
  const lifecycleRows = buildLifecycleRows(rows, salesRows, anchorDate, t);

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader title={t("dashboard.title")} />
        <DateControl
          selectedDate={selectedDate}
          range={range}
          customRange={customRange}
          viewMode={viewMode}
          rangeLabel={formatRangeLabel(range, formatDate)}
          onDateChange={(date) => {
            setSelectedDate(date);
            setCustomRange({ start: date, end: date });
            setViewMode("custom");
          }}
          onRangeChange={(nextRange) => {
            if (nextRange.start > nextRange.end) {
              window.alert("开始日期不能晚于结束日期");
              return;
            }
            setCustomRange(nextRange);
            setSelectedDate(nextRange.end);
            setViewMode(matchRangeMode(nextRange) ?? "custom");
          }}
          onModeChange={(mode) => {
            const nextRange = buildRange(mode, parseDateKey(mode === "yesterday" ? daysAgoKey(new Date(), 1) : toDateKey(new Date())), t, customRange);
            setViewMode(mode);
            setCustomRange({ start: nextRange.start, end: nextRange.end });
            setSelectedDate(nextRange.end);
          }}
        />
      </div>

      <div className={`space-y-6 transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
        <section className="premium-dashboard-panel relative overflow-hidden rounded-[30px] p-4 md:p-5">
          <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-900/8 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[#bca77a]/12 blur-3xl" />
          <div className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ExecutiveKpi
              delay={0}
              icon={DollarSign}
              label={kpiCopy.revenueLabel}
              subtitle={kpiCopy.revenueSubtitle}
              value={rangeMetrics.revenue}
              format="currency"
              compare={compare(rangeMetrics.revenue, comparisonMetrics.revenue)}
            />
            <ExecutiveKpi
              delay={100}
              icon={ShoppingBag}
              label={kpiCopy.ordersLabel}
              subtitle={kpiCopy.ordersSubtitle}
              value={rangeMetrics.quantity}
              compare={compare(rangeMetrics.quantity, comparisonMetrics.quantity)}
            />
            <ExecutiveKpi
              delay={200}
              icon={Megaphone}
              label={kpiCopy.adSpendLabel}
              subtitle={kpiCopy.adSpendSubtitle}
              value={rangeMetrics.adSpend}
              format="currency"
              compare={compare(rangeMetrics.adSpend, comparisonMetrics.adSpend)}
            />
            <ExecutiveKpi
              delay={300}
              icon={TrendingUp}
              label={kpiCopy.profitLabel}
              subtitle={kpiCopy.profitSubtitle}
              value={rangeMetrics.profit}
              format="currency"
              compare={compare(rangeMetrics.profit, comparisonMetrics.profit)}
            />
            <ExecutiveKpi
              delay={400}
              icon={PackageCheck}
              label={kpiCopy.returnInboundLabel}
              subtitle={kpiCopy.returnInboundSubtitle}
              value={returnInboundQty}
              compare={compare(returnInboundQty, comparisonReturnInboundQty)}
            />
            <ExecutiveKpi
              delay={500}
              icon={AlertTriangle}
              label={kpiCopy.lossLabel}
              subtitle={kpiCopy.lossSubtitle}
              value={lossQty}
              compare={compare(lossQty, comparisonLossQty)}
              inverseTrend
            />
            <ExecutiveKpi
              delay={600}
              icon={Boxes}
              label={t("dashboard.kpi.currentStockQty")}
              subtitle={t("dashboard.kpi.currentStockSubtitle")}
              value={totalStock}
            />
            <ExecutiveKpi
              delay={700}
              icon={Layers}
              label={t("dashboard.kpi.skuTotal")}
              subtitle={t("dashboard.kpi.skuSubtitle")}
              value={skuCount}
            />
          </div>
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

        <SkuMonthlySalesAnalysis
          rows={filteredMonthlySkuRows}
          allRows={monthlySkuRows}
          previousYearRows={previousYearMonthlySkuRows}
          replenishmentRows={replenishRows}
          movements={rangeMovements}
          metric={monthlySkuMetric}
          colorFilter={monthlyColorFilter}
          sizeFilter={monthlySizeFilter}
          search={monthlySearch}
          selectedYear={selectedYear}
          anchorDate={anchorDate}
          selectedRow={selectedMonthlySkuRow}
          onMetricChange={setMonthlySkuMetric}
          onColorChange={setMonthlyColorFilter}
          onSizeChange={setMonthlySizeFilter}
          onSearchChange={setMonthlySearch}
          onSelectSku={setSelectedMonthlySku}
        />

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

        <section>
          <ReplenishmentActionCenter
            rows={replenishRows}
            loading={loading}
            tab={actionTab}
            search={actionSearch}
            sortKey={actionSort}
            onTabChange={setActionTab}
            onSearchChange={setActionSearch}
            onSortChange={setActionSort}
          />
        </section>

        <section>
          <StockRiskRanking
            rows={replenishRows}
            anchorDate={anchorDate}
            loading={loading}
            search={riskSearch}
            statusFilter={riskStatusFilter}
            sortKey={riskSort}
            onSearchChange={setRiskSearch}
            onStatusChange={setRiskStatusFilter}
            onSortChange={setRiskSort}
          />
        </section>

        <section>
          <SkuLifecycleCenter
            rows={lifecycleRows}
            loading={loading}
            search={lifecycleSearch}
            statusFilter={lifecycleStatusFilter}
            sortKey={lifecycleSort}
            onSearchChange={setLifecycleSearch}
            onStatusChange={setLifecycleStatusFilter}
            onSortChange={setLifecycleSort}
          />
        </section>
      </div>
    </>
  );
}

function DateControl({
  selectedDate,
  range,
  customRange,
  viewMode,
  rangeLabel,
  onDateChange,
  onRangeChange,
  onModeChange
}: {
  selectedDate: string;
  range: DateRange;
  customRange: { start: string; end: string };
  viewMode: ViewMode;
  rangeLabel: string;
  onDateChange: (date: string) => void;
  onRangeChange: (range: { start: string; end: string }) => void;
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
    <div className="rounded-2xl border border-white/60 bg-white/85 p-3 shadow-soft backdrop-blur-xl">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <CalendarDays size={16} />
        </span>
        {t("dashboard.dateControl")}
        <span className="ml-auto rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-ink/55">
          当前范围：{range.start} ~ {range.end}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/70 p-1.5">
          <input
            className="h-9 w-36 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            type="date"
            value={viewMode === "custom" ? customRange.start : range.start}
            onChange={(event) => onRangeChange({ start: event.target.value, end: viewMode === "custom" ? customRange.end : range.end })}
          />
          <span className="text-xs font-semibold text-ink/35">~</span>
          <input
            className="h-9 w-36 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            type="date"
            value={viewMode === "custom" ? customRange.end : range.end}
            onChange={(event) => onRangeChange({ start: viewMode === "custom" ? customRange.start : range.start, end: event.target.value })}
          />
        </div>
        {buttons.map((button) => (
          <SegmentButton key={button.key} active={viewMode === button.key} onClick={() => onModeChange(button.key)}>
            {button.label}
          </SegmentButton>
        ))}
        <input className="hidden" type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} aria-label={rangeLabel} />
      </div>
    </div>
  );
}

function SkuMonthlySalesAnalysis({
  rows,
  allRows,
  previousYearRows,
  replenishmentRows,
  movements,
  metric,
  colorFilter,
  sizeFilter,
  search,
  selectedYear,
  anchorDate,
  selectedRow,
  onMetricChange,
  onColorChange,
  onSizeChange,
  onSearchChange,
  onSelectSku
}: {
  rows: MonthlySkuRow[];
  allRows: MonthlySkuRow[];
  previousYearRows: MonthlySkuRow[];
  replenishmentRows: SmartReplenishmentRow[];
  movements: MovementRow[];
  metric: MonthlySkuMetric;
  colorFilter: string;
  sizeFilter: string;
  search: string;
  selectedYear: number;
  anchorDate: Date;
  selectedRow: MonthlySkuRow | null;
  onMetricChange: (metric: MonthlySkuMetric) => void;
  onColorChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSelectSku: (id: string | null) => void;
}) {
  const { language, t, formatCurrency, formatNumber } = useLanguage();
  const copy = monthlyAnalysisCopy(language);
  const colors = orderedUnique(allRows.map((row) => row.product.color).filter(Boolean) as string[], ["白色", "黑色", "灰色", "米色"]);
  const sizes = STANDARD_SIZE_OPTIONS;
  const colorData = buildColorAnalysis(rows);
  const sizeRankings = buildSizeRankings(rows);
  const monthComparison = buildMonthComparison(rows, previousYearRows, anchorDate.getMonth());
  const decisionCards = buildMonthlyDecisionCards(rows, replenishmentRows, movements, language, formatCurrency, formatNumber);
  const exportName = `sku-monthly-sales-${selectedYear}`;

  return (
    <section className="print:break-before-page">
      <Card className="premium-dashboard-panel overflow-hidden rounded-[28px]">
        <div className="relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-[#f9faf7] via-[#eef2eb] to-[#f6f1e8] p-5">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#1E5A4E]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-20 h-56 w-56 rounded-full bg-[#406A7A]/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <DashboardSectionTitle eyebrow="SKU Monthly Sales Analysis" title={copy.title} />
            <div className="flex flex-wrap gap-2">
              {(["quantity", "revenue", "profit", "stock"] as MonthlySkuMetric[]).map((item) => (
                <SegmentButton key={item} active={metric === item} onClick={() => onMetricChange(item)}>
                  {copy.metrics[item]}
                </SegmentButton>
              ))}
              <button type="button" onClick={() => exportMonthlySkuCsv(rows, metric, selectedYear, exportName)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
                <Download size={16} /> CSV
              </button>
              <button type="button" onClick={() => exportMonthlySkuExcel(rows, metric, selectedYear, exportName)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
                <Download size={16} /> Excel
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
                <Download size={16} /> PDF
              </button>
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 xl:grid-cols-[1fr_220px_220px_1.4fr]">
            <label className="relative block">
              <span className="mb-1 block text-xs font-semibold text-ink/55">{copy.search}</span>
              <Search className="pointer-events-none absolute bottom-3 left-3 text-ink/35" size={16} />
              <input className="w-full rounded-xl pl-9" value={search} placeholder={copy.searchPlaceholder} onChange={(event) => onSearchChange(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/55">{copy.color}</span>
              <select className="w-full rounded-xl" value={colorFilter} onChange={(event) => onColorChange(event.target.value)}>
                <option value="all">{copy.allColors}</option>
                {colors.map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/55">{copy.size}</span>
              <select className="w-full rounded-xl" value={sizeFilter} onChange={(event) => onSizeChange(event.target.value)}>
                <option value="all">{copy.allSizes}</option>
                {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <MiniTrendCard label={copy.annualQuantity} value={formatNumber(sumMonthlyRows(rows, "quantity"))} />
              <MiniTrendCard label={copy.annualRevenue} value={formatCurrency(sumMonthlyRows(rows, "revenue"))} />
              <MiniTrendCard label={copy.annualProfit} value={formatCurrency(sumMonthlyRows(rows, "profit"))} />
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/60 bg-white/78 shadow-[0_18px_48px_rgba(23,33,29,0.06)] backdrop-blur">
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-[1280px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-[#f7f8f2]/96 backdrop-blur-xl">
                <tr>
                  <th className="sticky left-0 z-30 min-w-[280px] border-b border-line bg-[#f7f8f2]/96 px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-ink/55">{copy.productName}</th>
                  {Array.from({ length: 12 }, (_, index) => (
                    <th key={index} className="border-b border-line px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.08em] text-ink/55">{index + 1}{copy.month}</th>
                  ))}
                  <th className="border-b border-line px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.08em] text-ink/55">{copy.annualTotal}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const color = row.product.color || "-";
                  const showColorHeader = index === 0 || color !== (rows[index - 1]?.product.color || "-");
                  return (
                    <Fragment key={row.product.id}>
                      {showColorHeader ? (
                        <tr>
                          <td colSpan={14} className="sticky left-0 z-10 border-b border-line bg-[#eef3ed] px-4 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-ink/70">
                              <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: colorToken(color) }} />
                              <span>{color}</span>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      <tr onClick={() => onSelectSku(row.product.id)} className="premium-table-row group cursor-pointer">
                        <td className="sticky left-0 z-10 border-b border-line bg-white/92 px-4 py-3 transition group-hover:bg-[#f6faf6]" style={{ borderLeft: `4px solid ${colorToken(color)}` }}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-ink shadow-sm ring-1 ring-black/5" style={{ backgroundColor: colorBadgeBackground(color) }}>
                              {color}
                            </span>
                            <span className="text-base font-bold text-ink">{normalizeSize(row.product.size)}</span>
                          </div>
                          <div className="mt-1.5 text-xs font-medium text-ink/45">{row.product.sku}</div>
                          <div className="mt-0.5 max-w-[250px] truncate text-xs text-ink/55">{row.product.name}</div>
                        </td>
                        {row.monthly.map((month, monthIndex) => (
                          <td key={monthIndex} className="border-b border-line px-4 py-3 text-right font-medium tabular-nums text-ink/72 transition group-hover:text-ink">
                            {formatMonthlyMetricCell(row, month, metric, formatCurrency, formatNumber)}
                          </td>
                        ))}
                        <td className="premium-number border-b border-line px-4 py-3 text-right font-bold tabular-nums text-ink">
                          {formatMonthlyAnnualTotal(row, metric, formatCurrency, formatNumber)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-10 text-center text-sm text-ink/55">{copy.empty}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <MonthlyColorAnalysis data={colorData} />
          <MonthlySizeAnalysis rows={sizeRankings} metric={metric} />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-5">
          {decisionCards.map((card) => (
            <MonthlyDecisionCard key={card.title} card={card} />
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          <MonthComparisonCard comparison={monthComparison} />
          {selectedRow ? (
            <MonthlySkuDetail row={selectedRow} replenishment={replenishmentRows.find((item) => item.product.id === selectedRow.product.id)} onClose={() => onSelectSku(null)} />
          ) : (
            <div className="xl:col-span-3 rounded-2xl border border-dashed border-line bg-panel/65 p-6 text-sm font-medium text-ink/55">
              {copy.detailHint}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

function ExecutiveKpi({
  label,
  subtitle,
  value,
  compare: compareValue,
  icon: Icon,
  format = "number",
  suffix = "",
  delay = 0,
  inverseTrend = false
}: {
  label: string;
  subtitle?: string;
  value: number;
  compare?: number | null;
  icon: LucideIcon;
  format?: "number" | "currency";
  suffix?: string;
  delay?: number;
  inverseTrend?: boolean;
}) {
  const { formatCurrency, formatNumber } = useLanguage();
  const direction = compareValue == null ? "neutral" : compareValue >= 0 ? "up" : "down";
  const trendPositive = inverseTrend ? direction === "down" : direction === "up";
  const trendTone = compareValue == null ? "neutral" : trendPositive ? "positive" : "negative";

  return (
    <div
      className="premium-dashboard-card group min-h-36 rounded-3xl p-5 transition duration-300"
      style={{ animation: `kpi-rise 620ms ease-out ${delay}ms both` }}
    >
      <div className="pointer-events-none absolute inset-x-5 bottom-4 h-12 opacity-70 transition duration-300 group-hover:opacity-100">
        <MiniKpiSparkline tone={trendTone} />
      </div>
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1E5A4E] to-[#406A7A] text-white shadow-[0_12px_28px_rgba(30,90,78,0.24)]">
          <Icon size={20} className="opacity-95" />
        </div>
        {compareValue != null ? (
          <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm transition group-hover:scale-105 ${
            trendPositive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {direction === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {direction === "up" ? "+" : "-"}{Math.abs(compareValue).toFixed(1)}%
          </div>
        ) : null}
      </div>
      <div className="relative mt-5">
        <div className="text-sm font-semibold text-ink/62">{label}</div>
        {subtitle ? <div className="mt-1 text-xs font-medium text-ink/40">{subtitle}</div> : null}
        <div className="premium-number mt-4 text-3xl font-semibold text-ink md:text-[34px]">
          <CountUpNumber value={value} format={format} suffix={suffix} formatCurrency={formatCurrency} formatNumber={formatNumber} />
        </div>
      </div>
    </div>
  );
}

function MiniKpiSparkline({ tone }: { tone: "positive" | "negative" | "neutral" }) {
  const stroke = tone === "negative" ? "#9a3f3f" : tone === "positive" ? "#23614f" : "#8a6834";
  const fill = tone === "negative" ? "rgba(154,63,63,0.1)" : tone === "positive" ? "rgba(35,97,79,0.11)" : "rgba(188,167,122,0.12)";
  const points = tone === "negative"
    ? "0,18 22,15 44,22 66,14 88,24 110,20 132,30"
    : tone === "positive"
      ? "0,30 22,24 44,26 66,16 88,18 110,10 132,7"
      : "0,22 22,18 44,20 66,17 88,19 110,15 132,16";

  return (
    <svg viewBox="0 0 132 36" className="h-full w-full" aria-hidden="true">
      <polyline points={`0,36 ${points} 132,36`} fill={fill} stroke="none" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CountUpNumber({
  value,
  format,
  suffix,
  formatCurrency,
  formatNumber
}: {
  value: number;
  format: "number" | "currency";
  suffix: string;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    const target = Number.isFinite(value) ? value : 0;
    const easeOut = (progress: number) => 1 - Math.pow(1 - progress, 3);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplayValue(from + (target - from) * easeOut(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const rounded = format === "currency" ? Math.round(displayValue) : Math.round(displayValue);
  return <>{format === "currency" ? formatCurrency(rounded) : `${formatNumber(rounded)}${suffix}`}</>;
}

function DashboardSectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="premium-section-eyebrow">
        <span className="h-1.5 w-1.5 rounded-full bg-[#bca77a]" />
        {eyebrow}
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{title}</h2>
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
      className={`rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition duration-200 ${
        active
          ? "border-brand bg-gradient-to-br from-brand to-brand-strong text-white shadow-[0_10px_24px_rgba(23,72,63,0.18)]"
          : "border-white/70 bg-white/75 text-ink hover:border-brand/25 hover:bg-white hover:text-brand hover:shadow-soft"
      }`}
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
    <div className="rounded-2xl border border-white/65 bg-white/74 p-3 shadow-[0_12px_30px_rgba(23,33,29,0.06)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="text-xs font-semibold text-ink/55">{label}</div>
      <div className={`premium-number mt-2 text-2xl font-semibold ${tone === "down" ? "text-red-600" : tone === "up" ? "text-emerald-700" : "text-ink"}`}>{value}</div>
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

function MonthlyColorAnalysis({ data }: { data: ColorAnalysisRow[] }) {
  const { language, formatNumber } = useLanguage();
  const copy = monthlyAnalysisCopy(language);
  const total = Math.max(1, data.reduce((sum, item) => sum + item.quantity, 0));

  return (
    <div className="rounded-2xl border border-line bg-white/85 p-5 shadow-soft">
      <DashboardSectionTitle eyebrow={copy.colorAnalysisSubtitle} title={copy.colorAnalysis} />
      <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="quantity" nameKey="color" innerRadius={62} outerRadius={92} paddingAngle={3}>
                {data.map((entry) => <Cell key={entry.color} fill={entry.colorCode} />)}
              </Pie>
              <Tooltip content={<MonthlyColorTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {data.map((item) => {
            const percentValue = (item.quantity / total) * 100;
            return (
              <div key={item.color} className="rounded-xl border border-line bg-panel/65 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.colorCode }} />
                    <span className="font-semibold text-ink">{item.color}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-ink">{formatNumber(item.quantity)}</div>
                    <div className="text-xs text-ink/50">{percentValue.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, percentValue)}%`, backgroundColor: item.colorCode }} />
                </div>
              </div>
            );
          })}
          {!data.length ? <div className="rounded-xl border border-dashed border-line p-5 text-sm text-ink/55">{copy.empty}</div> : null}
        </div>
      </div>
    </div>
  );
}

function MonthlyColorTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: ColorAnalysisRow }> }) {
  const { formatNumber, formatCurrency } = useLanguage();
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
      <div className="font-semibold text-ink">{item.color}</div>
      <div className="mt-1 text-sm text-ink/65">销量: {formatNumber(item.quantity)}</div>
      <div className="text-sm text-ink/65">销售额: {formatCurrency(item.revenue)}</div>
      <div className="text-sm text-ink/65">利润: {formatCurrency(item.profit)}</div>
    </div>
  );
}

function MonthlySizeAnalysis({ rows, metric }: { rows: SizeAnalysisRow[]; metric: MonthlySkuMetric }) {
  const { language, formatCurrency, formatNumber } = useLanguage();
  const copy = monthlyAnalysisCopy(language);
  const dataKey = metric === "stock" ? "stock" : metric;

  return (
    <div className="rounded-2xl border border-line bg-white/85 p-5 shadow-soft">
      <DashboardSectionTitle eyebrow={copy.sizeAnalysisSubtitle} title={copy.sizeAnalysis} />
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.slice(0, 5)} layout="vertical" margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="#d7d9cf" strokeDasharray="4 7" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="size" width={90} tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} />
            <Tooltip content={<MonthlySizeTooltip metric={metric} />} cursor={{ fill: "rgba(30,90,78,0.06)" }} />
            <Bar dataKey={dataKey} radius={[0, 10, 10, 0]} fill="#1E5A4E" barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {rows.slice(0, 5).map((row, index) => (
          <div key={row.size} className="rounded-xl border border-line bg-panel/65 p-3">
            <div className="text-xs font-semibold text-ink/45">TOP{index + 1}</div>
            <div className="mt-1 font-semibold text-ink">{row.size}</div>
            <div className="mt-1 text-sm text-ink/65">{formatMonthlyRankingValue(row[dataKey], metric, formatCurrency, formatNumber)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlySizeTooltip({ active, payload, metric }: { active?: boolean; payload?: Array<{ payload?: SizeAnalysisRow }>; metric: MonthlySkuMetric }) {
  const { formatCurrency, formatNumber } = useLanguage();
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
      <div className="font-semibold text-ink">{item.size}</div>
      <div className="mt-1 text-sm text-ink/65">销量: {formatNumber(item.quantity)}</div>
      <div className="text-sm text-ink/65">销售额: {formatCurrency(item.revenue)}</div>
      <div className="text-sm text-ink/65">利润: {formatCurrency(item.profit)}</div>
      <div className="text-sm text-ink/65">库存: {formatNumber(item.stock)}</div>
    </div>
  );
}

type MonthlyDecisionCardData = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "success" | "neutral" | "info";
  rows: Array<{ label: string; value: string; helper: string }>;
};

function MonthlyDecisionCard({ card }: { card: MonthlyDecisionCardData }) {
  const { language } = useLanguage();
  const emptyText = language === "ko" ? "데이터 없음" : "暂无数据";
  const Icon = card.icon;
  const toneClass = {
    danger: "border-[#ead6d2] from-[#fff7f5] to-white text-[#A65A52]",
    warning: "border-[#eadfca] from-[#fffaf0] to-white text-[#B38A45]",
    success: "border-[#d5e4dd] from-[#f3faf7] to-white text-[#1E5A4E]",
    neutral: "border-line from-[#f8f8f5] to-white text-[#6D756F]",
    info: "border-[#d4e1e5] from-[#f3f8fa] to-white text-[#406A7A]"
  }[card.tone];

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lift ${toneClass}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-soft">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-ink">{card.title}</div>
          <div className="mt-1 text-xs font-medium text-ink/50">{card.subtitle}</div>
        </div>
      </div>
      <div className="space-y-2">
        {card.rows.map((row, index) => (
          <div key={`${card.title}-${row.label}-${index}`} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 shadow-[0_10px_24px_rgba(31,44,38,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{row.label}</div>
                <div className="mt-1 truncate text-xs text-ink/45">{row.helper}</div>
              </div>
              <div className="premium-number shrink-0 text-sm font-semibold tabular-nums text-ink">{row.value}</div>
            </div>
          </div>
        ))}
        {!card.rows.length ? <div className="rounded-xl border border-dashed border-line bg-white/55 p-4 text-sm text-ink/55">{emptyText}</div> : null}
      </div>
    </div>
  );
}

function MonthComparisonCard({ comparison }: { comparison: MonthComparison }) {
  const { language, formatNumber } = useLanguage();
  const copy = monthlyAnalysisCopy(language);
  return (
    <div className="rounded-2xl border border-line bg-white/85 p-5 shadow-soft">
      <DashboardSectionTitle eyebrow={copy.monthCompareSubtitle} title={copy.monthCompare} />
      <div className="mt-4 grid gap-3">
        <MiniTrendCard label={`${comparison.month}${copy.month}${copy.quantity}`} value={formatNumber(comparison.quantity)} />
        <MiniTrendCard label={copy.momGrowth} value={formatPercent(comparison.momGrowth)} tone={comparison.momGrowth != null && comparison.momGrowth < 0 ? "down" : "up"} />
        <MiniTrendCard label={copy.yoyGrowth} value={formatPercent(comparison.yoyGrowth)} tone={comparison.yoyGrowth != null && comparison.yoyGrowth < 0 ? "down" : "up"} />
      </div>
    </div>
  );
}

function MonthlySkuDetail({
  row,
  replenishment,
  onClose
}: {
  row: MonthlySkuRow;
  replenishment?: SmartReplenishmentRow;
  onClose: () => void;
}) {
  const { language, formatCurrency, formatNumber } = useLanguage();
  const copy = monthlyAnalysisCopy(language);
  const stockValue = row.currentStock * money(row.product.purchase_price);

  return (
    <div className="xl:col-span-3 rounded-2xl border border-line bg-white/90 p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/40">{copy.detailTitle}</div>
          <div className="mt-1 text-xl font-semibold text-ink">{formatVariantName(row.product)}</div>
          <div className="text-sm text-ink/60">{row.product.name}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink transition hover:bg-white">
          {copy.close}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniTrendCard label={copy.cumulativeQuantity} value={formatNumber(row.annualQuantity)} />
        <MiniTrendCard label={copy.cumulativeRevenue} value={formatCurrency(row.annualRevenue)} />
        <MiniTrendCard label={copy.cumulativeProfit} value={formatCurrency(row.annualProfit)} />
        <MiniTrendCard label={copy.currentStock} value={formatNumber(row.currentStock)} />
        <MiniTrendCard label={copy.stockValue} value={formatCurrency(stockValue)} />
        <MiniTrendCard label={copy.safetyStock} value={formatNumber(replenishment?.safetyStock ?? 0)} />
        <MiniTrendCard label={copy.suggestedQty} value={formatNumber(replenishment?.suggestedQty ?? 0)} />
        <MiniTrendCard label={copy.saleableDays} value={replenishment ? formatNumber(replenishment.saleableDays >= 999 ? 0 : replenishment.saleableDays) : "-"} />
      </div>
      <div className="mt-4 rounded-xl border border-line bg-panel/60 p-3">
        <div className="mb-2 text-sm font-semibold text-ink">{copy.recentRecords}</div>
        <div className="grid gap-2 md:grid-cols-6">
          {row.monthly.map((month, index) => month.quantity > 0 ? (
            <div key={index} className="rounded-lg bg-white px-3 py-2 text-sm">
              <div className="text-xs text-ink/45">{index + 1}{copy.month}</div>
              <div className="font-semibold text-ink">{formatNumber(month.quantity)}</div>
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  );
}

function ReplenishmentActionCenter({
  rows,
  loading,
  tab,
  search,
  sortKey,
  onTabChange,
  onSearchChange,
  onSortChange
}: {
  rows: SmartReplenishmentRow[];
  loading: boolean;
  tab: ActionTab;
  search: string;
  sortKey: DecisionSortKey;
  onTabChange: (tab: ActionTab) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (key: DecisionSortKey) => void;
}) {
  const { language, t, formatNumber } = useLanguage();
  const copy = decisionCopy(language);
  const tabRows = rows.filter((row) => actionTabForRow(row) === tab);
  const visibleRows = sortDecisionRows(
    tabRows.filter((row) => matchesDecisionSearch(row, search)),
    sortKey
  ).slice(0, 18);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>("FIRST");
  const groupedRows = groupDecisionRowsByCategory(visibleRows, t);
  const activeCategoryKey = resolveDecisionCategoryKey(openCategoryKey, groupedRows);

  const selectedRows = visibleRows.filter((row) => selectedIds.has(row.product.id));
  const tabs: Array<{ key: ActionTab; label: string; count: number }> = [
    { key: "immediate", label: copy.buyNow, count: rows.filter((row) => actionTabForRow(row) === "immediate").length },
    { key: "soon", label: copy.buySoon, count: rows.filter((row) => actionTabForRow(row) === "soon").length },
    { key: "watch", label: copy.watch, count: rows.filter((row) => actionTabForRow(row) === "watch").length }
  ];

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportPurchaseList() {
    const source = selectedRows.length ? selectedRows : visibleRows;
    const csv = [
      [copy.priority, copy.productInfo, "SKU", copy.currentStock, copy.dailyAverage, copy.saleableDays, copy.action, copy.suggestedQty].join(","),
      ...source.map((row) => [
        riskLabel(row, copy),
        formatProductLabel(row.product),
        row.product.sku,
        row.currentStock,
        row.dailyAverage,
        formatSaleableDaysText(row, copy),
        actionLabel(row, copy),
        row.suggestedQty
      ].join(","))
    ].join("\n");
    downloadTextFile("purchase-action-list.csv", csv);
  }

  async function copyPurchaseList() {
    const source = selectedRows.length ? selectedRows : visibleRows;
    const text = source.map((row) => `${formatProductLabel(row.product)} / ${copy.suggestedCapsule} ${row.suggestedQty}`).join("\n");
    await navigator.clipboard?.writeText(text);
  }

  return (
    <DecisionPanel
      eyebrow={copy.actionEyebrow}
      title={copy.actionTitle}
      description={copy.actionDescription}
      meta={copy.autoGenerated}
      toolbar={(
        <>
          <DecisionSearch value={search} placeholder={copy.searchProduct} onChange={onSearchChange} />
          <DecisionSelect value={sortKey} onChange={(value) => onSortChange(value as DecisionSortKey)}>
            <option value="risk">{copy.sortRisk}</option>
            <option value="suggested">{copy.sortSuggested}</option>
            <option value="days">{copy.sortDays}</option>
            <option value="sales">{copy.sortSales}</option>
            <option value="stock">{copy.sortStock}</option>
          </DecisionSelect>
          <button type="button" onClick={exportPurchaseList} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
            <Download className="h-4 w-4" />
            {copy.exportExcel}
          </button>
          <button type="button" onClick={copyPurchaseList} className="h-10 rounded-xl bg-brand px-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-lift">
            {copy.copyList}
          </button>
        </>
      )}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${tab === item.key ? "border-brand bg-brand text-white shadow-soft" : "border-line bg-white/75 text-ink/65 hover:border-brand/40 hover:text-ink"}`}
          >
            {item.label}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === item.key ? "bg-white/18 text-white" : "bg-panel text-ink/55"}`}>{item.count}</span>
          </button>
        ))}
      </div>

      {loading ? <DecisionSkeleton /> : (
        <DecisionCategoryStack groups={groupedRows} activeKey={activeCategoryKey} onToggle={setOpenCategoryKey} emptyText={copy.emptyAction} formatNumber={formatNumber}>
          {(categoryRows) => (
            <DecisionTable columns="grid-cols-[44px_minmax(320px,2.1fr)_minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_minmax(150px,0.95fr)]">
              <DecisionTableHeader columns="grid-cols-[44px_minmax(320px,2.1fr)_minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_minmax(150px,0.95fr)]">
                <div />
                <div>{copy.productInfo}</div>
                <SortButton label={copy.currentStock} active={sortKey === "stock"} onClick={() => onSortChange("stock")} align="right" />
                <SortButton label={copy.dailyAverage} active={sortKey === "sales"} onClick={() => onSortChange("sales")} align="right" />
                <SortButton label={copy.saleableDays} active={sortKey === "days"} onClick={() => onSortChange("days")} align="right" />
                <div className="text-center">{copy.status}</div>
                <div className="text-center">{copy.action}</div>
                <SortButton label={copy.suggestedQty} active={sortKey === "suggested"} onClick={() => onSortChange("suggested")} align="right" />
              </DecisionTableHeader>
              <div className="divide-y divide-line/80">
                {categoryRows.map((row) => (
                  <DecisionRow key={row.product.id} status={row.status} columns="grid-cols-[44px_minmax(320px,2.1fr)_minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_minmax(150px,0.95fr)]">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.product.id)}
                      onChange={() => toggleRow(row.product.id)}
                      className="h-4 w-4 rounded border-line text-brand"
                    />
                    <ProductInfoCell product={row.product} />
                    <NumberCell>{formatNumber(row.currentStock)}</NumberCell>
                    <NumberCell>{formatNumber(row.dailyAverage)}</NumberCell>
                    <SaleableDaysCell row={row} copy={copy} />
                    <div className="text-center"><StatusBadge status={row.status} /></div>
                    <div className="text-center font-semibold text-ink">{actionLabel(row, copy)}</div>
                    <NumberCell>
                      <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand">
                        {copy.suggestedCapsule} {formatNumber(row.suggestedQty)}
                      </span>
                    </NumberCell>
                  </DecisionRow>
                ))}
              </div>
            </DecisionTable>
          )}
        </DecisionCategoryStack>
      )}
    </DecisionPanel>
  );
}

function StockRiskRanking({
  rows,
  anchorDate,
  loading,
  search,
  statusFilter,
  sortKey,
  onSearchChange,
  onStatusChange,
  onSortChange
}: {
  rows: SmartReplenishmentRow[];
  anchorDate: Date;
  loading: boolean;
  search: string;
  statusFilter: string;
  sortKey: DecisionSortKey;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (key: DecisionSortKey) => void;
}) {
  const { language, t, formatCurrency, formatNumber } = useLanguage();
  const copy = decisionCopy(language);
  const riskRows = rows
    .filter((row) => statusFilter === "all" || getRowRiskLevel(row) === statusFilter)
    .filter((row) => matchesDecisionSearch(row, search));
  const visibleRows = sortRiskRankingRows(riskRows, sortKey).slice(0, 14);
  const within3 = rows.filter((row) => getRowRiskLevel(row) === "danger").length;
  const within7 = rows.filter((row) => {
    const level = getRowRiskLevel(row);
    return level === "danger" || level === "warning";
  }).length;
  const lostRevenue = rows.reduce((sum, row) => sum + estimatedLostRevenue(row), 0);
  const immediate = within3;
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>("FIRST");
  const groupedRows = groupDecisionRowsByCategory(visibleRows, t);
  const activeCategoryKey = resolveDecisionCategoryKey(openCategoryKey, groupedRows);

  return (
    <DecisionPanel
      eyebrow={copy.riskEyebrow}
      title={copy.riskTitle}
      description={copy.riskDescription}
      meta={copy.sortedByRisk}
      toolbar={(
        <>
          <DecisionSearch value={search} placeholder={copy.searchProduct} onChange={onSearchChange} />
          <DecisionSelect value={statusFilter} onChange={onStatusChange}>
            <option value="all">{copy.allStatus}</option>
            <option value="danger">{copy.danger}</option>
            <option value="warning">{copy.warning}</option>
            <option value="normal">{copy.normal}</option>
          </DecisionSelect>
          <DecisionSelect value={sortKey} onChange={(value) => onSortChange(value as DecisionSortKey)}>
            <option value="risk">{copy.sortRisk}</option>
            <option value="lostRevenue">{copy.sortLostRevenue}</option>
            <option value="days">{copy.sortDays}</option>
            <option value="stock">{copy.sortStock}</option>
          </DecisionSelect>
        </>
      )}
    >
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <DecisionMetric label={copy.soldOut3Days} value={formatNumber(within3)} tone="danger" />
        <DecisionMetric label={copy.soldOut7Days} value={formatNumber(within7)} tone="warning" />
        <DecisionMetric label={copy.estimatedLostRevenue} value={formatCurrency(lostRevenue)} tone="danger" />
        <DecisionMetric label={copy.immediateSku} value={formatNumber(immediate)} tone="normal" />
      </div>

      {loading ? <DecisionSkeleton /> : (
        <DecisionCategoryStack groups={groupedRows} activeKey={activeCategoryKey} onToggle={setOpenCategoryKey} emptyText={copy.emptyRisk} formatNumber={formatNumber}>
          {(categoryRows, startIndex) => (
            <DecisionTable columns="grid-cols-[64px_minmax(320px,2.1fr)_minmax(120px,0.65fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)_minmax(140px,0.95fr)_minmax(150px,1fr)_minmax(120px,0.8fr)]">
              <DecisionTableHeader columns="grid-cols-[64px_minmax(320px,2.1fr)_minmax(120px,0.65fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)_minmax(140px,0.95fr)_minmax(150px,1fr)_minmax(120px,0.8fr)]">
                <div>{copy.rank}</div>
                <div>{copy.productInfo}</div>
                <SortButton label={copy.currentStock} active={sortKey === "stock"} onClick={() => onSortChange("stock")} align="right" />
                <SortButton label={copy.dailyAverage} active={sortKey === "sales"} onClick={() => onSortChange("sales")} align="right" />
                <SortButton label={copy.saleableDays} active={sortKey === "days"} onClick={() => onSortChange("days")} align="right" />
                <div className="text-center">{copy.stockoutDate}</div>
                <SortButton label={copy.lostRevenue} active={sortKey === "lostRevenue"} onClick={() => onSortChange("lostRevenue")} align="right" />
                <div className="text-center">{copy.riskLevel}</div>
              </DecisionTableHeader>
              <div className="divide-y divide-line/80">
                {categoryRows.map((row, index) => (
                  <DecisionRow key={row.product.id} status={getRowRiskLevel(row)} columns="grid-cols-[64px_minmax(320px,2.1fr)_minmax(120px,0.65fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)_minmax(140px,0.95fr)_minmax(150px,1fr)_minmax(120px,0.8fr)]">
                    <div className="font-bold text-ink/70">{startIndex + index + 1}</div>
                    <ProductInfoCell product={row.product} />
                    <NumberCell>{formatNumber(row.currentStock)}</NumberCell>
                    <NumberCell>{formatNumber(row.dailyAverage)}</NumberCell>
                    <SaleableDaysCell row={row} copy={copy} />
                    <div className="text-center text-sm font-semibold text-ink/70">{calculateEstimatedStockoutDate(getRowDaysOfStock(row), anchorDate, t)}</div>
                    <NumberCell>{formatCurrency(estimatedLostRevenue(row))}</NumberCell>
                    <div className="text-center"><RiskBadge row={row} copy={copy} /></div>
                  </DecisionRow>
                ))}
              </div>
            </DecisionTable>
          )}
        </DecisionCategoryStack>
      )}
    </DecisionPanel>
  );
}

function SkuLifecycleCenter({
  rows,
  loading,
  search,
  statusFilter,
  sortKey,
  onSearchChange,
  onStatusChange,
  onSortChange
}: {
  rows: LifecycleRow[];
  loading: boolean;
  search: string;
  statusFilter: string;
  sortKey: DecisionSortKey;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (key: DecisionSortKey) => void;
}) {
  const { language, t, formatNumber } = useLanguage();
  const copy = decisionCopy(language);
  const visibleRows = sortLifecycleRows(
    rows
      .filter((row) => statusFilter === "all" || row.lifecycleStatus === statusFilter || row.status === statusFilter)
      .filter((row) => matchesDecisionSearch(row, search)),
    sortKey
  );
  const highRisk = rows.filter((row) => row.status === "danger").length;
  const stable = rows.filter((row) => row.lifecycleStatus === "stable").length;
  const slow = rows.filter((row) => row.lifecycleStatus === "slow").length;
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>("FIRST");
  const groupedRows = groupDecisionRowsByCategory(visibleRows, t);
  const activeCategoryKey = resolveDecisionCategoryKey(openCategoryKey, groupedRows);

  return (
    <DecisionPanel
      eyebrow={copy.lifecycleEyebrow}
      title={copy.lifecycleTitle}
      description={copy.lifecycleDescription}
      meta={copy.lastUpdated}
      toolbar={(
        <>
          <DecisionSearch value={search} placeholder={copy.searchProduct} onChange={onSearchChange} />
          <DecisionSelect value={statusFilter} onChange={onStatusChange}>
            <option value="all">{copy.allStatus}</option>
            <option value="danger">{copy.danger}</option>
            <option value="warning">{copy.warning}</option>
            <option value="stable">{copy.stable}</option>
            <option value="slow">{copy.slow}</option>
          </DecisionSelect>
          <DecisionSelect value={sortKey} onChange={(value) => onSortChange(value as DecisionSortKey)}>
            <option value="risk">{copy.sortRisk}</option>
            <option value="days">{copy.sortDays}</option>
            <option value="sales">{copy.sortSales}</option>
            <option value="stock">{copy.sortStock}</option>
          </DecisionSelect>
        </>
      )}
    >
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <DecisionMetric label={copy.totalSku} value={formatNumber(rows.length)} tone="neutral" />
        <DecisionMetric label={copy.highRiskSku} value={formatNumber(highRisk)} tone="danger" />
        <DecisionMetric label={copy.stableSku} value={formatNumber(stable)} tone="normal" />
        <DecisionMetric label={copy.slowSku} value={formatNumber(slow)} tone="warning" />
      </div>

      {loading ? <DecisionSkeleton /> : (
        <DecisionCategoryStack groups={groupedRows} activeKey={activeCategoryKey} onToggle={setOpenCategoryKey} emptyText={copy.emptyLifecycle} formatNumber={formatNumber}>
          {(categoryRows) => (
            <DecisionTable columns="grid-cols-[minmax(320px,2.1fr)_minmax(120px,0.7fr)_minmax(130px,0.85fr)_minmax(120px,0.75fr)_minmax(120px,0.85fr)_minmax(140px,0.95fr)_minmax(160px,1fr)]">
              <DecisionTableHeader columns="grid-cols-[minmax(320px,2.1fr)_minmax(120px,0.7fr)_minmax(130px,0.85fr)_minmax(120px,0.75fr)_minmax(120px,0.85fr)_minmax(140px,0.95fr)_minmax(160px,1fr)]">
                <div>{copy.productInfo}</div>
                <SortButton label={copy.currentStock} active={sortKey === "stock"} onClick={() => onSortChange("stock")} align="right" />
                <SortButton label={copy.sales730} active={sortKey === "sales"} onClick={() => onSortChange("sales")} align="right" />
                <div className="text-right tabular-nums">{copy.dailyAverage}</div>
                <SortButton label={copy.saleableDays} active={sortKey === "days"} onClick={() => onSortChange("days")} align="right" />
                <div className="text-center">{copy.lifecycleStatus}</div>
                <div className="text-center">{copy.action}</div>
              </DecisionTableHeader>
              <div className="divide-y divide-line/80">
                {categoryRows.map((row) => (
                  <DecisionRow key={row.product.id} status={row.status} columns="grid-cols-[minmax(320px,2.1fr)_minmax(120px,0.7fr)_minmax(130px,0.85fr)_minmax(120px,0.75fr)_minmax(120px,0.85fr)_minmax(140px,0.95fr)_minmax(160px,1fr)]">
                    <ProductInfoCell product={row.product} />
                    <NumberCell>{formatNumber(row.currentStock)}</NumberCell>
                    <NumberCell>{formatNumber(row.sales7)} / {formatNumber(row.salesInWindow)}</NumberCell>
                    <NumberCell>{formatNumber(row.dailyAverage)}</NumberCell>
                    <SaleableDaysCell row={row} copy={copy} />
                    <div className="text-center"><LifecycleBadge label={row.lifecycle} status={row.lifecycleStatus} /></div>
                    <div className="text-center font-semibold text-ink">{row.lifecycleAction}</div>
                  </DecisionRow>
                ))}
              </div>
            </DecisionTable>
          )}
        </DecisionCategoryStack>
      )}
    </DecisionPanel>
  );
}

function DecisionPanel({
  eyebrow,
  title,
  description,
  meta,
  toolbar,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="premium-section-eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-[#bca77a]" />
            {eyebrow}
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/55">{description}</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <span className="premium-status-chip px-3 py-1.5 text-xs font-semibold text-ink/58">{meta}</span>
          {toolbar}
        </div>
      </div>
      {children}
    </div>
  );
}

type DecisionCategoryGroup<T extends { product: ProductWithStock; currentStock: number }> = {
  key: string;
  label: string;
  rows: T[];
  startIndex: number;
  totalStock: number;
};

function DecisionCategoryStack<T extends { product: ProductWithStock; currentStock: number }>({
  groups,
  activeKey,
  onToggle,
  emptyText,
  formatNumber,
  children
}: {
  groups: DecisionCategoryGroup<T>[];
  activeKey: string | null;
  onToggle: (key: string | null) => void;
  emptyText: string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  children: (rows: T[], startIndex: number) => React.ReactNode;
}) {
  const { t } = useLanguage();
  if (!groups.length) return <DecisionEmpty text={emptyText} />;

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const expanded = group.key === activeKey;
        return (
          <div key={group.key} className={`rounded-[26px] border border-white/65 bg-white/72 shadow-[0_16px_42px_rgba(23,33,29,0.06)] backdrop-blur transition duration-200 ${expanded ? "p-4" : "p-0 hover:-translate-y-0.5 hover:shadow-soft"}`}>
            <button
              type="button"
              onClick={() => onToggle(expanded ? null : group.key)}
              className={`flex w-full flex-wrap items-center justify-between gap-3 text-left transition ${expanded ? "rounded-2xl border-b border-line pb-4" : "rounded-[26px] p-4 hover:bg-[#f7f4ec]"}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand shadow-sm">
                  {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{t("common.category")}</div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{group.label}</h3>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted">
                <span className="premium-status-chip px-3 py-1.5">
                  SKU {formatNumber(group.rows.length)}
                </span>
                <span className="premium-status-chip px-3 py-1.5">
                  {t("common.currentStock")} {formatNumber(group.totalStock)}
                </span>
              </div>
            </button>
            {expanded ? <div className="mt-4">{children(group.rows, group.startIndex)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function DecisionMetric({ label, value, tone }: { label: string; value: string; tone: "danger" | "warning" | "normal" | "neutral" }) {
  const colors = {
    danger: "from-red-50 text-red-800 border-red-100",
    warning: "from-amber-50 text-amber-800 border-amber-100",
    normal: "from-emerald-50 text-emerald-800 border-emerald-100",
    neutral: "from-slate-50 text-ink border-line"
  }[tone];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${colors} to-white p-4 shadow-[0_14px_34px_rgba(31,44,38,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-soft`}>
      <div className="text-xs font-semibold text-ink/45">{label}</div>
      <div className="premium-number mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function DecisionSearch({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full min-w-[220px] rounded-xl border border-white/70 bg-white/78 pl-9 pr-3 text-sm outline-none shadow-sm transition focus:border-brand/50 focus:ring-2 focus:ring-brand/10"
      />
    </label>
  );
}

function DecisionSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-xl border border-white/70 bg-white/78 px-3 text-sm font-semibold text-ink/70 shadow-sm outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/10"
    >
      {children}
    </select>
  );
}

function DecisionTable({ children }: { columns?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/65 bg-white/76 shadow-[0_18px_48px_rgba(31,44,38,0.06)] backdrop-blur">
      <div className="overflow-x-auto">
        <div className="min-w-[1040px]">{children}</div>
      </div>
    </div>
  );
}

function DecisionTableHeader({ columns, children }: { columns: string; children: React.ReactNode }) {
  return (
    <div className={`sticky top-0 z-10 grid ${columns} items-center gap-4 border-b border-line bg-[#f3f5ee]/94 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink/45 backdrop-blur-xl`}>
      {children}
    </div>
  );
}

function DecisionRow({ status, columns, children }: { status: SmartReplenishmentRow["status"]; columns: string; children: React.ReactNode }) {
  const line = status === "danger" ? "bg-red-400" : status === "warning" ? "bg-amber-400" : "bg-emerald-500";
  const highlight = status === "danger" ? "bg-red-50/35" : status === "warning" ? "bg-yellow-50/25" : "";
  return (
    <div className={`group relative grid ${columns} items-center gap-4 px-4 py-4 text-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/86 hover:shadow-[0_12px_30px_rgba(23,33,29,0.06)] ${highlight}`}>
      <span className={`absolute left-0 top-3 h-[calc(100%-24px)] w-1 rounded-r-full opacity-80 shadow-sm ${line}`} />
      {children}
    </div>
  );
}

function SortButton({ label, active, align = "left", onClick }: { label: string; active: boolean; align?: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full font-bold transition hover:text-brand ${active ? "text-brand" : ""} ${align === "right" ? "text-right" : "text-left"}`}
    >
      {label}
    </button>
  );
}

function ProductInfoCell({ product }: { product: ProductWithStock }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-ink">{product.name}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/45">
        <span className="font-semibold tabular-nums">{product.sku}</span>
        <span className="premium-status-chip px-2 py-0.5 font-semibold text-ink/55">{formatVariantName(product)}</span>
      </div>
    </div>
  );
}

function NumberCell({ children }: { children: React.ReactNode }) {
  return <div className="premium-number text-right font-semibold tabular-nums text-ink">{children}</div>;
}

function SaleableDaysCell({ row, copy }: { row: SmartReplenishmentRow | LifecycleRow; copy: DecisionCopy }) {
  const days = getRowDaysOfStock(row);
  const capped = Number.isFinite(days) ? Math.min(30, Math.max(0, days)) : 30;
  const width = `${Math.max(4, (capped / 30) * 100)}%`;
  const level = getRiskLevel(days, row.currentStock, row.dailyAverage);
  const bar = level === "danger" ? "bg-red-500" : level === "warning" ? "bg-amber-500" : "bg-emerald-600";

  return (
    <div className="text-right">
      <div className="premium-number font-semibold tabular-nums text-ink">{formatSaleableDaysText(row, copy)}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div className={`h-full rounded-full ${bar}`} style={{ width }} />
      </div>
    </div>
  );
}

function DecisionEmpty({ text }: { text: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-panel text-ink/35">
        <CircleAlert className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-ink/55">{text}</div>
    </div>
  );
}

function DecisionSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-panel" />
      ))}
    </div>
  );
}

function RiskBadge({ row, copy }: { row: SmartReplenishmentRow; copy: DecisionCopy }) {
  const tone = getRowRiskLevel(row);
  const label = row.currentStock === 0 ? copy.soldOut : tone === "danger" ? copy.danger : tone === "warning" ? copy.warning : copy.normal;
  const className = tone === "danger" ? "border-red-200 bg-red-50 text-red-800" :
    tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" :
      "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ${className}`}>
      {label}
    </span>
  );
}

function actionTabForRow(row: SmartReplenishmentRow): ActionTab {
  if (row.status === "danger") return "immediate";
  if (row.status === "warning") return "soon";
  return "watch";
}

function actionLabel(row: SmartReplenishmentRow, copy: DecisionCopy) {
  if (row.currentStock === 0 || row.status === "danger") return copy.buyNow;
  if (row.status === "warning") return copy.buySoon;
  if (row.dailyAverage === 0) return copy.observeSales;
  return copy.noPurchase;
}

function riskLabel(row: SmartReplenishmentRow, copy: DecisionCopy) {
  if (row.currentStock === 0) return copy.soldOut;
  const level = getRowRiskLevel(row);
  if (level === "danger") return copy.danger;
  if (level === "warning") return copy.warning;
  return copy.normal;
}

function matchesDecisionSearch(row: SmartReplenishmentRow | LifecycleRow, search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  const product = row.product;
  return `${product.name} ${product.sku} ${product.color ?? ""} ${product.size ?? ""}`.toLowerCase().includes(normalized);
}

function groupDecisionRowsByCategory<T extends { product: ProductWithStock; currentStock: number }>(rows: T[], t: TFunction): DecisionCategoryGroup<T>[] {
  const map = new Map<string, DecisionCategoryGroup<T>>();

  rows.forEach((row, index) => {
    const key = categoryKey(row.product);
    const current = map.get(key) ?? {
      key,
      label: categoryLabel(key, t),
      rows: [],
      startIndex: index,
      totalStock: 0
    };

    current.rows.push(row);
    current.totalStock += row.currentStock;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => categorySortOrder(a.key) - categorySortOrder(b.key) || a.label.localeCompare(b.label));
}

function resolveDecisionCategoryKey<T extends { product: ProductWithStock; currentStock: number }>(
  openKey: string | null,
  groups: DecisionCategoryGroup<T>[]
) {
  if (openKey === null) return null;
  if (openKey === "FIRST") return groups[0]?.key ?? null;
  return groups.some((group) => group.key === openKey) ? openKey : groups[0]?.key ?? null;
}

function categoryKey(product: Pick<ProductWithStock, "sku"> | null | undefined) {
  return product?.sku?.split("-")[0]?.trim().toUpperCase() || "OTHER";
}

function categoryLabel(key: string, t: TFunction) {
  if (key === "4LK") return t("category.4lk");
  if (key === "BLD") return t("category.bld");
  if (key === "BZG") return t("category.bzg");
  return key;
}

function categorySortOrder(key: string) {
  if (key === "4LK") return 0;
  if (key === "BLD") return 1;
  if (key === "BZG") return 2;
  return 99;
}

function sortDecisionRows(rows: SmartReplenishmentRow[], key: DecisionSortKey) {
  return [...rows].sort((a, b) => {
    if (key === "stock") return b.currentStock - a.currentStock;
    if (key === "sales") return b.dailyAverage - a.dailyAverage;
    if (key === "days") return normalizedSaleableDays(a) - normalizedSaleableDays(b);
    if (key === "suggested") return b.suggestedQty - a.suggestedQty;
    if (key === "lostRevenue") return estimatedLostRevenue(b) - estimatedLostRevenue(a);
    return riskSortValue(a) - riskSortValue(b);
  });
}

function sortRiskRankingRows(rows: SmartReplenishmentRow[], key: DecisionSortKey) {
  return [...rows].sort((a, b) => {
    if (key === "stock") return b.currentStock - a.currentStock;
    if (key === "sales") return b.dailyAverage - a.dailyAverage;
    if (key === "days") return normalizedSaleableDays(a) - normalizedSaleableDays(b);
    if (key === "lostRevenue") return estimatedLostRevenue(b) - estimatedLostRevenue(a);

    const riskDiff = riskPriority(getRowRiskLevel(a)) - riskPriority(getRowRiskLevel(b));
    if (riskDiff !== 0) return riskDiff;

    const dayDiff = normalizedSaleableDays(a) - normalizedSaleableDays(b);
    if (dayDiff !== 0) return dayDiff;

    return estimatedLostRevenue(b) - estimatedLostRevenue(a);
  });
}

function sortLifecycleRows(rows: LifecycleRow[], key: DecisionSortKey) {
  return [...rows].sort((a, b) => {
    if (key === "stock") return b.currentStock - a.currentStock;
    if (key === "sales") return b.salesInWindow - a.salesInWindow;
    if (key === "days") return normalizedSaleableDays(a) - normalizedSaleableDays(b);
    return riskSortValue(a) - riskSortValue(b);
  });
}

function riskSortValue(row: SmartReplenishmentRow | LifecycleRow) {
  if (row.currentStock === 0) return -1;
  if (row.dailyAverage === 0) return 9999;
  return normalizedSaleableDays(row);
}

function normalizedSaleableDays(row: SmartReplenishmentRow | LifecycleRow) {
  const days = calculateDaysOfStock(row.currentStock, row.dailyAverage);
  return Number.isFinite(days) ? days : 9999;
}

function estimatedLostRevenue(row: SmartReplenishmentRow) {
  return calculateEstimatedLostSales(getRowDaysOfStock(row), row.dailyAverage, money(row.product.sale_price));
}

function formatSaleableDaysText(row: SmartReplenishmentRow | LifecycleRow, copy: DecisionCopy) {
  if (row.currentStock === 0) return copy.soldOut;
  if (row.dailyAverage === 0) return copy.noSales;
  return `${formatDaysValue(calculateDaysOfStock(row.currentStock, row.dailyAverage))}${copy.dayUnit}`;
}

function calculateDaysOfStock(stock: number, avgDailySales: number) {
  const currentStock = Math.max(0, Number(stock ?? 0));
  const average = Math.max(0, Number(avgDailySales ?? 0));
  if (currentStock <= 0) return 0;
  if (average <= 0) return Number.POSITIVE_INFINITY;
  return currentStock / average;
}

function getRiskLevel(daysOfStock: number, stock: number, avgDailySales: number): InventoryRiskLevel {
  if (Math.max(0, Number(stock ?? 0)) <= 0) return "danger";
  if (Math.max(0, Number(avgDailySales ?? 0)) <= 0 || !Number.isFinite(daysOfStock)) return "normal";
  if (daysOfStock <= 3) return "danger";
  if (daysOfStock <= 7) return "warning";
  return "normal";
}

function calculateEstimatedStockoutDate(daysOfStock: number, anchorDate: Date, t: TFunction) {
  if (!Number.isFinite(daysOfStock)) return t("unit.noRisk");
  const date = new Date(anchorDate);
  date.setDate(anchorDate.getDate() + Math.max(0, Math.ceil(daysOfStock)));
  return toDateKey(date);
}

function calculateEstimatedLostSales(daysOfStock: number, avgDailySales: number, price: number) {
  const average = Math.max(0, Number(avgDailySales ?? 0));
  if (average <= 0 || !Number.isFinite(daysOfStock)) return 0;
  const uncoveredDays = Math.max(0, REPLENISHMENT_LEAD_DAYS - daysOfStock);
  return uncoveredDays * average * money(price);
}

function getRowDaysOfStock(row: SmartReplenishmentRow | LifecycleRow) {
  return calculateDaysOfStock(row.currentStock, row.dailyAverage);
}

function getRowRiskLevel(row: SmartReplenishmentRow): InventoryRiskLevel {
  return getRiskLevel(getRowDaysOfStock(row), row.currentStock, row.dailyAverage);
}

function riskPriority(level: InventoryRiskLevel) {
  if (level === "danger") return 0;
  if (level === "warning") return 1;
  return 2;
}

function formatDaysValue(days: number) {
  if (!Number.isFinite(days)) return "∞";
  const rounded = Math.round(days * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatProductLabel(product: ProductWithStock) {
  return `${product.name} ${formatVariantName(product)}`;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type DecisionCopy = ReturnType<typeof decisionCopy>;

function decisionCopy(language: "zh" | "ko") {
  if (language === "ko") {
    return {
      actionEyebrow: "Purchase Action Center",
      actionTitle: "발주 액션 센터",
      actionDescription: "재고, 판매량, 예상 품절 시점을 기준으로 구매 우선순위를 자동 정리합니다.",
      riskEyebrow: "Inventory Risk Ranking",
      riskTitle: "재고 위험 순위",
      riskDescription: "품절 가능성이 높은 상품을 위험도 순서로 정렬해 예상 손실과 처리 우선순위를 보여줍니다.",
      lifecycleEyebrow: "SKU Lifecycle",
      lifecycleTitle: "SKU 라이프사이클 분석",
      lifecycleDescription: "최근 판매와 재고 일수를 기준으로 SKU의 성장, 안정, 저회전, 위험 상태를 판단합니다.",
      autoGenerated: "자동 계산",
      sortedByRisk: "위험도 순 정렬",
      lastUpdated: "실시간 재고 기준",
      searchProduct: "상품명 / SKU 검색",
      allStatus: "전체 상태",
      rank: "순위",
      productInfo: "상품 정보",
      currentStock: "현재 재고",
      dailyAverage: "일평균",
      saleableDays: "판매 가능일",
      status: "상태",
      action: "권장 액션",
      suggestedQty: "권장 수량",
      priority: "우선순위",
      sales730: "7/30일 판매",
      stockoutDate: "예상 품절일",
      lostRevenue: "예상 손실 매출",
      riskLevel: "위험 등급",
      lifecycleStatus: "라이프사이클",
      totalSku: "전체 SKU",
      highRiskSku: "고위험 SKU",
      stableSku: "안정 판매 SKU",
      slowSku: "저회전 SKU",
      soldOut3Days: "3일 내 품절 예상",
      soldOut7Days: "7일 내 품절 예상",
      estimatedLostRevenue: "예상 손실 매출",
      immediateSku: "즉시 발주 SKU",
      buyNow: "즉시 발주",
      buySoon: "7일 내 발주",
      watch: "보류",
      noPurchase: "발주 불필요",
      observeSales: "판매 관찰",
      danger: "위험",
      warning: "주의",
      normal: "정상",
      stable: "안정 판매",
      slow: "저회전",
      soldOut: "품절",
      noSales: "판매 없음",
      noRisk: "위험 없음",
      dayUnit: "일",
      suggestedCapsule: "권장",
      exportExcel: "Excel 내보내기",
      copyList: "구매 목록 복사",
      sortRisk: "위험도순",
      sortSuggested: "권장수량순",
      sortDays: "판매가능일순",
      sortSales: "판매순",
      sortStock: "재고순",
      sortLostRevenue: "손실매출순",
      emptyAction: "현재 조건에 맞는 구매 액션이 없습니다.",
      emptyRisk: "현재 조건에 맞는 재고 위험 상품이 없습니다.",
      emptyLifecycle: "현재 조건에 맞는 SKU가 없습니다."
    };
  }

  return {
    actionEyebrow: "Purchase Action Center",
    actionTitle: "补货行动中心",
    actionDescription: "根据库存、销量、预计售罄时间自动生成采购优先级，帮助负责人快速决定先补哪个 SKU。",
    riskEyebrow: "Inventory Risk Ranking",
    riskTitle: "库存风险排行榜",
    riskDescription: "按断货风险排序，集中展示当前库存、可售天数、预计售罄日期和可能损失销售额。",
    lifecycleEyebrow: "SKU Lifecycle",
    lifecycleTitle: "SKU 生命周期分析",
    lifecycleDescription: "根据近 7/30 天销量、日均销量和库存可售天数，判断 SKU 当前经营状态。",
    autoGenerated: "系统自动生成",
    sortedByRisk: "按风险优先排序",
    lastUpdated: "基于实时库存",
    searchProduct: "搜索商品名 / SKU",
    allStatus: "全部状态",
    rank: "排名",
    productInfo: "商品信息",
    currentStock: "当前库存",
    dailyAverage: "日均销量",
    saleableDays: "可售天数",
    status: "状态",
    action: "建议动作",
    suggestedQty: "建议采购数量",
    priority: "优先级",
    sales730: "近 7/30 天销量",
    stockoutDate: "预计售罄日期",
    lostRevenue: "预计损失销售额",
    riskLevel: "风险等级",
    lifecycleStatus: "生命周期状态",
    totalSku: "总 SKU 数",
    highRiskSku: "高风险 SKU",
    stableSku: "稳定销售 SKU",
    slowSku: "滞销 SKU",
    soldOut3Days: "预计 3 天内售罄",
    soldOut7Days: "预计 7 天内售罄",
    estimatedLostRevenue: "预计损失销售额",
    immediateSku: "需要立即补货 SKU",
    buyNow: "立即采购",
    buySoon: "7天内采购",
    watch: "暂不采购",
    noPurchase: "暂不采购",
    observeSales: "观察销售",
    danger: "危险",
    warning: "注意",
    normal: "正常",
    stable: "稳定销售",
    slow: "低动销 / 滞销",
    soldOut: "已售罄",
    noSales: "无销量",
    noRisk: "无风险",
    dayUnit: "天",
    suggestedCapsule: "建议",
    exportExcel: "导出 Excel",
    copyList: "复制采购清单",
    sortRisk: "风险优先",
    sortSuggested: "建议数量",
    sortDays: "可售天数",
    sortSales: "销量排序",
    sortStock: "库存排序",
    sortLostRevenue: "损失金额",
    emptyAction: "当前条件下没有需要处理的补货商品。",
    emptyRisk: "当前条件下没有库存风险商品。",
    emptyLifecycle: "当前条件下没有 SKU 数据。"
  };
}

function StatusBadge({ status }: { status: SmartReplenishmentRow["status"] }) {
  const { t } = useLanguage();
  const config = {
    danger: [t("dashboard.status.danger"), "bg-red-50 text-red-700 border-red-200"],
    warning: [t("dashboard.status.warning"), "bg-amber-50 text-amber-700 border-amber-200"],
    normal: [t("dashboard.status.normal"), "bg-emerald-50 text-emerald-700 border-emerald-200"]
  }[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ${config[1]}`}>{config[0]}</span>;
}

function LifecycleBadge({ label, status }: { label: string; status?: LifecycleStatus }) {
  const color = status === "danger" ? "bg-red-50 text-red-800 border-red-200" :
    status === "warning" ? "bg-amber-50 text-amber-800 border-amber-200" :
      status === "slow" ? "bg-slate-100 text-slate-700 border-slate-200" :
        "bg-blue-50 text-blue-800 border-blue-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ${color}`}>{label}</span>;
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
    const saleableDays = calculateDaysOfStock(row.currentStock, row.dailyAverage);
    const status: SmartReplenishmentRow["status"] = row.currentStock === 0 ? "danger" : saleableDays < 7 ? "danger" : saleableDays < 15 ? "warning" : "normal";
    const action = status === "danger" ? t("dashboard.replenishment.immediate") : status === "warning" ? t("dashboard.replenishment.within7Days") : t("dashboard.replenishment.noNeed");

    return { ...row, saleableDays, status, action };
  }).sort((a, b) => {
    if (b.suggestedQty !== a.suggestedQty) return b.suggestedQty - a.suggestedQty;
    return normalizedSaleableDays(a) - normalizedSaleableDays(b);
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

type ColorAnalysisRow = { color: string; quantity: number; revenue: number; profit: number; colorCode: string };
type SizeAnalysisRow = { size: string; quantity: number; revenue: number; profit: number; stock: number };
type MonthComparison = { month: number; quantity: number; momGrowth: number | null; yoyGrowth: number | null };

function buildMonthlySkuRows(rows: ReplenishmentRow[], salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>) {
  const map = new Map<string, MonthlySkuRow>();

  for (const row of rows) {
    map.set(row.product.id, {
      product: row.product,
      currentStock: row.currentStock,
      monthly: Array.from({ length: 12 }, () => ({ quantity: 0, revenue: 0, profit: 0 })),
      annualQuantity: 0,
      annualRevenue: 0,
      annualProfit: 0
    });
  }

  for (const sale of validSales(salesRows)) {
    const product = productMap.get(sale.product_id);
    const current = map.get(sale.product_id);
    if (!product || !current) continue;
    const monthIndex = Math.max(0, Math.min(11, parseDateKey(sale.sale_date).getMonth()));
    const quantity = Math.max(0, Number(sale.quantity ?? 0));
    const revenue = quantity * money(product.sale_price);
    const profit = totalProfit(product, quantity);

    current.monthly[monthIndex].quantity += quantity;
    current.monthly[monthIndex].revenue += revenue;
    current.monthly[monthIndex].profit += profit;
    current.annualQuantity += quantity;
    current.annualRevenue += revenue;
    current.annualProfit += profit;
  }

  return Array.from(map.values()).sort((a, b) => {
    const colorCompare = compareColor(a.product.color, b.product.color);
    if (colorCompare !== 0) return colorCompare;
    return compareSize(a.product.size, b.product.size);
  });
}

function filterMonthlySkuRows(rows: MonthlySkuRow[], color: string, size: string, search: string) {
  const normalized = search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesColor = color === "all" || row.product.color === color;
    const matchesSize = size === "all" || normalizeSize(row.product.size) === size;
    const haystack = `${row.product.sku} ${row.product.name} ${row.product.color ?? ""} ${row.product.size ?? ""}`.toLowerCase();
    return matchesColor && matchesSize && (!normalized || haystack.includes(normalized));
  });
}

function buildColorAnalysis(rows: MonthlySkuRow[]): ColorAnalysisRow[] {
  const map = new Map<string, ColorAnalysisRow>();
  for (const row of rows) {
    const color = row.product.color || "-";
    const current = map.get(color) ?? { color, quantity: 0, revenue: 0, profit: 0, colorCode: colorToken(color) };
    current.quantity += row.annualQuantity;
    current.revenue += row.annualRevenue;
    current.profit += row.annualProfit;
    map.set(color, current);
  }
  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
}

function buildSizeRankings(rows: MonthlySkuRow[]): SizeAnalysisRow[] {
  const map = new Map<string, SizeAnalysisRow>();
  for (const row of rows) {
    const size = normalizeSize(row.product.size);
    const current = map.get(size) ?? { size, quantity: 0, revenue: 0, profit: 0, stock: 0 };
    current.quantity += row.annualQuantity;
    current.revenue += row.annualRevenue;
    current.profit += row.annualProfit;
    current.stock += row.currentStock;
    map.set(size, current);
  }
  return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
}

function buildMonthlyDecisionCards(
  rows: MonthlySkuRow[],
  replenishmentRows: SmartReplenishmentRow[],
  movements: MovementRow[],
  language: "zh" | "ko",
  formatCurrency: (value: number) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
): MonthlyDecisionCardData[] {
  const copy = monthlyDecisionCopy(language);
  const rowsByProductId = new Map(rows.map((row) => [row.product.id, row]));
  const shortageRows = replenishmentRows
    .filter((row) => row.status !== "normal" || row.saleableDays < 15)
    .sort((a, b) => a.saleableDays - b.saleableDays || b.suggestedQty - a.suggestedQty)
    .slice(0, 5)
    .map((row) => ({
      label: formatVariantName(row.product),
      value: row.saleableDays >= 999 ? copy.noSales : `${formatNumber(row.saleableDays)}${copy.days}`,
      helper: `${copy.stock} ${formatNumber(row.currentStock)} · ${copy.suggested} ${formatNumber(row.suggestedQty)}`
    }));
  const slowRows = rows
    .filter((row) => row.currentStock > 0 && row.annualQuantity <= 0)
    .sort((a, b) => b.currentStock * money(b.product.purchase_price) - a.currentStock * money(a.product.purchase_price))
    .slice(0, 5)
    .map((row) => ({
      label: formatVariantName(row.product),
      value: formatCurrency(row.currentStock * money(row.product.purchase_price)),
      helper: `${copy.stock} ${formatNumber(row.currentStock)} · ${copy.yearSales} ${formatNumber(row.annualQuantity)}`
    }));
  const hotRows = rows
    .filter((row) => row.annualQuantity > 0)
    .sort((a, b) => b.annualQuantity - a.annualQuantity)
    .slice(0, 5)
    .map((row) => ({
      label: formatVariantName(row.product),
      value: formatNumber(row.annualQuantity),
      helper: `${copy.revenue} ${formatCurrency(row.annualRevenue)}`
    }));
  const purchaseRows = replenishmentRows
    .filter((row) => row.suggestedQty > 0)
    .sort((a, b) => b.suggestedQty - a.suggestedQty || a.saleableDays - b.saleableDays)
    .slice(0, 5)
    .map((row) => ({
      label: formatVariantName(row.product),
      value: formatNumber(row.suggestedQty),
      helper: `${row.action} · ${copy.saleableDays} ${row.saleableDays >= 999 ? "-" : `${formatNumber(row.saleableDays)}${copy.days}`}`
    }));
  const returnMap = new Map<string, number>();
  for (const movement of movements) {
    if (!isReturnInboundMovement(movement)) continue;
    returnMap.set(movement.product_id, (returnMap.get(movement.product_id) ?? 0) + Math.max(0, Number(movement.quantity ?? 0)));
  }
  const returnRows = Array.from(returnMap.entries())
    .map(([productId, quantity]) => ({ row: rowsByProductId.get(productId), quantity }))
    .filter((item): item is { row: MonthlySkuRow; quantity: number } => Boolean(item.row))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map(({ row, quantity }) => ({
      label: formatVariantName(row.product),
      value: formatNumber(quantity),
      helper: `${copy.returnRate} ${formatPercent(row.annualQuantity > 0 ? (quantity / row.annualQuantity) * 100 : null)}`
    }));

  return [
    { title: copy.shortageTitle, subtitle: copy.shortageSubtitle, icon: CircleAlert, tone: "danger", rows: shortageRows },
    { title: copy.slowTitle, subtitle: copy.slowSubtitle, icon: AlertTriangle, tone: "neutral", rows: slowRows },
    { title: copy.hotTitle, subtitle: copy.hotSubtitle, icon: TrendingUp, tone: "success", rows: hotRows },
    { title: copy.replenishmentTitle, subtitle: copy.replenishmentSubtitle, icon: PackageCheck, tone: "warning", rows: purchaseRows },
    { title: copy.returnTitle, subtitle: copy.returnSubtitle, icon: Boxes, tone: "info", rows: returnRows }
  ];
}

function buildMonthComparison(rows: MonthlySkuRow[], previousYearRows: MonthlySkuRow[], monthIndex: number): MonthComparison {
  const current = rows.reduce((sum, row) => sum + row.monthly[monthIndex].quantity, 0);
  const previousMonth = monthIndex > 0 ? rows.reduce((sum, row) => sum + row.monthly[monthIndex - 1].quantity, 0) : 0;
  const previousYear = previousYearRows.reduce((sum, row) => sum + row.monthly[monthIndex].quantity, 0);
  return {
    month: monthIndex + 1,
    quantity: current,
    momGrowth: compare(current, previousMonth),
    yoyGrowth: compare(current, previousYear)
  };
}

function sumMonthlyRows(rows: MonthlySkuRow[], metric: "quantity" | "revenue" | "profit") {
  if (metric === "quantity") return rows.reduce((sum, row) => sum + row.annualQuantity, 0);
  if (metric === "revenue") return rows.reduce((sum, row) => sum + row.annualRevenue, 0);
  return rows.reduce((sum, row) => sum + row.annualProfit, 0);
}

function formatMonthlyMetricCell(
  row: MonthlySkuRow,
  month: MonthlySkuRow["monthly"][number],
  metric: MonthlySkuMetric,
  formatCurrency: (value: number) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
) {
  if (metric === "stock") return "-";
  const value = month[metric];
  if (!value) return "0";
  return metric === "quantity" ? formatNumber(value) : formatCurrency(value);
}

function formatMonthlyAnnualTotal(
  row: MonthlySkuRow,
  metric: MonthlySkuMetric,
  formatCurrency: (value: number) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
) {
  if (metric === "stock") return formatNumber(row.currentStock);
  if (metric === "quantity") return formatNumber(row.annualQuantity);
  if (metric === "revenue") return formatCurrency(row.annualRevenue);
  return formatCurrency(row.annualProfit);
}

function formatMonthlyRankingValue(
  value: number,
  metric: MonthlySkuMetric,
  formatCurrency: (value: number) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
) {
  return metric === "revenue" || metric === "profit" ? formatCurrency(value) : formatNumber(value);
}

function formatVariantName(product: ProductWithStock) {
  return `${normalizeSize(product.size)} ${product.color || "-"}`;
}

function formatMonthlySkuName(product: ProductWithStock) {
  return formatVariantName(product);
}

function orderedUnique(values: string[], preferred: string[]) {
  const unique = Array.from(new Set(values));
  return unique.sort((a, b) => {
    const preferredCompare = preferredIndex(a, preferred) - preferredIndex(b, preferred);
    if (preferredCompare !== 0) return preferredCompare;
    return a.localeCompare(b);
  });
}

function normalizeSize(size?: string | null) {
  const normalized = String(size ?? "").trim().replace(/\s+/g, "").replace(/cm$/i, "");
  return normalized || "-";
}

function preferredIndex(value: string | null | undefined, preferred: string[]) {
  const index = preferred.indexOf(value ?? "");
  return index === -1 ? 999 : index;
}

function compareColor(a: string | null | undefined, b: string | null | undefined) {
  return preferredIndex(a, ["白色", "黑色", "灰色", "米色"]) - preferredIndex(b, ["白色", "黑色", "灰色", "米色"]);
}

function compareSize(a: string | null | undefined, b: string | null | undefined) {
  const parse = (value: string | null | undefined) => Number(normalizeSize(value).split("x")[0]) || 999;
  return parse(a) - parse(b);
}

function colorToken(color: string) {
  if (color.includes("白") || color.includes("화이트")) return "#D9DDD4";
  if (color.includes("黑") || color.includes("블랙")) return "#1F2421";
  if (color.includes("灰") || color.includes("그레이")) return "#7C8580";
  if (color.includes("米") || color.includes("베이지")) return "#BCA77A";
  return "#406A7A";
}

function colorBadgeBackground(color: string) {
  if (color.includes("黑") || color.includes("블랙")) return "#f1f3f0";
  if (color.includes("灰") || color.includes("그레이")) return "#eef2ef";
  if (color.includes("米") || color.includes("베이지")) return "#f7f1df";
  if (color.includes("白") || color.includes("화이트")) return "#f6f7f2";
  return "#edf4f1";
}

function formatPercent(value: number | null) {
  if (value == null) return "-";
  return `${value >= 0 ? "↑ " : "↓ "}${Math.abs(value).toFixed(1)}%`;
}

function exportMonthlySkuCsv(rows: MonthlySkuRow[], metric: MonthlySkuMetric, year: number, fileName: string) {
  const csv = buildMonthlySkuDelimited(rows, metric, year, ",");
  downloadText(`${fileName}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function exportMonthlySkuExcel(rows: MonthlySkuRow[], metric: MonthlySkuMetric, year: number, fileName: string) {
  const table = buildMonthlySkuDelimited(rows, metric, year, "\t");
  downloadText(`${fileName}.xls`, `\uFEFF${table}`, "application/vnd.ms-excel;charset=utf-8");
}

function buildMonthlySkuDelimited(rows: MonthlySkuRow[], metric: MonthlySkuMetric, year: number, delimiter: string) {
  const header = ["Product", ...Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`), "Annual Total"];
  const lines = rows.map((row) => [
    `${formatMonthlySkuName(row.product)} ${row.product.name}`,
    ...row.monthly.map((month) => metric === "stock" ? "" : String(Math.round(month[metric]))),
    String(metric === "stock" ? row.currentStock : metric === "quantity" ? row.annualQuantity : metric === "revenue" ? Math.round(row.annualRevenue) : Math.round(row.annualProfit))
  ]);
  return [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(delimiter)).join("\n");
}

function downloadText(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function monthlyDecisionCopy(language: "zh" | "ko") {
  if (language === "ko") {
    return {
      shortageTitle: "품절 경고",
      shortageSubtitle: "15일 이내 품절 위험",
      slowTitle: "부진 재고",
      slowSubtitle: "재고는 있으나 판매가 약한 상품",
      hotTitle: "인기 상품 순위",
      hotSubtitle: "판매 수량 기준",
      replenishmentTitle: "발주 제안",
      replenishmentSubtitle: "우선 구매가 필요한 상품",
      returnTitle: "반품 문제 분석",
      returnSubtitle: "선택 기간 반품 입고",
      stock: "재고",
      suggested: "제안",
      yearSales: "연간 판매",
      revenue: "매출",
      saleableDays: "판매 가능",
      returnRate: "반품률",
      noSales: "판매 없음",
      days: "일"
    };
  }

  return {
    shortageTitle: "缺货预警",
    shortageSubtitle: "预计15天内存在断货风险",
    slowTitle: "滞销库存",
    slowSubtitle: "有库存但销售偏弱",
    hotTitle: "热销商品排行",
    hotSubtitle: "按销售数量排序",
    replenishmentTitle: "补货建议",
    replenishmentSubtitle: "优先采购清单",
    returnTitle: "退货问题分析",
    returnSubtitle: "当前筛选周期退货入库",
    stock: "库存",
    suggested: "建议",
    yearSales: "年销量",
    revenue: "销售额",
    saleableDays: "可售",
    returnRate: "退货率",
    noSales: "无销量",
    days: "天"
  };
}

function monthlyAnalysisCopy(language: "zh" | "ko") {
  if (language === "ko") {
    return {
      title: "SKU 월간 판매 분석",
      metrics: { quantity: "판매량", revenue: "매출", profit: "이익", stock: "재고" },
      search: "SKU 검색",
      searchPlaceholder: "상품명 / SKU / 색상 / 사이즈",
      color: "색상",
      size: "사이즈",
      allColors: "전체 색상",
      allSizes: "전체 사이즈",
      annualQuantity: "연간 판매량",
      annualRevenue: "연간 매출",
      annualProfit: "연간 이익",
      productName: "상품명",
      month: "월",
      annualTotal: "연간 합계",
      empty: "조건에 맞는 SKU 데이터가 없습니다.",
      colorAnalysis: "색상 분석",
      colorAnalysisSubtitle: "Color Sales Mix",
      sizeAnalysis: "사이즈 분석",
      sizeAnalysisSubtitle: "Size Performance Ranking",
      monthCompare: "월별 비교 분석",
      monthCompareSubtitle: "MoM / YoY Analysis",
      quantity: "판매량",
      momGrowth: "전월 대비",
      yoyGrowth: "전년 대비",
      detailHint: "표에서 SKU를 클릭하면 상세 분석이 표시됩니다.",
      detailTitle: "SKU 상세 분석",
      cumulativeQuantity: "누적 판매량",
      cumulativeRevenue: "누적 매출",
      cumulativeProfit: "누적 이익",
      currentStock: "현재 재고",
      stockValue: "재고 금액",
      safetyStock: "안전 재고",
      suggestedQty: "추천 발주량",
      saleableDays: "예상 판매 가능일",
      recentRecords: "월별 판매 기록",
      close: "닫기"
    };
  }

  return {
    title: "SKU月度销售分析",
    metrics: { quantity: "销量", revenue: "销售额", profit: "利润", stock: "库存" },
    search: "SKU关键词搜索",
    searchPlaceholder: "商品名 / SKU / 颜色 / 尺寸",
    color: "颜色",
    size: "尺寸",
    allColors: "全部颜色",
    allSizes: "全部尺寸",
    annualQuantity: "年度销量",
    annualRevenue: "年度销售额",
    annualProfit: "年度利润",
    productName: "商品名称",
    month: "月",
    annualTotal: "年度合计",
    empty: "暂无符合条件的 SKU 数据",
    colorAnalysis: "颜色分析",
    colorAnalysisSubtitle: "Color Sales Mix",
    sizeAnalysis: "尺寸分析",
    sizeAnalysisSubtitle: "Size Performance Ranking",
    monthCompare: "月份对比分析",
    monthCompareSubtitle: "MoM / YoY Analysis",
    quantity: "销量",
    momGrowth: "环比增长率",
    yoyGrowth: "同比增长率",
    detailHint: "点击上方表格中的任意 SKU，可打开 SKU经营分析详情。",
    detailTitle: "SKU经营分析详情",
    cumulativeQuantity: "累计销量",
    cumulativeRevenue: "累计销售额",
    cumulativeProfit: "累计利润",
    currentStock: "当前库存",
    stockValue: "库存金额",
    safetyStock: "安全库存",
    suggestedQty: "补货建议",
    saleableDays: "预计缺货天数",
    recentRecords: "最近销售记录",
    close: "关闭"
  };
}

function buildLifecycleRows(rows: ReplenishmentRow[], salesRows: SaleDaily[], anchorDate: Date, t: TFunction): LifecycleRow[] {
  const productSales = new Map<string, { recent7: number; recent30: number; previous: number }>();
  const recent7Start = daysAgoKey(anchorDate, 6);
  const recentStart = daysAgoKey(anchorDate, 29);
  const previousStart = daysAgoKey(anchorDate, 89);

  for (const sale of validSales(salesRows)) {
    const current = productSales.get(sale.product_id) ?? { recent7: 0, recent30: 0, previous: 0 };
    if (sale.sale_date >= recent7Start) current.recent7 += sale.quantity;
    if (sale.sale_date >= recentStart) current.recent30 += sale.quantity;
    else if (sale.sale_date >= previousStart) current.previous += sale.quantity;
    productSales.set(sale.product_id, current);
  }

  return rows.map((row) => {
    const stats = productSales.get(row.product.id) ?? { recent7: 0, recent30: 0, previous: 0 };
    const saleableDays = calculateDaysOfStock(row.currentStock, row.dailyAverage);
    const status: SmartReplenishmentRow["status"] = row.currentStock === 0 ? "danger" : saleableDays < 7 ? "danger" : saleableDays < 15 ? "warning" : "normal";

    let lifecycleStatus: LifecycleStatus = "stable";
    let lifecycle = t("dashboard.lifecycle.stable");
    let lifecycleAction = t("dashboard.replenishment.noNeed");

    if (row.currentStock === 0 || saleableDays <= 3) {
      lifecycleStatus = "danger";
      lifecycle = t("dashboard.lifecycle.growing");
      lifecycleAction = t("dashboard.replenishment.immediate");
    } else if (saleableDays <= 7) {
      lifecycleStatus = "warning";
      lifecycle = t("dashboard.lifecycle.warning");
      lifecycleAction = t("dashboard.replenishment.within7Days");
    } else if (row.dailyAverage === 0 || stats.recent30 === 0) {
      lifecycleStatus = "slow";
      lifecycle = t("dashboard.lifecycle.slow");
      lifecycleAction = t("dashboard.replenishment.noNeed");
    } else if (saleableDays > 20 && stats.recent30 <= 2) {
      lifecycleStatus = "slow";
      lifecycle = t("dashboard.lifecycle.slow");
      lifecycleAction = t("dashboard.replenishment.noNeed");
    } else if (stats.previous > 0 && stats.recent30 >= stats.previous * 1.3) {
      lifecycleStatus = "stable";
      lifecycle = t("dashboard.lifecycle.growing");
      lifecycleAction = t("dashboard.replenishment.within7Days");
    }

    return { ...row, saleableDays, sales7: stats.recent7, lifecycle, lifecycleStatus, lifecycleAction, status };
  }).sort((a, b) => {
    const riskRank = { danger: 0, warning: 1, normal: 2 };
    const rankDiff = riskRank[a.status] - riskRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return normalizedSaleableDays(a) - normalizedSaleableDays(b);
  });
}

function buildSalesMetrics(salesRows: SaleDaily[], productMap: Map<string, ProductWithStock>) {
  return validSales(salesRows).reduce((metrics, sale) => {
    const product = productMap.get(sale.product_id);
    if (!product) return metrics;
    const quantity = Number(sale.quantity);
    const salePrice = money(product.sale_price);

    metrics.quantity += quantity;
    metrics.revenue += quantity * salePrice;
    metrics.adSpend += quantity * money(product.ad_cost);
    metrics.profit += totalProfit(product, quantity);
    return metrics;
  }, { quantity: 0, revenue: 0, adSpend: 0, profit: 0 });
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

function isReturnInboundMovement(movement: MovementRow) {
  return classifyInventoryMovement(movement) === "return_resell";
}

function isLossMovement(movement: MovementRow) {
  return classifyInventoryMovement(movement) === "loss";
}

function countTypedMovements(movements: MovementRow[], target: "return_inbound" | "loss") {
  return movements.reduce((sum, movement) => {
    const isReturnInbound = target === "return_inbound" && isReturnInboundMovement(movement);
    const isLoss = target === "loss" && isLossMovement(movement);
    return isReturnInbound || isLoss ? sum + Math.max(0, Number(movement.quantity ?? 0)) : sum;
  }, 0);
}

function hasRecentSale(productId: string, salesRows: SaleDaily[]) {
  return validSales(salesRows).some((sale) => sale.product_id === productId);
}

type DateRange = { start: string; end: string; label: string };

function buildKpiCopy(
  mode: ViewMode,
  range: DateRange,
  language: "zh" | "ko"
) {
  const periodText =
    mode === "today" ? { zh: "今天", ko: "오늘", en: "Today's" } :
      mode === "yesterday" ? { zh: "昨天", ko: "어제", en: "Yesterday" } :
        mode === "7d" ? { zh: "近7天", ko: "최근 7일", en: "Last 7 Days" } :
          mode === "30d" ? { zh: "近30天", ko: "최근 30일", en: "Last 30 Days" } :
            mode === "month" ? { zh: "本月", ko: "이번 달", en: "This Month" } :
              { zh: formatShortRangeTitle(range, "zh"), ko: formatShortRangeTitle(range, "ko"), en: "Custom Range" };

  const zhMetrics = {
    revenue: "销售额",
    orders: "订单数",
    adSpend: "广告费",
    profit: "利润",
    returnInbound: "退货入库在售",
    loss: "损耗 / 不良 / 丢失"
  };
  const koMetrics = {
    revenue: "매출",
    orders: "주문수",
    adSpend: "광고비",
    profit: "이익",
    returnInbound: "반품 입고 판매가능",
    loss: "손상 / 불량 / 분실"
  };
  const metricText = language === "ko" ? koMetrics : zhMetrics;
  const localizedPeriod = periodText[language];

  return {
    revenueLabel: `${localizedPeriod}${metricText.revenue}`,
    ordersLabel: `${localizedPeriod}${metricText.orders}`,
    adSpendLabel: `${localizedPeriod}${metricText.adSpend}`,
    profitLabel: `${localizedPeriod}${metricText.profit}`,
    returnInboundLabel: `${localizedPeriod}${metricText.returnInbound}`,
    lossLabel: `${localizedPeriod}${metricText.loss}`,
    revenueSubtitle: `${periodText.en} Revenue`,
    ordersSubtitle: `${periodText.en} Orders`,
    adSpendSubtitle: `${periodText.en} Ad Spend`,
    profitSubtitle: `${periodText.en} Profit`,
    returnInboundSubtitle: `${periodText.en} Return Inbound Saleable`,
    lossSubtitle: `${periodText.en} Loss / Defect / Missing`
  };
}

function formatShortRangeTitle(
  range: DateRange,
  language: "zh" | "ko"
) {
  const monthDay = (dateKey: string) => {
    const date = parseDateKey(dateKey);
    if (language === "ko") return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  if (range.start === range.end) return monthDay(range.end);
  return `${monthDay(range.start)}-${monthDay(range.end)}`;
}

function buildRange(mode: ViewMode, anchorDate: Date, t: TFunction, customRange?: { start: string; end: string }): DateRange {
  const end = toDateKey(anchorDate);
  if (mode === "7d") return { start: daysAgoKey(anchorDate, 6), end, label: t("period.7d") };
  if (mode === "30d") return { start: daysAgoKey(anchorDate, 29), end, label: t("period.30d") };
  if (mode === "month") return { start: monthStartKey(anchorDate), end, label: t("period.month") };
  if (mode === "yesterday") return { start: end, end, label: t("period.yesterday") };
  if (mode === "custom" && customRange) return { start: customRange.start, end: customRange.end, label: t("period.custom") };
  if (mode === "custom") return { start: end, end, label: t("period.custom") };
  return { start: end, end, label: t("period.today") };
}

function matchRangeMode(range: { start: string; end: string }): ViewMode | null {
  const today = parseDateKey(toDateKey(new Date()));
  const todayKey = toDateKey(today);
  const yesterdayKey = daysAgoKey(today, 1);
  if (range.start === todayKey && range.end === todayKey) return "today";
  if (range.start === yesterdayKey && range.end === yesterdayKey) return "yesterday";
  if (range.start === daysAgoKey(today, 6) && range.end === todayKey) return "7d";
  if (range.start === daysAgoKey(today, 29) && range.end === todayKey) return "30d";
  if (range.start === monthStartKey(today) && range.end === todayKey) return "month";
  return null;
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

function minDateKey(a: string, b: string) {
  return a < b ? a : b;
}

function compare(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function selectChartLabels(data: SalesPoint[]) {
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
