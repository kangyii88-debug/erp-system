"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { ProductSelect } from "@/components/ProductSelect";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import type { ProductWithStock, PurchaseOrder } from "@/lib/types";

export default function PurchasesPage() {
  return (
    <AppShell>
      <PurchasesContent />
    </AppShell>
  );
}

function PurchasesContent() {
  const { t, formatDate } = useLanguage();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: productRows }, { data: orderRows }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      supabase.from("purchase_orders").select("*, products(name, sku)").order("created_at", { ascending: false })
    ]);
    setProducts((productRows ?? []) as ProductWithStock[]);
    setOrders((orderRows ?? []) as PurchaseOrder[]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

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

  const productionStatuses = ["pending", "producing", "completed", "delayed", "cancelled"] as const;
  const shippingStatuses = ["not_shipped", "shipped_from_china", "customs", "in_korea", "received"] as const;

  return (
    <>
      <PageHeader title={t("purchase.title")} />
      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{isEditing ? t("purchase.editTitle") : t("purchase.add")}</h2>
          {isEditing ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-brand/30 hover:text-brand"
            >
              {t("purchase.cancelEdit")}
            </button>
          ) : null}
        </div>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
          <ProductSelect products={products} value={form.product_id} onChange={(value) => setForm({ ...form, product_id: value })} />
          <input placeholder={t("common.factory")} value={form.factory_name} onChange={(e) => setForm({ ...form, factory_name: e.target.value })} required />
          <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input type="date" value={form.expected_arrival_date} onChange={(e) => setForm({ ...form, expected_arrival_date: e.target.value })} />
          <select value={form.production_status} onChange={(e) => setForm({ ...form, production_status: e.target.value })}>
            {productionStatuses.map((status) => (
              <option key={status} value={status}>
                {productionStatusLabel(status, t)}
              </option>
            ))}
          </select>
          <select value={form.shipping_status} onChange={(e) => setForm({ ...form, shipping_status: e.target.value })}>
            {shippingStatuses.map((status) => (
              <option key={status} value={status}>
                {shippingStatusLabel(status, t)}
              </option>
            ))}
          </select>
          <input className="md:col-span-1" placeholder={t("common.memo")} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brandDark">
              {isEditing ? t("purchase.update") : t("common.save")}
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand/30 hover:text-brand"
              >
                {t("purchase.cancelEdit")}
              </button>
            ) : null}
          </div>
        </form>
        {message ? <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>{t("common.sku")}</Th>
            <Th>{t("common.productName")}</Th>
            <Th>{t("common.factory")}</Th>
            <Th>{t("common.quantity")}</Th>
            <Th>{t("purchase.productionStatus")}</Th>
            <Th>{t("purchase.shippingStatus")}</Th>
            <Th>{t("purchase.eta")}</Th>
            <Th>{t("common.memo")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <Td>{order.products?.sku}</Td>
              <Td>{order.products?.name}</Td>
              <Td>{order.factory_name}</Td>
              <Td>{order.quantity}</Td>
              <Td>
                <select value={order.production_status} onChange={(e) => updateOrder(order.id, { production_status: e.target.value })}>
                  {productionStatuses.map((status) => (
                    <option key={status} value={status}>
                      {productionStatusLabel(status, t)}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <select value={order.shipping_status} onChange={(e) => updateOrder(order.id, { shipping_status: e.target.value })}>
                  {shippingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {shippingStatusLabel(status, t)}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>{order.expected_arrival_date ? formatDate(`${order.expected_arrival_date}T12:00:00`) : "-"}</Td>
              <Td>{order.memo}</Td>
              <Td>
                <div className="flex min-w-[128px] justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(order)}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand/30 hover:text-brand"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOrder(order.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
          {!orders.length ? (
            <tr>
              <td colSpan={9} className="border-b border-line px-4 py-8 text-center text-sm text-muted">
                {t("purchase.empty")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </>
  );
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
