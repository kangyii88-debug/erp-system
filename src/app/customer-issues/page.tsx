"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, Edit3, PackageX, Palette, Plus, Ruler, Trash2, Truck, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
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
const allFilter = "全部";

const copy = {
  zh: {
    eyebrow: "客诉问题库",
    title: "客诉问题库",
    subtitle: "所有客户问题由你手动记录。系统只保存、统计、筛选、排序和汇总真实客诉。",
    newIssue: "新增问题",
    kpiMonth: "本月投诉数量",
    realRecords: "真实记录",
    emptyEyebrow: "空状态",
    emptyTitle: "暂无数据",
    emptyIssue: "暂无客诉记录，请点击新增问题进行记录。",
    rankingEyebrow: "投诉排行",
    rankingTitle: "投诉排行榜",
    solutionEyebrow: "解决方案库",
    solutionTitle: "解决方案库",
    trendEyebrow: "趋势分析",
    trendTitle: "问题趋势分析",
    skuEyebrow: "SKU 诊断",
    skuTitle: "SKU问题分析",
    recordsEyebrow: "记录",
    recordsTitle: "客诉记录",
    filtersEyebrow: "筛选",
    filtersTitle: "筛选客诉",
    formNewEyebrow: "新增问题",
    formEditEyebrow: "编辑问题",
    formNewTitle: "新增客户问题",
    formEditTitle: "编辑客户问题",
    deleteConfirm: "确定删除这条客诉记录吗？",
    noRanking: "暂无排行数据。",
    noSolution: "暂无解决方案。请在客诉记录中手动填写处理方案。",
    noTrend: "暂无趋势数据。",
    noSku: "暂无 SKU 问题数据。",
    noFiltered: "没有符合筛选条件的客诉记录。",
    recordsCount: "条真实记录",
    times: "次",
    mainIssue: "主要问题",
    status: "状态",
    stable: "稳定",
    watch: "需关注",
    edit: "编辑",
    delete: "删除",
    save: "保存修改",
    create: "创建问题",
    cancel: "取消",
    all: "全部",
    skuPlaceholder: "搜索 SKU",
    fields: {
      date: "日期",
      sku: "SKU",
      product: "产品名称",
      category: "问题分类",
      description: "问题描述",
      customerText: "客户原文",
      solution: "处理方案",
      owner: "责任人",
      status: "状态",
      remark: "备注"
    },
    category: {
      "安装问题": "安装问题",
      "质量问题": "质量问题",
      "尺寸问题": "尺寸问题",
      "颜色问题": "颜色问题",
      "物流问题": "物流问题",
      "包装问题": "包装问题",
      "功能问题": "功能问题",
      "其它问题": "其它问题"
    } as Record<IssueCategory, string>,
    statusMap: {
      "待处理": "待处理",
      "处理中": "处理中",
      "已解决": "已解决",
      "已关闭": "已关闭"
    } as Record<IssueStatus, string>
  },
  ko: {
    eyebrow: "고객 리뷰 센터",
    title: "고객 리뷰 센터",
    subtitle: "모든 고객 이슈는 직접 기록합니다. 시스템은 실제 기록만 저장, 통계, 필터링, 정렬, 요약합니다.",
    newIssue: "신규 이슈",
    kpiMonth: "이번 달 접수 수",
    realRecords: "실제 기록",
    emptyEyebrow: "비어 있음",
    emptyTitle: "데이터 없음",
    emptyIssue: "고객 이슈 기록이 없습니다. 신규 이슈를 눌러 기록하세요.",
    rankingEyebrow: "이슈 순위",
    rankingTitle: "불만 유형 순위",
    solutionEyebrow: "해결안 라이브러리",
    solutionTitle: "해결안 라이브러리",
    trendEyebrow: "추세 분석",
    trendTitle: "이슈 추세 분석",
    skuEyebrow: "SKU 진단",
    skuTitle: "SKU 이슈 분석",
    recordsEyebrow: "기록",
    recordsTitle: "고객 이슈 기록",
    filtersEyebrow: "필터",
    filtersTitle: "이슈 필터",
    formNewEyebrow: "신규 이슈",
    formEditEyebrow: "이슈 수정",
    formNewTitle: "고객 이슈 추가",
    formEditTitle: "고객 이슈 수정",
    deleteConfirm: "이 고객 이슈 기록을 삭제할까요?",
    noRanking: "순위 데이터가 없습니다.",
    noSolution: "해결안이 없습니다. 고객 이슈 기록에서 처리 방안을 직접 입력하세요.",
    noTrend: "추세 데이터가 없습니다.",
    noSku: "SKU 이슈 데이터가 없습니다.",
    noFiltered: "필터 조건에 맞는 고객 이슈 기록이 없습니다.",
    recordsCount: "건 실제 기록",
    times: "회",
    mainIssue: "주요 이슈",
    status: "상태",
    stable: "안정",
    watch: "확인 필요",
    edit: "수정",
    delete: "삭제",
    save: "수정 저장",
    create: "이슈 생성",
    cancel: "취소",
    all: "전체",
    skuPlaceholder: "SKU 검색",
    fields: {
      date: "날짜",
      sku: "SKU",
      product: "상품명",
      category: "이슈 분류",
      description: "이슈 설명",
      customerText: "고객 원문",
      solution: "처리 방안",
      owner: "담당자",
      status: "상태",
      remark: "메모"
    },
    category: {
      "安装问题": "설치 문제",
      "质量问题": "품질 문제",
      "尺寸问题": "사이즈 문제",
      "颜色问题": "색상 문제",
      "物流问题": "배송 문제",
      "包装问题": "포장 문제",
      "功能问题": "기능 문제",
      "其它问题": "기타 문제"
    } as Record<IssueCategory, string>,
    statusMap: {
      "待处理": "처리 대기",
      "处理中": "처리 중",
      "已解决": "해결 완료",
      "已关闭": "종료"
    } as Record<IssueStatus, string>
  }
};

type Copy = typeof copy.zh;
type SelectOption = string | { value: string; label: string };

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
  const { language } = useLanguage();
  const c = copy[language];
  const [issues, setIssues] = useState<CustomerIssue[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ sku: "", category: allFilter, status: allFilter, start: "", end: "" });
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
    if (!window.confirm(c.deleteConfirm)) return;
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
  const skuRows = useMemo(() => buildSkuRows(issues, c), [issues, c]);
  const solutionRows = useMemo(() => buildSolutionRows(issues), [issues]);

  return (
    <div className="space-y-6">
      <CenterHero
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
        action={<button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />{c.newIssue}</button>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={AlertCircle} label={c.kpiMonth} value={metrics.monthTotal} hint={c.realRecords} tone={metrics.monthTotal ? "watch" : "good"} />
          <ExecutiveKpi icon={Wrench} label={c.category["安装问题"]} value={metrics.byCategory["安装问题"] ?? 0} hint={c.realRecords} />
          <ExecutiveKpi icon={PackageX} label={c.category["质量问题"]} value={metrics.byCategory["质量问题"] ?? 0} hint={c.realRecords} />
          <ExecutiveKpi icon={Ruler} label={c.category["尺寸问题"]} value={metrics.byCategory["尺寸问题"] ?? 0} hint={c.realRecords} />
          <ExecutiveKpi icon={Truck} label={c.category["物流问题"]} value={metrics.byCategory["物流问题"] ?? 0} hint={c.realRecords} />
          <ExecutiveKpi icon={Palette} label={c.category["颜色问题"]} value={metrics.byCategory["颜色问题"] ?? 0} hint={c.realRecords} />
        </KpiGrid>
      </CenterHero>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}
      {showForm ? <IssueForm c={c} form={form} editing={Boolean(editingId)} onChange={setForm} onSubmit={saveIssue} onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} /> : null}

      {!issues.length ? (
        <EmptyAction c={c} title={c.emptyIssue} button={c.newIssue} onClick={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <IssueFilters c={c} filters={filters} onChange={setFilters} />
            <CenterPanel eyebrow={c.rankingEyebrow} title={c.rankingTitle}>
              <div className="space-y-3">
                {ranking.length ? ranking.slice(0, 10).map((item) => (
                  <div key={item.category} className="rounded-2xl border border-line bg-white/75 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-semibold text-ink">{c.category[item.category as IssueCategory]}</div>
                      <StatusPill tone={item.percent >= 35 ? "risk" : item.percent >= 20 ? "watch" : "neutral"}>{item.percent}%</StatusPill>
                    </div>
                    <ProgressBar value={item.percent} tone={item.percent >= 35 ? "risk" : item.percent >= 20 ? "watch" : "brand"} />
                    <p className="mt-2 text-xs text-muted">{item.count} {c.recordsCount}</p>
                  </div>
                )) : <EmptyState text={c.noRanking} />}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow={c.solutionEyebrow} title={c.solutionTitle}>
              <div className="space-y-3">
                {solutionRows.length ? solutionRows.map((row) => (
                  <div key={`${row.category}-${row.solution}`} className="rounded-2xl border border-line bg-white/75 p-4">
                    <StatusPill tone="brand">{c.category[row.category]}</StatusPill>
                    <p className="mt-3 text-sm leading-6 text-ink">{row.solution}</p>
                  </div>
                )) : <EmptyState text={c.noSolution} />}
              </div>
            </CenterPanel>
          </div>

          <div className="space-y-5">
            <CenterPanel eyebrow={c.trendEyebrow} title={c.trendTitle}>
              {trends.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(197,201,189,0.7)" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "rgba(23,72,63,0.06)" }} />
                      <Bar dataKey="安装问题" name={c.category["安装问题"]} fill="#17483f" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="尺寸问题" name={c.category["尺寸问题"]} fill="#bca77a" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="物流问题" name={c.category["物流问题"]} fill="#8a6834" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState text={c.noTrend} />}
            </CenterPanel>

            <CenterPanel eyebrow={c.skuEyebrow} title={c.skuTitle}>
              <div className="grid gap-3 lg:grid-cols-2">
                {skuRows.length ? skuRows.map((row) => (
                  <article key={row.sku} className="rounded-[22px] border border-line bg-white/80 p-4 shadow-[0_10px_26px_rgba(23,33,29,0.06)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{row.productName}</h3>
                        <p className="mt-1 font-mono text-xs text-muted">{row.sku}</p>
                      </div>
                      <StatusPill tone={row.count >= 2 ? "risk" : "good"}>{row.count} {c.times}</StatusPill>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <MetricLine label={c.mainIssue} value={row.topCategory} tone={row.count >= 2 ? "risk" : "neutral"} />
                      <MetricLine label={c.status} value={row.count <= 1 ? c.stable : c.watch} tone={row.count <= 1 ? "good" : "watch"} />
                    </div>
                  </article>
                )) : <EmptyState text={c.noSku} />}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow={c.recordsEyebrow} title={c.recordsTitle}>
              <div className="space-y-3">
                {filteredIssues.map((issue) => (
                  <article key={issue.id} className="rounded-2xl border border-line bg-white/80 p-4 shadow-[0_10px_26px_rgba(23,33,29,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone="brand">{c.category[issue.issue_category]}</StatusPill>
                          <StatusPill tone={issue.status === "已解决" || issue.status === "已关闭" ? "good" : "watch"}>{c.statusMap[issue.status]}</StatusPill>
                        </div>
                        <h3 className="mt-3 font-semibold text-ink">{issue.product_name}</h3>
                        <p className="mt-1 font-mono text-xs text-muted">{issue.sku} · {issue.issue_date} · {issue.owner}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="erp-button-subtle px-2.5 py-1.5 text-xs font-bold" onClick={() => startEdit(issue)}><Edit3 className="inline h-3.5 w-3.5" /> {c.edit}</button>
                        <button className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700" onClick={() => deleteIssue(issue.id)}><Trash2 className="inline h-3.5 w-3.5" /> {c.delete}</button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{issue.issue_description}</p>
                    <Select value={issue.status} options={statusSelectOptions(c)} onChange={(status) => updateStatus(issue.id, status as IssueStatus)} />
                  </article>
                ))}
                {!filteredIssues.length ? <EmptyState text={c.noFiltered} /> : null}
              </div>
            </CenterPanel>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueForm({ c, form, editing, onChange, onSubmit, onCancel }: { c: Copy; form: typeof emptyForm; editing: boolean; onChange: (form: typeof emptyForm) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  return (
    <CenterPanel eyebrow={editing ? c.formEditEyebrow : c.formNewEyebrow} title={editing ? c.formEditTitle : c.formNewTitle}>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-4">
        <Field label={c.fields.date}><input className="premium-input" type="date" required value={form.issue_date} onChange={(event) => onChange({ ...form, issue_date: event.target.value })} /></Field>
        <Field label={c.fields.sku}><input className="premium-input" required value={form.sku} onChange={(event) => onChange({ ...form, sku: event.target.value })} /></Field>
        <Field label={c.fields.product}><input className="premium-input" required value={form.product_name} onChange={(event) => onChange({ ...form, product_name: event.target.value })} /></Field>
        <Field label={c.fields.category}><Select value={form.issue_category} options={categorySelectOptions(c)} onChange={(value) => onChange({ ...form, issue_category: value as IssueCategory })} /></Field>
        <Field label={c.fields.description}><input className="premium-input" required value={form.issue_description} onChange={(event) => onChange({ ...form, issue_description: event.target.value })} /></Field>
        <Field label={c.fields.customerText}><input className="premium-input" value={form.customer_original_text} onChange={(event) => onChange({ ...form, customer_original_text: event.target.value })} /></Field>
        <Field label={c.fields.solution}><input className="premium-input" value={form.solution} onChange={(event) => onChange({ ...form, solution: event.target.value })} /></Field>
        <Field label={c.fields.owner}><input className="premium-input" required value={form.owner} onChange={(event) => onChange({ ...form, owner: event.target.value })} /></Field>
        <Field label={c.fields.status}><Select value={form.status} options={statusSelectOptions(c)} onChange={(value) => onChange({ ...form, status: value as IssueStatus })} /></Field>
        <Field label={c.fields.remark}><input className="premium-input" value={form.remark} onChange={(event) => onChange({ ...form, remark: event.target.value })} /></Field>
        <div className="flex items-end gap-2">
          <button className="erp-button-primary h-10 px-4 text-sm font-bold" type="submit">{editing ? c.save : c.create}</button>
          <button className="erp-button-subtle h-10 px-4 text-sm font-bold" type="button" onClick={onCancel}>{c.cancel}</button>
        </div>
      </form>
    </CenterPanel>
  );
}

function IssueFilters({ c, filters, onChange }: { c: Copy; filters: { sku: string; category: string; status: string; start: string; end: string }; onChange: (filters: { sku: string; category: string; status: string; start: string; end: string }) => void }) {
  return (
    <CenterPanel eyebrow={c.filtersEyebrow} title={c.filtersTitle}>
      <div className="grid gap-3 md:grid-cols-5">
        <input className="premium-input" placeholder={c.skuPlaceholder} value={filters.sku} onChange={(event) => onChange({ ...filters, sku: event.target.value })} />
        <Select value={filters.category} options={[{ value: allFilter, label: c.all }, ...categorySelectOptions(c)]} onChange={(category) => onChange({ ...filters, category })} />
        <Select value={filters.status} options={[{ value: allFilter, label: c.all }, ...statusSelectOptions(c)]} onChange={(status) => onChange({ ...filters, status })} />
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

function buildSkuRows(issues: CustomerIssue[], c: Copy) {
  const map = new Map<string, CustomerIssue[]>();
  for (const issue of issues) map.set(issue.sku, [...(map.get(issue.sku) ?? []), issue]);
  return Array.from(map.entries()).map(([sku, rows]) => {
    const categoryCounts = rows.reduce<Record<string, number>>((next, row) => {
      next[row.issue_category] = (next[row.issue_category] ?? 0) + 1;
      return next;
    }, {});
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as IssueCategory | undefined;
    const topCategoryLabel = topCategory ? c.category[topCategory] : "-";
    return { sku, productName: rows[0].product_name, count: rows.length, topCategory: topCategoryLabel };
  }).sort((a, b) => b.count - a.count);
}

function buildSolutionRows(issues: CustomerIssue[]) {
  const rows = issues.filter((issue) => issue.solution).map((issue) => ({ category: issue.issue_category, solution: issue.solution as string }));
  return Array.from(new Map(rows.map((row) => [`${row.category}-${row.solution}`, row])).values());
}

function applyIssueFilters(issues: CustomerIssue[], filters: { sku: string; category: string; status: string; start: string; end: string }) {
  return issues.filter((issue) => {
    if (filters.sku && !issue.sku.toLowerCase().includes(filters.sku.toLowerCase())) return false;
    if (filters.category !== allFilter && issue.issue_category !== filters.category) return false;
    if (filters.status !== allFilter && issue.status !== filters.status) return false;
    if (filters.start && issue.issue_date < filters.start) return false;
    if (filters.end && issue.issue_date > filters.end) return false;
    return true;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-muted"><span className="mb-1.5 block">{label}</span>{children}</label>;
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

function EmptyAction({ c, title, button, onClick }: { c: Copy; title: string; button: string; onClick: () => void }) {
  return (
    <CenterPanel eyebrow={c.emptyEyebrow} title={c.emptyTitle}>
      <div className="rounded-[26px] border border-dashed border-[#cdd8cf] bg-white/65 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f2ed] text-[#17483f]"><Plus className="h-6 w-6" /></div>
        <p className="mt-4 text-base font-semibold text-ink">{title}</p>
        <button className="erp-button-primary mt-5 px-4 py-2 text-sm font-bold" onClick={onClick}>{button}</button>
      </div>
    </CenterPanel>
  );
}

function categorySelectOptions(c: Copy): SelectOption[] {
  return categoryOptions.map((category) => ({ value: category, label: c.category[category] }));
}

function statusSelectOptions(c: Copy): SelectOption[] {
  return statusOptions.map((status) => ({ value: status, label: c.statusMap[status] }));
}

function toDateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
