create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists tax_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  tax_type text not null,
  due_date date not null,
  period_label text,
  status text not null default 'upcoming',
  priority text not null default 'normal',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tax_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  period_start date,
  period_end date,
  sales_amount numeric(14, 2) not null default 0,
  purchase_amount numeric(14, 2) not null default 0,
  input_tax numeric(14, 2) not null default 0,
  output_tax numeric(14, 2) not null default 0,
  estimated_tax numeric(14, 2) not null default 0,
  paid_amount numeric(14, 2) not null default 0,
  status text not null default 'draft',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_name text not null,
  payroll_month date not null,
  salary numeric(14, 2) not null default 0,
  bonus numeric(14, 2) not null default 0,
  national_pension numeric(14, 2) not null default 0,
  health_insurance numeric(14, 2) not null default 0,
  employment_insurance numeric(14, 2) not null default 0,
  industrial_accident_insurance numeric(14, 2) not null default 0,
  payment_status text not null default 'pending',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  due_date date not null,
  status text not null default 'pending',
  risk_level text not null default 'normal',
  owner text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tax_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_name text not null,
  category text not null,
  file_url text,
  file_type text,
  document_date date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tax_calendar_user_due_idx on tax_calendar (user_id, due_date);
create index if not exists tax_records_user_type_period_idx on tax_records (user_id, record_type, period_start);
create index if not exists payroll_records_user_month_idx on payroll_records (user_id, payroll_month desc);
create index if not exists compliance_tasks_user_due_idx on compliance_tasks (user_id, due_date, status);
create index if not exists tax_documents_user_category_idx on tax_documents (user_id, category, document_date desc);

drop trigger if exists tax_calendar_updated_at on tax_calendar;
create trigger tax_calendar_updated_at before update on tax_calendar for each row execute function set_updated_at();
drop trigger if exists tax_records_updated_at on tax_records;
create trigger tax_records_updated_at before update on tax_records for each row execute function set_updated_at();
drop trigger if exists payroll_records_updated_at on payroll_records;
create trigger payroll_records_updated_at before update on payroll_records for each row execute function set_updated_at();
drop trigger if exists compliance_tasks_updated_at on compliance_tasks;
create trigger compliance_tasks_updated_at before update on compliance_tasks for each row execute function set_updated_at();
drop trigger if exists tax_documents_updated_at on tax_documents;
create trigger tax_documents_updated_at before update on tax_documents for each row execute function set_updated_at();

alter table tax_calendar enable row level security;
alter table tax_records enable row level security;
alter table payroll_records enable row level security;
alter table compliance_tasks enable row level security;
alter table tax_documents enable row level security;

drop policy if exists "tax calendar owner access" on tax_calendar;
create policy "tax calendar owner access" on tax_calendar for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tax records owner access" on tax_records;
create policy "tax records owner access" on tax_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "payroll records owner access" on payroll_records;
create policy "payroll records owner access" on payroll_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "compliance tasks owner access" on compliance_tasks;
create policy "compliance tasks owner access" on compliance_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tax documents owner access" on tax_documents;
create policy "tax documents owner access" on tax_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
