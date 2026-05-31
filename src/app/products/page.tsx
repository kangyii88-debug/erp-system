"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Table, Td, Th } from "@/components/Table";
import { useLanguage } from "@/components/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { profitMargin, unitProfit } from "@/lib/profit";
import { getCurrentStock } from "@/lib/stock";
import type { ProductWithStock } from "@/lib/types";

const emptyForm = {
  name: "",
  sku: "",
  color: "",
  size: "",
  purchase_price: "0",
  sale_price: "0",
  platform_fee_rate: "11.6",
  platform: "Coupang",
  international_shipping_cost: "0",
  coupang_inbound_shipping_cost: "0",
  ad_cost: "0",
  initial_stock: "0",
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
      purchase_price: Number(form.purchase_price || 0),
      sale_price: Number(form.sale_price || 0),
      platform_fee_rate: Number(form.platform_fee_rate || 11.6),
      international_shipping_cost: Number(form.international_shipping_cost || 0),
      coupang_inbound_shipping_cost: Number(form.coupang_inbound_shipping_cost || 0),
      ad_cost: Number(form.ad_cost || 0),
      platform: form.platform,
      low_stock_threshold: Number(form.low_stock_threshold || 10),
      memo: form.memo || null
    };

    let productId = editingId;
    let errorMessage = "";

    if (editingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      errorMessage = error?.message ?? "";
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({ user_id: auth.user.id, ...payload })
        .select("id")
        .single();
      errorMessage = error?.message ?? "";
      productId = data?.id ?? null;
    }

    const initialStock = Math.max(0, Number(form.initial_stock || 0));
    if (!errorMessage && !editingId && productId && initialStock > 0) {
      const { error } = await supabase.from("stock_movements").insert({
        user_id: auth.user.id,
        product_id: productId,
        type: "inbound",
        quantity: initialStock,
        memo: "初始库存"
      });
      errorMessage = error?.message ?? "";
    }

    if (errorMessage) {
      setMessage(errorMessage);
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
      purchase_price: String(product.purchase_price ?? 0),
      sale_price: String(product.sale_price ?? 0),
      platform_fee_rate: String(product.platform_fee_rate ?? 11.6),
      platform: product.platform,
      international_shipping_cost: String(product.international_shipping_cost ?? 0),
      coupang_inbound_shipping_cost: String(product.coupang_inbound_shipping_cost ?? 0),
      ad_cost: String(product.ad_cost ?? 0),
      initial_stock: String(getCurrentStock(product)),
      low_stock_threshold: String(product.low_stock_threshold ?? 10),
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
  const profitPreviewProduct = {
    purchase_price: Number(form.purchase_price || 0),
    sale_price: Number(form.sale_price || 0),
    platform_fee_rate: Number(form.platform_fee_rate || 11.6),
    international_shipping_cost: Number(form.international_shipping_cost || 0),
    coupang_inbound_shipping_cost: Number(form.coupang_inbound_shipping_cost || 0),
    ad_cost: Number(form.ad_cost || 0)
  };
  const previewUnitProfit = unitProfit(profitPreviewProduct);
  const previewMargin = profitMargin(profitPreviewProduct, previewUnitProfit);

  return (
    <>
      <PageHeader title={t.products} />
      <Card className="mb-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editingId ? t.updateProduct : t.addProduct}</h2>
          {editingId ? (
            <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium" type="button" onClick={cancelEdit}>
              {t.cancel}
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="商品名">
              <input placeholder="商品名" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="SKU">
              <input placeholder="SKU" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required />
            </Field>
            <Field label="颜色">
              <input placeholder="颜色" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            </Field>
            <Field label="尺寸">
              <input placeholder="尺寸" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Field label="商品进货成本">
              <input placeholder="0" type="number" min="0" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} />
            </Field>
            <Field label="销售价格">
              <input placeholder="0" type="number" min="0" value={form.sale_price} onChange={(event) => setForm({ ...form, sale_price: event.target.value })} />
            </Field>
            <Field label="平台服务费率 %">
              <input placeholder="11.6" type="number" min="0" step="0.1" value={form.platform_fee_rate} onChange={(event) => setForm({ ...form, platform_fee_rate: event.target.value })} />
            </Field>
            <Field label="销售平台">
              <select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>
                <option>Coupang</option>
                <option>Naver</option>
                <option>11st</option>
                <option>Gmarket</option>
                <option>Other</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Field label="国际运输成本">
              <input placeholder="0" type="number" min="0" value={form.international_shipping_cost} onChange={(event) => setForm({ ...form, international_shipping_cost: event.target.value })} />
            </Field>
            <Field label="Coupang入仓运费">
              <input placeholder="0" type="number" min="0" value={form.coupang_inbound_shipping_cost} onChange={(event) => setForm({ ...form, coupang_inbound_shipping_cost: event.target.value })} />
            </Field>
            <Field label="广告费用">
              <input placeholder="0" type="number" min="0" value={form.ad_cost} onChange={(event) => setForm({ ...form, ad_cost: event.target.value })} />
            </Field>
            <Field label={editingId ? "当前库存" : "初始库存"}>
              <input
                placeholder="0"
                type="number"
                min="0"
                value={form.initial_stock}
                disabled={Boolean(editingId)}
                onChange={(event) => setForm({ ...form, initial_stock: event.target.value })}
              />
            </Field>
          </div>

          <div className="rounded border border-line bg-panel p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-ink">成本与利润设置</h3>
                <p className="text-xs text-ink/55">这些字段会参与单件利润、利润率、TOP利润商品和数据看板利润统计。</p>
              </div>
              <div className="rounded bg-white px-3 py-2 text-sm font-semibold text-ink">
                单件利润 {won(previewUnitProfit)} · 利润率 {previewMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          <Field label="备注">
            <textarea placeholder={t.memo} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
          </Field>

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
                  <Th>手续费</Th>
                  <Th>国际物流</Th>
                  <Th>入仓运费</Th>
                  <Th>广告费</Th>
                  <Th>{t.salePrice}</Th>
                  <Th>单件利润</Th>
                  <Th>利润率</Th>
                  <Th>{t.currentStock}</Th>
                  <Th>{t.platform}</Th>
                  <Th>{t.memo}</Th>
                  <Th>{t.edit}</Th>
                </tr>
              </thead>
              <tbody>
                {group.products.map((product) => {
                  const singleProfit = unitProfit(product);
                  return (
                    <tr key={product.id}>
                      <Td>{product.sku}</Td>
                      <Td>{product.name}</Td>
                      <Td>{normalizedSize(product.size)}</Td>
                      <Td>{won(product.purchase_price)}</Td>
                      <Td>{Number(product.platform_fee_rate ?? 11.6).toFixed(1)}%</Td>
                      <Td>{won(product.international_shipping_cost ?? 0)}</Td>
                      <Td>{won(product.coupang_inbound_shipping_cost ?? 0)}</Td>
                      <Td>{won(product.ad_cost ?? 0)}</Td>
                      <Td>{won(product.sale_price)}</Td>
                      <Td>{won(singleProfit)}</Td>
                      <Td>{profitMargin(product, singleProfit).toFixed(1)}%</Td>
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
                  );
                })}
              </tbody>
            </Table>
          </div>
        ))}
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-ink/65">
      <span>{label}</span>
      {children}
    </label>
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

function colorLabel(key: string, products: ProductWithStock[]) {
  return products[0]?.color || colorName(key);
}

function colorName(key: string) {
  if (key === "WH") return "白色";
  if (key === "BL") return "黑色";
  if (key === "GR") return "灰色";
  if (key === "BE") return "米色";
  return "其他";
}

function won(value: number | null | undefined) {
  return `₩${Math.round(Number(value ?? 0)).toLocaleString("ko-KR")}`;
}
