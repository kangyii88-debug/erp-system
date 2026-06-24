"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  Factory,
  PackageCheck,
  PackageOpen,
  Save,
  Search,
  Ship,
  TimerReset,
  Trash2,
  Truck,
  X,
  type LucideIcon
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProductSelect } from "@/components/ProductSelect";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/profit";
import { supabase } from "@/lib/supabase";
import type { Language, ProductWithStock, PurchaseOrder } from "@/lib/types";

type ProductionStatus = "pending" | "producing" | "completed" | "delayed" | "cancelled";
type ShippingStatus = "not_shipped" | "shipped_from_china" | "customs" | "in_korea" | "received";
type OverallStatus = "abnormal" | "all_received" | "partial_received" | "in_transit" | "shipped" | "waiting_ship" | "producing" | "pending";

type PurchaseOrderWithProduct = PurchaseOrder & {
  created_at?: string;
  updated_at?: string | null;
  products?: Pick<ProductWithStock, "name" | "sku" | "color" | "size" | "purchase_price" | "inventory_balances"> | null;
};

type PurchaseBatch = {
  id: string;
  purchase_order_id: string;
  batch_no: string | null;
  sku: string | null;
  product_name: string | null;
  quantity: number;
  factory_name: string | null;
  production_status: string | null;
  shipping_status: string | null;
  expected_production_date: string | null;
  expected_shipping_date: string | null;
  expected_arrival_date: string | null;
  actual_arrival_date: string | null;
  logistics_company: string | null;
  tracking_no: string | null;
  memo: string | null;
  created_at: string;
  updated_at?: string | null;
};

type PurchaseUnit = {
  id: string;
  orderId: string;
  batchId?: string;
  batchNo?: string | null;
  usesBatch: boolean;
  productId: string;
  productName: string;
  productFamily: string;
  sku: string;
  color: string;
  size: string;
  factoryName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  productionStatus: ProductionStatus;
  shippingStatus: ShippingStatus;
  expectedProductionDate: string | null;
  expectedShippingDate: string | null;
  expectedArrivalDate: string | null;
  actualArrivalDate: string | null;
  logisticsCompany: string | null;
  trackingNo: string | null;
  memo: string | null;
};

type ProductControlCard = {
  key: string;
  productName: string;
  factories: string[];
  units: PurchaseUnit[];
  skuCount: number;
  totalQuantity: number;
  totalAmount: number;
  productionCompletedQty: number;
  productionIncompleteQty: number;
  shippedQty: number;
  inTransitQty: number;
  arrivedQty: number;
  notArrivedQty: number;
  abnormalQty: number;
  status: OverallStatus;
  action: string;
  breakdown: {
    pending: number;
    producing: number;
    completedNotShipped: number;
    shippedTransit: number;
    abnormal: number;
  };
};

type PurchaseFilters = {
  query: string;
  productName: string;
  sku: string;
  factory: string;
  color: string;
  size: string;
  productionStatus: string;
  shippingStatus: string;
  overallStatus: string;
  arrivalState: string;
  abnormalState: string;
  expectedStart: string;
  expectedEnd: string;
  actualStart: string;
  actualEnd: string;
};

const productionStatuses: ProductionStatus[] = ["pending", "producing", "completed", "delayed", "cancelled"];
const shippingStatuses: ShippingStatus[] = ["not_shipped", "shipped_from_china", "customs", "in_korea", "received"];
const overallStatuses: OverallStatus[] = ["abnormal", "all_received", "partial_received", "in_transit", "shipped", "waiting_ship", "producing", "pending"];

const emptyFilters: PurchaseFilters = {
  query: "",
  productName: "",
  sku: "",
  factory: "",
  color: "",
  size: "",
  productionStatus: "",
  shippingStatus: "",
  overallStatus: "",
  arrivalState: "",
  abnormalState: "",
  expectedStart: "",
  expectedEnd: "",
  actualStart: "",
  actualEnd: ""
};

export default function PurchasesPage() {
  return (
    <AppShell>
      <PurchasesContent />
    </AppShell>
  );
}

function PurchasesContent() {
  const { language, t, formatDate, formatNumber, formatCurrency } = useLanguage();
  const copy = purchaseCopy(language);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderWithProduct[]>([]);
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState<PurchaseFilters>(emptyFilters);
  const [form, setForm] = useState({
    product_id: "",
    factory_name: "",
    quantity: "1",
    production_status: "pending",
    shipping_status: "not_shipped",
    expected_arrival_date: "",
    memo: ""
  });

  const isEditing = Boolean(editingId);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const units = useMemo(() => buildPurchaseUnits(orders, batches, productMap), [orders, batches, productMap]);
  const filteredUnits = useMemo(() => filterPurchaseUnits(units, filters), [units, filters]);
  const productCards = useMemo(() => buildProductCards(filteredUnits, copy), [filteredUnits, copy]);
  const analytics = useMemo(() => buildControlAnalytics(filteredUnits), [filteredUnits]);
  const productionStats = useMemo(() => buildProductionStats(filteredUnits, copy), [filteredUnits, copy]);
  const shippingStats = useMemo(() => buildShippingStats(filteredUnits, copy), [filteredUnits, copy]);
  const todoItems = useMemo(() => buildTodoItems(filteredUnits, copy), [filteredUnits, copy]);
  const tableSummary = useMemo(() => buildTableSummary(filteredUnits, productCards), [filteredUnits, productCards]);
  const hasFilters = Object.values(filters).some(Boolean);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: productRows }, { data: orderRows }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      supabase.from("purchase_orders").select("*, products(name, sku, color, size, purchase_price, inventory_balances(current_stock))").order("created_at", { ascending: false })
    ]);

    const { data: batchRows, error: batchError } = await supabase
      .from("purchase_batches")
      .select("*")
      .order("created_at", { ascending: false });

    setProducts((productRows ?? []) as ProductWithStock[]);
    setOrders((orderRows ?? []) as PurchaseOrderWithProduct[]);
    setBatches(batchError ? [] : ((batchRows ?? []) as PurchaseBatch[]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      return;
    }

    const payload = {
      user_id: auth.user.id,
      product_id: form.product_id,
      factory_name: form.factory_name,
      quantity: Number(form.quantity),
      production_status: form.production_status,
      shipping_status: form.shipping_status,
      expected_arrival_date: form.expected_arrival_date || null,
      memo: form.memo || null
    };

    const { error } = editingId
      ? await supabase.from("purchase_orders").update(payload).eq("id", editingId)
      : await supabase.from("purchase_orders").insert(payload);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("");
    resetForm();
    await load();
  }

  async function updateOrder(id: string, patch: Partial<PurchaseOrder>) {
    const { error } = await supabase.from("purchase_orders").update(patch).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("");
    await load();
  }

  async function updateUnitStatus(unit: PurchaseUnit, patch: Partial<Pick<PurchaseUnit, "productionStatus" | "shippingStatus">>) {
    const payload: Record<string, string> = {};
    if (patch.productionStatus) payload.production_status = patch.productionStatus;
    if (patch.shippingStatus) payload.shipping_status = patch.shippingStatus;

    const { error } = unit.usesBatch && unit.batchId
      ? await supabase.from("purchase_batches").update(payload).eq("id", unit.batchId)
      : await supabase.from("purchase_orders").update(payload).eq("id", unit.orderId);

    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("");
    await load();
  }

  function startEdit(order: PurchaseOrderWithProduct) {
    setEditingId(order.id);
    setMessage("");
    setForm({
      product_id: order.product_id,
      factory_name: order.factory_name ?? "",
      quantity: String(order.quantity ?? 1),
      production_status: order.production_status || "pending",
      shipping_status: order.shipping_status || "not_shipped",
      expected_arrival_date: order.expected_arrival_date ?? "",
      memo: order.memo ?? ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      product_id: "",
      factory_name: "",
      quantity: "1",
      production_status: "pending",
      shipping_status: "not_shipped",
      expected_arrival_date: "",
      memo: ""
    });
  }

  async function deleteOrder(id: string) {
    if (!window.confirm(t("purchase.deleteConfirm"))) return;
    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (editingId === id) resetForm();
    setMessage("");
    await load();
  }

  return (
    <>
      <section className="premium-dashboard-panel relative mb-5 overflow-hidden rounded-[30px] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-slate-900/[0.035] blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-section-eyebrow">
              <ClipboardList className="h-3.5 w-3.5" />
              {copy.controlCenter}
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{copy.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{copy.subtitle}</p>
          </div>
          <div className="rounded-3xl border border-line bg-white px-5 py-4 shadow-soft">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Control Flow</div>
            <div className="mt-2 text-sm font-semibold text-ink">{copy.flow}</div>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <ProcurementKpi icon={CircleDollarSign} label={copy.totalAmount} value={formatCurrency(analytics.totalAmount)} tone="slate" />
        <ProcurementKpi icon={Boxes} label={copy.totalQuantity} value={formatNumber(analytics.totalQuantity)} tone="blue" />
        <ProcurementKpi icon={Factory} label={copy.productionCompletedQty} value={formatNumber(analytics.productionCompletedQty)} tone="green" />
        <ProcurementKpi icon={Ship} label={copy.shippedQty} value={formatNumber(analytics.shippedQty)} tone="blue" />
        <ProcurementKpi icon={PackageCheck} label={copy.arrivedQty} value={formatNumber(analytics.arrivedQty)} tone="green" />
        <ProcurementKpi icon={PackageOpen} label={copy.notArrivedQty} value={formatNumber(analytics.notArrivedQty)} tone="orange" />
        <ProcurementKpi icon={CheckCircle2} label={copy.arrivalRate} value={`${analytics.arrivalRate.toFixed(1)}%`} tone="teal" />
        <ProcurementKpi icon={AlertTriangle} label={copy.abnormalQty} value={formatNumber(analytics.abnormalQty)} tone="red" />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-2">
        <StatusBarPanel title={copy.productionOverview} stats={productionStats} total={analytics.totalQuantity} formatNumber={formatNumber} />
        <StatusBarPanel title={copy.shippingOverview} stats={shippingStats} total={analytics.totalQuantity} formatNumber={formatNumber} />
      </section>

      <section className="mb-5 grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="premium-dashboard-panel self-start rounded-[28px] p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="premium-section-eyebrow">PRODUCT PURCHASE CONTROL CENTER</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.productControlTitle}</h2>
            </div>
            <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-muted shadow-sm">
              {formatNumber(productCards.length)} {copy.products}
            </span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {productCards.map((card) => (
              <ProductControlCard
                key={card.key}
                card={card}
                copy={copy}
                language={language}
                expanded={Boolean(expandedProducts[card.key])}
                onToggle={() => setExpandedProducts((prev) => ({ ...prev, [card.key]: !prev[card.key] }))}
                onUpdateUnit={updateUnitStatus}
                formatNumber={formatNumber}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            ))}
            {!productCards.length ? <EmptyState text={copy.noData} /> : null}
          </div>
        </div>

        <TodoPanel items={todoItems} copy={copy} formatNumber={formatNumber} />
      </section>

      <section className="premium-dashboard-panel mb-5 rounded-[28px] p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="premium-section-eyebrow">Purchase Entry</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{isEditing ? copy.editTitle : copy.addTitle}</h2>
          </div>
          {isEditing ? (
            <button type="button" onClick={resetForm} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted shadow-sm transition hover:border-[#2563eb]/30 hover:text-[#2563eb]">
              {t("purchase.cancelEdit")}
            </button>
          ) : null}
        </div>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
          <ProductSelect products={products} value={form.product_id} onChange={(value) => setForm({ ...form, product_id: value })} />
          <input placeholder={t("common.factory")} value={form.factory_name} onChange={(e) => setForm({ ...form, factory_name: e.target.value })} required />
          <input className="text-right tabular-nums" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input type="date" value={form.expected_arrival_date} onChange={(e) => setForm({ ...form, expected_arrival_date: e.target.value })} />
          <select value={form.production_status} onChange={(e) => setForm({ ...form, production_status: e.target.value })}>
            {productionStatuses.map((status) => <option key={status} value={status}>{productionStatusLabel(status, copy)}</option>)}
          </select>
          <select value={form.shipping_status} onChange={(e) => setForm({ ...form, shipping_status: e.target.value })}>
            {shippingStatuses.map((status) => <option key={status} value={status}>{shippingStatusLabel(status, copy)}</option>)}
          </select>
          <input className="md:col-span-1" placeholder={t("common.memo")} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="inline-flex items-center justify-center gap-2">
                <Save className="h-4 w-4" />
                {saving ? copy.saving : isEditing ? t("purchase.update") : t("common.save")}
              </span>
            </button>
            {isEditing ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-[#2563eb]/30 hover:text-[#2563eb]">
                {t("purchase.cancelEdit")}
              </button>
            ) : null}
          </div>
        </form>
        {message ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{message}</div> : null}
      </section>

      <section className="premium-dashboard-panel rounded-[28px] p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="premium-section-eyebrow">Purchase Orders</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.orderTable}</h2>
          </div>
          <span className="premium-status-chip px-3 py-1.5 text-xs font-semibold text-muted">{formatNumber(filteredUnits.length)} SKU</span>
        </div>

        <FilterPanel filters={filters} setFilters={setFilters} copy={copy} hasFilters={hasFilters} />
        <SummaryStrip summary={tableSummary} copy={copy} formatNumber={formatNumber} />

        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_48px_rgba(17,24,39,0.045)] backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-[1680px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-[#f8fafc]/95 backdrop-blur-xl">
                <tr>
                  <PurchaseTh>{copy.sku}</PurchaseTh>
                  <PurchaseTh>{copy.productName}</PurchaseTh>
                  <PurchaseTh>{copy.color}</PurchaseTh>
                  <PurchaseTh>{copy.size}</PurchaseTh>
                  <PurchaseTh>{copy.factory}</PurchaseTh>
                  <PurchaseTh align="right">{copy.purchaseQty}</PurchaseTh>
                  <PurchaseTh align="right">{copy.unitPrice}</PurchaseTh>
                  <PurchaseTh align="right">{copy.amount}</PurchaseTh>
                  <PurchaseTh>{copy.productionStatus}</PurchaseTh>
                  <PurchaseTh>{copy.shippingStatus}</PurchaseTh>
                  <PurchaseTh>{copy.expectedArrivalDate}</PurchaseTh>
                  <PurchaseTh>{copy.actualArrivalDate}</PurchaseTh>
                  <PurchaseTh>{copy.arrivalRate}</PurchaseTh>
                  <PurchaseTh>{copy.nextAction}</PurchaseTh>
                  <PurchaseTh>{copy.memo}</PurchaseTh>
                  <PurchaseTh align="right">{copy.actions}</PurchaseTh>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((unit) => {
                  const order = orders.find((row) => row.id === unit.orderId);
                  const status = inferUnitOverallStatus(unit);
                  return (
                    <tr key={unit.id} className="group transition odd:bg-white/45 hover:bg-slate-50">
                      <PurchaseTd mono><SkuBadge sku={unit.sku} /></PurchaseTd>
                      <PurchaseTd><ProductNameCell unit={unit} /></PurchaseTd>
                      <PurchaseTd>{unit.color || "-"}</PurchaseTd>
                      <PurchaseTd>{unit.size || "-"}</PurchaseTd>
                      <PurchaseTd>{unit.factoryName || "-"}</PurchaseTd>
                      <PurchaseTd align="right">{formatNumber(unit.quantity)}</PurchaseTd>
                      <PurchaseTd align="right">{formatCurrency(unit.unitPrice)}</PurchaseTd>
                      <PurchaseTd align="right" strong>{formatCurrency(unit.amount)}</PurchaseTd>
                      <PurchaseTd>
                        <InlineStatusSelect value={unit.productionStatus} options={productionStatuses} label={(value) => productionStatusLabel(value, copy)} tone={productionTone} onChange={(value) => updateUnitStatus(unit, { productionStatus: value as ProductionStatus })} />
                      </PurchaseTd>
                      <PurchaseTd>
                        <InlineStatusSelect value={unit.shippingStatus} options={shippingStatuses} label={(value) => shippingStatusLabel(value, copy)} tone={shippingTone} onChange={(value) => updateUnitStatus(unit, { shippingStatus: value as ShippingStatus })} />
                      </PurchaseTd>
                      <PurchaseTd>{dateText(unit.expectedArrivalDate, formatDate)}</PurchaseTd>
                      <PurchaseTd>{dateText(unit.actualArrivalDate, formatDate)}</PurchaseTd>
                      <PurchaseTd><MiniRate value={unit.shippingStatus === "received" ? 100 : 0} /></PurchaseTd>
                      <PurchaseTd><StatusBadge status={status} copy={copy} /> <span className="ml-2 text-xs font-semibold text-muted">{actionForStatus(status, copy)}</span></PurchaseTd>
                      <PurchaseTd>{unit.memo || "-"}</PurchaseTd>
                      <PurchaseTd align="right">
                        <div className="flex min-w-[92px] justify-end gap-2">
                          {!unit.usesBatch && order ? <IconButton label={copy.edit} icon={Edit3} onClick={() => startEdit(order)} /> : null}
                          {!unit.usesBatch ? <IconButton label={copy.delete} icon={Trash2} danger onClick={() => deleteOrder(unit.orderId)} /> : null}
                        </div>
                      </PurchaseTd>
                    </tr>
                  );
                })}
                {!filteredUnits.length ? (
                  <tr>
                    <td colSpan={16} className="border-b border-line px-4 py-10 text-center text-sm text-muted">
                      {copy.noData}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function ProductControlCard({ card, copy, language, expanded, onToggle, onUpdateUnit, formatNumber, formatCurrency, formatDate }: {
  card: ProductControlCard;
  copy: PurchaseCopy;
  language: Language;
  expanded: boolean;
  onToggle: () => void;
  onUpdateUnit: (unit: PurchaseUnit, patch: Partial<Pick<PurchaseUnit, "productionStatus" | "shippingStatus">>) => void;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
}) {
  const progress = [
    { label: copy.purchaseCreated, value: card.totalQuantity, color: "#111827" },
    { label: copy.factoryCompleted, value: card.productionCompletedQty, color: "#16a34a" },
    { label: copy.internationalShipping, value: card.shippedQty, color: "#2563eb" },
    { label: copy.koreaWarehouseIn, value: card.arrivedQty, color: "#0f766e" }
  ];

  return (
    <article className="rounded-[24px] border border-line bg-white p-4 shadow-[0_16px_44px_rgba(17,24,39,0.055)]">
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={card.status} copy={copy} />
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{formatNumber(card.skuCount)} SKU</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-6 text-ink">{card.productName}</h3>
          <p className="mt-1 text-xs font-semibold text-muted">{copy.factory}: {card.factories.join(" / ") || "-"}</p>
        </div>
        <span className="mt-1 rounded-full border border-line bg-white p-2 text-ink shadow-sm">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <CardMini label={copy.purchaseQty} value={formatNumber(card.totalQuantity)} />
        <CardMini label={copy.amount} value={formatCurrency(card.totalAmount)} />
        <CardMini label={copy.arrivedQty} value={formatNumber(card.arrivedQty)} />
        <CardMini label={copy.notArrivedQty} value={formatNumber(card.notArrivedQty)} danger={card.notArrivedQty > 0} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CardMini label={copy.productionCompletedQty} value={formatNumber(card.productionCompletedQty)} />
        <CardMini label={copy.shippedQty} value={formatNumber(card.shippedQty)} />
        <CardMini label={copy.abnormalQty} value={formatNumber(card.abnormalQty)} danger={card.abnormalQty > 0} />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-slate-50/70 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold text-muted">{copy.arrivalRate}</span>
          <span className="premium-number text-lg font-semibold text-ink">{rate(card.arrivedQty, card.totalQuantity).toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${Math.min(100, rate(card.arrivedQty, card.totalQuantity))}%` }} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-3">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">{copy.productPurchaseStatus}</div>
        <div className="grid gap-3 sm:grid-cols-4">
          {progress.map((step) => (
            <div key={step.label}>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate(step.value, card.totalQuantity))}%`, backgroundColor: step.color }} />
              </div>
              <div className="mt-2 text-[11px] font-bold text-muted">{step.label}</div>
              <div className="premium-number mt-1 text-sm font-semibold text-ink">{formatNumber(step.value)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3">
        <span className="text-xs font-bold text-muted">{copy.nextAction}</span>
        <span className="text-sm font-semibold text-ink">{card.action}</span>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-line bg-slate-50/70 p-3">
            <h4 className="text-sm font-semibold text-ink">{card.productName} {copy.notArrivedBreakdown} {formatNumber(card.notArrivedQty)}</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              <CardMini label={copy.pending} value={formatNumber(card.breakdown.pending)} />
              <CardMini label={copy.producing} value={formatNumber(card.breakdown.producing)} />
              <CardMini label={copy.completedNotShipped} value={formatNumber(card.breakdown.completedNotShipped)} />
              <CardMini label={copy.shippedTransit} value={formatNumber(card.breakdown.shippedTransit)} />
              <CardMini label={copy.abnormal} value={formatNumber(card.breakdown.abnormal)} danger={card.breakdown.abnormal > 0} />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <PurchaseTh>{copy.sku}</PurchaseTh>
                    <PurchaseTh>{copy.color}</PurchaseTh>
                    <PurchaseTh>{copy.size}</PurchaseTh>
                    <PurchaseTh align="right">{copy.purchaseQty}</PurchaseTh>
                    <PurchaseTh align="right">{copy.unitPrice}</PurchaseTh>
                    <PurchaseTh>{copy.productionStatus}</PurchaseTh>
                    <PurchaseTh>{copy.shippingStatus}</PurchaseTh>
                    <PurchaseTh>{copy.expectedArrivalDate}</PurchaseTh>
                    <PurchaseTh>{copy.actualArrivalDate}</PurchaseTh>
                    <PurchaseTh>{copy.currentStatus}</PurchaseTh>
                    <PurchaseTh>{copy.nextAction}</PurchaseTh>
                    <PurchaseTh>{copy.batch}</PurchaseTh>
                    <PurchaseTh>{copy.memo}</PurchaseTh>
                  </tr>
                </thead>
                <tbody>
                  {card.units.map((unit) => {
                    const status = inferUnitOverallStatus(unit);
                    return (
                      <tr key={unit.id}>
                        <PurchaseTd mono><SkuBadge sku={unit.sku} /></PurchaseTd>
                        <PurchaseTd>{unit.color || "-"}</PurchaseTd>
                        <PurchaseTd>{unit.size || "-"}</PurchaseTd>
                        <PurchaseTd align="right">{formatNumber(unit.quantity)}</PurchaseTd>
                        <PurchaseTd align="right">{formatCurrency(unit.unitPrice)}</PurchaseTd>
                        <PurchaseTd>
                          <InlineStatusSelect value={unit.productionStatus} options={productionStatuses} label={(value) => productionStatusLabel(value, copy)} tone={productionTone} onChange={(value) => onUpdateUnit(unit, { productionStatus: value as ProductionStatus })} />
                        </PurchaseTd>
                        <PurchaseTd>
                          <InlineStatusSelect value={unit.shippingStatus} options={shippingStatuses} label={(value) => shippingStatusLabel(value, copy)} tone={shippingTone} onChange={(value) => onUpdateUnit(unit, { shippingStatus: value as ShippingStatus })} />
                        </PurchaseTd>
                        <PurchaseTd>{dateText(unit.expectedArrivalDate, formatDate)}</PurchaseTd>
                        <PurchaseTd>{dateText(unit.actualArrivalDate, formatDate)}</PurchaseTd>
                        <PurchaseTd><StatusBadge status={status} copy={copy} /></PurchaseTd>
                        <PurchaseTd>{actionForStatus(status, copy)}</PurchaseTd>
                        <PurchaseTd>{unit.batchNo || (unit.usesBatch ? "-" : copy.noBatch)}</PurchaseTd>
                        <PurchaseTd>{unit.memo || "-"}</PurchaseTd>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {card.units.some((unit) => unit.usesBatch) ? (
            <div className="rounded-2xl border border-line bg-white p-3">
              <h4 className="text-sm font-semibold text-ink">{copy.batchManagement}</h4>
              <div className="mt-3 grid gap-2">
                {card.units.filter((unit) => unit.usesBatch).map((unit) => (
                  <div key={`${unit.id}-batch`} className="grid gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-ink sm:grid-cols-[1fr_80px_120px_120px_1fr]">
                    <span>{unit.batchNo || "-"} / {unit.sku}</span>
                    <span>{formatNumber(unit.quantity)}</span>
                    <span>{productionStatusLabel(unit.productionStatus, copy)}</span>
                    <span>{shippingStatusLabel(unit.shippingStatus, copy)}</span>
                    <span>{unit.logisticsCompany || "-"} {unit.trackingNo || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ProcurementKpi({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "green" | "blue" | "orange" | "red" | "teal" | "slate" }) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    teal: "bg-teal-50 text-teal-700",
    slate: "bg-slate-100 text-slate-700"
  }[tone];
  return (
    <div className="premium-dashboard-card rounded-[22px] p-4 transition duration-300">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-xs font-semibold leading-4 text-muted">{label}</div>
      <div className="premium-number mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function StatusBarPanel({ title, stats, total, formatNumber }: { title: string; stats: Array<{ label: string; value: number; color: string }>; total: number; formatNumber: (value: number) => string }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="premium-section-eyebrow">Status</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-right shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Total</div>
          <div className="premium-number mt-1 text-2xl font-semibold tabular-nums text-ink">{formatNumber(total)}</div>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-ink">{item.label}</span>
              <span className="font-black tabular-nums text-ink">{formatNumber(item.value)} <span className="text-xs text-muted">/ {rate(item.value, total).toFixed(1)}%</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate(item.value, total))}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodoPanel({ items, copy, formatNumber }: { items: TodoItem[]; copy: PurchaseCopy; formatNumber: (value: number) => string }) {
  return (
    <aside className="premium-dashboard-panel rounded-[28px] p-5 md:p-6">
      <div className="premium-section-eyebrow">ACTION QUEUE</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.todoTitle}</h2>
      <div className="mt-5 space-y-3">
        {items.slice(0, 8).map((item) => (
          <div key={`${item.sku}-${item.issue}-${item.priority}`} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{item.product}</div>
                <div className="mt-1 font-mono text-[11px] font-bold text-blue-700">{item.sku}</div>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.priority === "P1" ? "bg-red-50 text-red-700" : item.priority === "P2" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{item.priority}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <InfoLine label={copy.issue} value={item.issue} />
              <InfoLine label={copy.quantity} value={formatNumber(item.quantity)} />
              <InfoLine label={copy.owner} value={item.owner || "-"} />
              <InfoLine label={copy.suggestedAction} value={item.action} strong />
            </div>
          </div>
        ))}
        {!items.length ? <EmptyState text={copy.noTodo} /> : null}
      </div>
    </aside>
  );
}

function FilterPanel({ filters, setFilters, copy, hasFilters }: { filters: PurchaseFilters; setFilters: (filters: PurchaseFilters) => void; copy: PurchaseCopy; hasFilters: boolean }) {
  const set = (patch: Partial<PurchaseFilters>) => setFilters({ ...filters, ...patch });
  return (
    <div className="mb-4 rounded-2xl border border-line bg-white p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
        <label className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="h-11 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/10" placeholder={copy.searchPlaceholder} value={filters.query} onChange={(event) => set({ query: event.target.value })} />
        </label>
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" placeholder={copy.productName} value={filters.productName} onChange={(event) => set({ productName: event.target.value })} />
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" placeholder={copy.sku} value={filters.sku} onChange={(event) => set({ sku: event.target.value })} />
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" placeholder={copy.factory} value={filters.factory} onChange={(event) => set({ factory: event.target.value })} />
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" placeholder={copy.color} value={filters.color} onChange={(event) => set({ color: event.target.value })} />
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" placeholder={copy.size} value={filters.size} onChange={(event) => set({ size: event.target.value })} />
        <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm" value={filters.productionStatus} onChange={(event) => set({ productionStatus: event.target.value })}>
          <option value="">{copy.allProduction}</option>
          {productionStatuses.map((status) => <option key={status} value={status}>{productionStatusLabel(status, copy)}</option>)}
        </select>
        <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm" value={filters.shippingStatus} onChange={(event) => set({ shippingStatus: event.target.value })}>
          <option value="">{copy.allShipping}</option>
          {shippingStatuses.map((status) => <option key={status} value={status}>{shippingStatusLabel(status, copy)}</option>)}
        </select>
        <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm" value={filters.overallStatus} onChange={(event) => set({ overallStatus: event.target.value })}>
          <option value="">{copy.allOverall}</option>
          {overallStatuses.map((status) => <option key={status} value={status}>{overallStatusLabel(status, copy)}</option>)}
        </select>
        <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm" value={filters.arrivalState} onChange={(event) => set({ arrivalState: event.target.value })}>
          <option value="">{copy.allArrival}</option>
          <option value="received">{copy.arrived}</option>
          <option value="not_received">{copy.notArrived}</option>
        </select>
        <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm" value={filters.abnormalState} onChange={(event) => set({ abnormalState: event.target.value })}>
          <option value="">{copy.allAbnormal}</option>
          <option value="abnormal">{copy.onlyAbnormal}</option>
          <option value="normal">{copy.onlyNormal}</option>
        </select>
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" type="date" value={filters.expectedStart} onChange={(event) => set({ expectedStart: event.target.value })} />
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" type="date" value={filters.expectedEnd} onChange={(event) => set({ expectedEnd: event.target.value })} />
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" type="date" value={filters.actualStart} onChange={(event) => set({ actualStart: event.target.value })} />
        <input className="h-11 rounded-xl border border-line bg-white px-3 text-sm" type="date" value={filters.actualEnd} onChange={(event) => set({ actualEnd: event.target.value })} />
        <button type="button" onClick={() => setFilters(emptyFilters)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-muted shadow-sm transition hover:border-[#2563eb]/30 hover:text-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40" disabled={!hasFilters}>
          <X className="h-4 w-4" />
          {copy.reset}
        </button>
      </div>
    </div>
  );
}

function SummaryStrip({ summary, copy, formatNumber }: { summary: ReturnType<typeof buildTableSummary>; copy: PurchaseCopy; formatNumber: (value: number) => string }) {
  const items = [
    [copy.productCount, summary.productCount],
    [copy.skuCount, summary.skuCount],
    [copy.purchaseQty, summary.purchaseQty],
    [copy.arrivedQty, summary.arrivedQty],
    [copy.notArrivedQty, summary.notArrivedQty],
    [copy.abnormalQty, summary.abnormalQty]
  ] as const;
  return (
    <div className="mb-4 grid gap-2 rounded-2xl border border-line bg-slate-50/70 p-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-white px-3 py-2 shadow-sm">
          <div className="text-[11px] font-bold text-muted">{label}</div>
          <div className="premium-number mt-1 text-lg font-semibold text-ink">{formatNumber(value)}</div>
        </div>
      ))}
    </div>
  );
}

function CardMini({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-2 ${danger ? "border-red-100 bg-red-50 text-red-700" : "border-line bg-white text-ink"}`}>
      <div className="text-[11px] font-bold text-muted">{label}</div>
      <div className="premium-number mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function InfoLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-muted">{label}</div>
      <div className={`mt-1 ${strong ? "font-black text-ink" : "font-semibold text-ink/75"}`}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm font-semibold text-muted">{text}</div>;
}

function InlineStatusSelect<T extends string>({ value, options, label, tone, onChange }: { value: string; options: readonly T[]; label: (value: T) => string; tone: (value: string) => string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-9 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${tone(value)}`}>
      {options.map((status) => <option key={status} value={status}>{label(status)}</option>)}
    </select>
  );
}

function StatusBadge({ status, copy }: { status: OverallStatus; copy: PurchaseCopy }) {
  const tone = overallTone(status);
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black ${tone}`}>{overallStatusLabel(status, copy)}</span>;
}

function SkuBadge({ sku }: { sku?: string | null }) {
  return <span className="inline-flex whitespace-nowrap rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 font-mono text-[11px] font-black tracking-[0.02em] text-blue-700">{sku || "-"}</span>;
}

function ProductNameCell({ unit }: { unit: PurchaseUnit }) {
  return (
    <div className="min-w-[260px] max-w-[420px]">
      <div className="line-clamp-2 text-sm font-semibold leading-5 text-ink">{unit.productName || "-"}</div>
      <div className="mt-1 text-xs font-semibold text-muted">{unit.usesBatch ? unit.batchNo || "-" : "-"}</div>
    </div>
  );
}

function MiniRate({ value }: { value: number }) {
  return (
    <div className="min-w-[96px]">
      <div className="text-xs font-black tabular-nums text-ink">{value.toFixed(0)}%</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function IconButton({ label, icon: Icon, onClick, danger = false }: { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={label} onClick={onClick} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-line bg-white text-ink hover:border-[#2563eb]/30 hover:text-[#2563eb]"}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function PurchaseTh({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`border-b border-line px-4 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-ink/50 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function PurchaseTd({ children, align = "left", strong = false, mono = false }: { children: React.ReactNode; align?: "left" | "right"; strong?: boolean; mono?: boolean }) {
  return <td className={`border-b border-line px-4 py-3 align-middle text-sm ${align === "right" ? "text-right tabular-nums" : "text-left"} ${strong ? "font-semibold text-ink" : "text-ink/78"} ${mono ? "font-mono text-xs font-semibold" : ""}`}>{children}</td>;
}

type PurchaseCopy = ReturnType<typeof purchaseCopy>;
type TodoItem = { product: string; sku: string; issue: string; quantity: number; owner: string; action: string; priority: "P1" | "P2" | "P3" };

function buildPurchaseUnits(orders: PurchaseOrderWithProduct[], batches: PurchaseBatch[], productMap: Map<string, ProductWithStock>) {
  const batchesByOrder = new Map<string, PurchaseBatch[]>();
  batches.forEach((batch) => {
    const list = batchesByOrder.get(batch.purchase_order_id) ?? [];
    list.push(batch);
    batchesByOrder.set(batch.purchase_order_id, list);
  });

  return orders.flatMap((order) => {
    const product = order.products ?? productMap.get(order.product_id);
    const productName = product?.name ?? "-";
    const productFamily = productFamilyName(productName);
    const unitPrice = money(product?.purchase_price ?? 0);
    const orderBatches = batchesByOrder.get(order.id) ?? [];

    if (orderBatches.length) {
      return orderBatches.map((batch) => toUnitFromBatch(order, batch, product, productName, productFamily, unitPrice));
    }

    return [toUnitFromOrder(order, product, productName, productFamily, unitPrice)];
  });
}

function toUnitFromOrder(order: PurchaseOrderWithProduct, product: PurchaseOrderWithProduct["products"] | ProductWithStock | undefined, productName: string, productFamily: string, unitPrice: number): PurchaseUnit {
  const quantity = safeQty(order.quantity);
  return {
    id: order.id,
    orderId: order.id,
    usesBatch: false,
    productId: order.product_id,
    productName,
    productFamily,
    sku: product?.sku ?? "-",
    color: product?.color ?? "",
    size: product?.size ?? "",
    factoryName: order.factory_name ?? "",
    quantity,
    unitPrice,
    amount: quantity * unitPrice,
    productionStatus: normalizeProduction(order.production_status),
    shippingStatus: normalizeShipping(order.shipping_status),
    expectedProductionDate: null,
    expectedShippingDate: null,
    expectedArrivalDate: order.expected_arrival_date,
    actualArrivalDate: normalizeShipping(order.shipping_status) === "received" ? order.expected_arrival_date : null,
    logisticsCompany: null,
    trackingNo: null,
    memo: order.memo
  };
}

function toUnitFromBatch(order: PurchaseOrderWithProduct, batch: PurchaseBatch, product: PurchaseOrderWithProduct["products"] | ProductWithStock | undefined, productName: string, productFamily: string, unitPrice: number): PurchaseUnit {
  const quantity = safeQty(batch.quantity);
  return {
    id: batch.id,
    orderId: order.id,
    batchId: batch.id,
    batchNo: batch.batch_no,
    usesBatch: true,
    productId: order.product_id,
    productName: batch.product_name || productName,
    productFamily: productFamilyName(batch.product_name || productName),
    sku: batch.sku || product?.sku || "-",
    color: product?.color ?? "",
    size: product?.size ?? "",
    factoryName: batch.factory_name || order.factory_name || "",
    quantity,
    unitPrice,
    amount: quantity * unitPrice,
    productionStatus: normalizeProduction(batch.production_status || order.production_status),
    shippingStatus: normalizeShipping(batch.shipping_status || order.shipping_status),
    expectedProductionDate: batch.expected_production_date,
    expectedShippingDate: batch.expected_shipping_date,
    expectedArrivalDate: batch.expected_arrival_date || order.expected_arrival_date,
    actualArrivalDate: batch.actual_arrival_date,
    logisticsCompany: batch.logistics_company,
    trackingNo: batch.tracking_no,
    memo: batch.memo || order.memo
  };
}

function filterPurchaseUnits(units: PurchaseUnit[], filters: PurchaseFilters) {
  return units.filter((unit) => {
    const status = inferUnitOverallStatus(unit);
    const haystack = normalizeSearch([unit.productName, unit.productFamily, unit.sku, unit.factoryName, unit.color, unit.size, unit.memo, unit.batchNo].filter(Boolean).join(" "));
    if (filters.query && !haystack.includes(normalizeSearch(filters.query))) return false;
    if (filters.productName && !normalizeSearch(unit.productName).includes(normalizeSearch(filters.productName))) return false;
    if (filters.sku && !normalizeSearch(unit.sku).includes(normalizeSearch(filters.sku))) return false;
    if (filters.factory && !normalizeSearch(unit.factoryName).includes(normalizeSearch(filters.factory))) return false;
    if (filters.color && !normalizeSearch(unit.color).includes(normalizeSearch(filters.color))) return false;
    if (filters.size && !normalizeSearch(unit.size).includes(normalizeSearch(filters.size))) return false;
    if (filters.productionStatus && unit.productionStatus !== filters.productionStatus) return false;
    if (filters.shippingStatus && unit.shippingStatus !== filters.shippingStatus) return false;
    if (filters.overallStatus && status !== filters.overallStatus) return false;
    if (filters.arrivalState === "received" && unit.shippingStatus !== "received") return false;
    if (filters.arrivalState === "not_received" && unit.shippingStatus === "received") return false;
    if (filters.abnormalState === "abnormal" && !isAbnormal(unit)) return false;
    if (filters.abnormalState === "normal" && isAbnormal(unit)) return false;
    if (filters.expectedStart && (!unit.expectedArrivalDate || unit.expectedArrivalDate < filters.expectedStart)) return false;
    if (filters.expectedEnd && (!unit.expectedArrivalDate || unit.expectedArrivalDate > filters.expectedEnd)) return false;
    if (filters.actualStart && (!unit.actualArrivalDate || unit.actualArrivalDate < filters.actualStart)) return false;
    if (filters.actualEnd && (!unit.actualArrivalDate || unit.actualArrivalDate > filters.actualEnd)) return false;
    return true;
  });
}

function buildProductCards(units: PurchaseUnit[], copy: PurchaseCopy): ProductControlCard[] {
  const groups = new Map<string, PurchaseUnit[]>();
  units.forEach((unit) => {
    const key = normalizeSearch(unit.productFamily) || unit.productName;
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  });

  return Array.from(groups.entries()).map(([key, rows]) => {
    const totalQuantity = sumQty(rows);
    const productionCompletedQty = rows.filter(isProductionCompleted).reduce((sum, unit) => sum + unit.quantity, 0);
    const shippedQty = rows.filter((unit) => unit.shippingStatus !== "not_shipped").reduce((sum, unit) => sum + unit.quantity, 0);
    const inTransitQty = rows.filter((unit) => unit.shippingStatus === "customs" || unit.shippingStatus === "in_korea").reduce((sum, unit) => sum + unit.quantity, 0);
    const arrivedQty = rows.filter((unit) => unit.shippingStatus === "received").reduce((sum, unit) => sum + unit.quantity, 0);
    const abnormalQty = rows.filter(isAbnormal).reduce((sum, unit) => sum + unit.quantity, 0);
    const status = inferProductStatus(totalQuantity, productionCompletedQty, shippedQty, inTransitQty, arrivedQty, abnormalQty, rows);

    return {
      key,
      productName: rows[0]?.productFamily || rows[0]?.productName || "-",
      factories: Array.from(new Set(rows.map((unit) => unit.factoryName).filter(Boolean))),
      units: rows,
      skuCount: new Set(rows.map((unit) => unit.sku)).size,
      totalQuantity,
      totalAmount: rows.reduce((sum, unit) => sum + unit.amount, 0),
      productionCompletedQty,
      productionIncompleteQty: Math.max(0, totalQuantity - productionCompletedQty),
      shippedQty,
      inTransitQty,
      arrivedQty,
      notArrivedQty: Math.max(0, totalQuantity - arrivedQty),
      abnormalQty,
      status,
      action: actionForStatus(status, copy),
      breakdown: {
        pending: rows.filter((unit) => unit.productionStatus === "pending" && unit.shippingStatus !== "received").reduce((sum, unit) => sum + unit.quantity, 0),
        producing: rows.filter((unit) => unit.productionStatus === "producing" && unit.shippingStatus !== "received").reduce((sum, unit) => sum + unit.quantity, 0),
        completedNotShipped: rows.filter((unit) => unit.productionStatus === "completed" && unit.shippingStatus === "not_shipped").reduce((sum, unit) => sum + unit.quantity, 0),
        shippedTransit: rows.filter((unit) => unit.shippingStatus === "shipped_from_china" || unit.shippingStatus === "customs" || unit.shippingStatus === "in_korea").reduce((sum, unit) => sum + unit.quantity, 0),
        abnormal: abnormalQty
      }
    };
  }).sort((a, b) => b.notArrivedQty - a.notArrivedQty || b.totalQuantity - a.totalQuantity);
}

function buildControlAnalytics(units: PurchaseUnit[]) {
  const totalQuantity = sumQty(units);
  const arrivedQty = units.filter((unit) => unit.shippingStatus === "received").reduce((sum, unit) => sum + unit.quantity, 0);
  return {
    totalAmount: units.reduce((sum, unit) => sum + unit.amount, 0),
    totalQuantity,
    productionCompletedQty: units.filter(isProductionCompleted).reduce((sum, unit) => sum + unit.quantity, 0),
    shippedQty: units.filter((unit) => unit.shippingStatus !== "not_shipped").reduce((sum, unit) => sum + unit.quantity, 0),
    arrivedQty,
    notArrivedQty: Math.max(0, totalQuantity - arrivedQty),
    arrivalRate: rate(arrivedQty, totalQuantity),
    abnormalQty: units.filter(isAbnormal).reduce((sum, unit) => sum + unit.quantity, 0)
  };
}

function buildProductionStats(units: PurchaseUnit[], copy: PurchaseCopy) {
  return [
    { label: copy.pending, value: units.filter((unit) => unit.productionStatus === "pending").reduce((sum, unit) => sum + unit.quantity, 0), color: "#9ca3af" },
    { label: copy.producing, value: units.filter((unit) => unit.productionStatus === "producing").reduce((sum, unit) => sum + unit.quantity, 0), color: "#2563eb" },
    { label: copy.completed, value: units.filter(isProductionCompleted).reduce((sum, unit) => sum + unit.quantity, 0), color: "#16a34a" },
    { label: copy.abnormal, value: units.filter(isAbnormal).reduce((sum, unit) => sum + unit.quantity, 0), color: "#dc2626" }
  ];
}

function buildShippingStats(units: PurchaseUnit[], copy: PurchaseCopy) {
  return [
    { label: copy.notShipped, value: units.filter((unit) => unit.shippingStatus === "not_shipped").reduce((sum, unit) => sum + unit.quantity, 0), color: "#9ca3af" },
    { label: copy.shipped, value: units.filter((unit) => unit.shippingStatus === "shipped_from_china").reduce((sum, unit) => sum + unit.quantity, 0), color: "#2563eb" },
    { label: copy.inTransit, value: units.filter((unit) => unit.shippingStatus === "customs" || unit.shippingStatus === "in_korea").reduce((sum, unit) => sum + unit.quantity, 0), color: "#d97706" },
    { label: copy.received, value: units.filter((unit) => unit.shippingStatus === "received").reduce((sum, unit) => sum + unit.quantity, 0), color: "#16a34a" }
  ];
}

function buildTodoItems(units: PurchaseUnit[], copy: PurchaseCopy): TodoItem[] {
  const today = startOfDay(new Date());
  const items: TodoItem[] = [];

  units.forEach((unit) => {
    if (unit.productionStatus === "producing" && isPast(unit.expectedProductionDate, today)) {
      items.push({ product: unit.productFamily, sku: unit.sku, issue: copy.productionOverdue, quantity: unit.quantity, owner: unit.factoryName, action: copy.pushFactory, priority: "P1" });
    }
    if (unit.productionStatus === "completed" && unit.shippingStatus === "not_shipped") {
      items.push({ product: unit.productFamily, sku: unit.sku, issue: copy.completedNotShippedIssue, quantity: unit.quantity, owner: unit.factoryName, action: copy.pushShipping, priority: "P2" });
    }
    if (unit.shippingStatus !== "received" && unit.shippingStatus !== "not_shipped" && isPast(unit.expectedArrivalDate, today)) {
      items.push({ product: unit.productFamily, sku: unit.sku, issue: copy.arrivalOverdue, quantity: unit.quantity, owner: unit.logisticsCompany || "-", action: copy.checkLogistics, priority: "P1" });
    }
    if (isAbnormal(unit)) {
      items.push({ product: unit.productFamily, sku: unit.sku, issue: copy.abnormalStatus, quantity: unit.quantity, owner: unit.factoryName, action: copy.handleAbnormal, priority: "P1" });
    }
    if (unit.shippingStatus !== "received" && unit.quantity > 0) {
      items.push({ product: unit.productFamily, sku: unit.sku, issue: copy.notFullyReceivedIssue, quantity: unit.quantity, owner: unit.factoryName, action: copy.confirmPartialArrival, priority: "P3" });
    }
  });

  return items.sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority));
}

function buildTableSummary(units: PurchaseUnit[], cards: ProductControlCard[]) {
  const purchaseQty = sumQty(units);
  const arrivedQty = units.filter((unit) => unit.shippingStatus === "received").reduce((sum, unit) => sum + unit.quantity, 0);
  return {
    productCount: cards.length,
    skuCount: new Set(units.map((unit) => unit.sku)).size,
    purchaseQty,
    arrivedQty,
    notArrivedQty: Math.max(0, purchaseQty - arrivedQty),
    abnormalQty: units.filter(isAbnormal).reduce((sum, unit) => sum + unit.quantity, 0)
  };
}

function inferProductStatus(total: number, productionCompleted: number, shipped: number, inTransit: number, arrived: number, abnormal: number, units: PurchaseUnit[]): OverallStatus {
  if (abnormal > 0) return "abnormal";
  if (total > 0 && arrived === total) return "all_received";
  if (arrived > 0 && arrived < total) return "partial_received";
  if (inTransit > 0) return "in_transit";
  if (shipped > 0) return "shipped";
  if (productionCompleted > 0 && units.some((unit) => unit.shippingStatus === "not_shipped")) return "waiting_ship";
  if (units.some((unit) => unit.productionStatus === "producing")) return "producing";
  return "pending";
}

function inferUnitOverallStatus(unit: PurchaseUnit): OverallStatus {
  if (isAbnormal(unit)) return "abnormal";
  if (unit.shippingStatus === "received") return "all_received";
  if (unit.shippingStatus === "customs" || unit.shippingStatus === "in_korea") return "in_transit";
  if (unit.shippingStatus === "shipped_from_china") return "shipped";
  if (unit.productionStatus === "completed" && unit.shippingStatus === "not_shipped") return "waiting_ship";
  if (unit.productionStatus === "producing") return "producing";
  return "pending";
}

function actionForStatus(status: OverallStatus, copy: PurchaseCopy) {
  const actions: Record<OverallStatus, string> = {
    abnormal: copy.actionAbnormal,
    all_received: copy.actionAllReceived,
    partial_received: copy.actionPartialReceived,
    in_transit: copy.actionInTransit,
    shipped: copy.actionShipped,
    waiting_ship: copy.actionWaitingShip,
    producing: copy.actionProducing,
    pending: copy.actionPending
  };
  return actions[status];
}

function overallStatusLabel(status: OverallStatus, copy: PurchaseCopy) {
  const labels: Record<OverallStatus, string> = {
    abnormal: copy.abnormal,
    all_received: copy.allReceived,
    partial_received: copy.partialReceived,
    in_transit: copy.inTransit,
    shipped: copy.shipped,
    waiting_ship: copy.waitingShip,
    producing: copy.producing,
    pending: copy.pending
  };
  return labels[status];
}

function productionStatusLabel(status: string, copy: PurchaseCopy) {
  const labels: Record<string, string> = {
    pending: copy.pending,
    producing: copy.producing,
    completed: copy.completed,
    delayed: copy.delayed,
    cancelled: copy.cancelled
  };
  return labels[status] ?? copy.status;
}

function shippingStatusLabel(status: string, copy: PurchaseCopy) {
  const labels: Record<string, string> = {
    not_shipped: copy.notShipped,
    shipped_from_china: copy.shipped,
    customs: copy.customs,
    in_korea: copy.inKorea,
    received: copy.received
  };
  return labels[status] ?? copy.status;
}

function productionTone(status: string) {
  if (status === "pending") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status === "producing") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function shippingTone(status: string) {
  if (status === "not_shipped") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status === "shipped_from_china") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "customs" || status === "in_korea") return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function overallTone(status: OverallStatus) {
  const tones: Record<OverallStatus, string> = {
    pending: "border-slate-200 bg-slate-50 text-slate-700",
    producing: "border-blue-200 bg-blue-50 text-blue-800",
    waiting_ship: "border-purple-200 bg-purple-50 text-purple-800",
    shipped: "border-blue-200 bg-blue-50 text-blue-800",
    in_transit: "border-orange-200 bg-orange-50 text-orange-800",
    partial_received: "border-teal-200 bg-teal-50 text-teal-800",
    all_received: "border-emerald-200 bg-emerald-50 text-emerald-800",
    abnormal: "border-red-200 bg-red-50 text-red-800"
  };
  return tones[status];
}

function productFamilyName(name: string) {
  const normalized = name.replace(/\s+/g, " ").trim();
  const isHoneycomb = /허니콤|蜂巢|honeycomb/i.test(normalized);
  const isBlackout = /암막|全遮光|遮光|blackout/i.test(normalized);
  const isDimout = /반차광|半遮光|light\s*filtering|dimout/i.test(normalized);

  if (isHoneycomb && isDimout) return "허니콤 반차광 블라인드";
  if (isHoneycomb && isBlackout) return "허니콤 암막 블라인드";

  return normalized
    .replace(/\d+(?:\.\d+)?\s*(?:cm|m)?\s*[xX×*]\s*\d+(?:\.\d+)?\s*(?:cm|m)?/g, "")
    .replace(/\d+(?:\.\d+)?\s*(?:cm|m)\b/gi, "")
    .replace(/\b(화이트|블랙|그레이|베이지|白色|黑色|灰色|米色|흰색|검정|회색|white|black|gray|grey|beige)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || normalized;
}

function isProductionCompleted(unit: PurchaseUnit) {
  return unit.productionStatus === "completed" || unit.shippingStatus !== "not_shipped";
}

function isAbnormal(unit: PurchaseUnit) {
  return unit.productionStatus === "delayed" || unit.productionStatus === "cancelled";
}

function normalizeProduction(status?: string | null): ProductionStatus {
  return productionStatuses.includes(status as ProductionStatus) ? status as ProductionStatus : "pending";
}

function normalizeShipping(status?: string | null): ShippingStatus {
  return shippingStatuses.includes(status as ShippingStatus) ? status as ShippingStatus : "not_shipped";
}

function safeQty(value: number | null | undefined) {
  return Math.max(0, Number(value ?? 0));
}

function sumQty(units: PurchaseUnit[]) {
  return units.reduce((sum, unit) => sum + unit.quantity, 0);
}

function rate(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function normalizeSearch(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isPast(dateKey: string | null, today: Date) {
  if (!dateKey) return false;
  return new Date(`${dateKey}T00:00:00`).getTime() < today.getTime();
}

function priorityScore(priority: TodoItem["priority"]) {
  return priority === "P1" ? 1 : priority === "P2" ? 2 : 3;
}

function dateText(dateKey: string | null, formatDate: (value: string) => string) {
  return dateKey ? formatDate(`${dateKey}T12:00:00`) : "-";
}

function purchaseCopy(language: Language) {
  if (language === "ko") {
    return {
      title: "구매 컨트롤 센터",
      subtitle: "총괄, 상품, SKU, 배치, 다음 조치를 한 화면에서 확인하는 Coupang 운영형 구매 추적 센터입니다.",
      flow: "총괄 → 상품 → SKU → 배치 → 조치",
      controlCenter: "구매 컨트롤 센터",
      productControlTitle: "상품 구매 컨트롤 요약",
      totalAmount: "구매 총액",
      totalQuantity: "구매 총수량",
      productionCompletedQty: "생산 완료 수량",
      shippedQty: "발송 완료 수량",
      arrivedQty: "한국 창고 입고 수량",
      notArrivedQty: "한국 창고 미입고 수량",
      arrivalRate: "입고 완료율",
      abnormalQty: "이상 수량",
      productionOverview: "생산 상태 통계",
      shippingOverview: "발송 상태 통계",
      pending: "생산 대기",
      producing: "생산 중",
      completed: "생산 완료",
      delayed: "지연",
      cancelled: "취소",
      abnormal: "이상",
      notShipped: "미발송",
      shipped: "발송 완료",
      customs: "통관 중",
      inKorea: "한국 운송 중",
      inTransit: "운송 중",
      received: "입고 완료",
      allReceived: "전체 입고",
      partialReceived: "부분 입고",
      waitingShip: "발송 대기",
      nextAction: "다음 조치",
      actionAbnormal: "이상 원인 즉시 확인",
      actionAllReceived: "판매/재고 관리로 전환 가능",
      actionPartialReceived: "미입고 수량 후속 확인",
      actionInTransit: "예상 입고일 물류사 확인",
      actionShipped: "물류 트래킹 확인",
      actionWaitingShip: "공장/물류사 발송 독촉",
      actionProducing: "예상 완료일 확인",
      actionPending: "공장 생산 일정 확인",
      productPurchaseStatus: "상품 구매 상태",
      purchaseCreated: "구매 생성",
      factoryCompleted: "공장 생산 완료",
      internationalShipping: "국제 발송",
      koreaWarehouseIn: "한국 창고 입고",
      notArrivedBreakdown: "상품 미입고 상세",
      completedNotShipped: "생산 완료 미발송",
      shippedTransit: "발송/운송 중",
      todoTitle: "구매 처리 필요 항목",
      issue: "문제",
      quantity: "수량",
      owner: "담당",
      suggestedAction: "권장 조치",
      productionOverdue: "생산 완료 예정일 초과",
      completedNotShippedIssue: "생산 완료 후 미발송",
      arrivalOverdue: "예상 입고일 초과",
      abnormalStatus: "이상 상태",
      notFullyReceivedIssue: "구매 수량 대비 미입고",
      pushFactory: "공장 독촉",
      pushShipping: "발송 요청",
      checkLogistics: "물류사 확인",
      handleAbnormal: "이상 처리",
      confirmPartialArrival: "분할 입고 여부 확인",
      noTodo: "현재 긴급 처리 항목이 없습니다.",
      addTitle: "구매 등록",
      editTitle: "구매 수정",
      saving: "저장 중",
      orderTable: "구매 주문 관리",
      products: "상품",
      productCount: "상품 시리즈",
      skuCount: "SKU 수",
      purchaseQty: "구매 수량",
      unitPrice: "단가",
      amount: "금액",
      sku: "SKU",
      productName: "상품명",
      color: "색상",
      size: "사이즈",
      factory: "공장",
      productionStatus: "생산 상태",
      shippingStatus: "발송 상태",
      expectedArrivalDate: "예상 입고일",
      actualArrivalDate: "실제 입고일",
      currentStatus: "현재 상태",
      memo: "메모",
      actions: "작업",
      edit: "수정",
      delete: "삭제",
      batch: "배치",
      batchManagement: "배치 관리",
      noBatch: "단일 구매",
      noData: "조건에 맞는 구매 데이터가 없습니다.",
      searchPlaceholder: "상품명 / SKU / 공장 / 메모 검색",
      allProduction: "전체 생산 상태",
      allShipping: "전체 발송 상태",
      allOverall: "전체 상태",
      allArrival: "전체 입고 여부",
      arrived: "입고 완료",
      notArrived: "미입고",
      allAbnormal: "전체 이상 여부",
      onlyAbnormal: "이상만",
      onlyNormal: "정상만",
      reset: "초기화",
      status: "상태"
    };
  }

  return {
    title: "采购跟单作战中心",
    subtitle: "从总览、产品、SKU、批次到下一步动作，统一跟踪韩国 Coupang 采购执行状态。",
    flow: "总览层 → 产品层 → SKU 层 → 批次层 → 动作层",
    controlCenter: "采购作战中心",
    productControlTitle: "产品采购作战总览",
    totalAmount: "采购总金额",
    totalQuantity: "采购总数量",
    productionCompletedQty: "已生产完成数量",
    shippedQty: "已发货数量",
    arrivedQty: "已到韩国仓数量",
    notArrivedQty: "未到韩国仓数量",
    arrivalRate: "到仓完成率",
    abnormalQty: "异常数量",
    productionOverview: "生产状态统计",
    shippingOverview: "发货状态统计",
    pending: "待生产",
    producing: "生产中",
    completed: "已完成",
    delayed: "延期",
    cancelled: "已取消",
    abnormal: "异常",
    notShipped: "未发货",
    shipped: "已发货",
    customs: "清关中",
    inKorea: "韩国运输中",
    inTransit: "运输中",
    received: "已到仓",
    allReceived: "全部到仓",
    partialReceived: "部分到仓",
    waitingShip: "待发货",
    nextAction: "下一步动作",
    actionAbnormal: "立即确认异常原因",
    actionAllReceived: "可以进入销售/库存管理",
    actionPartialReceived: "跟进剩余未到仓数量",
    actionInTransit: "跟进物流预计到仓日",
    actionShipped: "确认物流轨迹",
    actionWaitingShip: "催工厂/货代安排发货",
    actionProducing: "确认预计完成日期",
    actionPending: "确认工厂排产",
    productPurchaseStatus: "产品采购状态",
    purchaseCreated: "采购创建",
    factoryCompleted: "工厂生产完成",
    internationalShipping: "国际发货",
    koreaWarehouseIn: "韩国仓入库",
    notArrivedBreakdown: "产品未到仓拆解",
    completedNotShipped: "生产完成未发货",
    shippedTransit: "已发货运输中",
    todoTitle: "采购待处理事项",
    issue: "问题",
    quantity: "数量",
    owner: "负责人",
    suggestedAction: "建议动作",
    productionOverdue: "生产中超过预计完成日",
    completedNotShippedIssue: "生产完成但未发货",
    arrivalOverdue: "已发货超过预计到仓日",
    abnormalStatus: "存在异常状态",
    notFullyReceivedIssue: "到仓数量小于采购数量",
    pushFactory: "催工厂",
    pushShipping: "催发货",
    checkLogistics: "催货代",
    handleAbnormal: "处理异常",
    confirmPartialArrival: "确认是否分批到仓",
    noTodo: "当前没有紧急待处理事项。",
    addTitle: "新增采购计划",
    editTitle: "编辑采购计划",
    saving: "保存中",
    orderTable: "采购订单管理",
    products: "个产品",
    productCount: "产品系列",
    skuCount: "SKU 数量",
    purchaseQty: "采购数量",
    unitPrice: "单价",
    amount: "总金额",
    sku: "SKU",
    productName: "产品名称",
    color: "颜色",
    size: "尺寸",
    factory: "工厂",
    productionStatus: "生产状态",
    shippingStatus: "发货状态",
    expectedArrivalDate: "预计到仓日",
    actualArrivalDate: "实际到仓日",
    currentStatus: "当前状态",
    memo: "备注",
    actions: "操作",
    edit: "编辑",
    delete: "删除",
    batch: "批次",
    batchManagement: "批次管理",
    noBatch: "未分批",
    noData: "暂无符合条件的采购数据。",
    searchPlaceholder: "搜索产品 / SKU / 工厂 / 备注",
    allProduction: "全部生产状态",
    allShipping: "全部发货状态",
    allOverall: "全部整体状态",
    allArrival: "全部到仓状态",
    arrived: "已到仓",
    notArrived: "未到仓",
    allAbnormal: "全部异常状态",
    onlyAbnormal: "只看异常",
    onlyNormal: "只看正常",
    reset: "重置",
    status: "状态"
  };
}
