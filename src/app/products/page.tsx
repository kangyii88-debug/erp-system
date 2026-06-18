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

const pageCopy = {
  zh: {
    heroEyebrow: "商品管理中心",
    heroTitle: "商品管理中心",
    heroSubtitle: "管理 SKU、成本、利润与库存，用经营视角判断每一个商品是否值得继续投入。",
    totalSku: "总 SKU",
    saleableSku: "在售 SKU",
    averageMargin: "平均利润率",
    totalStock: "总库存",
    stockValue: "库存价值",
    expectedProfit: "预计总利润",
    editingSku: "编辑 SKU",
    newSku: "新增 SKU",
    identityEyebrow: "基础信息",
    identityTitle: "商品基础信息",
    identityDescription: "定义 SKU 的核心识别信息。",
    revenueEyebrow: "销售信息",
    revenueTitle: "销售信息",
    revenueDescription: "用于判断商品销售效率。",
    costEyebrow: "成本信息",
    costTitle: "成本信息",
    costDescription: "所有成本都会进入利润模型。",
    saving: "保存中...",
    profitEyebrow: "利润分析",
    profitTitle: "实时利润雷达",
    unitNetProfit: "单件净利润",
    margin: "利润率",
    roi: "ROI",
    salePrice: "售价",
    netProfit: "净利润",
    excellent: "优秀",
    normal: "正常",
    risk: "风险",
    watch: "注意",
    excellentHint: "利润结构健康，可以作为重点推广 SKU 的候选。",
    normalHint: "利润处于可接受区间，建议继续观察广告成本和库存周转。",
    riskHint: "利润偏低，建议复核售价、采购成本、物流和广告费用。",
    portfolioEyebrow: "经营组合",
    portfolioTitle: "SKU 经营组合",
    portfolioDescription: "按系列、颜色和尺寸管理 SKU，快速识别利润状态、库存压力和价格表现。",
    stock: "库存"
  },
  ko: {
    heroEyebrow: "상품 관리 센터",
    heroTitle: "상품 관리 센터",
    heroSubtitle: "SKU, 원가, 이익과 재고를 관리하고 운영 관점에서 각 상품의 투자 가치를 판단합니다.",
    totalSku: "총 SKU",
    saleableSku: "판매 중 SKU",
    averageMargin: "평균 이익률",
    totalStock: "총 재고",
    stockValue: "재고 가치",
    expectedProfit: "예상 총이익",
    editingSku: "SKU 수정",
    newSku: "SKU 추가",
    identityEyebrow: "기본 정보",
    identityTitle: "상품 기본 정보",
    identityDescription: "SKU의 핵심 식별 정보를 정의합니다.",
    revenueEyebrow: "판매 정보",
    revenueTitle: "판매 정보",
    revenueDescription: "상품의 판매 효율을 판단하는 데 사용됩니다.",
    costEyebrow: "원가 정보",
    costTitle: "원가 정보",
    costDescription: "모든 원가는 이익 모델에 반영됩니다.",
    saving: "저장 중...",
    profitEyebrow: "이익 분석",
    profitTitle: "실시간 이익 레이더",
    unitNetProfit: "개당 순이익",
    margin: "이익률",
    roi: "ROI",
    salePrice: "판매가",
    netProfit: "순이익",
    excellent: "우수",
    normal: "정상",
    risk: "위험",
    watch: "주의",
    excellentHint: "이익 구조가 건강해 주요 프로모션 SKU 후보로 볼 수 있습니다.",
    normalHint: "이익이 허용 범위에 있으며 광고비와 재고 회전을 계속 관찰하는 것이 좋습니다.",
    riskHint: "이익이 낮습니다. 판매가, 매입 원가, 물류비와 광고비를 다시 확인하세요.",
    portfolioEyebrow: "운영 포트폴리오",
    portfolioTitle: "SKU 운영 포트폴리오",
    portfolioDescription: "시리즈, 색상, 사이즈별로 SKU를 관리하고 이익 상태, 재고 부담과 가격 성과를 빠르게 파악합니다.",
    stock: "재고"
  }
} as const;

type ProductPageText = (typeof pageCopy)[keyof typeof pageCopy];

export default function ProductsPage() {
  return (
    <AppShell>
      <ProductsContent />
    </AppShell>
  );
}

function ProductsContent() {
  const { language, t, formatCurrency, formatNumber } = useLanguage();
  const text = pageCopy[language];
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
  const previewGrade = profitGrade(previewMargin, text);
  const kpis = buildProductKpis(products, stockMetrics);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-[#ffffff] px-5 py-6 shadow-[0_24px_70px_rgba(17,24,39,0.055)] md:px-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(37,99,235,0.06),transparent_28rem),radial-gradient(circle_at_12%_20%,rgba(17,24,39,0.04),transparent_24rem)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4c28e]/55 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6834]">
              <Sparkles className="h-3.5 w-3.5" />
              {text.heroEyebrow}
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">{text.heroTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-base">{text.heroSubtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:w-[680px]">
            <KpiTile icon={Layers3} label={text.totalSku} value={formatNumber(kpis.totalSku)} />
            <KpiTile icon={PackageCheck} label={text.saleableSku} value={formatNumber(kpis.saleableSku)} />
            <KpiTile icon={TrendingUp} label={text.averageMargin} value={`${kpis.averageMargin.toFixed(1)}%`} tone={marginTone(kpis.averageMargin)} />
            <KpiTile icon={Boxes} label={text.totalStock} value={formatNumber(kpis.totalStock)} />
            <KpiTile icon={Coins} label={text.stockValue} value={formatCurrency(kpis.stockValue)} />
            <KpiTile icon={BadgeDollarSign} label={text.expectedProfit} value={formatCurrency(kpis.expectedProfit)} tone={kpis.expectedProfit >= 0 ? "good" : "risk"} />
          </div>
        </div>
      </section>

      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="rounded-[26px] border border-line bg-card/95 p-5 shadow-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{editingId ? text.editingSku : text.newSku}</p>
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
            <FormPanel eyebrow={text.identityEyebrow} title={text.identityTitle} description={text.identityDescription}>
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

            <FormPanel eyebrow={text.revenueEyebrow} title={text.revenueTitle} description={text.revenueDescription}>
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

            <FormPanel eyebrow={text.costEyebrow} title={text.costTitle} description={text.costDescription}>
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
              <button className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#111827] to-[#1f2937] px-6 text-sm font-bold text-white shadow-[0_18px_34px_rgba(17,24,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(17,24,39,0.16)] disabled:opacity-70" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? text.saving : t("common.save")}
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
          text={text}
        />
      </form>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{text.portfolioEyebrow}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">{text.portfolioTitle}</h2>
          </div>
          <p className="max-w-xl text-sm text-muted">{text.portfolioDescription}</p>
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
            text={text}
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
    <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_34px_rgba(17,24,39,0.035)] backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827] text-white">
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
    <div className="rounded-[22px] border border-line bg-gradient-to-b from-white to-[#fafafa] p-4 shadow-[0_14px_34px_rgba(17,24,39,0.04)]">
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
  salePrice,
  text
}: {
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  unitProfitValue: number;
  margin: number;
  roi: number;
  grade: ReturnType<typeof profitGrade>;
  salePrice: number;
  text: ProductPageText;
}) {
  return (
    <aside className="rounded-[28px] border border-[#d8d0b8] bg-[#162f2b] p-5 text-white shadow-[0_26px_70px_rgba(15,52,47,0.26)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d6c28b]">{text.profitEyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold">{text.profitTitle}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${grade.badgeClass}`}>{grade.label}</span>
      </div>
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-4">
        <div className="text-sm text-white/60">{text.unitNetProfit}</div>
        <div className={`mt-2 text-4xl font-semibold tabular-nums ${unitProfitValue >= 0 ? "text-white" : "text-red-200"}`}>{formatCurrency(unitProfitValue)}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${grade.barClass}`} style={{ width: `${Math.max(8, Math.min(100, margin))}%` }} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ProfitMetric label={text.margin} value={`${margin.toFixed(1)}%`} />
        <ProfitMetric label="ROI" value={`${roi.toFixed(1)}%`} />
        <ProfitMetric label={text.salePrice} value={formatCurrency(salePrice)} />
        <ProfitMetric label={text.netProfit} value={formatCurrency(unitProfitValue)} />
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
  text,
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
  text: ProductPageText;
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
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-white">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{t("common.category")}</div>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{group.label}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="erp-chip px-3 py-1.5 text-xs font-semibold">{skuCount} SKU</span>
          <span className="erp-chip px-3 py-1.5 text-xs font-semibold">{text.stock} {totalStock.toLocaleString()}</span>
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
              text={text}
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
  text,
  formatCurrency,
  stockMetrics,
  onEdit,
  onDelete
}: {
  group: ReturnType<typeof groupProductsByColor>[number];
  expandedProductId: string | null;
  onExpandProduct: (productId: string) => void;
  t: ReturnType<typeof useLanguage>["t"];
  text: ProductPageText;
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
            text={text}
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
  text,
  formatCurrency,
  stock,
  onEdit,
  onDelete
}: {
  product: ProductWithStock;
  expanded: boolean;
  onExpand: () => void;
  t: ReturnType<typeof useLanguage>["t"];
  text: ProductPageText;
  formatCurrency: ReturnType<typeof useLanguage>["formatCurrency"];
  stock: number;
  onEdit: (product: ProductWithStock) => void;
  onDelete: (product: ProductWithStock) => void;
}) {
  const margin = profitMargin(product, unitProfit(product));
  const status = skuStatus(stock, margin, text);

  return (
    <article
      className="group cursor-pointer rounded-[22px] border border-line bg-gradient-to-b from-white to-[#fafafa] p-4 shadow-[0_10px_28px_rgba(17,24,39,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#2563eb]/35 hover:shadow-[0_22px_48px_rgba(17,24,39,0.075)]"
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

      <div className="mt-3 rounded-2xl border border-line bg-white px-3 py-2 font-mono text-xs font-semibold text-muted">{product.sku}</div>

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
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:text-[#2563eb]"
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
  return <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-muted">{children}</span>;
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

function profitGrade(margin: number, text: ProductPageText) {
  if (margin >= 35) {
    return {
      label: text.excellent,
      hint: text.excellentHint,
      badgeClass: "bg-emerald-100 text-emerald-800",
      barClass: "bg-emerald-400"
    };
  }
  if (margin >= 20) {
    return {
      label: text.normal,
      hint: text.normalHint,
      badgeClass: "bg-yellow-100 text-yellow-900",
      barClass: "bg-yellow-400"
    };
  }
  return {
    label: text.risk,
    hint: text.riskHint,
    badgeClass: "bg-red-100 text-red-800",
    barClass: "bg-red-400"
  };
}

function skuStatus(stock: number, margin: number, text: ProductPageText) {
  if (margin < 20 || stock < 0) return { label: text.risk, className: "bg-red-50 text-red-700 border border-red-200" };
  if (stock <= 10 || margin < 35) return { label: text.watch, className: "bg-yellow-50 text-yellow-800 border border-yellow-200" };
  return { label: text.normal, className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
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
  if (key === "BZG") return t("category.bzg");
  return key === "OTHER" ? "OTHER" : key;
}

function money(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function isDuplicateSkuError(message: string) {
  return message.includes("products_user_id_sku_key") || message.toLowerCase().includes("duplicate key");
}
