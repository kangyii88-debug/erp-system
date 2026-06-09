create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists competitor_product_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'Coupang',
  product_url text not null,
  product_id text,
  product_name text not null,
  brand text,
  seller_name text,
  main_image_url text,
  category text,
  collected_at date not null default current_date,
  last_checked_at date,
  product_status text not null default 'watching' check (product_status in ('watching', 'key_competitor', 'best_reference', 'eliminated')),
  current_price numeric(14, 2) not null default 0,
  original_price numeric(14, 2) not null default 0,
  discount_rate numeric(8, 2) not null default 0,
  monthly_sales_text text,
  review_count integer not null default 0,
  rating numeric(5, 2) not null default 0 check (rating >= 0 and rating <= 5),
  rocket_type text not null default 'normal' check (rocket_type in ('normal', 'rocket_delivery', 'rocket_growth', 'seller_rocket', 'orange_rocket')),
  shipping_fee numeric(14, 2) not null default 0,
  delivery_time text,
  product_series text,
  size text,
  color text,
  material text,
  installation_method text,
  package_contents text,
  unit_weight text,
  package_size text,
  option_count integer not null default 0,
  title_keywords text,
  main_image_selling_points text,
  detail_page_selling_points text,
  price_advantage text,
  positive_review_points text,
  negative_review_points text,
  purchase_reasons text,
  learnings text,
  risks text,
  matched_our_sku text,
  our_price numeric(14, 2) not null default 0,
  competitor_price numeric(14, 2) not null default 0,
  price_gap numeric(14, 2) generated always as (coalesce(our_price, 0) - coalesce(competitor_price, 0)) stored,
  our_advantages text,
  our_disadvantages text,
  worth_following boolean not null default false,
  follow_priority text not null default 'medium' check (follow_priority in ('high', 'medium', 'low')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists competitor_product_library_user_status_idx
  on competitor_product_library (user_id, product_status, follow_priority);

create index if not exists competitor_product_library_user_category_idx
  on competitor_product_library (user_id, category);

create index if not exists competitor_product_library_user_rocket_idx
  on competitor_product_library (user_id, rocket_type);

create index if not exists competitor_product_library_user_collected_idx
  on competitor_product_library (user_id, collected_at desc);

drop trigger if exists competitor_product_library_updated_at on competitor_product_library;
create trigger competitor_product_library_updated_at before update on competitor_product_library
for each row execute function set_updated_at();

alter table competitor_product_library enable row level security;

drop policy if exists "competitor product library owner access" on competitor_product_library;
create policy "competitor product library owner access" on competitor_product_library
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
