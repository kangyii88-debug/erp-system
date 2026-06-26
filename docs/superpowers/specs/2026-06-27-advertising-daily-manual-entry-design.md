# Advertising Daily Manual Entry Design

## Goal

Add an ERP-native daily advertising entry workflow so the operator can manually record one daily data row per ad, update the same row later in the day, and have the homepage, ad detail pages, trend charts, rankings, and notes continue to reflect the same shared data source.

## Scope

This design only covers manual daily entry for the advertising intelligence center.

- Entry method: fill data directly inside the ERP
- Granularity: one row per day per ad
- Conflict rule: the same `record_date + campaign_name` must resolve to one row, not duplicates
- Result: newly saved data must flow into the existing `advertising_daily_records` readers

This design does not add CSV upload, Excel upload, background sync, or API ingestion.

## User Flow

1. Open `广告智能中心 / 数据导入与同步`
2. See a `每日广告数据录入` form instead of a passive mapping-only placeholder
3. Pick a date
4. Pick an ad name from the existing ad catalog
5. Fill core Coupang daily metrics
6. Click save
7. If the same day and ad already exist, the system updates the existing row instead of creating a duplicate
8. See the saved row immediately in a “今日已录入记录” list with edit and delete actions
9. Return to the advertising overview and see all KPI cards and trend modules updated from the same data source

## Data Model

Existing table: `advertising_daily_records`

Current table already stores most required fields, so this feature will reuse it instead of creating a new table.

Required rule:

- Add a unique database constraint for `user_id + record_date + campaign_name`

Storage mapping:

- `record_date`: selected business date
- `campaign_name`: selected ad name
- `sku`: derived from the selected ad metadata when possible, otherwise fallback to ad id
- `product_name`: derived from selected ad metadata
- `ad_spend`: manual input
- `ad_sales`: manual input for advertising attributed sales
- `impressions`: manual input
- `clicks`: manual input
- `ctr`: manually entered value, with recalculation fallback if left blank in future refactors
- `ad_sales_count`: manual input for advertising conversion sales count
- `ad_order_count`: manual input for advertising conversion order count
- `roas`: manual input
- `conversion_rate`: manual input
- `remark`: optional operator note for that day’s raw ad row

## Application Architecture

The feature should extend the current advertising module instead of introducing a separate subsystem.

### Frontend

`src/components/advertising/AdvertisingUi.tsx`

- Replace the current import placeholder content with a real manual-entry workspace
- Add:
  - a form component for daily metric entry
  - a saved-record list component
  - edit and delete actions
  - a compact explanation of the one-row-per-day rule

### Data hooks

`src/components/advertising/useAdvertisingData.ts`

- Continue loading `advertising_daily_records` for all overview modules
- Add CRUD helpers for manual metrics:
  - load records
  - create/update with upsert semantics
  - delete row
- Keep the existing note CRUD separate

### Domain helpers

`src/lib/advertising.ts`

- Add helpers that:
  - build a manual entry payload from form input and ad metadata
  - normalize row selection for the manual entry list
  - keep calculations and defaults consistent with the current ad summary code

### Types

`src/lib/advertising-types.ts`

- Add dedicated types for:
  - manual entry form state
  - raw daily record row if needed
  - CRUD result objects if shared between components

## UX Design

The manual entry page should feel operational, not like a developer placeholder.

- Left side: entry form
- Right side or lower section: today’s saved records
- Primary CTA: save/update daily data
- Secondary CTA when editing: cancel
- Delete stays on the saved row card or table row

Form fields for v1:

- 日期
- 广告名称
- 广告费
- 广告转化销售额
- 曝光数
- 点击数
- 点击率
- 广告转化销售数量
- 广告转化订单数
- ROAS
- 转化率
- 备注

The ad name select must come from `CORE_ADS` so the user never types campaign names inconsistently.

## Error Handling

- If the user is not logged in, block save and show a clear message
- If Supabase save fails, show the database error inline
- If unique conflict occurs, resolve by upsert instead of surfacing a duplicate-row failure
- If loading fails, the saved-record list should show a readable error state instead of silently disappearing

## Testing

Add targeted tests for:

- payload generation from selected ad metadata
- row normalization still producing the expected `AdvertisingDailyMetric`
- uniqueness behavior assumptions in the client-side save flow

Run:

- `node --experimental-strip-types src/lib/advertising.test.mts`
- `npm run build`

## Success Criteria

- Operator can manually add one daily record from the ERP UI
- Saving the same day and same ad updates the existing row instead of creating a duplicate
- Saved rows appear immediately in the advertising manual entry panel
- Overview cards, detail pages, rankings, and trend charts read the saved row without extra wiring
