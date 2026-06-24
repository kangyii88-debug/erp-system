create table if not exists purchase_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  batch_no text,
  sku text,
  product_name text,
  quantity integer not null check (quantity > 0),
  factory_name text,
  production_status production_status not null default 'pending',
  shipping_status shipping_status not null default 'not_shipped',
  expected_production_date date,
  expected_shipping_date date,
  expected_arrival_date date,
  actual_arrival_date date,
  logistics_company text,
  tracking_no text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger purchase_batches_updated_at before update on purchase_batches
for each row execute function set_updated_at();

alter table purchase_batches enable row level security;

create policy "purchase batches owner access" on purchase_batches
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists purchase_batches_order_idx on purchase_batches(purchase_order_id);
create index if not exists purchase_batches_sku_idx on purchase_batches(sku);
