create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ad_name text not null,
  ad_name_kr text not null,
  ad_type text not null default 'search',
  platform text not null default 'coupang',
  status text not null default 'running',
  linked_campaign_name text,
  linked_product_name text,
  linked_sku text,
  start_date date,
  end_date date,
  daily_budget numeric(14, 2) not null default 0,
  target_roas numeric(10, 2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ad_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ad_id uuid references ads(id) on delete cascade,
  date date not null,
  ad_cost numeric(14, 2) not null default 0,
  ad_sales numeric(14, 2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(10, 4),
  conversion_rate numeric(10, 4),
  ad_conversion_sales_count integer not null default 0,
  ad_conversion_order_count integer not null default 0,
  roas numeric(10, 4),
  cpc numeric(14, 2),
  cpa numeric(14, 2),
  raw_payload jsonb,
  source text not null default 'manual_import',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ad_sku_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ad_id uuid references ads(id) on delete cascade,
  sku_id uuid,
  sku_code text not null,
  product_name_cn text,
  product_name_kr text,
  date date not null,
  ad_cost numeric(14, 2) not null default 0,
  ad_sales numeric(14, 2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(10, 4),
  conversion_rate numeric(10, 4),
  sales_quantity integer not null default 0,
  order_count integer not null default 0,
  roas numeric(10, 4),
  gross_profit numeric(14, 2) not null default 0,
  profit_after_ads numeric(14, 2) not null default 0,
  suggestion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ad_daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ad_id uuid references ads(id) on delete cascade,
  date date not null,
  operator text,
  observation text,
  action_taken text,
  budget_change text,
  bid_change text,
  sku_change text,
  issue text,
  next_plan text,
  attachments jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ad_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  rule_name text not null,
  metric text not null,
  operator text not null,
  threshold numeric(14, 4) not null,
  severity text not null default 'info',
  recommendation text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
