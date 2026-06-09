create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists product_test_database (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_image_url text,
  product_name text not null,
  category text,
  coupang_url text,
  selling_price_krw numeric(14, 2) not null default 0,
  analysis_date date not null default current_date,
  estimated_monthly_sales integer not null default 0,
  estimated_monthly_revenue_krw numeric(14, 2) generated always as (
    coalesce(selling_price_krw, 0) * coalesce(estimated_monthly_sales, 0)
  ) stored,
  purchase_price_cny numeric(14, 2) not null default 0,
  international_shipping_cny numeric(14, 2) not null default 0,
  landed_cost_cny numeric(14, 2) generated always as (
    coalesce(purchase_price_cny, 0) + coalesce(international_shipping_cny, 0)
  ) stored,
  exchange_rate numeric(10, 4) not null default 220,
  landed_cost_krw numeric(14, 2) generated always as (
    (coalesce(purchase_price_cny, 0) + coalesce(international_shipping_cny, 0)) * coalesce(exchange_rate, 0)
  ) stored,
  expected_selling_price_krw numeric(14, 2) not null default 0,
  platform_commission_rate numeric(8, 4) not null default 11.9,
  platform_commission_krw numeric(14, 2) generated always as (
    coalesce(expected_selling_price_krw, 0) * coalesce(platform_commission_rate, 0) / 100
  ) stored,
  korean_shipping_fee_krw numeric(14, 2) not null default 500,
  ad_cost_krw numeric(14, 2) not null default 500,
  total_cost_krw numeric(14, 2) generated always as (
    ((coalesce(purchase_price_cny, 0) + coalesce(international_shipping_cny, 0)) * coalesce(exchange_rate, 0))
    + (coalesce(expected_selling_price_krw, 0) * coalesce(platform_commission_rate, 0) / 100)
    + coalesce(korean_shipping_fee_krw, 0)
    + coalesce(ad_cost_krw, 0)
  ) stored,
  profit_krw numeric(14, 2) generated always as (
    coalesce(expected_selling_price_krw, 0)
    - (
      ((coalesce(purchase_price_cny, 0) + coalesce(international_shipping_cny, 0)) * coalesce(exchange_rate, 0))
      + (coalesce(expected_selling_price_krw, 0) * coalesce(platform_commission_rate, 0) / 100)
      + coalesce(korean_shipping_fee_krw, 0)
      + coalesce(ad_cost_krw, 0)
    )
  ) stored,
  profit_margin numeric(10, 4) generated always as (
    case
      when coalesce(expected_selling_price_krw, 0) <= 0 then 0
      else (
        coalesce(expected_selling_price_krw, 0)
        - (
          ((coalesce(purchase_price_cny, 0) + coalesce(international_shipping_cny, 0)) * coalesce(exchange_rate, 0))
          + (coalesce(expected_selling_price_krw, 0) * coalesce(platform_commission_rate, 0) / 100)
          + coalesce(korean_shipping_fee_krw, 0)
          + coalesce(ad_cost_krw, 0)
        )
      ) / coalesce(expected_selling_price_krw, 0) * 100
    end
  ) stored,
  supplier_url text,
  development_status text not null default 'pending_analysis' check (development_status in ('pending_analysis', 'analyzed', 'sampled', 'quoted', 'testing', 'ready_launch', 'listed', 'abandoned')),
  recommendation_grade text not null default 'B' check (recommendation_grade in ('A_PLUS', 'A', 'B', 'C', 'D')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_test_database_user_status_idx
  on product_test_database (user_id, development_status, recommendation_grade, priority);

create index if not exists product_test_database_user_category_idx
  on product_test_database (user_id, category);

create index if not exists product_test_database_user_analysis_date_idx
  on product_test_database (user_id, analysis_date desc);

drop trigger if exists product_test_database_updated_at on product_test_database;
create trigger product_test_database_updated_at before update on product_test_database
for each row execute function set_updated_at();

alter table product_test_database enable row level security;

drop policy if exists "product test database owner access" on product_test_database;
create policy "product test database owner access" on product_test_database
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
