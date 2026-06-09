"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileArchive,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { activeProducts } from "@/lib/products";
import { unitProfit } from "@/lib/profit";
import { supabase } from "@/lib/supabase";
import type { ExpenseRecord, ProductWithStock, PurchaseOrder, StockMovement } from "@/lib/types";

type ComplianceTask = {
  id: string;
  title: string;
  category: string;
  due_date: string;
  status: "pending" | "done" | "overdue" | "risk" | string;
  risk_level: "normal" | "watch" | "high" | string;
  owner: string | null;
  memo: string | null;
};

type TaxRecord = {
  id: string;
  record_type: string;
  period_start: string | null;
  period_end: string | null;
  sales_amount: number;
  purchase_amount: number;
  input_tax: number;
  output_tax: number;
  estimated_tax: number;
  paid_amount: number;
  status: string;
  memo: string | null;
};

type PayrollRecord = {
  id: string;
  employee_name: string;
  payroll_month: string;
  salary: number;
  bonus: number;
  national_pension: number;
  health_insurance: number;
  employment_insurance: number;
  industrial_accident_insurance: number;
  payment_status: string;
};

type TaxDocument = {
  id: string;
  document_name: string;
  category: string;
  file_url: string | null;
  file_type: string | null;
  document_date: string | null;
};

type PurchaseWithProduct = PurchaseOrder & {
  created_at: string;
  products?: Pick<ProductWithStock, "purchase_price"> | null;
};

type SaleMovement = StockMovement & {
  products?: Pick<ProductWithStock, "sale_price" | "purchase_price" | "platform_fee_rate" | "international_shipping_cost" | "coupang_inbound_shipping_cost" | "ad_cost"> | null;
};

const vatRate = 0.1;
const corporateTaxBaseRate = 0.09;
const incomeReserveRate = 0.033;

const statutoryEvents = [
  { month: 1, day: 25, title: "增值税申报与缴纳", type: "VAT", tone: "watch" },
  { month: 3, day: 31, title: "法人税申报", type: "Corporate Tax", tone: "risk" },
  { month: 7, day: 25, title: "增值税申报与缴纳", type: "VAT", tone: "watch" },
  { month: 1, day: 10, title: "工资所得税申报", type: "Payroll", tone: "brand" },
  { month: 7, day: 10, title: "工资所得税申报", type: "Payroll", tone: "brand" }
];

export default function TaxCompliancePage() {
  return (
    <AppShell>
      <TaxComplianceContent />
    </AppShell>
  );
}

function TaxComplianceContent() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [sales, setSales] = useState<SaleMovement[]>([]);
  const [purchases, setPurchases] = useState<PurchaseWithProduct[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [calendarMode, setCalendarMode] = useState<"month" | "year">("month");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [productRes, salesRes, purchaseRes, expenseRes, taskRes, taxRes, payrollRes, docRes] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)"),
      supabase.from("stock_movements").select("*, products(sale_price,purchase_price,platform_fee_rate,international_shipping_cost,coupang_inbound_shipping_cost,ad_cost)").eq("type", "sale"),
      supabase.from("purchase_orders").select("*, products(purchase_price)"),
      supabase.from("expense_records").select("*"),
      supabase.from("compliance_tasks").select("*").order("due_date", { ascending: true }),
      supabase.from("tax_records").select("*").order("period_start", { ascending: false }),
      supabase.from("payroll_records").select("*").order("payroll_month", { ascending: false }),
      supabase.from("tax_documents").select("*").order("document_date", { ascending: false })
    ]);

    const missing = [taskRes, taxRes, payrollRes, docRes].find((res) => res.error?.message.includes("schema cache") || res.error?.message.includes("Could not find the table"));
    if (missing?.error) setMessage("数据库表尚未创建：请先在 Supabase SQL Editor 执行 supabase/migrations/create-tax-compliance-center.sql。");
    else setMessage("");

    setProducts(activeProducts((productRes.data ?? []) as ProductWithStock[]));
    setSales((salesRes.data ?? []) as SaleMovement[]);
    setPurchases((purchaseRes.data ?? []) as PurchaseWithProduct[]);
    setExpenses((expenseRes.data ?? []) as ExpenseRecord[]);
    setTasks((taskRes.data ?? []) as ComplianceTask[]);
    setTaxRecords((taxRes.data ?? []) as TaxRecord[]);
    setPayroll((payrollRes.data ?? []) as PayrollRecord[]);
    setDocuments((docRes.data ?? []) as TaxDocument[]);
    setLoading(false);
  }

  const now = new Date();
  const quarter = getQuarterRange(now);
  const month = getMonthRange(now);
  const year = getYearRange(now);
  const quarterSales = sales.filter((row) => inRange(row.happened_at, quarter.start, quarter.end));
  const monthSales = sales.filter((row) => inRange(row.happened_at, month.start, month.end));
  const yearSales = sales.filter((row) => inRange(row.happened_at, year.start, year.end));
  const quarterPurchases = purchases.filter((row) => row.created_at && inRange(row.created_at, quarter.start, quarter.end));
  const yearExpenses = expenses.filter((row) => inRange(row.expense_date, year.start, year.end));

  const metrics = useMemo(() => {
    const qSales = salesAmount(quarterSales);
    const qPurchase = purchaseAmount(quarterPurchases);
    const qVat = Math.max(0, qSales * vatRate - qPurchase * vatRate);
    const yProfit = yearSales.reduce((sum, row) => sum + saleProfit(row), 0) - yearExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const corporateTax = Math.max(0, yProfit * corporateTaxBaseRate);
    const incomeTax = Math.max(0, payroll.reduce((sum, row) => sum + Number(row.salary || 0) + Number(row.bonus || 0), 0) * incomeReserveRate);
    const monthDue = qVat + payrollInsurance(payroll.filter((row) => inRange(row.payroll_month, month.start, month.end)));
    return {
      quarterSales: qSales,
      quarterPurchase: qPurchase,
      estimatedVat: qVat,
      estimatedCorporateTax: corporateTax,
      estimatedIncomeTax: incomeTax,
      monthDue,
      monthTasks: tasks.filter((task) => inRange(task.due_date, month.start, month.end) && task.status !== "done").length,
      yearlySales: salesAmount(yearSales),
      yearlyProfit: yProfit
    };
  }, [quarterSales, quarterPurchases, yearSales, yearExpenses, payroll, tasks, month.start, month.end]);

  const calendar = useMemo(() => buildCalendarEvents(now.getFullYear(), tasks), [tasks, now]);
  const risks = useMemo(() => buildRisks(tasks, metrics), [tasks, metrics]);
  const vatTrend = useMemo(() => buildVatTrend(taxRecords, sales), [taxRecords, sales]);
  const insights = useMemo(() => buildInsights(metrics, risks), [metrics, risks]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#dde1d8] bg-[#fbfaf6]/95 p-7 shadow-[0_24px_72px_rgba(18,31,27,0.08)] backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#17483f]/30 to-transparent" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="premium-section-eyebrow">Tax & Compliance Center</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">税务与经营合规中心</h1>
            <p className="mt-3 text-base text-muted">提醒、记录、预警与分析，帮助老板避免漏报税。</p>
          </div>
          <div className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-xs font-semibold text-muted">不自动申报 · 不自动缴税 · 仅做经营预警</div>
        </div>
        {loading ? <SkeletonKpis /> : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <TaxKpi icon={CircleDollarSign} label="本季度销售额" value={won(metrics.quarterSales)} />
            <TaxKpi icon={ReceiptText} label="本季度采购额" value={won(metrics.quarterPurchase)} />
            <TaxKpi icon={Landmark} label="预计增值税" value={won(metrics.estimatedVat)} tone={metrics.estimatedVat > 0 ? "watch" : "good"} />
            <TaxKpi icon={BriefcaseBusiness} label="预计法人税" value={won(metrics.estimatedCorporateTax)} />
            <TaxKpi icon={Users} label="预计个人所得税" value={won(metrics.estimatedIncomeTax)} />
            <TaxKpi icon={Banknote} label="本月应缴税金" value={won(metrics.monthDue)} tone="risk" />
            <TaxKpi icon={Clock3} label="本月待办税务事项" value={metrics.monthTasks} />
          </div>
        )}
      </section>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel eyebrow="Korean Tax Calendar" title="韩国税务日历" action={<Segmented value={calendarMode} onChange={setCalendarMode} />}>
          {calendarMode === "month" ? <MonthCalendar events={calendar.filter((event) => new Date(event.date).getMonth() === now.getMonth())} /> : <YearCalendar events={calendar} />}
        </Panel>
        <Panel eyebrow="Risk Center" title="经营风险中心">
          <div className="grid gap-3">
            {risks.length ? risks.map((risk) => <RiskCard key={risk.title} {...risk} />) : <EmptyBox title="暂无高风险事项" text="已录入事项均未触发逾期或高风险规则。" />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="VAT Center" title="增值税中心">
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="销项税额" value={won(metrics.quarterSales * vatRate)} />
            <Metric label="进项税额" value={won(metrics.quarterPurchase * vatRate)} />
            <Metric label="预计应缴 VAT" value={won(metrics.estimatedVat)} tone={metrics.estimatedVat > 0 ? "watch" : "good"} />
          </div>
          <div className="mt-5 h-64">
            {vatTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={vatTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(197,201,189,0.6)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => compactWon(Number(value))} />
                  <Tooltip formatter={(value) => won(Number(value))} />
                  <Area type="monotone" dataKey="vat" stroke="#17483f" fill="#e6efeb" strokeWidth={2.4} animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyBox title="暂无 VAT 趋势" text="录入 VAT 历史记录后自动生成趋势。" />}
          </div>
        </Panel>

        <Panel eyebrow="Corporate Tax" title="法人税中心">
          <div className="grid gap-3 md:grid-cols-2">
            <Metric label="年度销售额" value={won(metrics.yearlySales)} />
            <Metric label="年度利润" value={won(metrics.yearlyProfit)} tone={metrics.yearlyProfit >= 0 ? "good" : "risk"} />
            <Metric label="预计法人税" value={won(metrics.estimatedCorporateTax)} tone="watch" />
            <Metric label="税率参考" value="约 9% 起" />
          </div>
          <p className="mt-4 rounded-2xl border border-line bg-white/65 p-4 text-sm leading-6 text-muted">法人税为经营预估值，不等于正式申报结果。实际税额需要由税务师结合扣除项、税收优惠、亏损结转等确认。</p>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Payroll & Insurance" title="工资与四大保险中心">
          <div className="grid gap-3">
            {payroll.length ? payroll.slice(0, 5).map((row) => (
              <div key={row.id} className="rounded-2xl border border-line bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink">{row.employee_name}</div>
                  <StatusPill status={row.payment_status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted">
                  <span>工资 {won(row.salary)}</span><span>奖金 {won(row.bonus)}</span>
                  <span>国民年金 {won(row.national_pension)}</span><span>健康保险 {won(row.health_insurance)}</span>
                  <span>雇佣保险 {won(row.employment_insurance)}</span><span>工伤保险 {won(row.industrial_accident_insurance)}</span>
                </div>
              </div>
            )) : <EmptyBox title="暂无工资记录" text="录入 payroll_records 后，这里会显示员工工资和四大保险缴纳状态。" />}
          </div>
        </Panel>

        <Panel eyebrow="Tax To-dos" title="税务待办中心">
          <div className="grid gap-3">
            {tasks.length ? tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 p-4">
                <span className={`h-3 w-3 rounded-full ${task.risk_level === "high" ? "bg-red-500" : task.risk_level === "watch" ? "bg-yellow-500" : "bg-emerald-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{task.title}</div>
                  <div className="mt-1 text-xs text-muted">{task.category} · 截止 {task.due_date}</div>
                </div>
                <StatusPill status={task.status} />
              </div>
            )) : <EmptyBox title="暂无税务待办" text="可在 compliance_tasks 中记录 VAT、工资、四大保险、地方税等事项。" />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Documents" title="财务资料管理">
          <div className="grid gap-3 md:grid-cols-2">
            {documents.length ? documents.slice(0, 6).map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-line bg-white/70 p-4">
                <FileArchive className="h-5 w-5 text-brand" />
                <div className="mt-3 font-semibold text-ink">{doc.document_name}</div>
                <div className="mt-1 text-xs text-muted">{doc.category} · {doc.document_date ?? "未设置日期"}</div>
              </div>
            )) : <EmptyBox title="暂无财务资料" text="预留上传税务师资料、发票、银行流水、税务文件、PDF、Excel、图片。" />}
          </div>
        </Panel>

        <Panel eyebrow="Business Insights" title="经营洞察">
          <div className="grid gap-3">
            {insights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-line bg-white/70 p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-brand" />
                  <div className="font-semibold text-ink">{item.title}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Future Extensions" title="未来扩展能力">
        <div className="grid gap-3 md:grid-cols-4">
          {["税务师对接", "电子发票", "银行流水导入", "国税厅数据同步"].map((item) => (
            <div key={item} className="rounded-2xl border border-line bg-white/70 p-4">
              <BadgeCheck className="h-5 w-5 text-brand" />
              <div className="mt-3 font-semibold text-ink">{item}</div>
              <p className="mt-1 text-xs text-muted">当前版本仅预留接口，不自动申报、不自动缴税。</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TaxKpi({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof CircleDollarSign; label: string; value: string | number; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const color = tone === "risk" ? "text-red-700 bg-red-50" : tone === "watch" ? "text-yellow-800 bg-yellow-50" : tone === "good" ? "text-emerald-700 bg-emerald-50" : "text-brand bg-[#e6efeb]";
  return (
    <div className="rounded-[22px] border border-line bg-white/76 p-4 shadow-[0_14px_38px_rgba(18,31,27,0.06)] transition hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(18,31,27,0.1)]">
      <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${color}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-4 text-xs font-semibold text-muted">{label}</div>
      <div className="premium-number mt-1 truncate text-2xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function Panel({ eyebrow, title, action, children }: { eyebrow: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-line bg-card/90 p-5 shadow-card backdrop-blur">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="premium-section-eyebrow">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MonthCalendar({ events }: { events: ReturnType<typeof buildCalendarEvents> }) {
  return <div className="grid gap-3">{events.length ? events.map((event) => <CalendarRow key={`${event.date}-${event.title}`} event={event} />) : <EmptyBox title="本月暂无税务事项" text="税务日历会显示法定节点和你手动记录的事项。" />}</div>;
}

function YearCalendar({ events }: { events: ReturnType<typeof buildCalendarEvents> }) {
  return <div className="grid gap-3 md:grid-cols-2">{events.map((event) => <CalendarRow key={`${event.date}-${event.title}`} event={event} />)}</div>;
}

function CalendarRow({ event }: { event: ReturnType<typeof buildCalendarEvents>[number] }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/70 p-4">
      <CalendarDays className="h-5 w-5 text-brand" />
      <div className="flex-1">
        <div className="font-semibold text-ink">{event.title}</div>
        <div className="mt-1 text-xs text-muted">{event.type} · {event.date}</div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.tone === "risk" ? "bg-red-50 text-red-700" : event.tone === "watch" ? "bg-yellow-50 text-yellow-800" : "bg-emerald-50 text-emerald-700"}`}>{daysUntil(event.date)}天</span>
    </div>
  );
}

function RiskCard({ title, text, level }: { title: string; text: string; level: "good" | "watch" | "risk" }) {
  return (
    <div className={`rounded-2xl border p-4 ${level === "risk" ? "border-red-200 bg-red-50 text-red-700" : level === "watch" ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{title}</div>
      <p className="mt-2 text-sm leading-6 opacity-80">{text}</p>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "watch" | "risk" }) {
  return <div className="rounded-2xl border border-line bg-white/70 p-4"><div className="text-xs font-semibold text-muted">{label}</div><div className={`mt-2 text-xl font-semibold tabular-nums ${tone === "risk" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-ink"}`}>{value}</div></div>;
}

function StatusPill({ status }: { status: string }) {
  const done = status === "done" || status === "paid" || status === "completed";
  const risk = status === "overdue" || status === "risk";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${done ? "bg-emerald-50 text-emerald-700" : risk ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-800"}`}>{done ? "已完成" : risk ? "风险" : "待处理"}</span>;
}

function Segmented({ value, onChange }: { value: "month" | "year"; onChange: (value: "month" | "year") => void }) {
  return <div className="rounded-2xl border border-line bg-white/70 p-1">{(["month", "year"] as const).map((item) => <button key={item} className={`rounded-xl px-3 py-2 text-xs font-bold ${value === item ? "bg-[#102b27] text-white" : "text-muted"}`} onClick={() => onChange(item)}>{item === "month" ? "月视图" : "年视图"}</button>)}</div>;
}

function EmptyBox({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/55 px-5 py-8 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-brand" /><div className="mt-3 font-semibold text-ink">{title}</div><p className="mt-2 text-sm text-muted">{text}</p></div>;
}

function SkeletonKpis() {
  return <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-7">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-[22px] bg-white/60" />)}</div>;
}

function salesAmount(rows: SaleMovement[]) {
  return rows.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.products?.sale_price || 0), 0);
}

function purchaseAmount(rows: PurchaseWithProduct[]) {
  return rows.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.products?.purchase_price || 0), 0);
}

function saleProfit(row: SaleMovement) {
  if (!row.products) return 0;
  return unitProfit(row.products) * Math.abs(Number(row.quantity || 0));
}

function payrollInsurance(rows: PayrollRecord[]) {
  return rows.reduce((sum, row) => sum + Number(row.national_pension || 0) + Number(row.health_insurance || 0) + Number(row.employment_insurance || 0) + Number(row.industrial_accident_insurance || 0), 0);
}

function buildCalendarEvents(year: number, tasks: ComplianceTask[]) {
  const statutory = statutoryEvents.map((event) => ({ title: event.title, type: event.type, date: `${year}-${String(event.month).padStart(2, "0")}-${String(event.day).padStart(2, "0")}`, tone: event.tone }));
  const manual = tasks.map((task) => ({ title: task.title, type: task.category, date: task.due_date, tone: task.risk_level === "high" ? "risk" : task.risk_level === "watch" ? "watch" : "brand" }));
  return [...statutory, ...manual].sort((a, b) => a.date.localeCompare(b.date));
}

function buildRisks(tasks: ComplianceTask[], metrics: { estimatedVat: number; estimatedCorporateTax: number; monthDue: number }) {
  const overdue = tasks.filter((task) => task.status !== "done" && daysUntil(task.due_date) < 0).length;
  const dueSoon = tasks.filter((task) => task.status !== "done" && daysUntil(task.due_date) >= 0 && daysUntil(task.due_date) <= 7).length;
  const high = tasks.filter((task) => task.risk_level === "high").length;
  const result = [];
  if (overdue) result.push({ title: "存在逾期税务事项", text: `${overdue} 项税务/合规事项已超过截止日期。`, level: "risk" as const });
  if (high) result.push({ title: "存在高风险事项", text: `${high} 项被标记为高风险，请优先处理。`, level: "risk" as const });
  if (dueSoon) result.push({ title: "7天内有待办", text: `${dueSoon} 项事项即将到期。`, level: "watch" as const });
  if (metrics.monthDue > 0) result.push({ title: "本月现金流压力", text: `预计本月税费/保险预留 ${won(metrics.monthDue)}。`, level: "watch" as const });
  if (!result.length) result.push({ title: "合规状态稳定", text: "当前没有逾期或高风险事项。", level: "good" as const });
  return result;
}

function buildVatTrend(records: TaxRecord[], sales: SaleMovement[]) {
  const fromRecords = records.filter((record) => record.record_type.toLowerCase().includes("vat")).map((record) => ({
    label: record.period_end?.slice(0, 7) ?? record.period_start?.slice(0, 7) ?? "未设置",
    vat: Number(record.estimated_tax || 0)
  }));
  if (fromRecords.length) return fromRecords.reverse();
  const map = new Map<string, SaleMovement[]>();
  sales.forEach((row) => {
    const key = row.happened_at.slice(0, 7);
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, rows]) => ({ label, vat: salesAmount(rows) * vatRate }));
}

function buildInsights(metrics: { estimatedVat: number; estimatedCorporateTax: number; monthDue: number; yearlyProfit: number }, risks: ReturnType<typeof buildRisks>) {
  return [
    { title: "预计增值税", text: `预计本季度增值税约 ${won(metrics.estimatedVat)}，建议提前预留现金。` },
    { title: "预计法人税", text: `按当前年度利润粗估法人税约 ${won(metrics.estimatedCorporateTax)}，正式税额需税务师确认。` },
    { title: "现金流压力", text: `本月税费/保险预估合计 ${won(metrics.monthDue)}。` },
    { title: "税务风险提醒", text: risks.some((risk) => risk.level === "risk") ? "存在高风险或逾期事项，请优先处理。" : "当前未发现高风险税务事项。" }
  ];
}

function getQuarterRange(date: Date) {
  const quarterStart = Math.floor(date.getMonth() / 3) * 3;
  return { start: toDate(new Date(date.getFullYear(), quarterStart, 1)), end: toDate(new Date(date.getFullYear(), quarterStart + 3, 0)) };
}

function getMonthRange(date: Date) {
  return { start: toDate(new Date(date.getFullYear(), date.getMonth(), 1)), end: toDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)) };
}

function getYearRange(date: Date) {
  return { start: toDate(new Date(date.getFullYear(), 0, 1)), end: toDate(new Date(date.getFullYear(), 11, 31)) };
}

function inRange(date: string, start: string, end: string) {
  return date.slice(0, 10) >= start && date.slice(0, 10) <= end;
}

function daysUntil(date: string) {
  const today = new Date();
  const target = new Date(date);
  return Math.ceil((target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function won(value: number) {
  return `₩${Math.round(Number(value || 0)).toLocaleString("ko-KR")}`;
}

function compactWon(value: number) {
  if (Math.abs(value) >= 100000000) return `₩${(value / 100000000).toFixed(1)}억`;
  if (Math.abs(value) >= 10000) return `₩${(value / 10000).toFixed(0)}만`;
  return `₩${value}`;
}
