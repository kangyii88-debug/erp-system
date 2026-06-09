"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

type DevelopmentStatus = "pending_analysis" | "analyzed" | "sampled" | "quoted" | "testing" | "ready_launch" | "listed" | "abandoned";
type RecommendationGrade = "A_PLUS" | "A" | "B" | "C" | "D";
type Priority = "high" | "medium" | "low";
type DrawerMode = "create" | "edit" | null;
type SortKey = "product_name" | "analysis_date" | "estimated_monthly_revenue_krw" | "profit_krw" | "profit_margin" | "recommendation_grade" | "priority";

type ProductTestRow = {
  id: string;
  product_image_url: string | null;
  product_name: string;
  category: string | null;
  coupang_url: string | null;
  selling_price_krw: number;
  analysis_date: string;
  estimated_monthly_sales: number;
  estimated_monthly_revenue_krw: number;
  purchase_price_cny: number;
  international_shipping_cny: number;
  landed_cost_cny: number;
  exchange_rate: number;
  landed_cost_krw: number;
  expected_selling_price_krw: number;
  platform_commission_rate: number;
  platform_commission_krw: number;
  korean_shipping_fee_krw: number;
  ad_cost_krw: number;
  total_cost_krw: number;
  profit_krw: number;
  profit_margin: number;
  supplier_url: string | null;
  development_status: DevelopmentStatus;
  recommendation_grade: RecommendationGrade;
  priority: Priority;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  product_image_url: string;
  product_name: string;
  category: string;
  coupang_url: string;
  selling_price_krw: string;
  analysis_date: string;
  estimated_monthly_sales: string;
  purchase_price_cny: string;
  international_shipping_cny: string;
  exchange_rate: string;
  expected_selling_price_krw: string;
  platform_commission_rate: string;
  korean_shipping_fee_krw: string;
  ad_cost_krw: string;
  supplier_url: string;
  development_status: DevelopmentStatus;
  recommendation_grade: RecommendationGrade;
  priority: Priority;
  notes: string;
};

const pageSize = 20;
const statusOptions: DevelopmentStatus[] = ["pending_analysis", "analyzed", "sampled", "quoted", "testing", "ready_launch", "listed", "abandoned"];
const gradeOptions: RecommendationGrade[] = ["A_PLUS", "A", "B", "C", "D"];
const priorityOptions: Priority[] = ["high", "medium", "low"];

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

const emptyForm: FormState = {
  product_image_url: "",
  product_name: "",
  category: "",
  coupang_url: "",
  selling_price_krw: "",
  analysis_date: today(),
  estimated_monthly_sales: "",
  purchase_price_cny: "",
  international_shipping_cny: "",
  exchange_rate: "220",
  expected_selling_price_krw: "",
  platform_commission_rate: "11.9",
  korean_shipping_fee_krw: "500",
  ad_cost_krw: "500",
  supplier_url: "",
  development_status: "pending_analysis",
  recommendation_grade: "B",
  priority: "medium",
  notes: ""
};

const copyText = {
  zh: {
    eyebrow: "PRODUCT TEST DATABASE",
    title: "商品测试数据库",
    subtitle: "用于新品选品、成本测算、利润测算、供应商链接保存与开发状态管理的 Excel Pro 型数据库。",
    add: "新增测试商品",
    export: "导出 Excel",
    import: "导入 Excel",
    databaseHint: "数据库表尚未创建：请在 Supabase SQL Editor 执行 supabase/migrations/create-product-test-database.sql。",
    empty: "暂无测试商品，请点击新增测试商品开始记录候选商品。",
    kpi: {
      total: "已测试商品数",
      focus: "重点跟进商品数",
      avgMargin: "平均利润率",
      monthlyRevenue: "预计月销售额",
      highProfit: "高利润商品数",
      abandoned: "已放弃商品数"
    },
    filters: {
      title: "筛选区",
      searchName: "搜索产品名称",
      searchUrl: "搜索 Coupang 链接",
      category: "全部类目",
      status: "全部开发状态",
      grade: "全部推荐等级",
      priority: "全部优先级",
      margin: "利润率区间",
      start: "分析开始",
      end: "分析结束",
      reset: "重置筛选"
    },
    status: {
      pending_analysis: "待分析",
      analyzed: "已分析",
      sampled: "已打样",
      quoted: "已报价",
      testing: "测试中",
      ready_launch: "准备上线",
      listed: "已上架",
      abandoned: "已放弃"
    },
    grade: { A_PLUS: "A+", A: "A", B: "B", C: "C", D: "D" },
    priority: { high: "高", medium: "中", low: "低" },
    sections: {
      basic: "基础信息",
      sales: "销售预测",
      cost: "成本信息",
      result: "自动计算结果",
      development: "开发管理",
      notes: "备注"
    },
    actions: { save: "保存", cancel: "取消", edit: "编辑", copy: "复制", delete: "删除", open: "打开链接" }
  },
  ko: {
    eyebrow: "PRODUCT TEST DATABASE",
    title: "상품 테스트 데이터베이스",
    subtitle: "신제품 후보, 원가 계산, 이익 계산, 공급업체 링크와 개발 상태를 관리하는 Excel Pro형 데이터베이스입니다.",
    add: "테스트 상품 추가",
    export: "Excel 내보내기",
    import: "Excel 가져오기",
    databaseHint: "데이터베이스 테이블이 없습니다. Supabase SQL Editor에서 supabase/migrations/create-product-test-database.sql을 실행하세요.",
    empty: "테스트 상품이 없습니다. 테스트 상품 추가로 후보 상품을 기록하세요.",
    kpi: {
      total: "테스트 상품 수",
      focus: "중점 follow 상품",
      avgMargin: "평균 이익률",
      monthlyRevenue: "예상 월매출",
      highProfit: "고이익 상품",
      abandoned: "포기 상품"
    },
    filters: {
      title: "필터",
      searchName: "상품명 검색",
      searchUrl: "Coupang 링크 검색",
      category: "전체 카테고리",
      status: "전체 개발 상태",
      grade: "전체 추천 등급",
      priority: "전체 우선순위",
      margin: "이익률 구간",
      start: "분석 시작",
      end: "분석 종료",
      reset: "필터 초기화"
    },
    status: {
      pending_analysis: "분석 대기",
      analyzed: "분석 완료",
      sampled: "샘플 완료",
      quoted: "견적 완료",
      testing: "테스트중",
      ready_launch: "출시 준비",
      listed: "출시 완료",
      abandoned: "포기"
    },
    grade: { A_PLUS: "A+", A: "A", B: "B", C: "C", D: "D" },
    priority: { high: "높음", medium: "중간", low: "낮음" },
    sections: {
      basic: "기본 정보",
      sales: "판매 예측",
      cost: "원가 정보",
      result: "자동 계산 결과",
      development: "개발 관리",
      notes: "메모"
    },
    actions: { save: "저장", cancel: "취소", edit: "수정", copy: "복사", delete: "삭제", open: "링크 열기" }
  }
};

function num(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function krw(value: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

function cny(value: number) {
  return `¥${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value)}`;
}

function pct(value: number) {
  return `${num(value).toFixed(1)}%`;
}

function compute(form: FormState) {
  const sellingPrice = num(form.selling_price_krw);
  const estimatedSales = num(form.estimated_monthly_sales);
  const purchase = num(form.purchase_price_cny);
  const intl = num(form.international_shipping_cny);
  const exchange = num(form.exchange_rate) || 220;
  const expectedPrice = num(form.expected_selling_price_krw);
  const commissionRate = num(form.platform_commission_rate) || 11.9;
  const koreaShipping = num(form.korean_shipping_fee_krw);
  const ad = num(form.ad_cost_krw);
  const landedCny = purchase + intl;
  const landedKrw = landedCny * exchange;
  const monthlyRevenue = sellingPrice * estimatedSales;
  const commission = expectedPrice * commissionRate / 100;
  const totalCost = landedKrw + commission + koreaShipping + ad;
  const profit = expectedPrice - totalCost;
  const margin = expectedPrice > 0 ? profit / expectedPrice * 100 : 0;
  return { landedCny, landedKrw, monthlyRevenue, commission, totalCost, profit, margin };
}

function formFromRow(row: ProductTestRow): FormState {
  return {
    product_image_url: row.product_image_url ?? "",
    product_name: row.product_name,
    category: row.category ?? "",
    coupang_url: row.coupang_url ?? "",
    selling_price_krw: String(row.selling_price_krw || ""),
    analysis_date: row.analysis_date,
    estimated_monthly_sales: String(row.estimated_monthly_sales || ""),
    purchase_price_cny: String(row.purchase_price_cny || ""),
    international_shipping_cny: String(row.international_shipping_cny || ""),
    exchange_rate: String(row.exchange_rate || 220),
    expected_selling_price_krw: String(row.expected_selling_price_krw || ""),
    platform_commission_rate: String(row.platform_commission_rate || 11.9),
    korean_shipping_fee_krw: String(row.korean_shipping_fee_krw || 500),
    ad_cost_krw: String(row.ad_cost_krw || 500),
    supplier_url: row.supplier_url ?? "",
    development_status: row.development_status,
    recommendation_grade: row.recommendation_grade,
    priority: row.priority,
    notes: row.notes ?? ""
  };
}

export default function ProductTestDatabasePage() {
  return (
    <AppShell>
      <ProductTestDatabaseContent />
    </AppShell>
  );
}

function ProductTestDatabaseContent() {
  const { language, formatDate } = useLanguage();
  const c = copyText[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ProductTestRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "analysis_date", dir: "desc" });
  const [filters, setFilters] = useState({ name: "", url: "", category: "", status: "", grade: "", priority: "", margin: "", start: "", end: "" });

  const loadRows = async () => {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.from("product_test_database").select("*").order("analysis_date", { ascending: false });
    if (error) {
      setMessage(c.databaseHint);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ProductTestRow[]);
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
    const marginMatch = (margin: number) => {
      if (!filters.margin) return true;
      if (filters.margin === "40") return margin >= 40;
      if (filters.margin === "20") return margin >= 20 && margin < 40;
      if (filters.margin === "10") return margin >= 10 && margin < 20;
      if (filters.margin === "0") return margin < 10;
      return true;
    };
    const result = rows.filter((row) => (
      (!filters.name || row.product_name.toLowerCase().includes(filters.name.toLowerCase())) &&
      (!filters.url || String(row.coupang_url ?? "").toLowerCase().includes(filters.url.toLowerCase())) &&
      (!filters.category || row.category === filters.category) &&
      (!filters.status || row.development_status === filters.status) &&
      (!filters.grade || row.recommendation_grade === filters.grade) &&
      (!filters.priority || row.priority === filters.priority) &&
      (!filters.start || row.analysis_date >= filters.start) &&
      (!filters.end || row.analysis_date <= filters.end) &&
      marginMatch(row.profit_margin)
    ));
    return result.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const direction = sort.dir === "asc" ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    });
  }, [filters, rows, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const avgMargin = rows.length ? rows.reduce((sum, row) => sum + row.profit_margin, 0) / rows.length : 0;
  const monthlyRevenue = rows.reduce((sum, row) => sum + row.estimated_monthly_revenue_krw, 0);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDrawer("create");
  };

  const openEdit = (row: ProductTestRow) => {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setDrawer("edit");
  };

  const duplicate = (row: ProductTestRow) => {
    setEditingId(null);
    setForm({ ...formFromRow(row), product_name: `${row.product_name} Copy`, analysis_date: today() });
    setDrawer("create");
  };

  const payload = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Missing user");
    return {
      user_id: data.user.id,
      product_image_url: form.product_image_url.trim() || null,
      product_name: form.product_name.trim(),
      category: form.category.trim() || null,
      coupang_url: form.coupang_url.trim() || null,
      selling_price_krw: num(form.selling_price_krw),
      analysis_date: form.analysis_date || today(),
      estimated_monthly_sales: Math.round(num(form.estimated_monthly_sales)),
      purchase_price_cny: num(form.purchase_price_cny),
      international_shipping_cny: num(form.international_shipping_cny),
      exchange_rate: num(form.exchange_rate) || 220,
      expected_selling_price_krw: num(form.expected_selling_price_krw),
      platform_commission_rate: num(form.platform_commission_rate) || 11.9,
      korean_shipping_fee_krw: num(form.korean_shipping_fee_krw),
      ad_cost_krw: num(form.ad_cost_krw),
      supplier_url: form.supplier_url.trim() || null,
      development_status: form.development_status,
      recommendation_grade: form.recommendation_grade,
      priority: form.priority,
      notes: form.notes.trim() || null
    };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.product_name.trim()) {
      setMessage(language === "zh" ? "产品名称必填。" : "상품명은 필수입니다.");
      return;
    }
    const data = await payload();
    const result = editingId ? await supabase.from("product_test_database").update(data).eq("id", editingId) : await supabase.from("product_test_database").insert(data);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setDrawer(null);
    setToast(language === "zh" ? "保存成功" : "저장되었습니다");
    await loadRows();
  };

  const remove = async (ids: string[]) => {
    if (!ids.length) return;
    if (!window.confirm(language === "zh" ? `确定删除 ${ids.length} 条记录？` : `${ids.length}개 기록을 삭제할까요?`)) return;
    const { error } = await supabase.from("product_test_database").delete().in("id", ids);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSelectedIds([]);
    setToast(language === "zh" ? "删除成功" : "삭제되었습니다");
    await loadRows();
  };

  const exportCsv = () => {
    const headers = ["产品名称", "类目", "Coupang链接", "销售价格(KRW)", "分析日期", "一个月预计销量", "一个月预计销售额(KRW)", "采购价(CNY)", "国际物流费(CNY)", "到韩总成本(CNY)", "汇率", "到韩总成本(KRW)", "预计售价(KRW)", "平台佣金率(%)", "平台佣金(KRW)", "韩国物流费(KRW)", "广告费(KRW)", "总成本(KRW)", "利润(KRW)", "利润率(%)", "供应商链接", "开发状态", "推荐等级", "优先级", "备注"];
    const body = filtered.map((row) => [row.product_name, row.category ?? "", row.coupang_url ?? "", row.selling_price_krw, row.analysis_date, row.estimated_monthly_sales, row.estimated_monthly_revenue_krw, row.purchase_price_cny, row.international_shipping_cny, row.landed_cost_cny, row.exchange_rate, row.landed_cost_krw, row.expected_selling_price_krw, row.platform_commission_rate, row.platform_commission_krw, row.korean_shipping_fee_krw, row.ad_cost_krw, row.total_cost_krw, row.profit_krw, row.profit_margin, row.supplier_url ?? "", row.development_status, row.recommendation_grade, row.priority, row.notes ?? ""]);
    const csv = [headers, ...body].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `product-test-database-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const records = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      return {
        user_id: data.user!.id,
        product_name: cols[0] || "Unnamed",
        category: cols[1] || null,
        coupang_url: cols[2] || null,
        selling_price_krw: num(cols[3]),
        analysis_date: cols[4] || today(),
        estimated_monthly_sales: Math.round(num(cols[5])),
        purchase_price_cny: num(cols[7]),
        international_shipping_cny: num(cols[8]),
        exchange_rate: num(cols[10]) || 220,
        expected_selling_price_krw: num(cols[12]),
        platform_commission_rate: num(cols[13]) || 11.9,
        korean_shipping_fee_krw: num(cols[15]) || 500,
        ad_cost_krw: num(cols[16]) || 500,
        supplier_url: cols[20] || null,
        development_status: statusOptions.includes(cols[21] as DevelopmentStatus) ? cols[21] as DevelopmentStatus : "pending_analysis",
        recommendation_grade: gradeOptions.includes(cols[22] as RecommendationGrade) ? cols[22] as RecommendationGrade : "B",
        priority: priorityOptions.includes(cols[23] as Priority) ? cols[23] as Priority : "medium",
        notes: cols[24] || null
      };
    });
    const { error } = await supabase.from("product_test_database").insert(records);
    if (error) setMessage(error.message);
    else {
      setToast(language === "zh" ? "导入成功" : "가져오기 완료");
      await loadRows();
    }
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));
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
            <input ref={inputRef} className="hidden" type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])} />
            <button className="erp-button-subtle inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => inputRef.current?.click()}><Upload size={16} />{c.import}</button>
            <button className="erp-button-subtle inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={exportCsv}><Download size={16} />{c.export}</button>
            <button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={openCreate}><Plus size={16} />{c.add}</button>
          </div>
        </div>
        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi icon={FileSpreadsheet} label={c.kpi.total} value={rows.length} />
          <Kpi icon={BadgeCheck} label={c.kpi.focus} value={rows.filter((row) => row.priority === "high" || row.recommendation_grade === "A_PLUS" || row.recommendation_grade === "A").length} />
          <Kpi icon={Filter} label={c.kpi.avgMargin} value={pct(avgMargin)} />
          <Kpi icon={PackageSearch} label={c.kpi.monthlyRevenue} value={krw(monthlyRevenue)} />
          <Kpi icon={Check} label={c.kpi.highProfit} value={rows.filter((row) => row.profit_margin >= 40).length} />
          <Kpi icon={AlertTriangle} label={c.kpi.abandoned} value={rows.filter((row) => row.development_status === "abandoned").length} />
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <Panel title={c.filters.title} eyebrow="FILTERS">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-9">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="w-full pl-9" placeholder={c.filters.searchName} value={filters.name} onChange={(event) => setFilters({ ...filters, name: event.target.value })} />
          </label>
          <input placeholder={c.filters.searchUrl} value={filters.url} onChange={(event) => setFilters({ ...filters, url: event.target.value })} />
          <Select value={filters.category} options={categories} allLabel={c.filters.category} onChange={(value) => setFilters({ ...filters, category: value })} />
          <Select value={filters.status} options={statusOptions} labelMap={c.status} allLabel={c.filters.status} onChange={(value) => setFilters({ ...filters, status: value })} />
          <Select value={filters.grade} options={gradeOptions} labelMap={c.grade} allLabel={c.filters.grade} onChange={(value) => setFilters({ ...filters, grade: value })} />
          <Select value={filters.priority} options={priorityOptions} labelMap={c.priority} allLabel={c.filters.priority} onChange={(value) => setFilters({ ...filters, priority: value })} />
          <Select value={filters.margin} options={["40", "20", "10", "0"]} labelMap={{ "40": ">=40%", "20": "20%-40%", "10": "10%-20%", "0": "<10%" }} allLabel={c.filters.margin} onChange={(value) => setFilters({ ...filters, margin: value })} />
          <input type="date" value={filters.start} onChange={(event) => setFilters({ ...filters, start: event.target.value })} />
          <input type="date" value={filters.end} onChange={(event) => setFilters({ ...filters, end: event.target.value })} />
          <button className="erp-button-subtle inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => setFilters({ name: "", url: "", category: "", status: "", grade: "", priority: "", margin: "", start: "", end: "" })}>
            <RotateCcw size={15} />{c.filters.reset}
          </button>
        </div>
      </Panel>

      <Panel title={c.title} eyebrow="EXCEL PRO DATABASE">
        {selectedIds.length ? (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm font-bold text-red-700">{selectedIds.length} selected</span>
            <button className="rounded bg-red-700 px-3 py-2 text-sm font-bold text-white" onClick={() => remove(selectedIds)}>{c.actions.delete}</button>
          </div>
        ) : null}
        {loading ? <Skeleton /> : pageRows.length ? (
          <>
            <div className="overflow-hidden rounded-2xl border border-line bg-white/72">
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-[2600px] w-full border-separate border-spacing-0 text-left text-sm">
                  <thead className="sticky top-0 z-[3] bg-[#eef3ef] text-xs uppercase tracking-[0.08em] text-muted">
                    <tr>
                      <th className="sticky left-0 z-[4] w-10 border-b border-line bg-[#eef3ef] px-3 py-3"><input type="checkbox" checked={pageRows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? Array.from(new Set([...selectedIds, ...pageRows.map((row) => row.id)])) : selectedIds.filter((id) => !pageRows.some((row) => row.id === id)))} /></th>
                      <th className="sticky left-10 z-[4] w-24 border-b border-line bg-[#eef3ef] px-4 py-3">产品图片</th>
                      <SortableTh stickyLeft="left-[136px]" label="产品名称" keyName="product_name" sort={sort} onSort={toggleSort} />
                      <th className="border-b border-line px-4 py-3">类目</th>
                      <th className="border-b border-line px-4 py-3">Coupang链接</th>
                      <th className="border-b border-line px-4 py-3">销售价格</th>
                      <SortableTh label="分析日期" keyName="analysis_date" sort={sort} onSort={toggleSort} />
                      <th className="border-b border-line px-4 py-3">预计销量</th>
                      <SortableTh label="预计月销售额" keyName="estimated_monthly_revenue_krw" sort={sort} onSort={toggleSort} />
                      <th className="border-b border-line px-4 py-3">采购价(CNY)</th>
                      <th className="border-b border-line px-4 py-3">国际物流(CNY)</th>
                      <th className="border-b border-line px-4 py-3">到韩成本(CNY)</th>
                      <th className="border-b border-line px-4 py-3">汇率</th>
                      <th className="border-b border-line px-4 py-3">到韩成本(KRW)</th>
                      <th className="border-b border-line px-4 py-3">预计售价</th>
                      <th className="border-b border-line px-4 py-3">佣金率</th>
                      <th className="border-b border-line px-4 py-3">平台佣金</th>
                      <th className="border-b border-line px-4 py-3">韩国物流</th>
                      <th className="border-b border-line px-4 py-3">广告费</th>
                      <th className="border-b border-line px-4 py-3">总成本</th>
                      <SortableTh label="利润" keyName="profit_krw" sort={sort} onSort={toggleSort} />
                      <SortableTh label="利润率" keyName="profit_margin" sort={sort} onSort={toggleSort} />
                      <th className="border-b border-line px-4 py-3">供应商链接</th>
                      <th className="border-b border-line px-4 py-3">开发状态</th>
                      <SortableTh label="推荐等级" keyName="recommendation_grade" sort={sort} onSort={toggleSort} />
                      <SortableTh label="优先级" keyName="priority" sort={sort} onSort={toggleSort} />
                      <th className="border-b border-line px-4 py-3">备注</th>
                      <th className="border-b border-line px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.id} className={`group border-t border-line transition hover:bg-[#f3f7f3] ${row.profit_krw < 0 ? "bg-red-50/40" : ""}`}>
                        <td className="sticky left-0 z-[2] border-b border-line bg-white px-3 py-3 group-hover:bg-[#f3f7f3]"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, row.id] : selectedIds.filter((id) => id !== row.id))} /></td>
                        <td className="sticky left-10 z-[2] border-b border-line bg-white px-4 py-3 group-hover:bg-[#f3f7f3]">
                          <div className="h-14 w-14 overflow-hidden rounded-2xl border border-line bg-[#f5f6f1]">
                            {row.product_image_url ? <img className="h-full w-full object-cover" src={row.product_image_url} alt="" /> : <PackageSearch className="m-4 h-6 w-6 text-muted" />}
                          </div>
                        </td>
                        <td className="sticky left-[136px] z-[2] max-w-[260px] border-b border-line bg-white px-4 py-3 font-bold text-ink group-hover:bg-[#f3f7f3]">{row.product_name}</td>
                        <td className="border-b border-line px-4 py-3">{emptyWarn(row.category)}</td>
                        <td className="border-b border-line px-4 py-3">{row.coupang_url ? <a className="inline-flex items-center gap-1 font-bold text-[#17483f]" href={row.coupang_url} target="_blank">Open<ExternalLink size={13} /></a> : emptyWarn("")}</td>
                        <td className="border-b border-line px-4 py-3 font-semibold tabular-nums">{krw(row.selling_price_krw)}</td>
                        <td className="border-b border-line px-4 py-3">{formatDate(row.analysis_date)}</td>
                        <td className="border-b border-line px-4 py-3 font-semibold tabular-nums">{row.estimated_monthly_sales.toLocaleString()}</td>
                        <td className="border-b border-line px-4 py-3 font-semibold tabular-nums">{krw(row.estimated_monthly_revenue_krw)}</td>
                        <td className="border-b border-line px-4 py-3">{cny(row.purchase_price_cny)}</td>
                        <td className="border-b border-line px-4 py-3">{cny(row.international_shipping_cny)}</td>
                        <td className="border-b border-line px-4 py-3 font-semibold">{cny(row.landed_cost_cny)}</td>
                        <td className="border-b border-line px-4 py-3">{row.exchange_rate}</td>
                        <td className="border-b border-line px-4 py-3">{krw(row.landed_cost_krw)}</td>
                        <td className="border-b border-line px-4 py-3 font-semibold">{krw(row.expected_selling_price_krw)}</td>
                        <td className="border-b border-line px-4 py-3">{pct(row.platform_commission_rate)}</td>
                        <td className="border-b border-line px-4 py-3">{krw(row.platform_commission_krw)}</td>
                        <td className="border-b border-line px-4 py-3">{krw(row.korean_shipping_fee_krw)}</td>
                        <td className="border-b border-line px-4 py-3">{krw(row.ad_cost_krw)}</td>
                        <td className="border-b border-line px-4 py-3 font-semibold">{krw(row.total_cost_krw)}</td>
                        <td className={`border-b border-line px-4 py-3 font-bold ${row.profit_krw < 0 ? "text-red-700" : "text-emerald-700"}`}>{krw(row.profit_krw)}</td>
                        <td className="border-b border-line px-4 py-3"><MarginPill value={row.profit_margin} /></td>
                        <td className="border-b border-line px-4 py-3">{row.supplier_url ? <a className="font-bold text-[#17483f]" href={row.supplier_url} target="_blank">Supplier</a> : "-"}</td>
                        <td className="border-b border-line px-4 py-3"><Tag>{c.status[row.development_status]}</Tag></td>
                        <td className="border-b border-line px-4 py-3"><Tag tone={row.recommendation_grade === "A_PLUS" || row.recommendation_grade === "A" ? "good" : row.recommendation_grade === "D" ? "risk" : "neutral"}>{c.grade[row.recommendation_grade]}</Tag></td>
                        <td className="border-b border-line px-4 py-3"><Tag tone={row.priority === "high" ? "risk" : row.priority === "medium" ? "watch" : "neutral"}>{c.priority[row.priority]}</Tag></td>
                        <td className="max-w-[220px] truncate border-b border-line px-4 py-3 text-muted">{row.notes || "-"}</td>
                        <td className="border-b border-line px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <IconButton label={c.actions.edit} icon={<Edit3 size={14} />} onClick={() => openEdit(row)} />
                            <IconButton label={c.actions.copy} icon={<Copy size={14} />} onClick={() => duplicate(row)} />
                            <IconButton danger label={c.actions.delete} icon={<Trash2 size={14} />} onClick={() => remove([row.id])} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>{filtered.length} rows · {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button>
                <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-white/50 px-6 py-14 text-center">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-[#17483f]" />
            <p className="mt-4 text-lg font-bold text-ink">{c.empty}</p>
            <button className="mt-5 erp-button-primary inline-flex items-center gap-2 px-4 py-2 font-bold" onClick={openCreate}><Plus size={16} />{c.add}</button>
          </div>
        )}
      </Panel>

      {drawer ? <Drawer c={c} mode={drawer} form={form} setForm={setForm} onClose={() => setDrawer(null)} onSubmit={submit} /> : null}
    </div>
  );
}

function Drawer({ c, mode, form, setForm, onClose, onSubmit }: { c: typeof copyText.zh; mode: DrawerMode; form: FormState; setForm: (form: FormState) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const calc = compute(form);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#071512]/40 backdrop-blur-sm" onClick={onClose}>
      <form className="h-full w-full max-w-5xl overflow-y-auto border-l border-white/40 bg-[#f6f7f1] p-6 shadow-lift" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="premium-section-eyebrow">PRODUCT TEST</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{mode === "edit" ? c.actions.edit : c.add}</h2>
          </div>
          <button type="button" className="erp-button-subtle p-2" onClick={onClose}><X size={18} /></button>
        </div>

        <FormSection title={c.sections.basic}>
          <Field label="产品图片 URL" value={form.product_image_url} onChange={(value) => setForm({ ...form, product_image_url: value })} />
          <Field label="产品名称" value={form.product_name} required onChange={(value) => setForm({ ...form, product_name: value })} />
          <Field label="类目" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
          <Field label="Coupang链接" value={form.coupang_url} onChange={(value) => setForm({ ...form, coupang_url: value })} />
          <Field label="供应商链接" value={form.supplier_url} onChange={(value) => setForm({ ...form, supplier_url: value })} />
          <Field label="分析日期" type="date" value={form.analysis_date} onChange={(value) => setForm({ ...form, analysis_date: value })} />
        </FormSection>

        <FormSection title={c.sections.sales}>
          <Field label="销售价格(KRW)" type="number" value={form.selling_price_krw} onChange={(value) => setForm({ ...form, selling_price_krw: value })} />
          <Field label="一个月预计销量" type="number" value={form.estimated_monthly_sales} onChange={(value) => setForm({ ...form, estimated_monthly_sales: value })} />
          <Field label="预计售价(KRW)" type="number" value={form.expected_selling_price_krw} onChange={(value) => setForm({ ...form, expected_selling_price_krw: value })} />
          <ReadOnlyMetric label="一个月预计销售额" value={krw(calc.monthlyRevenue)} />
        </FormSection>

        <FormSection title={c.sections.cost}>
          <Field label="采购价(CNY)" type="number" value={form.purchase_price_cny} onChange={(value) => setForm({ ...form, purchase_price_cny: value })} />
          <Field label="国际物流费(CNY)" type="number" value={form.international_shipping_cny} onChange={(value) => setForm({ ...form, international_shipping_cny: value })} />
          <Field label="汇率" type="number" value={form.exchange_rate} onChange={(value) => setForm({ ...form, exchange_rate: value })} />
          <Field label="平台佣金率(%)" type="number" value={form.platform_commission_rate} onChange={(value) => setForm({ ...form, platform_commission_rate: value })} />
          <Field label="韩国物流费(KRW)" type="number" value={form.korean_shipping_fee_krw} onChange={(value) => setForm({ ...form, korean_shipping_fee_krw: value })} />
          <Field label="广告费(KRW)" type="number" value={form.ad_cost_krw} onChange={(value) => setForm({ ...form, ad_cost_krw: value })} />
        </FormSection>

        <FormSection title={c.sections.result}>
          <ReadOnlyMetric label="到韩总成本(CNY)" value={cny(calc.landedCny)} />
          <ReadOnlyMetric label="到韩总成本(KRW)" value={krw(calc.landedKrw)} />
          <ReadOnlyMetric label="平台佣金(KRW)" value={krw(calc.commission)} />
          <ReadOnlyMetric label="总成本(KRW)" value={krw(calc.totalCost)} />
          <ReadOnlyMetric label="利润(KRW)" value={krw(calc.profit)} tone={calc.profit < 0 ? "risk" : "good"} />
          <ReadOnlyMetric label="利润率(%)" value={pct(calc.margin)} tone={calc.margin >= 40 ? "good" : calc.margin < 10 ? "risk" : "watch"} />
        </FormSection>

        <FormSection title={c.sections.development}>
          <SelectField label="开发状态" value={form.development_status} options={statusOptions} labelMap={c.status} onChange={(value) => setForm({ ...form, development_status: value as DevelopmentStatus })} />
          <SelectField label="推荐等级" value={form.recommendation_grade} options={gradeOptions} labelMap={c.grade} onChange={(value) => setForm({ ...form, recommendation_grade: value as RecommendationGrade })} />
          <SelectField label="优先级" value={form.priority} options={priorityOptions} labelMap={c.priority} onChange={(value) => setForm({ ...form, priority: value as Priority })} />
        </FormSection>

        <FormSection title={c.sections.notes}>
          <label className="md:col-span-3">
            <span className="mb-1 block text-xs font-bold text-muted">备注</span>
            <textarea className="min-h-28 w-full" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
        </FormSection>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="erp-button-subtle px-4 py-2 font-bold" onClick={onClose}>{c.actions.cancel}</button>
          <button type="submit" className="erp-button-primary px-4 py-2 font-bold">{c.actions.save}</button>
        </div>
      </form>
    </div>
  );
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function emptyWarn(value: string | null | undefined) {
  return value ? value : <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs font-bold text-yellow-800">缺少数据</span>;
}

function marginTone(value: number) {
  if (value >= 40) return "good";
  if (value >= 20) return "blue";
  if (value >= 10) return "watch";
  return "risk";
}

function MarginPill({ value }: { value: number }) {
  const tone = marginTone(value);
  const styles = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "blue" ? "border-blue-200 bg-blue-50 text-blue-700" : tone === "watch" ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-red-200 bg-red-50 text-red-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles}`}>{pct(value)}</span>;
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

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; required?: boolean }) {
  return <label><span className="mb-1 block text-xs font-bold text-muted">{label}{required ? " *" : ""}</span><input className="w-full" type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ value, options, allLabel, labelMap, onChange }: { value: string; options: string[]; allLabel: string; labelMap?: Record<string, string>; onChange: (value: string) => void }) {
  return <select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{allLabel}</option>{options.map((option) => <option key={option} value={option}>{labelMap?.[option] ?? option}</option>)}</select>;
}

function SelectField({ label, value, options, labelMap, onChange }: { label: string; value: string; options: string[]; labelMap: Record<string, string>; onChange: (value: string) => void }) {
  return <label><span className="mb-1 block text-xs font-bold text-muted">{label}</span><select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labelMap[option]}</option>)}</select></label>;
}

function ReadOnlyMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "risk" ? "text-red-700" : tone === "watch" ? "text-yellow-800" : "text-ink";
  return <div className="rounded-2xl border border-line bg-[#f3f6f1] px-3 py-2"><div className="text-xs font-bold text-muted">{label}</div><div className={`mt-1 font-semibold tabular-nums ${color}`}>{value}</div></div>;
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const styles = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "risk" ? "border-red-200 bg-red-50 text-red-700" : tone === "watch" ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-[#17483f]/15 bg-[#e8f1ed] text-[#17483f]";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles}`}>{children}</span>;
}

function IconButton({ label, icon, onClick, danger = false }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" title={label} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${danger ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-white/80 text-ink hover:bg-[#eef4ef]"}`} onClick={onClick}>{icon}</button>;
}

function SortableTh({ label, keyName, sort, onSort, stickyLeft }: { label: string; keyName: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (key: SortKey) => void; stickyLeft?: string }) {
  return <th className={`${stickyLeft ? `sticky ${stickyLeft} z-[4] bg-[#eef3ef]` : ""} border-b border-line px-4 py-3`}><button className="font-bold" onClick={() => onSort(keyName)}>{label}{sort.key === keyName ? sort.dir === "asc" ? " ↑" : " ↓" : ""}</button></th>;
}

function Skeleton() {
  return <div className="grid gap-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/65" />)}</div>;
}
