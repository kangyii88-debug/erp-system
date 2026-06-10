alter table competitor_product_library
  add column if not exists product_name_kr text,
  add column if not exists product_name_cn text,
  add column if not exists coupang_product_id text,
  add column if not exists coupang_url text,
  add column if not exists image_url text,
  add column if not exists store_name text,
  add column if not exists monthly_sales integer not null default 0,
  add column if not exists kc_risk_level text not null default 'low',
  add column if not exists volume_level text not null default 'small',
  add column if not exists weight_level text not null default 'light',
  add column if not exists fragile_risk text not null default 'low',
  add column if not exists return_risk text not null default 'low',
  add column if not exists competition_level text not null default 'medium',
  add column if not exists similar_product_count integer not null default 0,
  add column if not exists brand_monopoly_level text not null default 'medium',
  add column if not exists estimated_purchase_price numeric(14, 2) not null default 0,
  add column if not exists estimated_logistics_cost numeric(14, 2) not null default 0,
  add column if not exists coupang_fee_rate numeric(8, 2) not null default 11.9,
  add column if not exists estimated_ad_cost numeric(14, 2) not null default 0,
  add column if not exists estimated_profit numeric(14, 2) not null default 0,
  add column if not exists estimated_profit_rate numeric(8, 2) not null default 0,
  add column if not exists recommendation_score numeric(4, 1) not null default 0,
  add column if not exists test_recommended boolean not null default false,
  add column if not exists suggested_test_quantity integer not null default 0,
  add column if not exists priority text not null default 'medium',
  add column if not exists status text not null default 'pending_analysis',
  add column if not exists recommendation_reason text,
  add column if not exists risk_points text,
  add column if not exists china_sourcing_fit boolean not null default true,
  add column if not exists branding_fit boolean not null default false,
  add column if not exists next_action text,
  add column if not exists test_status text not null default 'not_added',
  add column if not exists test_owner text,
  add column if not exists planned_launch_date date,
  add column if not exists target_price numeric(14, 2) not null default 0;

update competitor_product_library
set
  product_name_kr = coalesce(product_name_kr, product_name),
  coupang_product_id = coalesce(coupang_product_id, product_id),
  coupang_url = coalesce(coupang_url, product_url),
  image_url = coalesce(image_url, main_image_url),
  store_name = coalesce(store_name, seller_name),
  monthly_sales = case
    when coalesce(monthly_sales, 0) > 0 then monthly_sales
    when monthly_sales_text is null then 0
    else coalesce(nullif(regexp_replace(monthly_sales_text, '[^0-9]', '', 'g'), '')::integer, 0)
  end,
  status = case
    when status is not null and status <> '' and status <> 'pending_analysis' then status
    when product_status = 'key_competitor' then 'key_product'
    when product_status = 'best_reference' then 'ready_test'
    when product_status = 'eliminated' then 'eliminated'
    else 'pending_analysis'
  end,
  priority = case
    when priority is null or priority = '' or priority = 'medium' then coalesce(follow_priority, 'medium')
    else priority
  end;

do $$
begin
  alter table competitor_product_library drop constraint if exists competitor_product_library_product_status_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_follow_priority_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_status_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_priority_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_kc_risk_level_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_volume_level_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_weight_level_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_fragile_risk_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_return_risk_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_competition_level_check;
  alter table competitor_product_library drop constraint if exists competitor_product_library_brand_monopoly_level_check;
exception
  when undefined_object then null;
end $$;

alter table competitor_product_library
  add constraint competitor_product_library_product_status_check
    check (product_status in ('watching', 'key_competitor', 'best_reference', 'eliminated')),
  add constraint competitor_product_library_follow_priority_check
    check (follow_priority in ('high', 'medium', 'low')),
  add constraint competitor_product_library_status_check
    check (status in ('pending_analysis', 'key_product', 'eliminated', 'ready_test', 'tested')),
  add constraint competitor_product_library_priority_check
    check (priority in ('high', 'medium', 'low')),
  add constraint competitor_product_library_kc_risk_level_check
    check (kc_risk_level in ('low', 'medium', 'high')),
  add constraint competitor_product_library_volume_level_check
    check (volume_level in ('small', 'medium', 'large')),
  add constraint competitor_product_library_weight_level_check
    check (weight_level in ('light', 'medium', 'heavy')),
  add constraint competitor_product_library_fragile_risk_check
    check (fragile_risk in ('low', 'medium', 'high')),
  add constraint competitor_product_library_return_risk_check
    check (return_risk in ('low', 'medium', 'high')),
  add constraint competitor_product_library_competition_level_check
    check (competition_level in ('low', 'medium', 'high')),
  add constraint competitor_product_library_brand_monopoly_level_check
    check (brand_monopoly_level in ('low', 'medium', 'high'));

create index if not exists competitor_product_library_user_decision_idx
  on competitor_product_library (user_id, status, recommendation_score desc, test_recommended);

create index if not exists competitor_product_library_user_risk_idx
  on competitor_product_library (user_id, kc_risk_level, volume_level, weight_level, competition_level);
