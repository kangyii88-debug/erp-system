import type {
  AdvertisingAd,
  AdvertisingAdCard,
  AdvertisingDailyMetric,
  AdvertisingDailyNote,
  AdvertisingDailyNoteInput,
  AdvertisingDailyNoteRow,
  AdvertisingKpiItem,
  AdvertisingLeaderboardItem,
  AdvertisingMetricKey,
  AdvertisingRange,
  AdvertisingRecommendation,
  AdvertisingSkuMetric,
  AdvertisingSummary,
  AdvertisingTrendDirection,
  AdvertisingTrendPoint,
  LegacyAdvertisingDailyRecord
} from "./advertising-types";

export const CORE_ADS: AdvertisingAd[] = [
  {
    id: "4locks-full-blackout-honeycomb",
    adName: "4locks 완전 암막 허니콤 블라인드 무코드 한손조절 창",
    adNameKr: "4locks 완전 암막 허니콤 블라인드 무코드 한손조절 창",
    adType: "search",
    platform: "coupang",
    status: "running",
    linkedCampaignName: "4locks 완전 암막 허니콤 블라인드 무코드 한손조절 창",
    linkedProductName: "4locks 完全遮光蜂巢帘",
    linkedSku: "4LK-HCB-FB",
    dailyBudget: 120000,
    targetRoas: 350,
    note: "主力放量广告"
  },
  {
    id: "4locks-half-blackout-test",
    adName: "4locks 못없이 설치하는 반차광 블라인드, 테스트",
    adNameKr: "4locks 못없이 설치하는 반차광 블라인드, 테스트",
    adType: "search",
    platform: "coupang",
    status: "warning",
    linkedCampaignName: "4locks 못없이 설치하는 반차광 블라인드, 테스트",
    linkedProductName: "4locks 半遮光免打孔百叶帘",
    linkedSku: "4LK-HB-TEST",
    dailyBudget: 85000,
    targetRoas: 300,
    note: "测试中的创意广告"
  },
  {
    id: "honeycomb-gray-991x163",
    adName: "허니콤암막_그레이99.1x163_250610",
    adNameKr: "허니콤암막_그레이99.1x163_250610",
    adType: "product",
    platform: "coupang",
    status: "paused",
    linkedCampaignName: "허니콤암막_그레이99.1x163_250610",
    linkedProductName: "蜂巢帘 灰色 99.1x163",
    linkedSku: "HCB-GR-991-163",
    dailyBudget: 60000,
    targetRoas: 280,
    note: "单品精细投放"
  }
];

export function normalizeLegacyDailyMetric(record: LegacyAdvertisingDailyRecord): AdvertisingDailyMetric {
  const adCost = Number(record.ad_spend ?? 0);
  const adSales = Number(record.ad_sales ?? 0);
  const clicks = Number(record.clicks ?? 0);
  const impressions = Number(record.impressions ?? 0);
  const orderCount = Number(record.ad_order_count ?? 0);

  return {
    id: record.id,
    adId: matchAdId(record.campaign_name),
    date: record.record_date,
    adCost,
    adSales,
    impressions,
    clicks,
    ctr: record.ctr ?? calculateCtr(clicks, impressions),
    conversionRate: record.conversion_rate ?? calculateConversionRate(orderCount, clicks),
    adConversionSalesCount: Number(record.ad_sales_count ?? 0),
    adConversionOrderCount: orderCount,
    roas: record.roas ?? calculateRoas(adSales, adCost),
    cpc: calculateCpc(adCost, clicks),
    cpa: calculateCpa(adCost, orderCount),
    source: "legacy_record",
    rawPayload: record,
    syncedAt: record.updated_at ?? record.created_at,
    remark: record.remark ?? null
  };
}

export function buildDemoMetrics(today: string = todayKst()): AdvertisingDailyMetric[] {
  const series = [
    {
      adId: CORE_ADS[0].id,
      sku: "4LK-HCB-FB",
      productName: "4locks 完全遮光蜂巢帘",
      dailyCost: 25500,
      dailySales: 152000,
      impressions: 4200,
      clicks: 92,
      orders: 5,
      salesCount: 6
    },
    {
      adId: CORE_ADS[1].id,
      sku: "4LK-HB-TEST",
      productName: "4locks 半遮光免打孔百叶帘",
      dailyCost: 14800,
      dailySales: 52800,
      impressions: 3150,
      clicks: 57,
      orders: 2,
      salesCount: 3
    },
    {
      adId: CORE_ADS[2].id,
      sku: "HCB-GR-991-163",
      productName: "蜂巢帘 灰色 99.1x163",
      dailyCost: 9200,
      dailySales: 38400,
      impressions: 1980,
      clicks: 34,
      orders: 1,
      salesCount: 1
    }
  ];

  const metrics: AdvertisingDailyMetric[] = [];
  const days = 35;

  for (let index = 0; index < days; index += 1) {
    const date = offsetDate(today, -index);

    for (const item of series) {
      const swing = 1 + ((index % 5) - 2) * 0.06;
      const cost = Math.round(item.dailyCost * swing);
      const sales = Math.round(item.dailySales * (1 + ((index % 7) - 3) * 0.08));
      const impressions = Math.round(item.impressions * (1 + ((index % 4) - 1.5) * 0.05));
      const clicks = Math.max(1, Math.round(item.clicks * (1 + ((index % 6) - 2.5) * 0.04)));
      const orders = Math.max(1, Math.round(item.orders * (1 + ((index % 3) - 1) * 0.15)));
      const salesCount = Math.max(1, Math.round(item.salesCount * (1 + ((index % 3) - 1) * 0.12)));

      metrics.push({
        id: `demo-${item.adId}-${date}`,
        adId: item.adId,
        date,
        adCost: cost,
        adSales: sales,
        impressions,
        clicks,
        ctr: calculateCtr(clicks, impressions),
        conversionRate: calculateConversionRate(orders, clicks),
        adConversionSalesCount: salesCount,
        adConversionOrderCount: orders,
        roas: calculateRoas(sales, cost),
        cpc: calculateCpc(cost, clicks),
        cpa: calculateCpa(cost, orders),
        source: "seed",
        syncedAt: `${date}T09:00:00.000Z`,
        remark: index % 9 === 0 ? "Demo 数据：建议观察近 3 天趋势。" : null,
        rawPayload: {
          id: `demo-${item.adId}-${date}`,
          record_date: date,
          campaign_name: CORE_ADS.find((ad) => ad.id === item.adId)?.adName ?? item.adId,
          sku: item.sku,
          product_name: item.productName,
          ad_spend: cost,
          ad_sales: sales,
          impressions,
          clicks,
          ctr: calculateCtr(clicks, impressions),
          ad_sales_count: salesCount,
          ad_order_count: orders,
          roas: calculateRoas(sales, cost),
          conversion_rate: calculateConversionRate(orders, clicks),
          remark: index % 9 === 0 ? "Demo 数据：建议观察近 3 天趋势。" : null,
          created_at: `${date}T09:00:00.000Z`,
          updated_at: `${date}T09:00:00.000Z`
        }
      });
    }
  }

  return metrics;
}

export function mergeWithDemoMetrics(metrics: AdvertisingDailyMetric[], today: string = todayKst()): AdvertisingDailyMetric[] {
  const demoMetrics = buildDemoMetrics(today);
  const realAdIds = new Set(metrics.map((item) => item.adId));
  const merged = [...metrics];

  for (const ad of CORE_ADS) {
    if (!realAdIds.has(ad.id)) {
      merged.push(...demoMetrics.filter((item) => item.adId === ad.id));
    }
  }

  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

export function summarizeMetrics(metrics: AdvertisingDailyMetric[]): AdvertisingSummary {
  const summary = metrics.reduce<AdvertisingSummary>(
    (acc, row) => {
      acc.adCost += row.adCost;
      acc.adSales += row.adSales;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.adConversionSalesCount += row.adConversionSalesCount;
      acc.adConversionOrderCount += row.adConversionOrderCount;
      return acc;
    },
    {
      adCost: 0,
      adSales: 0,
      impressions: 0,
      clicks: 0,
      ctr: null,
      conversionRate: null,
      adConversionSalesCount: 0,
      adConversionOrderCount: 0,
      roas: null,
      cpc: null,
      cpa: null,
      grossProfit: 0,
      profitAfterAds: 0
    }
  );

  summary.roas = calculateRoas(summary.adSales, summary.adCost);
  summary.ctr = calculateCtr(summary.clicks, summary.impressions);
  summary.conversionRate = calculateConversionRate(summary.adConversionOrderCount, summary.clicks);
  summary.cpc = calculateCpc(summary.adCost, summary.clicks);
  summary.cpa = calculateCpa(summary.adCost, summary.adConversionOrderCount);
  summary.grossProfit = summary.adSales * 0.32;
  summary.profitAfterAds = calculateProfitAfterAds(summary.grossProfit, summary.adCost);
  return summary;
}

export function buildAdCards(ads: AdvertisingAd[], metrics: AdvertisingDailyMetric[], today: string): AdvertisingAdCard[] {
  return ads.map((ad) => {
    const adMetrics = metrics.filter((row) => row.adId === ad.id);
    const todaySummary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: today, end: today }));
    const yesterday = offsetDate(today, -1);
    const yesterdaySummary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: yesterday, end: yesterday }));
    const last7Summary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: offsetDate(today, -6), end: today }));
    const thisMonthSummary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: `${today.slice(0, 7)}-01`, end: today }));
    const last30Summary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: offsetDate(today, -29), end: today }));
    const trend = calculateTrendDirection(last7Summary.adSales, thisMonthSummary.adSales / Math.max(1, dateSpan(`${today.slice(0, 7)}-01`, today) / 7));
    const latestSync = adMetrics[0]?.syncedAt ?? null;

    return {
      ad,
      today: todaySummary,
      yesterday: yesterdaySummary,
      last7: last7Summary,
      thisMonth: thisMonthSummary,
      last30: last30Summary,
      trend,
      healthScore: calculateHealthScore(last7Summary, ad.targetRoas),
      source: adMetrics[0]?.source ?? "seed",
      latestSyncLabel: latestSync ? formatDateTime(latestSync) : "未同步"
    };
  });
}

export function buildTrendPoints(metrics: AdvertisingDailyMetric[], range: AdvertisingRange): AdvertisingTrendPoint[] {
  const grouped = new Map<string, AdvertisingDailyMetric[]>();
  for (const row of filterMetricsByRange(metrics, range)) {
    grouped.set(row.date, [...(grouped.get(row.date) ?? []), row]);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => {
      const summary = summarizeMetrics(rows);
      return {
        date,
        label: date.slice(5).replace("-", "/"),
        adCost: summary.adCost,
        adSales: summary.adSales,
        roas: summary.roas,
        clicks: summary.clicks,
        impressions: summary.impressions,
        ctr: summary.ctr,
        conversionRate: summary.conversionRate
      };
    });
}

export function buildSkuMetrics(adId: string, metrics: AdvertisingDailyMetric[]): AdvertisingSkuMetric[] {
  const grouped = new Map<string, AdvertisingDailyMetric[]>();
  for (const row of metrics.filter((item) => item.adId === adId)) {
    const sku = row.rawPayload?.sku?.trim() || "UNASSIGNED";
    grouped.set(sku, [...(grouped.get(sku) ?? []), row]);
  }

  return Array.from(grouped.entries())
    .map(([skuCode, rows]) => {
      const summary = summarizeMetrics(rows);
      const productNameCn = rows[0]?.rawPayload?.product_name || skuCode;
      return {
        adId,
        skuCode,
        productNameCn,
        productNameKr: productNameCn,
        date: rows[0]?.date ?? "",
        adCost: summary.adCost,
        adSales: summary.adSales,
        impressions: summary.impressions,
        clicks: summary.clicks,
        ctr: summary.ctr,
        conversionRate: summary.conversionRate,
        salesQuantity: summary.adConversionSalesCount,
        orderCount: summary.adConversionOrderCount,
        roas: summary.roas,
        grossProfit: summary.grossProfit,
        profitAfterAds: summary.profitAfterAds,
        suggestion: buildSkuSuggestion(summary)
      };
    })
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
}

export function buildDailyNotes(adId: string, metrics: AdvertisingDailyMetric[]): AdvertisingDailyNote[] {
  return metrics
    .filter((row) => row.adId === adId && row.remark)
    .map((row) => ({
      id: row.id,
      adId,
      date: row.date,
      operator: "ERP Operator",
      observation: row.remark ?? "",
      actionTaken: "查看原始广告日报备注",
      budgetChange: "",
      bidChange: "",
      skuChange: "",
      issue: row.roas != null && row.roas < 180 ? "ROAS 偏低，需要优化。" : "持续观察",
      nextPlan: row.roas != null && row.roas >= 300 ? "可考虑放量测试" : "继续优化素材和详情页",
      createdAt: row.rawPayload?.created_at ?? row.syncedAt ?? row.date,
      updatedAt: row.rawPayload?.updated_at ?? row.syncedAt ?? null
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function normalizeDailyNoteRow(row: AdvertisingDailyNoteRow): AdvertisingDailyNote {
  return {
    id: row.id,
    adId: row.ad_id,
    date: row.date,
    operator: row.operator ?? "ERP Operator",
    observation: row.observation ?? "",
    actionTaken: row.action_taken ?? "",
    budgetChange: row.budget_change ?? "",
    bidChange: row.bid_change ?? "",
    skuChange: row.sku_change ?? "",
    issue: row.issue ?? "",
    nextPlan: row.next_plan ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function buildDailyNotePayload(input: AdvertisingDailyNoteInput) {
  return {
    ad_id: input.adId,
    date: input.date,
    operator: input.operator.trim() || "ERP Operator",
    observation: input.observation.trim(),
    action_taken: input.actionTaken.trim(),
    budget_change: input.budgetChange.trim() || null,
    bid_change: input.bidChange.trim() || null,
    sku_change: input.skuChange.trim() || null,
    issue: input.issue.trim(),
    next_plan: input.nextPlan.trim()
  };
}

export function buildRecommendations(summary: AdvertisingSummary, targetRoas: number): AdvertisingRecommendation[] {
  const items: AdvertisingRecommendation[] = [];

  if ((summary.roas ?? 0) >= targetRoas) {
    items.push({ title: "提高预算", detail: "当前 ROAS 已达到目标值，建议优先放量健康分高的广告。", tone: "good" });
  }
  if ((summary.ctr ?? 0) < 1.2) {
    items.push({ title: "优化主图和标题", detail: "曝光存在但点击率偏低，建议先优化主图、标题和广告素材。", tone: "warn" });
  }
  if ((summary.ctr ?? 0) >= 1.5 && (summary.conversionRate ?? 0) < 2) {
    items.push({ title: "检查商品页转化", detail: "点击表现不差但转化偏低，建议检查价格、评价、详情页和优惠。", tone: "danger" });
  }
  if ((summary.roas ?? 0) < targetRoas * 0.6) {
    items.push({ title: "控制预算", detail: "当前 ROAS 明显低于目标值，建议先缩量观察，再决定是否暂停。", tone: "danger" });
  }
  if (!items.length) {
    items.push({ title: "保持观察", detail: "当前波动在可控范围内，继续观察近 3 天表现即可。", tone: "neutral" });
  }

  return items;
}

export function buildLeaderboard(cards: AdvertisingAdCard[], metric: AdvertisingMetricKey): AdvertisingLeaderboardItem[] {
  return [...cards]
    .map((card) => ({
      adId: card.ad.id,
      adName: card.ad.adName,
      value: pickMetric(card.thisMonth, metric),
      secondary: "本月表现"
    }))
    .sort((a, b) => Number(b.value ?? -Infinity) - Number(a.value ?? -Infinity));
}

export function buildOverviewKpis(summary: AdvertisingSummary, activeCount: number, abnormalCount: number): AdvertisingKpiItem[] {
  return [
    { key: "adCost", label: "广告总花费", value: formatCurrency(summary.adCost) },
    { key: "adSales", label: "广告转化销售额", value: formatCurrency(summary.adSales) },
    { key: "roas", label: "ROAS", value: formatPercent(summary.roas), tone: (summary.roas ?? 0) >= 300 ? "good" : "warn" },
    { key: "clicks", label: "点击数", value: formatCount(summary.clicks) },
    { key: "impressions", label: "曝光数", value: formatCount(summary.impressions) },
    { key: "ctr", label: "CTR", value: formatPercent(summary.ctr) },
    { key: "conversionRate", label: "转化率", value: formatPercent(summary.conversionRate) },
    { key: "active", label: "活跃广告数量", value: formatCount(activeCount) },
    { key: "abnormal", label: "异常广告数量", value: formatCount(abnormalCount), tone: abnormalCount > 0 ? "danger" : "default" }
  ];
}

export function filterMetricsByRange(metrics: AdvertisingDailyMetric[], range: AdvertisingRange): AdvertisingDailyMetric[] {
  return metrics.filter((row) => row.date >= range.start && row.date <= range.end);
}

export function calculateRoas(adSales: number, adCost: number): number | null {
  if (adCost <= 0) return null;
  return (adSales / adCost) * 100;
}

export function calculateCtr(clicks: number, impressions: number): number | null {
  if (impressions <= 0) return null;
  return (clicks / impressions) * 100;
}

export function calculateConversionRate(orderCount: number, clicks: number): number | null {
  if (clicks <= 0) return null;
  return (orderCount / clicks) * 100;
}

export function calculateCpc(adCost: number, clicks: number): number | null {
  if (clicks <= 0) return null;
  return adCost / clicks;
}

export function calculateCpa(adCost: number, orderCount: number): number | null {
  if (orderCount <= 0) return null;
  return adCost / orderCount;
}

export function calculateProfitAfterAds(grossProfit: number, adCost: number): number {
  return grossProfit - adCost;
}

export function calculateHealthScore(summary: AdvertisingSummary, targetRoas: number): number {
  let score = 64;
  const roas = summary.roas ?? 0;
  const ctr = summary.ctr ?? 0;
  const conversion = summary.conversionRate ?? 0;

  if (roas >= targetRoas) score += 18;
  else if (roas >= targetRoas * 0.75) score += 8;
  else score -= 14;

  if (ctr >= 1.6) score += 8;
  else if (ctr < 1.0) score -= 8;

  if (conversion >= 3) score += 10;
  else if (conversion < 1.2) score -= 12;

  if (summary.profitAfterAds < 0) score -= 16;
  if (summary.adCost === 0 && summary.adSales === 0) score -= 8;

  return Math.max(18, Math.min(100, Math.round(score)));
}

export function calculateTrendDirection(current: number, baseline: number): AdvertisingTrendDirection {
  if (current > baseline * 1.08) return "up";
  if (current < baseline * 0.92) return "down";
  return "flat";
}

export function pickMetric(summary: AdvertisingSummary, metric: AdvertisingMetricKey): number | null {
  switch (metric) {
    case "adCost":
      return summary.adCost;
    case "adSales":
      return summary.adSales;
    case "roas":
      return summary.roas;
    case "clicks":
      return summary.clicks;
    case "impressions":
      return summary.impressions;
    case "ctr":
      return summary.ctr;
    case "conversionRate":
      return summary.conversionRate;
    default:
      return null;
  }
}

export function matchAdId(campaignName: string): string {
  const normalized = normalizeCampaignName(campaignName);

  for (const ad of CORE_ADS) {
    const target = normalizeCampaignName(ad.adName);
    if (normalized === target) return ad.id;
    if (normalized.includes(target) || target.includes(normalized)) return ad.id;

    const adKeywords = target.split(" ").filter((token) => token.length > 1);
    const matches = adKeywords.filter((token) => normalized.includes(token)).length;
    if (matches >= Math.max(2, Math.ceil(adKeywords.length / 3))) return ad.id;
  }

  return CORE_ADS[0].id;
}

export function normalizeCampaignName(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[_|,/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPresetRange(preset: string, today: string, custom?: AdvertisingRange): AdvertisingRange {
  if (preset === "today") return { start: today, end: today };
  if (preset === "yesterday") {
    const yesterday = offsetDate(today, -1);
    return { start: yesterday, end: yesterday };
  }
  if (preset === "last7") return { start: offsetDate(today, -6), end: today };
  if (preset === "last30") return { start: offsetDate(today, -29), end: today };
  if (preset === "thisMonth") return { start: `${today.slice(0, 7)}-01`, end: today };
  return custom ?? { start: today, end: today };
}

export function formatCurrency(value: number | null): string {
  if (value == null) return "-";
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

export function formatCompactCurrency(value: number | null): string {
  if (value == null) return "-";
  if (Math.abs(value) >= 1000000) return `₩${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `₩${(value / 1000).toFixed(1)}K`;
  return formatCurrency(value);
}

export function formatPercent(value: number | null): string {
  if (value == null) return "-";
  return `${value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatCount(value: number | null): string {
  if (value == null) return "-";
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function todayKst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function offsetDate(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA");
}

function dateSpan(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
}

function buildSkuSuggestion(summary: AdvertisingSummary): string {
  if ((summary.roas ?? 0) >= 380 && summary.profitAfterAds > 0) return "加大预算";
  if ((summary.roas ?? 0) < 180 && (summary.conversionRate ?? 0) < 1.6) return "暂停投放";
  if ((summary.ctr ?? 0) < 1) return "优化主图";
  if ((summary.conversionRate ?? 0) < 2) return "检查转化率";
  return "保持观察";
}
