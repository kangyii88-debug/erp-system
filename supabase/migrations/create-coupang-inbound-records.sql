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

create index if not exists coupang_inbound_records_user_inbound_date_idx
  on coupang_inbound_records(user_id, inbound_date desc);

create index if not exists coupang_inbound_records_product_idx
  on coupang_inbound_records(product_id);

alter table coupang_inbound_records enable row level security;

drop policy if exists "coupang inbound owner access" on coupang_inbound_records;
create policy "coupang inbound owner access" on coupang_inbound_records
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists coupang_inbound_records_updated_at on coupang_inbound_records;
create trigger coupang_inbound_records_updated_at before update on coupang_inbound_records
for each row execute function set_updated_at();
