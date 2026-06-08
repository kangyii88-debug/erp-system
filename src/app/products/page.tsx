"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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

const DEFAULT_OPEN_CATEGORY = "__DEFAULT_OPEN_CATEGORY__";

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
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(DEFAULT_OPEN_CATEGORY);

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
  const activeCategoryKey =
    openCategoryKey === DEFAULT_OPEN_CATEGORY
      ? productGroups[0]?.key ?? null
      : openCategoryKey && productGroups.some((group) => group.key === openCategoryKey)
        ? openCategoryKey
        : null;
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
          <ProductCategoryGroup
            key={group.key}
            group={group}
            expanded={group.key === activeCategoryKey}
            onToggle={() => setOpenCategoryKey(group.key === activeCategoryKey ? null : group.key)}
            t={t}
            formatCurrency={formatCurrency}
            stockMetrics={stockMetrics}
            onEdit={startEdit}
            onDelete={deleteProduct}
          />
        ))}
      </section>
    </>
  );
}

function ProductCategoryGroup({
  group,
  expanded,
  onToggle,
  t,
  formatCurrency,
  stockMetrics,
  onEdit,
  onDelete
}: {
  group: ReturnType<typeof groupProducts>[number];
  expanded: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useLanguage>["t"];
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  stockMetrics: Map<string, InventoryMetrics>;
  onEdit: (product: ProductWithStock) => void;
  onDelete: (product: ProductWithStock) => void;
}) {
  const skuCount = group.colorGroups.reduce((sum, colorGroup) => sum + colorGroup.products.length, 0);

  return (
    <div className={`rounded-3xl border border-line bg-card/95 shadow-card transition ${expanded ? "p-4" : "p-0"}`}>
      <button
        className={`flex w-full flex-wrap items-center justify-between gap-3 text-left transition hover:bg-[#f7f4ec] ${expanded ? "rounded-2xl border-b border-line pb-4" : "rounded-3xl p-4"}`}
        type="button"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-panel text-brand">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">{t("common.category")}</div>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{group.label}</h2>
          </div>
        </div>
        <div className="rounded bg-white px-3 py-1.5 text-sm font-medium text-ink/60">{skuCount} SKU</div>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-5">
          {group.colorGroups.map((colorGroup) => (
            <ProductColorGroup
              key={`${group.key}-${colorGroup.key}`}
              group={colorGroup}
              t={t}
              formatCurrency={formatCurrency}
              stockMetrics={stockMetrics}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductColorGroup({
  group,
  t,
  formatCurrency,
  stockMetrics,
  onEdit,
  onDelete
}: {
  group: ReturnType<typeof groupProductsByColor>[number];
  t: ReturnType<typeof useLanguage>["t"];
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  stockMetrics: Map<string, InventoryMetrics>;
  onEdit: (product: ProductWithStock) => void;
  onDelete: (product: ProductWithStock) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink/55">{t("common.color")}</div>
          <h3 className="text-lg font-semibold text-ink">{group.label}</h3>
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
                    <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" type="button" onClick={() => onEdit(product)}>
                      {t("common.edit")}
                    </button>
                    <button
                      className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
                      type="button"
                      onClick={() => onDelete(product)}
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
    const key = categoryKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return Array.from(groups.entries()).map(([key, groupProducts]) => ({
    key,
    label: categoryLabel(key, t),
    colorGroups: groupProductsByColor(groupProducts, t)
  }));
}

function groupProductsByColor(products: ProductWithStock[], t: ReturnType<typeof useLanguage>["t"]) {
  const groups = new Map<string, ProductWithStock[]>();

  for (const product of [...products].sort(compareProducts)) {
    const key = colorKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return Array.from(groups.entries()).map(([key, groupProducts]) => ({
    key,
    label: colorLabel(key, groupProducts, t),
    products: groupProducts
  }));
}

function compareProducts(a: ProductWithStock, b: ProductWithStock) {
  const categoryDiff = categoryKey(a).localeCompare(categoryKey(b), undefined, { numeric: true });
  if (categoryDiff !== 0) return categoryDiff;

  const colorDiff = colorRank(a) - colorRank(b);
  if (colorDiff !== 0) return colorDiff;

  const aSize = normalizedSize(a.size) || baseSku(a.sku);
  const bSize = normalizedSize(b.size) || baseSku(b.sku);
  if (aSize !== bSize) return aSize.localeCompare(bSize, undefined, { numeric: true });

  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

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

function categoryKey(product: ProductWithStock) {
  return product.sku.split("-")[0]?.trim().toUpperCase() || "OTHER";
}

function categoryLabel(key: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (key === "4LK") return t("category.4lk");
  if (key === "BLD") return t("category.bld");
  return key === "OTHER" ? "OTHER" : key;
}

function isDuplicateSkuError(message: string) {
  return message.includes("products_user_id_sku_key") || message.toLowerCase().includes("duplicate key");
}
