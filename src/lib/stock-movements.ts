import { supabase } from "./supabase";

const PAGE_SIZE = 1000;

export async function fetchAllStockMovements<T = Record<string, unknown>>(select = "*", pageSize = PAGE_SIZE) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("stock_movements")
      .select(select)
      .order("happened_at", { ascending: false })
      .range(from, to);

    if (error) return { data: rows, error };

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
    from += pageSize;
  }
}
