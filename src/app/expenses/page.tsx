"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileText,
  Megaphone,
  PackagePlus,
  Paperclip,
  ReceiptText,
  Save,
  Search,
  Trash2,
  Wallet,
  type LucideIcon
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import type { ExpenseRecord, Language } from "@/lib/types";

type ExpenseForm = {
  expense_date: string;
  category: string;
  expense_name: string;
  amount: string;
  vendor: string;
  payment_method: string;
  owner: string;
  remark: string;
  attachment_url: string;
};

type ExpenseCategoryKey = "warehouse" | "brand" | "development" | "company" | "other";
type SortKey = "date" | "category" | "name" | "amount";

const PAGE_SIZE = 10;
const STORAGE_BUCKET = "expense-attachments";

const categoryColors: Record<ExpenseCategoryKey, string> = {
  warehouse: "#17483f",
  brand: "#406A7A",
  development: "#BCA77A",
  company: "#6D756F",
  other: "#9A7B52"
};

export default function ExpensesPage() {
  return (
    <AppShell>
      <ExpenseCenter />
    </AppShell>
  );
}

function ExpenseCenter() {
  const { language, t, formatCurrency, formatNumber, formatDate } = useLanguage();
  const copy = expenseCopy(language);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [page, setPage] = useState(1);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase.from("expense_records").select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) {
      setMessage(error.message);
      return;
    }
    setRecords((data ?? []) as ExpenseRecord[]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      return;
    }

    let attachmentUrl = form.attachment_url || null;
    let uploadWarning = "";
    if (attachmentFile) {
      const uploaded = await uploadAttachment(auth.user.id, attachmentFile);
      if (uploaded.error) {
        uploadWarning = friendlyExpenseMessage(uploaded.error);
        attachmentUrl = form.attachment_url || null;
      } else {
        attachmentUrl = uploaded.url;
      }
    }

    const payload = {
      user_id: auth.user.id,
      expense_date: form.expense_date,
      category: form.category,
      expense_name: form.expense_name.trim(),
      amount: Number(form.amount || 0),
      vendor: emptyToNull(form.vendor),
      payment_method: emptyToNull(form.payment_method),
      owner: emptyToNull(form.owner),
      remark: emptyToNull(form.remark),
      attachment_url: attachmentUrl
    };

    const { error } = editingId
      ? await supabase.from("expense_records").update(payload).eq("id", editingId)
      : await supabase.from("expense_records").insert(payload);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    resetForm();
    await load();
    if (uploadWarning) setMessage(uploadWarning);
  }

  async function uploadAttachment(userId: string, file: File) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    if (error) return { error: error.message, url: null };
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { error: null, url: data.publicUrl };
  }

  function startEdit(record: ExpenseRecord) {
    setEditingId(record.id);
    setAttachmentFile(null);
    setForm({
      expense_date: record.expense_date,
      category: record.category,
      expense_name: record.expense_name,
      amount: String(record.amount ?? 0),
      vendor: record.vendor ?? "",
      payment_method: record.payment_method ?? "",
      owner: record.owner ?? "",
      remark: record.remark ?? "",
      attachment_url: record.attachment_url ?? ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setAttachmentFile(null);
    setForm(emptyForm());
  }

  async function deleteRecord(id: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    const { error } = await supabase.from("expense_records").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  const metrics = useMemo(() => buildExpenseMetrics(records, copy), [records, copy]);
  const filtered = useMemo(() => filterAndSortRecords(records, search, categoryFilter, sortKey), [records, search, categoryFilter, sortKey]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, sortKey]);

  return (
    <>
      <section className="premium-dashboard-panel relative mb-5 overflow-hidden rounded-[30px] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#bca77a]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-section-eyebrow">
              <ReceiptText className="h-3.5 w-3.5" />
              Expense Center
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{copy.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{copy.subtitle}</p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/72 p-5 text-right shadow-soft">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{copy.monthlyTotal}</div>
            <div className="premium-number mt-2 text-4xl font-semibold tabular-nums text-ink">{formatCurrency(metrics.monthTotal)}</div>
            <div className="mt-2 text-xs font-semibold text-muted">{copy.independentNotice}</div>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <ExpenseKpi icon={Wallet} label={copy.monthlyTotal} value={formatCurrency(metrics.monthTotal)} helper={copy.thisMonth} />
        <ExpenseKpi icon={Building2} label={copy.warehouseOps} value={formatCurrency(metrics.categoryTotals.warehouse)} helper={copy.warehouseItems} />
        <ExpenseKpi icon={Megaphone} label={copy.brandMarketing} value={formatCurrency(metrics.categoryTotals.brand)} helper={copy.brandItems} />
        <ExpenseKpi icon={FileText} label={copy.companyOps} value={formatCurrency(metrics.categoryTotals.company)} helper={copy.companyItems} />
        <ExpenseKpi icon={PackagePlus} label={copy.productDev} value={formatCurrency(metrics.categoryTotals.development)} helper={copy.devItems} />
        <ExpenseKpi icon={ReceiptText} label={copy.monthlyCount} value={formatNumber(metrics.monthCount)} helper={copy.recordCount} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_1.15fr_1fr]">
        <CategoryDonut data={metrics.categoryChart} copy={copy} />
        <MonthlyTrend data={metrics.monthlyTrend} copy={copy} formatCurrency={formatCurrency} />
        <InsightPanel insights={buildInsights(metrics, copy, formatCurrency)} copy={copy} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <ExpenseEntry
          form={form}
          copy={copy}
          editing={Boolean(editingId)}
          saving={saving}
          attachmentFile={attachmentFile}
          onFileChange={setAttachmentFile}
          onFormChange={setForm}
          onCancel={resetForm}
          onSubmit={submit}
        />
        <TopExpenseRanking rows={metrics.topExpenses} copy={copy} formatCurrency={formatCurrency} />
      </section>

      {message ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <section className="premium-dashboard-panel rounded-[28px] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-section-eyebrow">Expense Detail</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.detailTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
              <input className="h-10 min-w-[260px] rounded-xl pl-9" value={search} placeholder={copy.searchPlaceholder} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <select className="h-10 rounded-xl" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">{copy.allCategories}</option>
              {expenseCategories(copy).map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </select>
            <select className="h-10 rounded-xl" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="date">{copy.sortDate}</option>
              <option value="amount">{copy.sortAmount}</option>
              <option value="category">{copy.sortCategory}</option>
              <option value="name">{copy.sortName}</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/65 bg-white/76 shadow-[0_18px_48px_rgba(31,44,38,0.06)] backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-[1220px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-[#f3f5ee]/95 backdrop-blur-xl">
                <tr>
                  <ExpenseTh>{copy.date}</ExpenseTh>
                  <ExpenseTh>{copy.category}</ExpenseTh>
                  <ExpenseTh>{copy.expenseName}</ExpenseTh>
                  <ExpenseTh align="right">{copy.amount}</ExpenseTh>
                  <ExpenseTh>{copy.vendor}</ExpenseTh>
                  <ExpenseTh>{copy.owner}</ExpenseTh>
                  <ExpenseTh>{copy.paymentMethod}</ExpenseTh>
                  <ExpenseTh>{copy.remark}</ExpenseTh>
                  <ExpenseTh>{copy.attachment}</ExpenseTh>
                  <ExpenseTh align="right">{copy.actions}</ExpenseTh>
                </tr>
              </thead>
              <tbody>
                {pageRecords.map((record) => (
                  <tr key={record.id} className="group transition hover:bg-[#eef3ed]/65">
                    <ExpenseTd>{formatDate(`${record.expense_date}T12:00:00`)}</ExpenseTd>
                    <ExpenseTd><CategoryBadge category={record.category} copy={copy} /></ExpenseTd>
                    <ExpenseTd strong>{record.expense_name}</ExpenseTd>
                    <ExpenseTd align="right" strong>{formatCurrency(Number(record.amount))}</ExpenseTd>
                    <ExpenseTd>{record.vendor || "-"}</ExpenseTd>
                    <ExpenseTd>{record.owner || "-"}</ExpenseTd>
                    <ExpenseTd>{paymentLabel(record.payment_method, copy)}</ExpenseTd>
                    <ExpenseTd>{record.remark || "-"}</ExpenseTd>
                    <ExpenseTd>
                      {record.attachment_url ? (
                        <a href={record.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line bg-white/80 px-2.5 py-1 text-xs font-semibold text-brand hover:border-brand/30">
                          <Paperclip className="h-3.5 w-3.5" />
                          {copy.view}
                        </a>
                      ) : "-"}
                    </ExpenseTd>
                    <ExpenseTd align="right">
                      <div className="flex justify-end gap-2">
                        <IconButton label={copy.edit} icon={Edit3} onClick={() => startEdit(record)} />
                        <IconButton label={copy.delete} icon={Trash2} danger onClick={() => deleteRecord(record.id)} />
                      </div>
                    </ExpenseTd>
                  </tr>
                ))}
                {!pageRecords.length ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm font-semibold text-muted">{copy.empty}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
          <span>{copy.pageInfo(page, totalPages, filtered.length)}</span>
          <div className="flex gap-2">
            <button className="rounded-xl border border-line bg-white/80 px-3 py-2 font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="rounded-xl border border-line bg-white/80 px-3 py-2 font-semibold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function ExpenseKpi({ icon: Icon, label, value, helper }: { icon: LucideIcon; label: string; value: string; helper: string }) {
  return (
    <div className="premium-dashboard-card rounded-[24px] p-4 transition duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand/12 to-white p-3 text-brand shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-white/70 bg-white/72 px-2.5 py-1 text-[11px] font-bold text-muted shadow-sm">{helper}</span>
      </div>
      <div className="mt-4 text-xs font-semibold text-muted">{label}</div>
      <div className="premium-number mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function ExpenseEntry({
  form,
  copy,
  editing,
  saving,
  attachmentFile,
  onFileChange,
  onFormChange,
  onCancel,
  onSubmit
}: {
  form: ExpenseForm;
  copy: ExpenseCopy;
  editing: boolean;
  saving: boolean;
  attachmentFile: File | null;
  onFileChange: (file: File | null) => void;
  onFormChange: (form: ExpenseForm) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const projects = expenseProjects(copy).filter((project) => project.category === form.category);
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="premium-section-eyebrow">Expense Entry</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{editing ? copy.editTitle : copy.entryTitle}</h2>
        </div>
        {editing ? <button className="rounded-xl border border-line bg-white/80 px-3 py-2 text-xs font-semibold text-muted" onClick={onCancel}>{copy.cancel}</button> : null}
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <Field label={copy.date}><input type="date" value={form.expense_date} onChange={(event) => onFormChange({ ...form, expense_date: event.target.value })} required /></Field>
        <Field label={copy.category}>
          <select value={form.category} onChange={(event) => onFormChange({ ...form, category: event.target.value, expense_name: "" })}>
            {expenseCategories(copy).map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
        </Field>
        <Field label={copy.expenseName}>
          <select value={form.expense_name} onChange={(event) => onFormChange({ ...form, expense_name: event.target.value })} required>
            <option value="">{copy.selectProject}</option>
            {projects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}
          </select>
        </Field>
        <Field label={copy.amount}><input className="text-right tabular-nums" type="number" min="0" value={form.amount} onChange={(event) => onFormChange({ ...form, amount: event.target.value })} required /></Field>
        <Field label={copy.vendor}><input value={form.vendor} onChange={(event) => onFormChange({ ...form, vendor: event.target.value })} /></Field>
        <Field label={copy.paymentMethod}>
          <select value={form.payment_method} onChange={(event) => onFormChange({ ...form, payment_method: event.target.value })}>
            {paymentMethods(copy).map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
        </Field>
        <Field label={copy.owner}><input value={form.owner} onChange={(event) => onFormChange({ ...form, owner: event.target.value })} /></Field>
        <Field label={copy.attachment}>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 text-sm font-semibold text-muted transition hover:border-brand/30 hover:text-brand">
            <Paperclip className="h-4 w-4" />
            <span className="truncate">{attachmentFile?.name || (form.attachment_url ? copy.attachmentSaved : copy.uploadHint)}</span>
            <input className="hidden" type="file" accept="image/*,.pdf" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
          </label>
        </Field>
        <Field label={copy.remark}><textarea className="min-h-20 md:col-span-2" value={form.remark} onChange={(event) => onFormChange({ ...form, remark: event.target.value })} /></Field>
        <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
          {copy.exclusionNote}
        </div>
        <button className="md:col-span-2 rounded-xl bg-gradient-to-br from-brand to-brand-strong px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <span className="inline-flex items-center justify-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? copy.saving : editing ? copy.update : copy.save}
          </span>
        </button>
      </form>
    </div>
  );
}

function CategoryDonut({ data, copy }: { data: Array<{ name: string; key: ExpenseCategoryKey; value: number; color: string }>; copy: ExpenseCopy }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">Category Mix</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.categoryShare}</h2>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3}>
              {data.map((item) => <Cell key={item.key} fill={item.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
            <span className="font-semibold tabular-nums text-ink">{item.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyTrend({ data, copy, formatCurrency }: { data: Array<{ month: string; monthLabel: string; amount: number }>; copy: ExpenseCopy; formatCurrency: (value: number) => string }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">Monthly Trend</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.monthlyTrend}</h2>
      <div className="mt-5 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="expenseTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#17483f" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#17483f" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#d7d9cf" strokeDasharray="4 7" vertical={false} />
            <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} width={60} />
            <Tooltip
              labelFormatter={(label, payload) => payload?.[0]?.payload?.month ?? label}
              formatter={(value) => [formatCurrency(Number(value)), copy.monthlyTotal]}
            />
            <Area type="monotone" dataKey="amount" stroke="#17483f" strokeWidth={3} fill="url(#expenseTrend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TopExpenseRanking({ rows, copy, formatCurrency }: { rows: Array<{ name: string; amount: number }>; copy: ExpenseCopy; formatCurrency: (value: number) => string }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">Top 10</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.topRanking}</h2>
      <div className="mt-5 space-y-3">
        {rows.map((row, index) => (
          <div key={row.name} className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-muted">TOP {index + 1}</div>
                <div className="mt-1 truncate font-semibold text-ink">{row.name}</div>
              </div>
              <div className="font-semibold tabular-nums text-ink">{formatCurrency(row.amount)}</div>
            </div>
          </div>
        ))}
        {!rows.length ? <div className="py-8 text-center text-sm font-semibold text-muted">{copy.empty}</div> : null}
      </div>
    </div>
  );
}

function InsightPanel({ insights, copy }: { insights: string[]; copy: ExpenseCopy }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">Business Insights</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.insights}</h2>
      <div className="mt-5 space-y-3">
        {insights.map((insight) => (
          <div key={insight} className="flex gap-3 rounded-2xl border border-white/70 bg-white/72 p-4 text-sm font-medium leading-6 text-ink shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6834]" />
            <span>{insight}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBadge({ category, copy }: { category: string; copy: ExpenseCopy }) {
  const item = expenseCategories(copy).find((entry) => entry.key === category);
  return (
    <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm" style={{ borderColor: `${categoryColor(category)}55`, backgroundColor: `${categoryColor(category)}14`, color: categoryColor(category) }}>
      {item?.label ?? category}
    </span>
  );
}

function IconButton({ label, icon: Icon, onClick, danger = false }: { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={label} onClick={onClick} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-line bg-white/80 text-ink hover:border-brand/30 hover:text-brand"}`}>
      <Icon className="h-4 w-4" />
    </button>
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

function ExpenseTh({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`border-b border-line px-4 py-3 text-xs font-extrabold uppercase tracking-[0.1em] text-ink/50 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function ExpenseTd({ children, align = "left", strong = false }: { children: React.ReactNode; align?: "left" | "right"; strong?: boolean }) {
  return <td className={`border-b border-line px-4 py-3 align-middle text-sm ${align === "right" ? "text-right tabular-nums" : "text-left"} ${strong ? "font-semibold text-ink" : "text-ink/78"}`}>{children}</td>;
}

type ExpenseCopy = ReturnType<typeof expenseCopy>;

function emptyForm(): ExpenseForm {
  return {
    expense_date: todayKey(),
    category: "warehouse",
    expense_name: "",
    amount: "",
    vendor: "",
    payment_method: "bank",
    owner: "",
    remark: "",
    attachment_url: ""
  };
}

function buildExpenseMetrics(records: ExpenseRecord[], copy: ExpenseCopy) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = records.filter((record) => record.expense_date?.startsWith(monthKey));
  const monthTotal = sumAmount(currentMonth);
  const monthCount = currentMonth.length;
  const categoryTotals = expenseCategories(copy).reduce((acc, category) => {
    acc[category.key] = sumAmount(currentMonth.filter((record) => record.category === category.key));
    return acc;
  }, {} as Record<ExpenseCategoryKey, number>);
  const categoryChart = expenseCategories(copy).map((category) => ({
    key: category.key,
    name: category.label,
    value: monthTotal > 0 ? (categoryTotals[category.key] / monthTotal) * 100 : 0,
    color: categoryColors[category.key]
  }));
  const monthlyTrend = last12Months().map((month) => ({
    month: month.label,
    monthLabel: month.shortLabel,
    amount: sumAmount(records.filter((record) => record.expense_date?.startsWith(month.key)))
  }));
  const projectTotals = new Map<string, number>();
  currentMonth.forEach((record) => projectTotals.set(record.expense_name, (projectTotals.get(record.expense_name) ?? 0) + Number(record.amount ?? 0)));
  const topExpenses = Array.from(projectTotals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return { monthTotal, monthCount, categoryTotals, categoryChart, monthlyTrend, topExpenses };
}

function buildInsights(metrics: ReturnType<typeof buildExpenseMetrics>, copy: ExpenseCopy, formatCurrency: (value: number) => string) {
  const insights: string[] = [];
  const biggestCategory = Object.entries(metrics.categoryTotals).sort((a, b) => b[1] - a[1])[0] as [ExpenseCategoryKey, number] | undefined;
  const biggestExpense = metrics.topExpenses[0];
  const monthTotal = metrics.monthTotal || 1;
  if (biggestCategory) insights.push(copy.categoryInsight(categoryLabel(biggestCategory[0], copy), ((biggestCategory[1] / monthTotal) * 100).toFixed(1)));
  if (biggestExpense) insights.push(copy.biggestInsight(biggestExpense.name, formatCurrency(biggestExpense.amount)));
  insights.push(copy.warehouseInsight(((metrics.categoryTotals.warehouse / monthTotal) * 100).toFixed(1)));
  insights.push(copy.brandInsight(((metrics.categoryTotals.brand / monthTotal) * 100).toFixed(1)));
  return insights;
}

function filterAndSortRecords(records: ExpenseRecord[], search: string, categoryFilter: string, sortKey: SortKey) {
  const query = search.trim().toLowerCase();
  return [...records]
    .filter((record) => categoryFilter === "all" || record.category === categoryFilter)
    .filter((record) => {
      if (!query) return true;
      return `${record.expense_name} ${record.vendor ?? ""} ${record.owner ?? ""} ${record.payment_method ?? ""} ${record.remark ?? ""}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (sortKey === "amount") return Number(b.amount) - Number(a.amount);
      if (sortKey === "category") return a.category.localeCompare(b.category);
      if (sortKey === "name") return a.expense_name.localeCompare(b.expense_name);
      return b.expense_date.localeCompare(a.expense_date);
    });
}

function sumAmount(rows: ExpenseRecord[]) {
  return rows.reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
}

function expenseCategories(copy: ExpenseCopy): Array<{ key: ExpenseCategoryKey; label: string }> {
  return [
    { key: "warehouse", label: copy.warehouseOps },
    { key: "brand", label: copy.brandMarketing },
    { key: "development", label: copy.productDev },
    { key: "company", label: copy.companyOps },
    { key: "other", label: copy.otherExpense }
  ];
}

function expenseProjects(copy: ExpenseCopy) {
  return [
    ...copy.projects.warehouse.map((name) => ({ category: "warehouse", name })),
    ...copy.projects.brand.map((name) => ({ category: "brand", name })),
    ...copy.projects.development.map((name) => ({ category: "development", name })),
    ...copy.projects.company.map((name) => ({ category: "company", name })),
    ...copy.projects.other.map((name) => ({ category: "other", name }))
  ];
}

function paymentMethods(copy: ExpenseCopy) {
  return [
    { value: "bank", label: copy.bank },
    { value: "card", label: copy.card },
    { value: "cash", label: copy.cash },
    { value: "other", label: copy.otherPayment }
  ];
}

function paymentLabel(value: string | null, copy: ExpenseCopy) {
  return paymentMethods(copy).find((method) => method.value === value)?.label ?? value ?? "-";
}

function categoryLabel(key: ExpenseCategoryKey, copy: ExpenseCopy) {
  return expenseCategories(copy).find((category) => category.key === key)?.label ?? key;
}

function categoryColor(category: string) {
  return categoryColors[(category as ExpenseCategoryKey) || "other"] ?? categoryColors.other;
}

function last12Months() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      shortLabel: `${date.getMonth() + 1}`
    };
  });
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function friendlyExpenseMessage(message: string) {
  if (message.includes("Bucket not found")) {
    return "支出记录已保存，但附件没有上传成功：Supabase Storage 缺少 expense-attachments 存储桶。请执行 supabase/migrations/create-expense-records.sql 或在 Supabase 后台创建该 bucket。";
  }
  return `支出记录已保存，但附件没有上传成功：${message}`;
}

function expenseCopy(language: Language) {
  if (language === "ko") {
    return {
      title: "재무 지출 보고서",
      subtitle: "월간 비용, 지출 구조, 관리 필요 항목을 독립적으로 분석하는 경영 지출 센터입니다.",
      monthlyTotal: "이번 달 총 지출",
      warehouseOps: "창고 운영",
      brandMarketing: "브랜드 마케팅",
      companyOps: "회사 운영",
      productDev: "상품 개발",
      otherExpense: "기타 지출",
      monthlyCount: "이번 달 지출 건수",
      thisMonth: "이번 달",
      warehouseItems: "창고/국내 물류",
      brandItems: "리뷰/체험단/디자인",
      companyItems: "사무/구독/인건비",
      devItems: "샘플 비용",
      recordCount: "입력 기록",
      independentNotice: "독립 재무 모듈",
      categoryShare: "지출 카테고리 비중",
      monthlyTrend: "월별 지출 추세",
      insights: "Business Insights",
      entryTitle: "지출 입력 센터",
      editTitle: "지출 기록 수정",
      detailTitle: "지출 상세 센터",
      topRanking: "TOP10 지출 항목",
      date: "날짜",
      category: "카테고리",
      expenseName: "지출 항목",
      amount: "금액",
      vendor: "거래처",
      paymentMethod: "결제 방식",
      owner: "담당자",
      remark: "메모",
      attachment: "첨부",
      actions: "작업",
      view: "보기",
      edit: "수정",
      delete: "삭제",
      cancel: "취소",
      save: "저장",
      update: "업데이트",
      saving: "저장 중",
      empty: "지출 데이터가 없습니다.",
      searchPlaceholder: "항목 / 거래처 / 담당자 / 메모 검색",
      allCategories: "전체 카테고리",
      sortDate: "날짜순",
      sortAmount: "금액순",
      sortCategory: "카테고리순",
      sortName: "항목명순",
      selectProject: "지출 항목 선택",
      uploadHint: "영수증 / 송금 캡처 / PDF 업로드",
      attachmentSaved: "기존 첨부 있음",
      bank: "계좌이체",
      card: "카드",
      cash: "현금",
      otherPayment: "기타",
      deleteConfirm: "이 지출 기록을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.",
      exclusionNote: "주의: Coupang 광고비, 중국→한국 국제물류, 택배비, 픽업비, 주차비는 중복 집계를 피하기 위해 입력하지 않습니다.",
      pageInfo: (page: number, total: number, count: number) => `${page}/${total} · ${count}건`,
      categoryInsight: (category: string, percent: string) => `이번 달 ${category} 비용이 총 지출의 ${percent}%입니다.`,
      biggestInsight: (name: string, amount: string) => `이번 달 최대 지출 항목은 ${name}, 금액은 ${amount}입니다.`,
      warehouseInsight: (percent: string) => `창고 운영 비용 비중은 ${percent}%입니다. 임대료와 국내 물류비를 점검하세요.`,
      brandInsight: (percent: string) => `브랜드 마케팅 비용 비중은 ${percent}%입니다. 체험단과 디자인비 효율을 확인하세요.`,
      projects: {
        warehouse: ["창고 임대료", "창고 관리비", "한국 국내 물류비"],
        brand: ["리뷰 비용", "체험단 비용", "디자인 비용"],
        development: ["샘플 비용"],
        company: ["사무용품비", "소프트웨어 구독료", "수도/전기/인터넷", "직원 급여", "아르바이트 비용"],
        other: ["기타 운영 지출"]
      }
    };
  }

  return {
    title: "财务支出报表",
    subtitle: "老板财务中心，独立管理经营支出、费用结构、支出趋势与成本控制。",
    monthlyTotal: "本月总支出",
    warehouseOps: "仓库运营费用",
    brandMarketing: "品牌推广费用",
    companyOps: "公司运营费用",
    productDev: "商品开发费用",
    otherExpense: "其它支出",
    monthlyCount: "本月支出笔数",
    thisMonth: "本月",
    warehouseItems: "租金/管理/本土物流",
    brandItems: "刷评/体验团/设计",
    companyItems: "办公/订阅/人员",
    devItems: "样品费",
    recordCount: "录入记录",
    independentNotice: "独立财务模块",
    categoryShare: "支出分类占比",
    monthlyTrend: "月度支出趋势",
    insights: "财务洞察中心",
    entryTitle: "支出录入中心",
    editTitle: "编辑支出记录",
    detailTitle: "支出明细中心",
    topRanking: "TOP10 支出项目",
    date: "日期",
    category: "支出类别",
    expenseName: "支出项目",
    amount: "金额",
    vendor: "供应商",
    paymentMethod: "付款方式",
    owner: "负责人",
    remark: "备注",
    attachment: "附件",
    actions: "操作",
    view: "查看",
    edit: "编辑",
    delete: "删除",
    cancel: "取消",
    save: "保存",
    update: "更新",
    saving: "保存中",
    empty: "暂无支出数据",
    searchPlaceholder: "搜索项目 / 供应商 / 负责人 / 备注",
    allCategories: "全部类别",
    sortDate: "按日期排序",
    sortAmount: "按金额排序",
    sortCategory: "按类别排序",
    sortName: "按项目排序",
    selectProject: "请选择支出项目",
    uploadHint: "上传发票 / 转账截图 / PDF",
    attachmentSaved: "已有附件",
    bank: "银行转账",
    card: "银行卡",
    cash: "现金",
    otherPayment: "其它",
    deleteConfirm: "确定要删除这条支出记录吗？删除后无法恢复。",
    exclusionNote: "注意：不要录入 Coupang广告费、中国→韩国国际物流、快递费用、接机费用、停车费，避免重复统计。",
    pageInfo: (page: number, total: number, count: number) => `第 ${page}/${total} 页 · 共 ${count} 条`,
    categoryInsight: (category: string, percent: string) => `本月${category}占总支出 ${percent}%，需要关注费用结构。`,
    biggestInsight: (name: string, amount: string) => `本月最大支出项目是 ${name}，金额 ${amount}。`,
    warehouseInsight: (percent: string) => `仓库运营费用占比 ${percent}%，建议重点检查仓租、管理费和本土物流费用。`,
    brandInsight: (percent: string) => `品牌推广费用占比 ${percent}%，建议评估刷评论、体验团和设计费用投入产出。`,
    projects: {
      warehouse: ["仓库租金", "仓库管理费", "韩国本土物流费"],
      brand: ["刷评论费用", "体验团费用", "设计费"],
      development: ["样品费"],
      company: ["办公用品费", "软件订阅费", "水电网络费", "员工工资", "兼职费用"],
      other: ["其它经营支出"]
    }
  };
}
