import { supabase } from '../lib/supabaseClient';
import { fetchAllRows, fetchAllByIds } from './fetchAll';
import { DbInvoiceTemplate, DbPosBill, DbPosBillItem, DbPosCustomer, DbWebsiteOrder } from '../types/supabase';
import { WEBSITE_ORDER_SELECT, fetchBrandSettings, fetchInvoiceTemplate, websiteLineVariant, websiteOrderTax } from './website';
import { variantLabel } from '../utils/singleItem';
import { tr } from '../i18n';

// One invoice as it goes into the monthly PDF - shop bills and website
// orders normalised to the same shape. Shop amounts are exactly what was
// stored. Website orders store no tax, so their tax is what the website's
// own invoice prints (see websiteOrderTax).
export interface MonthlyInvoiceLine {
  name: string;
  variant: string;
  qty: number;
  unitPrice: number;
  discount: number;
  amount: number;
}

export interface MonthlyInvoice {
  id: string;
  channel: 'OFFLINE' | 'ONLINE';
  invoiceNumber: string;
  // The customer's order id on the website (ONLINE only).
  orderNumber?: string;
  createdAt: string; // ISO timestamp from the database
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  // Place of supply. Shop sales are at the shop (its state); website orders
  // use the delivery state. It decides CGST + SGST vs IGST.
  placeOfSupply: string;
  interState: boolean;
  lines: MonthlyInvoiceLine[];
  subtotal: number;
  discount: number;
  taxable: number;
  taxRate: number;
  taxIsCustom: boolean;
  taxAmount: number;
  shipping: number;
  // Anything in the stored total not explained by taxable + tax + shipping
  // (e.g. a website COD fee) - shown, never hidden.
  otherCharges: number;
  grandTotal: number;
  payments: { method: string; amount: number }[];
  notes: string;
}

export interface MonthlyData {
  offline: MonthlyInvoice[]; // COMPLETED / RETURNED shop bills
  voided: MonthlyInvoice[]; // VOID shop bills - listed, never totalled
  online: MonthlyInvoice[]; // DELIVERED website orders, by delivery date
  storeState: string;
}

// Month boundaries in IST (the shop's timezone), as UTC ISO strings.
export function monthRangeIst(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return {
    from: new Date(`${year}-${pad(month)}-01T00:00:00+05:30`).toISOString(),
    to: new Date(`${next.y}-${pad(next.m)}-01T00:00:00+05:30`).toISOString(),
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const STORE_STATE_MISSING = 'STORE_STATE_MISSING';

const sameState = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The shop's state from the Invoice template. Without it the report cannot
// tell CGST + SGST from IGST, so it refuses instead of guessing.
function requireStoreState(tpl: DbInvoiceTemplate): string {
  const state = (tpl.state || '').trim();
  if (!state) {
    const err = new Error(
      tr("The shop's State is missing. Fill it in Vault 26 admin → Invoice template, then try again.")
    );
    err.name = STORE_STATE_MISSING;
    throw err;
  }
  return state;
}

async function fetchOfflineBills(from: string, to: string, storeState: string): Promise<MonthlyInvoice[]> {
  const { data: bills, error } = await fetchAllRows((start, end) =>
    supabase
      .from('pos_bills')
      .select('*')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: true })
      .order('id')
      .range(start, end)
  );
  if (error) throw new Error(error.message);
  const billRows = (bills || []) as DbPosBill[];
  if (billRows.length === 0) return [];

  const billIds = billRows.map((b) => b.id);
  const customerIds = Array.from(new Set(billRows.map((b) => b.pos_customer_id).filter(Boolean))) as string[];

  const [{ data: items, error: iErr }, { data: payments, error: pErr }, { data: customers, error: cErr }] =
    await Promise.all([
      fetchAllByIds(billIds, (ids, start, end) =>
        supabase.from('pos_bill_items').select('*').in('bill_id', ids).order('id').range(start, end)
      ),
      fetchAllByIds(billIds, (ids, start, end) =>
        supabase.from('pos_payment_transactions').select('id, bill_id, method, amount').in('bill_id', ids).order('id').range(start, end)
      ),
      fetchAllByIds(customerIds, (ids, start, end) =>
        supabase.from('pos_customers').select('*').in('id', ids).order('id').range(start, end)
      ),
    ]);
  if (iErr) throw new Error(iErr.message);
  if (pErr) throw new Error(pErr.message);
  if (cErr) throw new Error(cErr.message);

  const customerById = new Map(((customers || []) as DbPosCustomer[]).map((c) => [c.id, c]));

  return billRows.map((b) => {
    const customer = b.pos_customer_id ? customerById.get(b.pos_customer_id) : undefined;
    const lines = ((items || []) as DbPosBillItem[])
      .filter((i) => i.bill_id === b.id)
      .map((i) => ({
        name: i.product_name,
        variant: variantLabel(i.size, i.color),
        qty: num(i.qty),
        unitPrice: num(i.unit_price),
        discount: num(i.item_discount),
        amount: num(i.line_total),
      }));
    const subtotal = num(b.subtotal);
    const discount = num(b.discount);
    const taxAmount = num(b.tax_amount);
    const shipping = num(b.shipping_fee);
    const grandTotal = num(b.grand_total);
    const taxable = round2(subtotal - discount);
    return {
      id: b.id,
      channel: 'OFFLINE' as const,
      invoiceNumber: b.bill_number,
      createdAt: b.created_at,
      status: b.status,
      customerName: customer?.name || 'Walk-in Customer',
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      customerAddress: [customer?.address, customer?.city].filter(Boolean).join(', '),
      placeOfSupply: storeState,
      interState: false,
      lines,
      subtotal,
      discount,
      taxable,
      taxRate: num(b.tax_rate),
      taxIsCustom: !!b.tax_is_custom,
      taxAmount,
      shipping,
      otherCharges: round2(grandTotal - (taxable + taxAmount + shipping)),
      grandTotal,
      payments: ((payments || []) as { bill_id: string; method: string; amount: number }[])
        .filter((p) => p.bill_id === b.id)
        .map((p) => ({ method: p.method, amount: num(p.amount) })),
      notes: b.notes || '',
    };
  });
}

async function fetchWebsiteOrders(
  from: string,
  to: string,
  storeState: string,
  tpl: DbInvoiceTemplate
): Promise<MonthlyInvoice[]> {
  // The V26W invoice is issued on delivery, so the order belongs to its
  // delivery month; one with no delivered_at falls back to its order date.
  const { data, error } = await fetchAllRows((start, end) =>
    supabase
      .from('orders')
      .select(WEBSITE_ORDER_SELECT)
      .eq('status', 'DELIVERED')
      .is('replacement_of', null)
      .neq('refund_status', 'REFUNDED')
      .or(
        `and(delivered_at.gte."${from}",delivered_at.lt."${to}"),and(delivered_at.is.null,created_at.gte."${from}",created_at.lt."${to}")`
      )
      .order('id')
      .range(start, end)
  );
  if (error) throw new Error(error.message);

  return ((data || []) as unknown as DbWebsiteOrder[]).map((o) => {
    const addr = o.shipping_address || {};
    const lines = (o.order_items || []).map((i) => {
      const qty = num(i.quantity);
      const unitPrice = num(i.price_at_purchase);
      const { size, color } = websiteLineVariant(i);
      return {
        name: i.product_name,
        variant: variantLabel(size || null, color || null) || i.variant_label || '',
        qty,
        unitPrice,
        discount: 0,
        amount: round2(qty * unitPrice),
      };
    });
    const subtotal = num(o.subtotal);
    const discount = num(o.discount);
    const tax = websiteOrderTax(o, tpl);
    const shipping = num(o.shipping);
    const grandTotal = num(o.total);
    const taxable = round2(subtotal - discount);
    const placeOfSupply = (addr.state || '').trim() || storeState;
    return {
      id: o.id,
      channel: 'ONLINE' as const,
      invoiceNumber: o.invoice_no || o.order_number,
      orderNumber: o.order_number,
      createdAt: o.delivered_at || o.created_at,
      status: o.status,
      customerName: addr.full_name || o.email,
      customerPhone: addr.phone || '',
      customerEmail: o.email,
      customerAddress: [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
      placeOfSupply,
      interState: !sameState(placeOfSupply, storeState),
      lines,
      subtotal,
      discount,
      taxable,
      taxRate: tax.rate,
      taxIsCustom: false,
      taxAmount: tax.amount,
      shipping,
      otherCharges: round2(grandTotal - (taxable + tax.amount + shipping)),
      grandTotal,
      payments: [{ method: o.payment_method === 'COD' ? 'COD' : 'ONLINE (RAZORPAY)', amount: grandTotal }],
      notes: o.notes || '',
    };
  });
}

export async function fetchMonthlyData(year: number, month: number): Promise<MonthlyData> {
  const { from, to } = monthRangeIst(year, month);
  const tpl = await fetchInvoiceTemplate();
  const storeState = requireStoreState(tpl);
  const [bills, online] = await Promise.all([
    fetchOfflineBills(from, to, storeState),
    fetchWebsiteOrders(from, to, storeState, tpl),
  ]);
  return {
    offline: bills.filter((b) => b.status !== 'VOID'),
    voided: bills.filter((b) => b.status === 'VOID'),
    online: online.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    storeState,
  };
}

// Same state as the shop -> CGST + SGST; any other state -> IGST.
export function isInterState(inv: MonthlyInvoice): boolean {
  return inv.interState;
}

export interface ChannelTotals {
  count: number;
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
}

export function splitTax(inv: MonthlyInvoice): { cgst: number; sgst: number; igst: number } {
  if (isInterState(inv)) return { cgst: 0, sgst: 0, igst: inv.taxAmount };
  const cgst = round2(inv.taxAmount / 2);
  return { cgst, sgst: round2(inv.taxAmount - cgst), igst: 0 };
}

export function totalsFor(invoices: MonthlyInvoice[]): ChannelTotals {
  return invoices.reduce<ChannelTotals>(
    (t, inv) => {
      const { cgst, sgst, igst } = splitTax(inv);
      return {
        count: t.count + 1,
        subtotal: round2(t.subtotal + inv.subtotal),
        discount: round2(t.discount + inv.discount),
        taxable: round2(t.taxable + inv.taxable),
        cgst: round2(t.cgst + cgst),
        sgst: round2(t.sgst + sgst),
        igst: round2(t.igst + igst),
        tax: round2(t.tax + inv.taxAmount),
        shipping: round2(t.shipping + inv.shipping),
        other: round2(t.other + inv.otherCharges),
        total: round2(t.total + inv.grandTotal),
      };
    },
    { count: 0, subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, shipping: 0, other: 0, total: 0 }
  );
}

// Invoice identity straight from the website's Invoice template (Vault 26
// admin -> Invoice template). Blank fields stay blank - nothing is invented.
export async function fetchInvoiceIdentity(): Promise<{
  brand: string;
  tagline: string;
  address: string;
  gstin: string;
  phone: string;
  email: string;
  terms: string;
  footer: string;
  signatory: string;
}> {
  const [tpl, brandRow] = await Promise.all([fetchInvoiceTemplate(), fetchBrandSettings().catch(() => null)]);
  const brand = tpl.company_name || brandRow?.site_name || 'Vault 26';
  return {
    brand,
    tagline: tpl.tagline || brandRow?.tagline || '',
    address: [tpl.address_line1, tpl.address_line2, [tpl.city, tpl.state, tpl.pincode].filter(Boolean).join(', '), tpl.country]
      .filter(Boolean)
      .join(', '),
    gstin: tpl.gstin || '',
    phone: tpl.phone || brandRow?.contact_phone || '',
    email: tpl.email || brandRow?.contact_email || '',
    terms: tpl.terms || '',
    footer: tpl.footer_note || '',
    signatory: brand,
  };
}
