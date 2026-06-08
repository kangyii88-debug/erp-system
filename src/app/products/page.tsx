"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Coins,
  Layers3,
  PackageCheck,
  Pencil,
  Save,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
  const { t, formatCurrency, formatNumber } = useLanguage();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [stockMetrics, setStockMetrics] = useState<Map<string, InventoryMetrics>>(new Map());
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(DEFAULT_OPEN_CATEGORY);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (saving) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    setSaving(true);

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
      setSaving(false);
      return;
    }

    setMessage("");
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
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

    if (editingId === product.id) cancelEdit();
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
  const previewRoi = roiPercent(profitPreviewProduct, previewUnitProfit);
  const previewGrade = profitGrade(previewMargin);
  const kpis = buildProductKpis(products, stockMetrics);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-[#d8d8ca] bg-[#f9f7ef] px-5 py-6 shadow-[0_24px_70px_rgba(20,33,29,0.10)] md:px-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(188,167,122,0.28),transparent_28rem),radial-gradient(circle_at_12%_20%,rgba(23,72,63,0.12),transparent_24rem)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4c28e]/55 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6834]">
              <Sparkles className="h-3.5 w-3.5" />
              Product Management Center
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">商品管理中心</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-base">管理 SKU、成本、利润与库存，用经营视角判断每一个商品是否值得继续投入。</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:w-[680px]">
            <KpiTile icon={Layers3} label="总 SKU" value={formatNumber(kpis.totalSku)} />
            <KpiTile icon={PackageCheck} label="在售 SKU" value={formatNumber(kpis.saleableSku)} />
            <KpiTile icon={TrendingUp} label="平均利润率" value={`${kpis.averageMargin.toFixed(1)}%`} tone={marginTone(kpis.averageMargin)} />
            <KpiTile icon={Boxes} label="总库存" value={formatNumber(kpis.totalStock)} />
            <KpiTile icon={Coins} label="库存价值" value={formatCurrency(kpis.stockValue)} />
            <KpiTile icon={BadgeDollarSign} label="预计总利润" value={formatCurrency(kpis.expectedProfit)} tone={kpis.expectedProfit >= 0 ? "good" : "risk"} />
          </div>
        </div>
      </section>

      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="rounded-[26px] border border-line bg-card/95 p-5 shadow-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{editingId ? "Editing SKU" : "New SKU"}</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">{editingId ? t("product.update") : t("product.add")}</h2>
            </div>
            {editingId ? (
              <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-muted" type="button" onClick={cancelEdit}>
                <X className="h-4 w-4" />
                {t("common.cancel")}
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <FormPanel eyebrow="Identity" title="商品基础信息" description="定义 SKU 的核心识别信息。">
              <Field label={t("common.productName")}>
                <input className="premium-input" placeholder={t("common.productName")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </Field>
              <Field label={t("common.sku")}>
                <input className="premium-input font-mono" placeholder="BLD-CP-991-163-WH" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("common.color")}>
                  <input className="premium-input" placeholder={t("common.color")} value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
                </Field>
                <Field label={t("common.size")}>
                  <input className="premium-input" placeholder="76.2x163" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
                </Field>
              </div>
              <Field label={editingId ? t("common.currentStock") : t("product.initialStock")}>
                <input
                  className="premium-input"
                  placeholder="0"
                  type="number"
                  min="0"
                  value={form.initial_stock}
                  disabled={Boolean(editingId)}
                  onChange={(event) => setForm({ ...form, initial_stock: event.target.value })}
                />
              </Field>
            </FormPanel>

            <FormPanel eyebrow="Revenue" title="销售信息" description="用于判断商品销售效率。">
              <Field label={t("common.salePrice")}>
                <input className="premium-input text-right tabular-nums" placeholder="0" type="number" min="0" value={form.sale_price} onChange={(event) => setForm({ ...form, sale_price: event.target.value })} />
              </Field>
              <Field label={t("common.platform")}>
                <select className="premium-input" value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>
                  <option>Coupang</option>
                  <option>Naver</option>
                  <option>11st</option>
                  <option>Gmarket</option>
                  <option value="Other">{t("common.platformOther")}</option>
                </select>
              </Field>
              <Field label={`${t("common.feeRate")} %`}>
                <input className="premium-input text-right tabular-nums" placeholder="11.6" type="number" min="0" step="0.1" value={form.platform_fee_rate} onChange={(event) => setForm({ ...form, platform_fee_rate: event.target.value })} />
              </Field>
              <Field label={t("product.lowStockThreshold")}>
                <input className="premium-input text-right tabular-nums" placeholder="10" type="number" min="0" value={form.low_stock_threshold} onChange={(event) => setForm({ ...form, low_stock_threshold: event.target.value })} />
              </Field>
            </FormPanel>

            <FormPanel eyebrow="Cost" title="成本信息" description="所有成本都会进入利润模型。">
              <Field label={t("common.purchasePrice")}>
                <input className="premium-input text-right tabular-nums" placeholder="0" type="number" min="0" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} />
              </Field>
              <Field label={t("common.internationalShipping")}>
                <input className="premium-input text-right tabular-nums" placeholder="0" type="number" min="0" value={form.international_shipping_cost} onChange={(event) => setForm({ ...form, international_shipping_cost: event.target.value })} />
              </Field>
              <Field label={t("common.inboundShipping")}>
                <input className="premium-input text-right tabular-nums" placeholder="0" type="number" min="0" value={form.coupang_inbound_shipping_cost} onChange={(event) => setForm({ ...form, coupang_inbound_shipping_cost: event.target.value })} />
              </Field>
              <Field label={t("common.adCost")}>
                <input className="premium-input text-right tabular-nums" placeholder="0" type="number" min="0" value={form.ad_cost} onChange={(event) => setForm({ ...form, ad_cost: event.target.value })} />
              </Field>
            </FormPanel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
            <Field label={t("common.memo")}>
              <textarea className="premium-input min-h-[88px]" placeholder={t("common.memo")} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
            </Field>
            <div className="flex items-end">
              <button className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#17483f] to-[#0f342f] px-6 text-sm font-bold text-white shadow-[0_18px_34px_rgba(23,72,63,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(23,72,63,0.30)] disabled:opacity-70" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : t("common.save")}
              </button>
            </div>
          </div>
          {message ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}
        </section>

        <ProfitPanel
          formatCurrency={formatCurrency}
          unitProfitValue={previewUnitProfit}
          margin={previewMargin}
          roi={previewRoi}
          grade={previewGrade}
          salePrice={Number(form.sale_price || 0)}
        />
      </form>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Portfolio</p>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">SKU 经营组合</h2>
          </div>
          <p className="max-w-xl text-sm text-muted">按系列、颜色和尺寸管理 SKU，快速识别利润状态、库存压力和价格表现。</p>
        </div>
        {productGroups.map((group) => (
          <ProductCategoryGroup
            key={group.key}
            group={group}
            expanded={group.key === activeCategoryKey}
            expandedProductId={expandedProductId}
            onToggle={() => setOpenCategoryKey(group.key === activeCategoryKey ? null : group.key)}
            onExpandProduct={(productId) => setExpandedProductId(expandedProductId === productId ? null : productId)}
            t={t}
            formatCurrency={formatCurrency}
            stockMetrics={stockMetrics}
            onEdit={startEdit}
            onDelete={deleteProduct}
          />
        ))}
      </section>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof Layers3; label: string; value: string; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "watch" ? "text-yellow-800" : tone === "risk" ? "text-red-700" : "text-ink";
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-[0_12px_34px_rgba(20,33,29,0.08)] backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17483f] text-white">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-xs font-semibold text-muted">{label}</div>
      <div className={`mt-1 truncate text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function FormPanel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-[#dcd8c8] bg-gradient-to-b from-white to-[#fbfaf4] p-4 shadow-[0_14px_34px_rgba(23,33,29,0.07)]">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6834]">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ProfitPanel({
  formatCurrency,
  unitProfitValue,
  margin,
  roi,
  grade,
  salePrice
}: {
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  unitProfitValue: number;
  margin: number;
  roi: number;
  grade: ReturnType<typeof profitGrade>;
  salePrice: number;
}) {
  return (
    <aside className="rounded-[28px] border border-[#d8d0b8] bg-[#162f2b] p-5 text-white shadow-[0_26px_70px_rgba(15,52,47,0.26)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d6c28b]">Profit Intelligence</p>
          <h2 className="mt-2 text-2xl font-semibold">实时利润雷达</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${grade.badgeClass}`}>{grade.label}</span>
      </div>
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-4">
        <div className="text-sm text-white/60">单件净利润</div>
        <div className={`mt-2 text-4xl font-semibold tabular-nums ${unitProfitValue >= 0 ? "text-white" : "text-red-200"}`}>{formatCurrency(unitProfitValue)}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${grade.barClass}`} style={{ width: `${Math.max(8, Math.min(100, margin))}%` }} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ProfitMetric label="利润率" value={`${margin.toFixed(1)}%`} />
        <ProfitMetric label="ROI" value={`${roi.toFixed(1)}%`} />
        <ProfitMetric label="售价" value={formatCurrency(salePrice)} />
        <ProfitMetric label="净利润" value={formatCurrency(unitProfitValue)} />
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-white/70">
        {grade.hint}
      </div>
    </aside>
  );
}

function ProfitMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function ProductCategoryGroup({
  group,
  expanded,
  expandedProductId,
  onToggle,
  onExpandProduct,
  t,
  formatCurrency,
  stockMetrics,
  onEdit,
  onDelete
}: {
  group: ReturnType<typeof groupProducts>[number];
  expanded: boolean;
  expandedProductId: string | null;
  onToggle: () => void;
  onExpandProduct: (productId: string) => void;
  t: ReturnType<typeof useLanguage>["t"];
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  stockMetrics: Map<string, InventoryMetrics>;
  onEdit: (product: ProductWithStock) => void;
  onDelete: (product: ProductWithStock) => void;
}) {
  const skuCount = group.colorGroups.reduce((sum, colorGroup) => sum + colorGroup.products.length, 0);
  const totalStock = group.colorGroups.reduce(
    (sum, colorGroup) => sum + colorGroup.products.reduce((groupSum, product) => groupSum + getComputedCurrentStock(product, stockMetrics), 0),
    0
  );

  return (
    <div className={`rounded-[28px] border border-line bg-card/95 shadow-card transition ${expanded ? "p-4" : "p-0"}`}>
      <button
        className={`flex w-full flex-wrap items-center justify-between gap-3 text-left transition hover:bg-[#f7f4ec] ${expanded ? "rounded-2xl border-b border-line pb-4" : "rounded-[28px] p-4"}`}
        type="button"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17483f] text-white">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{t("common.category")}</div>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{group.label}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="erp-chip px-3 py-1.5 text-xs font-semibold">{skuCount} SKU</span>
          <span className="erp-chip px-3 py-1.5 text-xs font-semibold">库存 {totalStock.toLocaleString()}</span>
        </div>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-5">
          {group.colorGroups.map((colorGroup) => (
            <ProductColorGroup
              key={`${group.key}-${colorGroup.key}`}
              group={colorGroup}
              expandedProductId={expandedProductId}
              onExpandProduct={onExpandProduct}
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
  expandedProductId,
  onExpandProduct,
  t,
  formatCurrency,
  stockMetrics,
  onEdit,
  onDelete
}: {
  group: ReturnType<typeof groupProductsByColor>[number];
  expandedProductId: string | null;
  onExpandProduct: (productId: string) => void;
  t: ReturnType<typeof useLanguage>["t"];
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  stockMetrics: Map<string, InventoryMetrics>;
  onEdit: (product: ProductWithStock) => void;
  onDelete: (product: ProductWithStock) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${colorDotClass(group.key)}`} />
          <h3 className="text-lg font-semibold text-ink">{group.label}</h3>
        </div>
        <div className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted">{group.products.length} SKU</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {group.products.map((product) => (
          <ProductSkuCard
            key={product.id}
            product={product}
            expanded={expandedProductId === product.id}
            onExpand={() => onExpandProduct(product.id)}
            t={t}
            formatCurrency={formatCurrency}
            stock={getComputedCurrentStock(product, stockMetrics)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function ProductSkuCard({
  product,
  expanded,
  onExpand,
  t,
  formatCurrency,
  stock,
  onEdit,
  onDelete
}: {
  product: ProductWithStock;
  expanded: boolean;
  onExpand: () => void;
  t: ReturnType<typeof useLanguage>["t"];
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  stock: number;
  onEdit: (product: ProductWithStock) => void;
  onDelete: (product: ProductWithStock) => void;
}) {
  const margin = profitMargin(product, unitProfit(product));
  const status = skuStatus(stock, margin);

  return (
    <article
      className="group cursor-pointer rounded-[22px] border border-[#d9d8cc] bg-gradient-to-b from-white to-[#fbfaf3] p-4 shadow-[0_10px_28px_rgba(23,33,29,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#17483f]/35 hover:shadow-[0_22px_48px_rgba(23,33,29,0.12)]"
      onClick={onExpand}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <TagPill>{product.color || colorName(colorKey(product), t)}</TagPill>
            <TagPill>{normalizedSize(product.size)}</TagPill>
          </div>
          <h4 className="mt-3 line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-ink">{product.name}</h4>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-white/70 px-3 py-2 font-mono text-xs font-semibold text-muted">{product.sku}</div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <CardMetric label={t("common.salePrice")} value={formatCurrency(product.sale_price)} />
        <CardMetric label={t("common.purchasePrice")} value={formatCurrency(product.purchase_price)} />
        <CardMetric label={t("common.currentStock")} value={stock.toLocaleString()} />
        <CardMetric label={t("common.profitMargin")} value={`${margin.toFixed(1)}%`} tone={marginTone(margin)} />
      </div>

      {expanded ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted">
            <DetailLine label={t("common.internationalShipping")} value={formatCurrency(product.international_shipping_cost ?? 0)} />
            <DetailLine label={t("common.inboundShipping")} value={formatCurrency(product.coupang_inbound_shipping_cost ?? 0)} />
            <DetailLine label={t("common.adCost")} value={formatCurrency(product.ad_cost ?? 0)} />
            <DetailLine label={t("common.unitProfit")} value={formatCurrency(unitProfit(product))} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:text-brand"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(product);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          {t("common.edit")}
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(product);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </button>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function TagPill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line bg-white/80 px-2.5 py-1 text-xs font-semibold text-muted">{children}</span>;
}

function CardMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "watch" ? "text-yellow-800" : tone === "risk" ? "text-red-700" : "text-ink";
  return (
    <div className="rounded-2xl bg-[#f4f2e9] px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div>{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-ink">{value}</div>
    </div>
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

function buildProductKpis(products: ProductWithStock[], stockMetrics: Map<string, InventoryMetrics>) {
  const totalStock = products.reduce((sum, product) => sum + getComputedCurrentStock(product, stockMetrics), 0);
  const saleableSku = products.filter((product) => getComputedCurrentStock(product, stockMetrics) > 0).length;
  const stockValue = products.reduce((sum, product) => sum + getComputedCurrentStock(product, stockMetrics) * money(product.purchase_price), 0);
  const expectedProfit = products.reduce((sum, product) => sum + getComputedCurrentStock(product, stockMetrics) * unitProfit(product), 0);
  const averageMargin = products.length ? products.reduce((sum, product) => sum + profitMargin(product, unitProfit(product)), 0) / products.length : 0;

  return {
    totalSku: products.length,
    saleableSku,
    averageMargin,
    totalStock,
    stockValue,
    expectedProfit
  };
}

function profitGrade(margin: number) {
  if (margin >= 35) {
    return {
      label: "优秀",
      hint: "利润结构健康，可以作为重点推广 SKU 的候选。",
      badgeClass: "bg-emerald-100 text-emerald-800",
      barClass: "bg-emerald-400"
    };
  }
  if (margin >= 20) {
    return {
      label: "正常",
      hint: "利润处于可接受区间，建议继续观察广告成本和库存周转。",
      badgeClass: "bg-yellow-100 text-yellow-900",
      barClass: "bg-yellow-400"
    };
  }
  return {
    label: "风险",
    hint: "利润偏低，建议复核售价、采购成本、物流和广告费用。",
    badgeClass: "bg-red-100 text-red-800",
    barClass: "bg-red-400"
  };
}

function skuStatus(stock: number, margin: number) {
  if (margin < 20 || stock < 0) return { label: "风险", className: "bg-red-50 text-red-700 border border-red-200" };
  if (stock <= 10 || margin < 35) return { label: "注意", className: "bg-yellow-50 text-yellow-800 border border-yellow-200" };
  return { label: "正常", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
}

function marginTone(margin: number): "good" | "watch" | "risk" {
  if (margin >= 35) return "good";
  if (margin >= 20) return "watch";
  return "risk";
}

function roiPercent(product: Parameters<typeof unitProfit>[0], profit: number) {
  const baseCost = money(product.purchase_price) + money(product.international_shipping_cost) + money(product.coupang_inbound_shipping_cost) + money(product.ad_cost);
  return baseCost > 0 ? (profit / baseCost) * 100 : 0;
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

function colorDotClass(key: string) {
  if (key === "WH") return "bg-stone-200 ring-1 ring-stone-300";
  if (key === "BL") return "bg-zinc-900";
  if (key === "GR") return "bg-slate-400";
  if (key === "BE") return "bg-[#c8b98d]";
  return "bg-slate-300";
}

function categoryKey(product: ProductWithStock) {
  return product.sku.split("-")[0]?.trim().toUpperCase() || "OTHER";
}

function categoryLabel(key: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (key === "4LK") return t("category.4lk");
  if (key === "BLD") return t("category.bld");
  return key === "OTHER" ? "OTHER" : key;
}

function money(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function isDuplicateSkuError(message: string) {
  return message.includes("products_user_id_sku_key") || message.toLowerCase().includes("duplicate key");
}
