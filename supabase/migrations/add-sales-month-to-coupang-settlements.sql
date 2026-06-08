alter table coupang_settlements
add column if not exists sales_month date;

update coupang_settlements
set sales_month = settlement_month
where sales_month is null;
