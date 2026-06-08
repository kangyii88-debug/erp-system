"use client";

import { ChangeEvent, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { activeProducts } from "@/lib/products";
import { buildInventoryMetricsByProduct, getComputedCurrentStock } from "@/lib/stock";
import { supabase } from "@/lib/supabase";
import type { ProductWithStock } from "@/lib/types";

export default function ImportExportPage() {
  return (
    <AppShell>
      <ImportExportContent />
    </AppShell>
  );
}

function ImportExportContent() {
  const { t } = useLanguage();
  const [message, setMessage] = useState("");

  async function exportProducts() {
    const { data } = await supabase.from("products").select("*").order("sku");
    downloadCsv(
      "products.csv",
      (data ?? []).map((product) => ({
        name: product.name,
        sku: product.sku,
        color: product.color,
        size: product.size,
        purchase_price: product.purchase_price,
        platform_fee_rate: product.platform_fee_rate,
        international_shipping_cost: product.international_shipping_cost,
        coupang_inbound_shipping_cost: product.coupang_inbound_shipping_cost,
        ad_cost: product.ad_cost,
        sale_price: product.sale_price,
        platform: product.platform,
        low_stock_threshold: product.low_stock_threshold,
        memo: product.memo
      }))
    );
  }

  async function exportInventory() {
    const [{ data: productRows }, { data: movementRows }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      supabase.from("stock_movements").select("product_id, type, quantity, happened_at, memo")
    ]);
    const products = activeProducts((productRows ?? []) as ProductWithStock[]);
    const productIds = new Set(products.map((product) => product.id));
    const metricsByProduct = buildInventoryMetricsByProduct((movementRows ?? []).filter((movement) => productIds.has(movement.product_id)));

    downloadCsv(
      "inventory.csv",
      products.map((product) => ({
        sku: product.sku,
        name: product.name,
        color: product.color,
        size: product.size,
        current_stock: getComputedCurrentStock(product, metricsByProduct),
        low_stock_threshold: product.low_stock_threshold,
        platform: product.platform
      }))
    );
  }

  async function importProducts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const payload = rows
      .filter((row) => row.name && row.sku)
      .map((row) => ({
        user_id: auth.user!.id,
        name: String(row.name),
        sku: String(row.sku),
        color: row.color ? String(row.color) : null,
        size: row.size ? String(row.size) : null,
        purchase_price: Number(row.purchase_price || 0),
        platform_fee_rate: Number(row.platform_fee_rate || 11.6),
        international_shipping_cost: Number(row.international_shipping_cost || 0),
        coupang_inbound_shipping_cost: Number(row.coupang_inbound_shipping_cost || 0),
        ad_cost: Number(row.ad_cost || 0),
        sale_price: Number(row.sale_price || 0),
        platform: String(row.platform || "Coupang"),
        low_stock_threshold: Number(row.low_stock_threshold || 10),
        memo: row.memo ? String(row.memo) : null
      }));

    const { error } = await supabase.from("products").upsert(payload, { onConflict: "user_id,sku" });
    setMessage(error ? error.message : t("import.imported", { count: payload.length }));
  }

  return (
    <>
      <PageHeader title={t("import.title")} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-2 font-semibold">{t("import.importProducts")}</h2>
          <input type="file" accept=".csv,text/csv" onChange={importProducts} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">{t("import.exportProducts")}</h2>
          <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={exportProducts}>
            {t("import.exportProducts")}
          </button>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">{t("import.exportInventory")}</h2>
          <button className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={exportInventory}>
            {t("import.exportInventory")}
          </button>
        </Card>
      </div>
      {message ? <div className="mt-4 rounded border border-line bg-white px-4 py-3 text-sm">{message}</div> : null}
      <Card className="mt-4">
        <div className="text-sm text-ink/70">
          {t("import.columnsHelp")}
        </div>
      </Card>
    </>
  );
}
