alter table product_development add column if not exists platform_fee_rate numeric(5, 2) not null default 11.6;
alter table product_development add column if not exists international_shipping_cost numeric(12, 2) not null default 0;
alter table product_development add column if not exists coupang_inbound_shipping_cost numeric(12, 2) not null default 0;
alter table product_development add column if not exists ad_cost numeric(12, 2) not null default 0;
