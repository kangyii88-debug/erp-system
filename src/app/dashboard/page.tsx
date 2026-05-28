"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, KpiCard } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { buildReplenishmentRows, type ReplenishmentRow } from "@/lib/replenishment";
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
  const [totalSales, setTotalSales] = useState(0);
  const [returnInboundSaleable, setReturnInboundSaleable] = useState(0);
  const [lossQuantity, setLossQuantity] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const date = since.toISOString().slice(0, 10);
    const [{ data: products }, { data: sales }, { data: purchases }, { data: allSales }, { data: movements }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("created_at", { ascending: false }),
      supabase.from("sales_daily").select("*").gte("sale_date", date),
      supabase.from("purchase_orders").select("*, products(name, sku)"),
      supabase.from("sales_daily").select("quantity"),
      supabase.from("stock_movements").select("type, quantity, memo")
    ]);

    setTotalSales((allSales ?? []).reduce((sum, sale) => sum + Number(sale.quantity ?? 0), 0));
    setReturnInboundSaleable(
      (movements ?? []).reduce((sum, movement) => {
        const memo = String(movement.memo ?? "");
        const isReturnInbound =
          movement.type === "return_inbound" ||
          memo.startsWith("\u9000\u8d27\u5165\u5e93\u5728\u552e") ||
          memo.startsWith("\ubc18\ud488 \uc785\uace0 \ud310\ub9e4\uac00\ub2a5");
        return isReturnInbound ? sum + Number(movement.quantity ?? 0) : sum;
      }, 0)
    );
    setLossQuantity(
      (movements ?? []).reduce((sum, movement) => {
        const memo = String(movement.memo ?? "");
        const isLoss =
          movement.type === "loss" ||
          memo.startsWith("\u635f\u8017\u4e22\u5931") ||
          memo.startsWith("\uc190\uc0c1/\ubd84\uc2e4");
        return isLoss ? sum + Number(movement.quantity ?? 0) : sum;
      }, 0)
    );
    setRows(
      buildReplenishmentRows(
        (products ?? []) as ProductWithStock[],
        (sales ?? []) as SaleDaily[],
        (purchases ?? []) as PurchaseOrder[]
      )
    );
    setSalesRows((sales ?? []) as SaleDaily[]);
    setLoading(false);
  }

  const totalStock = rows.reduce((sum, row) => sum + row.currentStock, 0);
  const skuCount = rows.length;
  const lowStock = rows.filter((row) => row.currentStock <= row.product.low_stock_threshold);
  const sales7d = rows.reduce((sum, row) => sum + row.sales7d, 0);
  const suggested = rows.filter((row) => row.suggestedQty > 0).sort((a, b) => b.suggestedQty - a.suggestedQty);
  const stockByColor = buildStockByColor(rows);
  const salesByDate = buildSalesByDate(salesRows);
  const maxColorStock = Math.max(1, ...stockByColor.map((item) => item.stock));
  const maxDailySales = Math.max(1, ...salesByDate.map((item) => item.quantity));

  return (
    <>
      <PageHeader title={t.dashboard} />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <KpiCard label={t.totalStock} value={totalStock} />
        <KpiCard label="SKU总数" value={skuCount} />
        <KpiCard label={t.totalSales} value={totalSales} />
        <KpiCard label={t.return_inbound} value={returnInboundSaleable} />
        <KpiCard label={t.loss} value={lossQuantity} />
        <KpiCard label={t.lowStock} value={lowStock.length} />
        <KpiCard label={t.replenishItems} value={suggested.length} />
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
          <h2 className="mb-3 font-semibold">{t.replenishItems}</h2>
          {loading ? (
            <div>{t.loading}</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t.sku}</Th>
                  <Th>{t.productName}</Th>
                  <Th>{t.currentStock}</Th>
                  <Th>{t.sales7d}</Th>
                  <Th>{t.suggestedQty}</Th>
                </tr>
              </thead>
              <tbody>
                {suggested.slice(0, 12).map((row) => (
                  <tr key={row.product.id}>
                    <Td>{row.product.sku}</Td>
                    <Td>{row.product.name}</Td>
                    <Td>{row.currentStock}</Td>
                    <Td>{row.sales7d}</Td>
                    <Td>{row.suggestedQty}</Td>
                  </tr>
                ))}
                {!suggested.length ? (
                  <tr>
                    <Td>{t.empty}</Td>
                    <Td />
                    <Td />
                    <Td />
                    <Td />
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
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { date: key, label: `${date.getMonth() + 1}/${date.getDate()}`, quantity: 0 };
  });
  const dayMap = new Map(days.map((day) => [day.date, day]));

  for (const sale of salesRows) {
    const day = dayMap.get(sale.sale_date);
    if (day) day.quantity += Number(sale.quantity ?? 0);
  }

  return days;
}
