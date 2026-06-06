"use client";

import type { ProductWithStock } from "@/lib/types";
import { activeProducts } from "@/lib/products";
import { useLanguage } from "./LanguageProvider";

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
  const { t } = useLanguage();
  const groupedProducts = groupProductsByColor(activeProducts(products), t);

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">{t("common.select")}</option>
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

function groupProductsByColor(products: ProductWithStock[], t: ReturnType<typeof useLanguage>["t"]) {
  const sortedProducts = [...products].sort(compareProducts);
  const groups = new Map<string, ProductWithStock[]>();

  for (const product of sortedProducts) {
    const key = colorKey(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return colorOrder
    .map((key) => ({ key, label: colorGroupLabel(key, t), products: groups.get(key) ?? [] }))
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

function colorGroupLabel(key: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (key === "WH") return t("color.white");
  if (key === "BL") return t("color.black");
  if (key === "GR") return t("color.gray");
  if (key === "BE") return t("color.beige");
  return t("color.other");
}
