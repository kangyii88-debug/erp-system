import type { Product } from "@/lib/types";

export function money(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function percent(value: number | string | null | undefined, fallback = 11.6) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function platformFee(product: Pick<Product, "sale_price" | "platform_fee_rate">) {
  return money(product.sale_price) * (percent(product.platform_fee_rate) / 100);
}

export function unitProfit(
  product: Pick<
    Product,
    | "purchase_price"
    | "sale_price"
    | "platform_fee_rate"
    | "international_shipping_cost"
    | "coupang_inbound_shipping_cost"
    | "ad_cost"
  >
) {
  return (
    money(product.sale_price) -
    money(product.purchase_price) -
    platformFee(product) -
    money(product.international_shipping_cost) -
    money(product.coupang_inbound_shipping_cost) -
    money(product.ad_cost)
  );
}

export function profitMargin(product: Pick<Product, "sale_price">, profit = 0) {
  const salePrice = money(product.sale_price);
  return salePrice > 0 ? (profit / salePrice) * 100 : 0;
}

export function totalProfit(product: Parameters<typeof unitProfit>[0], quantity: number) {
  return unitProfit(product) * Math.max(0, Number(quantity ?? 0));
}
