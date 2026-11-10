import { Product, ProductVariant } from '../types';

// Stock in the same words as the Vault 26 admin: a colour x size row is
// "sold out" at 0 and "low" at or below the shop's low-stock number.
export function variantStockStatus(v: Pick<ProductVariant, 'stock'>, threshold: number): 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' {
  if (v.stock <= 0) return 'OUT_OF_STOCK';
  if (v.stock <= threshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function productStockSummary(p: Product, threshold: number) {
  const soldOut = p.variants.filter((v) => v.stock <= 0).length;
  const low = p.variants.filter((v) => v.stock > 0 && v.stock <= threshold).length;
  const status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' =
    p.totalStock <= 0 ? 'OUT_OF_STOCK' : soldOut > 0 || low > 0 ? 'LOW_STOCK' : 'IN_STOCK';
  return { soldOut, low, status };
}
