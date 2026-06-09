"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, CircleCheckBig, PackageX, Palette, Ruler, Sparkles, Truck, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { CenterHero, CenterPanel, ExecutiveKpi, KpiGrid, MetricLine, ProgressBar, StatusPill } from "@/components/ManagementCenter";
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
  solution: string;
  owner: string;
  status: IssueStatus;
  remark: string | null;
  created_at: string;
};

const sampleIssues: CustomerIssue[] = [
  { id: "ci-1", issue_date: "2026-06-02", sku: "BLD-991-163-WH", product_name: "白色蜂巢帘 99.1x163", issue_category: "安装问题", issue_description: "客户反馈卡扣安装方向不清楚", solution: "发送安装步骤图 + 视频链接", owner: "客服", status: "处理中", remark: "高频问题", created_at: "2026-06-02" },
  { id: "ci-2", issue_date: "2026-06-03", sku: "BLD-762-163-WH", product_name: "白色蜂巢帘 76.2x163", issue_category: "尺寸问题", issue_description: "客户购买尺寸与窗框不匹配", solution: "引导换购并更新详情页测量说明", owner: "运营", status: "待处理", remark: null, created_at: "2026-06-03" },
  { id: "ci-3", issue_date: "2026-06-05", sku: "BLD-991-163-WH", product_name: "白色蜂巢帘 99.1x163", issue_category: "安装问题", issue_description: "安装后不够平整", solution: "提供二次校准说明", owner: "客服", status: "已解决", remark: null, created_at: "2026-06-05" },
  { id: "ci-4", issue_date: "2026-05-18", sku: "BLD-876-163-BL", product_name: "黑色蜂巢帘 87.6x163", issue_category: "物流问题", issue_description: "外箱运输挤压", solution: "补发并登记物流索赔", owner: "仓储", status: "已关闭", remark: null, created_at: "2026-05-18" },
  { id: "ci-5", issue_date: "2026-06-06", sku: "BLD-584-163-GR", product_name: "灰色蜂巢帘 58.4x163", issue_category: "颜色问题", issue_description: "页面颜色与实物感知有差异", solution: "发送自然光实拍图并建议更新主图", owner: "运营", status: "处理中", remark: "影响转化", created_at: "2026-06-06" }
];

const solutionTemplates: Record<IssueCategory, string> = {
  安装问题: "您好，安装时请先确认卡扣方向，再按说明图从左到右固定。如需要，我们可以发送 30 秒安装视频协助您完成。",
  质量问题: "您好，我们会优先核实批次与照片，请您提供包装标签和问题位置照片，我们会尽快安排补发或售后处理。",
  尺寸问题: "您好，蜂巢帘购买前建议测量窗框内宽与高度。当前尺寸不合适时，我们可以协助您选择更匹配的规格。",
  颜色问题: "您好，不同光线下颜色会有轻微视觉差异。我们可以提供自然光实拍图，帮助您确认是否需要换色。",
  物流问题: "您好，运输损坏我们会先为您登记售后，并根据照片确认补发、退款或物流索赔方案。",
  包装问题: "您好，感谢反馈包装问题。我们会记录批次并同步仓库检查打包保护材料。",
  功能问题: "您好，请您描述具体使用场景并提供照片或视频，我们会判断是否为安装、配件或产品功能异常。",
  其它问题: "您好，我们已经收到您的反馈，会尽快确认原因并给出处理方案。"
};

export default function CustomerIssuesPage() {
  return (
    <AppShell>
      <CustomerIssuesContent />
    </AppShell>
  );
}

function CustomerIssuesContent() {
  const [issues, setIssues] = useState<CustomerIssue[]>(sampleIssues);
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>("安装问题");

  useEffect(() => {
    loadIssues();
  }, []);

  async function loadIssues() {
    const { data, error } = await supabase.from("customer_issues").select("*").order("issue_date", { ascending: false });
    if (!error && data?.length) setIssues(data as CustomerIssue[]);
  }

  const metrics = useMemo(() => buildMetrics(issues), [issues]);
  const ranking = useMemo(() => buildRanking(issues), [issues]);
  const trends = useMemo(() => buildMonthlyTrends(issues), [issues]);
  const skuRows = useMemo(() => buildSkuRows(issues), [issues]);
  const top = ranking[0];

  return (
    <div className="space-y-6">
      <CenterHero
        eyebrow="Customer Issue Center"
        title="客诉问题库"
        subtitle="把客户抱怨变成产品优化、详情页优化、供应链优化和客服效率提升的经营信号。"
        action={<StatusPill tone="brand">Business Insights</StatusPill>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={AlertCircle} label="本月投诉数量" value={metrics.monthTotal} hint="This Month" tone={metrics.monthTotal ? "watch" : "good"} />
          <ExecutiveKpi icon={Wrench} label="安装问题" value={metrics.byCategory["安装问题"] ?? 0} hint="Installation" tone="risk" />
          <ExecutiveKpi icon={PackageX} label="质量问题" value={metrics.byCategory["质量问题"] ?? 0} hint="Quality" />
          <ExecutiveKpi icon={Ruler} label="尺寸问题" value={metrics.byCategory["尺寸问题"] ?? 0} hint="Size" tone="watch" />
          <ExecutiveKpi icon={Truck} label="物流问题" value={metrics.byCategory["物流问题"] ?? 0} hint="Logistics" />
          <ExecutiveKpi icon={Palette} label="颜色问题" value={metrics.byCategory["颜色问题"] ?? 0} hint="Color" />
        </KpiGrid>
      </CenterHero>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <CenterPanel eyebrow="TOP10" title="投诉排行榜">
            <div className="space-y-3">
              {ranking.slice(0, 10).map((item) => (
                <div key={item.category} className="rounded-2xl border border-line bg-white/75 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-ink">{item.category}</div>
                    <StatusPill tone={item.percent >= 35 ? "risk" : item.percent >= 20 ? "watch" : "neutral"}>{item.percent}%</StatusPill>
                  </div>
                  <ProgressBar value={item.percent} tone={item.percent >= 35 ? "risk" : item.percent >= 20 ? "watch" : "brand"} />
                  <p className="mt-2 text-xs text-muted">{item.count} 条记录</p>
                </div>
              ))}
            </div>
          </CenterPanel>

          <CenterPanel eyebrow="Solution Library" title="解决方案库">
            <div className="mb-3 flex flex-wrap gap-2">
              {(Object.keys(solutionTemplates) as IssueCategory[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selectedCategory === category ? "border-[#17483f]/30 bg-[#17483f] text-white" : "border-line bg-white text-muted"}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-white/75 p-4 text-sm leading-6 text-ink">{solutionTemplates[selectedCategory]}</div>
          </CenterPanel>
        </div>

        <div className="space-y-5">
          <CenterPanel eyebrow="Trend Analysis" title="问题趋势分析">
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
          </CenterPanel>

          <CenterPanel eyebrow="SKU Diagnostics" title="SKU问题分析">
            <div className="grid gap-3 lg:grid-cols-2">
              {skuRows.map((row) => (
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
                    <MetricLine label="稳定性" value={row.count <= 1 ? "稳定" : "需优化"} tone={row.count <= 1 ? "good" : "watch"} />
                  </div>
                </article>
              ))}
            </div>
          </CenterPanel>

          <CenterPanel eyebrow="AI Insight" title="Business Insights">
            <div className="rounded-[24px] border border-[#d8d0b8] bg-[#162f2b] p-5 text-white shadow-[0_24px_58px_rgba(15,52,47,0.22)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[#d6c28b]"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-xl font-semibold">本月最主要投诉问题：{top?.category ?? "暂无"}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/72">
                    {buildInsight(top, skuRows)}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <DarkInsight icon={CircleCheckBig} label="建议优化方向" value="详情页说明 + 售后模板" />
                <DarkInsight icon={Boxes} label="影响对象" value={skuRows[0]?.sku ?? "暂无"} />
                <DarkInsight icon={AlertCircle} label="经营风险" value={top && top.percent >= 35 ? "高" : "中"} />
              </div>
            </div>
          </CenterPanel>
        </div>
      </div>
    </div>
  );
}

function DarkInsight({ icon: Icon, label, value }: { icon: typeof CircleCheckBig; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
      <Icon className="h-4 w-4 text-[#d6c28b]" />
      <div className="mt-2 text-xs text-white/55">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
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
  const total = Math.max(1, issues.length);
  const map = issues.reduce<Record<string, number>>((next, issue) => {
    next[issue.issue_category] = (next[issue.issue_category] ?? 0) + 1;
    return next;
  }, {});
  return Object.entries(map)
    .map(([category, count]) => ({ category, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
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

function buildInsight(top: ReturnType<typeof buildRanking>[number] | undefined, skuRows: ReturnType<typeof buildSkuRows>) {
  if (!top) return "当前暂无客诉数据。建议先从客服记录、退货原因和商品评价中沉淀问题库。";
  const sku = skuRows[0];
  return `${sku?.productName ?? "核心 SKU"} 的${top.category}占总投诉 ${top.percent}%，建议优先优化详情页说明、标准回复模板和产品随箱说明，减少客服重复沟通并降低退货风险。`;
}
