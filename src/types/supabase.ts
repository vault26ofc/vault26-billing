// Row shapes of the Vault 26 Supabase tables this app reads or writes.
// Website tables (products, product_variants, categories, orders, settings,
// brand_settings) belong to vault26.co.in and are only read here, except
// stock, which moves through the pos_* database functions.

export interface DbProduct {
  id: string;
  slug: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  // Base price; a variant can carry its own price.
  price: number | null;
  compare_at: number | null;
  images: string[];
  // Derived by the database from the variants - never written.
  sizes: string[];
  stock: number;
  description: string | null;
  material: string | null;
  care: string | null;
  is_active: boolean;
  is_featured: boolean;
  // Sold only in the shop; hidden from the website. Missing until the
  // website migration that adds it has been applied.
  store_only?: boolean;
  created_at: string;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
}

export interface DbProductCategory {
  product_id: string;
  category_id: string;
}

export interface DbProductVariant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  stock: number;
  price: number;
  compare_price: number | null;
  sku: string | null;
  created_at: string;
}

export interface DbPosStaff {
  id: string;
  user_id: string;
  display_name: string;
  role: 'OWNER' | 'MANAGER' | 'BILLING' | 'FULFILLMENT';
  is_active: boolean;
  permissions: string[];
  created_at: string;
}

export interface DbPosCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  linked_profile_id: string | null;
  gstin: string | null;
  orders_count: number;
  total_spend: number;
  created_at: string;
}

export interface DbPosSettings {
  id: string;
  tax_rate: number;
  tax_threshold: number;
  tax_rate_low: number;
  tax_rate_high: number;
  shipping_flat_rate: number;
  free_shipping_threshold: number;
  currency: string;
  invoice_prefix: string;
  printer_name: string | null;
  printer_connection: 'WIFI' | 'USB' | 'ETHERNET' | null;
  last_test_print: string | null;
  updated_at: string;
}

// settings row key = 'invoice' (Vault 26 admin -> Invoice template). Every
// field is optional: the admin may not have filled it in yet.
export interface DbInvoiceTemplate {
  company_name?: string;
  tagline?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstin?: string;
  logo_url?: string;
  footer_note?: string;
  terms?: string;
  tax_rate?: number | string;
  tax_label?: string;
  show_tax?: boolean;
  invoice_prefix?: string;
}

export interface DbBrandSettings {
  site_name: string;
  tagline: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  logo_url: string | null;
}

export interface DbPosBill {
  id: string;
  bill_number: string;
  pos_customer_id: string | null;
  staff_id: string | null;
  channel: 'OFFLINE';
  subtotal: number;
  discount: number;
  discount_reason: string | null;
  tax_amount: number;
  tax_rate: number;
  tax_is_custom: boolean;
  shipping_fee: number;
  grand_total: number;
  payment_status: 'PAID' | 'PENDING' | 'REFUNDED' | 'FAILED';
  status: 'COMPLETED' | 'VOID' | 'RETURNED';
  notes: string | null;
  customer_gstin: string | null;
  created_at: string;
}

export interface DbPosBillItem {
  id: string;
  bill_id: string;
  variant_id: string | null;
  product_id: string | null;
  product_slug: string;
  product_name: string;
  size: string | null;
  color: string | null;
  qty: number;
  unit_price: number;
  item_discount: number;
  line_total: number;
  created_at: string;
}

export interface DbPosPaymentTransaction {
  id: string;
  bill_id: string;
  method: 'CASH' | 'UPI' | 'CARD' | 'OTHER';
  amount: number;
  tendered: number | null;
  change_amount: number | null;
  status: 'SUCCESS' | 'REFUNDED' | 'PENDING';
  created_at: string;
}

export interface DbPosInventoryLog {
  id: string;
  variant_id: string | null;
  product_id: string | null;
  product_slug: string;
  change_qty: number;
  new_stock: number;
  reason: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'RETURN_RESTOCK' | 'DAMAGED' | 'VOID' | 'EDIT';
  bill_id: string | null;
  staff_id: string | null;
  note: string | null;
  created_at: string;
}

export interface DbPosReturn {
  id: string;
  return_number: string;
  bill_id: string;
  bill_item_id: string;
  qty: number;
  reason: string;
  condition: string | null;
  refund_amount: number;
  status: 'REQUESTED' | 'APPROVED' | 'REFUNDED' | 'REJECTED';
  staff_id: string | null;
  created_at: string;
}

// A vault26.co.in order as the billing app reads it (orders + order_items).
export interface DbWebsiteOrder {
  id: string;
  order_number: string;
  // V26W-YYMM-NNNN, set by the database when the order is delivered.
  invoice_no: string | null;
  email: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: 'PENDING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  payment_method: 'RAZORPAY' | 'COD';
  payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  refund_status: string;
  coupon_code: string | null;
  shipping_address: {
    full_name?: string;
    phone?: string;
    email?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
  order_items: {
    id: string;
    variant_id: string | null;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    price_at_purchase: number;
    product_variants: { product_id: string; size: string | null; color: string | null } | null;
  }[];
}
