import assert from "node:assert/strict";

import {
  CORE_ADS,
  buildDailyNotePayload,
  buildAdCards,
  calculateConversionRate,
  calculateCtr,
  calculateHealthScore,
  calculateRoas,
  normalizeDailyNoteRow,
  normalizeLegacyDailyMetric,
  summarizeMetrics,
  todayKst
} from "./advertising.ts";
import type { AdvertisingDailyNoteInput, AdvertisingDailyNoteRow, LegacyAdvertisingDailyRecord } from "./advertising-types.ts";

const records: LegacyAdvertisingDailyRecord[] = [
  {
    id: "a1-1",
    record_date: "2026-06-26",
    campaign_name: CORE_ADS[0].adName,
    sku: "4LK-HCB-FB",
    product_name: "4locks 完全遮光蜂巢帘",
    ad_spend: 20000,
    ad_sales: 98000,
    impressions: 4200,
    clicks: 88,
    ctr: null,
    ad_sales_count: 5,
    ad_order_count: 4,
    roas: null,
    conversion_rate: null,
    remark: "素材稳定，继续观察",
    created_at: "2026-06-26T09:00:00.000Z",
    updated_at: "2026-06-26T10:00:00.000Z"
  },
  {
    id: "a1-2",
    record_date: "2026-06-27",
    campaign_name: CORE_ADS[0].adName,
    sku: "4LK-HCB-FB",
    product_name: "4locks 完全遮光蜂巢帘",
    ad_spend: 18000,
    ad_sales: 86000,
    impressions: 3900,
    clicks: 80,
    ctr: null,
    ad_sales_count: 4,
    ad_order_count: 3,
    roas: null,
    conversion_rate: null,
    remark: "ROAS继续高于目标",
    created_at: "2026-06-27T09:00:00.000Z",
    updated_at: "2026-06-27T10:00:00.000Z"
  }
];

assert.equal(calculateRoas(100000, 20000), 500);
assert.equal(calculateRoas(100000, 0), null);
assert.equal(calculateCtr(25, 1000), 2.5);
assert.equal(calculateCtr(25, 0), null);
assert.equal(calculateConversionRate(3, 60), 5);
assert.equal(calculateConversionRate(3, 0), null);

const normalized = records.map(normalizeLegacyDailyMetric);
const summary = summarizeMetrics(normalized);

assert.equal(summary.adCost, 38000);
assert.equal(summary.adSales, 184000);
assert.equal(summary.roas, 484.2105263157895);
assert.equal(summary.ctr, 2.074074074074074);
assert.equal(summary.conversionRate, 4.166666666666666);
assert.ok(calculateHealthScore(summary, 350) >= 80);

const cards = buildAdCards(CORE_ADS, normalized, "2026-06-27");
assert.equal(cards.length, 3);
assert.equal(cards[0]?.ad.id, CORE_ADS[0].id);
assert.equal(cards[0]?.today.adCost, 18000);
assert.equal(cards[0]?.today.adSales, 86000);
assert.equal(cards[0]?.last7.adCost, 38000);
assert.equal(cards[0]?.healthScore >= 80, true);
assert.equal(todayKst().length, 10);

const noteInput: AdvertisingDailyNoteInput = {
  adId: CORE_ADS[0].id,
  date: "2026-06-27",
  operator: "Kangyi",
  observation: "ROAS 持续高于目标",
  actionTaken: "上调预算 10%",
  budgetChange: "+10000",
  bidChange: "保持",
  skuChange: "",
  issue: "暂无",
  nextPlan: "继续观察 3 天"
};

const notePayload = buildDailyNotePayload(noteInput);
assert.equal(notePayload.ad_id, CORE_ADS[0].id);
assert.equal(notePayload.budget_change, "+10000");
assert.equal(notePayload.sku_change, null);

const noteRow: AdvertisingDailyNoteRow = {
  id: "note-1",
  ad_id: CORE_ADS[0].id,
  date: "2026-06-27",
  operator: "Kangyi",
  observation: "ROAS 持续高于目标",
  action_taken: "上调预算 10%",
  budget_change: "+10000",
  bid_change: "保持",
  sku_change: null,
  issue: "暂无",
  next_plan: "继续观察 3 天",
  created_at: "2026-06-27T08:00:00.000Z",
  updated_at: "2026-06-27T09:00:00.000Z"
};

const normalizedNote = normalizeDailyNoteRow(noteRow);
assert.equal(normalizedNote.actionTaken, "上调预算 10%");
assert.equal(normalizedNote.budgetChange, "+10000");
assert.equal(normalizedNote.skuChange, "");

console.log("advertising tests passed");
