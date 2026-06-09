import Link from "next/link";
import type React from "react";
import { ArrowUpRight, BadgeCheck, BarChart3, Boxes, CheckCircle2, CircleDollarSign, FileText, PackageCheck, Palette, Ruler, TrendingUp, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const sizeRows = [
  ["100 x 160 cm", "23,200원", "正常销售", "小窗、低价引流款"],
  ["125 x 160 cm", "26,950원", "正常销售", "标准窗主力款"],
  ["155 x 160 cm", "32,550원", "正常销售", "评论中出现最多，重点尺寸"],
  ["180 x 160 cm", "38,900원", "품절임박 5个", "大窗短高款，有需求"],
  ["100 x 200 cm", "32,200원", "正常销售", "中等高度款"],
  ["125 x 200 cm", "36,450원", "正常销售", "稳定中价款"],
  ["155 x 200 cm", "38,700원", "正常销售", "大窗主力款"],
  ["180 x 200 cm", "47,900원", "正常销售", "大窗高客单"],
  ["100 x 240 cm", "44,200원", "품절임박 2个", "高窗/阳台需求明显"],
  ["125 x 240 cm", "48,450원", "품절임박 5个", "高窗热销候选"],
  ["155 x 240 cm", "53,550원", "품절임박 4个", "高客单潜力款"],
  ["180 x 240 cm", "59,900원", "暂时缺货", "最大规格，库存压力高"]
];

const hotSizes = [
  ["155 x 160 cm", "评论样本重复出现最多，尤其搭配黑色；价格处在主力利润带。", 96],
  ["125 x 160 cm", "韩国普通窗常用尺寸，价格低于 3万韩币，转化阻力小。", 90],
  ["100 x 160 cm", "当前链接默认选项，23,200 韩币，适合小窗和低价引流。", 84],
  ["125 x 240 cm", "页面显示库存紧张，适合阳台、高窗、卧室长窗。", 78],
  ["155 x 240 cm", "库存紧张，高客单，适合做利润款。", 74]
] as const;

const colorRows = [
  ["블랙", "评论样本出现最集中，遮光、办公、电视房需求强。", 96],
  ["브라운 / 모카", "韩国家居常见暖色，适合客厅、卧室。", 88],
  ["아이보리 / 화이트", "最安全的大众色，适合首批备货。", 86],
  ["라이트그레이", "现代感强，适合年轻家庭和简约装修。", 78],
  ["다크블루", "当前链接选中色，但更偏小众，不建议做第一主推色。", 62]
] as const;

const priceRows = [
  ["23,000-27,000원", "100x160、125x160", "最容易成交，适合引流和测款。"],
  ["32,000-39,000원", "155x160、125x200、155x200", "主力利润款，适合稳定销售。"],
  ["44,000-54,000원", "100x240、125x240、155x240", "高客单潜力款，适合阳台/高窗。"],
  ["59,000원+", "180x240", "需求存在，但库存和价格压力更高。"]
];

const skuRows = [
  ["1", "125 x 160", "아이보리 / 화이트 / 라이트그레이", "25,900-28,900원", "主力成交款"],
  ["2", "155 x 160", "블랙 / 브라운 / 라이트그레이", "31,900-34,900원", "利润主力款"],
  ["3", "100 x 160", "아이보리 / 화이트", "22,900-24,900원", "低价引流款"],
  ["4", "125 x 240", "브라운 / 모카 / 아이보리", "44,900-49,900원", "高窗潜力款"],
  ["5", "155 x 240", "블랙 / 브라운", "49,900-54,900원", "高客单利润款"]
];

export default function SingleProductReportPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-[#d8e2dc] bg-[#f7faf8] shadow-[0_22px_70px_rgba(23,33,29,0.08)]">
          <div className="grid gap-0 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="p-6 md:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#bfd0c6] bg-white px-3 py-1 text-xs font-bold text-[#17483f]">
                <FileText className="h-4 w-4" />
                Coupang Product Intelligence Report
              </div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink md:text-4xl">
                빛고운창 베이직 콤비블라인드
                <span className="block text-[#17483f]">单品分析报表</span>
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
                分析目标：判断这款韩国 Coupang 斑马帘的主销尺寸、主销颜色、成交价格带，以及 4locks 可参考的开发方向。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Tag tone="good">建议参考开发</Tag>
                <Tag>低价走量型</Tag>
                <Tag>韩国标准斑马帘</Tag>
                <Tag tone="warn">价格竞争强</Tag>
              </div>
            </div>
            <div className="border-t border-[#d8e2dc] bg-[#102b27] p-6 text-white xl:border-l xl:border-t-0 md:p-8">
              <div className="flex items-center gap-3">
                <BadgeCheck className="h-7 w-7 text-[#d6c28b]" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d6c28b]">Final Verdict</p>
                  <h2 className="mt-1 text-2xl font-semibold">值得作为 4locks 标准款参考</h2>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-white/72">
                Coupang 页面不公开每个颜色/尺寸的真实销量，本报表基于评论选项、库存紧张提示、默认选项、价格阶梯和韩国窗型需求综合判断。
              </p>
              <Link
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#102b27]"
                href="https://www.coupang.com/vp/products/4570486?itemId=127637927&vendorItemId=3263586478"
                target="_blank"
              >
                打开 Coupang 商品页
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={BarChart3} label="商品评论数" value="13,672" />
          <Kpi icon={CheckCircle2} label="满意提示" value="1万+" />
          <Kpi icon={CircleDollarSign} label="当前选项价格" value="23,200원" />
          <Kpi icon={Boxes} label="可选尺寸" value="12+" />
        </section>

        <Panel title="商品基础信息" icon={PackageCheck}>
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="商品名称" value="빛고운창 베이직 콤비블라인드" />
            <Info label="商品类型" value="콤비블라인드 / 斑马帘 / 双层调光卷帘" />
            <Info label="当前链接选项" value="다크블루 / 100 x 160 cm" />
            <Info label="当前售价" value="23,200 韩币" />
            <Info label="配送" value="免费配送，页面显示次日到达" />
            <Info label="材质与配件" value="聚酯纤维；包含帘体、安装配件、安装说明书" />
          </div>
        </Panel>

        <Panel title="尺寸价格矩阵" icon={Ruler}>
          <DataTable headers={["尺寸", "售价", "页面状态", "商业判断"]} rows={sizeRows} />
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="最可能热销尺寸 TOP5" icon={TrendingUp}>
            <RankList rows={hotSizes} />
          </Panel>
          <Panel title="颜色热度判断" icon={Palette}>
            <RankList rows={colorRows} />
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="价格带分析" icon={CircleDollarSign}>
            <DataTable headers={["价格带", "对应尺寸", "市场作用"]} rows={priceRows} />
          </Panel>
          <Panel title="不建议首批备货颜色" icon={TriangleAlert}>
            <p className="text-sm leading-6 text-muted">这些颜色可以作为后期长尾定制色，但不适合作为首批库存主力。</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["레드", "퍼플", "핑크", "오렌지", "라임그린", "와인", "카키"].map((color) => (
                <Tag key={color} tone="risk">{color}</Tag>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="4locks 首批 SKU 建议" icon={BadgeCheck}>
          <DataTable headers={["优先级", "尺寸", "颜色", "建议售价", "角色"]} rows={skuRows} />
          <div className="mt-5 rounded-2xl border border-[#b9d5c5] bg-[#edf7f1] p-4 text-sm font-semibold leading-6 text-[#17483f]">
            建议方向：基础款 콤비블라인드 + 标准尺寸 + 安全色 + 易安装/免打孔卖点。不要一开始复制 22 个颜色，先用高确定性颜色和尺寸测试市场。
          </div>
        </Panel>

        <Panel title="最终决策" icon={CheckCircle2}>
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="是否值得参考" value="值得。该商品是韩国 Coupang 低价走量型斑马帘代表款。" />
            <Info label="最值得做的尺寸" value="125x160、155x160、100x160、125x240、155x240" />
            <Info label="最值得做的颜色" value="아이보리、화이트、라이트그레이、브라운/모카、블랙" />
            <Info label="建议价格带" value="入门款 22,900-28,900원；主力款 31,900-39,900원；高窗款 44,900-54,900원" />
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-line bg-white p-5 shadow-[0_14px_34px_rgba(23,33,29,0.06)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
        <Icon className="h-5 w-5 text-[#17483f]" />
      </div>
      <div className="mt-4 text-3xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-line bg-white p-5 shadow-[0_14px_34px_rgba(23,33,29,0.06)]">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf7f1] text-[#17483f]">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-[#fbfcfb] p-4">
      <div className="text-xs font-bold text-muted">{label}</div>
      <div className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#f6f8f6]">
          <tr>{headers.map((header) => <th key={header} className="border-b border-line px-4 py-3 text-left text-xs font-bold text-muted">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")} className="odd:bg-white even:bg-[#fbfcfb]">
              {row.map((cell) => <td key={cell} className="border-b border-line px-4 py-3 align-top font-medium text-ink last:border-b-0">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankList({ rows }: { rows: ReadonlyArray<readonly [string, string, number]> }) {
  return (
    <div className="space-y-3">
      {rows.map(([name, description, score], index) => (
        <div key={name} className="rounded-2xl border border-line bg-[#fbfcfb] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17483f] text-xs font-bold text-white">{index + 1}</span>
                <h3 className="font-semibold text-ink">{name}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
            </div>
            <span className="text-sm font-bold text-[#17483f]">{score}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5ece8]">
            <div className="h-full rounded-full bg-[#17483f]" style={{ width: `${score}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "risk" }) {
  const styles = {
    neutral: "border-[#d8e2dc] bg-white text-[#17483f]",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    risk: "border-red-200 bg-red-50 text-red-700"
  };

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>;
}
