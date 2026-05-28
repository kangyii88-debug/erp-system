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

export default function InventoryPage() {
  return (
    <AppShell>
      <InventoryContent />
    </AppShell>
  );
}

function InventoryContent() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [form, setForm] = useState({ product_id: "", type: "inbound", movement_date: today(), quantity: "1", memo: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: productRows }, { data: movementRows }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      supabase
        .from("stock_movements")
        .select("*, products(name, sku)")
        .order("happened_at", { ascending: false })
        .limit(100)
    ]);
    setProducts((productRows ?? []) as ProductWithStock[]);
    setMovements((movementRows ?? []) as StockMovement[]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const dbType = form.type === "return_inbound" ? "inbound" : form.type === "loss" ? "outbound" : form.type;
    const businessMemo =
      form.type === "return_inbound"
        ? `${t.return_inbound}${form.memo ? ` - ${form.memo}` : ""}`
        : form.type === "loss"
          ? `${t.loss}${form.memo ? ` - ${form.memo}` : ""}`
          : form.memo || null;

    const quantity = Number(form.quantity);
    const happenedAt = new Date(`${form.movement_date}T12:00:00`).toISOString();
    const payload = {
      product_id: form.product_id,
      type: dbType,
      quantity,
      happened_at: happenedAt,
      memo: businessMemo
    };

    if (editingId) {
      const error = await updateMovement(editingId, payload);
      if (error) {
        setMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("stock_movements").insert({
        user_id: auth.user.id,
        ...payload
      });
      if (error) {
        setMessage(error.message);
        return;
      }
    }
    setMessage("");
    setEditingId(null);
    setForm({ product_id: "", type: "inbound", movement_date: today(), quantity: "1", memo: "" });
    await load();
  }

  async function updateMovement(
    id: string,
    payload: { product_id: string; type: string; quantity: number; happened_at: string; memo: string | null }
  ) {
    const original = movements.find((movement) => movement.id === id);
    if (!original) return { message: "Original movement not found" };

    const originalSigned = signedQuantity(original.type, original.quantity);
    const nextSigned = signedQuantity(payload.type, payload.quantity);

    const { error: movementError } = await supabase.from("stock_movements").update(payload).eq("id", id);
    if (movementError) return movementError;

    if (original.product_id === payload.product_id) {
      const delta = nextSigned - originalSigned;
      if (delta !== 0) {
        const current = products.find((product) => product.id === payload.product_id);
        const nextStock = Math.max(0, safeStock(current) + delta);
        const { error } = await supabase
          .from("inventory_balances")
          .update({ current_stock: nextStock })
          .eq("product_id", payload.product_id);
        if (error) return error;
      }
    } else {
      const oldProduct = products.find((product) => product.id === original.product_id);
      const newProduct = products.find((product) => product.id === payload.product_id);
      const { error: oldError } = await supabase
        .from("inventory_balances")
        .update({ current_stock: Math.max(0, safeStock(oldProduct) - originalSigned) })
        .eq("product_id", original.product_id);
      if (oldError) return oldError;
      const { error: newError } = await supabase
        .from("inventory_balances")
        .update({ current_stock: Math.max(0, safeStock(newProduct) + nextSigned) })
        .eq("product_id", payload.product_id);
      if (newError) return newError;
    }

    const salesError = await adjustSalesDaily(original, payload);
    if (salesError) return salesError;

    return null;
  }

  function safeStock(product: ProductWithStock | undefined) {
    return product ? getCurrentStock(product) : 0;
  }

  async function adjustSalesDaily(
    original: StockMovement,
    payload: { product_id: string; type: string; quantity: number; happened_at: string }
  ) {
    const originalDate = new Date(original.happened_at).toISOString().slice(0, 10);
    const nextDate = new Date(payload.happened_at).toISOString().slice(0, 10);

    if (original.type === "sale") {
      const error = await changeSalesDaily(original.product_id, originalDate, -original.quantity);
      if (error) return error;
    }

    if (payload.type === "sale") {
      const error = await changeSalesDaily(payload.product_id, nextDate, payload.quantity);
      if (error) return error;
    }

    return null;
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

  function signedQuantity(type: string, quantity: number) {
    return type === "inbound" || type === "adjustment" ? quantity : -quantity;
  }

  function displayType(movement: StockMovement) {
    if (movement.type === "inbound" && movement.memo?.startsWith(t.return_inbound)) return t.return_inbound;
    if (movement.type === "outbound" && movement.memo?.startsWith(t.loss)) return t.loss;
    return t[movement.type];
  }

  function editableType(movement: StockMovement) {
    if (movement.type === "inbound" && movement.memo?.startsWith(t.return_inbound)) return "return_inbound";
    if (movement.type === "outbound" && movement.memo?.startsWith(t.loss)) return "loss";
    return movement.type;
  }

  function editableMemo(movement: StockMovement) {
    const typeLabel = displayType(movement);
    if (movement.memo?.startsWith(`${typeLabel} - `)) return movement.memo.replace(`${typeLabel} - `, "");
    if (movement.memo === typeLabel) return "";
    return movement.memo ?? "";
  }

  function startEdit(movement: StockMovement) {
    setEditingId(movement.id);
    setMessage("");
    setForm({
      product_id: movement.product_id,
      type: editableType(movement),
      movement_date: new Date(movement.happened_at).toISOString().slice(0, 10),
      quantity: String(movement.quantity),
      memo: editableMemo(movement)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ product_id: "", type: "inbound", movement_date: today(), quantity: "1", memo: "" });
    setMessage("");
  }

  const inventoryGroups = groupProductsByColor(products);
  const movementGroups = groupMovementsByColor(movements);

  async function deleteMovement(movement: StockMovement) {
    if (!window.confirm(`${t.delete}: ${movement.products?.sku ?? ""} ${movement.quantity}`)) return;

    const current = products.find((product) => product.id === movement.product_id);
    const rollbackStock = Math.max(0, safeStock(current) - signedQuantity(movement.type, movement.quantity));
    const { error: stockError } = await supabase
      .from("inventory_balances")
      .update({ current_stock: rollbackStock })
      .eq("product_id", movement.product_id);
    if (stockError) {
      setMessage(stockError.message);
      return;
    }

    if (movement.type === "sale") {
      const saleDate = new Date(movement.happened_at).toISOString().slice(0, 10);
      const salesError = await changeSalesDaily(movement.product_id, saleDate, -movement.quantity);
      if (salesError) {
        setMessage(salesError.message);
        return;
      }
    }

    const { error } = await supabase.from("stock_movements").delete().eq("id", movement.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === movement.id) cancelEdit();
    await load();
  }

  return (
    <>
      <PageHeader title={t.inventory} />
      <section className="mb-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-ink/55">{t.movementType}</div>
            <h2 className="text-xl font-semibold text-ink">{editingId ? t.updateMovement : t.recordMovement}</h2>
          </div>
          {editingId ? (
            <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" type="button" onClick={cancelEdit}>
              {t.cancel}
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="rounded border border-line bg-white p-4 shadow-soft">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr_0.8fr_0.6fr_1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/60">{t.productName}</span>
              <ProductSelect products={products} value={form.product_id} onChange={(value) => setForm({ ...form, product_id: value })} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/60">{t.movementType}</span>
              <select className="w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="inbound">{t.inbound}</option>
                <option value="outbound">{t.outbound}</option>
                <option value="sale">{t.sale}</option>
                <option value="return_inbound">{t.return_inbound}</option>
                <option value="loss">{t.loss}</option>
                <option value="adjustment">{t.adjustment}</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/60">Date</span>
              <input className="w-full" type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/60">{t.quantity}</span>
              <input className="w-full" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink/60">{t.memo}</span>
              <input className="w-full" placeholder={t.memo} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </label>

            <button className="self-end rounded bg-brand px-8 py-2 text-sm font-semibold text-white">{t.save}</button>
          </div>
        </form>
        {message ? <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
      </section>

      <section className="mb-6">
        <div className="mb-3">
          <div className="text-sm font-medium text-ink/55">{t.currentStock}</div>
          <h2 className="text-xl font-semibold text-ink">{t.currentStock}</h2>
        </div>

        <div className="space-y-5">
          {inventoryGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink">{group.products[0]?.color || group.key}</h3>
                <div className="rounded bg-white px-3 py-1 text-sm font-medium text-ink/60">{group.products.length} SKU</div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {group.products.map((product) => (
                  <div key={product.id} className="rounded border border-line bg-white p-4 shadow-soft">
                    <div className="mb-3">
                      <div className="text-xs font-medium text-ink/50">{product.sku}</div>
                      <div className="mt-1 line-clamp-2 font-medium text-ink">{product.name}</div>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="text-3xl font-semibold text-ink">{getCurrentStock(product)}</div>
                      <div className="rounded bg-panel px-2 py-1 text-xs font-medium text-ink/60">{normalizedSize(product.size)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <div className="text-sm font-medium text-ink/55">{t.movementType}</div>
          <h2 className="text-xl font-semibold text-ink">{t.movementHistory}</h2>
        </div>

        <div className="space-y-5">
          {movementGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink">{group.label}</h3>
                <div className="rounded bg-white px-3 py-1 text-sm font-medium text-ink/60">{group.movements.length}</div>
              </div>

              <Table>
                <thead>
                  <tr>
                    <Th>{t.sku}</Th>
                    <Th>{t.productName}</Th>
                    <Th>{t.movementType}</Th>
                    <Th>{t.quantity}</Th>
                    <Th>{t.memo}</Th>
                    <Th>Date</Th>
                    <Th>{t.edit}</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.movements.map((movement) => (
                    <tr key={movement.id}>
                      <Td>{movement.products?.sku}</Td>
                      <Td>{movement.products?.name}</Td>
                      <Td>{displayType(movement)}</Td>
                      <Td>{movement.quantity}</Td>
                      <Td>{movement.memo}</Td>
                      <Td>{new Date(movement.happened_at).toLocaleString()}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" onClick={() => startEdit(movement)}>
                            {t.edit}
                          </button>
                          <button className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700" onClick={() => deleteMovement(movement)}>
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
        </div>
      </section>
    </>
  );
}

function groupProductsByColor(products: ProductWithStock[]) {
  const sortedProducts = [...products].sort(compareInventoryProducts);
  const groups = new Map<string, ProductWithStock[]>();

  for (const product of sortedProducts) {
    const key = colorKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return colorOrder
    .map((key) => ({ key, label: colorLabel(key), products: groups.get(key) ?? [] }))
    .filter((group) => group.products.length > 0);
}

function groupMovementsByColor(movements: StockMovement[]) {
  const sortedMovements = [...movements].sort((a, b) => {
    const colorDiff =
      colorOrder.indexOf(colorKeyFromSku(a.products?.sku ?? "")) -
      colorOrder.indexOf(colorKeyFromSku(b.products?.sku ?? ""));
    if (colorDiff !== 0) return colorDiff;
    return new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime();
  });
  const groups = new Map<string, StockMovement[]>();

  for (const movement of sortedMovements) {
    const key = colorKeyFromSku(movement.products?.sku ?? "");
    groups.set(key, [...(groups.get(key) ?? []), movement]);
  }

  return colorOrder
    .map((key) => ({ key, label: colorLabel(key), movements: groups.get(key) ?? [] }))
    .filter((group) => group.movements.length > 0);
}

const colorOrder = ["WH", "BL", "GR", "BE", "OTHER"];

function compareInventoryProducts(a: ProductWithStock, b: ProductWithStock) {
  const colorDiff = colorOrder.indexOf(colorKey(a)) - colorOrder.indexOf(colorKey(b));
  if (colorDiff !== 0) return colorDiff;

  const aSize = normalizedSize(a.size) || baseSku(a.sku);
  const bSize = normalizedSize(b.size) || baseSku(b.sku);
  if (aSize !== bSize) return aSize.localeCompare(bSize, undefined, { numeric: true });

  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

function colorKey(product: ProductWithStock) {
  return colorKeyFromSku(product.sku);
}

function colorKeyFromSku(sku: string) {
  return sku.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase() ?? "OTHER";
}

function colorLabel(key: string) {
  if (key === "WH") return "白色";
  if (key === "BL") return "黑色";
  if (key === "GR") return "灰色";
  if (key === "BE") return "米色";
  return "其他";
}

function baseSku(sku: string) {
  return sku.replace(/-(WH|BL|GR|BE)$/i, "");
}

function normalizedSize(size: string | null) {
  return (size ?? "").replace(/\s+/g, "").trim();
}
