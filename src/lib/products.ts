import type { Product } from "./types";

export const DELETED_PRODUCT_MEMO_PREFIX = "__ERP_DELETED__";

export function isDeletedProduct(product: Pick<Product, "memo">) {
  return String(product.memo ?? "").startsWith(DELETED_PRODUCT_MEMO_PREFIX);
}

export function activeProducts<T extends Pick<Product, "memo">>(products: T[]) {
  return products.filter((product) => !isDeletedProduct(product));
}

export function markProductDeletedMemo(memo: string | null | undefined) {
  const currentMemo = stripDeletedProductMemo(memo).trim();
  return currentMemo ? `${DELETED_PRODUCT_MEMO_PREFIX}|${currentMemo}` : DELETED_PRODUCT_MEMO_PREFIX;
}

export function stripDeletedProductMemo(memo: string | null | undefined) {
  const value = String(memo ?? "");
  if (!value.startsWith(DELETED_PRODUCT_MEMO_PREFIX)) return value;
  return value.replace(/^__ERP_DELETED__(\|)?/, "");
}
