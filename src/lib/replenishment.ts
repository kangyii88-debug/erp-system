import type { ProductWithStock, PurchaseOrder, SaleDaily } from "./types";
import { getComputedCurrentStock, type InventoryMetrics } from "./stock";

export const REPLENISHMENT_CYCLE_DAYS = 30;
export const SALES_ANALYSIS_DAYS = 30;

export type SalesSummary = {
  totalQuantity: number;
  activeSalesDays: number;
  averageDailySales: number;
};

export type ReplenishmentRow = {
  product: ProductWithStock;
  currentStock: number;
  salesInWindow: number;
  activeSalesDays: number;
  dailyAverage: number;
  safetyStock: number;
  openPurchaseQty: number;
  pendingOrderQty: number;
  suggestedQty: number;
};

export function summarizeSales(sales: SaleDaily[]): SalesSummary {
  const validSales = normalizeSalesRows(sales);
  const activeDays = new Set(validSales.map((sale) => sale.sale_date));
  const totalQuantity = validSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const activeSalesDays = activeDays.size;
  const averageDailySales = activeSalesDays > 0 ? roundOneDecimal(totalQuantity / activeSalesDays) : 0;

  return { totalQuantity, activeSalesDays, averageDailySales };
}

export function buildReplenishmentRows(
  products: ProductWithStock[],
  sales: SaleDaily[],
  purchases: PurchaseOrder[],
  pendingOrdersByProduct = new Map<string, number>(),
  inventoryMetricsByProduct = new Map<string, InventoryMetrics>()
): ReplenishmentRow[] {
  const salesByProduct = new Map<string, { quantity: number; activeDays: Set<string> }>();
  const openPurchases = new Map<string, number>();

  for (const sale of normalizeSalesRows(sales)) {
    const current = salesByProduct.get(sale.product_id) ?? { quantity: 0, activeDays: new Set<string>() };
    current.quantity += sale.quantity;
    current.activeDays.add(sale.sale_date);
    salesByProduct.set(sale.product_id, current);
  }

  for (const po of purchases) {
    if (po.shipping_status !== "received" && po.production_status !== "cancelled") {
      openPurchases.set(po.product_id, (openPurchases.get(po.product_id) ?? 0) + po.quantity);
    }
  }

  return products.map((product) => {
    const salesStats = salesByProduct.get(product.id);
    const currentStock = getComputedCurrentStock(product, inventoryMetricsByProduct);
    const salesInWindow = salesStats?.quantity ?? 0;
    const activeSalesDays = salesStats?.activeDays.size ?? 0;
    const dailyAverage = activeSalesDays > 0 ? roundOneDecimal(salesInWindow / activeSalesDays) : 0;
    const safetyStock = Math.max(0, Number(product.low_stock_threshold ?? 0));
    const openPurchaseQty = openPurchases.get(product.id) ?? 0;
    const pendingOrderQty = pendingOrdersByProduct.get(product.id) ?? 0;
    const cycleDemand = Math.ceil(dailyAverage * REPLENISHMENT_CYCLE_DAYS);
    const targetQty = cycleDemand + safetyStock + pendingOrderQty;
    const suggestedQty = Math.max(0, targetQty - currentStock - openPurchaseQty);

    return {
      product,
      currentStock,
      salesInWindow,
      activeSalesDays,
      dailyAverage,
      safetyStock,
      openPurchaseQty,
      pendingOrderQty,
      suggestedQty
    };
  });
}

function normalizeSalesRows(sales: SaleDaily[]) {
  return sales
    .map((sale) => ({
      ...sale,
      quantity: Math.max(0, Number(sale.quantity ?? 0))
    }))
    .filter((sale) => Boolean(sale.product_id) && Boolean(sale.sale_date) && sale.quantity > 0);
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
