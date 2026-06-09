"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, Edit3, PackageX, Palette, Plus, Ruler, Trash2, Truck, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { CenterHero, CenterPanel, EmptyState, ExecutiveKpi, KpiGrid, MetricLine, ProgressBar, StatusPill } from "@/components/ManagementCenter";
import { formatDatabaseError } from "@/lib/database-error";
import { supabase } from "@/lib/supabase";

type IssueCategory = "安装问题" | "质量问题" | "尺寸问题" | "颜色问题" | "物流问题" | "包装问题" | "功能问题" | "其它问题";
type IssueStatus = "待处理" | "处理中" | "已解决" | "已关闭";
type CustomerIssue = {
  id: string;
  issue_date: string;
  sku: string;
  product_name: string;
  issue_category: IssueCategory;
  issue_description: string;
  customer_original_text: string | null;
  solution: string | null;
  owner: string;
  status: IssueStatus;
  remark: string | null;
  created_at: string;
};

const categoryOptions: IssueCategory[] = ["安装问题", "质量问题", "尺寸问题", "颜色问题", "物流问题", "包装问题", "功能问题", "其它问题"];
const statusOptions: IssueStatus[] = ["待处理", "处理中", "已解决", "已关闭"];
const emptyForm = {
  issue_date: toDateKey(new Date()),
  sku: "",
  product_name: "",
  issue_category: "安装问题" as IssueCategory,
  issue_description: "",
  customer_original_text: "",
  solution: "",
  owner: "",
  status: "待处理" as IssueStatus,
  remark: ""
};

export default function CustomerIssuesPage() {
  return (
    <AppShell>
      <CustomerIssuesContent />
    </AppShell>
  );
}

function CustomerIssuesContent() {
  const [issues, setIssues] = useState<CustomerIssue[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ sku: "", category: "全部", status: "全部", start: "", end: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadIssues();
  }, []);

  async function loadIssues() {
    const { data, error } = await supabase.from("customer_issues").select("*").order("issue_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) {
      setMessage(formatDatabaseError(error.message, "customer_issues"));
      return;
    }
    setIssues((data ?? []) as CustomerIssue[]);
  }

  async function saveIssue(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const payload = {
      issue_date: form.issue_date,
      sku: form.sku.trim(),
      product_name: form.product_name.trim(),
      issue_category: form.issue_category,
      issue_description: form.issue_description.trim(),
      customer_original_text: form.customer_original_text.trim() || null,
      solution: form.solution.trim() || null,
      owner: form.owner.trim(),
      status: form.status,
      remark: form.remark.trim() || null
    };

    const result = editingId
      ? await supabase.from("customer_issues").update(payload).eq("id", editingId)
      : await supabase.from("customer_issues").insert({ user_id: auth.user.id, ...payload });

    if (result.error) {
      setMessage(formatDatabaseError(result.error.message, "customer_issues"));
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setMessage("");
    await loadIssues();
  }

  async function updateStatus(id: string, status: IssueStatus) {
    const { error } = await supabase.from("customer_issues").update({ status }).eq("id", id);
    if (error) setMessage(formatDatabaseError(error.message, "customer_issues"));
    await loadIssues();
  }

  async function deleteIssue(id: string) {
    if (!window.confirm("确定删除这条客诉记录吗？")) return;
    const { error } = await supabase.from("customer_issues").delete().eq("id", id);
    if (error) {
      setMessage(formatDatabaseError(error.message, "customer_issues"));
      return;
    }
    await loadIssues();
  }

  function startEdit(issue: CustomerIssue) {
    setEditingId(issue.id);
    setForm({
      issue_date: issue.issue_date,
      sku: issue.sku,
      product_name: issue.product_name,
      issue_category: issue.issue_category,
      issue_description: issue.issue_description,
      customer_original_text: issue.customer_original_text ?? "",
      solution: issue.solution ?? "",
      owner: issue.owner,
      status: issue.status,
      remark: issue.remark ?? ""
    });
    setShowForm(true);
  }

  const filteredIssues = useMemo(() => applyIssueFilters(issues, filters), [issues, filters]);
  const metrics = useMemo(() => buildMetrics(issues), [issues]);
  const ranking = useMemo(() => buildRanking(issues), [issues]);
  const trends = useMemo(() => buildMonthlyTrends(issues), [issues]);
  const skuRows = useMemo(() => buildSkuRows(issues), [issues]);
  const solutionRows = useMemo(() => buildSolutionRows(issues), [issues]);

  return (
    <div className="space-y-6">
      <CenterHero
        eyebrow="Customer Issue Center"
        title="客诉问题库"
        subtitle="所有客户问题由你手动记录。系统只保存、统计、筛选、排序和汇总真实客诉。"
        action={<button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />新增问题</button>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={AlertCircle} label="本月投诉数量" value={metrics.monthTotal} hint="真实记录" tone={metrics.monthTotal ? "watch" : "good"} />
          <ExecutiveKpi icon={Wrench} label="安装问题" value={metrics.byCategory["安装问题"] ?? 0} hint="真实记录" />
          <ExecutiveKpi icon={PackageX} label="质量问题" value={metrics.byCategory["质量问题"] ?? 0} hint="真实记录" />
          <ExecutiveKpi icon={Ruler} label="尺寸问题" value={metrics.byCategory["尺寸问题"] ?? 0} hint="真实记录" />
          <ExecutiveKpi icon={Truck} label="物流问题" value={metrics.byCategory["物流问题"] ?? 0} hint="真实记录" />
          <ExecutiveKpi icon={Palette} label="颜色问题" value={metrics.byCategory["颜色问题"] ?? 0} hint="真实记录" />
        </KpiGrid>
      </CenterHero>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}
      {showForm ? <IssueForm form={form} editing={Boolean(editingId)} onChange={setForm} onSubmit={saveIssue} onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} /> : null}

      {!issues.length ? (
        <EmptyAction title="暂无客诉记录，请点击新增问题进行记录。" button="新增问题" onClick={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <IssueFilters filters={filters} onChange={setFilters} />
            <CenterPanel eyebrow="Ranking" title="投诉排行榜">
              <div className="space-y-3">
                {ranking.length ? ranking.slice(0, 10).map((item) => (
                  <div key={item.category} className="rounded-2xl border border-line bg-white/75 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-semibold text-ink">{item.category}</div>
                      <StatusPill tone={item.percent >= 35 ? "risk" : item.percent >= 20 ? "watch" : "neutral"}>{item.percent}%</StatusPill>
                    </div>
                    <ProgressBar value={item.percent} tone={item.percent >= 35 ? "risk" : item.percent >= 20 ? "watch" : "brand"} />
                    <p className="mt-2 text-xs text-muted">{item.count} 条真实记录</p>
                  </div>
                )) : <EmptyState text="暂无排行数据。" />}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow="Solution Library" title="解决方案库">
              <div className="space-y-3">
                {solutionRows.length ? solutionRows.map((row) => (
                  <div key={`${row.category}-${row.solution}`} className="rounded-2xl border border-line bg-white/75 p-4">
                    <StatusPill tone="brand">{row.category}</StatusPill>
                    <p className="mt-3 text-sm leading-6 text-ink">{row.solution}</p>
                  </div>
                )) : <EmptyState text="暂无解决方案。请在客诉记录中手动填写处理方案。" />}
              </div>
            </CenterPanel>
          </div>

          <div className="space-y-5">
            <CenterPanel eyebrow="Trend Analysis" title="问题趋势分析">
              {trends.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(197,201,189,0.7)" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "rgba(23,72,63,0.06)" }} />
                      <Bar dataKey="安装问题" fill="#17483f" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="尺寸问题" fill="#bca77a" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="物流问题" fill="#8a6834" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState text="暂无趋势数据。" />}
            </CenterPanel>

            <CenterPanel eyebrow="SKU Diagnostics" title="SKU问题分析">
              <div className="grid gap-3 lg:grid-cols-2">
                {skuRows.length ? skuRows.map((row) => (
                  <article key={row.sku} className="rounded-[22px] border border-line bg-white/80 p-4 shadow-[0_10px_26px_rgba(23,33,29,0.06)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{row.productName}</h3>
                        <p className="mt-1 font-mono text-xs text-muted">{row.sku}</p>
                      </div>
                      <StatusPill tone={row.count >= 2 ? "risk" : "good"}>{row.count} 次</StatusPill>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <MetricLine label="主要问题" value={row.topCategory} tone={row.count >= 2 ? "risk" : "neutral"} />
                      <MetricLine label="状态" value={row.count <= 1 ? "稳定" : "需关注"} tone={row.count <= 1 ? "good" : "watch"} />
                    </div>
                  </article>
                )) : <EmptyState text="暂无 SKU 问题数据。" />}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow="Records" title="客诉记录">
              <div className="space-y-3">
                {filteredIssues.map((issue) => (
                  <article key={issue.id} className="rounded-2xl border border-line bg-white/80 p-4 shadow-[0_10px_26px_rgba(23,33,29,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone="brand">{issue.issue_category}</StatusPill>
                          <StatusPill tone={issue.status === "已解决" || issue.status === "已关闭" ? "good" : "watch"}>{issue.status}</StatusPill>
                        </div>
                        <h3 className="mt-3 font-semibold text-ink">{issue.product_name}</h3>
                        <p className="mt-1 font-mono text-xs text-muted">{issue.sku} · {issue.issue_date} · {issue.owner}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="erp-button-subtle px-2.5 py-1.5 text-xs font-bold" onClick={() => startEdit(issue)}><Edit3 className="inline h-3.5 w-3.5" /> 编辑</button>
                        <button className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700" onClick={() => deleteIssue(issue.id)}><Trash2 className="inline h-3.5 w-3.5" /> 删除</button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{issue.issue_description}</p>
                    <Select value={issue.status} options={statusOptions} onChange={(status) => updateStatus(issue.id, status as IssueStatus)} />
                  </article>
                ))}
                {!filteredIssues.length ? <EmptyState text="没有符合筛选条件的客诉记录。" /> : null}
              </div>
            </CenterPanel>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueForm({ form, editing, onChange, onSubmit, onCancel }: { form: typeof emptyForm; editing: boolean; onChange: (form: typeof emptyForm) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  return (
    <CenterPanel eyebrow={editing ? "Edit Issue" : "New Issue"} title={editing ? "编辑客户问题" : "新增客户问题"}>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-4">
        <Field label="日期"><input className="premium-input" type="date" required value={form.issue_date} onChange={(event) => onChange({ ...form, issue_date: event.target.value })} /></Field>
        <Field label="SKU"><input className="premium-input" required value={form.sku} onChange={(event) => onChange({ ...form, sku: event.target.value })} /></Field>
        <Field label="产品名称"><input className="premium-input" required value={form.product_name} onChange={(event) => onChange({ ...form, product_name: event.target.value })} /></Field>
        <Field label="问题分类"><Select value={form.issue_category} options={categoryOptions} onChange={(value) => onChange({ ...form, issue_category: value as IssueCategory })} /></Field>
        <Field label="问题描述"><input className="premium-input" required value={form.issue_description} onChange={(event) => onChange({ ...form, issue_description: event.target.value })} /></Field>
        <Field label="客户原文"><input className="premium-input" value={form.customer_original_text} onChange={(event) => onChange({ ...form, customer_original_text: event.target.value })} /></Field>
        <Field label="处理方案"><input className="premium-input" value={form.solution} onChange={(event) => onChange({ ...form, solution: event.target.value })} /></Field>
        <Field label="责任人"><input className="premium-input" required value={form.owner} onChange={(event) => onChange({ ...form, owner: event.target.value })} /></Field>
        <Field label="状态"><Select value={form.status} options={statusOptions} onChange={(value) => onChange({ ...form, status: value as IssueStatus })} /></Field>
        <Field label="备注"><input className="premium-input" value={form.remark} onChange={(event) => onChange({ ...form, remark: event.target.value })} /></Field>
        <div className="flex items-end gap-2">
          <button className="erp-button-primary h-10 px-4 text-sm font-bold" type="submit">{editing ? "保存修改" : "创建问题"}</button>
          <button className="erp-button-subtle h-10 px-4 text-sm font-bold" type="button" onClick={onCancel}>取消</button>
        </div>
      </form>
    </CenterPanel>
  );
}

function IssueFilters({ filters, onChange }: { filters: { sku: string; category: string; status: string; start: string; end: string }; onChange: (filters: { sku: string; category: string; status: string; start: string; end: string }) => void }) {
  return (
    <CenterPanel eyebrow="Filters" title="筛选客诉">
      <div className="grid gap-3 md:grid-cols-5">
        <input className="premium-input" value={filters.sku} onChange={(event) => onChange({ ...filters, sku: event.target.value })} />
        <Select value={filters.category} options={["全部", ...categoryOptions]} onChange={(category) => onChange({ ...filters, category })} />
        <Select value={filters.status} options={["全部", ...statusOptions]} onChange={(status) => onChange({ ...filters, status })} />
        <input className="premium-input" type="date" value={filters.start} onChange={(event) => onChange({ ...filters, start: event.target.value })} />
        <input className="premium-input" type="date" value={filters.end} onChange={(event) => onChange({ ...filters, end: event.target.value })} />
      </div>
    </CenterPanel>
  );
}

function buildMetrics(issues: CustomerIssue[]) {
  const month = new Date().toISOString().slice(0, 7);
  const monthIssues = issues.filter((issue) => issue.issue_date.startsWith(month));
  return {
    monthTotal: monthIssues.length,
    byCategory: monthIssues.reduce<Record<string, number>>((map, issue) => {
      map[issue.issue_category] = (map[issue.issue_category] ?? 0) + 1;
      return map;
    }, {})
  };
}

function buildRanking(issues: CustomerIssue[]) {
  if (!issues.length) return [];
  const map = issues.reduce<Record<string, number>>((next, issue) => {
    next[issue.issue_category] = (next[issue.issue_category] ?? 0) + 1;
    return next;
  }, {});
  return Object.entries(map).map(([category, count]) => ({ category, count, percent: Math.round((count / issues.length) * 100) })).sort((a, b) => b.count - a.count);
}

function buildMonthlyTrends(issues: CustomerIssue[]) {
  const months = Array.from(new Set(issues.map((issue) => issue.issue_date.slice(0, 7)))).sort();
  return months.map((month) => {
    const rows = issues.filter((issue) => issue.issue_date.startsWith(month));
    return {
      month,
      安装问题: rows.filter((issue) => issue.issue_category === "安装问题").length,
      尺寸问题: rows.filter((issue) => issue.issue_category === "尺寸问题").length,
      物流问题: rows.filter((issue) => issue.issue_category === "物流问题").length
    };
  });
}

function buildSkuRows(issues: CustomerIssue[]) {
  const map = new Map<string, CustomerIssue[]>();
  for (const issue of issues) map.set(issue.sku, [...(map.get(issue.sku) ?? []), issue]);
  return Array.from(map.entries()).map(([sku, rows]) => {
    const categoryCounts = rows.reduce<Record<string, number>>((next, row) => {
      next[row.issue_category] = (next[row.issue_category] ?? 0) + 1;
      return next;
    }, {});
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    return { sku, productName: rows[0].product_name, count: rows.length, topCategory };
  }).sort((a, b) => b.count - a.count);
}

function buildSolutionRows(issues: CustomerIssue[]) {
  const rows = issues.filter((issue) => issue.solution).map((issue) => ({ category: issue.issue_category, solution: issue.solution as string }));
  return Array.from(new Map(rows.map((row) => [`${row.category}-${row.solution}`, row])).values());
}

function applyIssueFilters(issues: CustomerIssue[], filters: { sku: string; category: string; status: string; start: string; end: string }) {
  return issues.filter((issue) => {
    if (filters.sku && !issue.sku.toLowerCase().includes(filters.sku.toLowerCase())) return false;
    if (filters.category !== "全部" && issue.issue_category !== filters.category) return false;
    if (filters.status !== "全部" && issue.status !== filters.status) return false;
    if (filters.start && issue.issue_date < filters.start) return false;
    if (filters.end && issue.issue_date > filters.end) return false;
    return true;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-muted"><span className="mb-1.5 block">{label}</span>{children}</label>;
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select className="premium-input w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
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

function toDateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
