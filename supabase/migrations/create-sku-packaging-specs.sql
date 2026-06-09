create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists sku_category_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists sku_packaging_specs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_series text not null,
  sku text not null,
  product_name text not null,
  color text,
  size text,
  product_status text not null default 'active' check (product_status in ('active', 'paused', 'pending_listing', 'discontinued')),
  unit_length_cm numeric(12, 2),
  unit_width_cm numeric(12, 2),
  unit_height_cm numeric(12, 2),
  unit_cbm numeric(14, 6) generated always as (
    round(((coalesce(unit_length_cm, 0) * coalesce(unit_width_cm, 0) * coalesce(unit_height_cm, 0)) / 1000000.0)::numeric, 6)
  ) stored,
  unit_weight_kg numeric(12, 3),
  carton_length_cm numeric(12, 2),
  carton_width_cm numeric(12, 2),
  carton_height_cm numeric(12, 2),
  carton_cbm numeric(14, 6) generated always as (
    round(((coalesce(carton_length_cm, 0) * coalesce(carton_width_cm, 0) * coalesce(carton_height_cm, 0)) / 1000000.0)::numeric, 6)
  ) stored,
  units_per_carton integer,
  carton_gross_weight_kg numeric(12, 3),
  carton_net_weight_kg numeric(12, 3),
  theoretical_carton_weight_kg numeric(12, 3) generated always as (
    round((coalesce(unit_weight_kg, 0) * coalesce(units_per_carton, 0))::numeric, 3)
  ) stored,
  coupang_barcode text,
  purchase_batch_no text,
  default_inbound_method text not null default 'parcel' check (default_inbound_method in ('parcel', 'milk_run', 'pallet', 'truck')),
  fragile boolean not null default false,
  overweight_flag boolean generated always as (coalesce(carton_gross_weight_kg, 0) >= 20) stored,
  oversize_flag boolean generated always as (
    ((coalesce(carton_length_cm, 0) * coalesce(carton_width_cm, 0) * coalesce(carton_height_cm, 0)) / 1000000.0) >= 0.18
    or greatest(coalesce(carton_length_cm, 0), coalesce(carton_width_cm, 0), coalesce(carton_height_cm, 0)) >= 120
  ) stored,
  completeness_status text generated always as (
    case
      when coalesce(unit_length_cm, 0) <= 0
        or coalesce(unit_width_cm, 0) <= 0
        or coalesce(unit_height_cm, 0) <= 0
        or coalesce(carton_length_cm, 0) <= 0
        or coalesce(carton_width_cm, 0) <= 0
        or coalesce(carton_height_cm, 0) <= 0
        or coalesce(units_per_carton, 0) <= 0 then 'missing_dimensions'
      when coalesce(unit_weight_kg, 0) <= 0
        or coalesce(carton_gross_weight_kg, 0) <= 0
        or coalesce(carton_net_weight_kg, 0) <= 0 then 'missing_weight'
      when coalesce(carton_gross_weight_kg, 0) >= 20 then 'suspected_overweight'
      when ((coalesce(carton_length_cm, 0) * coalesce(carton_width_cm, 0) * coalesce(carton_height_cm, 0)) / 1000000.0) >= 0.18
        or greatest(coalesce(carton_length_cm, 0), coalesce(carton_width_cm, 0), coalesce(carton_height_cm, 0)) >= 120 then 'suspected_oversize'
      else 'complete'
    end
  ) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

create index if not exists sku_category_series_user_status_idx
  on sku_category_series (user_id, status, sort_order);

create index if not exists sku_packaging_specs_user_sku_idx
  on sku_packaging_specs (user_id, sku);

create index if not exists sku_packaging_specs_user_category_idx
  on sku_packaging_specs (user_id, category_series);

create index if not exists sku_packaging_specs_user_status_idx
  on sku_packaging_specs (user_id, product_status);

drop trigger if exists sku_category_series_updated_at on sku_category_series;
create trigger sku_category_series_updated_at before update on sku_category_series
for each row execute function set_updated_at();

drop trigger if exists sku_packaging_specs_updated_at on sku_packaging_specs;
create trigger sku_packaging_specs_updated_at before update on sku_packaging_specs
for each row execute function set_updated_at();

alter table sku_category_series enable row level security;
alter table sku_packaging_specs enable row level security;

drop policy if exists "sku category series owner access" on sku_category_series;
create policy "sku category series owner access" on sku_category_series
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sku packaging specs owner access" on sku_packaging_specs;
create policy "sku packaging specs owner access" on sku_packaging_specs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
