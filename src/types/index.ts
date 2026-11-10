export type PaymentMethod = 'UPI' | 'CARD' | 'CASH' | 'OTHER' | 'SPLIT' | 'COD' | 'BANK' | 'RAZORPAY';

export interface PaymentSplit {
  id: string;
  method: 'CASH' | 'UPI' | 'CARD' | 'OTHER';
  amount: number;
  tendered?: number;
  change?: number;
}

export type PaymentStatus = 'PAID' | 'PENDING' | 'REFUNDED' | 'FAILED';

export type FulfillmentStatus =
  | 'UNFULFILLED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export type CustomerSegment = 'VIP' | 'HIGH_VALUE' | 'ACTIVE' | 'NEW' | 'AT_RISK';

export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'REFUNDED'
  | 'EXCHANGED'
  | 'REJECTED';

export type StaffRole = 'OWNER' | 'MANAGER' | 'BILLING' | 'ADMIN' | 'FULFILLMENT';

export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  barcode?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  collection: string;
  category: string;
  // Every category the product belongs to on the website (main + extra,
  // plus their parent categories) - what the billing category filter matches.
  categories?: string[];
  price: number;
  compareAtPrice?: number;
  sizes: string[];
  colors: string[];
  variants: ProductVariant[];
  totalStock: number;
  // No per-colour/size stock rows yet - can't be billed until the website
  // admin enters size counts.
  needsSizeCounts?: boolean;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  // Sold only in the shop; hidden from vault26.co.in.
  storeOnly?: boolean;
  image: string;
  description: string;
  // From the website admin; used as defaults on price tags.
  material?: string;
  care?: string;
  tags: string[];
}

export interface Collection {
  id: string;
  name: string;
  code: string;
  description: string;
  productCount: number;
  revenue: number;
  unitsSold: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

export type SalesChannel = 'ONLINE' | 'OFFLINE';

export interface OrderItem {
  id?: string;
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemDiscount?: number;
  discountReason?: string;
}

export interface OrderTimelineEvent {
  status: string;
  time: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  // Customer's GSTIN when the bill was raised with "ADD CUSTOMER GST".
  customerGstin?: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  discountType?: 'PERCENT' | 'FIXED';
  discountPercent?: number;
  discountReason?: string;
  shippingFee: number;
  taxAmount: number;
  // Rate actually charged on this bill (slab or owner override) - invoices
  // print this, never the current settings rate.
  taxRate?: number;
  taxIsCustom?: boolean;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  tenderedAmount?: number;
  changeAmount?: number;
  courierName?: string;
  trackingNumber?: string;
  channel?: SalesChannel;
  createdAt: string;
  timeline: OrderTimelineEvent[];
  notes?: string;
  billStatus?: 'COMPLETED' | 'VOID' | 'RETURNED';
  staffId?: string;
  staffName?: string;
}

// Clothing Price Tag Types
export type ClothingCategory =
  | 'T-SHIRTS'
  | 'SHIRTS'
  | 'JEANS'
  | 'FOOTWEAR'
  | 'HOODIES'
  | 'JACKETS'
  | 'PANTS'
  | 'ACCESSORIES';

export type TagFormat = 'HANG_TAG' | 'STICKER' | 'SHOEBOX';

export interface PriceTagItem {
  id: string;
  productName: string;
  sku: string;
  category: ClothingCategory;
  color: string;
  size: string;
  mrp: number;
  offerPrice: number;
  barcode: string;
  fabricSpecs: string;
  fit: string;
  washCare: string[];
  mfdMonthYear: string;
  countryOfOrigin: string;
  quantity: number;
}

export interface InventoryLog {
  id: string;
  date: string;
  productId: string;
  productName: string;
  variantSku: string;
  changeQty: number;
  newStock: number;
  reason: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'RETURN_RESTOCK' | 'DAMAGED' | 'VOID' | 'EDIT';
  user: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  gstin?: string;
  ordersCount: number;
  totalSpend: number;
  averageOrderValue: number;
  lastOrderNumber?: string;
  lastOrderDate?: string;
  segment: CustomerSegment;
  createdAt: string;
}

export interface ReturnRequest {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  productTitle: string;
  variantName: string;
  reason: string;
  condition: string;
  refundAmount: number;
  status: ReturnStatus;
  createdAt: string;
  billItemId?: string;
  variantId?: string;
  productId?: string;
  qty?: number;
}

export interface PaymentTransaction {
  id: string;
  transactionRef: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  status: 'SUCCESS' | 'REFUNDED' | 'PENDING';
  date: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: 'ACTIVE' | 'OFFLINE';
  permissions: string[];
}

// Business identity comes from the website's Invoice template (Vault 26
// admin -> Invoice template); any field can still be blank there.
export interface CommerceSettings {
  storeName: string;
  brand: string;
  tagline: string;
  address: string;
  cityState: string;
  // The shop's state - decides CGST + SGST (same state) vs IGST.
  state: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  logoUrl: string;
  terms: string;
  footer: string;
  invoicePrefix: string;
  currency: string;
  taxRate: number;
  // GST slab: taxable value <= taxThreshold -> taxRateLow, above -> taxRateHigh.
  taxThreshold: number;
  taxRateLow: number;
  taxRateHigh: number;
  shippingFlatRate: number;
  freeShippingThreshold: number;
  // A colour x size row at or below this many pieces counts as low stock
  // (the same number the Vault 26 admin uses: settings key low_stock_threshold).
  lowStockThreshold: number;
  printer: {
    name: string;
    status: 'ONLINE' | 'OFFLINE';
    connection: 'WIFI' | 'USB' | 'ETHERNET';
    lastTestPrint?: string;
  };
}

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}
