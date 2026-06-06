export type Language = "zh" | "ko";

export type Product = {
  id: string;
  user_id: string;
  name: string;
  sku: string;
  color: string | null;
  size: string | null;
  purchase_price: number;
  sale_price: number;
  platform_fee_rate: number;
  international_shipping_cost: number;
  coupang_inbound_shipping_cost: number;
  ad_cost: number;
  platform: string;
  low_stock_threshold: number;
  memo: string | null;
  created_at: string;
};

export type ProductWithStock = Product & {
  inventory_balances?: { current_stock: number } | { current_stock: number }[] | null;
};

export type StockMovement = {
  id: string;
  product_id: string;
  type:
    | "purchase"
    | "sale"
    | "return_resell"
    | "damaged"
    | "lost"
    | "adjustment"
    | "inbound"
    | "outbound"
    | "return_inbound"
    | "loss";
  quantity: number;
  happened_at: string;
  memo: string | null;
  products?: Pick<Product, "name" | "sku" | "color"> | null;
};

export type PurchaseOrder = {
  id: string;
  product_id: string;
  supplier_id: string | null;
  factory_name: string;
  quantity: number;
  production_status: string;
  shipping_status: string;
  expected_arrival_date: string | null;
  memo: string | null;
  products?: Pick<Product, "name" | "sku"> | null;
};

export type SaleDaily = {
  product_id: string;
  sale_date: string;
  quantity: number;
};
