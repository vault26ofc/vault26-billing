import { supabase } from '../lib/supabaseClient';
import { DbBrandSettings, DbInvoiceTemplate, DbWebsiteOrder } from '../types/supabase';

// What the billing app reads from vault26.co.in orders. Size, colour and the
// product come from the variant each line was sold from.
export const WEBSITE_ORDER_SELECT =
  'id, order_number, invoice_no, email, subtotal, discount, shipping, total, status, payment_method, payment_status, refund_status, coupon_code, shipping_address, notes, created_at, delivered_at, ' +
  'order_items(id, variant_id, product_name, variant_label, quantity, price_at_purchase, product_variants(product_id, size, color))';

// A website order counts as a sale once it is DELIVERED. ₹0 replacement
// orders (replacement_of set) and fully refunded orders are not sales. Every
// orders query in this app applies exactly these three filters:
//   .eq('status', 'DELIVERED').is('replacement_of', null).neq('refund_status', 'REFUNDED')

export async function fetchInvoiceTemplate(): Promise<DbInvoiceTemplate> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'invoice').maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.value as DbInvoiceTemplate | null) || {}) as DbInvoiceTemplate;
}

export async function fetchBrandSettings(): Promise<DbBrandSettings | null> {
  const { data, error } = await supabase
    .from('brand_settings')
    .select('site_name, tagline, contact_email, contact_phone, address, logo_url')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DbBrandSettings | null;
}

// Tax exactly as the website's own invoice prints it (src/pages/Invoice.tsx
// on vault26.co.in): the Invoice template's rate on (subtotal - discount),
// only when "show tax" is on. Website orders store no tax of their own.
export function websiteOrderTax(order: Pick<DbWebsiteOrder, 'subtotal' | 'discount'>, tpl: DbInvoiceTemplate): {
  rate: number;
  amount: number;
} {
  if (!tpl.show_tax) return { rate: 0, amount: 0 };
  const rate = Number(tpl.tax_rate || 0);
  const taxable = Math.max(Number(order.subtotal) - Number(order.discount), 0);
  return { rate, amount: Math.round((taxable * rate) / 100) };
}

export function websiteLineVariant(line: DbWebsiteOrder['order_items'][number]): { size: string; color: string } {
  return {
    size: line.product_variants?.size || '',
    color: line.product_variants?.color || '',
  };
}
