create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists product_analysis_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_product_id uuid references products(id) on delete set null,
  product_name text not null,
  sku text not null,
  product_series text,
  phase text not null default 'new_test' check (phase in ('existing', 'new_test', 'hero', 'watch', 'problem', 'retire')),
  coupang_url text,
  cost numeric(14, 2) not null default 0,
  sale_price numeric(14, 2) not null default 0,
  target_margin_rate numeric(8, 2) not null default 25,
  status text not null default 'active' check (status in ('active', 'testing', 'optimizing', 'paused', 'retired')),
  owner text,
  test_start_date date,
  test_goal text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

create table if not exists product_analysis_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_item_id uuid not null references product_analysis_items(id) on delete cascade,
  note_date date not null default current_date,
  note_type text not null default 'review' check (note_type in ('review', 'test', 'ad', 'stock', 'issue', 'decision')),
  title text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_test_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_item_id uuid not null references product_analysis_items(id) on delete cascade,
  metric_date date not null,
  test_stage text not null default 'testing' check (test_stage in ('pretest', 'testing', 'scale', 'optimize', 'stop')),
  daily_sales_qty integer not null default 0,
  daily_ad_spend numeric(14, 2) not null default 0,
  daily_ad_sales numeric(14, 2) not null default 0,
  conversion_signal text,
  issue_signal text,
  decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, analysis_item_id, metric_date)
);

create table if not exists competitor_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_item_id uuid not null references product_analysis_items(id) on delete cascade,
  competitor_name text,
  product_url text,
  price numeric(14, 2) not null default 0,
  rating numeric(5, 2),
  review_count integer not null default 0,
  key_selling_points text,
  risk_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_analysis_items_user_phase_idx
  on product_analysis_items (user_id, phase, status);

create index if not exists product_analysis_items_user_sku_idx
  on product_analysis_items (user_id, sku);

create index if not exists product_analysis_notes_item_date_idx
  on product_analysis_notes (analysis_item_id, note_date desc);

create index if not exists product_test_metrics_item_date_idx
  on product_test_metrics (analysis_item_id, metric_date desc);

create index if not exists competitor_products_item_idx
  on competitor_products (analysis_item_id);

drop trigger if exists product_analysis_items_updated_at on product_analysis_items;
create trigger product_analysis_items_updated_at before update on product_analysis_items
for each row execute function set_updated_at();

drop trigger if exists product_analysis_notes_updated_at on product_analysis_notes;
create trigger product_analysis_notes_updated_at before update on product_analysis_notes
for each row execute function set_updated_at();

drop trigger if exists product_test_metrics_updated_at on product_test_metrics;
create trigger product_test_metrics_updated_at before update on product_test_metrics
for each row execute function set_updated_at();

drop trigger if exists competitor_products_updated_at on competitor_products;
create trigger competitor_products_updated_at before update on competitor_products
for each row execute function set_updated_at();

alter table product_analysis_items enable row level security;
alter table product_analysis_notes enable row level security;
alter table product_test_metrics enable row level security;
alter table competitor_products enable row level security;

drop policy if exists "product analysis items owner access" on product_analysis_items;
create policy "product analysis items owner access" on product_analysis_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "product analysis notes owner access" on product_analysis_notes;
create policy "product analysis notes owner access" on product_analysis_notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "product test metrics owner access" on product_test_metrics;
create policy "product test metrics owner access" on product_test_metrics
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "competitor products owner access" on competitor_products;
create policy "competitor products owner access" on competitor_products
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
