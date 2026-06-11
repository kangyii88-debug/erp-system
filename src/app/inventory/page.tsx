"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Layers,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductSelect } from "@/components/ProductSelect";
import { useLanguage } from "@/components/LanguageProvider";
import { activeProducts } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import { buildInventoryMetricsByProduct, classifyInventoryMovement, getComputedCurrentStock, getCurrentStock, type InventoryMetrics } from "@/lib/stock";
import { fetchAllStockMovements } from "@/lib/stock-movements";
import type { Language, ProductWithStock, StockMovement } from "@/lib/types";

type InventoryActionType = "purchase" | "sale" | "return_resell" | "damaged" | "lost" | "adjustment";
type LegacyMovementType = "inbound" | "outbound" | "return_inbound" | "loss";
type MovementFilterType = "all" | InventoryActionType | LegacyMovementType;
type MovementPayload = {
  product_id: string;
  type: StockMovement["type"];
  quantity: number;
  happened_at: string;
  memo: string | null;
};
type MovementRow = StockMovement & {
  actionType: MovementFilterType;
  afterStock: number;
};

const PAGE_SIZE = 12;
const COLOR_ORDER = ["WH", "BL", "GR", "BE", "OTHER"] as const;
const DEFAULT_OPEN_CATEGORY = "__DEFAULT_OPEN_CATEGORY__";
const LOSS_BAD_PREFIXES = ["损耗/不良", "손상/불량", "损耗", "불량"];
const MISSING_PREFIXES = ["丢失", "분실"];
const RETURN_PREFIXES = ["退货入库在售", "반품 입고 판매"];

const ADJUSTMENT_PREFIXES = ["数量调整", "库存调整", "수량 조정", "재고 조정"];

const copy = {
  zh: {
    pageTitle: "库存管理",
    subtitle: "管理 Coupang 仓库库存、销售出库、退货入库及损耗记录",
    saleableStock: "当前可售库存",
    totalInbound: "累计采购/入库",
    totalSalesOut: "累计销售出库",
    totalLoss: "损耗/不良/丢失",
    saleableHint: "按所有 SKU 当前库存汇总",
    inboundHint: "历史采购入库数量合计",
    salesOutHint: "历史销售出库数量合计",
    lossHint: "损耗、不良、丢失合计",
    entryEyebrow: "Stock Movement",
    entryTitle: "库存变动录入",
    editTitle: "编辑库存变动",
    productName: "商品名称",
    type: "类型",
    date: "日期",
    quantity: "数量",
    memo: "备注",
    save: "保存",
    update: "更新",
    cancelEdit: "取消编辑",
    purchaseInbound: "采购入库",
    salesOutbound: "销售出库",
    returnInbound: "退货入库在售",
    lossBad: "损耗/不良",
    missing: "丢失",
    adjustment: "库存调整",
    currentEyebrow: "Current Stock",
    currentTitle: "当前可售库存",
    currentDescription: "按品类和颜色分组查看每个 SKU 当前可售数量和风险状态。",
    totalStock: "合计库存",
    skuCount: "SKU 数量",
    stock: "库存",
    risk: "风险",
    watch: "注意",
    normal: "正常",
    historyEyebrow: "Movement History",
    historyTitle: "库存变动明细",
    historyDescription: "筛选、编辑和删除库存变动记录；变动后库存会根据统一库存逻辑计算。",
    allTypes: "全部类型",
    searchPlaceholder: "搜索备注 / SKU / 商品名",
    sku: "SKU",
    afterStock: "变动后库存",
    actions: "操作",
    edit: "编辑",
    delete: "删除",
    empty: "暂无数据",
    emptyStock: "暂无库存商品。请先在商品管理中新增商品。",
    emptyHistory: "暂无库存变动记录。",
    invalidForm: "请选择商品，并输入大于 0 的数量。",
    confirmDelete: "确定要删除这条库存变动记录吗？删除后无法恢复。",
    showing: "显示",
    prev: "上一页",
    next: "下一页",
    colorWhite: "白色",
    colorBlack: "黑色",
    colorGray: "灰色",
    colorBeige: "米色",
    colorOther: "其他",
    category: "品类",
    categoryTotal: "品类库存",
    category4lk: "百褶帘系列",
    categoryBld: "蜂巢帘系列"
  },
  ko: {
    pageTitle: "재고 관리",
    subtitle: "Coupang 창고 재고, 판매 출고, 반품 입고 및 손실 기록을 관리합니다",
    saleableStock: "현재 판매 가능 재고",
    totalInbound: "누적 구매/입고",
    totalSalesOut: "누적 판매 출고",
    totalLoss: "손상/불량/분실",
    saleableHint: "전체 SKU 현재 재고 합계",
    inboundHint: "구매 입고 수량 합계",
    salesOutHint: "판매 출고 수량 합계",
    lossHint: "손상, 불량, 분실 합계",
    entryEyebrow: "Stock Movement",
    entryTitle: "재고 변동 입력",
    editTitle: "재고 변동 수정",
    productName: "상품명",
    type: "유형",
    date: "날짜",
    quantity: "수량",
    memo: "메모",
    save: "저장",
    update: "업데이트",
    cancelEdit: "수정 취소",
    purchaseInbound: "구매 입고",
    salesOutbound: "판매 출고",
    returnInbound: "반품 입고 판매",
    lossBad: "손상/불량",
    missing: "분실",
    adjustment: "재고 조정",
    currentEyebrow: "Current Stock",
    currentTitle: "현재 판매 가능 재고",
    currentDescription: "품목과 색상별로 SKU의 판매 가능 수량과 위험 상태를 확인합니다.",
    totalStock: "총 재고",
    skuCount: "SKU 수",
    stock: "재고",
    risk: "위험",
    watch: "주의",
    normal: "정상",
    historyEyebrow: "Movement History",
    historyTitle: "재고 변동 내역",
    historyDescription: "재고 변동 기록을 필터링, 수정, 삭제합니다. 변동 후 재고는 동일한 계산 로직으로 표시됩니다.",
    allTypes: "전체 유형",
    searchPlaceholder: "메모 / SKU / 상품명 검색",
    sku: "SKU",
    afterStock: "변동 후 재고",
    actions: "작업",
    edit: "수정",
    delete: "삭제",
    empty: "데이터 없음",
    emptyStock: "재고 상품이 없습니다. 먼저 상품 관리에서 상품을 추가하세요.",
    emptyHistory: "재고 변동 기록이 없습니다.",
    invalidForm: "상품을 선택하고 0보다 큰 수량을 입력하세요.",
    confirmDelete: "이 재고 변동 기록을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.",
    showing: "표시",
    prev: "이전",
    next: "다음",
    colorWhite: "화이트",
    colorBlack: "블랙",
    colorGray: "그레이",
    colorBeige: "베이지",
    colorOther: "기타",
    category: "품목",
    categoryTotal: "품목 재고",
    category4lk: "주름 커튼 시리즈",
    categoryBld: "허니콤 블라인드 시리즈"
  }
} satisfies Record<Language, Record<string, string>>;

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function adjustmentLabel(language: Language) {
  return language === "ko" ? "수량 조정" : "数量调整";
}

function adjustmentMemoRequiredMessage(language: Language) {
  return language === "ko" ? "수량 조정은 조정 사유를 입력해야 합니다." : "数量调整必须填写调整原因。";
}

function returnResellNotice(language: Language) {
  return language === "ko"
    ? "반품 상품이 다시 판매 가능한 상태로 입고되며 현재 재고에 수량이 다시 더해집니다."
    : "退货商品重新入库且可再次销售，会把数量加回当前可售库存。";
}

function adjustmentDetailLabels(language: Language) {
  return language === "ko"
    ? { before: "조정 전 재고", delta: "조정 수량", after: "조정 후 재고", reason: "조정 사유" }
    : { before: "调整前库存", delta: "调整数量", after: "调整后库存", reason: "调整原因" };
}

export default function InventoryPage() {
  return (
    <AppShell>
      <InventoryContent />
    </AppShell>
  );
}

function InventoryContent() {
  const { language, formatDate, formatCurrency } = useLanguage();
  const ui = copy[language];
  const metricLabels = inventoryMetricLabels(language);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [form, setForm] = useState({
    product_id: "",
    type: "purchase" as InventoryActionType,
    movement_date: today(),
    quantity: "1",
    memo: ""
  });
  const [filters, setFilters] = useState({
    productId: "",
    type: "all" as MovementFilterType,
    startDate: "",
    endDate: "",
    query: ""
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(DEFAULT_OPEN_CATEGORY);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  async function load() {
    setLoading(true);
    const [{ data: productRows, error: productError }, { data: movementRows, error: movementError }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      fetchAllStockMovements<StockMovement>("*, products(name, sku, color)")
    ]);

    const visibleProducts = activeProducts((productRows ?? []) as ProductWithStock[]);
    const visibleProductIds = new Set(visibleProducts.map((product) => product.id));

    setProducts(visibleProducts);
    setMovements(((movementRows ?? []) as StockMovement[]).filter((movement) => visibleProductIds.has(movement.product_id)));
    setMessage(productError?.message ?? movementError?.message ?? "");
    setLoading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const quantity = Number(form.quantity);
    if (!form.product_id || !Number.isFinite(quantity) || (form.type === "adjustment" ? quantity === 0 : quantity <= 0)) {
      setMessage(ui.invalidForm);
      return;
    }
    if (form.type === "adjustment" && !form.memo.trim()) {
      setMessage(adjustmentMemoRequiredMessage(language));
      return;
    }

    const payload = buildPayload(form, ui, language);
    if (editingId) {
      const error = await updateMovement(editingId, payload);
      if (error) {
        setMessage(error.message);
        return;
      }
      setHighlightId(editingId);
    } else {
      const { data, error } = await supabase
        .from("stock_movements")
        .insert({ user_id: auth.user.id, ...payload })
        .select("id")
        .single();
      if (error) {
        setMessage(error.message);
        return;
      }
      setHighlightId(data?.id ?? null);
    }

    window.setTimeout(() => setHighlightId(null), 1800);
    setMessage("");
    resetForm();
    await load();
  }

  async function updateMovement(id: string, payload: MovementPayload) {
    const original = movements.find((movement) => movement.id === id);
    if (!original) return { message: "Original movement is missing." };

    const originalSigned = signedQuantity(original.type, original.quantity);
    const nextSigned = signedQuantity(payload.type, payload.quantity);
    const { error: movementError } = await supabase.from("stock_movements").update(payload).eq("id", id);
    if (movementError) return movementError;

    if (original.product_id === payload.product_id) {
      const delta = nextSigned - originalSigned;
      if (delta !== 0) {
        const product = products.find((item) => item.id === payload.product_id);
        const stockError = await upsertStock(payload.product_id, currentStock(product) + delta);
        if (stockError) return stockError;
      }
    } else {
      const oldProduct = products.find((item) => item.id === original.product_id);
      const newProduct = products.find((item) => item.id === payload.product_id);
      const oldError = await upsertStock(original.product_id, currentStock(oldProduct) - originalSigned);
      if (oldError) return oldError;
      const newError = await upsertStock(payload.product_id, currentStock(newProduct) + nextSigned);
      if (newError) return newError;
    }

    const salesError = await syncSalesDailyAfterEdit(original, payload);
    return salesError;
  }

  async function upsertStock(productId: string, value: number) {
    const { error } = await supabase
      .from("inventory_balances")
      .upsert({ product_id: productId, current_stock: Math.trunc(value), updated_at: new Date().toISOString() }, { onConflict: "product_id" });
    return error;
  }

  async function syncSalesDailyAfterEdit(original: StockMovement, payload: MovementPayload) {
    if (original.type === "sale") {
      const error = await changeSalesDaily(original.product_id, toDateString(original.happened_at), -original.quantity);
      if (error) return error;
    }
    if (payload.type === "sale") {
      const error = await changeSalesDaily(payload.product_id, toDateString(payload.happened_at), payload.quantity);
      if (error) return error;
    }
    return null;
  }

  async function changeSalesDaily(productId: string, saleDate: string, delta: number) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data, error: readError } = await supabase
      .from("sales_daily")
      .select("id, quantity")
      .eq("product_id", productId)
      .eq("sale_date", saleDate)
      .maybeSingle();
    if (readError) return readError;

    const nextQuantity = Math.max(0, Number(data?.quantity ?? 0) + delta);
    if (data?.id) {
      const { error } = await supabase.from("sales_daily").update({ quantity: nextQuantity }).eq("id", data.id);
      return error;
    }

    if (nextQuantity > 0) {
      const { error } = await supabase.from("sales_daily").insert({
        user_id: auth.user.id,
        product_id: productId,
        sale_date: saleDate,
        quantity: nextQuantity
      });
      return error;
    }
    return null;
  }

  function startEdit(movement: MovementRow) {
    setEditingId(movement.id);
    setMessage("");
    setForm({
      product_id: movement.product_id,
      type: editableActionType(movement),
      movement_date: toDateString(movement.happened_at),
      quantity: String(movement.quantity),
      memo: stripSystemMemo(movement.memo)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ product_id: "", type: "purchase", movement_date: today(), quantity: "1", memo: "" });
  }

  async function deleteMovement(movement: MovementRow) {
    if (!window.confirm(`${ui.confirmDelete}\n${movement.products?.sku ?? ""}`)) return;

    const product = products.find((item) => item.id === movement.product_id);
    const rollbackStock = currentStock(product) - signedQuantity(movement.type, movement.quantity);
    const stockError = await upsertStock(movement.product_id, rollbackStock);
    if (stockError) {
      setMessage(stockError.message);
      return;
    }

    if (movement.type === "sale") {
      const salesError = await changeSalesDaily(movement.product_id, toDateString(movement.happened_at), -movement.quantity);
      if (salesError) {
        setMessage(salesError.message);
        return;
      }
    }

    const { error } = await supabase.from("stock_movements").delete().eq("id", movement.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === movement.id) resetForm();
    setMessage("");
    await load();
  }

  async function saveActualStock(product: ProductWithStock, currentStockValue: number, actualStockValue: number) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return "Login is required.";

    if (!Number.isFinite(actualStockValue)) return ui.invalidForm;

    const actualStock = Math.trunc(actualStockValue);
    const delta = actualStock - Math.trunc(currentStockValue);
    if (delta === 0) {
      setMessage("");
      return null;
    }

    const memo = language === "ko" ? `실재고 조정: ${actualStock}` : `实际库存校准: ${actualStock}`;
    const { data, error } = await supabase
      .from("stock_movements")
      .insert({
        user_id: auth.user.id,
        product_id: product.id,
        type: "adjustment",
        quantity: delta,
        memo
      })
      .select("id")
      .single();

    if (error) return error.message;

    const stockError = await upsertStock(product.id, actualStock);
    if (stockError) return stockError.message;

    setHighlightId(data?.id ?? null);
    window.setTimeout(() => setHighlightId(null), 1800);
    setMessage("");
    await load();
    return null;
  }

  const metricsByProduct = useMemo(() => buildInventoryMetricsByProduct(movements), [movements]);
  const movementRows = useMemo(() => attachAfterStock(movements, products, metricsByProduct), [movements, products, metricsByProduct]);
  const metrics = useMemo(() => calculateMetrics(products, movements, metricsByProduct), [products, movements, metricsByProduct]);
  const inventoryGroups = useMemo(() => groupProductsByCategory(products, ui), [products, ui]);
  const activeCategoryKey =
    openCategoryKey === DEFAULT_OPEN_CATEGORY
      ? inventoryGroups[0]?.key ?? null
      : openCategoryKey && inventoryGroups.some((group) => group.key === openCategoryKey)
        ? openCategoryKey
        : null;
  const filteredRows = useMemo(() => applyFilters(movementRows, filters), [movementRows, filters]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <section className="animate-[kpi-rise_0.5s_ease-out]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{ui.pageTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{ui.subtitle}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Boxes} label={metricLabels.saleableStock} value={formatNumber(metrics.saleable)} hint={metricLabels.saleableHint} tone="green" delay="0ms" />
          <MetricCard icon={DollarSign} label={metricLabels.inventoryValue} value={formatCurrency(metrics.inventoryValue)} hint={metricLabels.inventoryValueHint} tone="blue" delay="80ms" />
          <MetricCard icon={AlertTriangle} label={metricLabels.riskSkuCount} value={formatNumber(metrics.riskSkuCount)} hint={metricLabels.riskSkuHint} tone="red" delay="160ms" />
          <MetricCard icon={Layers} label={metricLabels.skuTotal} value={formatNumber(metrics.skuTotal)} hint={metricLabels.skuTotalHint} tone="slate" delay="240ms" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={PackagePlus} label={metricLabels.totalInbound} value={formatNumber(metrics.inbound)} hint={metricLabels.inboundHint} tone="green" delay="320ms" />
          <MetricCard icon={ArrowDownCircle} label={metricLabels.totalSalesOut} value={formatNumber(metrics.salesOut)} hint={metricLabels.salesOutHint} tone="blue" delay="400ms" />
          <MetricCard icon={RotateCcw} label={metricLabels.returnRestock} value={formatNumber(metrics.returnInbound)} hint={metricLabels.returnRestockHint} tone="slate" delay="480ms" />
          <MetricCard icon={AlertTriangle} label={metricLabels.totalLoss} value={formatNumber(metrics.loss)} hint={metricLabels.lossHint} tone="red" delay="560ms" />
        </div>
        <InventoryFlowCard metrics={metrics} labels={metricLabels} language={language} />
      </section>

      <section className="erp-card animate-[kpi-rise_0.6s_ease-out] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{ui.entryEyebrow}</div>
            <h2 className="mt-1 text-xl font-semibold text-ink">{editingId ? ui.editTitle : ui.entryTitle}</h2>
          </div>
          {editingId ? (
            <button className="erp-button-subtle px-3 py-2 text-sm font-semibold" type="button" onClick={resetForm}>
              {ui.cancelEdit}
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="grid gap-3 xl:grid-cols-[1.5fr_0.82fr_0.75fr_0.52fr_1fr_auto]">
          <Field label={ui.productName}>
            <ProductSelect products={products} value={form.product_id} onChange={(value) => setForm({ ...form, product_id: value })} />
          </Field>
          <Field label={ui.type}>
            <select className="h-11 w-full" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as InventoryActionType })}>
              {actionOptions(ui, language).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={ui.date}>
            <input className="h-11 w-full" type="date" value={form.movement_date} onChange={(event) => setForm({ ...form, movement_date: event.target.value })} />
          </Field>
          <Field label={ui.quantity}>
            <input className="h-11 w-full" type="number" min={form.type === "adjustment" ? undefined : "1"} step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </Field>
          <Field label={ui.memo}>
            <input className="h-11 w-full" placeholder={ui.memo} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
          </Field>
          <button className="erp-button-primary h-11 self-end px-8 text-sm font-semibold shadow-sm hover:shadow-lg" type="submit">
            {editingId ? ui.update : ui.save}
          </button>
        </form>
        {form.type === "return_resell" ? (
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {returnResellNotice(language)}
          </div>
        ) : null}
        {message ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</div> : null}
      </section>

      <section className="animate-[kpi-rise_0.7s_ease-out]">
        <SectionTitle eyebrow={ui.currentEyebrow} title={ui.currentTitle} description={ui.currentDescription} />
        <div className="mt-4 space-y-5">
          {loading ? <InventorySkeleton /> : null}
          {!loading && inventoryGroups.map((group) => (
            <CategoryStockGroup
              key={group.key}
              group={group}
              ui={ui}
              metricsByProduct={metricsByProduct}
              expanded={group.key === activeCategoryKey}
              onToggle={() => setOpenCategoryKey(group.key === activeCategoryKey ? null : group.key)}
              onSaveActualStock={saveActualStock}
            />
          ))}
          {!loading && inventoryGroups.length === 0 ? <EmptyState title={ui.empty} description={ui.emptyStock} /> : null}
        </div>
      </section>

      <section className="animate-[kpi-rise_0.75s_ease-out]">
        <SectionTitle eyebrow={ui.historyEyebrow} title={ui.historyTitle} description={ui.historyDescription} />
        <div className="erp-card mt-4 overflow-hidden">
          <div className="grid gap-3 border-b border-line bg-card/70 p-4 lg:grid-cols-[1.2fr_0.85fr_0.8fr_0.8fr_1fr]">
            <ProductSelect products={products} value={filters.productId} onChange={(value) => setFilters({ ...filters, productId: value })} />
            <select className="h-10" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as MovementFilterType })}>
              <option value="all">{ui.allTypes}</option>
              {actionOptions(ui, language).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input className="h-10" type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} />
            <input className="h-10" type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="h-10 w-full pl-9"
                placeholder={ui.searchPlaceholder}
                value={filters.query}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <HistoryTh className="w-[140px]">{ui.date}</HistoryTh>
                  <HistoryTh className="min-w-[260px]">{ui.productName}</HistoryTh>
                  <HistoryTh className="w-[160px]">{ui.sku}</HistoryTh>
                  <HistoryTh className="w-[150px]">{ui.type}</HistoryTh>
                  <HistoryTh className="w-[110px] text-right">{ui.quantity}</HistoryTh>
                  <HistoryTh className="w-[130px] text-right">{ui.afterStock}</HistoryTh>
                  <HistoryTh className="min-w-[190px]">{ui.memo}</HistoryTh>
                  <HistoryTh className="w-[150px] text-right">{ui.actions}</HistoryTh>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, index) => <SkeletonRow key={index} />)
                  : pagedRows.map((movement) => (
                      <HistoryRow
                        key={movement.id}
                        movement={movement}
                        ui={ui}
                        language={language}
                        formatDate={formatDate}
                        highlighted={highlightId === movement.id}
                        onEdit={() => startEdit(movement)}
                        onDelete={() => deleteMovement(movement)}
                      />
                    ))}
                {!loading && pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10">
                      <EmptyState title={ui.empty} description={ui.emptyHistory} />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-card/80 px-4 py-3 text-sm text-muted">
            <div>
              {ui.showing} {filteredRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} /{" "}
              {filteredRows.length}
            </div>
            <div className="flex gap-2">
              <button className="erp-button-subtle px-3 py-1.5 text-sm font-semibold disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                {ui.prev}
              </button>
              <button className="erp-button-subtle px-3 py-1.5 text-sm font-semibold disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                {ui.next}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function inventoryMetricLabels(language: Language) {
  if (language === "ko") {
    return {
      saleableStock: "현재 판매 가능 재고",
      inventoryValue: "재고 가치",
      riskSkuCount: "위험 SKU 수",
      skuTotal: "SKU 총수",
      totalInbound: "누적 구매 입고",
      totalSalesOut: "누적 판매 출고",
      returnRestock: "반품 재입고 판매",
      totalLoss: "손상/불량/분실",
      saleableHint: "전체 SKU의 현재 판매 가능 수량",
      inventoryValueHint: "매입가 기준 현재 재고 원가",
      riskSkuHint: "현재 재고 10개 미만 SKU",
      skuTotalHint: "현재 운영 중인 SKU 수",
      inboundHint: "구매 입고 수량 합계",
      salesOutHint: "판매 출고 수량 합계",
      returnRestockHint: "반품 후 다시 판매 가능한 재고",
      lossHint: "손상, 불량, 분실 수량 합계",
      flowEyebrow: "Inventory Flow",
      flowTitle: "재고 흐름 관계",
      flowDescription: "현재 판매 가능 재고가 어떤 입출고 기록으로 구성되는지 한눈에 확인합니다.",
      flowEquals: "현재 판매 가능 재고",
      flowFormulaNote: "구매 입고 - 판매 출고 - 손상/불량/분실"
    };
  }

  return {
    saleableStock: "当前可售库存",
    inventoryValue: "库存价值",
    riskSkuCount: "风险SKU数量",
    skuTotal: "SKU总数",
    totalInbound: "累计采购入库",
    totalSalesOut: "累计销售出库",
    returnRestock: "退货重新入库在售",
    totalLoss: "损耗/不良/丢失",
    saleableHint: "全部 SKU 当前可销售数量",
    inventoryValueHint: "按采购价计算的当前库存成本",
    riskSkuHint: "当前库存低于 10 的 SKU",
    skuTotalHint: "当前启用的商品 SKU 数量",
    inboundHint: "采购入库数量合计",
    salesOutHint: "销售出库数量合计",
    returnRestockHint: "退货后重新入库且可继续销售",
    lossHint: "损耗、不良、丢失数量合计",
    flowEyebrow: "Inventory Flow",
    flowTitle: "库存流转关系",
    flowDescription: "把当前可售库存的来源拆开显示，库存人员不需要手动倒推。",
    flowEquals: "当前可售库存",
    flowFormulaNote: "采购入库 - 销售出库 - 损耗/不良/丢失"
  };
}

function InventoryFlowCard({ metrics, labels, language }: { metrics: ReturnType<typeof calculateMetrics>; labels: ReturnType<typeof inventoryMetricLabels>; language: Language }) {
  const adjustment = metrics.adjustment;
  const adjustmentSign = adjustment >= 0 ? "+" : "-";
  const adjustmentLabelText = adjustmentLabel(language);
  const items = [
    { label: labels.totalInbound, value: metrics.inbound, sign: "+", tone: "text-[#1e5a4e] bg-[#1e5a4e]/8" },
    { label: labels.totalSalesOut, value: metrics.salesOut, sign: "-", tone: "text-[#406a7a] bg-[#406a7a]/8" },
    { label: labels.returnRestock, value: metrics.returnInbound, sign: "+", tone: "text-teal-700 bg-teal-50" },
    { label: labels.totalLoss, value: metrics.loss, sign: "-", tone: "text-[#9a3f3f] bg-[#9a3f3f]/8" },
    { label: adjustmentLabelText, value: Math.abs(adjustment), sign: adjustmentSign, tone: "text-blue-700 bg-blue-50" }
  ];

  return (
    <div className="erp-card overflow-hidden p-5" style={{ animation: "kpi-rise 0.7s ease-out both", animationDelay: "640ms" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{labels.flowEyebrow}</div>
          <h2 className="mt-1 text-xl font-semibold text-ink">{labels.flowTitle}</h2>
          <p className="mt-1 text-sm text-muted">{labels.flowDescription}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white/70 px-4 py-3 text-right shadow-soft">
          <div className="text-xs font-semibold text-muted">{labels.flowEquals}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">{formatNumber(metrics.saleable)}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
        <FormulaPill label={labels.totalInbound} value={metrics.inbound} tone="text-[#1e5a4e] bg-[#1e5a4e]/8" />
        <FormulaOperator value="-" />
        <FormulaPill label={labels.totalSalesOut} value={metrics.salesOut} tone="text-[#406a7a] bg-[#406a7a]/8" />
        <FormulaOperator value="+" />
        <FormulaPill label={labels.returnRestock} value={metrics.returnInbound} tone="text-teal-700 bg-teal-50" />
        <FormulaOperator value="-" />
        <FormulaPill label={labels.totalLoss} value={metrics.loss} tone="text-[#9a3f3f] bg-[#9a3f3f]/8" />
        <FormulaOperator value={adjustmentSign} />
        <FormulaPill label={adjustmentLabelText} value={Math.abs(adjustment)} tone="text-blue-700 bg-blue-50" />
        <FormulaOperator value="=" />
        <FormulaPill label={labels.flowEquals} value={metrics.flowResult} tone="text-[#0f3d35] bg-[#0f3d35]/10" strong />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.label} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${item.tone}`}>
            {item.sign === "record" ? "" : item.sign}
            {formatNumber(item.value)} {item.label}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{labels.flowFormulaNote} +/- {adjustmentLabelText}. {returnResellNotice(language)}</p>
    </div>
  );
}

function FormulaPill({ label, value, tone, strong = false }: { label: string; value: number; tone: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${tone}`}>
      <div className="text-xs font-semibold opacity-80">{label}</div>
      <div className={`mt-1 tabular-nums ${strong ? "text-2xl font-semibold" : "text-xl font-semibold"}`}>{formatNumber(value)}</div>
    </div>
  );
}

function FormulaOperator({ value }: { value: string }) {
  return <div className="hidden items-center justify-center text-xl font-semibold text-muted xl:flex">{value}</div>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  delay
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  hint: string;
  tone: "green" | "blue" | "slate" | "red";
  delay: string;
}) {
  const tones = {
    green: "from-[#17483f]/14 text-[#17483f]",
    blue: "from-[#406a7a]/14 text-[#406a7a]",
    slate: "from-[#48596f]/14 text-[#48596f]",
    red: "from-[#9a3f3f]/14 text-[#9a3f3f]"
  };

  return (
    <div className="erp-card group p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lift" style={{ animation: "kpi-rise 0.6s ease-out both", animationDelay: delay }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
          <div className="mt-3 text-3xl font-semibold tabular-nums text-ink">{value}</div>
          <div className="mt-2 text-xs text-muted">{hint}</div>
        </div>
        <div className={`rounded-2xl bg-gradient-to-br ${tones[tone]} to-white p-3`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function CategoryStockGroup({
  group,
  ui,
  metricsByProduct,
  expanded,
  onToggle,
  onSaveActualStock
}: {
  group: ReturnType<typeof groupProductsByCategory>[number];
  ui: (typeof copy)[Language];
  metricsByProduct: Map<string, InventoryMetrics>;
  expanded: boolean;
  onToggle: () => void;
  onSaveActualStock: (product: ProductWithStock, currentStockValue: number, actualStockValue: number) => Promise<string | null>;
}) {
  const total = group.colorGroups.reduce(
    (sum, colorGroup) => sum + colorGroup.products.reduce((colorSum, product) => colorSum + getComputedCurrentStock(product, metricsByProduct), 0),
    0
  );
  const skuCount = group.colorGroups.reduce((sum, colorGroup) => sum + colorGroup.products.length, 0);

  return (
    <div className={`rounded-3xl border border-line bg-card/90 shadow-card transition ${expanded ? "p-4" : "p-0"}`}>
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
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{ui.category}</div>
            <h3 className="mt-1 text-2xl font-semibold text-ink">{group.label}</h3>
          </div>
        </div>
        <div className="flex gap-2 text-xs font-semibold text-muted">
          <span className="erp-chip px-3 py-1.5">
            {ui.categoryTotal} {formatNumber(total)}
          </span>
          <span className="erp-chip px-3 py-1.5">
            {ui.skuCount} {skuCount}
          </span>
        </div>
      </button>
      {expanded ? (
        <div className="mt-4 space-y-4">
          {group.colorGroups.map((colorGroup) => (
            <ColorStockGroup key={`${group.key}-${colorGroup.key}`} group={colorGroup} ui={ui} metricsByProduct={metricsByProduct} onSaveActualStock={onSaveActualStock} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ColorStockGroup({
  group,
  ui,
  metricsByProduct,
  onSaveActualStock
}: {
  group: ReturnType<typeof groupProductsByColor>[number];
  ui: (typeof copy)[Language];
  metricsByProduct: Map<string, InventoryMetrics>;
  onSaveActualStock: (product: ProductWithStock, currentStockValue: number, actualStockValue: number) => Promise<string | null>;
}) {
  const total = group.products.reduce((sum, product) => sum + getComputedCurrentStock(product, metricsByProduct), 0);

  return (
    <div className="erp-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${colorDotClass(group.key)}`} />
          <h3 className="text-lg font-semibold text-ink">{group.label}</h3>
        </div>
        <div className="flex gap-2 text-xs font-semibold text-muted">
          <span className="erp-chip px-3 py-1.5">
            {ui.totalStock} {formatNumber(total)}
          </span>
          <span className="erp-chip px-3 py-1.5">
            {ui.skuCount} {group.products.length}
          </span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {group.products.map((product) => (
          <StockProductCard key={product.id} product={product} ui={ui} metricsByProduct={metricsByProduct} onSaveActualStock={onSaveActualStock} />
        ))}
      </div>
    </div>
  );
}

function StockProductCard({
  product,
  ui,
  metricsByProduct,
  onSaveActualStock
}: {
  product: ProductWithStock;
  ui: (typeof copy)[Language];
  metricsByProduct: Map<string, InventoryMetrics>;
  onSaveActualStock: (product: ProductWithStock, currentStockValue: number, actualStockValue: number) => Promise<string | null>;
}) {
  const stock = getComputedCurrentStock(product, metricsByProduct);
  const [editing, setEditing] = useState(false);
  const [draftStock, setDraftStock] = useState(String(stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const status = stock < 10 ? ui.risk : stock <= 20 ? ui.watch : ui.normal;
  const statusClass =
    stock < 0
      ? "border-red-200 bg-red-50"
      : stock < 10
        ? "border-red-200 bg-red-50/70"
        : stock <= 20
          ? "border-yellow-200 bg-yellow-50/70"
          : "border-emerald-200 bg-emerald-50/45";

  async function save() {
    const nextStock = Number(draftStock);
    if (!Number.isFinite(nextStock)) {
      setError("Invalid number");
      return;
    }
    setSaving(true);
    setError("");
    const message = await onSaveActualStock(product, stock, nextStock);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setEditing(false);
  }

  function startEditing() {
    setDraftStock(String(stock));
    setError("");
    setEditing(true);
  }

  return (
    <div className={`rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 hover:border-[#17483f]/30 hover:shadow-card ${statusClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted">{product.sku}</div>
          <div className="mt-1 line-clamp-2 min-h-[2.5rem] font-semibold text-ink">{product.name}</div>
        </div>
        <span className="rounded-full bg-card/80 px-2.5 py-1 text-xs font-semibold text-muted">{normalizeSize(product.size)}</span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        {editing ? (
          <div className="flex max-w-[170px] flex-col gap-2">
            <input
              className="h-10 rounded-xl border border-line bg-white px-3 text-2xl font-semibold tabular-nums text-ink"
              type="number"
              step="1"
              value={draftStock}
              onChange={(event) => setDraftStock(event.target.value)}
            />
            <div className="flex gap-2">
              <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" type="button" disabled={saving} onClick={save}>
                {saving ? "..." : "保存"}
              </button>
              <button className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted" type="button" disabled={saving} onClick={() => setEditing(false)}>
                取消
              </button>
            </div>
            {error ? <div className="text-xs font-medium text-red-700">{error}</div> : null}
          </div>
        ) : (
          <button className={`text-left text-3xl font-semibold tabular-nums ${stock < 0 ? "text-red-700" : "text-ink"}`} type="button" onClick={startEditing}>
            {formatNumber(stock)}
          </button>
        )}
        <div className="text-right">
          <div className="text-xs text-muted">{ui.stock}</div>
          <div className="text-xs font-semibold text-muted">{status}</div>
          {!editing ? (
            <button className="mt-2 rounded-lg border border-line bg-white/80 px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-brand/30 hover:text-brand" type="button" onClick={startEditing}>
              编辑
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({
  movement,
  ui,
  language,
  formatDate,
  highlighted,
  onEdit,
  onDelete
}: {
  movement: MovementRow;
  ui: (typeof copy)[Language];
  language: Language;
  formatDate: ReturnType<typeof useLanguage>["formatDate"];
  highlighted: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const signed = signedMovementQuantity(movement);
  const beforeStock = movement.afterStock - signed;
  const absQuantity = Math.abs(safeQuantity(movement.quantity));
  const adjustmentLabels = adjustmentDetailLabels(language);
  const memoText = stripSystemMemo(movement.memo);
  const recordOnly = false;

  return (
    <tr className={`group transition hover:bg-[#f7f4ec] ${highlighted ? "bg-emerald-50/70" : "bg-card/70"}`}>
      <HistoryTd>{formatDate(movement.happened_at, { year: "numeric", month: "2-digit", day: "2-digit" })}</HistoryTd>
      <HistoryTd>
        <div className="font-semibold text-ink">{movement.products?.name ?? "-"}</div>
        <div className="mt-1 text-xs text-muted">{movement.products?.color ?? ""}</div>
      </HistoryTd>
      <HistoryTd>
        <span className="text-xs font-medium text-muted">{movement.products?.sku ?? "-"}</span>
      </HistoryTd>
      <HistoryTd>
        <MovementTag type={movement.actionType} label={actionTypeLabel(movement.actionType, ui, language)} />
      </HistoryTd>
      <HistoryTd className="text-right">
        <span className={`font-semibold tabular-nums ${recordOnly ? "text-teal-700" : signed >= 0 ? "text-emerald-700" : "text-red-700"}`}>
          {recordOnly ? "" : signed >= 0 ? "+" : "-"}
          {formatNumber(absQuantity)}
        </span>
      </HistoryTd>
      <HistoryTd className="text-right">
        <span className={`font-semibold tabular-nums ${movement.afterStock < 0 ? "text-red-700" : "text-ink"}`}>{formatNumber(movement.afterStock)}</span>
      </HistoryTd>
      <HistoryTd>
        {recordOnly ? (
          <div className="space-y-1">
            <span className="text-muted">{memoText || "-"}</span>
            <div className="text-xs font-medium text-teal-700">{returnResellNotice(language)}</div>
          </div>
        ) : movement.actionType === "adjustment" ? (
          <div className="grid gap-1 text-xs text-muted sm:grid-cols-2">
            <span>
              {adjustmentLabels.before}: <b className="tabular-nums text-ink">{formatNumber(beforeStock)}</b>
            </span>
            <span>
              {adjustmentLabels.delta}:{" "}
              <b className={`tabular-nums ${signed >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {signed >= 0 ? "+" : "-"}
                {formatNumber(absQuantity)}
              </b>
            </span>
            <span>
              {adjustmentLabels.after}: <b className="tabular-nums text-ink">{formatNumber(movement.afterStock)}</b>
            </span>
            <span className="sm:col-span-2">
              {adjustmentLabels.reason}: <b className="font-semibold text-ink">{memoText || "-"}</b>
            </span>
          </div>
        ) : (
          <span className="text-muted">{memoText || "-"}</span>
        )}
      </HistoryTd>
      <HistoryTd className="text-right">
        <div className="flex justify-end gap-2">
          <button className="erp-button-subtle px-3 py-1.5 text-xs font-semibold" type="button" onClick={onEdit}>
            {ui.edit}
          </button>
          <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100" type="button" onClick={onDelete}>
            {ui.delete}
          </button>
        </div>
      </HistoryTd>
    </tr>
  );
}

function HistoryTh({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`border-b border-line bg-[#f6f3ec] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted ${className}`}>{children}</th>;
}

function HistoryTd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-line px-4 py-4 align-middle ${className}`}>{children}</td>;
}

function MovementTag({ type, label }: { type: MovementFilterType; label: string }) {
  const className =
    type === "purchase" || type === "inbound"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : type === "sale" || type === "outbound"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : type === "return_resell" || type === "return_inbound"
          ? "border-teal-200 bg-teal-50 text-teal-700"
          : type === "lost"
            ? "border-red-200 bg-red-50 text-red-700"
            : type === "damaged" || type === "loss"
              ? "border-yellow-200 bg-yellow-50 text-yellow-800"
              : type === "adjustment"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-line bg-panel text-muted";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/55 px-4 py-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-panel text-muted">
        <ClipboardList className="h-5 w-5" />
      </div>
      <div className="font-semibold text-ink">{title}</div>
      <div className="mt-1 text-sm text-muted">{description}</div>
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="erp-card p-4">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-panel" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-panel/80" />
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, index) => (
        <td key={index} className="border-b border-line px-4 py-4">
          <div className="h-4 animate-pulse rounded bg-panel" />
        </td>
      ))}
    </tr>
  );
}

function calculateMetrics(products: ProductWithStock[], movements: StockMovement[], metricsByProduct: Map<string, InventoryMetrics>) {
  const inbound = movements.filter((movement) => actionTypeOf(movement) === "purchase").reduce((sum, movement) => sum + safeQuantity(movement.quantity), 0);
  const salesOut = movements.filter((movement) => actionTypeOf(movement) === "sale").reduce((sum, movement) => sum + safeQuantity(movement.quantity), 0);
  const returnInbound = movements.filter((movement) => actionTypeOf(movement) === "return_resell").reduce((sum, movement) => sum + safeQuantity(movement.quantity), 0);
  const loss = movements.filter((movement) => actionTypeOf(movement) === "damaged" || actionTypeOf(movement) === "lost").reduce((sum, movement) => sum + safeQuantity(movement.quantity), 0);
  const adjustment = movements.filter((movement) => movement.type === "adjustment").reduce((sum, movement) => sum + safeQuantity(movement.quantity), 0);
  const flowResult = inbound - salesOut + returnInbound - loss + adjustment;

  return {
    saleable: flowResult,
    inventoryValue: products.reduce((sum, product) => sum + getComputedCurrentStock(product, metricsByProduct) * safeMoney(product.purchase_price), 0),
    riskSkuCount: products.filter((product) => getComputedCurrentStock(product, metricsByProduct) < 10).length,
    skuTotal: products.length,
    inbound,
    salesOut,
    returnInbound,
    loss,
    adjustment,
    flowResult
  };
}

function attachAfterStock(movements: StockMovement[], products: ProductWithStock[], metricsByProduct: Map<string, InventoryMetrics>) {
  const rolling = new Map(products.map((product) => [product.id, getComputedCurrentStock(product, metricsByProduct)]));

  return [...movements]
    .sort((a, b) => new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime())
    .map((movement) => {
      const afterStock = rolling.get(movement.product_id) ?? 0;
      rolling.set(movement.product_id, afterStock - signedMovementQuantity(movement));
      return { ...movement, afterStock, actionType: actionTypeOf(movement) };
    });
}

function applyFilters(rows: MovementRow[], filters: { productId: string; type: MovementFilterType; startDate: string; endDate: string; query: string }) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.productId && row.product_id !== filters.productId) return false;
    if (filters.type !== "all" && row.actionType !== filters.type) return false;
    const rowDate = toDateString(row.happened_at);
    if (filters.startDate && rowDate < filters.startDate) return false;
    if (filters.endDate && rowDate > filters.endDate) return false;
    if (query) {
      const haystack = `${row.products?.sku ?? ""} ${row.products?.name ?? ""} ${row.memo ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function buildPayload(
  form: { product_id: string; type: InventoryActionType; movement_date: string; quantity: string; memo: string },
  ui: (typeof copy)[Language],
  language: Language
): MovementPayload {
  const cleanMemo = form.memo.trim();
  const systemLabel = form.type === "return_resell" || form.type === "damaged" || form.type === "lost" || form.type === "adjustment" ? actionTypeLabel(form.type, ui, language) : "";

  return {
    product_id: form.product_id,
    type: dbTypeForAction(form.type),
    quantity: Math.trunc(Number(form.quantity)),
    happened_at: new Date(`${form.movement_date}T12:00:00+09:00`).toISOString(),
    memo: systemLabel ? `${systemLabel}${cleanMemo ? ` - ${cleanMemo}` : ""}` : cleanMemo || null
  };
}

function dbTypeForAction(type: InventoryActionType): StockMovement["type"] {
  return type;
}

function signedQuantity(type: StockMovement["type"], quantity: number) {
  const safe = safeQuantity(quantity);
  if (type === "return_resell" || type === "return_inbound") return safe;
  if (type === "purchase" || type === "inbound" || type === "adjustment") return safe;
  return -safe;
}

function signedMovementQuantity(movement: StockMovement) {
  const safe = safeQuantity(movement.quantity);
  const actionType = actionTypeOf(movement);
  if (actionType === "return_resell") return safe;
  if (actionType === "purchase" || actionType === "adjustment") return safe;
  return -safe;
}

function actionTypeOf(movement: StockMovement): MovementFilterType {
  const type = classifyInventoryMovement(movement);
  if (type === "return_resell") return "return_resell";
  if (type === "loss") return movement.type === "lost" ? "lost" : "damaged";
  if (type === "purchase") return "purchase";
  if (type === "sale") return "sale";
  if (type === "adjustment") return "adjustment";
  return movement.type;
}

function editableActionType(movement: StockMovement): InventoryActionType {
  const type = actionTypeOf(movement);
  if (type === "all" || type === "inbound") return "purchase";
  if (type === "outbound") return "sale";
  if (type === "return_inbound") return "return_resell";
  if (type === "loss") return "damaged";
  return type;
}

function actionOptions(ui: (typeof copy)[Language], language: Language) {
  return [
    { value: "purchase", label: ui.purchaseInbound },
    { value: "sale", label: ui.salesOutbound },
    { value: "return_resell", label: ui.returnInbound },
    { value: "damaged", label: ui.lossBad },
    { value: "lost", label: ui.missing },
    { value: "adjustment", label: adjustmentLabel(language) }
  ] as const;
}

function actionTypeLabel(type: MovementFilterType, ui: (typeof copy)[Language], language: Language) {
  const labels: Record<MovementFilterType, string> = {
    all: ui.allTypes,
    purchase: ui.purchaseInbound,
    inbound: ui.purchaseInbound,
    sale: ui.salesOutbound,
    return_resell: ui.returnInbound,
    return_inbound: ui.returnInbound,
    damaged: ui.lossBad,
    lost: ui.missing,
    loss: ui.lossBad,
    outbound: ui.salesOutbound,
    adjustment: adjustmentLabel(language)
  };
  return labels[type];
}

function stripSystemMemo(memo: string | null) {
  const prefixes = [...RETURN_PREFIXES, ...LOSS_BAD_PREFIXES, ...MISSING_PREFIXES, ...ADJUSTMENT_PREFIXES];
  for (const prefix of prefixes) {
    if (memo?.startsWith(`${prefix} - `)) return memo.replace(`${prefix} - `, "");
    if (memo === prefix) return "";
  }
  return memo ?? "";
}

function groupProductsByCategory(products: ProductWithStock[], ui: (typeof copy)[Language]) {
  const categoryMap = new Map<string, ProductWithStock[]>();
  for (const product of [...products].sort(compareProducts)) {
    const key = categoryKey(product);
    categoryMap.set(key, [...(categoryMap.get(key) ?? []), product]);
  }

  return Array.from(categoryMap.entries()).map(([key, categoryProducts]) => ({
    key,
    label: categoryLabel(key, ui),
    colorGroups: groupProductsByColor(categoryProducts, ui)
  }));
}

function groupProductsByColor(products: ProductWithStock[], ui: (typeof copy)[Language]) {
  const groups = new Map<string, ProductWithStock[]>();
  for (const product of [...products].sort(compareProducts)) {
    const key = colorKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return COLOR_ORDER.map((key) => ({ key, label: colorLabel(key, ui), products: groups.get(key) ?? [] })).filter((group) => group.products.length > 0);
}

function compareProducts(a: ProductWithStock, b: ProductWithStock) {
  const categoryDiff = categoryKey(a).localeCompare(categoryKey(b), undefined, { numeric: true });
  if (categoryDiff !== 0) return categoryDiff;

  const colorDiff = COLOR_ORDER.indexOf(colorKey(a) as (typeof COLOR_ORDER)[number]) - COLOR_ORDER.indexOf(colorKey(b) as (typeof COLOR_ORDER)[number]);
  if (colorDiff !== 0) return colorDiff;

  const aSize = normalizeSize(a.size) || baseSku(a.sku);
  const bSize = normalizeSize(b.size) || baseSku(b.sku);
  if (aSize !== bSize) return aSize.localeCompare(bSize, undefined, { numeric: true });
  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

function currentStock(product: ProductWithStock | undefined) {
  return product ? getCurrentStock(product) : 0;
}

function categoryKey(product: ProductWithStock) {
  return product.sku.split("-")[0]?.trim().toUpperCase() || "OTHER";
}

function categoryLabel(key: string, ui: (typeof copy)[Language]) {
  if (key === "4LK") return ui.category4lk;
  if (key === "BLD") return ui.categoryBld;
  return key === "OTHER" ? "OTHER" : key;
}

function colorKey(product: ProductWithStock) {
  return product.sku.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase() ?? "OTHER";
}

function colorLabel(key: string, ui: (typeof copy)[Language]) {
  if (key === "WH") return ui.colorWhite;
  if (key === "BL") return ui.colorBlack;
  if (key === "GR") return ui.colorGray;
  if (key === "BE") return ui.colorBeige;
  return ui.colorOther;
}

function colorDotClass(key: string) {
  if (key === "WH") return "bg-stone-200 ring-1 ring-stone-300";
  if (key === "BL") return "bg-zinc-900";
  if (key === "GR") return "bg-slate-400";
  if (key === "BE") return "bg-[#c8b98d]";
  return "bg-slate-300";
}

function normalizeSize(size: string | null | undefined) {
  return (size ?? "").replace(/cm$/i, "").replace(/\s+/g, "").trim();
}

function baseSku(sku: string) {
  return sku.replace(/-(WH|BL|GR|BE)$/i, "");
}

function hasPrefix(memo: string | null, prefixes: string[]) {
  return prefixes.some((prefix) => memo?.startsWith(prefix));
}

function toDateString(value: string) {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function safeQuantity(value: number) {
  return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
}

function safeMoney(value: number) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Math.trunc(value).toLocaleString();
}
