"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { profitMargin, unitProfit } from "@/lib/profit";
import { buildInventoryMetricsByProduct, getComputedCurrentStock, type InventoryMetrics, type InventoryMovementLike } from "@/lib/stock";
import { fetchAllStockMovements } from "@/lib/stock-movements";
import { activeProducts, isDeletedProduct, markProductDeletedMemo, stripDeletedProductMemo } from "@/lib/products";
import type { ProductWithStock } from "@/lib/types";

const emptyForm = {
  name: "",
  sku: "",
  color: "",
  size: "",
  purchase_price: "0",
  sale_price: "0",
  platform_fee_rate: "11.6",
  platform: "Coupang",
  international_shipping_cost: "0",
  coupang_inbound_shipping_cost: "0",
  ad_cost: "0",
  initial_stock: "0",
  low_stock_threshold: "10",
  memo: ""
};

export default function ProductsPage() {
  return (
    <AppShell>
      <ProductsContent />
    </AppShell>
  );
}

function ProductsContent() {
  const { t, formatCurrency } = useLanguage();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [stockMetrics, setStockMetrics] = useState<Map<string, InventoryMetrics>>(new Map());
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const [{ data: productRows }, { data: movementRows }] = await Promise.all([
      supabase
        .from("products")
        .select("*, inventory_balances(current_stock)")
        .order("created_at", { ascending: false }),
      fetchAllStockMovements<InventoryMovementLike>("product_id, type, quantity, happened_at, memo")
    ]);
    const visibleProducts = activeProducts((productRows ?? []) as ProductWithStock[]);
    const visibleProductIds = new Set(visibleProducts.map((product) => product.id));
    const visibleMovements = (movementRows ?? []).filter((movement) => movement.product_id && visibleProductIds.has(movement.product_id));

    setProducts(visibleProducts);
    setStockMetrics(buildInventoryMetricsByProduct(visibleMovements));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      color: form.color || null,
      size: form.size || null,
      purchase_price: Number(form.purchase_price || 0),
      sale_price: Number(form.sale_price || 0),
      platform_fee_rate: Number(form.platform_fee_rate || 11.6),
      international_shipping_cost: Number(form.international_shipping_cost || 0),
      coupang_inbound_shipping_cost: Number(form.coupang_inbound_shipping_cost || 0),
      ad_cost: Number(form.ad_cost || 0),
      platform: form.platform,
      low_stock_threshold: Number(form.low_stock_threshold || 10),
      memo: form.memo || null
    };

    let productId = editingId;
    let errorMessage = "";

    if (editingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      errorMessage = error?.message ?? "";
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({ user_id: auth.user.id, ...payload })
        .select("id")
        .single();
      errorMessage = error?.message ?? "";
      productId = data?.id ?? null;

      if (isDuplicateSkuError(errorMessage)) {
        const { data: existingProduct, error: existingError } = await supabase
          .from("products")
          .select("id, memo")
          .eq("user_id", auth.user.id)
          .eq("sku", payload.sku)
          .maybeSingle();

        if (!existingError && existingProduct && isDeletedProduct(existingProduct)) {
          const restoredPayload = {
            ...payload,
            memo: (payload.memo ?? stripDeletedProductMemo(existingProduct.memo)) || null
          };
          const { error: restoreError } = await supabase.from("products").update(restoredPayload).eq("id", existingProduct.id);
          errorMessage = restoreError?.message ?? "";
          productId = restoreError ? null : existingProduct.id;
        } else {
          errorMessage = t("product.duplicateSku");
        }
      }
    }

    const initialStock = Math.max(0, Number(form.initial_stock || 0));
    if (!errorMessage && !editingId && productId && initialStock > 0) {
      const { error } = await supabase.from("stock_movements").insert({
        user_id: auth.user.id,
        product_id: productId,
        type: "purchase",
        quantity: initialStock,
        memo: t("product.initialStock")
      });
      errorMessage = error?.message ?? "";
    }

    if (errorMessage) {
      setMessage(errorMessage);
      return;
    }

    setMessage("");
    setForm(emptyForm);
    setEditingId(null);
    await loadProducts();
  }

  function startEdit(product: ProductWithStock) {
    setEditingId(product.id);
    setMessage("");
    setForm({
      name: product.name,
      sku: product.sku,
      color: product.color ?? "",
      size: product.size ?? "",
      purchase_price: String(product.purchase_price ?? 0),
      sale_price: String(product.sale_price ?? 0),
      platform_fee_rate: String(product.platform_fee_rate ?? 11.6),
      platform: product.platform,
      international_shipping_cost: String(product.international_shipping_cost ?? 0),
      coupang_inbound_shipping_cost: String(product.coupang_inbound_shipping_cost ?? 0),
      ad_cost: String(product.ad_cost ?? 0),
      initial_stock: String(getComputedCurrentStock(product, stockMetrics)),
      low_stock_threshold: String(product.low_stock_threshold ?? 10),
      memo: stripDeletedProductMemo(product.memo)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(product: ProductWithStock) {
    if (!window.confirm(t("product.deleteConfirm"))) return;

    const { error } = await supabase
      .from("products")
      .update({ memo: markProductDeletedMemo(product.memo) })
      .eq("id", product.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === product.id) {
      cancelEdit();
    }

    setMessage("");
    await loadProducts();
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  const productGroups = groupProducts(products, t);
  const profitPreviewProduct = {
    purchase_price: Number(form.purchase_price || 0),
    sale_price: Number(form.sale_price || 0),
    platform_fee_rate: Number(form.platform_fee_rate || 11.6),
    international_shipping_cost: Number(form.international_shipping_cost || 0),
    coupang_inbound_shipping_cost: Number(form.coupang_inbound_shipping_cost || 0),
    ad_cost: Number(form.ad_cost || 0)
  };
  const previewUnitProfit = unitProfit(profitPreviewProduct);
  const previewMargin = profitMargin(profitPreviewProduct, previewUnitProfit);

  return (
    <>
      <PageHeader title={t("product.title")} />
      <Card className="mb-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editingId ? t("product.update") : t("product.add")}</h2>
          {editingId ? (
            <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" type="button" onClick={cancelEdit}>
              {t("common.cancel")}
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label={t("common.productName")}>
              <input placeholder={t("common.productName")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label={t("common.sku")}>
              <input placeholder={t("common.sku")} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required />
            </Field>
            <Field label={t("common.color")}>
              <input placeholder={t("common.color")} value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            </Field>
            <Field label={t("common.size")}>
              <input placeholder={t("common.size")} value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Field label={t("common.purchasePrice")}>
              <input placeholder="0" type="number" min="0" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} />
            </Field>
            <Field label={t("common.salePrice")}>
              <input placeholder="0" type="number" min="0" value={form.sale_price} onChange={(event) => setForm({ ...form, sale_price: event.target.value })} />
            </Field>
            <Field label={`${t("common.feeRate")} %`}>
              <input placeholder="11.6" type="number" min="0" step="0.1" value={form.platform_fee_rate} onChange={(event) => setForm({ ...form, platform_fee_rate: event.target.value })} />
            </Field>
            <Field label={t("common.platform")}>
              <select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>
                <option>Coupang</option>
                <option>Naver</option>
                <option>11st</option>
                <option>Gmarket</option>
                <option value="Other">{t("common.platformOther")}</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Field label={t("common.internationalShipping")}>
              <input placeholder="0" type="number" min="0" value={form.international_shipping_cost} onChange={(event) => setForm({ ...form, international_shipping_cost: event.target.value })} />
            </Field>
            <Field label={t("common.inboundShipping")}>
              <input placeholder="0" type="number" min="0" value={form.coupang_inbound_shipping_cost} onChange={(event) => setForm({ ...form, coupang_inbound_shipping_cost: event.target.value })} />
            </Field>
            <Field label={t("common.adCost")}>
              <input placeholder="0" type="number" min="0" value={form.ad_cost} onChange={(event) => setForm({ ...form, ad_cost: event.target.value })} />
            </Field>
            <Field label={editingId ? t("common.currentStock") : t("product.initialStock")}>
              <input
                placeholder="0"
                type="number"
                min="0"
                value={form.initial_stock}
                disabled={Boolean(editingId)}
                onChange={(event) => setForm({ ...form, initial_stock: event.target.value })}
              />
            </Field>
          </div>

          <div className="rounded border border-line bg-panel p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-ink">{t("product.costTitle")}</h3>
                <p className="text-xs text-ink/55">{t("product.costDescription")}</p>
              </div>
              <div className="rounded bg-white px-3 py-2 text-sm font-semibold text-ink">
                {t("common.unitProfit")} {formatCurrency(previewUnitProfit)} · {t("common.profitMargin")} {previewMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          <Field label={t("common.memo")}>
            <textarea placeholder={t("common.memo")} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
          </Field>

          <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">{t("common.save")}</button>
        </form>
        {message ? <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
      </Card>

      <section className="space-y-5">
        {productGroups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink/55">{t("common.color")}</div>
                <h2 className="text-xl font-semibold text-ink">{group.label}</h2>
              </div>
              <div className="rounded bg-white px-3 py-1 text-sm font-medium text-ink/60">{group.products.length} SKU</div>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>{t("common.sku")}</Th>
                  <Th>{t("common.productName")}</Th>
                  <Th>{t("common.size")}</Th>
                  <Th>{t("common.purchasePrice")}</Th>
                  <Th>{t("common.feeRate")}</Th>
                  <Th>{t("common.internationalShipping")}</Th>
                  <Th>{t("common.inboundShipping")}</Th>
                  <Th>{t("common.adCost")}</Th>
                  <Th>{t("common.salePrice")}</Th>
                  <Th>{t("common.unitProfit")}</Th>
                  <Th>{t("common.profitMargin")}</Th>
                  <Th>{t("common.currentStock")}</Th>
                  <Th>{t("common.platform")}</Th>
                  <Th>{t("common.memo")}</Th>
                  <Th>{t("common.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {group.products.map((product) => {
                  const singleProfit = unitProfit(product);
                  return (
                    <tr key={product.id}>
                      <Td>{product.sku}</Td>
                      <Td>{product.name}</Td>
                      <Td>{normalizedSize(product.size)}</Td>
                      <Td>{formatCurrency(product.purchase_price)}</Td>
                      <Td>{Number(product.platform_fee_rate ?? 11.6).toFixed(1)}%</Td>
                      <Td>{formatCurrency(product.international_shipping_cost ?? 0)}</Td>
                      <Td>{formatCurrency(product.coupang_inbound_shipping_cost ?? 0)}</Td>
                      <Td>{formatCurrency(product.ad_cost ?? 0)}</Td>
                      <Td>{formatCurrency(product.sale_price)}</Td>
                      <Td>{formatCurrency(singleProfit)}</Td>
                      <Td>{profitMargin(product, singleProfit).toFixed(1)}%</Td>
                      <Td>
                        <span className="text-base font-semibold text-ink">{getComputedCurrentStock(product, stockMetrics)}</span>
                      </Td>
                      <Td>{product.platform}</Td>
                      <Td>{stripDeletedProductMemo(product.memo)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" type="button" onClick={() => startEdit(product)}>
                            {t("common.edit")}
                          </button>
                          <button
                            className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
                            type="button"
                            onClick={() => deleteProduct(product)}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        ))}
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-ink/65">
      <span>{label}</span>
      {children}
    </label>
  );
}

function groupProducts(products: ProductWithStock[], t: ReturnType<typeof useLanguage>["t"]) {
  const sortedProducts = [...products].sort(compareProducts);
  const groups = new Map<string, ProductWithStock[]>();

  for (const product of sortedProducts) {
    const key = colorKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return colorOrder
    .map((key) => ({ key, label: colorLabel(key, groups.get(key) ?? [], t), products: groups.get(key) ?? [] }))
    .filter((group) => group.products.length > 0);
}

function compareProducts(a: ProductWithStock, b: ProductWithStock) {
  const colorDiff = colorRank(a) - colorRank(b);
  if (colorDiff !== 0) return colorDiff;

  const aSize = normalizedSize(a.size) || baseSku(a.sku);
  const bSize = normalizedSize(b.size) || baseSku(b.sku);
  if (aSize !== bSize) return aSize.localeCompare(bSize, undefined, { numeric: true });

  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

const colorOrder = ["WH", "BL", "GR", "BE", "OTHER"];

function baseSku(sku: string) {
  return sku.replace(/-(WH|BL|GR|BE)$/i, "");
}

function normalizedSize(size: string | null) {
  return (size ?? "").replace(/\s+/g, "").trim();
}

function skuSuffix(product: ProductWithStock) {
  return product.sku.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase() ?? "";
}

function colorKey(product: ProductWithStock) {
  return skuSuffix(product) || "OTHER";
}

function colorRank(product: ProductWithStock) {
  const suffix = skuSuffix(product);
  if (suffix === "WH") return 0;
  if (suffix === "BL") return 1;
  if (suffix === "GR") return 2;
  if (suffix === "BE") return 3;
  return 9;
}

function colorLabel(key: string, products: ProductWithStock[], t: ReturnType<typeof useLanguage>["t"]) {
  return products[0]?.color || colorName(key, t);
}

function colorName(key: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (key === "WH") return t("color.white");
  if (key === "BL") return t("color.black");
  if (key === "GR") return t("color.gray");
  if (key === "BE") return t("color.beige");
  return t("color.other");
}

function isDuplicateSkuError(message: string) {
  return message.includes("products_user_id_sku_key") || message.toLowerCase().includes("duplicate key");
}
