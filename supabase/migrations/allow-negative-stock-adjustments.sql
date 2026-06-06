alter table stock_movements
  drop constraint if exists stock_movements_quantity_check;

alter table stock_movements
  add constraint stock_movements_quantity_check check (quantity <> 0);
