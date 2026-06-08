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
