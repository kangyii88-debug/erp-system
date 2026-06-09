create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_name text not null,
  task_type text not null,
  priority text not null default U&'P3 \666E\901A' check (priority in (U&'P1 \7D27\6025', U&'P2 \91CD\8981', U&'P3 \666E\901A', U&'P4 \4F4E')),
  owner text not null,
  due_date date not null,
  status text not null default U&'\5F85\5904\7406' check (status in (U&'\5F85\5904\7406', U&'\8FDB\884C\4E2D', U&'\5DF2\5B8C\6210', U&'\5DF2\53D6\6D88')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_development (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  product_image_url text,
  product_category text not null,
  supplier text,
  purchase_cost numeric(12, 2) not null default 0,
  expected_price numeric(12, 2) not null default 0,
  expected_margin numeric(8, 2),
  platform_fee_rate numeric(5, 2) not null default 11.6,
  international_shipping_cost numeric(12, 2) not null default 0,
  coupang_inbound_shipping_cost numeric(12, 2) not null default 0,
  ad_cost numeric(12, 2) not null default 0,
  owner text not null,
  development_status text not null default U&'\5F85\5F00\53D1' check (development_status in (U&'\5F85\5F00\53D1', U&'\8BE2\4EF7\4E2D', U&'\6253\6837\4E2D', U&'\6D4B\8BD5\4E2D', U&'\4F18\5316\4E2D', U&'\5F85\4E0A\67B6', U&'\5DF2\4E0A\7EBF', U&'\5DF2\653E\5F03')),
  expected_launch_date date,
  priority text not null default U&'B\7EA7' check (priority in (U&'S\7EA7', U&'A\7EA7', U&'B\7EA7', U&'C\7EA7')),
  market_potential_score integer not null default 0 check (market_potential_score between 0 and 100),
  competition_score integer not null default 0 check (competition_score between 0 and 100),
  supply_chain_score integer not null default 0 check (supply_chain_score between 0 and 100),
  profit_score integer not null default 0 check (profit_score between 0 and 100),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_date date not null,
  sku text not null,
  product_name text not null,
  issue_category text not null check (issue_category in (U&'\5B89\88C5\95EE\9898', U&'\8D28\91CF\95EE\9898', U&'\5C3A\5BF8\95EE\9898', U&'\989C\8272\95EE\9898', U&'\7269\6D41\95EE\9898', U&'\5305\88C5\95EE\9898', U&'\529F\80FD\95EE\9898', U&'\5176\5B83\95EE\9898')),
  issue_description text not null,
  customer_original_text text,
  solution text,
  owner text not null,
  status text not null default U&'\5F85\5904\7406' check (status in (U&'\5F85\5904\7406', U&'\5904\7406\4E2D', U&'\5DF2\89E3\51B3', U&'\5DF2\5173\95ED')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_issues add column if not exists customer_original_text text;
alter table product_development add column if not exists platform_fee_rate numeric(5, 2) not null default 11.6;
alter table product_development add column if not exists international_shipping_cost numeric(12, 2) not null default 0;
alter table product_development add column if not exists coupang_inbound_shipping_cost numeric(12, 2) not null default 0;
alter table product_development add column if not exists ad_cost numeric(12, 2) not null default 0;

create index if not exists tasks_user_due_status_idx on tasks (user_id, due_date, status);
create index if not exists product_development_user_status_idx on product_development (user_id, development_status, priority);
create index if not exists customer_issues_user_date_category_idx on customer_issues (user_id, issue_date, issue_category);
create index if not exists customer_issues_user_sku_idx on customer_issues (user_id, sku);

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks
for each row execute function set_updated_at();

drop trigger if exists product_development_updated_at on product_development;
create trigger product_development_updated_at before update on product_development
for each row execute function set_updated_at();

drop trigger if exists customer_issues_updated_at on customer_issues;
create trigger customer_issues_updated_at before update on customer_issues
for each row execute function set_updated_at();

alter table tasks enable row level security;
alter table product_development enable row level security;
alter table customer_issues enable row level security;

drop policy if exists "tasks owner access" on tasks;
create policy "tasks owner access" on tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "product development owner access" on product_development;
create policy "product development owner access" on product_development
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "customer issues owner access" on customer_issues;
create policy "customer issues owner access" on customer_issues
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
