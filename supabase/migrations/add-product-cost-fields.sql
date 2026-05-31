alter table products
  add column if not exists platform_fee_rate numeric(5, 2) not null default 11.6,
  add column if not exists international_shipping_cost numeric(12, 2) not null default 0,
  add column if not exists coupang_inbound_shipping_cost numeric(12, 2) not null default 0,
  add column if not exists ad_cost numeric(12, 2) not null default 0;
