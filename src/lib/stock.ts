import type { ProductWithStock, SaleDaily } from "./types";

export type InventoryMovementType = "purchase" | "sale" | "return_resell" | "loss" | "adjustment" | "other";

export type InventoryMovementLike = {
  product_id?: string | null;
  type?: string | null;
  quantity?: number | string | null;
  happened_at?: string | null;
  memo?: string | null;
};

export type InventoryMetrics = {
  purchaseInbound: number;
  salesRawTotal: number;
  lossDefectMissing: number;
  effectiveSales: number;
  returnInboundSaleable: number;
  inventoryAdjustment: number;
  availableInventory: number;
};

const EMPTY_METRICS: InventoryMetrics = {
  purchaseInbound: 0,
  salesRawTotal: 0,
  lossDefectMissing: 0,
  effectiveSales: 0,
  returnInboundSaleable: 0,
  inventoryAdjustment: 0,
  availableInventory: 0
};

export function getCurrentStock(product: ProductWithStock) {
  const balance = product.inventory_balances;
  if (Array.isArray(balance)) return balance[0]?.current_stock ?? 0;
  return balance?.current_stock ?? 0;
}

export function classifyInventoryMovement(movement: InventoryMovementLike): InventoryMovementType {
  const type = String(movement.type ?? "");
  const memo = String(movement.memo ?? "");

  if (type === "return_resell" || type === "return_inbound" || isReturnResellMemo(memo)) return "return_resell";
  if (type === "damaged" || type === "lost" || type === "loss" || isLossMemo(memo)) return "loss";
  if (type === "adjustment") return "adjustment";
  if (type === "purchase" || type === "inbound") return "purchase";
  if (type === "sale" || type === "outbound") return "sale";
  return "other";
}

export function signedInventoryQuantity(movement: InventoryMovementLike) {
  const type = classifyInventoryMovement(movement);
  const rawQuantity = safeNumber(movement.quantity);
  const quantity = Math.abs(rawQuantity);

  if (type === "purchase") return quantity;
  if (type === "sale") return -quantity;
  if (type === "return_resell") return quantity;
  if (type === "loss") return -quantity;
  if (type === "adjustment") return rawQuantity;
  return 0;
}

export function calculateInventoryMetrics(movements: InventoryMovementLike[] = []): InventoryMetrics {
  const metrics = { ...EMPTY_METRICS };

  for (const movement of movements) {
    const type = classifyInventoryMovement(movement);
    const rawQuantity = safeNumber(movement.quantity);
    const quantity = Math.abs(rawQuantity);

    if (type === "purchase") metrics.purchaseInbound += quantity;
    if (type === "sale") metrics.salesRawTotal += quantity;
    if (type === "return_resell") metrics.returnInboundSaleable += quantity;
    if (type === "loss") metrics.lossDefectMissing += quantity;
    if (type === "adjustment") metrics.inventoryAdjustment += rawQuantity;
  }

  metrics.effectiveSales = metrics.salesRawTotal;
  metrics.availableInventory = metrics.purchaseInbound - metrics.salesRawTotal + metrics.returnInboundSaleable - metrics.lossDefectMissing + metrics.inventoryAdjustment;

  return metrics;
}

export function buildInventoryMetricsByProduct(movements: InventoryMovementLike[] = []) {
  const grouped = new Map<string, InventoryMovementLike[]>();

  for (const movement of movements) {
    if (!movement.product_id) continue;
    const rows = grouped.get(movement.product_id) ?? [];
    rows.push(movement);
    grouped.set(movement.product_id, rows);
  }

  const result = new Map<string, InventoryMetrics>();
  for (const [productId, rows] of Array.from(grouped.entries())) {
    result.set(productId, calculateInventoryMetrics(rows));
  }

  return result;
}

export function getComputedCurrentStock(product: ProductWithStock, metricsByProduct?: Map<string, InventoryMetrics>) {
  if (metricsByProduct) return metricsByProduct.get(product.id)?.availableInventory ?? 0;
  return getCurrentStock(product);
}

export function calculateCurrentStockFromMovements(movements: InventoryMovementLike[] = []) {
  return movements.reduce((sum, movement) => sum + signedInventoryQuantity(movement), 0);
}

export function applyLossAdjustmentToSales(sales: SaleDaily[], movements: InventoryMovementLike[] = []) {
  const validSales = sales
    .map((sale) => ({ ...sale, quantity: Math.max(0, safeNumber(sale.quantity)) }))
    .filter((sale) => sale.product_id && sale.sale_date && sale.quantity > 0);

  if (!validSales.length) return validSales;

  const dates = validSales.map((sale) => sale.sale_date).sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  const lossByProduct = new Map<string, number>();

  for (const movement of movements) {
    if (!movement.product_id || classifyInventoryMovement(movement) !== "loss") continue;
    const movementDate = toDateKey(movement.happened_at);
    if (movementDate && (movementDate < start || movementDate > end)) continue;
    lossByProduct.set(movement.product_id, (lossByProduct.get(movement.product_id) ?? 0) + Math.abs(safeNumber(movement.quantity)));
  }

  return validSales
    .map((sale) => {
      const loss = lossByProduct.get(sale.product_id) ?? 0;
      if (loss <= 0) return sale;
      const deducted = Math.min(sale.quantity, loss);
      lossByProduct.set(sale.product_id, loss - deducted);
      return { ...sale, quantity: sale.quantity - deducted };
    })
    .filter((sale) => sale.quantity > 0);
}

export function logInventoryCalculationMismatch(source: string, values: Record<string, number>) {
  if (process.env.NODE_ENV === "production") return;
  const entries = Object.entries(values).filter(([, value]) => Number.isFinite(value));
  if (entries.length < 2) return;
  const first = entries[0][1];
  const mismatch = entries.some(([, value]) => Math.round(value) !== Math.round(first));
  if (mismatch) {
    console.warn("Inventory Calculation Mismatch", { source, values });
  }
}

export function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function isReturnResellMemo(memo: string) {
  return includesAny(memo, ["退货入库在售", "退货入库", "退货", "반품 입고 판매가능", "반품 입고 판매", "반품"]);
}

export function isLossMemo(memo: string) {
  return includesAny(memo, ["损耗丢失", "损耗/不良", "损耗", "不良", "丢失", "손상/불량", "손상/분실", "손상", "불량", "분실"]);
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function toDateKey(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}
