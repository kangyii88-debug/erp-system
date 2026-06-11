alter type movement_type add value if not exists 'return_inbound';
alter type movement_type add value if not exists 'loss';
alter type movement_type add value if not exists 'purchase';
alter type movement_type add value if not exists 'return_resell';
alter type movement_type add value if not exists 'damaged';
alter type movement_type add value if not exists 'lost';

create or replace function apply_stock_movement()
returns trigger language plpgsql as $$
declare
  signed_qty integer;
begin
  signed_qty := case
    when new.type::text in ('purchase', 'inbound', 'adjustment') then new.quantity
    when new.type::text in ('sale', 'outbound', 'damaged', 'lost', 'loss') then -new.quantity
    when new.type::text in ('return_resell', 'return_inbound') then new.quantity
    else 0
  end;

  insert into inventory_balances (product_id, current_stock)
  values (new.product_id, greatest(0, signed_qty))
  on conflict (product_id) do update
    set current_stock = inventory_balances.current_stock + signed_qty,
        updated_at = now();

  if new.type::text = 'sale' then
    insert into sales_daily (user_id, product_id, sale_date, quantity)
    values (new.user_id, new.product_id, new.happened_at::date, new.quantity)
    on conflict (user_id, product_id, sale_date)
    do update set quantity = sales_daily.quantity + excluded.quantity;
  end if;

  return new;
end;
$$;
