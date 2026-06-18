"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Edit3,
  PackageSearch,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { activeProducts } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import { buildInventoryMetricsByProduct, classifyInventoryMovement, getComputedCurrentStock, getCurrentStock, type InventoryMetrics } from "@/lib/stock";
import { fetchAllStockMovements } from "@/lib/stock-movements";
import type { Product, ProductWithStock, StockMovement } from "@/lib/types";

type SalesMovement = Omit<StockMovement, "products"> & {
  products?: Pick<Product, "name" | "sku" | "color" | "size" | "sale_price"> | null;
};

type QuickFilter = "today" | "yesterday" | "last7" | "month" | "all" | "custom";

type SalesPayload = {
  product_id: string;
  type: "sale";
  quantity: number;
  happened_at: string;
  memo: string | null;
};

const KOREA_TIME_ZONE = "Asia/Seoul";

const copy = {
  zh: {
    title: "销售管理",
    subtitle: "记录每日 SKU 销售数量，自动汇总销售趋势与库存扣减依据。",
    todaySales: "今日销量",
    monthSales: "本月销量",
    soldSkuCount: "销售 SKU 数",
    latestDate: "最近记录日期",
    quickEntry: "快速录入销售",
    quickEntryHint: "选择 SKU 后会显示商品信息与当前库存，销售保存后自动作为库存扣减依据。",
    editEntry: "编辑销售记录",
    skuSearch: "SKU / 商品搜索",
    productSelect: "SKU / 商品选择",
    saleDate: "销售日期",
    quantity: "销售数量",
    memo: "备注",
    save: "保存销售记录",
    update: "更新销售记录",
    cancelEdit: "取消编辑",
    currentStock: "当前库存",
    saleableStock: "可售库存",
    color: "颜色",
    size: "尺寸",
    filterTitle: "筛选与搜索",
    startDate: "开始日期",
    endDate: "结束日期",
    keyword: "SKU / 商品名称",
    allColors: "全部颜色",
    allSizes: "全部尺寸",
    today: "今天",
    yesterday: "昨天",
    last7: "最近7天",
    thisMonth: "本月",
    all: "全部",
    reset: "重置筛选",
    summary: "销售汇总",
    rangeTotal: "筛选范围销量合计",
    recordCount: "筛选范围订单记录数",
    rangeSkuCount: "销售 SKU 数",
    dailyAverage: "日均销量",
    monthTotal: "本月累计销量",
    momChange: "环比上月变化",
    topOne: "TOP 1 销售 SKU",
    records: "销售记录",
    dateGroupHint: "默认展开最近 3 天，其他日期可手动展开查看。",
    sku: "SKU",
    productName: "商品名称",
    actions: "操作",
    edit: "编辑",
    delete: "删除",
    ranking: "SKU 销售排行榜",
    rank: "排名",
    ratio: "占比",
    emptyTitle: "暂无销售数据",
    emptyDesc: "请新增销售记录，或调整日期与搜索筛选条件。",
    noProduct: "请选择商品",
    noLatest: "暂无记录",
    successCreate: "销售记录已保存",
    successUpdate: "销售记录已更新",
    successDelete: "销售记录已删除",
    invalidDate: "开始日期不能晚于结束日期。",
    invalidQuantity: "销售数量必须为正整数。",
    requiredProduct: "请先选择 SKU。",
    confirmOverStock: "销售数量大于当前可售库存，是否继续保存？",
    confirmDelete: "确定要删除这条销售记录吗？删除后会恢复对应库存。",
    originalSaleMissing: "找不到原销售记录，请刷新后再试。",
    stockWarning: "库存不足提醒",
    top3: "热销",
    days: "天",
    loading: "正在加载销售数据..."
  },
  ko: {
    title: "판매 관리",
    subtitle: "일별 SKU 판매 수량을 기록하고 판매 추세와 재고 차감 기준을 자동 집계합니다.",
    todaySales: "오늘 판매량",
    monthSales: "이번 달 판매량",
    soldSkuCount: "판매 SKU 수",
    latestDate: "최근 기록일",
    quickEntry: "빠른 판매 입력",
    quickEntryHint: "SKU 선택 시 상품 정보와 현재 재고를 확인할 수 있으며 저장 후 재고 차감 기준으로 반영됩니다.",
    editEntry: "판매 기록 수정",
    skuSearch: "SKU / 상품 검색",
    productSelect: "SKU / 상품 선택",
    saleDate: "판매일",
    quantity: "판매 수량",
    memo: "비고",
    save: "판매 기록 저장",
    update: "판매 기록 업데이트",
    cancelEdit: "수정 취소",
    currentStock: "현재 재고",
    saleableStock: "판매 가능 재고",
    color: "색상",
    size: "사이즈",
    filterTitle: "필터 및 검색",
    startDate: "시작일",
    endDate: "종료일",
    keyword: "SKU / 상품명",
    allColors: "전체 색상",
    allSizes: "전체 사이즈",
    today: "오늘",
    yesterday: "어제",
    last7: "최근 7일",
    thisMonth: "이번 달",
    all: "전체",
    reset: "필터 초기화",
    summary: "판매 요약",
    rangeTotal: "선택 범위 판매량",
    recordCount: "선택 범위 기록 수",
    rangeSkuCount: "판매 SKU 수",
    dailyAverage: "일평균 판매량",
    monthTotal: "이번 달 누적 판매량",
    momChange: "전월 대비 변화",
    topOne: "TOP 1 판매 SKU",
    records: "판매 기록",
    dateGroupHint: "최근 3일은 기본 펼침이며 다른 날짜는 직접 펼쳐 확인할 수 있습니다.",
    sku: "SKU",
    productName: "상품명",
    actions: "작업",
    edit: "수정",
    delete: "삭제",
    ranking: "SKU 판매 랭킹",
    rank: "순위",
    ratio: "비중",
    emptyTitle: "판매 데이터가 없습니다",
    emptyDesc: "판매 기록을 추가하거나 날짜와 검색 조건을 변경해 주세요.",
    noProduct: "상품을 선택하세요",
    noLatest: "기록 없음",
    successCreate: "판매 기록이 저장되었습니다",
    successUpdate: "판매 기록이 업데이트되었습니다",
    successDelete: "판매 기록이 삭제되었습니다",
    invalidDate: "시작일은 종료일보다 늦을 수 없습니다.",
    invalidQuantity: "판매 수량은 양의 정수여야 합니다.",
    requiredProduct: "먼저 SKU를 선택해 주세요.",
    confirmOverStock: "판매 수량이 현재 판매 가능 재고보다 큽니다. 계속 저장할까요?",
    confirmDelete: "이 판매 기록을 삭제하시겠습니까? 삭제 후 해당 재고가 복구됩니다.",
    originalSaleMissing: "원본 판매 기록을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.",
    stockWarning: "재고 부족 알림",
    top3: "인기",
    days: "일",
    loading: "판매 데이터를 불러오는 중..."
  }
};

export default function SalesPage() {
  return (
    <AppShell>
      <SalesContent />
    </AppShell>
  );
}

function SalesContent() {
  const { language, t, formatDate, formatNumber } = useLanguage();
  const text = copy[language];
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [stockMetrics, setStockMetrics] = useState<Map<string, InventoryMetrics>>(new Map());
  const [sales, setSales] = useState<SalesMovement[]>([]);
  const [form, setForm] = useState({ product_id: "", sale_date: todayKst(), quantity: "1", memo: "" });
  const [productQuery, setProductQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    startDate: dateOffset(todayKst(), -6),
    endDate: todayKst(),
    keyword: "",
    color: "",
    size: "",
    quick: "last7" as QuickFilter
  });

  const usableProducts = useMemo(() => activeProducts(products), [products]);
  const selectedProduct = usableProducts.find((product) => product.id === form.product_id);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: productRows, error: productError }, { data: movementRows, error: movementError }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      fetchAllStockMovements<SalesMovement>("*, products(name, sku, color, size, sale_price)")
    ]);

    if (productError || movementError) {
      setMessage({ type: "error", text: productError?.message ?? movementError?.message ?? "" });
    }

    const productData = (productRows ?? []) as ProductWithStock[];
    const visibleProducts = activeProducts(productData);
    const visibleProductIds = new Set(visibleProducts.map((product) => product.id));

    setProducts(productData);
    setSales(((movementRows ?? []) as SalesMovement[]).filter((sale) => visibleProductIds.has(sale.product_id) && classifyInventoryMovement(sale) === "sale"));
    setStockMetrics(buildInventoryMetricsByProduct((movementRows ?? []).filter((movement) => visibleProductIds.has(movement.product_id))));
    setLoading(false);
  }

  const productMap = useMemo(() => new Map(usableProducts.map((product) => [product.id, product])), [usableProducts]);

  const filteredProductOptions = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    return usableProducts
      .filter((product) => {
        if (!query) return true;
        return `${product.sku} ${product.name} ${product.color ?? ""} ${product.size ?? ""}`.toLowerCase().includes(query);
      })
      .sort(compareProductsForSales);
  }, [productQuery, usableProducts]);

  const filteredProductGroups = useMemo(() => {
    const groups = new Map<string, ProductWithStock[]>();
    filteredProductOptions.forEach((product) => {
      const groupKey = `${categoryKey(product)}-${colorKey(product)}`;
      const group = groups.get(groupKey) ?? [];
      group.push(product);
      groups.set(groupKey, group);
    });

    return Array.from(groups.entries()).sort(([groupA, productsA], [groupB, productsB]) => {
      const categoryDiff = categoryKey(productsA[0]).localeCompare(categoryKey(productsB[0]), undefined, { numeric: true });
      if (categoryDiff !== 0) return categoryDiff;
      const colorDiff = colorSortIndex(productsA[0]) - colorSortIndex(productsB[0]);
      if (colorDiff !== 0) return colorDiff;
      return groupA.localeCompare(groupB);
    });
  }, [filteredProductOptions]);

  const filterOptions = useMemo(() => {
    const colors = uniqueSorted(usableProducts.map((product) => localizedColor(product, language)));
    const sizes = uniqueSorted(usableProducts.map((product) => normalizeSize(product.size)));
    return { colors, sizes };
  }, [language, usableProducts]);

  const filteredSales = useMemo(() => {
    const start = filters.startDate;
    const end = filters.endDate;
    const keyword = filters.keyword.trim().toLowerCase();

    return sales.filter((sale) => {
      const saleDate = dateKey(sale.happened_at);
      const product = productMap.get(sale.product_id);
      const color = localizedColor(product ?? sale.products, language);
      const size = normalizeSize(product?.size ?? sale.products?.size ?? "");

      if (start && saleDate < start) return false;
      if (end && saleDate > end) return false;
      if (filters.color && color !== filters.color) return false;
      if (filters.size && size !== filters.size) return false;
      if (keyword) {
        const haystack = `${sale.products?.sku ?? product?.sku ?? ""} ${sale.products?.name ?? product?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }, [filters, language, productMap, sales]);

  const pageMetrics = useMemo(() => calculatePageMetrics(sales, usableProducts), [sales, usableProducts]);
  const summary = useMemo(() => calculateSummary(filteredSales), [filteredSales]);
  const monthExtra = useMemo(() => calculateMonthExtra(sales), [sales]);
  const rankings = useMemo(() => calculateRankings(filteredSales, productMap), [filteredSales, productMap]);
  const salesGroups = useMemo(() => groupSalesByDate(filteredSales), [filteredSales]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    if (!form.product_id) {
      setMessage({ type: "error", text: text.requiredProduct });
      return;
    }

    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMessage({ type: "error", text: text.invalidQuantity });
      return;
    }

    const original = editingId ? sales.find((sale) => sale.id === editingId) : null;
    const currentStock = safeStock(productMap.get(form.product_id), stockMetrics);
    const availableForCheck = original?.product_id === form.product_id ? currentStock + original.quantity : currentStock;
    if (quantity > availableForCheck && !window.confirm(text.confirmOverStock)) return;

    setSaving(true);
    const payload: SalesPayload = {
      product_id: form.product_id,
      type: "sale",
      quantity,
      happened_at: koreaNoonIso(form.sale_date),
      memo: form.memo.trim() || null
    };

    const result = editingId
      ? await updateSale(editingId, payload)
      : await supabase.from("stock_movements").insert({ user_id: auth.user.id, ...payload });

    const error = result && "error" in result ? result.error : result;

    if (error) {
      setMessage({ type: "error", text: String(error.message ?? error) });
      setSaving(false);
      return;
    }

    setMessage({ type: "success", text: editingId ? text.successUpdate : text.successCreate });
    setEditingId(null);
    setForm({ product_id: "", sale_date: todayKst(), quantity: "1", memo: "" });
    setProductQuery("");
    await load();
    setSaving(false);
  }

  async function updateSale(id: string, payload: SalesPayload) {
    const original = sales.find((sale) => sale.id === id);
    if (!original) return { message: text.originalSaleMissing };

    const originalDate = dateKey(original.happened_at);
    const nextDate = dateKey(payload.happened_at);

    const { error: movementError } = await supabase.from("stock_movements").update(payload).eq("id", id);
    if (movementError) return movementError;

    const stockError = await adjustStockForSaleChange(original, payload);
    if (stockError) return stockError;

    const removeError = await changeSalesDaily(original.product_id, originalDate, -original.quantity);
    if (removeError) return removeError;

    const addError = await changeSalesDaily(payload.product_id, nextDate, payload.quantity);
    if (addError) return addError;

    return null;
  }

  async function adjustStockForSaleChange(original: SalesMovement, payload: Pick<SalesPayload, "product_id" | "quantity">) {
    if (original.product_id === payload.product_id) {
      const product = productMap.get(payload.product_id);
      return upsertStock(payload.product_id, Math.max(0, safeStock(product, stockMetrics) + original.quantity - payload.quantity));
    }

    const oldProduct = productMap.get(original.product_id);
    const newProduct = productMap.get(payload.product_id);
    const oldError = await upsertStock(original.product_id, Math.max(0, safeStock(oldProduct, stockMetrics) + original.quantity));
    if (oldError) return oldError;

    return upsertStock(payload.product_id, Math.max(0, safeStock(newProduct, stockMetrics) - payload.quantity));
  }

  async function upsertStock(productId: string, value: number) {
    const { error } = await supabase
      .from("inventory_balances")
      .upsert(
        { product_id: productId, current_stock: Math.trunc(value), updated_at: new Date().toISOString() },
        { onConflict: "product_id" }
      );
    return error;
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

  async function deleteSale(sale: SalesMovement) {
    if (!window.confirm(text.confirmDelete)) return;

    setSaving(true);
    const product = productMap.get(sale.product_id);
    const stockError = await upsertStock(sale.product_id, Math.max(0, safeStock(product, stockMetrics) + sale.quantity));
    if (stockError) {
      setMessage({ type: "error", text: stockError.message });
      setSaving(false);
      return;
    }

    const dailyError = await changeSalesDaily(sale.product_id, dateKey(sale.happened_at), -sale.quantity);
    if (dailyError) {
      setMessage({ type: "error", text: dailyError.message });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("stock_movements").delete().eq("id", sale.id);
    if (error) {
      setMessage({ type: "error", text: error.message });
      setSaving(false);
      return;
    }

    if (editingId === sale.id) cancelEdit();
    setMessage({ type: "success", text: text.successDelete });
    await load();
    setSaving(false);
  }

  function startEdit(sale: SalesMovement) {
    setEditingId(sale.id);
    setMessage(null);
    setForm({
      product_id: sale.product_id,
      sale_date: dateKey(sale.happened_at),
      quantity: String(sale.quantity),
      memo: sale.memo ?? ""
    });
    setProductQuery(sale.products?.sku ?? productMap.get(sale.product_id)?.sku ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ product_id: "", sale_date: todayKst(), quantity: "1", memo: "" });
    setProductQuery("");
    setMessage(null);
  }

  function setQuickRange(quick: QuickFilter) {
    const today = todayKst();
    if (quick === "today") setFilters((current) => ({ ...current, quick, startDate: today, endDate: today }));
    if (quick === "yesterday") {
      const yesterday = dateOffset(today, -1);
      setFilters((current) => ({ ...current, quick, startDate: yesterday, endDate: yesterday }));
    }
    if (quick === "last7") setFilters((current) => ({ ...current, quick, startDate: dateOffset(today, -6), endDate: today }));
    if (quick === "month") setFilters((current) => ({ ...current, quick, startDate: monthStart(today), endDate: today }));
    if (quick === "all") setFilters((current) => ({ ...current, quick, startDate: "", endDate: "" }));
  }

  function updateDateFilter(field: "startDate" | "endDate", value: string) {
    const next = { ...filters, [field]: value, quick: "custom" as QuickFilter };
    if (next.startDate && next.endDate && next.startDate > next.endDate) {
      setMessage({ type: "error", text: text.invalidDate });
    } else {
      setMessage(null);
    }
    setFilters(next);
  }

  function resetFilters() {
    setFilters({ startDate: dateOffset(todayKst(), -6), endDate: todayKst(), keyword: "", color: "", size: "", quick: "last7" });
  }

  function toggleGroup(key: string, defaultExpanded: boolean) {
    if (defaultExpanded) {
      setCollapsedDates((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }

    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const invalidDateRange = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted">Sales Operation</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{text.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{text.subtitle}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniKpi icon={<ShoppingCart size={18} />} label={text.todaySales} value={formatNumber(pageMetrics.todayQty)} />
          <MiniKpi icon={<TrendingUp size={18} />} label={text.monthSales} value={formatNumber(pageMetrics.monthQty)} />
          <MiniKpi icon={<PackageSearch size={18} />} label={text.soldSkuCount} value={formatNumber(pageMetrics.skuCount)} />
          <MiniKpi icon={<CalendarDays size={18} />} label={text.latestDate} value={pageMetrics.latestDate ? formatDate(pageMetrics.latestDate) : text.noLatest} />
        </div>
      </section>

      <section className="erp-card overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Quick Entry</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{editingId ? text.editEntry : text.quickEntry}</h2>
            <p className="mt-1 text-sm text-muted">{text.quickEntryHint}</p>
          </div>
          {editingId ? (
            <button className="erp-button-subtle inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" type="button" onClick={cancelEdit}>
              <RotateCcw size={16} />
              {text.cancelEdit}
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.1fr_1.4fr_0.8fr_0.7fr_1fr_auto]">
            <Field label={text.skuSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input
                  className="w-full pl-9"
                  placeholder={text.keyword}
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                />
              </div>
            </Field>
            <Field label={text.productSelect}>
              <select
                className="w-full"
                value={form.product_id}
                required
                onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}
              >
                <option value="">{text.noProduct}</option>
                {filteredProductGroups.map(([groupKey, group]) => (
                  <optgroup key={groupKey} label={`${productGroupLabel(group[0], language, t)} (${group.length})`}>
                    {group.map((product) => (
                      <option key={product.id} value={product.id}>
                        {productOptionLabel(product)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label={text.saleDate}>
              <input className="w-full" type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
            </Field>
            <Field label={text.quantity}>
              <input
                className="w-full text-right tabular-nums"
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label={text.memo}>
              <input className="w-full" placeholder={text.memo} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <button className="erp-button-primary inline-flex h-[42px] w-full items-center justify-center gap-2 px-5 text-sm font-bold disabled:opacity-60" disabled={saving}>
                <Save size={16} />
                {saving ? "..." : editingId ? text.update : text.save}
              </button>
            </div>
          </div>

          <ProductPreview product={selectedProduct} text={text} language={language} stockMetrics={stockMetrics} />
        </form>

        {message ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
              message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}
      </section>

      <section className="erp-card p-5">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Filters</p>
            <h2 className="mt-1 text-xl font-bold">{text.filterTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["today", "yesterday", "last7", "month", "all"] as QuickFilter[]).map((quick) => (
              <button
                key={quick}
                className={`px-3 py-2 text-sm font-semibold ${
                  filters.quick === quick ? "erp-button-primary" : "erp-button-subtle hover:border-[var(--color-primary)]"
                }`}
                type="button"
                onClick={() => setQuickRange(quick)}
              >
                {quickLabel(quick, text)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-6">
          <Field label={text.startDate}>
            <input className="w-full" type="date" value={filters.startDate} onChange={(event) => updateDateFilter("startDate", event.target.value)} />
          </Field>
          <Field label={text.endDate}>
            <input className="w-full" type="date" value={filters.endDate} onChange={(event) => updateDateFilter("endDate", event.target.value)} />
          </Field>
          <Field label={text.keyword}>
            <input
              className="w-full"
              placeholder={text.keyword}
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            />
          </Field>
          <Field label={text.color}>
            <select className="w-full" value={filters.color} onChange={(event) => setFilters((current) => ({ ...current, color: event.target.value }))}>
              <option value="">{text.allColors}</option>
              {filterOptions.colors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text.size}>
            <select className="w-full" value={filters.size} onChange={(event) => setFilters((current) => ({ ...current, size: event.target.value }))}>
              <option value="">{text.allSizes}</option>
              {filterOptions.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button className="erp-button-subtle flex h-[42px] w-full items-center justify-center gap-2 px-4 text-sm font-semibold" type="button" onClick={resetFilters}>
              <RotateCcw size={16} />
              {text.reset}
            </button>
          </div>
        </div>

        {invalidDateRange ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{text.invalidDate}</div> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={text.rangeTotal} value={formatNumber(summary.totalQty)} />
        <SummaryCard label={text.recordCount} value={formatNumber(summary.recordCount)} />
        <SummaryCard label={text.rangeSkuCount} value={formatNumber(summary.skuCount)} />
        <SummaryCard label={text.dailyAverage} value={formatDecimal(summary.dailyAverage)} />
        {filters.quick === "month" ? (
          <>
            <SummaryCard label={text.monthTotal} value={formatNumber(monthExtra.monthQty)} />
            <SummaryCard label={text.momChange} value={formatPercent(monthExtra.momChange)} tone={monthExtra.momChange >= 0 ? "good" : "bad"} />
            <SummaryCard label={text.topOne} value={monthExtra.topSku || "-"} />
          </>
        ) : null}
      </section>

      <section className="erp-card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">SKU Ranking</p>
            <h2 className="text-2xl font-bold text-ink">{text.ranking}</h2>
          </div>
          <div className="erp-chip px-3 py-1 text-sm font-semibold">{formatNumber(rankings.length)} SKU</div>
        </div>

        {rankings.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted">
                  <TableHead>{text.rank}</TableHead>
                  <TableHead>{text.sku}</TableHead>
                  <TableHead>{text.productName}</TableHead>
                  <TableHead>{text.color}</TableHead>
                  <TableHead>{text.size}</TableHead>
                  <TableHead align="right">{text.quantity}</TableHead>
                  <TableHead>{text.ratio}</TableHead>
                </tr>
              </thead>
              <tbody>
                {rankings.map((item, index) => (
                  <tr key={item.productId} className="border-t border-line/70 transition hover:bg-[rgba(23,72,63,0.035)]">
                    <TableCell>
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-[var(--color-primary)] text-white" : "bg-white text-muted"}`}>
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-primary)]">{item.sku}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-ink">{item.name}</div>
                      {index < 3 ? <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">{text.top3}</div> : null}
                    </TableCell>
                    <TableCell>{item.color}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell align="right">
                      <span className="tabular-nums text-base font-bold">{formatNumber(item.quantity)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(23,72,63,0.08)]">
                          <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${item.ratio}%` }} />
                        </div>
                        <span className="w-14 text-right tabular-nums text-xs font-bold">{item.ratio.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={text.emptyTitle} desc={text.emptyDesc} compact />
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Sales Records</p>
            <h2 className="text-2xl font-bold text-ink">{text.records}</h2>
            <p className="mt-1 text-sm text-muted">{text.dateGroupHint}</p>
          </div>
        </div>

        {loading ? <LoadingCard text={text.loading} /> : null}

        {!loading && !filteredSales.length ? <EmptyState title={text.emptyTitle} desc={text.emptyDesc} /> : null}

        {!loading && salesGroups.length ? (
          <div className="space-y-4">
            {salesGroups.map((group, index) => {
              const defaultExpanded = index < 3;
              const expanded = defaultExpanded ? !collapsedDates.has(group.key) : expandedDates.has(group.key);
              return (
                <div key={group.key} className="erp-card overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[rgba(23,72,63,0.04)]"
                    type="button"
                    onClick={() => toggleGroup(group.key, defaultExpanded)}
                  >
                    <div>
                      <h3 className="text-lg font-bold text-ink">{formatDate(`${group.key}T12:00:00+09:00`)}</h3>
                      <p className="mt-1 text-xs text-muted">
                        {formatNumber(group.totalQty)} · {formatNumber(group.skuCount)} SKU
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="erp-chip px-3 py-1 text-sm font-semibold">{formatNumber(group.sales.length)}</span>
                      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {expanded ? (
                    <div className="overflow-x-auto px-4 pb-4">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted">
                            <TableHead>{text.saleDate}</TableHead>
                            <TableHead>{text.sku}</TableHead>
                            <TableHead>{text.productName}</TableHead>
                            <TableHead>{text.color}</TableHead>
                            <TableHead>{text.size}</TableHead>
                            <TableHead align="center">{text.quantity}</TableHead>
                            <TableHead>{text.memo}</TableHead>
                            <TableHead align="right">{text.actions}</TableHead>
                          </tr>
                        </thead>
                        <tbody>
                          {group.sales.map((sale) => {
                            const product = productMap.get(sale.product_id);
                            return (
                              <tr key={sale.id} className="group border-t border-line/70 transition hover:bg-[rgba(23,72,63,0.035)]">
                                <TableCell>{formatDate(sale.happened_at)}</TableCell>
                                <TableCell>
                                  <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-primary)]">
                                    {sale.products?.sku ?? product?.sku}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[360px] truncate font-semibold text-ink" title={sale.products?.name ?? product?.name}>
                                    {sale.products?.name ?? product?.name}
                                  </div>
                                </TableCell>
                                <TableCell>{localizedColor(product ?? sale.products, language)}</TableCell>
                                <TableCell>{normalizeSize(product?.size ?? sale.products?.size ?? "")}</TableCell>
                                <TableCell align="center">
                                  <span className="tabular-nums text-base font-bold">{formatNumber(sale.quantity)}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="block max-w-[260px] truncate text-muted" title={sale.memo ?? ""}>
                                    {sale.memo || "-"}
                                  </span>
                                </TableCell>
                                <TableCell align="right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                                      type="button"
                                      onClick={() => startEdit(sale)}
                                    >
                                      <Edit3 size={13} />
                                      {text.edit}
                                    </button>
                                    <button
                                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                                      type="button"
                                      onClick={() => deleteSale(sale)}
                                    >
                                      <Trash2 size={13} />
                                      {text.delete}
                                    </button>
                                  </div>
                                </TableCell>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

function MiniKpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="erp-card min-w-[160px] p-4 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-md">{icon}</div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-ink";
  return (
    <div className="erp-card p-4 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function ProductPreview({
  product,
  text,
  language,
  stockMetrics
}: {
  product: ProductWithStock | undefined;
  text: (typeof copy)["zh"];
  language: "zh" | "ko";
  stockMetrics: Map<string, InventoryMetrics>;
}) {
  if (!product) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/55 px-4 py-3 text-sm text-muted">
        {text.noProduct}
      </div>
    );
  }

  const stock = getComputedCurrentStock(product, stockMetrics);
  return (
    <div className="rounded-2xl border border-line bg-white/70 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--color-primary)]">{product.sku}</p>
          <p className="mt-1 text-base font-semibold text-ink">{product.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PreviewBadge label={text.color} value={localizedColor(product, language)} />
          <PreviewBadge label={text.size} value={normalizeSize(product.size)} />
          <PreviewBadge label={text.currentStock} value={String(stock)} tone={stock < 10 ? "bad" : stock < 20 ? "warn" : "good"} />
          <PreviewBadge label={text.saleableStock} value={String(stock)} tone={stock < 10 ? "bad" : stock < 20 ? "warn" : "good"} />
        </div>
      </div>
    </div>
  );
}

function PreviewBadge({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const className =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-yellow-200 bg-yellow-50 text-yellow-800"
        : tone === "bad"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-line bg-white text-muted";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${className}`}>
      <span>{label}</span>
      <span className="font-bold text-ink">{value || "-"}</span>
    </span>
  );
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "center" | "right" }) {
  return <th className={`bg-white/70 px-4 py-3 font-bold ${alignClass(align)}`}>{children}</th>;
}

function TableCell({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "center" | "right" }) {
  return <td className={`px-4 py-3 align-middle ${alignClass(align)}`}>{children}</td>;
}

function EmptyState({ title, desc, compact = false }: { title: string; desc: string; compact?: boolean }) {
  return (
    <div className={`erp-card flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        <ClipboardList size={22} />
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted">{desc}</p>
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="erp-card animate-pulse p-6">
      <div className="h-4 w-40 rounded bg-[rgba(23,72,63,0.08)]" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="h-16 rounded-2xl bg-[rgba(23,72,63,0.08)]" />
        <div className="h-16 rounded-2xl bg-[rgba(23,72,63,0.08)]" />
        <div className="h-16 rounded-2xl bg-[rgba(23,72,63,0.08)]" />
      </div>
      <p className="mt-4 text-sm text-muted">{text}</p>
    </div>
  );
}

function calculatePageMetrics(sales: SalesMovement[], products: ProductWithStock[]) {
  const today = todayKst();
  const month = today.slice(0, 7);
  const todayQty = sales.filter((sale) => dateKey(sale.happened_at) === today).reduce((sum, sale) => sum + sale.quantity, 0);
  const monthQty = sales.filter((sale) => dateKey(sale.happened_at).startsWith(month)).reduce((sum, sale) => sum + sale.quantity, 0);
  const skuCount = new Set(sales.map((sale) => sale.product_id)).size;
  const latestDate = sales[0]?.happened_at ?? "";

  return {
    todayQty,
    monthQty,
    skuCount: skuCount || products.length,
    latestDate
  };
}

function calculateSummary(sales: SalesMovement[]) {
  const totalQty = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const recordCount = sales.length;
  const skuCount = new Set(sales.map((sale) => sale.product_id)).size;
  const saleDays = new Set(sales.filter((sale) => sale.quantity > 0).map((sale) => dateKey(sale.happened_at))).size;

  return {
    totalQty,
    recordCount,
    skuCount,
    dailyAverage: saleDays ? totalQty / saleDays : 0
  };
}

function calculateMonthExtra(sales: SalesMovement[]) {
  const today = todayKst();
  const month = today.slice(0, 7);
  const previousMonth = monthStart(dateOffset(monthStart(today), -1)).slice(0, 7);
  const monthSales = sales.filter((sale) => dateKey(sale.happened_at).startsWith(month));
  const prevSales = sales.filter((sale) => dateKey(sale.happened_at).startsWith(previousMonth));
  const monthQty = monthSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const prevQty = prevSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const topSku = calculateRankings(monthSales, new Map())[0]?.sku ?? "";

  return {
    monthQty,
    momChange: prevQty ? ((monthQty - prevQty) / prevQty) * 100 : monthQty ? 100 : 0,
    topSku
  };
}

function calculateRankings(sales: SalesMovement[], productMap: Map<string, ProductWithStock>) {
  const grouped = new Map<string, { productId: string; sku: string; name: string; color: string; size: string; quantity: number }>();
  const total = sales.reduce((sum, sale) => sum + sale.quantity, 0);

  for (const sale of sales) {
    const product = productMap.get(sale.product_id);
    const current = grouped.get(sale.product_id) ?? {
      productId: sale.product_id,
      sku: sale.products?.sku ?? product?.sku ?? "-",
      name: sale.products?.name ?? product?.name ?? "-",
      color: sale.products?.color ?? product?.color ?? "-",
      size: normalizeSize(sale.products?.size ?? product?.size ?? ""),
      quantity: 0
    };
    current.quantity += sale.quantity;
    grouped.set(sale.product_id, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
    .map((item) => ({ ...item, ratio: total ? (item.quantity / total) * 100 : 0 }));
}

function groupSalesByDate(sales: SalesMovement[]) {
  const sortedSales = [...sales].sort((a, b) => new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime());
  const groups = new Map<string, SalesMovement[]>();

  for (const sale of sortedSales) {
    const key = dateKey(sale.happened_at);
    groups.set(key, [...(groups.get(key) ?? []), sale]);
  }

  return Array.from(groups.entries()).map(([key, groupSales]) => ({
    key,
    sales: groupSales,
    totalQty: groupSales.reduce((sum, sale) => sum + sale.quantity, 0),
    skuCount: new Set(groupSales.map((sale) => sale.product_id)).size
  }));
}

function safeStock(product: ProductWithStock | undefined, stockMetrics: Map<string, InventoryMetrics>) {
  return product ? getComputedCurrentStock(product, stockMetrics) : 0;
}

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function dateOffset(date: string, offset: number) {
  const next = new Date(`${date}T12:00:00+09:00`);
  next.setDate(next.getDate() + offset);
  return dateKey(next.toISOString());
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function koreaNoonIso(date: string) {
  return new Date(`${date}T12:00:00+09:00`).toISOString();
}

function quickLabel(quick: QuickFilter, text: (typeof copy)["zh"]) {
  if (quick === "today") return text.today;
  if (quick === "yesterday") return text.yesterday;
  if (quick === "last7") return text.last7;
  if (quick === "month") return text.thisMonth;
  return text.all;
}

function productOptionLabel(product: ProductWithStock) {
  return `${normalizeSize(product.size)} · ${product.sku} · ${product.name}`;
}

function productGroupLabel(product: ProductWithStock, language: "zh" | "ko", t: ReturnType<typeof useLanguage>["t"]) {
  return `${categoryLabel(categoryKey(product), t)} / ${localizedColor(product, language)}`;
}

function categoryKey(product: Pick<Product, "sku"> | null | undefined) {
  return product?.sku?.split("-")[0]?.trim().toUpperCase() || "OTHER";
}

function categoryLabel(key: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (key === "4LK") return t("category.4lk");
  if (key === "BLD") return t("category.bld");
  if (key === "BZG") return t("category.bzg");
  return key === "OTHER" ? "OTHER" : key;
}

function colorKey(product: Pick<Product, "sku"> | null | undefined) {
  return product?.sku?.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase() ?? "OTHER";
}

function localizedColor(product: Pick<Product, "sku" | "color"> | null | undefined, language: "zh" | "ko") {
  const suffix = colorKey(product);
  const labels = {
    zh: { WH: "白色", BL: "黑色", GR: "灰色", BE: "米色" },
    ko: { WH: "화이트", BL: "블랙", GR: "그레이", BE: "베이지" }
  };
  if (suffix && suffix in labels[language]) return labels[language][suffix as keyof (typeof labels)["zh"]];
  return product?.color || "-";
}

function normalizeSize(size: string | null | undefined) {
  return String(size ?? "").replace(/cm$/i, "").replace(/\s+/g, "").trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function compareProductsForSales(a: ProductWithStock, b: ProductWithStock) {
  const sizeDiff = normalizeSize(a.size).localeCompare(normalizeSize(b.size), undefined, { numeric: true });
  if (sizeDiff !== 0) return sizeDiff;
  const colorDiff = colorSortIndex(a) - colorSortIndex(b);
  if (colorDiff !== 0) return colorDiff;
  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

function colorSortIndex(product: Pick<Product, "sku">) {
  const suffix = product.sku?.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase();
  const order: Record<string, number> = { WH: 0, BL: 1, GR: 2, BE: 3 };
  return suffix ? order[suffix] ?? 99 : 99;
}

function alignClass(align: "left" | "center" | "right") {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function formatDecimal(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
