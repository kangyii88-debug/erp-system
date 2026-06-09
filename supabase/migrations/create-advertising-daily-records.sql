create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists advertising_daily_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  campaign_name text not null,
  sku text not null,
  product_name text not null,
  ad_spend numeric(14, 2) not null default 0,
  ad_sales numeric(14, 2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(8, 2) not null default 0,
  ad_sales_count integer not null default 0,
  ad_order_count integer not null default 0,
  roas numeric(10, 4) not null default 0,
  conversion_rate numeric(8, 2) not null default 0,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertising_daily_records_user_date_idx
  on advertising_daily_records (user_id, record_date desc);

create index if not exists advertising_daily_records_user_sku_idx
  on advertising_daily_records (user_id, sku);

create index if not exists advertising_daily_records_user_campaign_idx
  on advertising_daily_records (user_id, campaign_name);

drop trigger if exists advertising_daily_records_updated_at on advertising_daily_records;
create trigger advertising_daily_records_updated_at before update on advertising_daily_records
for each row execute function set_updated_at();

alter table advertising_daily_records enable row level security;

drop policy if exists "advertising daily records owner access" on advertising_daily_records;
create policy "advertising daily records owner access" on advertising_daily_records
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
