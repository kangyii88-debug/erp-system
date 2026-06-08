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

export type CoupangInboundRecord = {
  id: string;
  user_id: string;
  product_id: string | null;
  inbound_date: string;
  sku: string;
  product_name: string;
  box_count: number;
  units_per_box: number;
  confirmed_quantity: number;
  inbound_method: "parcel" | "milk_run";
  outbound_location: "warehouse" | "office";
  milk_run_type: "parcel" | "pallet" | "truck" | null;
  reservation_number: string | null;
  receive_status: "pending" | "received" | "partial" | "issue";
  discrepancy_status: "normal" | "quantity_mismatch" | "follow_up" | "lost" | "damaged" | "lost_or_damaged";
  application_date: string | null;
  expected_inbound_date: string | null;
  purchase_batch_no: string | null;
  memo: string | null;
  created_at: string;
  updated_at?: string | null;
  products?: Pick<Product, "name" | "sku" | "color" | "size"> | null;
};

export type ExpenseRecord = {
  id: string;
  user_id: string;
  expense_date: string;
  category: string;
  expense_name: string;
  amount: number;
  vendor: string | null;
  payment_method: string | null;
  owner: string | null;
  remark: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at?: string | null;
};
