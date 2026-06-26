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
  AdvertisingSource,
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
    note: "核心放量广告"
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
    note: "测试创意和标题"
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
    note: "单品精细化投放"
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

export function buildAdCards(
  ads: AdvertisingAd[],
  metrics: AdvertisingDailyMetric[],
  today: string
): AdvertisingAdCard[] {
  return ads.map((ad) => {
    const adMetrics = metrics.filter((row) => row.adId === ad.id);
    const todaySummary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: today, end: today }));
    const last7Summary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: offsetDate(today, -6), end: today }));
    const last30Summary = summarizeMetrics(filterMetricsByRange(adMetrics, { start: offsetDate(today, -29), end: today }));
    const trend = calculateTrendDirection(last7Summary.adSales, last30Summary.adSales / Math.max(1, 30 / 7));
    const latestSync = adMetrics[0]?.syncedAt ?? null;

    return {
      ad,
      today: todaySummary,
      last7: last7Summary,
      last30: last30Summary,
      trend,
      healthScore: calculateHealthScore(last7Summary, ad.targetRoas),
      source: adMetrics[0]?.source ?? "seed",
      latestSyncLabel: latestSync ? formatDateTime(latestSync) : "未同步"
    };
  });
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

export function buildTrendPoints(metrics: AdvertisingDailyMetric[], range: AdvertisingRange): AdvertisingTrendPoint[] {
  const bucket = new Map<string, AdvertisingDailyMetric[]>();
  for (const row of filterMetricsByRange(metrics, range)) {
    const current = bucket.get(row.date) ?? [];
    current.push(row);
    bucket.set(row.date, current);
  }

  return Array.from(bucket.entries())
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
  const skuMap = new Map<string, AdvertisingDailyMetric[]>();
  for (const row of metrics.filter((item) => item.adId === adId)) {
    const skuKey = row.rawPayload?.sku?.trim() || "UNASSIGNED";
    const current = skuMap.get(skuKey) ?? [];
    current.push(row);
    skuMap.set(skuKey, current);
  }

  return Array.from(skuMap.entries()).map(([skuCode, rows]) => {
    const summary = summarizeMetrics(rows);
    const productNameCn = rows[0]?.rawPayload?.product_name || skuCode;
    const productNameKr = productNameCn;

    return {
      adId,
      skuCode,
      productNameCn,
      productNameKr,
      date: rows[rows.length - 1]?.date ?? "",
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
  });
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
      actionTaken: "查看原始日报备注",
      issue: row.roas != null && row.roas < 1.5 ? "ROAS偏低" : "持续观察",
      nextPlan: row.roas != null && row.roas >= 3 ? "可评估加预算" : "继续优化素材与详情页",
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

  if ((summary.roas ?? 0) * 100 >= targetRoas && (summary.cpa ?? Infinity) < 25000) {
    items.push({ title: "提高预算", detail: "当前 ROAS 超过目标值，且获取订单成本稳定，可以逐步放量。", tone: "good" });
  }
  if ((summary.ctr ?? 0) < 1.2) {
    items.push({ title: "优化主图和标题", detail: "曝光存在但点击率偏低，优先检查主图、标题和广告素材。", tone: "warn" });
  }
  if ((summary.ctr ?? 0) >= 1.5 && (summary.conversionRate ?? 0) < 2) {
    items.push({ title: "检查商品页转化", detail: "点击不差但转化低，建议检查价格、评价、详情页和优惠。", tone: "danger" });
  }
  if ((summary.roas ?? 0) * 100 < targetRoas * 0.6) {
    items.push({ title: "控制预算", detail: "当前 ROAS 明显低于目标，建议先缩量观察，再决定是否暂停。", tone: "danger" });
  }
  if (!items.length) {
    items.push({ title: "保持观察", detail: "当前数据波动在合理范围内，建议延续投放并观察近 3 天趋势。", tone: "neutral" });
  }

  return items;
}

export function buildLeaderboard(
  cards: AdvertisingAdCard[],
  metric: AdvertisingMetricKey
): AdvertisingLeaderboardItem[] {
  return [...cards]
    .map((card) => ({
      adId: card.ad.id,
      adName: card.ad.adName,
      value: pickMetric(card.last30, metric),
      secondary: `近30天 ${metric}`
    }))
    .sort((a, b) => Number(b.value ?? -Infinity) - Number(a.value ?? -Infinity));
}

export function buildOverviewKpis(summary: AdvertisingSummary, activeCount: number, abnormalCount: number): AdvertisingKpiItem[] {
  return [
    { key: "adCost", label: "广告总花费", value: formatCurrency(summary.adCost) },
    { key: "adSales", label: "广告转化销售额", value: formatCurrency(summary.adSales) },
    { key: "roas", label: "ROAS", value: formatPercent(summary.roas, true), tone: (summary.roas ?? 0) >= 3 ? "good" : "warn" },
    { key: "clicks", label: "点击数", value: formatCount(summary.clicks) },
    { key: "impressions", label: "曝光数", value: formatCount(summary.impressions) },
    { key: "ctr", label: "CTR", value: formatPercent(summary.ctr) },
    { key: "conversion", label: "转化率", value: formatPercent(summary.conversionRate) },
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
  let score = 62;
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

  if (summary.profitAfterAds < 0) score -= 18;
  if (summary.adCost === 0 && summary.adSales === 0) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
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
  const found = CORE_ADS.find((ad) => normalizeCampaignName(ad.adName) === normalizeCampaignName(campaignName));
  return found?.id ?? CORE_ADS[0].id;
}

export function normalizeCampaignName(name: string): string {
  return String(name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function getPresetRange(preset: AdvertisingRange["start"] extends string ? string : never, today: string, custom?: AdvertisingRange): AdvertisingRange {
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

export function formatPercent(value: number | null, alreadyPercent = false): string {
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

function buildSkuSuggestion(summary: AdvertisingSummary): string {
  if ((summary.roas ?? 0) >= 380 && summary.profitAfterAds > 0) return "加大预算";
  if ((summary.roas ?? 0) < 180 && (summary.conversionRate ?? 0) < 1.6) return "暂停投放";
  if ((summary.ctr ?? 0) < 1) return "优化主图";
  if ((summary.conversionRate ?? 0) < 2) return "检查转化率";
  return "保持观察";
}
