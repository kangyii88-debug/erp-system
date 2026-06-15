"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Beaker, Boxes, CircleOff, Edit3, FlaskConical, Lightbulb, Plus, Rocket, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { CenterHero, CenterPanel, EmptyState, ExecutiveKpi, KpiGrid, MetricLine, ProgressBar, StatusPill } from "@/components/ManagementCenter";
import { categoryMatches, categorySelectOptions, localizedCategoryValue } from "@/lib/category-options";
import { formatDatabaseError } from "@/lib/database-error";
import { profitMargin, unitProfit } from "@/lib/profit";
import { supabase } from "@/lib/supabase";

type DevStatus = "待开发" | "询价中" | "打样中" | "测试中" | "优化中" | "待上架" | "已上线" | "已放弃";
type ProductPriority = "S级" | "A级" | "B级" | "C级";
type ProductDevRow = {
  id: string;
  product_name: string;
  product_image_url: string | null;
  product_category: string;
  supplier: string | null;
  purchase_cost: number;
  expected_price: number;
  expected_margin: number | null;
  platform_fee_rate: number | null;
  international_shipping_cost: number | null;
  coupang_inbound_shipping_cost: number | null;
  ad_cost: number | null;
  owner: string;
  development_status: DevStatus;
  expected_launch_date: string | null;
  priority: ProductPriority;
  market_potential_score: number;
  competition_score: number;
  supply_chain_score: number;
  profit_score: number;
  remark: string | null;
  created_at: string;
};

const statusOptions: DevStatus[] = ["待开发", "询价中", "打样中", "测试中", "优化中", "待上架", "已上线", "已放弃"];
const funnelStatuses: DevStatus[] = ["待开发", "询价中", "打样中", "测试中", "待上架", "已上线"];
const priorityOptions: ProductPriority[] = ["S级", "A级", "B级", "C级"];
const allFilter = "全部";

const copy = {
  zh: {
    eyebrow: "产品开发中心",
    title: "产品开发中心",
    subtitle: "所有产品开发项目由你手动录入。系统只保存、统计、筛选和展示真实项目。",
    newProject: "新增项目",
    kpis: {
      developing: "开发中产品",
      sampling: "待打样产品",
      testing: "测试中产品",
      listing: "待上架产品",
      online: "已上线产品",
      abandoned: "放弃产品",
      hint: "真实项目"
    },
    emptyTitle: "暂无数据",
    emptyProject: "暂无产品开发项目，请点击新增项目开始记录。",
    filtersEyebrow: "筛选",
    filtersTitle: "筛选项目",
    funnelEyebrow: "开发漏斗",
    funnelTitle: "产品开发漏斗",
    projectsEyebrow: "产品项目",
    projectsTitle: "产品项目",
    profitEyebrow: "利润预估",
    profitTitle: "利润预估模块",
    recordEyebrow: "项目记录",
    recordTitle: "项目记录",
    formNewEyebrow: "新增项目",
    formEditEyebrow: "编辑项目",
    formNewTitle: "新增产品项目",
    formEditTitle: "编辑产品项目",
    deleteConfirm: "确定删除这个产品开发项目吗？",
    noSupplier: "未填写供应商",
    totalScore: "综合评分",
    marketPotential: "市场潜力",
    expectedMargin: "预计利润率",
    noFiltered: "没有符合筛选条件的项目。",
    selectProject: "请选择一个产品项目。",
    expectedCost: "预计成本",
    expectedPrice: "预计售价",
    platformFee: "平台服务费",
    extraCost: "总附加成本",
    landedCost: "预计总成本",
    expectedProfit: "预计利润",
    currentStatus: "当前状态",
    owner: "开发负责人",
    launchDate: "预计上线时间",
    noDate: "未填写",
    noRemark: "暂无备注。",
    edit: "编辑",
    delete: "删除",
    save: "保存修改",
    create: "创建项目",
    cancel: "取消",
    all: "全部",
    allCategory: "全部分类",
    allOwner: "全部负责人",
    fields: {
      name: "产品名称",
      category: "产品分类",
      supplier: "供应商",
      cost: "采购成本",
      price: "预计售价",
      platformFeeRate: "平台服务费 %",
      internationalShipping: "国际运费",
      inboundShipping: "Coupang 入仓运费",
      adCost: "广告费用",
      additionalCost: "总附加成本",
      totalCost: "预计总成本",
      netProfit: "预计净利润",
      margin: "预计利润率",
      owner: "开发负责人",
      status: "开发状态",
      priority: "产品优先级",
      score: "市场潜力评分",
      launchDate: "预计上线时间",
      remark: "备注"
    },
    status: {
      "待开发": "待开发",
      "询价中": "询价中",
      "打样中": "打样中",
      "测试中": "测试中",
      "优化中": "优化中",
      "待上架": "待上架",
      "已上线": "已上线",
      "已放弃": "已放弃"
    } as Record<DevStatus, string>,
    priority: {
      "S级": "S级",
      "A级": "A级",
      "B级": "B级",
      "C级": "C级"
    } as Record<ProductPriority, string>
  },
  ko: {
    eyebrow: "상품 개발 센터",
    title: "상품 개발 센터",
    subtitle: "모든 상품 개발 프로젝트는 직접 입력합니다. 시스템은 실제 프로젝트만 저장, 통계, 필터링, 표시합니다.",
    newProject: "신규 프로젝트",
    kpis: {
      developing: "개발 중 상품",
      sampling: "샘플 대기 상품",
      testing: "테스트 중 상품",
      listing: "입점 대기 상품",
      online: "출시 완료 상품",
      abandoned: "중단 상품",
      hint: "실제 프로젝트"
    },
    emptyTitle: "데이터 없음",
    emptyProject: "상품 개발 프로젝트가 없습니다. 신규 프로젝트를 눌러 기록을 시작하세요.",
    filtersEyebrow: "필터",
    filtersTitle: "프로젝트 필터",
    funnelEyebrow: "개발 퍼널",
    funnelTitle: "상품 개발 퍼널",
    projectsEyebrow: "프로젝트",
    projectsTitle: "상품 프로젝트",
    profitEyebrow: "이익 예측",
    profitTitle: "이익 예측 모듈",
    recordEyebrow: "프로젝트 기록",
    recordTitle: "프로젝트 기록",
    formNewEyebrow: "신규 프로젝트",
    formEditEyebrow: "프로젝트 수정",
    formNewTitle: "상품 프로젝트 추가",
    formEditTitle: "상품 프로젝트 수정",
    deleteConfirm: "이 상품 개발 프로젝트를 삭제할까요?",
    noSupplier: "공급사 미입력",
    totalScore: "종합 점수",
    marketPotential: "시장 잠재력",
    expectedMargin: "예상 이익률",
    noFiltered: "필터 조건에 맞는 프로젝트가 없습니다.",
    selectProject: "상품 프로젝트를 선택하세요.",
    expectedCost: "예상 원가",
    expectedPrice: "예상 판매가",
    platformFee: "플랫폼 수수료",
    extraCost: "총 추가 비용",
    landedCost: "예상 총원가",
    expectedProfit: "예상 이익",
    currentStatus: "현재 상태",
    owner: "개발 담당자",
    launchDate: "예상 출시일",
    noDate: "미입력",
    noRemark: "메모가 없습니다.",
    edit: "수정",
    delete: "삭제",
    save: "수정 저장",
    create: "프로젝트 생성",
    cancel: "취소",
    all: "전체",
    allCategory: "전체 분류",
    allOwner: "전체 담당자",
    fields: {
      name: "상품명",
      category: "상품 분류",
      supplier: "공급사",
      cost: "매입 원가",
      price: "예상 판매가",
      platformFeeRate: "플랫폼 수수료 %",
      internationalShipping: "국제 배송비",
      inboundShipping: "Coupang 입고 배송비",
      adCost: "광고비",
      additionalCost: "총 추가 비용",
      totalCost: "예상 총원가",
      netProfit: "예상 순이익",
      margin: "예상 이익률",
      owner: "개발 담당자",
      status: "개발 상태",
      priority: "상품 우선순위",
      score: "시장 잠재력 점수",
      launchDate: "예상 출시일",
      remark: "메모"
    },
    status: {
      "待开发": "개발 대기",
      "询价中": "견적 문의 중",
      "打样中": "샘플 제작 중",
      "测试中": "테스트 중",
      "优化中": "개선 중",
      "待上架": "입점 대기",
      "已上线": "출시 완료",
      "已放弃": "중단"
    } as Record<DevStatus, string>,
    priority: {
      "S级": "S등급",
      "A级": "A등급",
      "B级": "B등급",
      "C级": "C등급"
    } as Record<ProductPriority, string>
  }
};

type Copy = typeof copy.zh;
type SelectOption = string | { value: string; label: string };

const emptyForm = {
  product_name: "",
  product_category: "",
  supplier: "",
  purchase_cost: "0",
  expected_price: "0",
  platform_fee_rate: "11.6",
  international_shipping_cost: "0",
  coupang_inbound_shipping_cost: "0",
  ad_cost: "0",
  owner: "",
  development_status: "待开发" as DevStatus,
  expected_launch_date: "",
  priority: "B级" as ProductPriority,
  market_potential_score: "0",
  remark: ""
};

export default function ProductDevelopmentPage() {
  return (
    <AppShell>
      <ProductDevelopmentContent />
    </AppShell>
  );
}

function ProductDevelopmentContent() {
  const { language } = useLanguage();
  const c = copy[language];
  const [products, setProducts] = useState<ProductDevRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ status: allFilter, priority: allFilter, category: "", owner: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data, error } = await supabase.from("product_development").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage(formatDatabaseError(error.message, "product_development"));
      return;
    }
    const rows = (data ?? []) as ProductDevRow[];
    setProducts(rows);
    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const payload = {
      product_name: form.product_name.trim(),
      product_image_url: null,
      product_category: form.product_category.trim(),
      supplier: form.supplier.trim() || null,
      purchase_cost: Number(form.purchase_cost || 0),
      expected_price: Number(form.expected_price || 0),
      expected_margin: calculateProductMargin(form),
      platform_fee_rate: Number(form.platform_fee_rate || 11.6),
      international_shipping_cost: Number(form.international_shipping_cost || 0),
      coupang_inbound_shipping_cost: Number(form.coupang_inbound_shipping_cost || 0),
      ad_cost: Number(form.ad_cost || 0),
      owner: form.owner.trim(),
      development_status: form.development_status,
      expected_launch_date: form.expected_launch_date || null,
      priority: form.priority,
      market_potential_score: clampScore(form.market_potential_score),
      competition_score: 0,
      supply_chain_score: 0,
      profit_score: 0,
      remark: form.remark.trim() || null
    };

    const result = editingId
      ? await supabase.from("product_development").update(payload).eq("id", editingId)
      : await supabase.from("product_development").insert({ user_id: auth.user.id, ...payload });

    if (result.error) {
      setMessage(formatDatabaseError(result.error.message, "product_development"));
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setMessage("");
    await loadProducts();
  }

  async function updateStatus(id: string, development_status: DevStatus) {
    const { error } = await supabase.from("product_development").update({ development_status }).eq("id", id);
    if (error) setMessage(formatDatabaseError(error.message, "product_development"));
    await loadProducts();
  }

  async function deleteProduct(id: string) {
    if (!window.confirm(c.deleteConfirm)) return;
    const { error } = await supabase.from("product_development").delete().eq("id", id);
    if (error) {
      setMessage(formatDatabaseError(error.message, "product_development"));
      return;
    }
    await loadProducts();
  }

  function startEdit(item: ProductDevRow) {
    setEditingId(item.id);
    setForm({
      product_name: item.product_name,
      product_category: item.product_category,
      supplier: item.supplier ?? "",
      purchase_cost: String(item.purchase_cost ?? 0),
      expected_price: String(item.expected_price ?? 0),
      platform_fee_rate: String(item.platform_fee_rate ?? 11.6),
      international_shipping_cost: String(item.international_shipping_cost ?? 0),
      coupang_inbound_shipping_cost: String(item.coupang_inbound_shipping_cost ?? 0),
      ad_cost: String(item.ad_cost ?? 0),
      owner: item.owner,
      development_status: item.development_status,
      expected_launch_date: item.expected_launch_date ?? "",
      priority: item.priority,
      market_potential_score: String(item.market_potential_score ?? 0),
      remark: item.remark ?? ""
    });
    setShowForm(true);
  }

  const filteredProducts = useMemo(() => applyProductFilters(products, filters), [products, filters]);
  const metrics = useMemo(() => buildProductMetrics(products), [products]);
  const selected = products.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <CenterHero
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
        action={<button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />{c.newProject}</button>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={Lightbulb} label={c.kpis.developing} value={metrics.developing} hint={c.kpis.hint} tone="brand" />
          <ExecutiveKpi icon={FlaskConical} label={c.kpis.sampling} value={metrics.sampling} hint={c.kpis.hint} />
          <ExecutiveKpi icon={Beaker} label={c.kpis.testing} value={metrics.testing} hint={c.kpis.hint} tone="watch" />
          <ExecutiveKpi icon={Boxes} label={c.kpis.listing} value={metrics.listing} hint={c.kpis.hint} />
          <ExecutiveKpi icon={Rocket} label={c.kpis.online} value={metrics.online} hint={c.kpis.hint} tone="good" />
          <ExecutiveKpi icon={CircleOff} label={c.kpis.abandoned} value={metrics.abandoned} hint={c.kpis.hint} tone={metrics.abandoned ? "risk" : "neutral"} />
        </KpiGrid>
      </CenterHero>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}
      {showForm ? <ProductForm c={c} form={form} editing={Boolean(editingId)} onChange={setForm} onSubmit={saveProduct} onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} /> : null}

      {!products.length ? (
        <EmptyAction c={c} title={c.emptyProject} button={c.newProject} onClick={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <ProductFilters c={c} language={language} filters={filters} categories={categorySelectOptions(products.map((item) => item.product_category), language)} owners={unique(products.map((item) => item.owner))} onChange={setFilters} />
            <CenterPanel eyebrow={c.funnelEyebrow} title={c.funnelTitle}>
              <div className="grid gap-3 md:grid-cols-6">
                {funnelStatuses.map((status, index) => {
                  const count = products.filter((item) => item.development_status === status).length;
                  return (
                    <div key={status} className="rounded-2xl border border-line bg-white/75 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted">0{index + 1}</span>
                        <StatusPill tone={count ? "brand" : "neutral"}>{count}</StatusPill>
                      </div>
                      <div className="mt-4 text-sm font-semibold text-ink">{c.status[status]}</div>
                      <div className="mt-3"><ProgressBar value={(count / Math.max(1, products.length)) * 100} tone={count ? "brand" : "neutral"} /></div>
                    </div>
                  );
                })}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow={c.projectsEyebrow} title={c.projectsTitle}>
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredProducts.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`rounded-[22px] border bg-white/80 p-4 text-left shadow-[0_10px_26px_rgba(23,33,29,0.06)] ${selected?.id === item.id ? "border-[#17483f]/40 ring-2 ring-[#17483f]/10" : "border-line"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone={priorityTone(item.priority)}>{c.priority[item.priority]}</StatusPill>
                          <StatusPill tone={statusTone(item.development_status)}>{c.status[item.development_status]}</StatusPill>
                        </div>
                        <h3 className="mt-3 font-semibold leading-snug text-ink">{item.product_name}</h3>
                        <p className="mt-1 text-xs text-muted">{localizedCategoryValue(item.product_category, language)} · {item.supplier || c.noSupplier}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-semibold tabular-nums text-ink">{totalScore(item)}</div>
                        <div className="text-xs text-muted">{c.totalScore}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <MetricLine label={c.marketPotential} value={item.market_potential_score} tone="brand" />
                      <MetricLine label={c.expectedMargin} value={`${expectedMargin(item).toFixed(1)}%`} tone="good" />
                    </div>
                  </button>
                ))}
                {!filteredProducts.length ? <EmptyState text={c.noFiltered} /> : null}
              </div>
            </CenterPanel>
          </div>

          <div className="space-y-5">
            {selected ? (
              <>
                <CenterPanel eyebrow={c.profitEyebrow} title={c.profitTitle}>
                  <div className="rounded-[24px] border border-[#d8d0b8] bg-[#162f2b] p-5 text-white shadow-[0_24px_58px_rgba(15,52,47,0.22)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d6c28b]">{c.priority[selected.priority]}</p>
                        <h3 className="mt-2 text-2xl font-semibold">{selected.product_name}</h3>
                      </div>
                      <BadgeCheck className="h-7 w-7 text-[#d6c28b]" />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <DarkMetric label={c.expectedCost} value={won(selected.purchase_cost)} />
                      <DarkMetric label={c.expectedPrice} value={won(selected.expected_price)} />
                      <DarkMetric label={c.platformFee} value={won(platformFeeAmount(selected))} />
                      <DarkMetric label={c.extraCost} value={won(totalAdditionalCost(selected))} />
                      <DarkMetric label={c.landedCost} value={won(totalExpectedCost(selected))} />
                      <DarkMetric label={c.expectedProfit} value={won(expectedProfit(selected))} />
                      <DarkMetric label={c.expectedMargin} value={`${expectedMargin(selected).toFixed(1)}%`} />
                    </div>
                  </div>
                </CenterPanel>
                <CenterPanel eyebrow={c.recordEyebrow} title={c.recordTitle}>
                  <div className="space-y-3">
                    <MetricLine label={c.currentStatus} value={c.status[selected.development_status]} tone={statusTone(selected.development_status)} />
                    <MetricLine label={c.owner} value={selected.owner} />
                    <MetricLine label={c.launchDate} value={selected.expected_launch_date ?? c.noDate} />
                    <div className="rounded-2xl border border-line bg-white/70 p-4 text-sm leading-6 text-muted">{selected.remark || c.noRemark}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="erp-button-subtle inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => startEdit(selected)}><Edit3 className="h-4 w-4" />{c.edit}</button>
                      <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" onClick={() => deleteProduct(selected.id)}><Trash2 className="inline h-4 w-4" /> {c.delete}</button>
                    </div>
                    <Select value={selected.development_status} options={statusSelectOptions(c)} onChange={(status) => updateStatus(selected.id, status as DevStatus)} />
                  </div>
                </CenterPanel>
              </>
            ) : <EmptyState text={c.selectProject} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({ c, form, editing, onChange, onSubmit, onCancel }: { c: Copy; form: typeof emptyForm; editing: boolean; onChange: (form: typeof emptyForm) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  const { language } = useLanguage();
  const previewProfit = calculateProductProfit(form);
  const previewMargin = calculateProductMargin(form);
  const previewAdditionalCost = calculateAdditionalCost(form);
  const previewTotalCost = calculateTotalCost(form);

  return (
    <CenterPanel eyebrow={editing ? c.formEditEyebrow : c.formNewEyebrow} title={editing ? c.formEditTitle : c.formNewTitle}>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-4">
        <Field label={c.fields.name}><input className="premium-input" required value={form.product_name} onChange={(event) => onChange({ ...form, product_name: event.target.value })} /></Field>
        <Field label={c.fields.category}><CategoryFormSelect label={c.fields.category} value={form.product_category} language={language} required onChange={(value) => onChange({ ...form, product_category: value })} /></Field>
        <Field label={c.fields.supplier}><input className="premium-input" value={form.supplier} onChange={(event) => onChange({ ...form, supplier: event.target.value })} /></Field>
        <Field label={c.fields.cost}><input className="premium-input" type="number" min="0" value={form.purchase_cost} onChange={(event) => onChange({ ...form, purchase_cost: event.target.value })} /></Field>
        <Field label={c.fields.price}><input className="premium-input" type="number" min="0" value={form.expected_price} onChange={(event) => onChange({ ...form, expected_price: event.target.value })} /></Field>
        <Field label={c.fields.platformFeeRate}><input className="premium-input" type="number" min="0" step="0.1" value={form.platform_fee_rate} onChange={(event) => onChange({ ...form, platform_fee_rate: event.target.value })} /></Field>
        <Field label={c.fields.internationalShipping}><input className="premium-input" type="number" min="0" value={form.international_shipping_cost} onChange={(event) => onChange({ ...form, international_shipping_cost: event.target.value })} /></Field>
        <Field label={c.fields.inboundShipping}><input className="premium-input" type="number" min="0" value={form.coupang_inbound_shipping_cost} onChange={(event) => onChange({ ...form, coupang_inbound_shipping_cost: event.target.value })} /></Field>
        <Field label={c.fields.adCost}><input className="premium-input" type="number" min="0" value={form.ad_cost} onChange={(event) => onChange({ ...form, ad_cost: event.target.value })} /></Field>
        <Field label={c.fields.additionalCost}><div className="premium-input flex h-10 items-center px-3 py-2 font-semibold text-ink">{won(previewAdditionalCost)}</div></Field>
        <Field label={c.fields.totalCost}><div className="premium-input flex h-10 items-center px-3 py-2 font-semibold text-ink">{won(previewTotalCost)}</div></Field>
        <Field label={c.fields.netProfit}><div className="premium-input flex h-10 items-center px-3 py-2 font-semibold text-ink">{won(previewProfit)}</div></Field>
        <Field label={c.fields.margin}><div className="premium-input flex h-10 items-center px-3 py-2 font-semibold text-ink">{previewMargin.toFixed(1)}%</div></Field>
        <Field label={c.fields.owner}><input className="premium-input" required value={form.owner} onChange={(event) => onChange({ ...form, owner: event.target.value })} /></Field>
        <Field label={c.fields.status}><Select value={form.development_status} options={statusSelectOptions(c)} onChange={(value) => onChange({ ...form, development_status: value as DevStatus })} /></Field>
        <Field label={c.fields.priority}><Select value={form.priority} options={prioritySelectOptions(c)} onChange={(value) => onChange({ ...form, priority: value as ProductPriority })} /></Field>
        <Field label={c.fields.score}><Score value={form.market_potential_score} onChange={(value) => onChange({ ...form, market_potential_score: value })} /></Field>
        <Field label={c.fields.launchDate}><input className="premium-input" type="date" value={form.expected_launch_date} onChange={(event) => onChange({ ...form, expected_launch_date: event.target.value })} /></Field>
        <Field label={c.fields.remark}><input className="premium-input" value={form.remark} onChange={(event) => onChange({ ...form, remark: event.target.value })} /></Field>
        <div className="flex items-end gap-2">
          <button className="erp-button-primary h-10 px-4 text-sm font-bold" type="submit">{editing ? c.save : c.create}</button>
          <button className="erp-button-subtle h-10 px-4 text-sm font-bold" type="button" onClick={onCancel}>{c.cancel}</button>
        </div>
      </form>
    </CenterPanel>
  );
}

function ProductFilters({ c, filters, categories, owners, onChange }: { c: Copy; language: "zh" | "ko"; filters: { status: string; priority: string; category: string; owner: string }; categories: string[]; owners: string[]; onChange: (filters: { status: string; priority: string; category: string; owner: string }) => void }) {
  return (
    <CenterPanel eyebrow={c.filtersEyebrow} title={c.filtersTitle}>
      <div className="grid gap-3 md:grid-cols-4">
        <Select value={filters.status} options={[{ value: allFilter, label: c.all }, ...statusSelectOptions(c)]} onChange={(status) => onChange({ ...filters, status })} />
        <Select value={filters.priority} options={[{ value: allFilter, label: c.all }, ...prioritySelectOptions(c)]} onChange={(priority) => onChange({ ...filters, priority })} />
        <Select value={filters.category || allFilter} options={[{ value: allFilter, label: c.allCategory }, ...categories]} onChange={(category) => onChange({ ...filters, category: category === allFilter ? "" : category })} />
        <Select value={filters.owner || allFilter} options={[{ value: allFilter, label: c.allOwner }, ...owners]} onChange={(owner) => onChange({ ...filters, owner: owner === allFilter ? "" : owner })} />
      </div>
    </CenterPanel>
  );
}

function buildProductMetrics(products: ProductDevRow[]) {
  return {
    developing: products.filter((item) => ["待开发", "询价中", "打样中", "测试中", "优化中"].includes(item.development_status)).length,
    sampling: products.filter((item) => item.development_status === "打样中").length,
    testing: products.filter((item) => item.development_status === "测试中").length,
    listing: products.filter((item) => item.development_status === "待上架").length,
    online: products.filter((item) => item.development_status === "已上线").length,
    abandoned: products.filter((item) => item.development_status === "已放弃").length
  };
}

function applyProductFilters(products: ProductDevRow[], filters: { status: string; priority: string; category: string; owner: string }) {
  return products.filter((item) => {
    if (filters.status !== allFilter && item.development_status !== filters.status) return false;
    if (filters.priority !== allFilter && item.priority !== filters.priority) return false;
    if (filters.category && !categoryMatches(item.product_category, filters.category)) return false;
    if (filters.owner && item.owner !== filters.owner) return false;
    return true;
  });
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/8 p-3"><div className="text-xs text-white/55">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div></div>;
}

function expectedProfit(item: ProductDevRow) {
  return unitProfit(toProfitProduct(item));
}

function expectedMargin(item: ProductDevRow) {
  return profitMargin(toProfitProduct(item), expectedProfit(item));
}

function totalScore(item: ProductDevRow) {
  return Math.round(item.market_potential_score || 0);
}

function calculateProductProfit(form: typeof emptyForm) {
  return unitProfit({
    purchase_price: Number(form.purchase_cost || 0),
    sale_price: Number(form.expected_price || 0),
    platform_fee_rate: Number(form.platform_fee_rate || 11.6),
    international_shipping_cost: Number(form.international_shipping_cost || 0),
    coupang_inbound_shipping_cost: Number(form.coupang_inbound_shipping_cost || 0),
    ad_cost: Number(form.ad_cost || 0)
  });
}

function calculateProductMargin(form: typeof emptyForm) {
  const product = {
    purchase_price: Number(form.purchase_cost || 0),
    sale_price: Number(form.expected_price || 0),
    platform_fee_rate: Number(form.platform_fee_rate || 11.6),
    international_shipping_cost: Number(form.international_shipping_cost || 0),
    coupang_inbound_shipping_cost: Number(form.coupang_inbound_shipping_cost || 0),
    ad_cost: Number(form.ad_cost || 0)
  };

  return profitMargin(product, unitProfit(product));
}

function calculatePlatformFee(form: typeof emptyForm) {
  return Number(form.expected_price || 0) * (Number(form.platform_fee_rate || 11.6) / 100);
}

function calculateAdditionalCost(form: typeof emptyForm) {
  return (
    calculatePlatformFee(form) +
    Number(form.international_shipping_cost || 0) +
    Number(form.coupang_inbound_shipping_cost || 0) +
    Number(form.ad_cost || 0)
  );
}

function calculateTotalCost(form: typeof emptyForm) {
  return Number(form.purchase_cost || 0) + calculateAdditionalCost(form);
}

function toProfitProduct(item: ProductDevRow) {
  return {
    purchase_price: Number(item.purchase_cost || 0),
    sale_price: Number(item.expected_price || 0),
    platform_fee_rate: Number(item.platform_fee_rate ?? 11.6),
    international_shipping_cost: Number(item.international_shipping_cost ?? 0),
    coupang_inbound_shipping_cost: Number(item.coupang_inbound_shipping_cost ?? 0),
    ad_cost: Number(item.ad_cost ?? 0)
  };
}

function platformFeeAmount(item: ProductDevRow) {
  return Number(item.expected_price || 0) * (Number(item.platform_fee_rate ?? 11.6) / 100);
}

function totalAdditionalCost(item: ProductDevRow) {
  return platformFeeAmount(item) + Number(item.international_shipping_cost ?? 0) + Number(item.coupang_inbound_shipping_cost ?? 0) + Number(item.ad_cost ?? 0);
}

function totalExpectedCost(item: ProductDevRow) {
  return Number(item.purchase_cost || 0) + totalAdditionalCost(item);
}

function priorityTone(priority: ProductPriority) {
  if (priority === "S级") return "risk";
  if (priority === "A级") return "brand";
  if (priority === "B级") return "watch";
  return "neutral";
}

function statusTone(status: DevStatus) {
  if (status === "已上线") return "good";
  if (status === "已放弃") return "risk";
  if (status === "测试中" || status === "待上架") return "watch";
  return "brand";
}

function won(value: number) {
  return `₩${Math.round(Number(value || 0)).toLocaleString("ko-KR")}`;
}

function clampScore(value: string) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-muted"><span className="mb-1.5 block">{label}</span>{children}</label>;
}

function CategoryFormSelect({ value, language, required = false, onChange }: { label: string; value: string; language: "zh" | "ko"; required?: boolean; onChange: (value: string) => void }) {
  const current = localizedCategoryValue(value, language);
  const options = categorySelectOptions(value ? [value] : [], language);
  return (
    <select className="premium-input w-full" value={current} required={required} onChange={(event) => onChange(event.target.value)}>
      <option value="">{language === "zh" ? "请选择产品分类" : "상품 분류 선택"}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function Select({ value, options, onChange }: { value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  return (
    <select className="premium-input w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : option;
        return <option key={item.value} value={item.value}>{item.label}</option>;
      })}
    </select>
  );
}

function Score({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input className="premium-input" type="number" min="0" max="100" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function EmptyAction({ c, title, button, onClick }: { c: Copy; title: string; button: string; onClick: () => void }) {
  return (
    <CenterPanel eyebrow={c.emptyTitle} title={c.emptyTitle}>
      <div className="rounded-[26px] border border-dashed border-[#cdd8cf] bg-white/65 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f2ed] text-[#17483f]"><Plus className="h-6 w-6" /></div>
        <p className="mt-4 text-base font-semibold text-ink">{title}</p>
        <button className="erp-button-primary mt-5 px-4 py-2 text-sm font-bold" onClick={onClick}>{button}</button>
      </div>
    </CenterPanel>
  );
}

function statusSelectOptions(c: Copy): SelectOption[] {
  return statusOptions.map((status) => ({ value: status, label: c.status[status] }));
}

function prioritySelectOptions(c: Copy): SelectOption[] {
  return priorityOptions.map((priority) => ({ value: priority, label: c.priority[priority] }));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
