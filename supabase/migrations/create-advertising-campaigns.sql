create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists advertising_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_name text not null,
  status text not null default 'running',
  budget numeric(14, 2) not null default 0,
  spend numeric(14, 2) not null default 0,
  sales numeric(14, 2) not null default 0,
  profit numeric(14, 2) not null default 0,
  orders integer not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  sku text,
  product_name text,
  record_date date not null default current_date,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertising_campaigns_user_date_idx on advertising_campaigns (user_id, record_date desc);
create index if not exists advertising_campaigns_user_campaign_idx on advertising_campaigns (user_id, campaign_name);
create index if not exists advertising_campaigns_user_sku_idx on advertising_campaigns (user_id, sku);

drop trigger if exists advertising_campaigns_updated_at on advertising_campaigns;
create trigger advertising_campaigns_updated_at before update on advertising_campaigns
for each row execute function set_updated_at();

alter table advertising_campaigns enable row level security;

drop policy if exists "advertising campaigns owner access" on advertising_campaigns;
create policy "advertising campaigns owner access" on advertising_campaigns
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
