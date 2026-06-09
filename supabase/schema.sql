create extension if not exists "pgcrypto";

create type platform_type as enum ('Coupang', 'Naver', '11st', 'Gmarket', 'Other');
create type movement_type as enum ('purchase', 'sale', 'return_resell', 'damaged', 'lost', 'adjustment');
create type production_status as enum ('pending', 'producing', 'completed', 'delayed', 'cancelled');
create type shipping_status as enum ('not_shipped', 'shipped_from_china', 'customs', 'in_korea', 'received');

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sku text not null,
  color text,
  size text,
  purchase_price numeric(12, 2) not null default 0,
  sale_price numeric(12, 2) not null default 0,
  platform_fee_rate numeric(5, 2) not null default 11.6,
  international_shipping_cost numeric(12, 2) not null default 0,
  coupang_inbound_shipping_cost numeric(12, 2) not null default 0,
  ad_cost numeric(12, 2) not null default 0,
  platform platform_type not null default 'Coupang',
  low_stock_threshold integer not null default 10,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

create table if not exists inventory_balances (
  product_id uuid primary key references products(id) on delete cascade,
  current_stock integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  type movement_type not null,
  quantity integer not null check (quantity <> 0),
  happened_at timestamptz not null default now(),
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text,
  memo text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  factory_name text not null,
  quantity integer not null check (quantity > 0),
  production_status production_status not null default 'pending',
  shipping_status shipping_status not null default 'not_shipped',
  expected_arrival_date date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sale_date date not null,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id, sale_date)
);

create table if not exists coupang_inbound_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  inbound_date date not null,
  sku text not null,
  product_name text not null,
  box_count integer not null default 0,
  units_per_box integer not null default 0,
  confirmed_quantity integer not null default 0,
  inbound_method text not null default 'parcel',
  outbound_location text not null default 'warehouse',
  milk_run_type text,
  reservation_number text,
  receive_status text not null default 'pending',
  discrepancy_status text not null default 'normal',
  application_date date,
  expected_inbound_date date,
  purchase_batch_no text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  category text not null,
  expense_name text not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  vendor text,
  payment_method text,
  owner text,
  remark text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists coupang_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sales_month date,
  settlement_month date not null,
  sales_amount numeric(14, 2) not null default 0,
  cancel_amount numeric(14, 2) not null default 0,
  actual_sales_amount numeric(14, 2) not null default 0,
  sales_fee numeric(14, 2) not null default 0,
  seller_coupon numeric(14, 2) not null default 0,
  milk_run_fee numeric(14, 2) not null default 0,
  ad_fee numeric(14, 2) not null default 0,
  settlement_deduction numeric(14, 2) not null default 0,
  fulfillment_fee numeric(14, 2) not null default 0,
  inventory_loss_compensation numeric(14, 2) not null default 0,
  final_payment_amount numeric(14, 2) not null default 0,
  cancel_rate numeric(8, 4) not null default 0,
  fee_rate numeric(8, 4) not null default 0,
  ad_rate numeric(8, 4) not null default 0,
  payment_rate numeric(8, 4) not null default 0,
  remark text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, settlement_month)
);

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

create index if not exists tasks_user_due_status_idx on tasks (user_id, due_date, status);
create index if not exists product_development_user_status_idx on product_development (user_id, development_status, priority);
create index if not exists customer_issues_user_date_category_idx on customer_issues (user_id, issue_date, issue_category);
create index if not exists customer_issues_user_sku_idx on customer_issues (user_id, sku);
create index if not exists advertising_campaigns_user_date_idx on advertising_campaigns (user_id, record_date desc);
create index if not exists advertising_campaigns_user_campaign_idx on advertising_campaigns (user_id, campaign_name);
create index if not exists advertising_campaigns_user_sku_idx on advertising_campaigns (user_id, sku);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at before update on products
for each row execute function set_updated_at();

create trigger purchase_orders_updated_at before update on purchase_orders
for each row execute function set_updated_at();

create trigger coupang_inbound_records_updated_at before update on coupang_inbound_records
for each row execute function set_updated_at();

create trigger expense_records_updated_at before update on expense_records
for each row execute function set_updated_at();

create trigger coupang_settlements_updated_at before update on coupang_settlements
for each row execute function set_updated_at();

create trigger tasks_updated_at before update on tasks
for each row execute function set_updated_at();

create trigger product_development_updated_at before update on product_development
for each row execute function set_updated_at();

create trigger customer_issues_updated_at before update on customer_issues
for each row execute function set_updated_at();

create trigger advertising_campaigns_updated_at before update on advertising_campaigns
for each row execute function set_updated_at();

create or replace function ensure_inventory_balance()
returns trigger language plpgsql as $$
begin
  insert into inventory_balances (product_id, current_stock)
  values (new.id, 0)
  on conflict (product_id) do nothing;
  return new;
end;
$$;

create trigger products_create_inventory after insert on products
for each row execute function ensure_inventory_balance();

create or replace function apply_stock_movement()
returns trigger language plpgsql as $$
declare
  signed_qty integer;
begin
  signed_qty := case
    when new.type::text in ('purchase', 'inbound', 'adjustment') then new.quantity
    when new.type::text in ('sale', 'outbound', 'damaged', 'lost', 'loss') then -new.quantity
    when new.type::text in ('return_resell', 'return_inbound') then 0
    else 0
  end;

  insert into inventory_balances (product_id, current_stock)
  values (new.product_id, greatest(0, signed_qty))
  on conflict (product_id) do update
    set current_stock = inventory_balances.current_stock + signed_qty,
        updated_at = now();

  if new.type::text = 'sale' then
    insert into sales_daily (user_id, product_id, sale_date, quantity)
    values (new.user_id, new.product_id, new.happened_at::date, new.quantity)
    on conflict (user_id, product_id, sale_date)
    do update set quantity = sales_daily.quantity + excluded.quantity;
  end if;

  return new;
end;
$$;

create trigger stock_movements_apply after insert on stock_movements
for each row execute function apply_stock_movement();

alter table products enable row level security;
alter table inventory_balances enable row level security;
alter table stock_movements enable row level security;
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table sales_daily enable row level security;
alter table coupang_inbound_records enable row level security;
alter table expense_records enable row level security;
alter table coupang_settlements enable row level security;
alter table tasks enable row level security;
alter table product_development enable row level security;
alter table customer_issues enable row level security;
alter table advertising_campaigns enable row level security;

create policy "products owner access" on products
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "inventory owner access" on inventory_balances
for all using (
  exists (select 1 from products p where p.id = product_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from products p where p.id = product_id and p.user_id = auth.uid())
);

create policy "movements owner access" on stock_movements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "suppliers owner access" on suppliers
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "purchases owner access" on purchase_orders
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sales owner access" on sales_daily
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "coupang inbound owner access" on coupang_inbound_records
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses owner access" on expense_records
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "coupang settlements owner access" on coupang_settlements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks owner access" on tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "product development owner access" on product_development
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "customer issues owner access" on customer_issues
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "advertising campaigns owner access" on advertising_campaigns
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values
  ('expense-attachments', 'expense-attachments', true),
  ('settlement-attachments', 'settlement-attachments', true)
on conflict (id) do nothing;

drop policy if exists "expense attachments owner read" on storage.objects;
create policy "expense attachments owner read" on storage.objects
for select using (
  bucket_id = 'expense-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "expense attachments owner insert" on storage.objects;
create policy "expense attachments owner insert" on storage.objects
for insert with check (
  bucket_id = 'expense-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "expense attachments owner update" on storage.objects;
create policy "expense attachments owner update" on storage.objects
for update using (
  bucket_id = 'expense-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
) with check (
  bucket_id = 'expense-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "expense attachments owner delete" on storage.objects;
create policy "expense attachments owner delete" on storage.objects
for delete using (
  bucket_id = 'expense-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "settlement attachments owner read" on storage.objects;
create policy "settlement attachments owner read" on storage.objects
for select using (
  bucket_id = 'settlement-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "settlement attachments owner insert" on storage.objects;
create policy "settlement attachments owner insert" on storage.objects
for insert with check (
  bucket_id = 'settlement-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "settlement attachments owner update" on storage.objects;
create policy "settlement attachments owner update" on storage.objects
for update using (
  bucket_id = 'settlement-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
) with check (
  bucket_id = 'settlement-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "settlement attachments owner delete" on storage.objects;
create policy "settlement attachments owner delete" on storage.objects
for delete using (
  bucket_id = 'settlement-attachments'
  and auth.uid()::text = split_part(name, '/', 1)
);
