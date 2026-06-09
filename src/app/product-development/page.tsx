"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Beaker, Boxes, CircleOff, FlaskConical, Lightbulb, Rocket, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CenterHero, CenterPanel, ExecutiveKpi, KpiGrid, MetricLine, ProgressBar, StatusPill } from "@/components/ManagementCenter";
import { supabase } from "@/lib/supabase";

type DevStatus = "待开发" | "询价中" | "打样中" | "测试中" | "优化中" | "待上架" | "已上线" | "已放弃";
type ProductPriority = "S级" | "A级" | "B级" | "C级";
type ProductDevRow = {
  id: string;
  product_name: string;
  product_image_url: string | null;
  product_category: string;
  supplier: string;
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

const statusFlow: DevStatus[] = ["待开发", "询价中", "打样中", "测试中", "待上架", "已上线"];
const sampleProducts: ProductDevRow[] = [
  { id: "pd-1", product_name: "免打孔蜂巢帘升级款", product_image_url: null, product_category: "窗帘", supplier: "宁波 A 工厂", purchase_cost: 12800, expected_price: 32900, expected_margin: null, owner: "产品", development_status: "打样中", expected_launch_date: "2026-07-15", priority: "S级", market_potential_score: 92, competition_score: 72, supply_chain_score: 84, profit_score: 88, remark: "重点验证安装便利性", created_at: "2026-06-01" },
  { id: "pd-2", product_name: "白色 99.1x163 安装配件包", product_image_url: null, product_category: "配件", supplier: "义乌 B 供应商", purchase_cost: 1800, expected_price: 7900, expected_margin: null, owner: "采购", development_status: "测试中", expected_launch_date: "2026-06-28", priority: "A级", market_potential_score: 76, competition_score: 82, supply_chain_score: 90, profit_score: 86, remark: "解决安装客诉", created_at: "2026-05-29" },
  { id: "pd-3", product_name: "遮光增强型黑色系列", product_image_url: null, product_category: "窗帘", supplier: "绍兴 C 工厂", purchase_cost: 15500, expected_price: 34900, expected_margin: null, owner: "老板", development_status: "询价中", expected_launch_date: "2026-08-02", priority: "A级", market_potential_score: 81, competition_score: 65, supply_chain_score: 72, profit_score: 79, remark: "需要确认面料稳定性", created_at: "2026-06-05" },
  { id: "pd-4", product_name: "低价入门款蜂巢帘", product_image_url: null, product_category: "窗帘", supplier: "广州 D 工厂", purchase_cost: 9800, expected_price: 19900, expected_margin: null, owner: "运营", development_status: "已放弃", expected_launch_date: null, priority: "C级", market_potential_score: 60, competition_score: 45, supply_chain_score: 54, profit_score: 41, remark: "利润空间不足", created_at: "2026-05-12" }
];

export default function ProductDevelopmentPage() {
  return (
    <AppShell>
      <ProductDevelopmentContent />
    </AppShell>
  );
}

function ProductDevelopmentContent() {
  const [products, setProducts] = useState<ProductDevRow[]>(sampleProducts);
  const [selectedId, setSelectedId] = useState(sampleProducts[0].id);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data, error } = await supabase.from("product_development").select("*").order("created_at", { ascending: false });
    if (!error && data?.length) {
      setProducts(data as ProductDevRow[]);
      setSelectedId(data[0].id);
    }
  }

  const metrics = useMemo(() => ({
    developing: products.filter((item) => ["待开发", "询价中", "打样中", "测试中", "优化中"].includes(item.development_status)).length,
    sampling: products.filter((item) => item.development_status === "打样中").length,
    testing: products.filter((item) => item.development_status === "测试中").length,
    listing: products.filter((item) => item.development_status === "待上架").length,
    online: products.filter((item) => item.development_status === "已上线").length,
    abandoned: products.filter((item) => item.development_status === "已放弃").length
  }), [products]);

  const selected = products.find((item) => item.id === selectedId) ?? products[0];
  const scoreSorted = [...products].sort((a, b) => totalScore(b) - totalScore(a));

  return (
    <div className="space-y-6">
      <CenterHero
        eyebrow="Product Development Center"
        title="产品开发中心"
        subtitle="把新品从灵感、询价、打样、测试到上架统一管理，避免微信记录、Excel 记录和脑子记。"
        action={<StatusPill tone="brand">新品投资组合</StatusPill>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={Lightbulb} label="开发中产品" value={metrics.developing} hint="Pipeline" tone="brand" />
          <ExecutiveKpi icon={FlaskConical} label="待打样产品" value={metrics.sampling} hint="Sampling" />
          <ExecutiveKpi icon={Beaker} label="测试中产品" value={metrics.testing} hint="Testing" tone="watch" />
          <ExecutiveKpi icon={Boxes} label="待上架产品" value={metrics.listing} hint="Listing" />
          <ExecutiveKpi icon={Rocket} label="已上线产品" value={metrics.online} hint="Launched" tone="good" />
          <ExecutiveKpi icon={CircleOff} label="放弃产品" value={metrics.abandoned} hint="Dropped" tone={metrics.abandoned ? "risk" : "neutral"} />
        </KpiGrid>
      </CenterHero>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <CenterPanel eyebrow="Development Funnel" title="产品开发漏斗">
            <div className="grid gap-3 md:grid-cols-6">
              {statusFlow.map((status, index) => {
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

          <CenterPanel eyebrow="Portfolio Score" title="产品优先级与评分系统">
            <div className="grid gap-3 lg:grid-cols-2">
              {scoreSorted.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`rounded-[22px] border bg-white/80 p-4 text-left shadow-[0_10px_26px_rgba(23,33,29,0.06)] ${selected?.id === item.id ? "border-[#17483f]/40 ring-2 ring-[#17483f]/10" : "border-line"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
                        <StatusPill tone={statusTone(item.development_status)}>{item.development_status}</StatusPill>
                      </div>
                      <h3 className="mt-3 font-semibold leading-snug text-ink">{item.product_name}</h3>
                      <p className="mt-1 text-xs text-muted">{item.product_category} · {item.supplier}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-semibold tabular-nums text-ink">{totalScore(item)}</div>
                      <div className="text-xs text-muted">综合评分</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MetricLine label="市场潜力" value={item.market_potential_score} tone="brand" />
                    <MetricLine label="竞争强度" value={item.competition_score} tone={item.competition_score >= 75 ? "watch" : "good"} />
                    <MetricLine label="供应链稳定性" value={item.supply_chain_score} tone="brand" />
                    <MetricLine label="利润空间" value={item.profit_score} tone="good" />
                  </div>
                </button>
              ))}
            </div>
          </CenterPanel>
        </div>

        {selected ? (
          <div className="space-y-5">
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
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-white/70">{selected.remark}</p>
              </div>
            </CenterPanel>

            <CenterPanel eyebrow="Timeline" title="开发时间轴">
              <div className="space-y-4">
                {["询价", "打样", "测试", "优化", "上架"].map((step, index) => {
                  const active = timelineProgress(selected.development_status) >= index;
                  return (
                    <div key={step} className="flex gap-3">
                      <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-[#17483f] text-white" : "bg-[#e7e5da] text-muted"}`}>{index + 1}</div>
                      <div className="flex-1 border-b border-line pb-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-ink">{step}</div>
                          <StatusPill tone={active ? "brand" : "neutral"}>{active ? "已推进" : "待推进"}</StatusPill>
                        </div>
                        <p className="mt-1 text-xs text-muted">负责人 {selected.owner} · 预计上线 {selected.expected_launch_date ?? "待定"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow="Decision" title="管理层判断">
              <div className="space-y-3 text-sm leading-6 text-muted">
                <p>综合评分 {totalScore(selected)}，利润率 {expectedMargin(selected).toFixed(1)}%。</p>
                <p>{decisionText(selected)}</p>
              </div>
            </CenterPanel>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function expectedProfit(item: ProductDevRow) {
  return Number(item.expected_price || 0) - Number(item.purchase_cost || 0);
}

function expectedMargin(item: ProductDevRow) {
  if (item.expected_margin != null) return Number(item.expected_margin);
  return item.expected_price > 0 ? (expectedProfit(item) / item.expected_price) * 100 : 0;
}

function totalScore(item: ProductDevRow) {
  return Math.round((item.market_potential_score + item.competition_score + item.supply_chain_score + item.profit_score) / 4);
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

function timelineProgress(status: DevStatus) {
  return { "待开发": -1, "询价中": 0, "打样中": 1, "测试中": 2, "优化中": 3, "待上架": 4, "已上线": 4, "已放弃": -1 }[status];
}

function decisionText(item: ProductDevRow) {
  if (item.development_status === "已放弃") return "建议保留归档，不再占用供应链与测试资源。";
  if (item.priority === "S级" || totalScore(item) >= 85) return "建议进入老板重点跟进清单，优先锁定供应链、样品测试和首批上架节奏。";
  if (expectedMargin(item) < 35) return "建议重新谈采购成本或调整售价，否则上线后容易放大低利润 SKU 压力。";
  return "建议保持当前节奏推进，并在测试完成后再决定首批采购量。";
}

function won(value: number) {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}
