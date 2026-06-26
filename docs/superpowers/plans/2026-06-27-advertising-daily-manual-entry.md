# Advertising Daily Manual Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ERP-native daily advertising entry flow that lets the user create, edit, and delete one daily row per ad while keeping all existing advertising analytics pages on the same data source.

**Architecture:** Reuse `advertising_daily_records` as the source of truth, add a database uniqueness guard for `user_id + record_date + campaign_name`, and extend the current advertising hook and import page into a real operations workspace. Keep the work inside the existing advertising module rather than splitting a new subsystem.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Supabase client, existing advertising helper layer

---

### Task 1: Lock the daily uniqueness rule in the database

**Files:**
- Create: `supabase/migrations/2026-06-27-add-advertising-daily-record-unique.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add a migration that removes same-day duplicate rows and creates the unique index**

```sql
delete from advertising_daily_records a
using advertising_daily_records b
where a.id < b.id
  and a.user_id = b.user_id
  and a.record_date = b.record_date
  and a.campaign_name = b.campaign_name;

create unique index if not exists advertising_daily_records_user_day_campaign_uidx
  on advertising_daily_records (user_id, record_date, campaign_name);
```

- [ ] **Step 2: Mirror the index in `supabase/schema.sql` so the checked-in schema matches migrations**

```sql
create unique index if not exists advertising_daily_records_user_day_campaign_uidx
  on advertising_daily_records (user_id, record_date, campaign_name);
```

- [ ] **Step 3: Review that the index names and column order match the upsert plan**

Run: `rg -n "advertising_daily_records_user_day_campaign_uidx|campaign_name" supabase`
Expected: one migration and one schema reference using `(user_id, record_date, campaign_name)`

### Task 2: Add typed manual-entry payload helpers

**Files:**
- Modify: `src/lib/advertising-types.ts`
- Modify: `src/lib/advertising.ts`
- Test: `src/lib/advertising.test.mts`

- [ ] **Step 1: Add manual entry input and row types**

```ts
export type AdvertisingDailyRecordInput = {
  adId: string;
  date: string;
  adCost: number;
  adSales: number;
  impressions: number;
  clicks: number;
  ctr: number;
  adConversionSalesCount: number;
  adConversionOrderCount: number;
  roas: number;
  conversionRate: number;
  remark: string;
};
```

- [ ] **Step 2: Add a helper that maps the selected ad into a Supabase payload**

```ts
export function buildDailyRecordPayload(input: AdvertisingDailyRecordInput) {
  const ad = CORE_ADS.find((item) => item.id === input.adId) ?? CORE_ADS[0];

  return {
    record_date: input.date,
    campaign_name: ad.adName,
    sku: ad.linkedSku ?? ad.id,
    product_name: ad.linkedProductName,
    ad_spend: input.adCost,
    ad_sales: input.adSales,
    impressions: input.impressions,
    clicks: input.clicks,
    ctr: input.ctr,
    ad_sales_count: input.adConversionSalesCount,
    ad_order_count: input.adConversionOrderCount,
    roas: input.roas,
    conversion_rate: input.conversionRate,
    remark: input.remark.trim() || null
  };
}
```

- [ ] **Step 3: Add a focused test for the payload helper**

```ts
const payload = buildDailyRecordPayload({
  adId: "4locks-full-blackout-honeycomb",
  date: "2026-06-27",
  adCost: 10000,
  adSales: 50000,
  impressions: 1200,
  clicks: 44,
  ctr: 3.67,
  adConversionSalesCount: 9,
  adConversionOrderCount: 5,
  roas: 500,
  conversionRate: 11.36,
  remark: "manual"
});

assert.equal(payload.campaign_name, CORE_ADS[0].adName);
assert.equal(payload.sku, CORE_ADS[0].linkedSku);
assert.equal(payload.product_name, CORE_ADS[0].linkedProductName);
assert.equal(payload.record_date, "2026-06-27");
```

- [ ] **Step 4: Run the advertising tests**

Run: `node --experimental-strip-types src/lib/advertising.test.mts`
Expected: `advertising tests passed`

### Task 3: Extend the advertising hook with CRUD for manual daily records

**Files:**
- Modify: `src/components/advertising/useAdvertisingData.ts`

- [ ] **Step 1: Add a dedicated hook for daily records CRUD**

```ts
function useAdvertisingDailyRecords() {
  const [records, setRecords] = useState<AdvertisingDailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
```

- [ ] **Step 2: Keep the loader reading `advertising_daily_records` and normalizing with the existing helper**

```ts
const { data, error } = await supabase
  .from("advertising_daily_records")
  .select("*")
  .order("record_date", { ascending: false })
  .order("created_at", { ascending: false });

const rows = ((data as LegacyAdvertisingDailyRecord[] | null) ?? []).map(normalizeLegacyDailyMetric);
setRecords(mergeWithDemoMetrics(error ? [] : rows));
```

- [ ] **Step 3: Add save logic using upsert with the unique key columns**

```ts
const payload = { user_id: auth.user.id, ...buildDailyRecordPayload(input) };
const { error: upsertError } = await supabase
  .from("advertising_daily_records")
  .upsert(payload, { onConflict: "user_id,record_date,campaign_name" });
```

- [ ] **Step 4: Add delete logic for an existing row**

```ts
const { error: deleteError } = await supabase
  .from("advertising_daily_records")
  .delete()
  .eq("id", id);
```

- [ ] **Step 5: Return the CRUD API to the dashboard consumers**

```ts
return {
  records,
  loading,
  saving,
  error,
  reload,
  saveRecord,
  deleteRecord
};
```

### Task 4: Build the manual entry UI on the import page

**Files:**
- Modify: `src/components/advertising/AdvertisingUi.tsx`

- [ ] **Step 1: Replace the current placeholder import section with a real form shell**

```tsx
<section className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
  <div className="erp-card p-6">
    <SectionTitle
      eyebrow="每日录入"
      title="每日广告数据录入"
      description="每天直接在 ERP 中填写广告日报。系统会按日期和广告名称自动覆盖同一条记录。"
    />
  </div>
```

- [ ] **Step 2: Add a controlled form bound to `AdvertisingDailyRecordInput`**

```tsx
const emptyInput: AdvertisingDailyRecordInput = {
  adId: CORE_ADS[0].id,
  date: todayKst(),
  adCost: 0,
  adSales: 0,
  impressions: 0,
  clicks: 0,
  ctr: 0,
  adConversionSalesCount: 0,
  adConversionOrderCount: 0,
  roas: 0,
  conversionRate: 0,
  remark: ""
};
```

- [ ] **Step 3: Add save, edit, and cancel flows**

```tsx
const [input, setInput] = useState<AdvertisingDailyRecordInput>(emptyInput);
const [editingId, setEditingId] = useState<string | null>(null);

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const result = await recordsCrud.saveRecord(input);
  if (!result.ok) return;
  setEditingId(null);
  setInput(emptyInput);
}
```

- [ ] **Step 4: Show a saved-record list with edit and delete actions**

```tsx
{recordsCrud.records
  .filter((row) => row.source !== "seed")
  .slice(0, 12)
  .map((row) => (
    <button type="button" onClick={() => startEdit(row)}>
      编辑
    </button>
  ))}
```

- [ ] **Step 5: Keep labels and helper copy aligned with the homepage language polish**

```tsx
<div className="rounded-2xl border border-dashed border-line bg-[#fafaf9] px-4 py-4 text-sm text-muted">
  同一天 + 同一个广告名称只能保留一条记录。再次保存时，系统会自动更新这条日报。
</div>
```

### Task 5: Verify end to end

**Files:**
- Modify: `docs/superpowers/plans/2026-06-27-advertising-daily-manual-entry.md`

- [ ] **Step 1: Run the focused advertising tests**

Run: `node --experimental-strip-types src/lib/advertising.test.mts`
Expected: `advertising tests passed`

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Next.js build completes successfully

- [ ] **Step 3: Review git diff for only the intended feature files**

Run: `git status --short`
Expected: advertising UI, hook, helper, type, docs, and Supabase migration changes only
