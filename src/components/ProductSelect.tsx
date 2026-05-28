"use client";

import type { ProductWithStock } from "@/lib/types";

const colorOrder = ["WH", "BL", "GR", "BE", "OTHER"];

export function ProductSelect({
  products,
  value,
  onChange
}: {
  products: ProductWithStock[];
  value: string;
  onChange: (value: string) => void;
}) {
  const groupedProducts = groupProductsByColor(products);

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Select</option>
      {groupedProducts.map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.products.map((product) => (
            <option key={product.id} value={product.id}>
              {normalizedSize(product.size)} - {product.sku} - {product.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function groupProductsByColor(products: ProductWithStock[]) {
  const sortedProducts = [...products].sort(compareProducts);
  const groups = new Map<string, ProductWithStock[]>();

  for (const product of sortedProducts) {
    const key = colorKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return colorOrder
    .map((key) => ({ key, label: colorGroupLabel(key, groups.get(key) ?? []), products: groups.get(key) ?? [] }))
    .filter((group) => group.products.length > 0);
}

function compareProducts(a: ProductWithStock, b: ProductWithStock) {
  const colorDiff = colorOrder.indexOf(colorKey(a)) - colorOrder.indexOf(colorKey(b));
  if (colorDiff !== 0) return colorDiff;

  const aSize = normalizedSize(a.size) || baseSku(a.sku);
  const bSize = normalizedSize(b.size) || baseSku(b.sku);
  if (aSize !== bSize) return aSize.localeCompare(bSize, undefined, { numeric: true });

  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

function baseSku(sku: string) {
  return sku.replace(/-(WH|BL|GR|BE)$/i, "");
}

function normalizedSize(size: string | null) {
  return (size ?? "").replace(/\s+/g, "").trim();
}

function colorKey(product: ProductWithStock) {
  return product.sku.match(/-(WH|BL|GR|BE)$/i)?.[1]?.toUpperCase() ?? "OTHER";
}

function colorGroupLabel(key: string, products: ProductWithStock[]) {
  return products[0]?.color || key;
}
