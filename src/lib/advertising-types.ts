export type AdStatus = "running" | "paused" | "warning" | "unsynced";

export type AdvertisingPreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom";

export type AdvertisingMetricKey =
  | "adCost"
  | "adSales"
  | "roas"
  | "clicks"
  | "impressions"
  | "ctr"
  | "conversionRate";

export type AdvertisingTrendDirection = "up" | "down" | "flat";

export type AdvertisingSource = "seed" | "manual_import" | "api_sync" | "legacy_record";

export type AdvertisingAd = {
  id: string;
  adName: string;
  adNameKr: string;
  adType: string;
  platform: "coupang";
  status: AdStatus;
  linkedCampaignName: string;
  linkedProductName: string;
  linkedSku: string | null;
  dailyBudget: number;
  targetRoas: number;
  note: string | null;
};

export type LegacyAdvertisingDailyRecord = {
  id: string;
  record_date: string;
  campaign_name: string;
  sku: string;
  product_name: string;
  ad_spend: number;
  ad_sales: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  ad_sales_count: number;
  ad_order_count: number;
  roas: number | null;
  conversion_rate: number | null;
  remark: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type AdvertisingDailyMetric = {
  id: string;
  adId: string;
  date: string;
  adCost: number;
  adSales: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  conversionRate: number | null;
  adConversionSalesCount: number;
  adConversionOrderCount: number;
  roas: number | null;
  cpc: number | null;
  cpa: number | null;
  source: AdvertisingSource;
  rawPayload?: LegacyAdvertisingDailyRecord;
  syncedAt?: string | null;
  remark?: string | null;
};

export type AdvertisingSkuMetric = {
  adId: string;
  skuCode: string;
  productNameCn: string;
  productNameKr: string;
  date: string;
  adCost: number;
  adSales: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  conversionRate: number | null;
  salesQuantity: number;
  orderCount: number;
  roas: number | null;
  grossProfit: number;
  profitAfterAds: number;
  suggestion: string;
};

export type AdvertisingDailyNote = {
  id: string;
  adId: string;
  date: string;
  operator: string;
  observation: string;
  actionTaken: string;
  budgetChange?: string | null;
  bidChange?: string | null;
  skuChange?: string | null;
  issue: string;
  nextPlan: string;
  createdAt: string;
  updatedAt: string | null;
};

export type AdvertisingDailyNoteRow = {
  id: string;
  ad_id: string;
  date: string;
  operator: string | null;
  observation: string | null;
  action_taken: string | null;
  budget_change: string | null;
  bid_change: string | null;
  sku_change: string | null;
  issue: string | null;
  next_plan: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AdvertisingDailyNoteInput = {
  adId: string;
  date: string;
  operator: string;
  observation: string;
  actionTaken: string;
  budgetChange: string;
  bidChange: string;
  skuChange: string;
  issue: string;
  nextPlan: string;
};

export type AdvertisingRange = {
  start: string;
  end: string;
};

export type AdvertisingSummary = {
  adCost: number;
  adSales: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  conversionRate: number | null;
  adConversionSalesCount: number;
  adConversionOrderCount: number;
  roas: number | null;
  cpc: number | null;
  cpa: number | null;
  grossProfit: number;
  profitAfterAds: number;
};

export type AdvertisingKpiItem = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "danger";
};

export type AdvertisingAdCard = {
  ad: AdvertisingAd;
  today: AdvertisingSummary;
  yesterday: AdvertisingSummary;
  last7: AdvertisingSummary;
  thisMonth: AdvertisingSummary;
  last30: AdvertisingSummary;
  trend: AdvertisingTrendDirection;
  healthScore: number;
  source: AdvertisingSource;
  latestSyncLabel: string;
};

export type AdvertisingTrendPoint = {
  date: string;
  label: string;
  adCost: number;
  adSales: number;
  roas: number | null;
  clicks: number;
  impressions: number;
  ctr: number | null;
  conversionRate: number | null;
};

export type AdvertisingRecommendation = {
  title: string;
  detail: string;
  tone: "good" | "warn" | "danger" | "neutral";
};

export type AdvertisingLeaderboardItem = {
  adId: string;
  adName: string;
  value: number | null;
  secondary: string;
};
