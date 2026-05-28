"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { ProductSelect } from "@/components/ProductSelect";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { getCurrentStock } from "@/lib/stock";
import type { ProductWithStock, StockMovement } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SalesPage() {
  return (
    <AppShell>
      <SalesContent />
    </AppShell>
  );
}

function SalesContent() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [sales, setSales] = useState<StockMovement[]>([]);
  const [form, setForm] = useState({ product_id: "", sale_date: today(), quantity: "1", memo: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: productRows }, { data: saleRows }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      supabase
        .from("stock_movements")
        .select("*, products(name, sku, color)")
        .eq("type", "sale")
        .order("happened_at", { ascending: false })
        .limit(100)
    ]);
    setProducts((productRows ?? []) as ProductWithStock[]);
    setSales((saleRows ?? []) as StockMovement[]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const quantity = Number(form.quantity);
    const happenedAt = new Date(`${form.sale_date}T12:00:00`).toISOString();
    const payload = {
      product_id: form.product_id,
      type: "sale",
      quantity,
      happened_at: happenedAt,
      memo: form.memo || null
    };

    const { error } = editingId
      ? await updateSale(editingId, payload)
      : await supabase.from("stock_movements").insert({ user_id: auth.user.id, ...payload });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("");
    setEditingId(null);
    setForm({ product_id: "", sale_date: today(), quantity: "1", memo: "" });
    await load();
  }

  async function updateSale(
    id: string,
    payload: { product_id: string; type: string; quantity: number; happened_at: string; memo: string | null }
  ) {
    const original = sales.find((sale) => sale.id === id);
    if (!original) return { message: "Original sale not found" };

    const originalDate = original.happened_at.slice(0, 10);
    const nextDate = payload.happened_at.slice(0, 10);

    const { error: movementError } = await supabase.from("stock_movements").update(payload).eq("id", id);
    if (movementError) return movementError;

    const stockError = await adjustStockForSaleChange(original, payload);
    if (stockError) return stockError;

    const removeError = await changeSalesDaily(original.product_id, originalDate, -original.quantity);
    if (removeError) return removeError;

    const addError = await changeSalesDaily(payload.product_id, nextDate, payload.quantity);
    if (addError) return addError;

    return null;
  }

  async function adjustStockForSaleChange(
    original: StockMovement,
    payload: { product_id: string; quantity: number }
  ) {
    if (original.product_id === payload.product_id) {
      const product = products.find((item) => item.id === payload.product_id);
      const nextStock = Math.max(0, safeStock(product) + original.quantity - payload.quantity);
      const { error } = await supabase.from("inventory_balances").update({ current_stock: nextStock }).eq("product_id", payload.product_id);
      return error;
    }

    const oldProduct = products.find((item) => item.id === original.product_id);
    const newProduct = products.find((item) => item.id === payload.product_id);
    const { error: oldError } = await supabase
      .from("inventory_balances")
      .update({ current_stock: Math.max(0, safeStock(oldProduct) + original.quantity) })
      .eq("product_id", original.product_id);
    if (oldError) return oldError;

    const { error: newError } = await supabase
      .from("inventory_balances")
      .update({ current_stock: Math.max(0, safeStock(newProduct) - payload.quantity) })
      .eq("product_id", payload.product_id);
    return newError;
  }

  function safeStock(product: ProductWithStock | undefined) {
    return product ? getCurrentStock(product) : 0;
  }

  async function changeSalesDaily(productId: string, saleDate: string, delta: number) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data, error: readError } = await supabase
      .from("sales_daily")
      .select("id, quantity")
      .eq("product_id", productId)
      .eq("sale_date", saleDate)
      .maybeSingle();
    if (readError) return readError;

    const nextQuantity = Math.max(0, Number(data?.quantity ?? 0) + delta);
    if (data?.id) {
      const { error } = await supabase.from("sales_daily").update({ quantity: nextQuantity }).eq("id", data.id);
      return error;
    }

    if (nextQuantity > 0) {
      const { error } = await supabase.from("sales_daily").insert({
        user_id: auth.user.id,
        product_id: productId,
        sale_date: saleDate,
        quantity: nextQuantity
      });
      return error;
    }

    return null;
  }

  async function deleteSale(sale: StockMovement) {
    if (!window.confirm(`${t.delete}: ${sale.products?.sku ?? ""} ${sale.quantity}`)) return;

    const product = products.find((item) => item.id === sale.product_id);
    const { error: stockError } = await supabase
      .from("inventory_balances")
      .update({ current_stock: Math.max(0, safeStock(product) + sale.quantity) })
      .eq("product_id", sale.product_id);
    if (stockError) {
      setMessage(stockError.message);
      return;
    }

    const saleDate = sale.happened_at.slice(0, 10);
    const dailyError = await changeSalesDaily(sale.product_id, saleDate, -sale.quantity);
    if (dailyError) {
      setMessage(dailyError.message);
      return;
    }

    const { error } = await supabase.from("stock_movements").delete().eq("id", sale.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === sale.id) cancelEdit();
    await load();
  }

  function startEdit(sale: StockMovement) {
    setEditingId(sale.id);
    setMessage("");
    setForm({
      product_id: sale.product_id,
      sale_date: sale.happened_at.slice(0, 10),
      quantity: String(sale.quantity),
      memo: sale.memo ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ product_id: "", sale_date: today(), quantity: "1", memo: "" });
    setMessage("");
  }

  const salesGroups = groupSalesByDate(sales);

  return (
    <>
      <PageHeader title={t.sales} />
      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editingId ? t.updateMovement : t.recordSale}</h2>
          {editingId ? (
            <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" type="button" onClick={cancelEdit}>
              {t.cancel}
            </button>
          ) : null}
        </div>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-5">
          <ProductSelect products={products} value={form.product_id} onChange={(value) => setForm({ ...form, product_id: value })} />
          <input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
          <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input placeholder={t.memo} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">{t.save}</button>
        </form>
        {message ? <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">{t.salesHistory}</h2>
        <div className="space-y-5">
          {salesGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink">{group.label}</h3>
                <div className="rounded bg-white px-3 py-1 text-sm font-medium text-ink/60">{group.sales.length}</div>
              </div>

              <Table>
                <thead>
                  <tr>
                    <Th>{t.saleDate}</Th>
                    <Th>{t.sku}</Th>
                    <Th>{t.productName}</Th>
                    <Th>{t.quantity}</Th>
                    <Th>{t.memo}</Th>
                    <Th>{t.edit}</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.sales.map((sale) => (
                    <tr key={sale.id}>
                      <Td>{new Date(sale.happened_at).toLocaleDateString()}</Td>
                      <Td>{sale.products?.sku}</Td>
                      <Td>{sale.products?.name}</Td>
                      <Td>{sale.quantity}</Td>
                      <Td>{sale.memo}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" onClick={() => startEdit(sale)}>
                            {t.edit}
                          </button>
                          <button className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700" onClick={() => deleteSale(sale)}>
                            {t.delete}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ))}
          {!sales.length ? (
            <Table>
              <tbody>
                <tr>
                  <Td>{t.empty}</Td>
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                  <Td />
                </tr>
              </tbody>
            </Table>
          ) : null}
        </div>
      </section>
    </>
  );
}

function groupSalesByDate(sales: StockMovement[]) {
  const sortedSales = [...sales].sort((a, b) => {
    return new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime();
  });
  const groups = new Map<string, StockMovement[]>();

  for (const sale of sortedSales) {
    const key = new Date(sale.happened_at).toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), sale]);
  }

  return Array.from(groups.entries()).map(([key, groupSales]) => ({
    key,
    label: new Date(`${key}T12:00:00`).toLocaleDateString(),
    sales: groupSales
  }));
}
