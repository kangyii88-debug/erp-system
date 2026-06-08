"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Edit3,
  FileSpreadsheet,
  Landmark,
  Megaphone,
  MilkIcon,
  Paperclip,
  ReceiptText,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
  type LucideIcon
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import type { CoupangSettlement, Language } from "@/lib/types";

type SettlementForm = {
  sales_month: string;
  settlement_month: string;
  sales_amount: string;
  cancel_amount: string;
  sales_fee: string;
  seller_coupon: string;
  milk_run_fee: string;
  ad_fee: string;
  settlement_deduction: string;
  fulfillment_fee: string;
  inventory_loss_compensation: string;
  final_payment_amount: string;
  remark: string;
  attachment_url: string;
};

type SortKey = "month" | "sales" | "payment" | "adRate" | "paymentRate";

const PAGE_SIZE = 10;
const STORAGE_BUCKET = "settlement-attachments";

export default function SettlementsPage() {
  return (
    <AppShell>
      <SettlementCenter />
    </AppShell>
  );
}

function SettlementCenter() {
  const { language, formatCurrency, formatNumber, formatDate } = useLanguage();
  const copy = settlementCopy(language);
  const [records, setRecords] = useState<CoupangSettlement[]>([]);
  const [form, setForm] = useState<SettlementForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("month");
  const [page, setPage] = useState(1);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase.from("coupang_settlements").select("*").order("settlement_month", { ascending: false });
    if (error) {
      setMessage(error.message);
      return;
    }
    setRecords((data ?? []) as CoupangSettlement[]);
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
    if (attachmentFile) {
      const uploaded = await uploadAttachment(auth.user.id, attachmentFile);
      if (uploaded.error) {
        setMessage(uploaded.error);
        setSaving(false);
        return;
      }
      attachmentUrl = uploaded.url;
    }

    const calc = calculateSettlement(form);
    const payload = {
      user_id: auth.user.id,
      sales_month: monthToDate(form.sales_month),
      settlement_month: monthToDate(form.settlement_month),
      sales_amount: calc.salesAmount,
      cancel_amount: calc.cancelAmount,
      actual_sales_amount: calc.actualSalesAmount,
      sales_fee: calc.salesFee,
      seller_coupon: calc.sellerCoupon,
      milk_run_fee: calc.milkRunFee,
      ad_fee: calc.adFee,
      settlement_deduction: calc.settlementDeduction,
      fulfillment_fee: calc.fulfillmentFee,
      inventory_loss_compensation: calc.inventoryLossCompensation,
      final_payment_amount: calc.finalPaymentAmount,
      cancel_rate: calc.cancelRate,
      fee_rate: calc.feeRate,
      ad_rate: calc.adRate,
      payment_rate: calc.paymentRate,
      remark: emptyToNull(form.remark),
      attachment_url: attachmentUrl
    };

    const { error } = editingId
      ? await supabase.from("coupang_settlements").update(payload).eq("id", editingId)
      : await supabase.from("coupang_settlements").insert(payload);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    resetForm();
    await load();
  }

  async function uploadAttachment(userId: string, file: File) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    if (error) return { error: error.message, url: null };
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { error: null, url: data.publicUrl };
  }

  function startEdit(record: CoupangSettlement) {
    setEditingId(record.id);
    setAttachmentFile(null);
    setForm({
      sales_month: monthInputValue(record.sales_month ?? record.settlement_month),
      settlement_month: monthInputValue(record.settlement_month),
      sales_amount: String(record.sales_amount ?? 0),
      cancel_amount: String(record.cancel_amount ?? 0),
      sales_fee: String(record.sales_fee ?? 0),
      seller_coupon: String(record.seller_coupon ?? 0),
      milk_run_fee: String(record.milk_run_fee ?? 0),
      ad_fee: String(record.ad_fee ?? 0),
      settlement_deduction: String(record.settlement_deduction ?? 0),
      fulfillment_fee: String(record.fulfillment_fee ?? 0),
      inventory_loss_compensation: String(record.inventory_loss_compensation ?? 0),
      final_payment_amount: String(record.final_payment_amount ?? 0),
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
    const { error } = await supabase.from("coupang_settlements").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  const current = currentMonthRecord(records);
  const currentMetrics = current ?? calculatedRecordFromForm(form);
  const filtered = useMemo(() => filterAndSort(records, search, monthFilter, sortKey), [records, search, monthFilter, sortKey]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const months = uniqueMonths(records);
  const trendData = buildTrendData(records);
  const waterfallData = buildWaterfallData(currentMetrics, copy);
  const formPreview = calculateSettlement(form);

  useEffect(() => {
    setPage(1);
  }, [search, monthFilter, sortKey]);

  return (
    <>
      <section className="premium-dashboard-panel relative mb-5 overflow-hidden rounded-[30px] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#bca77a]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-section-eyebrow">
              <Landmark className="h-3.5 w-3.5" />
              Coupang Settlement Center
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{copy.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{copy.subtitle}</p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/72 p-5 text-right shadow-soft">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{copy.finalPayment}</div>
            <div className="premium-number mt-2 text-4xl font-semibold tabular-nums text-brand">{formatCurrency(currentMetrics.final_payment_amount)}</div>
            <div className="mt-2 text-xs font-semibold text-muted">{copy.independentNotice}</div>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-9">
        <SettlementKpi icon={Wallet} label={copy.salesAmount} value={formatCurrency(currentMetrics.sales_amount)} helper={copy.thisMonth} />
        <SettlementKpi icon={XCircle} label={copy.cancelAmount} value={formatCurrency(currentMetrics.cancel_amount)} helper={formatPercent(currentMetrics.cancel_rate)} tone="red" />
        <SettlementKpi icon={BarChart3} label={copy.salesBase} value={formatCurrency(salesBaseAmount(currentMetrics))} helper={copy.afterFeeCoupon} />
        <SettlementKpi icon={CreditCard} label={copy.salesFee} value={formatCurrency(currentMetrics.sales_fee)} helper={formatPercent(currentMetrics.fee_rate)} tone="yellow" />
        <SettlementKpi icon={ReceiptText} label={copy.sellerCoupon} value={formatCurrency(currentMetrics.seller_coupon)} helper={copy.deduction} tone="slate" />
        <SettlementKpi icon={Megaphone} label={copy.adFee} value={formatCurrency(currentMetrics.ad_fee)} helper={formatPercent(currentMetrics.ad_rate)} tone="red" />
        <SettlementKpi icon={MilkIcon} label={copy.milkRunFee} value={formatCurrency(currentMetrics.milk_run_fee)} helper={copy.logistics} tone="yellow" />
        <SettlementKpi icon={ShieldCheck} label={copy.compensation} value={formatCurrency(currentMetrics.inventory_loss_compensation)} helper={copy.addBack} tone="green" />
        <SettlementKpi icon={Landmark} label={copy.finalPayment} value={formatCurrency(currentMetrics.final_payment_amount)} helper={copy.platformPaysYou} tone="green" />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <SettlementEntry
          form={form}
          copy={copy}
          preview={formPreview}
          editing={Boolean(editingId)}
          saving={saving}
          attachmentFile={attachmentFile}
          onFormChange={setForm}
          onFileChange={setAttachmentFile}
          onCancel={resetForm}
          onSubmit={submit}
          formatCurrency={formatCurrency}
        />
        <BusinessInsights insights={buildInsights(currentMetrics, previousRecord(records, currentMetrics.settlement_month), copy, formatCurrency)} copy={copy} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <TrendPanel data={trendData} copy={copy} formatCurrency={formatCurrency} />
        <WaterfallPanel data={waterfallData} copy={copy} formatCurrency={formatCurrency} />
      </section>

      {message ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <section className="premium-dashboard-panel rounded-[28px] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-section-eyebrow">Settlement Detail</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.detailTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
              <input className="h-10 min-w-[240px] rounded-xl pl-9" value={search} placeholder={copy.searchPlaceholder} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <select className="h-10 rounded-xl" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
              <option value="all">{copy.allMonths}</option>
              {months.map((month) => <option key={month} value={month}>{month}</option>)}
            </select>
            <select className="h-10 rounded-xl" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="month">{copy.sortMonth}</option>
              <option value="sales">{copy.sortSales}</option>
              <option value="payment">{copy.sortPayment}</option>
              <option value="adRate">{copy.sortAdRate}</option>
              <option value="paymentRate">{copy.sortPaymentRate}</option>
            </select>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white/80 px-3 text-sm font-semibold text-ink shadow-sm hover:border-brand/30 hover:text-brand" onClick={() => exportSettlementCsv(filtered)}>
              <Download className="h-4 w-4" /> CSV
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white/80 px-3 text-sm font-semibold text-ink shadow-sm hover:border-brand/30 hover:text-brand" onClick={() => exportSettlementCsv(filtered, "xls")}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/65 bg-white/76 shadow-[0_18px_48px_rgba(31,44,38,0.06)] backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-[#f3f5ee]/95 backdrop-blur-xl">
                <tr>
                  <SettlementTh>{copy.salesMonth}</SettlementTh>
                  <SettlementTh>{copy.settlementMonth}</SettlementTh>
                  <SettlementTh align="right">{copy.salesAmount}</SettlementTh>
                  <SettlementTh align="right">{copy.cancelAmount}</SettlementTh>
                  <SettlementTh align="right">{copy.actualSales}</SettlementTh>
                  <SettlementTh align="right">{copy.salesFee}</SettlementTh>
                  <SettlementTh align="right">{copy.sellerCoupon}</SettlementTh>
                  <SettlementTh align="right">{copy.adFee}</SettlementTh>
                  <SettlementTh align="right">{copy.milkRunFee}</SettlementTh>
                  <SettlementTh align="right">{copy.compensation}</SettlementTh>
                  <SettlementTh align="right">{copy.finalPayment}</SettlementTh>
                  <SettlementTh align="right">{copy.cancelRate}</SettlementTh>
                  <SettlementTh align="right">{copy.adRate}</SettlementTh>
                  <SettlementTh align="right">{copy.paymentRate}</SettlementTh>
                  <SettlementTh align="right">{copy.actions}</SettlementTh>
                </tr>
              </thead>
              <tbody>
                {pageRecords.map((record) => (
                  <tr key={record.id} className="group transition hover:bg-[#eef3ed]/65">
                    <SettlementTd>{monthInputValue(record.sales_month ?? record.settlement_month)}</SettlementTd>
                    <SettlementTd>{monthInputValue(record.settlement_month)}</SettlementTd>
                    <SettlementTd align="right">{formatCurrency(record.sales_amount)}</SettlementTd>
                    <SettlementTd align="right">{formatCurrency(record.cancel_amount)}</SettlementTd>
                    <SettlementTd align="right" strong>{formatCurrency(record.actual_sales_amount)}</SettlementTd>
                    <SettlementTd align="right">{formatCurrency(record.sales_fee)}</SettlementTd>
                    <SettlementTd align="right">{formatCurrency(record.seller_coupon)}</SettlementTd>
                    <SettlementTd align="right">{formatCurrency(record.ad_fee)}</SettlementTd>
                    <SettlementTd align="right">{formatCurrency(record.milk_run_fee)}</SettlementTd>
                    <SettlementTd align="right">{formatCurrency(record.inventory_loss_compensation)}</SettlementTd>
                    <SettlementTd align="right" strong>{formatCurrency(record.final_payment_amount)}</SettlementTd>
                    <SettlementTd align="right"><RateBadge value={record.cancel_rate} tone={record.cancel_rate > 0.18 ? "bad" : "normal"} /></SettlementTd>
                    <SettlementTd align="right"><RateBadge value={record.ad_rate} tone={record.ad_rate > 0.15 ? "bad" : "normal"} /></SettlementTd>
                    <SettlementTd align="right"><RateBadge value={record.payment_rate} tone={record.payment_rate < 0.65 ? "bad" : "normal"} /></SettlementTd>
                    <SettlementTd align="right">
                      <div className="flex justify-end gap-2">
                        {record.attachment_url ? (
                          <a title={copy.attachment} href={record.attachment_url} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/80 text-brand shadow-sm hover:border-brand/30">
                            <Paperclip className="h-4 w-4" />
                          </a>
                        ) : null}
                        <IconButton label={copy.edit} icon={Edit3} onClick={() => startEdit(record)} />
                        <IconButton label={copy.delete} icon={Trash2} danger onClick={() => deleteRecord(record.id)} />
                      </div>
                    </SettlementTd>
                  </tr>
                ))}
                {!pageRecords.length ? (
                  <tr><td colSpan={15} className="px-4 py-10 text-center text-sm font-semibold text-muted">{copy.empty}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
          <span>{copy.pageInfo(page, totalPages, filtered.length)}</span>
          <div className="flex gap-2">
            <button className="rounded-xl border border-line bg-white/80 px-3 py-2 font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></button>
            <button className="rounded-xl border border-line bg-white/80 px-3 py-2 font-semibold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>
    </>
  );
}

function SettlementKpi({ icon: Icon, label, value, helper, tone = "green" }: { icon: LucideIcon; label: string; value: string; helper: string; tone?: "green" | "red" | "yellow" | "slate" }) {
  const toneClass = {
    green: "from-brand/12 text-brand",
    red: "from-red-500/12 text-red-700",
    yellow: "from-[#bca77a]/20 text-[#8a6834]",
    slate: "from-slate-500/12 text-slate-600"
  }[tone];
  return (
    <div className="premium-dashboard-card rounded-[24px] p-4 transition duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-2xl bg-gradient-to-br ${toneClass} to-white p-3 shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-white/70 bg-white/72 px-2.5 py-1 text-[11px] font-bold text-muted shadow-sm">{helper}</span>
      </div>
      <div className="mt-4 text-xs font-semibold text-muted">{label}</div>
      <div className="premium-number mt-2 text-xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function SettlementEntry({
  form,
  copy,
  preview,
  editing,
  saving,
  attachmentFile,
  onFormChange,
  onFileChange,
  onCancel,
  onSubmit,
  formatCurrency
}: {
  form: SettlementForm;
  copy: SettlementCopy;
  preview: ReturnType<typeof calculateSettlement>;
  editing: boolean;
  saving: boolean;
  attachmentFile: File | null;
  onFormChange: (form: SettlementForm) => void;
  onFileChange: (file: File | null) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
  formatCurrency: (value: number) => string;
}) {
  const fields: Array<[keyof SettlementForm, string]> = [
    ["sales_amount", copy.salesAmount],
    ["cancel_amount", copy.cancelAmount],
    ["sales_fee", copy.salesFee],
    ["seller_coupon", copy.sellerCoupon],
    ["milk_run_fee", copy.milkRunFee],
    ["ad_fee", copy.adFee],
    ["settlement_deduction", copy.settlementDeduction],
    ["fulfillment_fee", copy.fulfillmentFee],
    ["inventory_loss_compensation", copy.compensation]
  ];
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="premium-section-eyebrow">Settlement Entry</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{editing ? copy.editTitle : copy.entryTitle}</h2>
        </div>
        {editing ? <button className="rounded-xl border border-line bg-white/80 px-3 py-2 text-xs font-semibold text-muted" onClick={onCancel}>{copy.cancel}</button> : null}
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <Field label={copy.salesMonth}><input type="month" value={form.sales_month} onChange={(event) => onFormChange({ ...form, sales_month: event.target.value })} required /></Field>
        <Field label={copy.settlementMonth}><input type="month" value={form.settlement_month} onChange={(event) => onFormChange({ ...form, settlement_month: event.target.value })} required /></Field>
        {fields.map(([key, label]) => (
          <Field key={key} label={label}>
            <input className="text-right tabular-nums" type="number" min={key === "seller_coupon" ? undefined : "0"} value={form[key]} onChange={(event) => onFormChange({ ...form, [key]: event.target.value })} />
          </Field>
        ))}
        <Field label={copy.finalPaymentInput}>
          <input className="text-right tabular-nums font-semibold text-brand" type="text" value={formatCurrency(preview.finalPaymentAmount)} readOnly />
        </Field>
        <Field label={copy.attachment}>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 text-sm font-semibold text-muted transition hover:border-brand/30 hover:text-brand">
            <Paperclip className="h-4 w-4" />
            <span className="truncate">{attachmentFile?.name || (form.attachment_url ? copy.attachmentSaved : copy.uploadHint)}</span>
            <input className="hidden" type="file" accept="image/*,.pdf,.xls,.xlsx,.csv" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
          </label>
        </Field>
        <Field label={copy.remark}><textarea className="min-h-20" value={form.remark} onChange={(event) => onFormChange({ ...form, remark: event.target.value })} /></Field>
        <div className="md:col-span-2 grid gap-3 rounded-2xl border border-white/70 bg-white/70 p-4 md:grid-cols-5">
          <MiniCalc label={copy.actualSales} value={formatCurrency(preview.actualSalesAmount)} />
          <MiniCalc label={copy.salesBase} value={formatCurrency(preview.salesBaseAmount)} />
          <MiniCalc label={copy.additionalDeduction} value={formatCurrency(preview.additionalDeduction)} />
          <MiniCalc label={copy.compensation} value={formatCurrency(preview.inventoryLossCompensation)} />
          <MiniCalc label={copy.autoFinalPayment} value={formatCurrency(preview.finalPaymentAmount)} />
        </div>
        <div className="md:col-span-2 rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3 text-xs font-semibold leading-6 text-brand">
          {copy.formulaHint}
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

function MiniCalc({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/80 p-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="premium-number mt-2 text-lg font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function TrendPanel({ data, copy, formatCurrency }: { data: SettlementTrendRow[]; copy: SettlementCopy; formatCurrency: (value: number) => string }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">Trend Analysis</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.trendTitle}</h2>
      <div className="mt-5 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="settlementSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#17483f" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#17483f" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#d7d9cf" strokeDasharray="4 7" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} width={58} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} width={40} />
            <Tooltip formatter={(value, name) => String(name).includes("Rate") ? formatPercent(Number(value)) : formatCurrency(Number(value))} />
            <Area yAxisId="left" type="monotone" dataKey="sales" name={copy.salesAmount} stroke="#17483f" strokeWidth={3} fill="url(#settlementSales)" />
            <Line yAxisId="left" type="monotone" dataKey="payment" name={copy.finalPayment} stroke="#406A7A" strokeWidth={3} dot={false} />
            <Line yAxisId="left" type="monotone" dataKey="adFee" name={copy.adFee} stroke="#9a3f3f" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="cancelRate" name="cancelRate" stroke="#BCA77A" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="feeRate" name="feeRate" stroke="#6D756F" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="paymentRate" name="paymentRate" stroke="#23614f" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WaterfallPanel({ data, copy, formatCurrency }: { data: WaterfallRow[]; copy: SettlementCopy; formatCurrency: (value: number) => string }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">Settlement Waterfall</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.waterfallTitle}</h2>
      <div className="mt-5 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#d7d9cf" strokeDasharray="4 7" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#66706a", fontSize: 12 }} width={60} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
              {data.map((item) => <Cell key={item.label} fill={item.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BusinessInsights({ insights, copy }: { insights: string[]; copy: SettlementCopy }) {
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

function RateBadge({ value, tone }: { value: number; tone: "bad" | "normal" }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone === "bad" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{formatPercent(value)}</span>;
}

function IconButton({ label, icon: Icon, onClick, danger = false }: { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={label} onClick={onClick} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-line bg-white/80 text-ink hover:border-brand/30 hover:text-brand"}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>{children}</label>;
}

function SettlementTh({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`border-b border-line px-4 py-3 text-xs font-extrabold uppercase tracking-[0.1em] text-ink/50 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function SettlementTd({ children, align = "left", strong = false }: { children: React.ReactNode; align?: "left" | "right"; strong?: boolean }) {
  return <td className={`border-b border-line px-4 py-3 align-middle text-sm ${align === "right" ? "text-right tabular-nums" : "text-left"} ${strong ? "font-semibold text-ink" : "text-ink/78"}`}>{children}</td>;
}

type SettlementCopy = ReturnType<typeof settlementCopy>;
type SettlementTrendRow = { month: string; sales: number; payment: number; adFee: number; cancelRate: number; feeRate: number; paymentRate: number };
type WaterfallRow = { label: string; value: number; color: string };

function emptyForm(): SettlementForm {
  return {
    sales_month: previousMonthKey(),
    settlement_month: currentMonthKey(),
    sales_amount: "",
    cancel_amount: "",
    sales_fee: "",
    seller_coupon: "",
    milk_run_fee: "",
    ad_fee: "",
    settlement_deduction: "",
    fulfillment_fee: "",
    inventory_loss_compensation: "",
    final_payment_amount: "",
    remark: "",
    attachment_url: ""
  };
}

function calculateSettlement(form: SettlementForm) {
  const salesAmount = amount(form.sales_amount);
  const cancelAmount = amount(form.cancel_amount);
  const salesFee = amount(form.sales_fee);
  const sellerCoupon = coupangCouponAmount(form.seller_coupon);
  const milkRunFee = amount(form.milk_run_fee);
  const adFee = amount(form.ad_fee);
  const settlementDeduction = amount(form.settlement_deduction);
  const fulfillmentFee = amount(form.fulfillment_fee);
  const inventoryLossCompensation = amount(form.inventory_loss_compensation);
  // Coupang statement flow:
  // 판매액 - 취소액 = 소계, then 소계 - 판매수수료(B) - 상계금액(C) = 판매기준 매출액.
  // Users can enter 10,000 naturally; Coupang shows it as -10,000 in 상계금액(C).
  const actualSalesAmount = salesAmount - cancelAmount;
  const salesBaseAmount = actualSalesAmount - salesFee - sellerCoupon;
  const additionalDeduction = milkRunFee + adFee + settlementDeduction;
  const finalPaymentAmount = salesBaseAmount - additionalDeduction - fulfillmentFee + inventoryLossCompensation;

  return {
    settlementMonth: monthToDate(form.settlement_month),
    salesAmount,
    cancelAmount,
    actualSalesAmount,
    salesFee,
    sellerCoupon,
    milkRunFee,
    adFee,
    settlementDeduction,
    fulfillmentFee,
    inventoryLossCompensation,
    salesBaseAmount,
    additionalDeduction,
    finalPaymentAmount,
    cancelRate: rate(cancelAmount, salesAmount),
    feeRate: rate(salesFee, actualSalesAmount),
    adRate: rate(adFee, actualSalesAmount),
    paymentRate: rate(finalPaymentAmount, actualSalesAmount)
  };
}

function calculatedRecordFromForm(form: SettlementForm): CoupangSettlement {
  const calc = calculateSettlement(form);
  return {
    id: "preview",
    user_id: "",
    sales_month: monthToDate(form.sales_month),
    settlement_month: calc.settlementMonth,
    sales_amount: calc.salesAmount,
    cancel_amount: calc.cancelAmount,
    actual_sales_amount: calc.actualSalesAmount,
    sales_fee: calc.salesFee,
    seller_coupon: calc.sellerCoupon,
    milk_run_fee: calc.milkRunFee,
    ad_fee: calc.adFee,
    settlement_deduction: calc.settlementDeduction,
    fulfillment_fee: calc.fulfillmentFee,
    inventory_loss_compensation: calc.inventoryLossCompensation,
    final_payment_amount: calc.finalPaymentAmount,
    cancel_rate: calc.cancelRate,
    fee_rate: calc.feeRate,
    ad_rate: calc.adRate,
    payment_rate: calc.paymentRate,
    remark: null,
    attachment_url: null,
    created_at: new Date().toISOString()
  };
}

function salesBaseAmount(record: CoupangSettlement) {
  return Number(record.actual_sales_amount ?? 0) - Number(record.sales_fee ?? 0) - Number(record.seller_coupon ?? 0);
}

function currentMonthRecord(records: CoupangSettlement[]) {
  const key = currentMonthKey();
  return records.find((record) => monthInputValue(record.settlement_month) === key) ?? records[0] ?? null;
}

function previousRecord(records: CoupangSettlement[], month: string) {
  const sorted = [...records].sort((a, b) => b.settlement_month.localeCompare(a.settlement_month));
  const index = sorted.findIndex((record) => record.settlement_month === month);
  return index >= 0 ? sorted[index + 1] ?? null : null;
}

function buildTrendData(records: CoupangSettlement[]): SettlementTrendRow[] {
  const map = new Map(records.map((record) => [monthInputValue(record.settlement_month), record]));
  return last12Months().map((month) => {
    const record = map.get(month.key);
    return {
      month: month.label,
      sales: Number(record?.sales_amount ?? 0),
      payment: Number(record?.final_payment_amount ?? 0),
      adFee: Number(record?.ad_fee ?? 0),
      cancelRate: Number(record?.cancel_rate ?? 0),
      feeRate: Number(record?.fee_rate ?? 0),
      paymentRate: Number(record?.payment_rate ?? 0)
    };
  });
}

function buildWaterfallData(record: CoupangSettlement, copy: SettlementCopy): WaterfallRow[] {
  return [
    { label: copy.salesAmount, value: Number(record.sales_amount ?? 0), color: "#17483f" },
    { label: copy.cancelAmount, value: -Number(record.cancel_amount ?? 0), color: "#9a3f3f" },
    { label: copy.salesFee, value: -Number(record.sales_fee ?? 0), color: "#8a6834" },
    { label: copy.sellerCoupon, value: -Number(record.seller_coupon ?? 0), color: "#6D756F" },
    { label: copy.adFee, value: -Number(record.ad_fee ?? 0), color: "#B45B4D" },
    { label: copy.milkRunFee, value: -Number(record.milk_run_fee ?? 0), color: "#BCA77A" },
    { label: copy.compensation, value: Number(record.inventory_loss_compensation ?? 0), color: "#23614f" },
    { label: copy.finalPayment, value: Number(record.final_payment_amount ?? 0), color: "#406A7A" }
  ];
}

function buildInsights(current: CoupangSettlement, previous: CoupangSettlement | null, copy: SettlementCopy, formatCurrency: (value: number) => string) {
  const insights: string[] = [];
  if (current.cancel_rate > 0.18) insights.push(copy.cancelInsight(formatPercent(current.cancel_rate)));
  else insights.push(copy.cancelNormal(formatPercent(current.cancel_rate)));
  if (current.ad_rate > 0.15) insights.push(copy.adInsight(formatPercent(current.ad_rate)));
  if (current.fee_rate > 0.12) insights.push(copy.feeInsight(formatPercent(current.fee_rate)));
  if (previous && current.payment_rate < previous.payment_rate) insights.push(copy.paymentDropInsight(formatPercent(previous.payment_rate - current.payment_rate)));
  if (Number(current.milk_run_fee ?? 0) > Number(current.actual_sales_amount ?? 0) * 0.04) insights.push(copy.milkRunInsight(formatCurrency(current.milk_run_fee)));
  if (Number(current.inventory_loss_compensation ?? 0) > 0) insights.push(copy.compensationInsight(formatCurrency(current.inventory_loss_compensation)));
  if (!insights.length) insights.push(copy.goodInsight);
  return insights.slice(0, 5);
}

function filterAndSort(records: CoupangSettlement[], search: string, monthFilter: string, sortKey: SortKey) {
  const query = search.trim().toLowerCase();
  return [...records]
    .filter((record) => monthFilter === "all" || monthInputValue(record.settlement_month) === monthFilter)
    .filter((record) => !query || `${record.sales_month ?? ""} ${record.settlement_month} ${record.remark ?? ""}`.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortKey === "sales") return Number(b.sales_amount) - Number(a.sales_amount);
      if (sortKey === "payment") return Number(b.final_payment_amount) - Number(a.final_payment_amount);
      if (sortKey === "adRate") return Number(b.ad_rate) - Number(a.ad_rate);
      if (sortKey === "paymentRate") return Number(b.payment_rate) - Number(a.payment_rate);
      return b.settlement_month.localeCompare(a.settlement_month);
    });
}

function exportSettlementCsv(records: CoupangSettlement[], extension: "csv" | "xls" = "csv") {
  const headers = ["sales_month", "settlement_month", "sales_amount", "cancel_amount", "actual_sales_amount", "sales_fee", "seller_coupon", "ad_fee", "milk_run_fee", "inventory_loss_compensation", "final_payment_amount", "cancel_rate", "ad_rate", "payment_rate", "remark"];
  const rows = records.map((record) => headers.map((key) => String((record as unknown as Record<string, unknown>)[key] ?? "")).join(","));
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `coupang-settlements.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

function uniqueMonths(records: CoupangSettlement[]) {
  return Array.from(new Set(records.map((record) => monthInputValue(record.settlement_month)))).sort((a, b) => b.localeCompare(a));
}

function last12Months() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: `${date.getMonth() + 1}` };
  });
}

function amount(value: string | number | null | undefined) {
  return Math.max(0, Number(value ?? 0) || 0);
}

function coupangCouponAmount(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0) || 0;
  return numeric === 0 ? 0 : -Math.abs(numeric);
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatPercent(value: number) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthToDate(value: string) {
  return `${value || currentMonthKey()}-01`;
}

function monthInputValue(value: string) {
  return value?.slice(0, 7) || currentMonthKey();
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function settlementCopy(language: Language) {
  if (language === "ko") {
    return {
      title: "Coupang 정산 센터",
      subtitle: "월별 Coupang 정산 내역, 차감 구조, 최종 지급액과 지급률을 독립적으로 분석합니다.",
      independentNotice: "독립 정산 모듈",
      thisMonth: "이번 달",
      autoCalculated: "자동 계산",
      afterFeeCoupon: "수수료/쿠폰 차감 후",
      platformPaysYou: "Coupang 지급 예정",
      deduction: "차감",
      logistics: "물류",
      addBack: "보상 반영",
      month: "정산 월",
      salesMonth: "판매 귀속 월",
      settlementMonth: "정산 월",
      salesAmount: "판매액",
      cancelAmount: "취소액",
      actualSales: "소계 / 실제 판매액",
      salesBase: "판매기준 매출액",
      salesFee: "판매수수료 (B)",
      sellerCoupon: "판매자할인쿠폰 / 상계금액(C)",
      milkRunFee: "밀크런 이용액 (C)",
      adFee: "광고비",
      settlementDeduction: "기타 정산 차감 (E)",
      fulfillmentFee: "Coupang Fulfillment 비용 (J)",
      compensation: "재고 손실 보상 (K)",
      finalPayment: "최종지급액 (H-I-J+K)",
      finalPaymentInput: "최종지급액 (H-I-J+K)",
      cancelRate: "취소율",
      feeRate: "수수료율",
      adRate: "광고비율",
      paymentRate: "지급률",
      additionalDeduction: "소계 (C+D+E)",
      autoFinalPayment: "자동 계산 최종지급액",
      formulaHint: "계산식: 판매액 - 취소액 = 소계, 소계 - 판매수수료(B) - 상계금액(C) = 판매기준 매출액. 판매자할인쿠폰은 10,000을 입력하면 Coupang 정산서 기준 -10,000으로 계산됩니다.",
      attachment: "첨부",
      remark: "메모",
      entryTitle: "정산 입력 센터",
      editTitle: "정산 기록 수정",
      trendTitle: "정산 추세 분석",
      waterfallTitle: "정산 워터폴",
      insights: "Business Insights",
      detailTitle: "정산 상세 내역",
      searchPlaceholder: "판매 월 / 정산 월 / 메모 검색",
      allMonths: "전체 월",
      sortMonth: "월순",
      sortSales: "판매액순",
      sortPayment: "지급액순",
      sortAdRate: "광고비율순",
      sortPaymentRate: "지급률순",
      actions: "작업",
      edit: "수정",
      delete: "삭제",
      cancel: "취소",
      save: "저장",
      update: "업데이트",
      saving: "저장 중",
      empty: "정산 데이터가 없습니다.",
      uploadHint: "정산 캡처 / Excel / PDF 업로드",
      attachmentSaved: "기존 첨부 있음",
      deleteConfirm: "이 정산 기록을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.",
      pageInfo: (page: number, total: number, count: number) => `${page}/${total} · ${count}건`,
      cancelInsight: (rateText: string) => `이번 달 취소율 ${rateText}로 높습니다. 상품 상세와 재고 상태를 확인하세요.`,
      cancelNormal: (rateText: string) => `이번 달 취소율 ${rateText}로 관리 가능한 수준입니다.`,
      adInsight: (rateText: string) => `광고비가 실제 판매액의 ${rateText}입니다. 광고 효율 점검이 필요합니다.`,
      feeInsight: (rateText: string) => `판매 수수료율 ${rateText}입니다. 수수료 구조를 확인하세요.`,
      paymentDropInsight: (drop: string) => `지급률이 이전 월보다 ${drop} 하락했습니다. 차감 항목을 점검하세요.`,
      milkRunInsight: (amount: string) => `Milk Run 비용 ${amount}이 높습니다. 물류비 이상 여부를 확인하세요.`,
      compensationInsight: (amount: string) => `재고 손실 보상 ${amount}이 반영되었습니다. 보상 사유를 기록해 두세요.`,
      goodInsight: "이번 달 정산 구조가 안정적입니다. 주요 차감 항목은 정상 범위입니다."
    };
  }

  return {
    title: "Coupang 结算中心",
    subtitle: "独立记录每月 Coupang 清算明细、扣费结构、最终到账金额与到账率。",
    independentNotice: "独立结算模块",
    thisMonth: "本月",
    autoCalculated: "自动计算",
    afterFeeCoupon: "扣手续费/优惠券后",
    platformPaysYou: "平台应付给我",
    deduction: "扣减项",
    logistics: "物流项",
    addBack: "补偿加回",
    month: "结算月份",
    salesMonth: "销售归属月份",
    settlementMonth: "清算月份",
    salesAmount: "판매액 / 销售额",
    cancelAmount: "취소액 / 取消金额",
    actualSales: "소계 / 实际销售额",
    salesBase: "판매기준 매출액 / 销售基准金额",
    salesFee: "판매수수료 (B) / 平台手续费",
    sellerCoupon: "판매자할인쿠폰 / 卖家优惠券 / 상계금액(C)",
    milkRunFee: "밀크런 이용액 (C) / Milk Run费用",
    adFee: "광고비 (D) / 广告费",
    settlementDeduction: "정산 차감 (E) / 其它结算扣减",
    fulfillmentFee: "쿠팡 풀필먼트 서비스 비용 (J) / Coupang Fulfillment服务费",
    compensation: "재고 손실 보상 (K) / 库存损失补偿",
    finalPayment: "최종지급액 (H-I-J+K) / 最终到账金额",
    finalPaymentInput: "최종지급액 (H-I-J+K) / 最终到账金额",
    cancelRate: "取消率",
    feeRate: "手续费率",
    adRate: "广告费率",
    paymentRate: "到账率",
    additionalDeduction: "소계 (C+D+E) / 追加扣减小计",
    autoFinalPayment: "自动计算最终到账",
    formulaHint: "公式：판매액 - 취소액 = 소계；소계 - 판매수수료(B) - 상계금액(C) = 판매기준 매출액。卖家优惠券填 10000 时，系统会按 Coupang 结算单的 -10,000 计算。",
    attachment: "附件",
    remark: "备注",
    entryTitle: "结算录入中心",
    editTitle: "编辑结算记录",
    trendTitle: "结算趋势分析",
    waterfallTitle: "Settlement Waterfall / 结算漏斗图",
    insights: "经营洞察",
    detailTitle: "结算明细中心",
    searchPlaceholder: "搜索销售月份 / 清算月份 / 备注",
    allMonths: "全部月份",
    sortMonth: "按月份排序",
    sortSales: "按销售额排序",
    sortPayment: "按到账金额排序",
    sortAdRate: "按广告费率排序",
    sortPaymentRate: "按到账率排序",
    actions: "操作",
    edit: "编辑",
    delete: "删除",
    cancel: "取消",
    save: "保存",
    update: "更新",
    saving: "保存中",
    empty: "暂无结算数据",
    uploadHint: "上传结算截图 / Excel / PDF",
    attachmentSaved: "已有附件",
    deleteConfirm: "确认删除这条结算记录吗？删除后无法恢复。",
    pageInfo: (page: number, total: number, count: number) => `第 ${page}/${total} 页 · 共 ${count} 条`,
    cancelInsight: (rateText: string) => `本月取消率 ${rateText}，偏高，建议检查商品详情页和库存状态。`,
    cancelNormal: (rateText: string) => `本月取消率 ${rateText}，处于可控范围。`,
    adInsight: (rateText: string) => `本月广告费占实际销售额 ${rateText}，建议检查广告投放效率。`,
    feeInsight: (rateText: string) => `本月手续费率 ${rateText}，建议核对平台扣费结构。`,
    paymentDropInsight: (drop: string) => `到账率较上月下降 ${drop}，请重点检查扣减项和广告费。`,
    milkRunInsight: (amount: string) => `Milk Run费用 ${amount} 偏高，请确认物流费用是否异常。`,
    compensationInsight: (amount: string) => `本月库存损失补偿 ${amount}，建议保留赔付依据。`,
    goodInsight: "本月结算结构稳定，主要扣费项处于正常范围。"
  };
}
