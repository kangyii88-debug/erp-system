"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Boxes,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  Eye,
  Gauge,
  Layers3,
  Link as LinkIcon,
  MousePointerClick,
  PackageCheck,
  Plus,
  Radar,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";

type Phase = "existing" | "new_test" | "hero" | "watch" | "problem" | "retire";
type Status = "active" | "testing" | "optimizing" | "paused" | "retired";
type NoteType = "review" | "test" | "ad" | "stock" | "issue" | "decision";
type Decision = "scale" | "keep" | "optimize" | "reduce" | "pause" | "retire";

type AnalysisItem = {
  id: string;
  user_id: string;
  linked_product_id: string | null;
  product_name: string;
  sku: string;
  product_series: string | null;
  phase: Phase;
  coupang_url: string | null;
  cost: number;
  sale_price: number;
  target_margin_rate: number;
  status: Status;
  owner: string | null;
  test_start_date: string | null;
  test_goal: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  color: string | null;
  size: string | null;
  purchase_price: number;
  sale_price: number;
  platform_fee_rate: number;
  memo: string | null;
  inventory_balances?: { current_stock: number } | { current_stock: number }[] | null;
};

type StockMovementRow = {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  happened_at: string;
  products?: Pick<ProductRow, "id" | "name" | "sku" | "color" | "size" | "sale_price" | "purchase_price" | "platform_fee_rate"> | null;
};

type RawStockMovementRow = Omit<StockMovementRow, "products"> & {
  products?: Pick<ProductRow, "id" | "name" | "sku" | "color" | "size" | "sale_price" | "purchase_price" | "platform_fee_rate"> | Pick<ProductRow, "id" | "name" | "sku" | "color" | "size" | "sale_price" | "purchase_price" | "platform_fee_rate">[] | null;
};

type AdRecord = {
  id: string;
  record_date: string;
  sku: string;
  product_name: string;
  ad_spend: number;
  ad_sales: number;
  clicks: number;
  impressions: number;
  ad_sales_count: number;
  ad_order_count: number;
};

type CustomerIssue = {
  id: string;
  issue_date: string;
  sku: string;
  product_name: string;
  issue_category: string;
  status: string;
};

type AnalysisNote = {
  id: string;
  analysis_item_id: string;
  note_date: string;
  note_type: NoteType;
  title: string;
  content: string | null;
};

type CompetitorProduct = {
  id: string;
  analysis_item_id: string;
  competitor_name: string | null;
  product_url: string | null;
  price: number;
  rating: number | null;
  review_count: number;
  key_selling_points: string | null;
  risk_notes: string | null;
};

type ItemForm = {
  linked_product_id: string;
  product_name: string;
  sku: string;
  product_series: string;
  phase: Phase;
  coupang_url: string;
  cost: string;
  sale_price: string;
  target_margin_rate: string;
  status: Status;
  owner: string;
  test_start_date: string;
  test_goal: string;
  notes: string;
};

const emptyForm: ItemForm = {
  linked_product_id: "",
  product_name: "",
  sku: "",
  product_series: "",
  phase: "new_test",
  coupang_url: "",
  cost: "",
  sale_price: "",
  target_margin_rate: "25",
  status: "testing",
  owner: "",
  test_start_date: "",
  test_goal: "",
  notes: ""
};

const copy = {
  zh: {
    eyebrow: "PRODUCT INTELLIGENCE CENTER",
    title: "产品分析与新品测试中心",
    subtitle: "把所有需要分析的老品、新品、主推款和问题款集中管理，用真实销售、广告、库存和客诉数据判断下一步经营动作。",
    add: "新增分析产品",
    edit: "编辑分析产品",
    databaseHint: "数据库表尚未创建：请在 Supabase SQL Editor 执行 supabase/migrations/create-product-intelligence-center.sql。",
    emptyTitle: "暂无分析产品",
    emptyText: "点击新增分析产品，把需要观察、测试或主推的 SKU 加入产品分析中心。",
    tabs: { all: "全部产品", new_test: "新品测试", hero: "主推产品", problem: "问题产品", retire: "待淘汰" },
    phase: { existing: "老品", new_test: "新品测试", hero: "主推款", watch: "观察款", problem: "问题款", retire: "淘汰款" },
    status: { active: "运行中", testing: "测试中", optimizing: "优化中", paused: "暂停", retired: "已淘汰" },
    kpi: {
      sales: "近30天销量",
      revenue: "近30天销售额",
      profit: "预估利润",
      margin: "利润率",
      adSpend: "广告花费",
      roas: "ROAS",
      stock: "当前库存",
      issues: "客诉数量"
    },
    score: "综合经营评分",
    verdict: "经营决策",
    productList: "分析产品库",
    dashboard: "经营驾驶舱",
    testCenter: "新品测试中心",
    skuMatrix: "尺寸 / 颜色表现",
    adCenter: "广告与利润联动",
    riskCenter: "库存与客诉风险",
    notes: "复盘记录",
    competitors: "竞品观察",
    noSelected: "请选择一个分析产品。",
    noData: "暂无真实经营数据，录入销售、广告、库存或客诉后会自动汇总。",
    actions: { save: "保存", cancel: "取消", edit: "编辑", delete: "删除", close: "关闭" },
    fields: {
      linked: "关联现有 SKU",
      productName: "产品名称",
      sku: "SKU",
      series: "产品系列",
      phase: "产品阶段",
      status: "状态",
      url: "Coupang 链接",
      cost: "成本",
      price: "售价",
      targetMargin: "目标利润率 %",
      owner: "负责人",
      testStart: "测试开始日期",
      testGoal: "测试目标",
      notes: "备注"
    },
    decisions: {
      scale: "强推 / 加预算",
      keep: "继续观察",
      optimize: "优化后再推",
      reduce: "降低预算",
      pause: "暂停测试",
      retire: "准备淘汰"
    }
  },
  ko: {
    eyebrow: "PRODUCT INTELLIGENCE CENTER",
    title: "상품 분석 및 신제품 테스트 센터",
    subtitle: "분석이 필요한 기존 상품, 신제품, 주력 상품, 문제 상품을 한곳에서 관리하고 실제 판매, 광고, 재고, 고객 이슈로 다음 액션을 판단합니다.",
    add: "분석 상품 추가",
    edit: "분석 상품 수정",
    databaseHint: "데이터베이스 테이블이 없습니다. Supabase SQL Editor에서 supabase/migrations/create-product-intelligence-center.sql을 실행하세요.",
    emptyTitle: "분석 상품 없음",
    emptyText: "분석 상품 추가를 눌러 관찰, 테스트, 주력 SKU를 등록하세요.",
    tabs: { all: "전체 상품", new_test: "신제품 테스트", hero: "주력 상품", problem: "문제 상품", retire: "퇴출 후보" },
    phase: { existing: "기존 상품", new_test: "신제품 테스트", hero: "주력 상품", watch: "관찰 상품", problem: "문제 상품", retire: "퇴출 상품" },
    status: { active: "운영중", testing: "테스트중", optimizing: "최적화중", paused: "중지", retired: "퇴출" },
    kpi: {
      sales: "최근 30일 판매량",
      revenue: "최근 30일 매출",
      profit: "예상 이익",
      margin: "이익률",
      adSpend: "광고비",
      roas: "ROAS",
      stock: "현재 재고",
      issues: "고객 이슈"
    },
    score: "종합 경영 점수",
    verdict: "경영 의사결정",
    productList: "분석 상품库",
    dashboard: "경영 대시보드",
    testCenter: "신제품 테스트 센터",
    skuMatrix: "사이즈 / 색상 성과",
    adCenter: "광고 및 이익 연동",
    riskCenter: "재고 및 고객 이슈 리스크",
    notes: "리뷰 기록",
    competitors: "경쟁 상품 관찰",
    noSelected: "분석 상품을 선택하세요.",
    noData: "실제 경영 데이터가 없습니다. 판매, 광고, 재고, 고객 이슈를 입력하면 자동으로 집계됩니다.",
    actions: { save: "저장", cancel: "취소", edit: "수정", delete: "삭제", close: "닫기" },
    fields: {
      linked: "기존 SKU 연결",
      productName: "상품명",
      sku: "SKU",
      series: "상품 시리즈",
      phase: "상품 단계",
      status: "상태",
      url: "Coupang 링크",
      cost: "원가",
      price: "판매가",
      targetMargin: "목표 이익률 %",
      owner: "담당자",
      testStart: "테스트 시작일",
      testGoal: "테스트 목표",
      notes: "메모"
    },
    decisions: {
      scale: "강력 추천 / 예산 증액",
      keep: "계속 관찰",
      optimize: "최적화 후 재추진",
      reduce: "예산 축소",
      pause: "테스트 중지",
      retire: "퇴출 준비"
    }
  }
};

const phaseOptions: Phase[] = ["existing", "new_test", "hero", "watch", "problem", "retire"];
const statusOptions: Status[] = ["active", "testing", "optimizing", "paused", "retired"];
const filterTabs = ["all", "new_test", "hero", "problem", "retire"] as const;

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function offsetDate(days: number) {
  const date = new Date(`${todayKey()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA");
}

function num(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function won(value: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function getStock(product: ProductRow | undefined) {
  const balance = product?.inventory_balances;
  if (Array.isArray(balance)) return num(balance[0]?.current_stock);
  return num(balance?.current_stock);
}

export default function SingleProductReportPage() {
  return (
    <AppShell>
      <ProductIntelligenceContent />
    </AppShell>
  );
}

function ProductIntelligenceContent() {
  const { language, formatDate } = useLanguage();
  const c = copy[language];
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [issues, setIssues] = useState<CustomerIssue[]>([]);
  const [notes, setNotes] = useState<AnalysisNote[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<"all" | Phase>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setMessage("");
    const results = await Promise.all([
      supabase.from("product_analysis_items").select("*").order("updated_at", { ascending: false }),
      supabase.from("products").select("id,name,sku,color,size,purchase_price,sale_price,platform_fee_rate,memo,inventory_balances(current_stock)").order("name"),
      supabase.from("stock_movements").select("id,product_id,type,quantity,happened_at,products(id,name,sku,color,size,sale_price,purchase_price,platform_fee_rate)").gte("happened_at", `${offsetDate(-90)}T00:00:00`).order("happened_at", { ascending: false }),
      supabase.from("advertising_daily_records").select("id,record_date,sku,product_name,ad_spend,ad_sales,clicks,impressions,ad_sales_count,ad_order_count").gte("record_date", offsetDate(-90)),
      supabase.from("customer_issues").select("id,issue_date,sku,product_name,issue_category,status").gte("issue_date", offsetDate(-90)),
      supabase.from("product_analysis_notes").select("*").order("note_date", { ascending: false }),
      supabase.from("competitor_products").select("*").order("updated_at", { ascending: false })
    ]);

    const firstError = results.find((result) => result.error)?.error;
    if (firstError) {
      setMessage(c.databaseHint);
      setLoading(false);
      return;
    }

    const [itemResult, productResult, movementResult, adResult, issueResult, noteResult, competitorResult] = results;
    setItems((itemResult.data ?? []) as AnalysisItem[]);
    setProducts(((productResult.data ?? []) as ProductRow[]).filter((product) => !String(product.memo ?? "").startsWith("__ERP_DELETED__")));
    setMovements(((movementResult.data ?? []) as unknown as RawStockMovementRow[]).map((row) => ({
      ...row,
      products: Array.isArray(row.products) ? row.products[0] ?? null : row.products ?? null
    })));
    setAds((adResult.data ?? []) as AdRecord[]);
    setIssues((issueResult.data ?? []) as CustomerIssue[]);
    setNotes((noteResult.data ?? []) as AnalysisNote[]);
    setCompetitors((competitorResult.data ?? []) as CompetitorProduct[]);

    const nextItems = (itemResult.data ?? []) as AnalysisItem[];
    if (!selectedId && nextItems.length) setSelectedId(nextItems[0].id);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.phase !== filter) return false;
      if (!keyword) return true;
      return `${item.product_name} ${item.sku} ${item.product_series ?? ""}`.toLowerCase().includes(keyword);
    });
  }, [filter, items, search]);

  const selected = items.find((item) => item.id === selectedId) ?? filteredItems[0] ?? items[0];
  const selectedProduct = selected ? products.find((product) => product.id === selected.linked_product_id || product.sku === selected.sku) : undefined;
  const analysis = useMemo(() => (selected ? buildAnalysis(selected, selectedProduct, movements, ads, issues) : null), [ads, issues, movements, selected, selectedProduct]);
  const selectedNotes = selected ? notes.filter((note) => note.analysis_item_id === selected.id).slice(0, 5) : [];
  const selectedCompetitors = selected ? competitors.filter((row) => row.analysis_item_id === selected.id).slice(0, 4) : [];
  const skuMatrix = selected ? buildSkuMatrix(selected, movements) : [];

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (item: AnalysisItem) => {
    setEditingId(item.id);
    setForm({
      linked_product_id: item.linked_product_id ?? "",
      product_name: item.product_name,
      sku: item.sku,
      product_series: item.product_series ?? "",
      phase: item.phase,
      coupang_url: item.coupang_url ?? "",
      cost: String(item.cost || ""),
      sale_price: String(item.sale_price || ""),
      target_margin_rate: String(item.target_margin_rate || 25),
      status: item.status,
      owner: item.owner ?? "",
      test_start_date: item.test_start_date ?? "",
      test_goal: item.test_goal ?? "",
      notes: item.notes ?? ""
    });
    setShowForm(true);
  };

  const pickProduct = (productId: string) => {
    const product = products.find((row) => row.id === productId);
    setForm({
      ...form,
      linked_product_id: productId,
      product_name: product?.name ?? form.product_name,
      sku: product?.sku ?? form.sku,
      cost: product ? String(product.purchase_price ?? 0) : form.cost,
      sale_price: product ? String(product.sale_price ?? 0) : form.sale_price
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const payload = {
      user_id: data.user.id,
      linked_product_id: form.linked_product_id || null,
      product_name: form.product_name.trim(),
      sku: form.sku.trim(),
      product_series: form.product_series.trim() || null,
      phase: form.phase,
      coupang_url: form.coupang_url.trim() || null,
      cost: num(form.cost),
      sale_price: num(form.sale_price),
      target_margin_rate: num(form.target_margin_rate) || 25,
      status: form.status,
      owner: form.owner.trim() || null,
      test_start_date: form.test_start_date || null,
      test_goal: form.test_goal.trim() || null,
      notes: form.notes.trim() || null
    };
    if (!payload.product_name || !payload.sku) {
      setMessage(language === "zh" ? "请填写产品名称和 SKU。" : "상품명과 SKU를 입력하세요.");
      return;
    }
    const result = editingId
      ? await supabase.from("product_analysis_items").update(payload).eq("id", editingId)
      : await supabase.from("product_analysis_items").insert(payload);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    await loadData();
  };

  const deleteItem = async (item: AnalysisItem) => {
    if (!window.confirm(`${c.actions.delete}: ${item.product_name}?`)) return;
    const { error } = await supabase.from("product_analysis_items").delete().eq("id", item.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSelectedId("");
    await loadData();
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d8ddd4] bg-[#f8faf6] shadow-[0_28px_90px_rgba(18,31,27,0.10)]">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-96 bg-[radial-gradient(circle,rgba(28,116,99,0.22),transparent_65%)]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-[34rem] -translate-x-1/2 bg-[radial-gradient(circle,rgba(188,167,122,0.22),transparent_66%)]" />
        <div className="relative grid gap-6 p-6 xl:grid-cols-[1.05fr_0.95fr] xl:p-8">
          <div>
            <div className="premium-section-eyebrow">{c.eyebrow}</div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-6xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted md:text-base">{c.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <HeroChip icon={Brain} label={language === "zh" ? "真实数据决策" : "실데이터 의사결정"} />
              <HeroChip icon={Radar} label={language === "zh" ? "新品测试雷达" : "신제품 테스트 레이더"} />
              <HeroChip icon={Sparkles} label={language === "zh" ? "经营建议自动生成" : "경영 제안 자동 생성"} />
            </div>
          </div>
          <div className="rounded-[28px] border border-[#113b34]/15 bg-[#102b27] p-6 text-white shadow-[0_24px_70px_rgba(16,43,39,0.22)]">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#d7c487]">
                <Gauge className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#d7c487]">{c.verdict}</div>
                <h2 className="mt-1 text-2xl font-semibold">{analysis ? c.decisions[analysis.decision] : c.noSelected}</h2>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <DarkMetric label={c.score} value={analysis ? `${analysis.score}` : "-"} />
              <DarkMetric label={c.kpi.roas} value={analysis ? analysis.roas.toFixed(2) : "-"} />
              <DarkMetric label={c.kpi.stock} value={analysis ? String(analysis.stock) : "-"} />
              <DarkMetric label={c.kpi.margin} value={analysis ? pct(analysis.marginRate) : "-"} />
            </div>
          </div>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <Panel title={c.productList} eyebrow="ANALYSIS LIBRARY" action={<button className="erp-button-primary inline-flex items-center gap-2 px-3 py-2 text-sm font-bold" onClick={startCreate}><Plus size={16} />{c.add}</button>}>
            <div className="mb-4 flex flex-wrap gap-2">
              {filterTabs.map((key) => (
                <button key={key} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === key ? "bg-[#17483f] text-white" : "border border-line bg-white/70 text-muted"}`} onClick={() => setFilter(key)}>
                  {key === "all" ? c.tabs.all : c.tabs[key]}
                </button>
              ))}
            </div>
            <label className="relative mb-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="w-full pl-9" value={search} placeholder="SKU / Product" onChange={(event) => setSearch(event.target.value)} />
            </label>
            {loading ? <SkeletonList /> : filteredItems.length ? (
              <div className="space-y-2">
                {filteredItems.map((item) => {
                  const selectedClass = selected?.id === item.id;
                  return (
                    <button key={item.id} className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${selectedClass ? "border-[#17483f]/30 bg-[#e8f1ed] shadow-card" : "border-line bg-white/70"}`} onClick={() => setSelectedId(item.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-ink">{item.product_name}</div>
                          <div className="mt-1 text-xs font-semibold text-muted">{item.sku}</div>
                        </div>
                        <StatusPill>{c.phase[item.phase]}</StatusPill>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-white/50 px-4 py-8 text-center">
                <PackageCheck className="mx-auto h-9 w-9 text-[#17483f]" />
                <div className="mt-3 font-semibold text-ink">{c.emptyTitle}</div>
                <p className="mt-2 text-sm leading-6 text-muted">{c.emptyText}</p>
              </div>
            )}
          </Panel>
        </aside>

        <main className="space-y-6">
          {selected && analysis ? (
            <>
              <Panel
                title={selected.product_name}
                eyebrow={c.dashboard}
                action={
                  <div className="flex gap-2">
                    {selected.coupang_url ? <a className="erp-button-subtle inline-flex items-center gap-2 px-3 py-2 text-sm font-bold" href={selected.coupang_url} target="_blank"><LinkIcon size={16} />Coupang</a> : null}
                    <button className="erp-button-subtle inline-flex items-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => startEdit(selected)}><Edit3 size={16} />{c.actions.edit}</button>
                    <button className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" onClick={() => deleteItem(selected)}><Trash2 size={16} /></button>
                  </div>
                }
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Kpi icon={TrendingUp} label={c.kpi.sales} value={String(analysis.salesQty)} helper={analysis.salesQty ? "Real sales" : c.noData} />
                  <Kpi icon={CircleDollarSign} label={c.kpi.revenue} value={won(analysis.revenue)} />
                  <Kpi icon={BadgeCheck} label={c.kpi.profit} value={won(analysis.profit)} tone={analysis.profit >= 0 ? "good" : "risk"} />
                  <Kpi icon={Target} label={c.score} value={`${analysis.score}`} helper={c.decisions[analysis.decision]} tone={analysis.score >= 75 ? "good" : analysis.score < 45 ? "risk" : "watch"} />
                  <Kpi icon={MousePointerClick} label={c.kpi.adSpend} value={won(analysis.adSpend)} />
                  <Kpi icon={Activity} label={c.kpi.roas} value={analysis.roas.toFixed(2)} tone={analysis.roas >= 4 ? "good" : "watch"} />
                  <Kpi icon={Boxes} label={c.kpi.stock} value={String(analysis.stock)} tone={analysis.stock < 10 ? "risk" : "neutral"} />
                  <Kpi icon={ShieldAlert} label={c.kpi.issues} value={String(analysis.issueCount)} tone={analysis.issueCount ? "watch" : "good"} />
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Panel title={c.testCenter} eyebrow="NEW PRODUCT TEST">
                  <div className="grid gap-4 md:grid-cols-3">
                    <ScoreCard label={language === "zh" ? "测试天数" : "테스트 일수"} value={selected.test_start_date ? `${Math.max(1, Math.ceil((Date.now() - new Date(selected.test_start_date).getTime()) / 86400000))}` : "-"} />
                    <ScoreCard label={language === "zh" ? "测试目标" : "테스트 목표"} value={selected.test_goal || "-"} />
                    <ScoreCard label={language === "zh" ? "当前阶段" : "현재 단계"} value={c.phase[selected.phase]} />
                  </div>
                  <DecisionStrip analysis={analysis} labels={c.decisions} />
                </Panel>

                <Panel title={c.adCenter} eyebrow="AD PROFIT LINK">
                  <InsightLine label={language === "zh" ? "广告成本占比" : "광고비 비중"} value={analysis.revenue ? pct((analysis.adSpend / analysis.revenue) * 100) : "0.0%"} tone={analysis.revenue && analysis.adSpend / analysis.revenue > 0.25 ? "risk" : "good"} />
                  <InsightLine label={language === "zh" ? "广告订单数" : "광고 주문수"} value={String(analysis.adOrders)} />
                  <InsightLine label={language === "zh" ? "广告成交数" : "광고 판매수"} value={String(analysis.adSalesCount)} />
                  <InsightLine label={language === "zh" ? "利润率 vs 目标" : "이익률 vs 목표"} value={`${pct(analysis.marginRate)} / ${pct(selected.target_margin_rate)}`} tone={analysis.marginRate >= selected.target_margin_rate ? "good" : "watch"} />
                </Panel>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title={c.skuMatrix} eyebrow="SKU MATRIX">
                  {skuMatrix.length ? <Matrix rows={skuMatrix} /> : <PanelEmpty text={c.noData} />}
                </Panel>
                <Panel title={c.riskCenter} eyebrow="RISK RADAR">
                  <RiskRadar analysis={analysis} />
                </Panel>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title={c.notes} eyebrow="REVIEW LOG">
                  {selectedNotes.length ? selectedNotes.map((note) => <NoteCard key={note.id} note={note} formatDate={formatDate} />) : <PanelEmpty text={language === "zh" ? "暂无复盘记录。" : "리뷰 기록이 없습니다."} />}
                </Panel>
                <Panel title={c.competitors} eyebrow="COMPETITOR WATCH">
                  {selectedCompetitors.length ? selectedCompetitors.map((row) => <CompetitorCard key={row.id} row={row} />) : <PanelEmpty text={language === "zh" ? "暂无竞品记录，后续可以维护竞品价格、评分和卖点。" : "경쟁 상품 기록이 없습니다."} />}
                </Panel>
              </div>
            </>
          ) : (
            <Panel title={c.emptyTitle} eyebrow="EMPTY">
              <div className="rounded-3xl border border-dashed border-line bg-white/55 px-6 py-16 text-center">
                <Rocket className="mx-auto h-12 w-12 text-[#17483f]" />
                <h2 className="mt-4 text-2xl font-semibold text-ink">{c.emptyTitle}</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{c.emptyText}</p>
                <button className="mt-5 erp-button-primary inline-flex items-center gap-2 px-4 py-2 font-bold" onClick={startCreate}><Plus size={16} />{c.add}</button>
              </div>
            </Panel>
          )}
        </main>
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-[#071512]/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <form className="h-full w-full max-w-4xl overflow-y-auto border-l border-white/40 bg-[#f6f7f1] p-6 shadow-lift" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="premium-section-eyebrow">PRODUCT SETUP</div>
                <h2 className="mt-2 text-3xl font-semibold text-ink">{editingId ? c.edit : c.add}</h2>
              </div>
              <button type="button" className="erp-button-subtle p-2" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-bold text-muted">{c.fields.linked}</span>
                <select className="w-full" value={form.linked_product_id} onChange={(event) => pickProduct(event.target.value)}>
                  <option value="">-</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                </select>
              </label>
              <Field label={c.fields.productName} value={form.product_name} onChange={(value) => setForm({ ...form, product_name: value })} required />
              <Field label={c.fields.sku} value={form.sku} onChange={(value) => setForm({ ...form, sku: value })} required />
              <Field label={c.fields.series} value={form.product_series} onChange={(value) => setForm({ ...form, product_series: value })} />
              <SelectField label={c.fields.phase} value={form.phase} options={phaseOptions} labelMap={c.phase} onChange={(value) => setForm({ ...form, phase: value as Phase })} />
              <SelectField label={c.fields.status} value={form.status} options={statusOptions} labelMap={c.status} onChange={(value) => setForm({ ...form, status: value as Status })} />
              <Field label={c.fields.url} value={form.coupang_url} onChange={(value) => setForm({ ...form, coupang_url: value })} />
              <Field label={c.fields.cost} value={form.cost} onChange={(value) => setForm({ ...form, cost: value })} type="number" />
              <Field label={c.fields.price} value={form.sale_price} onChange={(value) => setForm({ ...form, sale_price: value })} type="number" />
              <Field label={c.fields.targetMargin} value={form.target_margin_rate} onChange={(value) => setForm({ ...form, target_margin_rate: value })} type="number" />
              <Field label={c.fields.owner} value={form.owner} onChange={(value) => setForm({ ...form, owner: value })} />
              <Field label={c.fields.testStart} value={form.test_start_date} onChange={(value) => setForm({ ...form, test_start_date: value })} type="date" />
              <Field label={c.fields.testGoal} value={form.test_goal} onChange={(value) => setForm({ ...form, test_goal: value })} />
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-bold text-muted">{c.fields.notes}</span>
                <textarea className="min-h-28 w-full" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="erp-button-subtle px-4 py-2 font-bold" onClick={() => setShowForm(false)}>{c.actions.cancel}</button>
              <button type="submit" className="erp-button-primary px-4 py-2 font-bold">{c.actions.save}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function buildAnalysis(item: AnalysisItem, product: ProductRow | undefined, movements: StockMovementRow[], ads: AdRecord[], issues: CustomerIssue[]) {
  const sku = item.sku;
  const productId = item.linked_product_id;
  const saleMovements = movements.filter((row) => row.type === "sale" && (row.product_id === productId || row.products?.sku === sku));
  const salesQty = saleMovements.reduce((sum, row) => sum + Math.abs(num(row.quantity)), 0);
  const salePrice = item.sale_price || product?.sale_price || 0;
  const cost = item.cost || product?.purchase_price || 0;
  const platformFeeRate = product?.platform_fee_rate ?? 11.6;
  const revenue = salesQty * salePrice;
  const matchedAds = ads.filter((row) => row.sku === sku || row.product_name.includes(item.product_name));
  const adSpend = matchedAds.reduce((sum, row) => sum + num(row.ad_spend), 0);
  const adSales = matchedAds.reduce((sum, row) => sum + num(row.ad_sales), 0);
  const adOrders = matchedAds.reduce((sum, row) => sum + num(row.ad_order_count), 0);
  const adSalesCount = matchedAds.reduce((sum, row) => sum + num(row.ad_sales_count), 0);
  const fee = revenue * (platformFeeRate / 100);
  const profit = revenue - salesQty * cost - adSpend - fee;
  const marginRate = revenue ? (profit / revenue) * 100 : 0;
  const roas = adSpend ? adSales / adSpend : 0;
  const stock = getStock(product);
  const matchedIssues = issues.filter((row) => row.sku === sku || row.product_name.includes(item.product_name));
  const issueCount = matchedIssues.length;
  const salesScore = Math.min(100, salesQty * 5);
  const marginScore = Math.max(0, Math.min(100, marginRate * 2.4));
  const roasScore = adSpend ? Math.min(100, roas * 18) : salesQty ? 55 : 25;
  const stockScore = stock <= 0 ? 15 : stock < 10 ? 45 : stock > 180 && salesQty < 5 ? 50 : 82;
  const issueScore = Math.max(10, 100 - issueCount * 18);
  const score = Math.round(salesScore * 0.22 + marginScore * 0.24 + roasScore * 0.24 + stockScore * 0.15 + issueScore * 0.15);
  const decision: Decision = score >= 78 && marginRate >= item.target_margin_rate && (roas >= 4 || !adSpend) ? "scale" : score >= 64 ? "keep" : issueCount >= 3 ? "optimize" : roas > 0 && roas < 2 ? "reduce" : score < 36 ? "pause" : item.phase === "retire" ? "retire" : "optimize";

  return { salesQty, revenue, profit, marginRate, adSpend, adSales, roas, adOrders, adSalesCount, stock, issueCount, score, decision };
}

function buildSkuMatrix(item: AnalysisItem, movements: StockMovementRow[]) {
  const map = new Map<string, { color: string; size: string; qty: number; revenue: number }>();
  movements
    .filter((row) => row.type === "sale" && (row.products?.sku === item.sku || row.products?.name?.includes(item.product_name)))
    .forEach((row) => {
      const color = row.products?.color ?? "-";
      const size = row.products?.size ?? "-";
      const key = `${color}|${size}`;
      const current = map.get(key) ?? { color, size, qty: 0, revenue: 0 };
      current.qty += Math.abs(num(row.quantity));
      current.revenue += Math.abs(num(row.quantity)) * num(row.products?.sale_price);
      map.set(key, current);
    });
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 8);
}

function HeroChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-[#cfd8cf] bg-white/75 px-3 py-1.5 text-xs font-bold text-[#17483f] shadow-sm"><Icon size={14} />{label}</span>;
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><div className="text-xs text-white/58">{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value}</div></div>;
}

function Panel({ eyebrow, title, action, children }: { eyebrow?: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-line bg-card/92 p-5 shadow-card backdrop-blur">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{eyebrow}</p> : null}
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, helper, tone = "neutral" }: { icon: LucideIcon; label: string; value: string; helper?: string; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const toneClass = tone === "good" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : tone === "risk" ? "text-red-700 bg-red-50 border-red-200" : tone === "watch" ? "text-yellow-800 bg-yellow-50 border-yellow-200" : "text-[#17483f] bg-[#e8f1ed] border-[#17483f]/15";
  return (
    <div className="rounded-[24px] border border-line bg-white/78 p-4 shadow-[0_14px_34px_rgba(23,33,29,0.055)] transition hover:-translate-y-1 hover:shadow-lift">
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClass}`}><Icon size={19} /></span>
      <div className="mt-4 text-xs font-bold text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {helper ? <div className="mt-1 text-xs text-muted">{helper}</div> : null}
    </div>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full border border-[#17483f]/15 bg-[#e8f1ed] px-2.5 py-1 text-xs font-bold text-[#17483f]">{children}</span>;
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-white/70 p-4"><div className="text-xs font-bold text-muted">{label}</div><div className="mt-2 line-clamp-2 text-lg font-semibold text-ink">{value}</div></div>;
}

function DecisionStrip({ analysis, labels }: { analysis: ReturnType<typeof buildAnalysis>; labels: Record<string, string> }) {
  const steps = ["pause", "optimize", "keep", "scale"];
  const activeIndex = steps.indexOf(analysis.decision);
  return (
    <div className="mt-5 rounded-3xl border border-line bg-white/60 p-4">
      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step} className={`rounded-2xl px-3 py-3 text-center text-xs font-bold ${index <= activeIndex ? "bg-[#17483f] text-white" : "bg-[#edf0eb] text-muted"}`}>{labels[step]}</div>
        ))}
      </div>
    </div>
  );
}

function InsightLine({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "risk" ? "text-red-700" : tone === "watch" ? "text-yellow-800" : "text-ink";
  return <div className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-white/70 px-4 py-3"><span className="text-sm font-semibold text-muted">{label}</span><span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span></div>;
}

function Matrix({ rows }: { rows: Array<{ color: string; size: string; qty: number; revenue: number }> }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white/70">
      <table className="w-full text-sm">
        <thead className="bg-[#eef3ef] text-xs uppercase tracking-[0.12em] text-muted"><tr><th className="px-4 py-3 text-left">Color</th><th className="px-4 py-3 text-left">Size</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Sales</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.color}-${row.size}`} className="border-t border-line"><td className="px-4 py-3 font-semibold">{row.color}</td><td className="px-4 py-3">{row.size}</td><td className="px-4 py-3 text-right font-bold">{row.qty}</td><td className="px-4 py-3 text-right font-bold">{won(row.revenue)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function RiskRadar({ analysis }: { analysis: ReturnType<typeof buildAnalysis> }) {
  const risks = [
    { label: "Stock", value: analysis.stock < 10 ? 78 : 18, icon: Boxes },
    { label: "Issue", value: Math.min(100, analysis.issueCount * 22), icon: ShieldAlert },
    { label: "Ad Cost", value: analysis.revenue ? Math.min(100, (analysis.adSpend / analysis.revenue) * 260) : 35, icon: MousePointerClick },
    { label: "Margin", value: analysis.marginRate < 15 ? 72 : 20, icon: AlertTriangle }
  ];
  return <div className="grid gap-3 md:grid-cols-2">{risks.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-line bg-white/70 p-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold text-ink"><Icon size={16} />{label}</span><span className="text-sm font-bold text-muted">{Math.round(value)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e4e9e4]"><div className={`h-full rounded-full ${value > 60 ? "bg-red-500" : value > 35 ? "bg-yellow-500" : "bg-emerald-600"}`} style={{ width: `${Math.max(4, value)}%` }} /></div></div>)}</div>;
}

function NoteCard({ note, formatDate }: { note: AnalysisNote; formatDate: (value: string | Date) => string }) {
  return <div className="mb-3 rounded-2xl border border-line bg-white/70 p-4"><div className="flex items-center justify-between gap-3"><div className="font-bold text-ink">{note.title}</div><span className="text-xs text-muted">{formatDate(note.note_date)}</span></div>{note.content ? <p className="mt-2 text-sm leading-6 text-muted">{note.content}</p> : null}</div>;
}

function CompetitorCard({ row }: { row: CompetitorProduct }) {
  return <div className="mb-3 rounded-2xl border border-line bg-white/70 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-ink">{row.competitor_name || "Competitor"}</div><div className="mt-1 text-xs text-muted">{row.key_selling_points || "-"}</div></div><div className="text-right"><div className="font-bold text-ink">{won(row.price)}</div><div className="text-xs text-muted">{row.rating ?? "-"} / {row.review_count}</div></div></div>{row.product_url ? <a className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#17483f]" href={row.product_url} target="_blank"><Eye size={14} />Open</a> : null}</div>;
}

function PanelEmpty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted">{text}</div>;
}

function SkeletonList() {
  return <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/65" />)}</div>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; required?: boolean }) {
  return <label><span className="mb-1 block text-xs font-bold text-muted">{label}{required ? " *" : ""}</span><input className="w-full" type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, labelMap, onChange }: { label: string; value: string; options: string[]; labelMap: Record<string, string>; onChange: (value: string) => void }) {
  return <label><span className="mb-1 block text-xs font-bold text-muted">{label}</span><select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labelMap[option]}</option>)}</select></label>;
}
