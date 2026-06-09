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

export type CoupangSettlement = {
  id: string;
  user_id: string;
  sales_month?: string | null;
  settlement_month: string;
  sales_amount: number;
  cancel_amount: number;
  actual_sales_amount: number;
  sales_fee: number;
  seller_coupon: number;
  milk_run_fee: number;
  ad_fee: number;
  settlement_deduction: number;
  fulfillment_fee: number;
  inventory_loss_compensation: number;
  final_payment_amount: number;
  cancel_rate: number;
  fee_rate: number;
  ad_rate: number;
  payment_rate: number;
  remark: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type Task = {
  id: string;
  user_id: string;
  task_name: string;
  task_type: string;
  priority: "P1 紧急" | "P2 重要" | "P3 普通" | "P4 低优先级";
  owner: string;
  due_date: string;
  status: "待处理" | "进行中" | "已完成" | "已取消";
  remark: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type ProductDevelopment = {
  id: string;
  user_id: string;
  product_name: string;
  product_image_url: string | null;
  product_category: string;
  supplier: string | null;
  purchase_cost: number;
  expected_price: number;
  expected_margin: number | null;
  owner: string;
  development_status: "待开发" | "询价中" | "打样中" | "测试中" | "优化中" | "待上架" | "已上线" | "已放弃";
  expected_launch_date: string | null;
  priority: "S级" | "A级" | "B级" | "C级";
  market_potential_score: number;
  competition_score: number;
  supply_chain_score: number;
  profit_score: number;
  remark: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type CustomerIssue = {
  id: string;
  user_id: string;
  issue_date: string;
  sku: string;
  product_name: string;
  issue_category: "安装问题" | "质量问题" | "尺寸问题" | "颜色问题" | "物流问题" | "包装问题" | "功能问题" | "其它问题";
  issue_description: string;
  customer_original_text: string | null;
  solution: string | null;
  owner: string;
  status: "待处理" | "处理中" | "已解决" | "已关闭";
  remark: string | null;
  created_at: string;
  updated_at?: string | null;
};
