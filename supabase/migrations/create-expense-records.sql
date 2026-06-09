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

drop trigger if exists expense_records_updated_at on expense_records;
create trigger expense_records_updated_at before update on expense_records
for each row execute function set_updated_at();

alter table expense_records enable row level security;

drop policy if exists "expenses owner access" on expense_records;
create policy "expenses owner access" on expense_records
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('expense-attachments', 'expense-attachments', true)
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
