"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, KpiCard } from "@/components/Card";
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
  const [salesWindowRows, setSalesWindowRows] = useState<SaleDaily[]>([]);
  const [monthlySalesRows, setMonthlySalesRows] = useState<SaleDaily[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [returnInboundSaleable, setReturnInboundSaleable] = useState(0);
  const [lossQuantity, setLossQuantity] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [selectedYear]);

  async function load() {
    setLoading(true);

    const today = new Date();
    const date7d = daysAgoKey(today, 6);
    const date30d = daysAgoKey(today, SALES_ANALYSIS_DAYS - 1);
    const todayKey = toDateKey(today);
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const [
      { data: products },
      { data: sales7dRows },
      { data: sales30dRows },
      { data: salesYearRows },
      { data: purchases },
      { data: allSales },
      { data: movements }
    ] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("created_at", { ascending: false }),
      supabase.from("sales_daily").select("*").gte("sale_date", date7d).lte("sale_date", todayKey),
      supabase.from("sales_daily").select("*").gte("sale_date", date30d).lte("sale_date", todayKey),
      supabase.from("sales_daily").select("*").gte("sale_date", yearStart).lte("sale_date", yearEnd),
      supabase.from("purchase_orders").select("*, products(name, sku)"),
      supabase.from("sales_daily").select("quantity"),
      supabase.from("stock_movements").select("type, quantity, memo")
    ]);

    const sales30 = (sales30dRows ?? []) as SaleDaily[];
    const allSalesRows = (allSales ?? []) as Pick<SaleDaily, "quantity">[];

    setTotalSales(sumPositiveQuantities(allSalesRows));
    setReturnInboundSaleable(sumTypedMovements(movements ?? [], "return_inbound"));
    setLossQuantity(sumTypedMovements(movements ?? [], "loss"));
    setRows(
      buildReplenishmentRows(
        (products ?? []) as ProductWithStock[],
        sales30,
        (purchases ?? []) as PurchaseOrder[]
      )
    );
    setSalesRows((sales7dRows ?? []) as SaleDaily[]);
    setSalesWindowRows(sales30);
    setMonthlySalesRows((salesYearRows ?? []) as SaleDaily[]);
    setLoading(false);
  }

  const totalStock = rows.reduce((sum, row) => sum + row.currentStock, 0);
  const skuCount = rows.length;
  const lowStock = rows.filter((row) => row.currentStock <= row.product.low_stock_threshold);
  const sales7d = sumPositiveQuantities(salesRows);
  const salesSummary = summarizeSales(salesWindowRows);
  const monthlySales = buildMonthlySales(monthlySalesRows, selectedYear);
  const suggested = rows.filter((row) => row.suggestedQty > 0).sort((a, b) => b.suggestedQty - a.suggestedQty);
  const stockByColor = buildStockByColor(rows);
  const salesByDate = buildSalesByDate(salesRows);
  const replenishmentSummary = buildReplenishmentSummary(rows);
  const maxColorStock = Math.max(1, ...stockByColor.map((item) => item.stock));
  const maxDailySales = Math.max(1, ...salesByDate.map((item) => item.quantity));
  const maxMonthlySales = Math.max(1, ...monthlySales.map((item) => item.quantity));

  return (
    <>
      <PageHeader title={t.dashboard} />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label={t.totalStock} value={totalStock} />
        <KpiCard label="SKU总数" value={skuCount} />
        <KpiCard label={t.totalSales} value={totalSales} />
        <KpiCard label="平均日销量" value={salesSummary.averageDailySales} />
        <KpiCard label="销售天数" value={salesSummary.activeSalesDays} />
        <KpiCard label={t.return_inbound} value={returnInboundSaleable} />
        <KpiCard label={t.loss} value={lossQuantity} />
        <KpiCard label={t.lowStock} value={lowStock.length} />
        <KpiCard label={t.replenishItems} value={suggested.length} />
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink/55">补货计算</div>
              <h2 className="text-xl font-semibold text-ink">补货计算看板</h2>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label="30天有效销量" value={salesSummary.totalQuantity} />
            <MiniMetric label="销售天数" value={salesSummary.activeSalesDays} />
            <MiniMetric label="采购周期" value={`${REPLENISHMENT_CYCLE_DAYS}天`} />
            <MiniMetric label="安全库存总量" value={replenishmentSummary.safetyStockTotal} />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">{t.sales7d}</h2>
            </div>
            <div className="rounded bg-panel px-3 py-1 text-sm font-semibold text-ink">{sales7d}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-7">
            {salesByDate.map((item) => (
              <div key={item.date} className="rounded border border-line bg-panel p-3">
                <div className="text-xs font-semibold text-ink/60">{item.label}</div>
                <div className="mt-1 text-xl font-semibold text-ink">{item.quantity}</div>
                <div className="mt-3 flex h-24 items-end rounded bg-white px-2">
                  <div className="w-full rounded-t bg-brand" style={{ height: `${Math.max(6, (item.quantity / maxDailySales) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink/55">订单日期自动统计</div>
              <h2 className="text-xl font-semibold text-ink">每月销量</h2>
            </div>
            <select className="w-32" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
              {buildYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-6 xl:grid-cols-12">
            {monthlySales.map((item) => (
              <div key={item.month} className="rounded border border-line bg-panel p-3">
                <div className="text-xs font-semibold text-ink/60">{item.label}</div>
                <div className="mt-1 text-xl font-semibold text-ink">{item.quantity}</div>
                <div className="mt-3 flex h-24 items-end rounded bg-white px-2">
                  <div className="w-full rounded-t bg-brand" style={{ height: `${Math.max(4, (item.quantity / maxMonthlySales) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink/55">{t.currentStock}</div>
              <h2 className="text-xl font-semibold text-ink">Inventory by color</h2>
            </div>
            <div className="rounded bg-panel px-3 py-1 text-sm font-semibold text-ink">{totalStock}</div>
          </div>

          <div className="space-y-4">
            {stockByColor.map((item) => (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{item.label}</span>
                  <span className="text-ink/70">{item.stock}</span>
                </div>
                <div className="h-4 overflow-hidden rounded bg-panel">
                  <div className="h-full rounded bg-brand" style={{ width: `${Math.max(4, (item.stock / maxColorStock) * 100)}%` }} />
                </div>
              </div>
            ))}
            {!stockByColor.length ? <div className="text-sm text-ink/60">{t.empty}</div> : null}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-3">
            <h2 className="font-semibold">{t.replenishItems}</h2>
            <div className="mt-1 text-sm text-ink/60">
              建议补货 = 平均日销量 × {REPLENISHMENT_CYCLE_DAYS} 天 + 安全库存 + 待处理订单 - 当前库存 - 在途采购
            </div>
          </div>
          {loading ? (
            <div>{t.loading}</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t.sku}</Th>
                  <Th>{t.productName}</Th>
                  <Th>{t.currentStock}</Th>
                  <Th>平均日销量</Th>
                  <Th>安全库存</Th>
                  <Th>在途采购</Th>
                  <Th>待处理订单</Th>
                  <Th>{t.suggestedQty}</Th>
                </tr>
              </thead>
              <tbody>
                {suggested.slice(0, 12).map((row) => (
                  <tr key={row.product.id}>
                    <Td>{row.product.sku}</Td>
                    <Td>{row.product.name}</Td>
                    <Td>{row.currentStock}</Td>
                    <Td>{row.dailyAverage}</Td>
                    <Td>{row.safetyStock}</Td>
                    <Td>{row.openPurchaseQty}</Td>
                    <Td>{row.pendingOrderQty}</Td>
                    <Td>{row.suggestedQty}</Td>
                  </tr>
                ))}
                {!suggested.length ? (
                  <tr>
                    <Td>{t.empty}</Td>
                    <Td>{"-"}</Td>
                    <Td>{"-"}</Td>
                    <Td>{"-"}</Td>
                    <Td>{"-"}</Td>
                    <Td>{"-"}</Td>
                    <Td>{"-"}</Td>
                    <Td>{"-"}</Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">{t.lowStock}</h2>
          <Table>
            <thead>
              <tr>
                <Th>{t.sku}</Th>
                <Th>{t.productName}</Th>
                <Th>{t.currentStock}</Th>
                <Th>{t.lowStockThreshold}</Th>
              </tr>
            </thead>
            <tbody>
              {lowStock.slice(0, 12).map((row) => (
                <tr key={row.product.id}>
                  <Td>{row.product.sku}</Td>
                  <Td>{row.product.name}</Td>
                  <Td>{row.currentStock}</Td>
                  <Td>{row.product.low_stock_threshold}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function sumPositiveQuantities(rows: Array<Pick<SaleDaily, "quantity">>) {
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity ?? 0)), 0);
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-line bg-panel p-3">
      <div className="text-xs font-semibold text-ink/60">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function buildReplenishmentSummary(rows: ReplenishmentRow[]) {
  return {
    safetyStockTotal: rows.reduce((sum, row) => sum + row.safetyStock, 0)
  };
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

function buildStockByColor(rows: ReplenishmentRow[]) {
  const groups = new Map<string, { key: string; label: string; stock: number }>();

  for (const row of rows) {
    const key = colorKey(row.product.sku);
    const current = groups.get(key) ?? { key, label: row.product.color || key, stock: 0 };
    current.stock += row.currentStock;
    groups.set(key, current);
  }

  return ["WH", "BL", "GR", "BE", "OTHER"]
    .map((key) => groups.get(key))
    .filter((item): item is { key: string; label: string; stock: number } => Boolean(item));
}

function colorKey(sku: string) {
  return sku.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase() ?? "OTHER";
}

function buildSalesByDate(salesRows: SaleDaily[]) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = toDateKey(date);
    return { date: key, label: `${date.getMonth() + 1}/${date.getDate()}`, quantity: 0 };
  });
  const dayMap = new Map(days.map((day) => [day.date, day]));

  for (const sale of salesRows) {
    const day = dayMap.get(sale.sale_date);
    if (day) day.quantity += Math.max(0, Number(sale.quantity ?? 0));
  }

  return days;
}

function buildMonthlySales(salesRows: SaleDaily[], year: number) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: `${index + 1}月`,
    quantity: 0
  }));

  for (const sale of salesRows) {
    if (!sale.sale_date || Number(sale.quantity ?? 0) <= 0) continue;
    const [saleYear, saleMonth] = sale.sale_date.split("-").map(Number);
    if (saleYear !== year || !saleMonth) continue;
    months[saleMonth - 1].quantity += Number(sale.quantity);
  }

  return months;
}

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => currentYear - index);
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
