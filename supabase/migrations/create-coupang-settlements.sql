create table if not exists coupang_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

create trigger coupang_settlements_updated_at before update on coupang_settlements
for each row execute function set_updated_at();

alter table coupang_settlements enable row level security;

drop policy if exists "coupang settlements owner access" on coupang_settlements;
create policy "coupang settlements owner access" on coupang_settlements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('settlement-attachments', 'settlement-attachments', true)
on conflict (id) do nothing;

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
