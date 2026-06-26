"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CORE_ADS,
  buildAdCards,
  buildDailyNotePayload,
  buildDailyNotes,
  buildDailyRecordPayload,
  buildLeaderboard,
  buildOverviewKpis,
  buildRecommendations,
  buildSkuMetrics,
  buildTrendPoints,
  filterMetricsByRange,
  getPresetRange,
  mergeWithDemoMetrics,
  normalizeDailyNoteRow,
  normalizeLegacyDailyMetric,
  summarizeMetrics,
  todayKst
} from "@/lib/advertising";
import { supabase } from "@/lib/supabase";
import type {
  AdvertisingDailyMetric,
  AdvertisingDailyNote,
  AdvertisingDailyNoteInput,
  AdvertisingDailyNoteRow,
  AdvertisingDailyRecordInput,
  AdvertisingMetricKey,
  AdvertisingPreset,
  AdvertisingRange,
  AdvertisingSummary,
  LegacyAdvertisingDailyRecord
} from "@/lib/advertising-types";

export function useAdvertisingData(preset: AdvertisingPreset, customRange?: AdvertisingRange) {
  const recordsCrud = useAdvertisingDailyRecords();
  const notesCrud = useAdvertisingNotes();
  const metrics = recordsCrud.metrics;

  const today = todayKst();
  const range = useMemo(() => getPresetRange(preset, today, customRange), [preset, today, customRange]);
  const filteredMetrics = useMemo(() => filterMetricsByRange(metrics, range), [metrics, range]);
  const overview = useMemo(() => summarizeMetrics(filteredMetrics), [filteredMetrics]);
  const cards = useMemo(() => buildAdCards(CORE_ADS, metrics, today), [metrics, today]);
  const trend = useMemo(() => buildTrendPoints(filteredMetrics, range), [filteredMetrics, range]);
  const overviewKpis = useMemo(() => {
    const abnormalCount = cards.filter((card) => card.healthScore < 55).length;
    return buildOverviewKpis(overview, cards.filter((card) => card.ad.status === "running").length, abnormalCount);
  }, [cards, overview]);
  const rankings = useMemo(
    () => ({
      roas: buildLeaderboard(cards, "roas"),
      adCost: buildLeaderboard(cards, "adCost"),
      adSales: buildLeaderboard(cards, "adSales"),
      ctr: buildLeaderboard(cards, "ctr"),
      conversionRate: buildLeaderboard(cards, "conversionRate")
    }),
    [cards]
  );

  return {
    loading: recordsCrud.loading,
    ads: CORE_ADS,
    metrics,
    filteredMetrics,
    overview,
    overviewKpis,
    cards,
    trend,
    range,
    rankings,
    notesCrud,
    recordsCrud
  };
}

export function useAdvertisingAdDetail(adId: string, preset: AdvertisingPreset, customRange?: AdvertisingRange) {
  const root = useAdvertisingData(preset, customRange);

  const ad = root.ads.find((item) => item.id === adId) ?? root.ads[0];
  const adMetrics = useMemo(() => root.metrics.filter((item) => item.adId === ad.id), [root.metrics, ad.id]);
  const filteredAdMetrics = useMemo(() => filterMetricsByRange(adMetrics, root.range), [adMetrics, root.range]);
  const summary = useMemo(() => summarizeMetrics(filteredAdMetrics), [filteredAdMetrics]);
  const skuMetrics = useMemo(() => buildSkuMetrics(ad.id, filteredAdMetrics), [ad.id, filteredAdMetrics]);
  const fallbackNotes = useMemo(() => buildDailyNotes(ad.id, adMetrics), [ad.id, adMetrics]);
  const notes = root.notesCrud.notesByAdId[ad.id]?.length ? root.notesCrud.notesByAdId[ad.id] : fallbackNotes;
  const trend = useMemo(() => buildTrendPoints(filteredAdMetrics, root.range), [filteredAdMetrics, root.range]);
  const recommendations = useMemo(() => buildRecommendations(summary, ad.targetRoas), [summary, ad.targetRoas]);

  return {
    ...root,
    ad,
    adMetrics,
    filteredAdMetrics,
    summary,
    skuMetrics,
    notes,
    trend,
    recommendations
  };
}

export function useAdvertisingDailyRecords() {
  const [storedMetrics, setStoredMetrics] = useState<AdvertisingDailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(() => mergeWithDemoMetrics(storedMetrics), [storedMetrics]);

  async function loadRecords() {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("advertising_daily_records")
      .select("*")
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (queryError) {
      setStoredMetrics([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = ((data as LegacyAdvertisingDailyRecord[] | null) ?? []).map(normalizeLegacyDailyMetric);
    setStoredMetrics(rows);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  async function saveRecord(input: AdvertisingDailyRecordInput): Promise<{ ok: boolean; error: string | null }> {
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      return { ok: false, error: "未登录，无法保存广告日报记录。" };
    }

    const payload = { user_id: auth.user.id, ...buildDailyRecordPayload(input) };
    const { error: upsertError } = await supabase
      .from("advertising_daily_records")
      .upsert(payload, { onConflict: "user_id,record_date,campaign_name" });

    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return { ok: false, error: upsertError.message };
    }

    await loadRecords();
    setSaving(false);
    return { ok: true, error: null };
  }

  async function deleteRecord(id: string): Promise<{ ok: boolean; error: string | null }> {
    const { error: deleteError } = await supabase.from("advertising_daily_records").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return { ok: false, error: deleteError.message };
    }

    await loadRecords();
    return { ok: true, error: null };
  }

  return {
    metrics,
    storedMetrics,
    loading,
    saving,
    error,
    reload: loadRecords,
    saveRecord,
    deleteRecord
  };
}

export function useAdvertisingNotes() {
  const [notes, setNotes] = useState<AdvertisingDailyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNotes() {
    setLoading(true);
    const { data, error: queryError } = await supabase.from("ad_daily_notes").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });

    if (queryError) {
      setNotes([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setNotes(((data as AdvertisingDailyNoteRow[] | null) ?? []).map(normalizeDailyNoteRow));
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  async function createNote(input: AdvertisingDailyNoteInput) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: "未登录，无法保存广告日报备注。" };

    const payload = { user_id: auth.user.id, ...buildDailyNotePayload(input) };
    const { error: insertError } = await supabase.from("ad_daily_notes").insert(payload);
    if (insertError) {
      setError(insertError.message);
      return { ok: false, error: insertError.message };
    }

    await loadNotes();
    return { ok: true, error: null };
  }

  async function updateNote(id: string, input: AdvertisingDailyNoteInput) {
    const { error: updateError } = await supabase.from("ad_daily_notes").update(buildDailyNotePayload(input)).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return { ok: false, error: updateError.message };
    }

    await loadNotes();
    return { ok: true, error: null };
  }

  async function deleteNote(id: string) {
    const { error: deleteError } = await supabase.from("ad_daily_notes").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return { ok: false, error: deleteError.message };
    }

    await loadNotes();
    return { ok: true, error: null };
  }

  const notesByAdId = useMemo(
    () =>
      notes.reduce<Record<string, AdvertisingDailyNote[]>>((acc, note) => {
        acc[note.adId] = [...(acc[note.adId] ?? []), note];
        return acc;
      }, {}),
    [notes]
  );

  return {
    notes,
    notesByAdId,
    loading,
    error,
    reload: loadNotes,
    createNote,
    updateNote,
    deleteNote
  };
}

export function buildAdMetricsGrid(summary: AdvertisingSummary) {
  return [
    { label: "广告费", value: summary.adCost, kind: "currency" },
    { label: "广告转化销售额", value: summary.adSales, kind: "currency" },
    { label: "曝光数", value: summary.impressions, kind: "count" },
    { label: "点击数", value: summary.clicks, kind: "count" },
    { label: "CTR", value: summary.ctr, kind: "percent" },
    { label: "广告转化销售数量", value: summary.adConversionSalesCount, kind: "count" },
    { label: "广告转化订单数", value: summary.adConversionOrderCount, kind: "count" },
    { label: "ROAS", value: summary.roas, kind: "percent" },
    { label: "转化率", value: summary.conversionRate, kind: "percent" },
    { label: "CPC", value: summary.cpc, kind: "currency" },
    { label: "CPA", value: summary.cpa, kind: "currency" },
    { label: "广告后利润", value: summary.profitAfterAds, kind: "currency" }
  ] as const;
}

export function buildGlobalDailyRows(metrics: AdvertisingDailyMetric[]) {
  return [...metrics].sort((a, b) => b.date.localeCompare(a.date));
}

export function buildGlobalSkuRows(metrics: AdvertisingDailyMetric[]) {
  return CORE_ADS.flatMap((ad) => buildSkuMetrics(ad.id, metrics));
}

export function buildGlobalNotes(metrics: AdvertisingDailyMetric[]): AdvertisingDailyNote[] {
  return CORE_ADS.flatMap((ad) => buildDailyNotes(ad.id, metrics)).sort((a, b) => b.date.localeCompare(a.date));
}

export function buildMetricChoices(): Array<{ key: AdvertisingMetricKey; label: string }> {
  return [
    { key: "adCost", label: "广告费" },
    { key: "adSales", label: "广告销售额" },
    { key: "roas", label: "ROAS" },
    { key: "clicks", label: "点击数" },
    { key: "impressions", label: "曝光数" },
    { key: "ctr", label: "CTR" },
    { key: "conversionRate", label: "转化率" }
  ];
}
