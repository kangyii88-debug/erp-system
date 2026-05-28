"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { getCurrentStock } from "@/lib/stock";
import type { ProductWithStock } from "@/lib/types";

const emptyForm = {
  name: "",
  sku: "",
  color: "",
  size: "",
  purchase_price: "0",
  sale_price: "0",
  platform: "Coupang",
  low_stock_threshold: "10",
  memo: ""
};

export default function ProductsPage() {
  return (
    <AppShell>
      <ProductsContent />
    </AppShell>
  );
}

function ProductsContent() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*, inventory_balances(current_stock)")
      .order("created_at", { ascending: false });
    setProducts((data ?? []) as ProductWithStock[]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const payload = {
      name: form.name,
      sku: form.sku,
      color: form.color || null,
      size: form.size || null,
      purchase_price: Number(form.purchase_price),
      sale_price: Number(form.sale_price),
      platform: form.platform,
      low_stock_threshold: Number(form.low_stock_threshold),
      memo: form.memo || null
    };

    const { error } = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId)
      : await supabase.from("products").insert({ user_id: auth.user.id, ...payload });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("");
    setForm(emptyForm);
    setEditingId(null);
    await loadProducts();
  }

  function startEdit(product: ProductWithStock) {
    setEditingId(product.id);
    setMessage("");
    setForm({
      name: product.name,
      sku: product.sku,
      color: product.color ?? "",
      size: product.size ?? "",
      purchase_price: String(product.purchase_price),
      sale_price: String(product.sale_price),
      platform: product.platform,
      low_stock_threshold: String(product.low_stock_threshold),
      memo: product.memo ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  const productGroups = groupProducts(products);

  return (
    <>
      <PageHeader title={t.products} />
      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editingId ? t.updateProduct : t.addProduct}</h2>
          {editingId ? (
            <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" type="button" onClick={cancelEdit}>
              {t.cancel}
            </button>
          ) : null}
        </div>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
          <input placeholder={t.productName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder={t.sku} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <input placeholder={t.color} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <input placeholder={t.size} value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
          <input placeholder={t.purchasePrice} type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
          <input placeholder={t.salePrice} type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option>Coupang</option>
            <option>Naver</option>
            <option>11st</option>
            <option>Gmarket</option>
            <option>Other</option>
          </select>
          <input placeholder={t.lowStockThreshold} type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
          <textarea className="md:col-span-3" placeholder={t.memo} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          <button className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">{t.save}</button>
        </form>
        {message ? <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}
      </Card>

      <section className="space-y-5">
        {productGroups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink/55">{t.color}</div>
                <h2 className="text-xl font-semibold text-ink">{group.label}</h2>
              </div>
              <div className="rounded bg-white px-3 py-1 text-sm font-medium text-ink/60">{group.products.length} SKU</div>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>{t.sku}</Th>
                  <Th>{t.productName}</Th>
                  <Th>{t.size}</Th>
                  <Th>{t.purchasePrice}</Th>
                  <Th>{t.salePrice}</Th>
                  <Th>{t.currentStock}</Th>
                  <Th>{t.platform}</Th>
                  <Th>{t.memo}</Th>
                  <Th>{t.edit}</Th>
                </tr>
              </thead>
              <tbody>
                {group.products.map((product) => (
                  <tr key={product.id}>
                    <Td>{product.sku}</Td>
                    <Td>{product.name}</Td>
                    <Td>{normalizedSize(product.size)}</Td>
                    <Td>{product.purchase_price}</Td>
                    <Td>{product.sale_price}</Td>
                    <Td>
                      <span className="text-base font-semibold text-ink">{getCurrentStock(product)}</span>
                    </Td>
                    <Td>{product.platform}</Td>
                    <Td>{product.memo}</Td>
                    <Td>
                      <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" onClick={() => startEdit(product)}>
                        {t.edit}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
      </section>
    </>
  );
}

function groupProducts(products: ProductWithStock[]) {
  const sortedProducts = [...products].sort(compareProducts);
  const groups = new Map<string, ProductWithStock[]>();

  for (const product of sortedProducts) {
    const key = colorKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return colorOrder
    .map((key) => ({ key, label: colorLabel(key, groups.get(key) ?? []), products: groups.get(key) ?? [] }))
    .filter((group) => group.products.length > 0);
}

function compareProducts(a: ProductWithStock, b: ProductWithStock) {
  const colorDiff = colorRank(a) - colorRank(b);
  if (colorDiff !== 0) return colorDiff;

  const aSize = normalizedSize(a.size) || baseSku(a.sku);
  const bSize = normalizedSize(b.size) || baseSku(b.sku);
  if (aSize !== bSize) return aSize.localeCompare(bSize, undefined, { numeric: true });

  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

const colorOrder = ["WH", "BL", "GR", "BE", "OTHER"];

function baseSku(sku: string) {
  return sku.replace(/-(WH|BL|GR|BE)$/i, "");
}

function normalizedSize(size: string | null) {
  return (size ?? "").replace(/\s+/g, "").trim();
}

function skuSuffix(product: ProductWithStock) {
  return product.sku.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase() ?? "";
}

function colorKey(product: ProductWithStock) {
  return skuSuffix(product) || "OTHER";
}

function colorRank(product: ProductWithStock) {
  const suffix = skuSuffix(product);
  if (suffix === "WH") return 0;
  if (suffix === "BL") return 1;
  if (suffix === "GR") return 2;
  if (suffix === "BE") return 3;
  return 9;
}

function displayColorName(product: ProductWithStock) {
  return product.color || skuSuffix(product) || "-";
}

function colorLabel(key: string, products: ProductWithStock[]) {
  return products[0]?.color || key;
}

function displayColor(product: ProductWithStock) {
  const suffix = skuSuffix(product);
  if (suffix === "WH") return product.color || "白色";
  if (suffix === "BL") return product.color || "黑色";
  if (suffix === "GR") return product.color || "灰色";
  if (suffix === "BE") return product.color || "米色";
  return product.color || "-";
}
