"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Edit3,
  Factory,
  PackageCheck,
  Plane,
  Save,
  Ship,
  Trash2,
  Truck,
  type LucideIcon
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AppShell } from "@/components/AppShell";
import { ProductSelect } from "@/components/ProductSelect";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/profit";
import { supabase } from "@/lib/supabase";
import type { Language, ProductWithStock, PurchaseOrder } from "@/lib/types";

type PurchaseStatusOption = "pending" | "producing" | "completed" | "delayed" | "cancelled";
type ShippingStatusOption = "not_shipped" | "shipped_from_china" | "customs" | "in_korea" | "received";
type PurchaseOrderWithProduct = PurchaseOrder & {
  products?: Pick<ProductWithStock, "name" | "sku" | "purchase_price" | "inventory_balances"> | null;
};

const productionStatuses = ["pending", "producing", "completed", "delayed", "cancelled"] as const;
const shippingStatuses = ["not_shipped", "shipped_from_china", "customs", "in_korea", "received"] as const;

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    factory_name: "",
    quantity: "1",
    production_status: "pending",
    shipping_status: "not_shipped",
    expected_arrival_date: "",
    memo: ""
  });
  const [message, setMessage] = useState("");

  const isEditing = Boolean(editingId);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const analytics = useMemo(() => buildPurchaseAnalytics(orders, productMap), [orders, productMap]);
  const health = purchaseHealth(analytics, copy);
  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: productRows }, { data: orderRows }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      supabase.from("purchase_orders").select("*, products(name, sku, purchase_price, inventory_balances(current_stock))").order("created_at", { ascending: false })
    ]);
    setProducts((productRows ?? []) as ProductWithStock[]);
    setOrders((orderRows ?? []) as PurchaseOrderWithProduct[]);
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

  function startEdit(order: PurchaseOrder) {
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
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#bca77a]/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-section-eyebrow">
              <ClipboardList className="h-3.5 w-3.5" />
              Procurement Center
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.subtitle}</p>
          </div>
          <HealthCard health={health} copy={copy} />
        </div>
      </section>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <ProcurementKpi icon={CircleDollarSign} label={copy.totalAmount} value={formatCurrency(analytics.totalAmount)} tag={copy.autoCalculated} tone="green" />
        <ProcurementKpi icon={Boxes} label={copy.totalQuantity} value={formatNumber(analytics.totalQuantity)} tag={copy.activeOrders} tone="blue" />
        <ProcurementKpi icon={Clock3} label={copy.pendingQty} value={formatNumber(analytics.pendingQty)} tag={copy.toSchedule} tone="yellow" />
        <ProcurementKpi icon={Factory} label={copy.producingQty} value={formatNumber(analytics.producingQty)} tag={copy.inProgress} tone="blue" />
        <ProcurementKpi icon={Ship} label={copy.waitingShipQty} value={formatNumber(analytics.waitingShipQty)} tag={copy.awaitingDispatch} tone="slate" />
        <ProcurementKpi icon={PackageCheck} label={copy.expectedArrivalQty} value={formatNumber(analytics.expectedArrivalQty)} tag={copy.inboundReady} tone="green" />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-2">
        <StatusDonut title={copy.productionOverview} data={productionDonutData(orders, copy)} />
        <StatusDonut title={copy.shippingOverview} data={shippingDonutData(orders, copy)} />
      </section>

      <section className="premium-dashboard-panel mb-5 rounded-[28px] p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="premium-section-eyebrow">Purchase Entry</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{isEditing ? copy.editTitle : copy.addTitle}</h2>
          </div>
          {isEditing ? (
            <button type="button" onClick={resetForm} className="rounded-xl border border-line bg-white/80 px-3 py-2 text-xs font-semibold text-muted shadow-sm transition hover:border-brand/30 hover:text-brand">
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
            {productionStatuses.map((status) => <option key={status} value={status}>{productionStatusLabel(status, t)}</option>)}
          </select>
          <select value={form.shipping_status} onChange={(e) => setForm({ ...form, shipping_status: e.target.value })}>
            {shippingStatuses.map((status) => <option key={status} value={status}>{shippingStatusLabel(status, t)}</option>)}
          </select>
          <input className="md:col-span-1" placeholder={t("common.memo")} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl bg-gradient-to-br from-brand to-brand-strong px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="inline-flex items-center justify-center gap-2">
                <Save className="h-4 w-4" />
                {saving ? copy.saving : isEditing ? t("purchase.update") : t("common.save")}
              </span>
            </button>
            {isEditing ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-line bg-white/80 px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand/30 hover:text-brand">
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
          <span className="premium-status-chip px-3 py-1.5 text-xs font-semibold text-muted">{formatNumber(orders.length)} SKU</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/65 bg-white/76 shadow-[0_18px_48px_rgba(31,44,38,0.06)] backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-[1420px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-[#f3f5ee]/95 backdrop-blur-xl">
                <tr>
                  <PurchaseTh>{t("common.sku")}</PurchaseTh>
                  <PurchaseTh>{t("common.productName")}</PurchaseTh>
                  <PurchaseTh>{t("common.factory")}</PurchaseTh>
                  <PurchaseTh align="right">{t("common.quantity")}</PurchaseTh>
                  <PurchaseTh align="right">{copy.amount}</PurchaseTh>
                  <PurchaseTh>{t("purchase.productionStatus")}</PurchaseTh>
                  <PurchaseTh>{t("purchase.shippingStatus")}</PurchaseTh>
                  <PurchaseTh>{t("purchase.eta")}</PurchaseTh>
                  <PurchaseTh>{copy.timeline}</PurchaseTh>
                  <PurchaseTh>{t("common.memo")}</PurchaseTh>
                  <PurchaseTh align="right">{t("common.actions")}</PurchaseTh>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const product = productMap.get(order.product_id);
                  const amount = orderAmount(order, product);
                  return (
                    <tr key={order.id} className="group transition odd:bg-white/45 hover:bg-[#eef3ed]/80">
                      <PurchaseTd mono><SkuBadge sku={order.products?.sku} /></PurchaseTd>
                      <PurchaseTd><ProductNameCell name={order.products?.name} stock={currentStock(order.products)} copy={copy} /></PurchaseTd>
                      <PurchaseTd>{order.factory_name}</PurchaseTd>
                      <PurchaseTd align="right">{formatNumber(order.quantity)}</PurchaseTd>
                      <PurchaseTd align="right" strong>{formatCurrency(amount)}</PurchaseTd>
                      <PurchaseTd>
                        <InlineStatusSelect value={order.production_status} options={productionStatuses} label={(status) => productionStatusLabel(status, t)} tone={(status) => productionTone(status)} onChange={(value) => updateOrder(order.id, { production_status: value })} />
                      </PurchaseTd>
                      <PurchaseTd>
                        <InlineStatusSelect value={order.shipping_status} options={shippingStatuses} label={(status) => shippingStatusLabel(status, t)} tone={(status) => shippingTone(status)} onChange={(value) => updateOrder(order.id, { shipping_status: value })} />
                      </PurchaseTd>
                      <PurchaseTd>{order.expected_arrival_date ? formatDate(`${order.expected_arrival_date}T12:00:00`) : "-"}</PurchaseTd>
                      <PurchaseTd><PurchaseTimeline order={order} copy={copy} /></PurchaseTd>
                      <PurchaseTd>{order.memo || "-"}</PurchaseTd>
                      <PurchaseTd align="right">
                        <div className="flex min-w-[92px] justify-end gap-2">
                          <IconButton label={t("common.edit")} icon={Edit3} onClick={() => startEdit(order)} />
                          <IconButton label={t("common.delete")} icon={Trash2} danger onClick={() => deleteOrder(order.id)} />
                        </div>
                      </PurchaseTd>
                    </tr>
                  );
                })}
                {!orders.length ? (
                  <tr>
                    <td colSpan={11} className="border-b border-line px-4 py-10 text-center text-sm text-muted">
                      {t("purchase.empty")}
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

function ProcurementKpi({ icon: Icon, label, value, tag, tone }: { icon: LucideIcon; label: string; value: string; tag: string; tone: "green" | "blue" | "yellow" | "slate" }) {
  const toneClass = {
    green: "from-brand/12 text-brand",
    blue: "from-[#406A7A]/14 text-[#406A7A]",
    yellow: "from-[#bca77a]/20 text-[#8a6834]",
    slate: "from-slate-500/12 text-slate-600"
  }[tone];
  return (
    <div className="premium-dashboard-card rounded-[24px] p-4 transition duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-2xl bg-gradient-to-br ${toneClass} to-white p-3 shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-muted shadow-sm">{tag}</span>
      </div>
      <div className="mt-4 text-xs font-semibold text-muted">{label}</div>
      <div className="premium-number mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function HealthCard({ health, copy }: { health: ReturnType<typeof purchaseHealth>; copy: PurchaseCopy }) {
  return (
    <div className={`min-w-[260px] rounded-3xl border p-5 shadow-soft ${health.className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{copy.healthIndex}</div>
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold shadow-sm">{health.label}</span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <div className="premium-number text-4xl font-semibold tabular-nums">{health.score}</div>
        <div className="mb-1 text-sm font-semibold opacity-70">/ 100</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/8">
        <div className="h-full rounded-full bg-current transition-all duration-500" style={{ width: `${health.score}%` }} />
      </div>
    </div>
  );
}

function FinancialPanel({ analytics, copy, formatCurrency }: { analytics: PurchaseAnalytics; copy: PurchaseCopy; formatCurrency: (value: number) => string }) {
  const items = [
    [copy.allOrderAmount, analytics.totalAmount],
    [copy.paidAmount, analytics.paidAmount],
    [copy.unpaidAmount, analytics.unpaidAmount],
    [copy.estimatedGoodsValue, analytics.expectedGoodsValue],
    [copy.inventoryValue, analytics.inventoryValue]
  ] as const;
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">Capital Overview</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.amountOverview}</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted">{label}</div>
            <div className="premium-number mt-2 text-xl font-semibold tabular-nums text-ink">{formatCurrency(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDonut({ title, data }: { title: string; data: Array<{ name: string; value: number; color: string }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-[#17483f]/15 bg-gradient-to-br from-white via-[#fbfcf8] to-[#edf4ef] p-5 shadow-[0_22px_60px_rgba(16,45,38,0.10)]">
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#17483f]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-[#bca77a]/14 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="premium-section-eyebrow">Status</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-right shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Total</div>
          <div className="premium-number mt-1 text-2xl font-semibold tabular-nums text-[#17483f]">{total}</div>
        </div>
      </div>
      <div className="relative mt-5 grid items-center gap-4 md:grid-cols-[1fr_1.1fr]">
        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                {data.map((item) => <Cell key={item.name} fill={item.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-white/70 bg-white/80 px-4 py-3 text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Live</div>
              <div className="premium-number text-xl font-semibold tabular-nums text-ink">{total}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/68 px-3 py-2 text-sm shadow-sm">
              <span className="flex items-center gap-2 font-semibold text-ink/75"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
              <span className="font-black tabular-nums text-ink">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArrivalCenter({ analytics, copy, formatNumber }: { analytics: PurchaseAnalytics; copy: PurchaseCopy; formatNumber: (value: number) => string }) {
  const items = [
    [copy.arrival7, analytics.arrival7],
    [copy.arrival15, analytics.arrival15],
    [copy.arrival30, analytics.arrival30]
  ] as const;
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">ETA Center</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.arrivalCenter}</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
            <CalendarDays className="h-5 w-5 text-brand" />
            <div className="mt-3 text-xs font-semibold text-muted">{label}</div>
            <div className="premium-number mt-2 text-3xl font-semibold tabular-nums text-ink">{formatNumber(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightPanel({ insights, copy }: { insights: string[]; copy: PurchaseCopy }) {
  return (
    <div className="premium-dashboard-panel rounded-[28px] p-5">
      <div className="premium-section-eyebrow">AI Procurement Insights</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.insightsTitle}</h2>
      <div className="mt-5 space-y-3">
        {insights.map((insight) => (
          <div key={insight} className="flex gap-3 rounded-2xl border border-white/70 bg-white/72 p-4 text-sm font-medium leading-6 text-ink shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6834]" />
            <span>{insight}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineStatusSelect<T extends string>({ value, options, label, tone, onChange }: { value: string; options: readonly T[]; label: (value: T) => string; tone: (value: string) => string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-9 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${tone(value)}`}>
      {options.map((status) => <option key={status} value={status}>{label(status)}</option>)}
    </select>
  );
}

function SkuBadge({ sku }: { sku?: string | null }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-lg border border-[#17483f]/15 bg-[#e8f1ed] px-2.5 py-1 font-mono text-[11px] font-black tracking-[0.02em] text-[#17483f] shadow-sm">
      {sku || "-"}
    </span>
  );
}

function ProductNameCell({ name, stock, copy }: { name?: string | null; stock: number; copy: PurchaseCopy }) {
  return (
    <div className="min-w-[260px] max-w-[420px]">
      <div className="line-clamp-2 text-sm font-semibold leading-5 text-ink">
        {name || "-"}
      </div>
      <div className="mt-1 text-xs font-semibold text-muted">
        {copy.stock} {stock}
      </div>
    </div>
  );
}

function PurchaseTimeline({ order, copy }: { order: PurchaseOrder; copy: PurchaseCopy }) {
  const steps = [
    { label: copy.created, done: true },
    { label: copy.production, done: order.production_status === "producing" || order.production_status === "completed" },
    { label: copy.shipped, done: order.shipping_status !== "not_shipped" },
    { label: copy.arrived, done: order.shipping_status === "received" }
  ];
  return (
    <div className="min-w-[220px]">
      <div className="flex items-center">
        {steps.map((step, index) => (
          <div key={step.label} className="flex flex-1 items-center">
            <span className={`h-2.5 w-2.5 rounded-full ${step.done ? "bg-brand" : "bg-line"}`} />
            {index < steps.length - 1 ? <span className={`h-px flex-1 ${steps[index + 1].done ? "bg-brand/60" : "bg-line"}`} /> : null}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 text-[10px] font-semibold text-muted">
        {steps.map((step) => <span key={step.label}>{step.label}</span>)}
      </div>
    </div>
  );
}

function IconButton({ label, icon: Icon, onClick, danger = false }: { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={label} onClick={onClick} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-line bg-white/80 text-ink hover:border-brand/30 hover:text-brand"}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function PurchaseTh({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`border-b border-line px-4 py-3 text-xs font-extrabold uppercase tracking-[0.1em] text-ink/50 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function PurchaseTd({ children, align = "left", strong = false, mono = false }: { children: React.ReactNode; align?: "left" | "right"; strong?: boolean; mono?: boolean }) {
  return <td className={`border-b border-line px-4 py-3 align-middle text-sm ${align === "right" ? "text-right tabular-nums" : "text-left"} ${strong ? "font-semibold text-ink" : "text-ink/78"} ${mono ? "font-mono text-xs font-semibold" : ""}`}>{children}</td>;
}

type PurchaseAnalytics = ReturnType<typeof buildPurchaseAnalytics>;
type PurchaseCopy = ReturnType<typeof purchaseCopy>;

function buildPurchaseAnalytics(orders: PurchaseOrderWithProduct[], productMap: Map<string, ProductWithStock>) {
  const today = startOfDay(new Date());
  const totalAmount = orders.reduce((sum, order) => sum + orderAmount(order, productMap.get(order.product_id)), 0);
  const totalQuantity = orders.reduce((sum, order) => sum + safeQty(order.quantity), 0);
  const pendingQty = orders.filter((order) => order.production_status === "pending").reduce((sum, order) => sum + safeQty(order.quantity), 0);
  const producingQty = orders.filter((order) => order.production_status === "producing").reduce((sum, order) => sum + safeQty(order.quantity), 0);
  const waitingShipQty = orders.filter((order) => order.shipping_status === "not_shipped").reduce((sum, order) => sum + safeQty(order.quantity), 0);
  const expectedArrivalQty = orders.filter((order) => order.shipping_status !== "received").reduce((sum, order) => sum + safeQty(order.quantity), 0);
  const delayedCount = orders.filter((order) => order.production_status === "delayed" || isOverdue(order, today)).length;
  const arrival7 = arrivalQuantityWithin(orders, today, 7);
  const arrival15 = arrivalQuantityWithin(orders, today, 15);
  const arrival30 = arrivalQuantityWithin(orders, today, 30);
  const inventoryValue = Array.from(productMap.values()).reduce((sum, product) => sum + currentStock(product) * money(product.purchase_price), 0);

  return {
    totalAmount,
    totalQuantity,
    pendingQty,
    producingQty,
    waitingShipQty,
    expectedArrivalQty,
    delayedCount,
    arrival7,
    arrival15,
    arrival30,
    paidAmount: orders.filter((order) => order.production_status === "completed" || order.shipping_status !== "not_shipped").reduce((sum, order) => sum + orderAmount(order, productMap.get(order.product_id)), 0),
    unpaidAmount: orders.filter((order) => order.production_status === "pending").reduce((sum, order) => sum + orderAmount(order, productMap.get(order.product_id)), 0),
    expectedGoodsValue: orders.filter((order) => order.shipping_status !== "received").reduce((sum, order) => sum + orderAmount(order, productMap.get(order.product_id)), 0),
    inventoryValue
  };
}

function productionDonutData(orders: PurchaseOrderWithProduct[], copy: PurchaseCopy) {
  return [
    { name: copy.pending, value: countBy(orders, "production_status", "pending"), color: "#bca77a" },
    { name: copy.producing, value: countBy(orders, "production_status", "producing"), color: "#406A7A" },
    { name: copy.completed, value: countBy(orders, "production_status", "completed"), color: "#23614f" },
    { name: copy.abnormal, value: countBy(orders, "production_status", "delayed") + countBy(orders, "production_status", "cancelled"), color: "#9a3f3f" }
  ];
}

function shippingDonutData(orders: PurchaseOrderWithProduct[], copy: PurchaseCopy) {
  return [
    { name: copy.notShipped, value: countBy(orders, "shipping_status", "not_shipped"), color: "#6D756F" },
    { name: copy.shippedFromChina, value: countBy(orders, "shipping_status", "shipped_from_china"), color: "#406A7A" },
    { name: copy.inTransit, value: countBy(orders, "shipping_status", "customs") + countBy(orders, "shipping_status", "in_korea"), color: "#b8793c" },
    { name: copy.received, value: countBy(orders, "shipping_status", "received"), color: "#23614f" }
  ];
}

function buildProcurementInsights(orders: PurchaseOrderWithProduct[], products: ProductWithStock[], analytics: PurchaseAnalytics, copy: PurchaseCopy, formatNumber: (value: number) => string, formatCurrency: (value: number) => string) {
  const lowStock = products.filter((product) => currentStock(product) <= Number(product.low_stock_threshold ?? 10)).slice(0, 2);
  const delayed = orders.find((order) => order.production_status === "delayed");
  const overdue = orders.find((order) => isOverdue(order, startOfDay(new Date())));
  const insights: string[] = [];

  lowStock.forEach((product) => insights.push(copy.lowStockInsight(product.sku, formatNumber(currentStock(product)))));
  if (delayed) insights.push(copy.delayedInsight(delayed.products?.sku ?? "-", delayed.factory_name ?? "-"));
  if (overdue) insights.push(copy.shippingRiskInsight(overdue.products?.sku ?? "-", overdue.expected_arrival_date ?? "-"));
  insights.push(copy.capitalInsight(formatCurrency(analytics.expectedGoodsValue), formatNumber(analytics.expectedArrivalQty)));

  return insights.slice(0, 4);
}

function purchaseHealth(analytics: PurchaseAnalytics, copy: PurchaseCopy) {
  const score = Math.max(30, 100 - analytics.delayedCount * 12 - (analytics.waitingShipQty > 0 ? 8 : 0));
  if (score >= 78) return { score, label: copy.normal, className: "border-emerald-200 bg-emerald-50/80 text-emerald-800" };
  if (score >= 58) return { score, label: copy.attention, className: "border-amber-200 bg-amber-50/80 text-amber-800" };
  return { score, label: copy.risk, className: "border-red-200 bg-red-50/80 text-red-800" };
}

function orderAmount(order: PurchaseOrderWithProduct | PurchaseOrder, product?: ProductWithStock | null) {
  const productPrice = product?.purchase_price ?? (order as PurchaseOrderWithProduct).products?.purchase_price ?? 0;
  return safeQty(order.quantity) * money(productPrice);
}

function currentStock(product?: Pick<ProductWithStock, "inventory_balances"> | null) {
  const balance = product?.inventory_balances;
  if (Array.isArray(balance)) return Number(balance[0]?.current_stock ?? 0);
  return Number(balance?.current_stock ?? 0);
}

function safeQty(value: number | null | undefined) {
  return Math.max(0, Number(value ?? 0));
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T, value: string) {
  return rows.filter((row) => row[key] === value).length;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(dateKey: string | null, today: Date) {
  if (!dateKey) return Infinity;
  const date = new Date(`${dateKey}T00:00:00`);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function arrivalQuantityWithin(orders: PurchaseOrderWithProduct[], today: Date, days: number) {
  return orders
    .filter((order) => order.shipping_status !== "received")
    .filter((order) => {
      const diff = daysUntil(order.expected_arrival_date, today);
      return diff >= 0 && diff <= days;
    })
    .reduce((sum, order) => sum + safeQty(order.quantity), 0);
}

function isOverdue(order: PurchaseOrderWithProduct | PurchaseOrder, today: Date) {
  return order.shipping_status !== "received" && daysUntil(order.expected_arrival_date, today) < 0;
}

function productionTone(status: string) {
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-800";
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

function productionStatusLabel(status: string, t: ReturnType<typeof useLanguage>["t"]) {
  const labels: Record<string, Parameters<typeof t>[0]> = {
    pending: "status.pending",
    producing: "status.producing",
    completed: "status.completed",
    delayed: "status.delayed",
    cancelled: "status.cancelled"
  };
  return t(labels[status] ?? "common.status");
}

function shippingStatusLabel(status: string, t: ReturnType<typeof useLanguage>["t"]) {
  const labels: Record<string, Parameters<typeof t>[0]> = {
    not_shipped: "status.notShipped",
    shipped_from_china: "status.shippedFromChina",
    customs: "status.customs",
    in_korea: "status.inKorea",
    received: "status.received"
  };
  return t(labels[status] ?? "common.status");
}

function purchaseCopy(language: Language) {
  if (language === "ko") {
    return {
      title: "구매 센터",
      subtitle: "구매 계획, 생산 진행, 발송 상태와 이동 중 재고를 통합 관리합니다.",
      totalAmount: "구매 총액",
      totalQuantity: "구매 총수량",
      pendingQty: "생산 대기 수량",
      producingQty: "생산 중 수량",
      waitingShipQty: "발송 대기 수량",
      expectedArrivalQty: "예상 입고 수량",
      autoCalculated: "자동 집계",
      activeOrders: "운영 주문",
      toSchedule: "일정 확인",
      inProgress: "진행 중",
      awaitingDispatch: "출고 대기",
      inboundReady: "입고 예정",
      healthIndex: "구매 건강 지수",
      normal: "정상",
      attention: "주의",
      risk: "위험",
      amountOverview: "구매 금액 통계",
      allOrderAmount: "전체 구매 금액",
      paidAmount: "결제 완료 추정",
      unpaidAmount: "미결제 추정",
      estimatedGoodsValue: "예상 상품 가치",
      inventoryValue: "현재 재고 가치",
      productionOverview: "생산 상태 개요",
      shippingOverview: "발송 상태 개요",
      pending: "생산 대기",
      producing: "생산 중",
      completed: "완료",
      abnormal: "이상",
      notShipped: "미발송",
      shippedFromChina: "중국 발송",
      inTransit: "운송 중",
      received: "입고 완료",
      arrivalCenter: "예상 도착 센터",
      arrival7: "향후 7일 입고",
      arrival15: "향후 15일 입고",
      arrival30: "향후 30일 입고",
      insightsTitle: "구매 인사이트",
      addTitle: "구매 등록",
      editTitle: "구매 수정",
      saving: "저장 중",
      orderTable: "구매 주문 관리",
      stock: "재고",
      amount: "금액",
      timeline: "진행 타임라인",
      created: "생성",
      production: "생산",
      shipped: "발송",
      arrived: "입고",
      lowStockInsight: (sku: string, stock: string) => `${sku} 현재 재고 ${stock}개입니다. 구매 계획 검토가 필요합니다.`,
      delayedInsight: (sku: string, factory: string) => `${sku} / ${factory} 생산 지연 상태입니다. 공장 일정 확인이 필요합니다.`,
      shippingRiskInsight: (sku: string, eta: string) => `${sku} 예상 도착일 ${eta}가 지났습니다. 물류 상태를 확인하세요.`,
      capitalInsight: (amount: string, qty: string) => `이동 중 상품 가치 ${amount}, 예상 입고 수량 ${qty}개입니다.`
    };
  }

  return {
    title: "采购中心",
    subtitle: "统一管理采购计划、生产进度、发货状态与在途库存",
    totalAmount: "采购总金额",
    totalQuantity: "采购总数量",
    pendingQty: "待生产数量",
    producingQty: "生产中数量",
    waitingShipQty: "待发货数量",
    expectedArrivalQty: "预计到仓数量",
    autoCalculated: "自动统计",
    activeOrders: "采购订单",
    toSchedule: "待排产",
    inProgress: "进行中",
    awaitingDispatch: "待发货",
    inboundReady: "到仓预期",
    healthIndex: "采购健康指数",
    normal: "正常",
    attention: "注意",
    risk: "风险",
    amountOverview: "采购金额统计",
    allOrderAmount: "所有采购单金额",
    paidAmount: "已付款金额估算",
    unpaidAmount: "未付款金额估算",
    estimatedGoodsValue: "预计货值",
    inventoryValue: "库存价值",
    productionOverview: "生产状态统计",
    shippingOverview: "发货状态统计",
    pending: "待生产",
    producing: "生产中",
    completed: "已完成",
    abnormal: "异常",
    notShipped: "未发货",
    shippedFromChina: "已发货",
    inTransit: "运输中",
    received: "已到仓",
    arrivalCenter: "预计到货中心",
    arrival7: "未来7天预计到货",
    arrival15: "未来15天预计到货",
    arrival30: "未来30天预计到货",
    insightsTitle: "采购洞察",
    addTitle: "新增采购计划",
    editTitle: "编辑采购计划",
    saving: "保存中",
    orderTable: "采购订单管理",
    stock: "库存",
    amount: "金额",
    timeline: "采购时间轴",
    created: "创建",
    production: "生产",
    shipped: "发货",
    arrived: "到仓",
    lowStockInsight: (sku: string, stock: string) => `${sku} 当前库存 ${stock} 件，建议尽快评估补货计划。`,
    delayedInsight: (sku: string, factory: string) => `${sku} / ${factory} 当前生产延期，请优先确认工厂进度。`,
    shippingRiskInsight: (sku: string, eta: string) => `${sku} 预计到货日 ${eta} 已过，请检查物流或到仓状态。`,
    capitalInsight: (amount: string, qty: string) => `当前在途预计货值 ${amount}，预计到仓数量 ${qty} 件。`
  };
}
