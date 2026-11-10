// A "single item" (no colours or sizes) is stored as one ONE SIZE stock row
// with no colour - same rule as the website admin. Rows left over from
// before switching to single item only survive at 0 stock (already sold),
// so they never count as options.
export const ONE_SIZE = 'ONE SIZE';

type StockRow = { size: string | null; color: string | null; stock: number };

export function singleItemVariant<T extends StockRow>(rows: T[]): T | null {
  const single = rows.find((r) => r.size === ONE_SIZE && !(r.color ?? '').trim());
  if (!single) return null;
  const others = rows.filter((r) => r !== single);
  if (others.some((r) => r.stock > 0)) return null;
  if (single.stock === 0 && others.length > 0) return null;
  return single;
}

// "Black / M" for a bill line; nothing for a single item. ONE SIZE is left
// out because it says nothing to the customer.
export function variantLabel(size?: string | null, color?: string | null): string {
  return [color, size]
    .map((s) => (s ?? '').trim())
    .filter((s) => s && s !== ONE_SIZE)
    .join(' / ');
}
