import type { PostgrestError } from '@supabase/supabase-js';

// Supabase returns at most "Max rows" (Project Settings → Data API) rows per
// request, so reading a whole table in one go silently stops there once the
// table grows. Big tables are read PAGE_ROWS at a time instead, which works
// for any Max rows setting of PAGE_ROWS or more (Supabase's default is 1000).
export const PAGE_ROWS = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/**
 * Every row of a query, fetched page by page. The query must have a stable
 * order ending in a unique column (e.g. `.order('id')`), or rows can repeat
 * or go missing between pages.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => Page<T>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) return { data: rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_ROWS) return { data: rows, error: null };
  }
}

// `.in(column, ids)` puts every id in the URL; a few thousand would make it
// too long for the server, so ids are sent in batches.
const IDS_PER_REQUEST = 150;

/** fetchAllRows for `.in()` lookups: ids in URL-safe batches, each batch paged. */
export async function fetchAllByIds<T>(
  ids: string[],
  page: (ids: string[], from: number, to: number) => Page<T>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) batches.push(ids.slice(i, i + IDS_PER_REQUEST));
  const results = await Promise.all(batches.map((batch) => fetchAllRows<T>((from, to) => page(batch, from, to))));
  const failed = results.find((r) => r.error);
  if (failed) return { data: [], error: failed.error };
  return { data: results.flatMap((r) => r.data), error: null };
}
