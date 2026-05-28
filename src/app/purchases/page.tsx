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
  const { t } = useLanguage();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
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
    const { error } = await supabase.from("purchase_orders").insert({
      user_id: auth.user.id,
      product_id: form.product_id,
      factory_name: form.factory_name,
      quantity: Number(form.quantity),
      production_status: form.production_status,
      shipping_status: form.shipping_status,
      expected_arrival_date: form.expected_arrival_date || null,
      memo: form.memo || null
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("");
    setForm({
      product_id: "",
      factory_name: "",
      quantity: "1",
      production_status: "pending",
      shipping_status: "not_shipped",
      expected_arrival_date: "",
      memo: ""
    });
    await load();
  }

  async function updateOrder(id: string, patch: Partial<PurchaseOrder>) {
    await supabase.from("purchase_orders").update(patch).eq("id", id);
    await load();
  }

  const productionStatuses = ["pending", "producing", "completed", "delayed", "cancelled"] as const;
  const shippingStatuses = ["not_shipped", "shipped_from_china", "customs", "in_korea", "received"] as const;

  return (
    <>
      <PageHeader title={t.purchases} />
      <Card className="mb-5">
        <h2 className="mb-3 font-semibold">{t.addPurchase}</h2>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
          <ProductSelect products={products} value={form.product_id} onChange={(value) => setForm({ ...form, product_id: value })} />
          <input placeholder={t.factory} value={form.factory_name} onChange={(e) => setForm({ ...form, factory_name: e.target.value })} required />
          <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input type="date" value={form.expected_arrival_date} onChange={(e) => setForm({ ...form, expected_arrival_date: e.target.value })} />
          <select value={form.production_status} onChange={(e) => setForm({ ...form, production_status: e.target.value })}>
            {productionStatuses.map((status) => (
              <option key={status} value={status}>
                {t[status]}
              </option>
            ))}
          </select>
          <select value={form.shipping_status} onChange={(e) => setForm({ ...form, shipping_status: e.target.value })}>
            {shippingStatuses.map((status) => (
              <option key={status} value={status}>
                {t[status]}
              </option>
            ))}
          </select>
          <input className="md:col-span-1" placeholder={t.memo} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">{t.save}</button>
        </form>
        {message ? <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>{t.sku}</Th>
            <Th>{t.productName}</Th>
            <Th>{t.factory}</Th>
            <Th>{t.quantity}</Th>
            <Th>{t.productionStatus}</Th>
            <Th>{t.shippingStatus}</Th>
            <Th>{t.eta}</Th>
            <Th>{t.memo}</Th>
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
                      {t[status]}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <select value={order.shipping_status} onChange={(e) => updateOrder(order.id, { shipping_status: e.target.value })}>
                  {shippingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {t[status]}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>{order.expected_arrival_date}</Td>
              <Td>{order.memo}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
