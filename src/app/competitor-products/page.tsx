"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Flame,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  Star,
  Store,
  Target,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

type ProductStatus = "watching" | "key_competitor" | "best_reference" | "eliminated";
type RocketType = "normal" | "rocket_delivery" | "rocket_growth" | "seller_rocket" | "orange_rocket";
type FollowPriority = "high" | "medium" | "low";
type DrawerMode = "create" | "quick" | "edit" | "view" | null;

type CompetitorRow = {
  id: string;
  platform: string;
  product_url: string;
  product_id: string | null;
  product_name: string;
  brand: string | null;
  seller_name: string | null;
  main_image_url: string | null;
  category: string | null;
  collected_at: string;
  last_checked_at: string | null;
  product_status: ProductStatus;
  current_price: number;
  original_price: number;
  discount_rate: number;
  monthly_sales_text: string | null;
  review_count: number;
  rating: number;
  rocket_type: RocketType;
  shipping_fee: number;
  delivery_time: string | null;
  product_series: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  installation_method: string | null;
  package_contents: string | null;
  unit_weight: string | null;
  package_size: string | null;
  option_count: number;
  title_keywords: string | null;
  main_image_selling_points: string | null;
  detail_page_selling_points: string | null;
  price_advantage: string | null;
  positive_review_points: string | null;
  negative_review_points: string | null;
  purchase_reasons: string | null;
  learnings: string | null;
  risks: string | null;
  matched_our_sku: string | null;
  our_price: number;
  competitor_price: number;
  price_gap: number | null;
  our_advantages: string | null;
  our_disadvantages: string | null;
  worth_following: boolean;
  follow_priority: FollowPriority;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  platform: string;
  product_url: string;
  product_id: string;
  product_name: string;
  brand: string;
  seller_name: string;
  main_image_url: string;
  category: string;
  collected_at: string;
  last_checked_at: string;
  product_status: ProductStatus;
  current_price: string;
  original_price: string;
  discount_rate: string;
  monthly_sales_text: string;
  review_count: string;
  rating: string;
  rocket_type: RocketType;
  shipping_fee: string;
  delivery_time: string;
  product_series: string;
  size: string;
  color: string;
  material: string;
  installation_method: string;
  package_contents: string;
  unit_weight: string;
  package_size: string;
  option_count: string;
  title_keywords: string;
  main_image_selling_points: string;
  detail_page_selling_points: string;
  price_advantage: string;
  positive_review_points: string;
  negative_review_points: string;
  purchase_reasons: string;
  learnings: string;
  risks: string;
  matched_our_sku: string;
  our_price: string;
  competitor_price: string;
  our_advantages: string;
  our_disadvantages: string;
  worth_following: boolean;
  follow_priority: FollowPriority;
  notes: string;
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const pageSize = 12;
const statusOptions: ProductStatus[] = ["watching", "key_competitor", "best_reference", "eliminated"];
const rocketOptions: RocketType[] = ["normal", "rocket_delivery", "rocket_growth", "seller_rocket", "orange_rocket"];
const priorityOptions: FollowPriority[] = ["high", "medium", "low"];

const emptyForm: FormState = {
  platform: "Coupang",
  product_url: "",
  product_id: "",
  product_name: "",
  brand: "",
  seller_name: "",
  main_image_url: "",
  category: "",
  collected_at: today(),
  last_checked_at: today(),
  product_status: "watching",
  current_price: "",
  original_price: "",
  discount_rate: "",
  monthly_sales_text: "",
  review_count: "",
  rating: "",
  rocket_type: "normal",
  shipping_fee: "",
  delivery_time: "",
  product_series: "",
  size: "",
  color: "",
  material: "",
  installation_method: "",
  package_contents: "",
  unit_weight: "",
  package_size: "",
  option_count: "",
  title_keywords: "",
  main_image_selling_points: "",
  detail_page_selling_points: "",
  price_advantage: "",
  positive_review_points: "",
  negative_review_points: "",
  purchase_reasons: "",
  learnings: "",
  risks: "",
  matched_our_sku: "",
  our_price: "",
  competitor_price: "",
  our_advantages: "",
  our_disadvantages: "",
  worth_following: false,
  follow_priority: "medium",
  notes: ""
};

const text = {
  zh: {
    title: "竞品商品采集库",
    eyebrow: "COMPETITOR PRODUCT LIBRARY",
    subtitle: "保存 Coupang 竞品、爆款、相似商品和参考页面的核心资料，沉淀成可搜索、可分析、可复盘的韩国市场商品数据库。",
    add: "新增竞品",
    quick: "快速采集",
    edit: "编辑竞品",
    view: "竞品详情",
    empty: "暂无竞品商品，请点击快速采集或新增竞品开始记录。",
    databaseHint: "数据库表尚未创建：请在 Supabase SQL Editor 执行 supabase/migrations/create-competitor-product-library.sql。",
    kpi: { total: "已采集商品数", key: "重点竞品数", best: "爆款参考数", avgPrice: "平均售价", avgRating: "平均评分" },
    filter: { title: "筛选搜索", search: "搜索商品名 / 品牌 / 店铺 / 链接", category: "全部品类", status: "全部状态", rocket: "全部 Rocket", minPrice: "最低价", maxPrice: "最高价", minRating: "最低评分", start: "采集开始", end: "采集结束", reset: "重置筛选" },
    table: { product: "商品", category: "品类", brand: "品牌/店铺", price: "当前售价", sales: "月销量", reviews: "评论", rating: "评分", rocket: "Rocket", status: "状态", matched: "对标 SKU", priority: "优先级", updated: "最后更新", actions: "操作" },
    sections: { basic: "商品基础信息", sales: "销售与价格数据", specs: "产品规格", selling: "页面卖点分析", benchmark: "对标我方 SKU", notes: "备注" },
    status: { watching: "观察中", key_competitor: "重点竞品", best_reference: "爆款参考", eliminated: "已淘汰" },
    rocket: { normal: "普通", rocket_delivery: "로켓배송", rocket_growth: "로켓그로스", seller_rocket: "판매자로켓", orange_rocket: "橙色火箭" },
    priority: { high: "高", medium: "中", low: "低" },
    actions: { save: "保存", cancel: "取消", close: "关闭", edit: "编辑", copy: "复制", delete: "删除", open: "打开链接", view: "查看" }
  },
  ko: {
    title: "경쟁 상품 수집库",
    eyebrow: "COMPETITOR PRODUCT LIBRARY",
    subtitle: "Coupang 경쟁 상품, 인기 상품, 유사 상품, 참고 페이지의 핵심 정보를 저장해 검색과 분석이 가능한 한국 시장 상품 데이터베이스로 축적합니다.",
    add: "경쟁 상품 추가",
    quick: "빠른 수집",
    edit: "경쟁 상품 수정",
    view: "경쟁 상품 상세",
    empty: "경쟁 상품이 없습니다. 빠른 수집 또는 경쟁 상품 추가로 기록을 시작하세요.",
    databaseHint: "데이터베이스 테이블이 없습니다. Supabase SQL Editor에서 supabase/migrations/create-competitor-product-library.sql을 실행하세요.",
    kpi: { total: "수집 상품 수", key: "핵심 경쟁상품", best: "인기 참고상품", avgPrice: "평균 판매가", avgRating: "평균 평점" },
    filter: { title: "검색 필터", search: "상품명 / 브랜드 / 스토어 / 링크 검색", category: "전체 카테고리", status: "전체 상태", rocket: "전체 Rocket", minPrice: "최저가", maxPrice: "최고가", minRating: "최저 평점", start: "수집 시작", end: "수집 종료", reset: "필터 초기화" },
    table: { product: "상품", category: "카테고리", brand: "브랜드/스토어", price: "현재가", sales: "월 판매", reviews: "리뷰", rating: "평점", rocket: "Rocket", status: "상태", matched: "대응 SKU", priority: "우선순위", updated: "최근 업데이트", actions: "작업" },
    sections: { basic: "상품 기본 정보", sales: "판매 및 가격 데이터", specs: "상품 규격", selling: "페이지 셀링포인트 분석", benchmark: "자사 SKU 비교", notes: "메모" },
    status: { watching: "관찰중", key_competitor: "핵심 경쟁상품", best_reference: "인기 참고", eliminated: "제외" },
    rocket: { normal: "일반", rocket_delivery: "로켓배송", rocket_growth: "로켓그로스", seller_rocket: "판매자로켓", orange_rocket: "오렌지 로켓" },
    priority: { high: "높음", medium: "중간", low: "낮음" },
    actions: { save: "저장", cancel: "취소", close: "닫기", edit: "수정", copy: "복사", delete: "삭제", open: "링크 열기", view: "보기" }
  }
};

function number(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function won(value: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

function fromRow(row: CompetitorRow): FormState {
  return {
    platform: row.platform,
    product_url: row.product_url,
    product_id: row.product_id ?? "",
    product_name: row.product_name,
    brand: row.brand ?? "",
    seller_name: row.seller_name ?? "",
    main_image_url: row.main_image_url ?? "",
    category: row.category ?? "",
    collected_at: row.collected_at,
    last_checked_at: row.last_checked_at ?? today(),
    product_status: row.product_status,
    current_price: String(row.current_price || ""),
    original_price: String(row.original_price || ""),
    discount_rate: String(row.discount_rate || ""),
    monthly_sales_text: row.monthly_sales_text ?? "",
    review_count: String(row.review_count || ""),
    rating: String(row.rating || ""),
    rocket_type: row.rocket_type,
    shipping_fee: String(row.shipping_fee || ""),
    delivery_time: row.delivery_time ?? "",
    product_series: row.product_series ?? "",
    size: row.size ?? "",
    color: row.color ?? "",
    material: row.material ?? "",
    installation_method: row.installation_method ?? "",
    package_contents: row.package_contents ?? "",
    unit_weight: row.unit_weight ?? "",
    package_size: row.package_size ?? "",
    option_count: String(row.option_count || ""),
    title_keywords: row.title_keywords ?? "",
    main_image_selling_points: row.main_image_selling_points ?? "",
    detail_page_selling_points: row.detail_page_selling_points ?? "",
    price_advantage: row.price_advantage ?? "",
    positive_review_points: row.positive_review_points ?? "",
    negative_review_points: row.negative_review_points ?? "",
    purchase_reasons: row.purchase_reasons ?? "",
    learnings: row.learnings ?? "",
    risks: row.risks ?? "",
    matched_our_sku: row.matched_our_sku ?? "",
    our_price: String(row.our_price || ""),
    competitor_price: String(row.competitor_price || row.current_price || ""),
    our_advantages: row.our_advantages ?? "",
    our_disadvantages: row.our_disadvantages ?? "",
    worth_following: row.worth_following,
    follow_priority: row.follow_priority,
    notes: row.notes ?? ""
  };
}

export default function CompetitorProductsPage() {
  return (
    <AppShell>
      <CompetitorProductsContent />
    </AppShell>
  );
}

function CompetitorProductsContent() {
  const { language, formatDate } = useLanguage();
  const c = text[language];
  const [rows, setRows] = useState<CompetitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<CompetitorRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", category: "", status: "", rocket: "", minPrice: "", maxPrice: "", minRating: "", start: "", end: "" });

  const loadRows = async () => {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.from("competitor_product_library").select("*").order("updated_at", { ascending: false });
    if (error) {
      setMessage(c.databaseHint);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as CompetitorRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const categories = Array.from(new Set(rows.map((row) => row.category).filter(Boolean))) as string[];
  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = `${row.product_name} ${row.brand ?? ""} ${row.seller_name ?? ""} ${row.product_url}`.toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (!filters.category || row.category === filters.category) &&
        (!filters.status || row.product_status === filters.status) &&
        (!filters.rocket || row.rocket_type === filters.rocket) &&
        (!filters.minPrice || row.current_price >= number(filters.minPrice)) &&
        (!filters.maxPrice || row.current_price <= number(filters.maxPrice)) &&
        (!filters.minRating || row.rating >= number(filters.minRating)) &&
        (!filters.start || row.collected_at >= filters.start) &&
        (!filters.end || row.collected_at <= filters.end)
      );
    });
  }, [filters, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const avgPrice = rows.length ? rows.reduce((sum, row) => sum + row.current_price, 0) / rows.length : 0;
  const avgRating = rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : 0;

  const openCreate = (mode: "create" | "quick") => {
    setSelected(null);
    setForm(emptyForm);
    setDrawer(mode);
  };

  const openEdit = (row: CompetitorRow) => {
    setSelected(row);
    setForm(fromRow(row));
    setDrawer("edit");
  };

  const openView = (row: CompetitorRow) => {
    setSelected(row);
    setForm(fromRow(row));
    setDrawer("view");
  };

  const duplicate = (row: CompetitorRow) => {
    setSelected(null);
    setForm({ ...fromRow(row), product_name: `${row.product_name} Copy`, product_id: "", product_url: row.product_url });
    setDrawer("create");
  };

  const payload = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Missing user");
    const currentPrice = number(form.current_price);
    const originalPrice = number(form.original_price);
    return {
      user_id: data.user.id,
      platform: form.platform || "Coupang",
      product_url: form.product_url.trim(),
      product_id: form.product_id.trim() || null,
      product_name: form.product_name.trim(),
      brand: form.brand.trim() || null,
      seller_name: form.seller_name.trim() || null,
      main_image_url: form.main_image_url.trim() || null,
      category: form.category.trim() || null,
      collected_at: form.collected_at || today(),
      last_checked_at: form.last_checked_at || null,
      product_status: form.product_status,
      current_price: currentPrice,
      original_price: originalPrice,
      discount_rate: form.discount_rate ? number(form.discount_rate) : originalPrice ? ((originalPrice - currentPrice) / originalPrice) * 100 : 0,
      monthly_sales_text: form.monthly_sales_text.trim() || null,
      review_count: Math.round(number(form.review_count)),
      rating: Math.max(0, Math.min(5, number(form.rating))),
      rocket_type: form.rocket_type,
      shipping_fee: number(form.shipping_fee),
      delivery_time: form.delivery_time.trim() || null,
      product_series: form.product_series.trim() || null,
      size: form.size.trim() || null,
      color: form.color.trim() || null,
      material: form.material.trim() || null,
      installation_method: form.installation_method.trim() || null,
      package_contents: form.package_contents.trim() || null,
      unit_weight: form.unit_weight.trim() || null,
      package_size: form.package_size.trim() || null,
      option_count: Math.round(number(form.option_count)),
      title_keywords: form.title_keywords.trim() || null,
      main_image_selling_points: form.main_image_selling_points.trim() || null,
      detail_page_selling_points: form.detail_page_selling_points.trim() || null,
      price_advantage: form.price_advantage.trim() || null,
      positive_review_points: form.positive_review_points.trim() || null,
      negative_review_points: form.negative_review_points.trim() || null,
      purchase_reasons: form.purchase_reasons.trim() || null,
      learnings: form.learnings.trim() || null,
      risks: form.risks.trim() || null,
      matched_our_sku: form.matched_our_sku.trim() || null,
      our_price: number(form.our_price),
      competitor_price: number(form.competitor_price) || currentPrice,
      our_advantages: form.our_advantages.trim() || null,
      our_disadvantages: form.our_disadvantages.trim() || null,
      worth_following: form.worth_following,
      follow_priority: form.follow_priority,
      notes: form.notes.trim() || null
    };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.product_url.trim() || !form.product_name.trim()) {
      setMessage(language === "zh" ? "商品链接和商品名称必填。" : "상품 링크와 상품명은 필수입니다.");
      return;
    }
    const data = await payload();
    const result = drawer === "edit" && selected ? await supabase.from("competitor_product_library").update(data).eq("id", selected.id) : await supabase.from("competitor_product_library").insert(data);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setDrawer(null);
    setToast(language === "zh" ? "保存成功" : "저장되었습니다");
    await loadRows();
  };

  const remove = async (row: CompetitorRow) => {
    if (!window.confirm(`${c.actions.delete}: ${row.product_name}?`)) return;
    const { error } = await supabase.from("competitor_product_library").delete().eq("id", row.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setToast(language === "zh" ? "删除成功" : "삭제되었습니다");
    await loadRows();
  };

  return (
    <div className="space-y-6">
      {toast ? <div className="fixed right-6 top-20 z-50 rounded-full bg-[#123c35] px-4 py-2 text-sm font-semibold text-white shadow-lift">{toast}</div> : null}

      <section className="relative overflow-hidden rounded-[32px] border border-[#d7ddd4] bg-[#f9faf6] p-6 shadow-[0_26px_82px_rgba(18,31,27,0.10)] md:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-96 bg-[radial-gradient(circle,rgba(23,72,63,0.16),transparent_65%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-section-eyebrow">{c.eyebrow}</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-6xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted md:text-base">{c.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="erp-button-subtle inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => openCreate("quick")}><Flame size={16} />{c.quick}</button>
            <button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => openCreate("create")}><Plus size={16} />{c.add}</button>
          </div>
        </div>
        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi icon={PackageSearch} label={c.kpi.total} value={rows.length} />
          <Kpi icon={Target} label={c.kpi.key} value={rows.filter((row) => row.product_status === "key_competitor").length} />
          <Kpi icon={Flame} label={c.kpi.best} value={rows.filter((row) => row.product_status === "best_reference").length} />
          <Kpi icon={TrendingUp} label={c.kpi.avgPrice} value={won(avgPrice)} />
          <Kpi icon={Star} label={c.kpi.avgRating} value={avgRating.toFixed(2)} />
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <Panel title={c.filter.title} eyebrow="FILTERS">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="w-full pl-9" placeholder={c.filter.search} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </label>
          <Select value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} options={categories} allLabel={c.filter.category} />
          <Select value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={statusOptions} allLabel={c.filter.status} labelMap={c.status} />
          <Select value={filters.rocket} onChange={(value) => setFilters({ ...filters, rocket: value })} options={rocketOptions} allLabel={c.filter.rocket} labelMap={c.rocket} />
          <input placeholder={c.filter.minPrice} type="number" value={filters.minPrice} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} />
          <input placeholder={c.filter.maxPrice} type="number" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} />
          <input placeholder={c.filter.minRating} type="number" min="0" max="5" step="0.1" value={filters.minRating} onChange={(event) => setFilters({ ...filters, minRating: event.target.value })} />
          <input type="date" value={filters.start} onChange={(event) => setFilters({ ...filters, start: event.target.value })} />
          <input type="date" value={filters.end} onChange={(event) => setFilters({ ...filters, end: event.target.value })} />
          <button className="erp-button-subtle inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => setFilters({ search: "", category: "", status: "", rocket: "", minPrice: "", maxPrice: "", minRating: "", start: "", end: "" })}>
            <RotateCcw size={15} />{c.filter.reset}
          </button>
        </div>
      </Panel>

      <Panel title={c.title} eyebrow="DATABASE">
        {loading ? <Skeleton /> : pageRows.length ? (
          <>
            <div className="overflow-hidden rounded-2xl border border-line bg-white/72">
              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full text-left text-sm">
                  <thead className="bg-[#eef3ef] text-xs uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-4 py-3">{c.table.product}</th>
                      <th className="px-4 py-3">{c.table.category}</th>
                      <th className="px-4 py-3">{c.table.brand}</th>
                      <th className="px-4 py-3">{c.table.price}</th>
                      <th className="px-4 py-3">{c.table.sales}</th>
                      <th className="px-4 py-3">{c.table.reviews}</th>
                      <th className="px-4 py-3">{c.table.rating}</th>
                      <th className="px-4 py-3">{c.table.rocket}</th>
                      <th className="px-4 py-3">{c.table.status}</th>
                      <th className="px-4 py-3">{c.table.matched}</th>
                      <th className="px-4 py-3">{c.table.priority}</th>
                      <th className="px-4 py-3">{c.table.updated}</th>
                      <th className="px-4 py-3 text-right">{c.table.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.id} className="border-t border-line transition hover:bg-[#f3f7f3]">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-line bg-[#f4f5f0]">
                              {row.main_image_url ? <img className="h-full w-full object-cover" src={row.main_image_url} alt="" /> : <PackageSearch className="m-4 h-6 w-6 text-muted" />}
                            </div>
                            <div className="min-w-0">
                              <div className="max-w-[280px] truncate font-bold text-ink">{row.product_name}</div>
                              <div className="mt-1 text-xs text-muted">{row.product_id || row.platform}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold">{row.category || "-"}</td>
                        <td className="px-4 py-4"><div className="font-semibold">{row.brand || "-"}</div><div className="text-xs text-muted">{row.seller_name || "-"}</div></td>
                        <td className="px-4 py-4 font-bold tabular-nums">{won(row.current_price)}</td>
                        <td className="px-4 py-4">{row.monthly_sales_text || "-"}</td>
                        <td className="px-4 py-4 tabular-nums">{row.review_count.toLocaleString()}</td>
                        <td className="px-4 py-4"><span className="inline-flex items-center gap-1 font-bold"><Star size={14} className="text-[#b89b5e]" />{row.rating.toFixed(1)}</span></td>
                        <td className="px-4 py-4"><Tag>{c.rocket[row.rocket_type]}</Tag></td>
                        <td className="px-4 py-4"><Tag tone={row.product_status === "best_reference" ? "good" : row.product_status === "key_competitor" ? "watch" : row.product_status === "eliminated" ? "risk" : "neutral"}>{c.status[row.product_status]}</Tag></td>
                        <td className="px-4 py-4 font-semibold">{row.matched_our_sku || "-"}</td>
                        <td className="px-4 py-4"><Tag tone={row.follow_priority === "high" ? "risk" : row.follow_priority === "medium" ? "watch" : "neutral"}>{c.priority[row.follow_priority]}</Tag></td>
                        <td className="px-4 py-4 text-xs text-muted">{formatDate(row.updated_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1.5">
                            <IconButton label={c.actions.view} icon={<Eye size={14} />} onClick={() => openView(row)} />
                            <IconButton label={c.actions.edit} icon={<Edit3 size={14} />} onClick={() => openEdit(row)} />
                            <IconButton label={c.actions.copy} icon={<Copy size={14} />} onClick={() => duplicate(row)} />
                            <IconButton label={c.actions.open} icon={<ExternalLink size={14} />} onClick={() => window.open(row.product_url, "_blank")} />
                            <IconButton danger label={c.actions.delete} icon={<Trash2 size={14} />} onClick={() => remove(row)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>{filtered.length} items · {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button>
                <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-white/50 px-6 py-14 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-[#17483f]" />
            <p className="mt-4 text-lg font-bold text-ink">{c.empty}</p>
            <button className="mt-5 erp-button-primary inline-flex items-center gap-2 px-4 py-2 font-bold" onClick={() => openCreate("quick")}><Plus size={16} />{c.quick}</button>
          </div>
        )}
      </Panel>

      {drawer ? (
        <Drawer c={c} mode={drawer} form={form} setForm={setForm} onClose={() => setDrawer(null)} onSubmit={submit} selected={selected} />
      ) : null}
    </div>
  );
}

function Drawer({ c, mode, form, setForm, onClose, onSubmit, selected }: { c: typeof text.zh; mode: DrawerMode; form: FormState; setForm: (form: FormState) => void; onClose: () => void; onSubmit: (event: FormEvent) => void; selected: CompetitorRow | null }) {
  const readOnly = mode === "view";
  const quick = mode === "quick";
  const title = mode === "view" ? c.view : mode === "edit" ? c.edit : quick ? c.quick : c.add;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#071512]/40 backdrop-blur-sm" onClick={onClose}>
      <form className="h-full w-full max-w-6xl overflow-y-auto border-l border-white/40 bg-[#f6f7f1] p-6 shadow-lift" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="premium-section-eyebrow">COUPANG CAPTURE</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
          </div>
          <button type="button" className="erp-button-subtle p-2" onClick={onClose}><X size={18} /></button>
        </div>

        {readOnly && selected ? <DetailHeader c={c} row={selected} /> : null}

        <FormSection title={c.sections.basic}>
          <Field label="平台" value={form.platform} readOnly={readOnly} onChange={(value) => setForm({ ...form, platform: value })} />
          <Field label="商品链接" value={form.product_url} readOnly={readOnly} required onChange={(value) => setForm({ ...form, product_url: value })} className="md:col-span-2" />
          <Field label="商品ID" value={form.product_id} readOnly={readOnly} onChange={(value) => setForm({ ...form, product_id: value })} />
          <Field label="商品名称" value={form.product_name} readOnly={readOnly} required onChange={(value) => setForm({ ...form, product_name: value })} className="md:col-span-2" />
          <Field label="品牌" value={form.brand} readOnly={readOnly} onChange={(value) => setForm({ ...form, brand: value })} />
          <Field label="店铺名" value={form.seller_name} readOnly={readOnly} onChange={(value) => setForm({ ...form, seller_name: value })} />
          <Field label="商品主图 URL" value={form.main_image_url} readOnly={readOnly} onChange={(value) => setForm({ ...form, main_image_url: value })} className="md:col-span-2" />
          <Field label="商品类目" value={form.category} readOnly={readOnly} onChange={(value) => setForm({ ...form, category: value })} />
          <Field label="采集日期" type="date" value={form.collected_at} readOnly={readOnly} onChange={(value) => setForm({ ...form, collected_at: value })} />
          <Field label="最后更新日期" type="date" value={form.last_checked_at} readOnly={readOnly} onChange={(value) => setForm({ ...form, last_checked_at: value })} />
          <SelectField label="商品状态" value={form.product_status} disabled={readOnly} options={statusOptions} labelMap={c.status} onChange={(value) => setForm({ ...form, product_status: value as ProductStatus })} />
        </FormSection>

        <FormSection title={c.sections.sales}>
          <Field label="当前售价" type="number" value={form.current_price} readOnly={readOnly} onChange={(value) => setForm({ ...form, current_price: value, competitor_price: form.competitor_price || value })} />
          <Field label="原价" type="number" value={form.original_price} readOnly={readOnly} onChange={(value) => setForm({ ...form, original_price: value })} />
          <Field label="折扣率 %" type="number" value={form.discount_rate} readOnly={readOnly} onChange={(value) => setForm({ ...form, discount_rate: value })} />
          <Field label="月销量显示" value={form.monthly_sales_text} readOnly={readOnly} onChange={(value) => setForm({ ...form, monthly_sales_text: value })} />
          <Field label="累计评论数" type="number" value={form.review_count} readOnly={readOnly} onChange={(value) => setForm({ ...form, review_count: value })} />
          <Field label="评分 0-5" type="number" value={form.rating} readOnly={readOnly} onChange={(value) => setForm({ ...form, rating: value })} />
          <SelectField label="Rocket 类型" value={form.rocket_type} disabled={readOnly} options={rocketOptions} labelMap={c.rocket} onChange={(value) => setForm({ ...form, rocket_type: value as RocketType })} />
          <Field label="配送费" type="number" value={form.shipping_fee} readOnly={readOnly} onChange={(value) => setForm({ ...form, shipping_fee: value })} />
          <Field label="到货时间" value={form.delivery_time} readOnly={readOnly} onChange={(value) => setForm({ ...form, delivery_time: value })} />
        </FormSection>

        {!quick ? (
          <>
            <FormSection title={c.sections.specs}>
              <Field label="品类系列" value={form.product_series} readOnly={readOnly} onChange={(value) => setForm({ ...form, product_series: value })} />
              <Field label="尺寸" value={form.size} readOnly={readOnly} onChange={(value) => setForm({ ...form, size: value })} />
              <Field label="颜色" value={form.color} readOnly={readOnly} onChange={(value) => setForm({ ...form, color: value })} />
              <Field label="材质" value={form.material} readOnly={readOnly} onChange={(value) => setForm({ ...form, material: value })} />
              <Field label="安装方式" value={form.installation_method} readOnly={readOnly} onChange={(value) => setForm({ ...form, installation_method: value })} />
              <Field label="包装内容" value={form.package_contents} readOnly={readOnly} onChange={(value) => setForm({ ...form, package_contents: value })} />
              <Field label="单品重量" value={form.unit_weight} readOnly={readOnly} onChange={(value) => setForm({ ...form, unit_weight: value })} />
              <Field label="包装尺寸" value={form.package_size} readOnly={readOnly} onChange={(value) => setForm({ ...form, package_size: value })} />
              <Field label="选项数量" type="number" value={form.option_count} readOnly={readOnly} onChange={(value) => setForm({ ...form, option_count: value })} />
            </FormSection>

            <FormSection title={c.sections.selling}>
              <TextArea label="标题关键词" value={form.title_keywords} readOnly={readOnly} onChange={(value) => setForm({ ...form, title_keywords: value })} />
              <TextArea label="主图卖点" value={form.main_image_selling_points} readOnly={readOnly} onChange={(value) => setForm({ ...form, main_image_selling_points: value })} />
              <TextArea label="详情页核心卖点" value={form.detail_page_selling_points} readOnly={readOnly} onChange={(value) => setForm({ ...form, detail_page_selling_points: value })} />
              <TextArea label="价格优势" value={form.price_advantage} readOnly={readOnly} onChange={(value) => setForm({ ...form, price_advantage: value })} />
              <TextArea label="评论高频好评点" value={form.positive_review_points} readOnly={readOnly} onChange={(value) => setForm({ ...form, positive_review_points: value })} />
              <TextArea label="评论高频差评点" value={form.negative_review_points} readOnly={readOnly} onChange={(value) => setForm({ ...form, negative_review_points: value })} />
              <TextArea label="客户购买理由" value={form.purchase_reasons} readOnly={readOnly} onChange={(value) => setForm({ ...form, purchase_reasons: value })} />
              <TextArea label="可学习点" value={form.learnings} readOnly={readOnly} onChange={(value) => setForm({ ...form, learnings: value })} />
              <TextArea label="我们可以避开的坑" value={form.risks} readOnly={readOnly} onChange={(value) => setForm({ ...form, risks: value })} />
            </FormSection>

            <FormSection title={c.sections.benchmark}>
              <Field label="对标我方 SKU" value={form.matched_our_sku} readOnly={readOnly} onChange={(value) => setForm({ ...form, matched_our_sku: value })} />
              <Field label="我方价格" type="number" value={form.our_price} readOnly={readOnly} onChange={(value) => setForm({ ...form, our_price: value })} />
              <Field label="竞品价格" type="number" value={form.competitor_price} readOnly={readOnly} onChange={(value) => setForm({ ...form, competitor_price: value })} />
              <SelectField label="跟进优先级" value={form.follow_priority} disabled={readOnly} options={priorityOptions} labelMap={c.priority} onChange={(value) => setForm({ ...form, follow_priority: value as FollowPriority })} />
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink">
                <input type="checkbox" checked={form.worth_following} disabled={readOnly} onChange={(event) => setForm({ ...form, worth_following: event.target.checked })} />
                是否值得跟进
              </label>
              <TextArea label="我方优势" value={form.our_advantages} readOnly={readOnly} onChange={(value) => setForm({ ...form, our_advantages: value })} />
              <TextArea label="我方劣势" value={form.our_disadvantages} readOnly={readOnly} onChange={(value) => setForm({ ...form, our_disadvantages: value })} />
            </FormSection>
          </>
        ) : null}

        <FormSection title={c.sections.notes}>
          <TextArea label="备注" value={form.notes} readOnly={readOnly} onChange={(value) => setForm({ ...form, notes: value })} className="md:col-span-3" />
        </FormSection>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="erp-button-subtle px-4 py-2 font-bold" onClick={onClose}>{readOnly ? c.actions.close : c.actions.cancel}</button>
          {!readOnly ? <button type="submit" className="erp-button-primary px-4 py-2 font-bold">{c.actions.save}</button> : null}
        </div>
      </form>
    </div>
  );
}

function DetailHeader({ c, row }: { c: typeof text.zh; row: CompetitorRow }) {
  return (
    <div className="mb-6 grid gap-4 rounded-[28px] border border-line bg-white/78 p-4 shadow-card md:grid-cols-[180px_1fr]">
      <div className="aspect-square overflow-hidden rounded-3xl border border-line bg-[#f4f5f0]">
        {row.main_image_url ? <img className="h-full w-full object-cover" src={row.main_image_url} alt="" /> : <PackageSearch className="m-14 h-14 w-14 text-muted" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <Tag tone="watch">{c.status[row.product_status]}</Tag>
          <Tag>{c.rocket[row.rocket_type]}</Tag>
          <Tag tone={row.follow_priority === "high" ? "risk" : "neutral"}>{c.priority[row.follow_priority]}</Tag>
        </div>
        <h3 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{row.product_name}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Mini label="Brand" value={row.brand || "-"} />
          <Mini label="Store" value={row.seller_name || "-"} />
          <Mini label="Price" value={won(row.current_price)} />
          <Mini label="Rating" value={`${row.rating.toFixed(1)} / ${row.review_count.toLocaleString()}`} />
        </div>
        <a className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#17483f] px-4 py-2 text-sm font-bold text-white" href={row.product_url} target="_blank">
          {c.actions.open}<ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return <div className="rounded-2xl border border-white/70 bg-white/78 p-4 shadow-[0_12px_34px_rgba(20,33,29,0.08)] backdrop-blur"><Icon className="h-5 w-5 text-[#17483f]" /><div className="mt-3 text-xs font-bold text-muted">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</div></div>;
}

function Panel({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-[28px] border border-line bg-card/92 p-5 shadow-card backdrop-blur"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h2></div>{children}</section>;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-5 rounded-[24px] border border-line bg-white/72 p-4 shadow-card"><h3 className="mb-4 text-lg font-semibold text-ink">{title}</h3><div className="grid gap-3 md:grid-cols-3">{children}</div></section>;
}

function Field({ label, value, onChange, type = "text", required = false, readOnly = false, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; required?: boolean; readOnly?: boolean; className?: string }) {
  return <label className={className}><span className="mb-1 block text-xs font-bold text-muted">{label}{required ? " *" : ""}</span><input className="w-full" type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} required={required} disabled={readOnly} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, readOnly = false, className = "" }: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean; className?: string }) {
  return <label className={className}><span className="mb-1 block text-xs font-bold text-muted">{label}</span><textarea className="min-h-24 w-full" value={value} disabled={readOnly} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, labelMap, onChange, disabled = false }: { label: string; value: string; options: string[]; labelMap: Record<string, string>; onChange: (value: string) => void; disabled?: boolean }) {
  return <label><span className="mb-1 block text-xs font-bold text-muted">{label}</span><select className="w-full" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labelMap[option]}</option>)}</select></label>;
}

function Select({ value, options, allLabel, labelMap, onChange }: { value: string; options: string[]; allLabel: string; labelMap?: Record<string, string>; onChange: (value: string) => void }) {
  return <select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{allLabel}</option>{options.map((option) => <option key={option} value={option}>{labelMap?.[option] ?? option}</option>)}</select>;
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const styles = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "risk" ? "border-red-200 bg-red-50 text-red-700" : tone === "watch" ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-[#17483f]/15 bg-[#e8f1ed] text-[#17483f]";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles}`}>{children}</span>;
}

function IconButton({ label, icon, onClick, danger = false }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" title={label} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${danger ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-white/80 text-ink hover:bg-[#eef4ef]"}`} onClick={onClick}>{icon}</button>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-[#fbfcfb] px-3 py-2"><div className="text-xs text-muted">{label}</div><div className="mt-1 truncate font-bold text-ink">{value}</div></div>;
}

function Skeleton() {
  return <div className="grid gap-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/65" />)}</div>;
}
