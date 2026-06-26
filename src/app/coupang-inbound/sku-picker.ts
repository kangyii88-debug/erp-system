import type { ProductWithStock } from "@/lib/types";

export type ProductSeries = "half_blackout" | "full_blackout" | "4locks";
export type ProductSeriesFilter = ProductSeries | "all";
type Language = "zh" | "ko";
type SkuPickerProduct = Pick<ProductWithStock, "id" | "sku" | "name" | "color" | "size">;

export type SkuPickerItem = {
  id: string;
  sku: string;
  productName: string;
  sizeLabel: string;
  colorLabel: string;
  series: ProductSeries;
  seriesLabel: string;
};

export type SkuPickerGroup = {
  series: ProductSeries;
  label: string;
  count: number;
  items: SkuPickerItem[];
};

export const PRODUCT_SERIES_ORDER: ProductSeries[] = ["half_blackout", "full_blackout", "4locks"];

const seriesLabels = {
  zh: {
    half_blackout: "蜂巢帘半遮光",
    full_blackout: "蜂巢帘全遮光",
    "4locks": "4lockS 系列"
  },
  ko: {
    half_blackout: "허니콤 반암막",
    full_blackout: "허니콤 암막",
    "4locks": "4lockS"
  }
} as const;

export function detectProductSeries(product: Pick<SkuPickerProduct, "sku" | "name">): ProductSeries {
  const keyword = `${product.sku} ${product.name}`.toLowerCase();

  if (keyword.includes("4lock")) return "4locks";
  if (keyword.includes("半遮光") || keyword.includes("반암막")) return "half_blackout";
  return "full_blackout";
}

export function seriesLabel(series: ProductSeries, language: Language) {
  return seriesLabels[language][series];
}

export function countProductsBySeries(products: SkuPickerProduct[]) {
  return products.reduce<Record<ProductSeries, number>>(
    (counts, product) => {
      counts[detectProductSeries(product)] += 1;
      return counts;
    },
    { half_blackout: 0, full_blackout: 0, "4locks": 0 }
  );
}

export function toSkuPickerItem(product: SkuPickerProduct, language: Language): SkuPickerItem {
  const series = detectProductSeries(product);

  return {
    id: product.id,
    sku: product.sku,
    productName: product.name,
    sizeLabel: normalizeSize(product.size),
    colorLabel: localizedColor(product, language),
    series,
    seriesLabel: seriesLabel(series, language)
  };
}

export function buildSkuPickerState(products: SkuPickerProduct[], language: Language, filter: ProductSeriesFilter, query: string) {
  const normalizedQuery = normalizeQuery(query);
  const groups = PRODUCT_SERIES_ORDER.map((series) => {
    const items = products
      .filter((product) => detectProductSeries(product) === series)
      .map((product) => toSkuPickerItem(product, language))
      .filter((item) => (filter === "all" ? true : item.series === filter))
      .filter((item) => matchesQuery(item, normalizedQuery))
      .sort(comparePickerItems);

    return {
      series,
      label: seriesLabel(series, language),
      count: items.length,
      items
    } satisfies SkuPickerGroup;
  }).filter((group) => group.items.length > 0);

  return {
    groups,
    totalCount: groups.reduce((sum, group) => sum + group.count, 0)
  };
}

function matchesQuery(item: SkuPickerItem, normalizedQuery: string) {
  if (!normalizedQuery) return true;

  const haystack = normalizeQuery(`${item.sizeLabel} ${item.colorLabel} ${item.sku} ${item.productName} ${item.seriesLabel}`);
  return haystack.includes(normalizedQuery);
}

function comparePickerItems(a: SkuPickerItem, b: SkuPickerItem) {
  const sizeDiff = sizeSortIndex(a.sizeLabel) - sizeSortIndex(b.sizeLabel);
  if (sizeDiff !== 0) return sizeDiff;

  const colorDiff = colorSortIndex(a.colorLabel) - colorSortIndex(b.colorLabel);
  if (colorDiff !== 0) return colorDiff;

  return a.sku.localeCompare(b.sku);
}

function colorSortIndex(colorLabel: string) {
  const order = ["白色", "화이트", "米色", "베이지", "灰色", "그레이", "黑色", "블랙"];
  const index = order.indexOf(colorLabel);
  return index === -1 ? 99 : index;
}

function localizedColor(product: Pick<SkuPickerProduct, "sku" | "color">, language: Language) {
  const value = `${product.sku} ${product.color ?? ""}`.toLowerCase();
  const key =
    value.includes("wh") || value.includes("white") || value.includes("白") || value.includes("화이트")
      ? "white"
      : value.includes("be") || value.includes("beige") || value.includes("米") || value.includes("베이지")
        ? "beige"
        : value.includes("gr") || value.includes("gray") || value.includes("grey") || value.includes("灰") || value.includes("그레이")
          ? "gray"
          : value.includes("bl") || value.includes("black") || value.includes("黑") || value.includes("블랙")
            ? "black"
            : "other";

  const labels = {
    zh: { white: "白色", beige: "米色", gray: "灰色", black: "黑色", other: "其他" },
    ko: { white: "화이트", beige: "베이지", gray: "그레이", black: "블랙", other: "기타" }
  } as const;

  return labels[language][key];
}

function sizeSortIndex(sizeLabel: string) {
  const [width, height] = sizeLabel.split("x").map((value) => Number(value));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 999999;
  return width * 1000 + height;
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeSize(size: string | null) {
  return (size ?? "").replace(/\s+/g, "").replace(/×/g, "x").replace(/cm$/i, "") || "-";
}
