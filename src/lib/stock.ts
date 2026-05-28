import type { ProductWithStock } from "./types";

export function getCurrentStock(product: ProductWithStock) {
  const balance = product.inventory_balances;
  if (Array.isArray(balance)) return balance[0]?.current_stock ?? 0;
  return balance?.current_stock ?? 0;
}
