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
import { useLanguage } from "@/components/LanguageProvider";
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

const copy = {
  zh: {
    title: "税务与经营合规中心",
    subtitle: "提醒、记录、预警与分析，帮助老板避免漏报税。",
    notice: "不自动申报 · 不自动缴税 · 仅做经营预警",
    qSales: "本季度销售额",
    qPurchase: "本季度采购额",
    vat: "预计增值税",
    corporateTax: "预计法人税",
    incomeTax: "预计个人所得税",
    monthDue: "本月应缴税金",
    monthTasks: "本月待办税务事项",
    taxCalendar: "韩国税务日历",
    riskCenter: "经营风险中心",
    vatCenter: "增值税中心",
    outputVat: "销项税额",
    inputVat: "进项税额",
    estimatedVatPayable: "预计应缴 VAT",
    corporateCenter: "法人税中心",
    annualSales: "年度销售额",
    annualProfit: "年度利润",
    taxRateRef: "税率参考",
    taxRateValue: "约 9% 起",
    corporateNote: "法人税为经营预估值，不等于正式申报结果。实际税额需要由税务师结合扣除项、税收优惠、亏损结转等确认。",
    payrollCenter: "工资与四大保险中心",
    salary: "工资",
    bonus: "奖金",
    nationalPension: "国民年金",
    healthInsurance: "健康保险",
    employmentInsurance: "雇佣保险",
    industrialInsurance: "工伤保险",
    taxTodos: "税务待办中心",
    documents: "财务资料管理",
    insights: "经营洞察",
    future: "未来扩展能力",
    noRisk: "暂无高风险事项",
    noRiskText: "已录入事项均未触发逾期或高风险规则。",
    noVatTrend: "暂无 VAT 趋势",
    noVatTrendText: "录入 VAT 历史记录后自动生成趋势。",
    noPayroll: "暂无工资记录",
    noPayrollText: "录入 payroll_records 后，这里会显示员工工资和四大保险缴纳状态。",
    noTodo: "暂无税务待办",
    noTodoText: "可在 compliance_tasks 中记录 VAT、工资、四大保险、地方税等事项。",
    noDocuments: "暂无财务资料",
    noDocumentsText: "预留上传税务师资料、发票、银行流水、税务文件、PDF、Excel、图片。",
    noMonthEvents: "本月暂无税务事项",
    noMonthEventsText: "税务日历会显示法定节点和你手动记录的事项。",
    monthView: "月视图",
    yearView: "年视图",
    done: "已完成",
    risk: "风险",
    pending: "待处理",
    duePrefix: "截止",
    days: "天",
    documentNoDate: "未设置日期",
    futureItems: ["税务师对接", "电子发票", "银行流水导入", "国税厅数据同步"],
    futureNote: "当前版本仅预留接口，不自动申报、不自动缴税。",
    statutoryVat: "增值税申报与缴纳",
    statutoryCorporate: "法人税申报",
    statutoryPayroll: "工资所得税申报",
    riskOverdue: "存在逾期税务事项",
    riskOverdueText: (count: number) => `${count} 项税务/合规事项已超过截止日期。`,
    riskHigh: "存在高风险事项",
    riskHighText: (count: number) => `${count} 项被标记为高风险，请优先处理。`,
    riskDueSoon: "7天内有待办",
    riskDueSoonText: (count: number) => `${count} 项事项即将到期。`,
    cashPressure: "本月现金流压力",
    cashPressureText: (amount: string) => `预计本月税费/保险预留 ${amount}。`,
    stable: "合规状态稳定",
    stableText: "当前没有逾期或高风险事项。",
    insightVatText: (amount: string) => `预计本季度增值税约 ${amount}，建议提前预留现金。`,
    insightCorporateText: (amount: string) => `按当前年度利润粗估法人税约 ${amount}，正式税额需税务师确认。`,
    insightCashText: (amount: string) => `本月税费/保险预估合计 ${amount}。`,
    insightRiskTitle: "税务风险提醒",
    insightRiskBad: "存在高风险或逾期事项，请优先处理。",
    insightRiskGood: "当前未发现高风险税务事项。",
    dbMissing: "数据库表尚未创建：请先在 Supabase SQL Editor 执行 supabase/migrations/create-tax-compliance-center.sql。"
  },
  ko: {
    title: "세무 및 경영 컴플라이언스 센터",
    subtitle: "신고 누락을 줄이기 위한 알림, 기록, 리스크 분석 센터입니다.",
    notice: "자동 신고 없음 · 자동 납부 없음 · 경영 리스크 알림만 제공",
    qSales: "이번 분기 매출",
    qPurchase: "이번 분기 매입액",
    vat: "예상 부가세",
    corporateTax: "예상 법인세",
    incomeTax: "예상 원천세",
    monthDue: "이번 달 예상 납부액",
    monthTasks: "이번 달 세무 할 일",
    taxCalendar: "한국 세무 캘린더",
    riskCenter: "경영 리스크 센터",
    vatCenter: "부가세 센터",
    outputVat: "매출세액",
    inputVat: "매입세액",
    estimatedVatPayable: "예상 납부 VAT",
    corporateCenter: "법인세 센터",
    annualSales: "연간 매출",
    annualProfit: "연간 이익",
    taxRateRef: "세율 참고",
    taxRateValue: "약 9%부터",
    corporateNote: "법인세는 경영 추정값이며 공식 신고 결과가 아닙니다. 실제 세액은 세무사가 공제, 감면, 결손금 등을 함께 확인해야 합니다.",
    payrollCenter: "급여 및 4대 보험 센터",
    salary: "급여",
    bonus: "상여",
    nationalPension: "국민연금",
    healthInsurance: "건강보험",
    employmentInsurance: "고용보험",
    industrialInsurance: "산재보험",
    taxTodos: "세무 할 일 센터",
    documents: "재무 자료 관리",
    insights: "경영 인사이트",
    future: "향후 확장 기능",
    noRisk: "고위험 항목 없음",
    noRiskText: "등록된 항목 중 연체 또는 고위험 규칙에 걸린 항목이 없습니다.",
    noVatTrend: "VAT 추세 데이터 없음",
    noVatTrendText: "VAT 기록을 입력하면 추세가 자동으로 생성됩니다.",
    noPayroll: "급여 기록 없음",
    noPayrollText: "payroll_records를 입력하면 직원 급여와 4대 보험 납부 상태가 표시됩니다.",
    noTodo: "세무 할 일 없음",
    noTodoText: "compliance_tasks에 VAT, 급여, 4대 보험, 지방세 등을 기록할 수 있습니다.",
    noDocuments: "재무 자료 없음",
    noDocumentsText: "세무사 자료, 세금계산서, 은행 거래내역, 세무 파일, PDF, Excel, 이미지를 분류 보관할 수 있습니다.",
    noMonthEvents: "이번 달 세무 일정 없음",
    noMonthEventsText: "세무 캘린더는 법정 일정과 직접 기록한 일정을 함께 표시합니다.",
    monthView: "월 보기",
    yearView: "연 보기",
    done: "완료",
    risk: "리스크",
    pending: "대기",
    duePrefix: "마감",
    days: "일",
    documentNoDate: "날짜 미설정",
    futureItems: ["세무사 연동", "전자세금계산서", "은행 거래내역 가져오기", "국세청 데이터 동기화"],
    futureNote: "현재 버전은 인터페이스만 예약되어 있으며 자동 신고나 자동 납부는 하지 않습니다.",
    statutoryVat: "부가세 신고 및 납부",
    statutoryCorporate: "법인세 신고",
    statutoryPayroll: "근로소득세 신고",
    riskOverdue: "연체된 세무 항목 있음",
    riskOverdueText: (count: number) => `${count}개 세무/컴플라이언스 항목이 마감일을 지났습니다.`,
    riskHigh: "고위험 항목 있음",
    riskHighText: (count: number) => `${count}개 항목이 고위험으로 표시되어 있습니다.`,
    riskDueSoon: "7일 내 마감 항목",
    riskDueSoonText: (count: number) => `${count}개 항목이 곧 마감됩니다.`,
    cashPressure: "이번 달 현금흐름 부담",
    cashPressureText: (amount: string) => `이번 달 세금/보험료 예비금은 약 ${amount}입니다.`,
    stable: "컴플라이언스 상태 안정",
    stableText: "현재 연체 또는 고위험 항목이 없습니다.",
    insightVatText: (amount: string) => `이번 분기 예상 부가세는 약 ${amount}입니다. 현금을 미리 확보하는 것이 좋습니다.`,
    insightCorporateText: (amount: string) => `현재 연간 이익 기준 예상 법인세는 약 ${amount}입니다. 공식 세액은 세무사 확인이 필요합니다.`,
    insightCashText: (amount: string) => `이번 달 세금/보험료 예상 합계는 ${amount}입니다.`,
    insightRiskTitle: "세무 리스크 알림",
    insightRiskBad: "고위험 또는 연체 항목이 있습니다. 우선 처리하세요.",
    insightRiskGood: "현재 고위험 세무 항목이 발견되지 않았습니다.",
    dbMissing: "데이터베이스 테이블이 아직 생성되지 않았습니다. Supabase SQL Editor에서 supabase/migrations/create-tax-compliance-center.sql을 먼저 실행하세요."
  }
} as const;

type PageCopy = (typeof copy)["zh"] | (typeof copy)["ko"];

export default function TaxCompliancePage() {
  return (
    <AppShell>
      <TaxComplianceContent />
    </AppShell>
  );
}

function TaxComplianceContent() {
  const { language } = useLanguage();
  const c = copy[language];
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
    if (missing?.error) setMessage(c.dbMissing);
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

  const calendar = useMemo(() => buildCalendarEvents(now.getFullYear(), tasks, c), [tasks, now, c]);
  const risks = useMemo(() => buildRisks(tasks, metrics, c), [tasks, metrics, c]);
  const vatTrend = useMemo(() => buildVatTrend(taxRecords, sales, c), [taxRecords, sales, c]);
  const insights = useMemo(() => buildInsights(metrics, risks, c), [metrics, risks, c]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#dde1d8] bg-[#fbfaf6]/95 p-7 shadow-[0_24px_72px_rgba(18,31,27,0.08)] backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2563eb]/20 to-transparent" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="premium-section-eyebrow">Tax & Compliance Center</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">{c.title}</h1>
            <p className="mt-3 text-base text-muted">{c.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3 text-xs font-semibold text-muted">{c.notice}</div>
        </div>
        {loading ? <SkeletonKpis /> : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <TaxKpi icon={CircleDollarSign} label={c.qSales} value={won(metrics.quarterSales)} />
            <TaxKpi icon={ReceiptText} label={c.qPurchase} value={won(metrics.quarterPurchase)} />
            <TaxKpi icon={Landmark} label={c.vat} value={won(metrics.estimatedVat)} tone={metrics.estimatedVat > 0 ? "watch" : "good"} />
            <TaxKpi icon={BriefcaseBusiness} label={c.corporateTax} value={won(metrics.estimatedCorporateTax)} />
            <TaxKpi icon={Users} label={c.incomeTax} value={won(metrics.estimatedIncomeTax)} />
            <TaxKpi icon={Banknote} label={c.monthDue} value={won(metrics.monthDue)} tone="risk" />
            <TaxKpi icon={Clock3} label={c.monthTasks} value={metrics.monthTasks} />
          </div>
        )}
      </section>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel eyebrow="Korean Tax Calendar" title={c.taxCalendar} action={<Segmented value={calendarMode} onChange={setCalendarMode} copy={c} />}>
          {calendarMode === "month" ? <MonthCalendar events={calendar.filter((event) => new Date(event.date).getMonth() === now.getMonth())} copy={c} /> : <YearCalendar events={calendar} copy={c} />}
        </Panel>
        <Panel eyebrow="Risk Center" title={c.riskCenter}>
          <div className="grid gap-3">
            {risks.length ? risks.map((risk) => <RiskCard key={risk.title} {...risk} />) : <EmptyBox title={c.noRisk} text={c.noRiskText} />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="VAT Center" title={c.vatCenter}>
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label={c.outputVat} value={won(metrics.quarterSales * vatRate)} />
            <Metric label={c.inputVat} value={won(metrics.quarterPurchase * vatRate)} />
            <Metric label={c.estimatedVatPayable} value={won(metrics.estimatedVat)} tone={metrics.estimatedVat > 0 ? "watch" : "good"} />
          </div>
          <div className="mt-5 h-64">
            {vatTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={vatTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(197,201,189,0.6)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => compactWon(Number(value))} />
                  <Tooltip formatter={(value) => won(Number(value))} />
                  <Area type="monotone" dataKey="vat" stroke="#2563eb" fill="#dbeafe" strokeWidth={2.4} animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyBox title={c.noVatTrend} text={c.noVatTrendText} />}
          </div>
        </Panel>

        <Panel eyebrow="Corporate Tax" title={c.corporateCenter}>
          <div className="grid gap-3 md:grid-cols-2">
            <Metric label={c.annualSales} value={won(metrics.yearlySales)} />
            <Metric label={c.annualProfit} value={won(metrics.yearlyProfit)} tone={metrics.yearlyProfit >= 0 ? "good" : "risk"} />
            <Metric label={c.corporateTax} value={won(metrics.estimatedCorporateTax)} tone="watch" />
            <Metric label={c.taxRateRef} value={c.taxRateValue} />
          </div>
          <p className="mt-4 rounded-2xl border border-line bg-white/65 p-4 text-sm leading-6 text-muted">{c.corporateNote}</p>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Payroll & Insurance" title={c.payrollCenter}>
          <div className="grid gap-3">
            {payroll.length ? payroll.slice(0, 5).map((row) => (
              <div key={row.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink">{row.employee_name}</div>
                  <StatusPill status={row.payment_status} copy={c} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted">
                  <span>{c.salary} {won(row.salary)}</span><span>{c.bonus} {won(row.bonus)}</span>
                  <span>{c.nationalPension} {won(row.national_pension)}</span><span>{c.healthInsurance} {won(row.health_insurance)}</span>
                  <span>{c.employmentInsurance} {won(row.employment_insurance)}</span><span>{c.industrialInsurance} {won(row.industrial_accident_insurance)}</span>
                </div>
              </div>
            )) : <EmptyBox title={c.noPayroll} text={c.noPayrollText} />}
          </div>
        </Panel>

        <Panel eyebrow="Tax To-dos" title={c.taxTodos}>
          <div className="grid gap-3">
            {tasks.length ? tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
                <span className={`h-3 w-3 rounded-full ${task.risk_level === "high" ? "bg-red-500" : task.risk_level === "watch" ? "bg-yellow-500" : "bg-emerald-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{task.title}</div>
                  <div className="mt-1 text-xs text-muted">{task.category} · {c.duePrefix} {task.due_date}</div>
                </div>
                <StatusPill status={task.status} copy={c} />
              </div>
            )) : <EmptyBox title={c.noTodo} text={c.noTodoText} />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Documents" title={c.documents}>
          <div className="grid gap-3 md:grid-cols-2">
            {documents.length ? documents.slice(0, 6).map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-line bg-white p-4">
                <FileArchive className="h-5 w-5 text-[#2563eb]" />
                <div className="mt-3 font-semibold text-ink">{doc.document_name}</div>
                <div className="mt-1 text-xs text-muted">{doc.category} · {doc.document_date ?? c.documentNoDate}</div>
              </div>
            )) : <EmptyBox title={c.noDocuments} text={c.noDocumentsText} />}
          </div>
        </Panel>

        <Panel eyebrow="Business Insights" title={c.insights}>
          <div className="grid gap-3">
            {insights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-[#2563eb]" />
                  <div className="font-semibold text-ink">{item.title}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Future Extensions" title={c.future}>
        <div className="grid gap-3 md:grid-cols-4">
          {c.futureItems.map((item) => (
            <div key={item} className="rounded-2xl border border-line bg-white p-4">
              <BadgeCheck className="h-5 w-5 text-[#2563eb]" />
              <div className="mt-3 font-semibold text-ink">{item}</div>
              <p className="mt-1 text-xs text-muted">{c.futureNote}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TaxKpi({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof CircleDollarSign; label: string; value: string | number; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const color = tone === "risk" ? "text-red-700 bg-red-50" : tone === "watch" ? "text-yellow-800 bg-yellow-50" : tone === "good" ? "text-emerald-700 bg-emerald-50" : "text-[#2563eb] bg-[#eff6ff]";
  return (
    <div className="rounded-[22px] border border-line bg-white p-4 shadow-[0_14px_38px_rgba(18,31,27,0.06)] transition hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(18,31,27,0.1)]">
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

function MonthCalendar({ events, copy: c }: { events: ReturnType<typeof buildCalendarEvents>; copy: PageCopy }) {
  return <div className="grid gap-3">{events.length ? events.map((event) => <CalendarRow key={`${event.date}-${event.title}`} event={event} copy={c} />) : <EmptyBox title={c.noMonthEvents} text={c.noMonthEventsText} />}</div>;
}

function YearCalendar({ events, copy: c }: { events: ReturnType<typeof buildCalendarEvents>; copy: PageCopy }) {
  return <div className="grid gap-3 md:grid-cols-2">{events.map((event) => <CalendarRow key={`${event.date}-${event.title}`} event={event} copy={c} />)}</div>;
}

function CalendarRow({ event, copy: c }: { event: ReturnType<typeof buildCalendarEvents>[number]; copy: PageCopy }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
      <CalendarDays className="h-5 w-5 text-[#2563eb]" />
      <div className="flex-1">
        <div className="font-semibold text-ink">{event.title}</div>
        <div className="mt-1 text-xs text-muted">{event.type} · {event.date}</div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.tone === "risk" ? "bg-red-50 text-red-700" : event.tone === "watch" ? "bg-yellow-50 text-yellow-800" : "bg-emerald-50 text-emerald-700"}`}>{daysUntil(event.date)}{c.days}</span>
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
  return <div className="rounded-2xl border border-line bg-white p-4"><div className="text-xs font-semibold text-muted">{label}</div><div className={`mt-2 text-xl font-semibold tabular-nums ${tone === "risk" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-ink"}`}>{value}</div></div>;
}

function StatusPill({ status, copy: c }: { status: string; copy: PageCopy }) {
  const done = status === "done" || status === "paid" || status === "completed";
  const risk = status === "overdue" || status === "risk";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${done ? "bg-emerald-50 text-emerald-700" : risk ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-800"}`}>{done ? c.done : risk ? c.risk : c.pending}</span>;
}

function Segmented({ value, onChange, copy: c }: { value: "month" | "year"; onChange: (value: "month" | "year") => void; copy: PageCopy }) {
  return <div className="rounded-2xl border border-line bg-white p-1">{(["month", "year"] as const).map((item) => <button key={item} className={`rounded-xl px-3 py-2 text-xs font-bold ${value === item ? "bg-[#111827] text-white" : "text-muted"}`} onClick={() => onChange(item)}>{item === "month" ? c.monthView : c.yearView}</button>)}</div>;
}

function EmptyBox({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/55 px-5 py-8 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-[#2563eb]" /><div className="mt-3 font-semibold text-ink">{title}</div><p className="mt-2 text-sm text-muted">{text}</p></div>;
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

function buildCalendarEvents(year: number, tasks: ComplianceTask[], c: PageCopy) {
  const statutoryEvents = [
    { month: 1, day: 25, title: c.statutoryVat, type: "VAT", tone: "watch" },
    { month: 3, day: 31, title: c.statutoryCorporate, type: "Corporate Tax", tone: "risk" },
    { month: 7, day: 25, title: c.statutoryVat, type: "VAT", tone: "watch" },
    { month: 1, day: 10, title: c.statutoryPayroll, type: "Payroll", tone: "brand" },
    { month: 7, day: 10, title: c.statutoryPayroll, type: "Payroll", tone: "brand" }
  ];
  const statutory = statutoryEvents.map((event) => ({ title: event.title, type: event.type, date: `${year}-${String(event.month).padStart(2, "0")}-${String(event.day).padStart(2, "0")}`, tone: event.tone }));
  const manual = tasks.map((task) => ({ title: task.title, type: task.category, date: task.due_date, tone: task.risk_level === "high" ? "risk" : task.risk_level === "watch" ? "watch" : "brand" }));
  return [...statutory, ...manual].sort((a, b) => a.date.localeCompare(b.date));
}

function buildRisks(tasks: ComplianceTask[], metrics: { estimatedVat: number; estimatedCorporateTax: number; monthDue: number }, c: PageCopy) {
  const overdue = tasks.filter((task) => task.status !== "done" && daysUntil(task.due_date) < 0).length;
  const dueSoon = tasks.filter((task) => task.status !== "done" && daysUntil(task.due_date) >= 0 && daysUntil(task.due_date) <= 7).length;
  const high = tasks.filter((task) => task.risk_level === "high").length;
  const result = [];
  if (overdue) result.push({ title: c.riskOverdue, text: c.riskOverdueText(overdue), level: "risk" as const });
  if (high) result.push({ title: c.riskHigh, text: c.riskHighText(high), level: "risk" as const });
  if (dueSoon) result.push({ title: c.riskDueSoon, text: c.riskDueSoonText(dueSoon), level: "watch" as const });
  if (metrics.monthDue > 0) result.push({ title: c.cashPressure, text: c.cashPressureText(won(metrics.monthDue)), level: "watch" as const });
  if (!result.length) result.push({ title: c.stable, text: c.stableText, level: "good" as const });
  return result;
}

function buildVatTrend(records: TaxRecord[], sales: SaleMovement[], c: PageCopy) {
  const fromRecords = records.filter((record) => record.record_type.toLowerCase().includes("vat")).map((record) => ({
    label: record.period_end?.slice(0, 7) ?? record.period_start?.slice(0, 7) ?? c.documentNoDate,
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

function buildInsights(metrics: { estimatedVat: number; estimatedCorporateTax: number; monthDue: number; yearlyProfit: number }, risks: ReturnType<typeof buildRisks>, c: PageCopy) {
  return [
    { title: c.vat, text: c.insightVatText(won(metrics.estimatedVat)) },
    { title: c.corporateTax, text: c.insightCorporateText(won(metrics.estimatedCorporateTax)) },
    { title: c.cashPressure, text: c.insightCashText(won(metrics.monthDue)) },
    { title: c.insightRiskTitle, text: risks.some((risk) => risk.level === "risk") ? c.insightRiskBad : c.insightRiskGood }
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
