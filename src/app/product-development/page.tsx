"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Beaker, Boxes, CircleOff, Edit3, FlaskConical, Lightbulb, Plus, Rocket, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CenterHero, CenterPanel, EmptyState, ExecutiveKpi, KpiGrid, MetricLine, ProgressBar, StatusPill } from "@/components/ManagementCenter";
import { formatDatabaseError } from "@/lib/database-error";
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
const emptyForm = {
  product_name: "",
  product_category: "",
  supplier: "",
  purchase_cost: "0",
  expected_price: "0",
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
  const [products, setProducts] = useState<ProductDevRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ status: "全部", priority: "全部", category: "", owner: "" });
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
      expected_margin: calculateMargin(Number(form.purchase_cost || 0), Number(form.expected_price || 0)),
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
    if (!window.confirm("确定删除这个产品开发项目吗？")) return;
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
        eyebrow="Product Development Center"
        title="产品开发中心"
        subtitle="所有产品开发项目由你手动录入。系统只保存、统计、筛选和展示真实项目。"
        action={<button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />新增项目</button>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={Lightbulb} label="开发中产品" value={metrics.developing} hint="真实项目" tone="brand" />
          <ExecutiveKpi icon={FlaskConical} label="待打样产品" value={metrics.sampling} hint="真实项目" />
          <ExecutiveKpi icon={Beaker} label="测试中产品" value={metrics.testing} hint="真实项目" tone="watch" />
          <ExecutiveKpi icon={Boxes} label="待上架产品" value={metrics.listing} hint="真实项目" />
          <ExecutiveKpi icon={Rocket} label="已上线产品" value={metrics.online} hint="真实项目" tone="good" />
          <ExecutiveKpi icon={CircleOff} label="放弃产品" value={metrics.abandoned} hint="真实项目" tone={metrics.abandoned ? "risk" : "neutral"} />
        </KpiGrid>
      </CenterHero>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}
      {showForm ? <ProductForm form={form} editing={Boolean(editingId)} onChange={setForm} onSubmit={saveProduct} onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} /> : null}

      {!products.length ? (
        <EmptyAction title="暂无产品开发项目，请点击新增项目开始记录。" button="新增项目" onClick={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <ProductFilters filters={filters} categories={unique(products.map((item) => item.product_category))} owners={unique(products.map((item) => item.owner))} onChange={setFilters} />
            <CenterPanel eyebrow="Development Funnel" title="产品开发漏斗">
              <div className="grid gap-3 md:grid-cols-6">
                {funnelStatuses.map((status, index) => {
                  const count = products.filter((item) => item.development_status === status).length;
                  return (
                    <div key={status} className="rounded-2xl border border-line bg-white/75 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted">0{index + 1}</span>
                        <StatusPill tone={count ? "brand" : "neutral"}>{count}</StatusPill>
                      </div>
                      <div className="mt-4 text-sm font-semibold text-ink">{status}</div>
                      <div className="mt-3"><ProgressBar value={(count / Math.max(1, products.length)) * 100} tone={count ? "brand" : "neutral"} /></div>
                    </div>
                  );
                })}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow="Projects" title="产品项目">
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredProducts.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`rounded-[22px] border bg-white/80 p-4 text-left shadow-[0_10px_26px_rgba(23,33,29,0.06)] ${selected?.id === item.id ? "border-[#17483f]/40 ring-2 ring-[#17483f]/10" : "border-line"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
                          <StatusPill tone={statusTone(item.development_status)}>{item.development_status}</StatusPill>
                        </div>
                        <h3 className="mt-3 font-semibold leading-snug text-ink">{item.product_name}</h3>
                        <p className="mt-1 text-xs text-muted">{item.product_category} · {item.supplier || "未填写供应商"}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-semibold tabular-nums text-ink">{totalScore(item)}</div>
                        <div className="text-xs text-muted">综合评分</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <MetricLine label="市场潜力" value={item.market_potential_score} tone="brand" />
                      <MetricLine label="预计利润率" value={`${expectedMargin(item).toFixed(1)}%`} tone="good" />
                    </div>
                  </button>
                ))}
                {!filteredProducts.length ? <EmptyState text="没有符合筛选条件的项目。" /> : null}
              </div>
            </CenterPanel>
          </div>

          <div className="space-y-5">
            {selected ? (
              <>
                <CenterPanel eyebrow="Profit Forecast" title="利润预估模块">
                  <div className="rounded-[24px] border border-[#d8d0b8] bg-[#162f2b] p-5 text-white shadow-[0_24px_58px_rgba(15,52,47,0.22)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d6c28b]">{selected.priority}</p>
                        <h3 className="mt-2 text-2xl font-semibold">{selected.product_name}</h3>
                      </div>
                      <BadgeCheck className="h-7 w-7 text-[#d6c28b]" />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <DarkMetric label="预计成本" value={won(selected.purchase_cost)} />
                      <DarkMetric label="预计售价" value={won(selected.expected_price)} />
                      <DarkMetric label="预计利润" value={won(expectedProfit(selected))} />
                      <DarkMetric label="预计利润率" value={`${expectedMargin(selected).toFixed(1)}%`} />
                    </div>
                  </div>
                </CenterPanel>
                <CenterPanel eyebrow="Project Record" title="项目记录">
                  <div className="space-y-3">
                    <MetricLine label="当前状态" value={selected.development_status} tone={statusTone(selected.development_status)} />
                    <MetricLine label="开发负责人" value={selected.owner} />
                    <MetricLine label="预计上线时间" value={selected.expected_launch_date ?? "未填写"} />
                    <div className="rounded-2xl border border-line bg-white/70 p-4 text-sm leading-6 text-muted">{selected.remark || "暂无备注。"}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="erp-button-subtle inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => startEdit(selected)}><Edit3 className="h-4 w-4" />编辑</button>
                      <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" onClick={() => deleteProduct(selected.id)}><Trash2 className="inline h-4 w-4" /> 删除</button>
                    </div>
                    <Select value={selected.development_status} options={statusOptions} onChange={(status) => updateStatus(selected.id, status as DevStatus)} />
                  </div>
                </CenterPanel>
              </>
            ) : <EmptyState text="请选择一个产品项目。" />}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({ form, editing, onChange, onSubmit, onCancel }: { form: typeof emptyForm; editing: boolean; onChange: (form: typeof emptyForm) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  const previewCost = Number(form.purchase_cost || 0);
  const previewPrice = Number(form.expected_price || 0);
  const previewMargin = calculateMargin(previewCost, previewPrice);

  return (
    <CenterPanel eyebrow={editing ? "Edit Project" : "New Project"} title={editing ? "编辑产品项目" : "新增产品项目"}>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-4">
        <Field label="产品名称"><input className="premium-input" required value={form.product_name} onChange={(event) => onChange({ ...form, product_name: event.target.value })} /></Field>
        <Field label="产品分类"><input className="premium-input" required value={form.product_category} onChange={(event) => onChange({ ...form, product_category: event.target.value })} /></Field>
        <Field label="供应商"><input className="premium-input" value={form.supplier} onChange={(event) => onChange({ ...form, supplier: event.target.value })} /></Field>
        <Field label="采购成本"><input className="premium-input" type="number" min="0" value={form.purchase_cost} onChange={(event) => onChange({ ...form, purchase_cost: event.target.value })} /></Field>
        <Field label="预计售价"><input className="premium-input" type="number" min="0" value={form.expected_price} onChange={(event) => onChange({ ...form, expected_price: event.target.value })} /></Field>
        <Field label="预计利润率"><div className="premium-input flex items-center bg-white/55 font-semibold text-ink">{previewMargin.toFixed(1)}%</div></Field>
        <Field label="开发负责人"><input className="premium-input" required value={form.owner} onChange={(event) => onChange({ ...form, owner: event.target.value })} /></Field>
        <Field label="开发状态"><Select value={form.development_status} options={statusOptions} onChange={(value) => onChange({ ...form, development_status: value as DevStatus })} /></Field>
        <Field label="产品优先级"><Select value={form.priority} options={priorityOptions} onChange={(value) => onChange({ ...form, priority: value as ProductPriority })} /></Field>
        <Field label="市场潜力评分"><Score value={form.market_potential_score} onChange={(value) => onChange({ ...form, market_potential_score: value })} /></Field>
        <Field label="预计上线时间"><input className="premium-input" type="date" value={form.expected_launch_date} onChange={(event) => onChange({ ...form, expected_launch_date: event.target.value })} /></Field>
        <Field label="备注"><input className="premium-input" value={form.remark} onChange={(event) => onChange({ ...form, remark: event.target.value })} /></Field>
        <div className="flex items-end gap-2">
          <button className="erp-button-primary h-10 px-4 text-sm font-bold" type="submit">{editing ? "保存修改" : "创建项目"}</button>
          <button className="erp-button-subtle h-10 px-4 text-sm font-bold" type="button" onClick={onCancel}>取消</button>
        </div>
      </form>
    </CenterPanel>
  );
}

function ProductFilters({ filters, categories, owners, onChange }: { filters: { status: string; priority: string; category: string; owner: string }; categories: string[]; owners: string[]; onChange: (filters: { status: string; priority: string; category: string; owner: string }) => void }) {
  return (
    <CenterPanel eyebrow="Filters" title="筛选项目">
      <div className="grid gap-3 md:grid-cols-4">
        <Select value={filters.status} options={["全部", ...statusOptions]} onChange={(status) => onChange({ ...filters, status })} />
        <Select value={filters.priority} options={["全部", ...priorityOptions]} onChange={(priority) => onChange({ ...filters, priority })} />
        <Select value={filters.category || "全部分类"} options={["全部分类", ...categories]} onChange={(category) => onChange({ ...filters, category: category === "全部分类" ? "" : category })} />
        <Select value={filters.owner || "全部负责人"} options={["全部负责人", ...owners]} onChange={(owner) => onChange({ ...filters, owner: owner === "全部负责人" ? "" : owner })} />
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
    if (filters.status !== "全部" && item.development_status !== filters.status) return false;
    if (filters.priority !== "全部" && item.priority !== filters.priority) return false;
    if (filters.category && item.product_category !== filters.category) return false;
    if (filters.owner && item.owner !== filters.owner) return false;
    return true;
  });
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/8 p-3"><div className="text-xs text-white/55">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div></div>;
}

function expectedProfit(item: ProductDevRow) {
  return Number(item.expected_price || 0) - Number(item.purchase_cost || 0);
}

function expectedMargin(item: ProductDevRow) {
  return calculateMargin(item.purchase_cost, item.expected_price);
}

function totalScore(item: ProductDevRow) {
  return Math.round(item.market_potential_score || 0);
}

function calculateMargin(cost: number, price: number) {
  return price > 0 ? ((price - cost) / price) * 100 : 0;
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

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select className="premium-input w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function Score({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input className="premium-input" type="number" min="0" max="100" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function EmptyAction({ title, button, onClick }: { title: string; button: string; onClick: () => void }) {
  return (
    <CenterPanel eyebrow="Empty" title="暂无数据">
      <div className="rounded-[26px] border border-dashed border-[#cdd8cf] bg-white/65 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f2ed] text-[#17483f]"><Plus className="h-6 w-6" /></div>
        <p className="mt-4 text-base font-semibold text-ink">{title}</p>
        <button className="erp-button-primary mt-5 px-4 py-2 text-sm font-bold" onClick={onClick}>{button}</button>
      </div>
    </CenterPanel>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
