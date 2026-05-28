import type { ProductWithStock, SaleDaily, PurchaseOrder } from "./types";
import { getCurrentStock } from "./stock";

const PRODUCTION_DAYS = 20;
const SHIPPING_DAYS = 7;
const PLATFORM_INBOUND_DAYS = 2;
const TARGET_DAYS = PRODUCTION_DAYS + SHIPPING_DAYS + PLATFORM_INBOUND_DAYS;

export type ReplenishmentRow = {
  product: ProductWithStock;
  currentStock: number;
  sales7d: number;
  dailyAverage: number;
  openPurchaseQty: number;
  suggestedQty: number;
};

export function buildReplenishmentRows(
  products: ProductWithStock[],
  sales: SaleDaily[],
  purchases: PurchaseOrder[]
): ReplenishmentRow[] {
  const salesByProduct = new Map<string, number>();
  const openPurchases = new Map<string, number>();

  for (const sale of sales) {
    salesByProduct.set(sale.product_id, (salesByProduct.get(sale.product_id) ?? 0) + sale.quantity);
  }

  for (const po of purchases) {
    if (po.shipping_status !== "received" && po.production_status !== "cancelled") {
      openPurchases.set(po.product_id, (openPurchases.get(po.product_id) ?? 0) + po.quantity);
    }
  }

  return products.map((product) => {
    const currentStock = getCurrentStock(product);
    const sales7d = salesByProduct.get(product.id) ?? 0;
    const dailyAverage = sales7d / 7;
    const openPurchaseQty = openPurchases.get(product.id) ?? 0;
    const targetQty = Math.ceil(dailyAverage * TARGET_DAYS);
    const suggestedQty = Math.max(0, targetQty - currentStock - openPurchaseQty);

    return { product, currentStock, sales7d, dailyAverage, openPurchaseQty, suggestedQty };
  });
}
