import { useState, useEffect } from 'react';
import {
  Product,
  Collection,
  Order,
  OrderItem,
  Customer,
  ReturnRequest,
  PaymentTransaction,
  InventoryLog,
  StaffMember,
  CommerceSettings,
  ToastMessage,
  FulfillmentStatus,
  ReturnStatus,
} from '../types';
import * as posApi from '../api/pos';
import { getCurrentStaff } from '../api/auth';
import { dbRoleForStaffRole } from '../constants/permissions';
import { supabase } from '../lib/supabaseClient';
import { toIstDateTime } from '../utils/formatters';
import { tr } from '../i18n';

interface PaymentSplitLike {
  method: string;
  amount: number;
  tendered?: number;
  change?: number;
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface CommerceState {
  products: Product[];
  collections: Collection[];
  categories: StoreCategory[];
  orders: Order[];
  // Website orders (ONLINE channel) - read-only, never mixed into `orders`.
  onlineOrders: Order[];
  customers: Customer[];
  returns: ReturnRequest[];
  payments: PaymentTransaction[];
  inventoryLogs: InventoryLog[];
  staff: StaffMember[];
  currentStaff: StaffMember | null;
  settings: CommerceSettings;
  toasts: ToastMessage[];
  ready: boolean;
}

let currentState: CommerceState = {
  products: [],
  collections: [],
  categories: [],
  orders: [],
  onlineOrders: [],
  customers: [],
  returns: [],
  payments: [],
  inventoryLogs: [],
  staff: [],
  currentStaff: null,
  settings: {
    storeName: 'Vault 26',
    brand: 'Vault 26',
    tagline: '',
    address: '',
    cityState: '',
    state: '',
    country: 'India',
    phone: '',
    email: '',
    website: 'vault26.co.in',
    gstin: '',
    logoUrl: '',
    terms: '',
    footer: '',
    invoicePrefix: 'V26S',
    currency: 'INR',
    taxRate: 0,
    taxThreshold: 2599,
    taxRateLow: 5,
    taxRateHigh: 18,
    shippingFlatRate: 0,
    freeShippingThreshold: 0,
    lowStockThreshold: 5,
    printer: { name: '', status: 'OFFLINE', connection: 'USB' },
  },
  toasts: [],
  ready: false,
};
const listeners = new Set<(state: CommerceState) => void>();

function saveState(state: CommerceState) {
  currentState = state;
  listeners.forEach((listener) => listener(currentState));
}

let currentStaffId: string | null = null;

export async function initStore(): Promise<void> {
  const [products, customers, staff, settings, categories] = await Promise.all([
    posApi.fetchProducts(),
    posApi.fetchCustomers(),
    posApi.fetchStaff(),
    posApi.fetchSettings(),
    posApi.fetchCategories(),
  ]);
  const [orders, inventoryLogs, payments, returns, onlineOrders] = await Promise.all([
    posApi.fetchBills(),
    posApi.fetchInventoryLogs(),
    posApi.fetchPaymentTransactions(),
    posApi.fetchReturns(),
    // A website-orders failure must not stop the POS from loading.
    posApi.fetchOnlineOrders().catch((err) => {
      console.warn('fetchOnlineOrders:', err);
      return [] as Order[];
    }),
  ]);
  const collections = posApi.deriveCollections(products, orders);

  const staffRecord = await getCurrentStaff();
  currentStaffId = staffRecord?.id || null;
  const currentStaff = staff.find((s) => s.id === currentStaffId) || null;

  saveState({
    ...currentState,
    products,
    customers,
    staff,
    currentStaff,
    settings,
    orders,
    onlineOrders,
    inventoryLogs,
    payments,
    returns,
    collections,
    categories,
    ready: true,
  });

  subscribeToLiveInventory();
}

let realtimeSubscribed = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleInventoryRefresh() {
  // Coalesce bursts of row-level change events (e.g. a multi-item checkout on
  // the website) into a single refetch instead of one per row.
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    // Categories too: ones added in the website admin while this POS is open.
    const [products, categories] = await Promise.all([posApi.fetchProducts(), posApi.fetchCategories()]);
    const collections = posApi.deriveCollections(products, currentState.orders);
    saveState({ ...currentState, products, collections, categories });
  }, 400);
}

function subscribeToLiveInventory() {
  if (realtimeSubscribed) return;
  realtimeSubscribed = true;

  // Any stock change - from this POS, another POS terminal, or the website
  // checkout - lands in product_variants/products. Push it to every open
  // screen immediately instead of waiting for the next local action.
  supabase
    .channel('pos-inventory-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, scheduleInventoryRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleInventoryRefresh)
    .subscribe();
}

export const store = {
  getState: (): CommerceState => currentState,

  subscribe: (listener: (state: CommerceState) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // Toast System
  addToast: (title: string, message?: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, title, message, type };
    saveState({
      ...currentState,
      toasts: [...currentState.toasts, newToast],
    });

    setTimeout(() => {
      store.removeToast(id);
    }, 4000);
  },

  removeToast: (id: string) => {
    saveState({
      ...currentState,
      toasts: currentState.toasts.filter((t) => t.id !== id),
    });
  },

  // ORDERS & COMMERCE ENGINE
  createOrder: async (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'timeline'>): Promise<Order> => {
    // Every cart line is a real colour x size row, so stock always moves on
    // that exact row.
    const items = orderData.items.map((item) => ({
      variantId: item.variantId,
      productId: item.productId,
      productSlug: currentState.products.find((p) => p.id === item.productId)?.sku || '',
      productName: item.name,
      size: item.size || null,
      color: item.color || null,
      qty: item.quantity,
      unitPrice: item.unitPrice,
      itemDiscount: item.itemDiscount || 0,
    }));

    const rawPayments: PaymentSplitLike[] =
      orderData.paymentSplits && orderData.paymentSplits.length > 0
        ? orderData.paymentSplits
        : [
            {
              method: orderData.paymentMethod,
              amount: orderData.grandTotal,
              tendered: orderData.tenderedAmount,
              change: orderData.changeAmount,
            },
          ];

    const payments = rawPayments.map((p) => ({
      method: (p.method === 'COD' || p.method === 'BANK' || p.method === 'SPLIT' ? 'OTHER' : p.method) as
        | 'CASH'
        | 'UPI'
        | 'CARD'
        | 'OTHER',
      amount: p.amount,
      tendered: p.tendered ?? null,
      changeAmount: p.change ?? null,
    }));

    // orderData.discount is the total saving (item + bill); the database nets
    // item discounts out of each line itself, so only the bill-level part is
    // sent - sending the total would subtract item discounts twice.
    const itemDiscountTotal = items.reduce((sum, i) => sum + i.itemDiscount, 0);

    const newOrder = await posApi.checkout({
      items,
      customerId:
        orderData.customerId && orderData.customerId !== 'guest' ? orderData.customerId : null,
      staffId: currentStaffId,
      discount: Math.max(0, orderData.discount - itemDiscountTotal),
      discountReason: orderData.discountReason || null,
      customTaxRate: orderData.taxIsCustom && orderData.taxRate !== undefined ? orderData.taxRate : null,
      shippingFee: orderData.shippingFee,
      payments,
      notes: orderData.notes || null,
      customerGstin: orderData.customerGstin || null,
    });

    const [products, customers, inventoryLogs] = await Promise.all([
      posApi.fetchProducts(),
      posApi.fetchCustomers(),
      posApi.fetchInventoryLogs(),
    ]);

    saveState({
      ...currentState,
      orders: [newOrder, ...currentState.orders],
      products,
      customers,
      inventoryLogs,
    });

    store.addToast(tr('Bill saved'), `${newOrder.orderNumber} · ₹${newOrder.grandTotal.toLocaleString('en-IN')}`, 'success');
    return newOrder;
  },

  voidBill: async (billId: string, reason: string): Promise<Order> => {
    const voided = await posApi.voidBill(billId, currentStaffId, reason);

    const [orders, products, customers, inventoryLogs] = await Promise.all([
      posApi.fetchBills(),
      posApi.fetchProducts(),
      posApi.fetchCustomers(),
      posApi.fetchInventoryLogs(),
    ]);
    saveState({ ...currentState, orders, products, customers, inventoryLogs });

    store.addToast(tr('Bill cancelled'), `${voided.orderNumber} · ${tr('Items are back in stock.')}`, 'info');
    return voided;
  },

  editBill: async (
    billId: string,
    items: OrderItem[],
    fields: { discount: number; discountReason?: string; customTaxRate: number | null; shippingFee: number; notes?: string }
  ): Promise<Order> => {
    const checkoutItems = items.map((item) => {
      const product = currentState.products.find((p) => p.id === item.productId);
      // A line whose variant was since deleted on the website keeps its
      // snapshot and moves no stock.
      const hasRealVariant = !!product?.variants.find((v) => v.id === item.variantId);
      return {
        variantId: hasRealVariant ? item.variantId : null,
        productId: item.productId,
        productSlug: product?.sku || '',
        productName: item.name,
        size: item.size || null,
        color: item.color || null,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        itemDiscount: item.itemDiscount || 0,
      };
    });

    const edited = await posApi.editBill({
      billId,
      items: checkoutItems,
      discount: fields.discount,
      discountReason: fields.discountReason || null,
      customTaxRate: fields.customTaxRate,
      shippingFee: fields.shippingFee,
      notes: fields.notes || null,
      editorStaffId: currentStaffId,
    });

    const [orders, products, customers, inventoryLogs] = await Promise.all([
      posApi.fetchBills(),
      posApi.fetchProducts(),
      posApi.fetchCustomers(),
      posApi.fetchInventoryLogs(),
    ]);
    saveState({ ...currentState, orders, products, customers, inventoryLogs });

    store.addToast(tr('Bill changed'), `${edited.orderNumber} · ₹${edited.grandTotal.toLocaleString('en-IN')}`, 'success');
    return edited;
  },

  updateFulfillmentStatus: (
    orderId: string,
    status: FulfillmentStatus,
    courierName?: string,
    trackingNumber?: string
  ) => {
    const order = currentState.orders.find((o) => o.id === orderId);
    if (!order) return;

    const now = toIstDateTime(new Date());
    const timelineEvent = {
      status,
      time: now,
      note: trackingNumber ? `Tracking: ${trackingNumber} (${courierName})` : `Updated to [${status}]`,
    };

    const updatedOrders = currentState.orders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          fulfillmentStatus: status,
          courierName: courierName || o.courierName,
          trackingNumber: trackingNumber || o.trackingNumber,
          timeline: [...o.timeline, timelineEvent],
        };
      }
      return o;
    });

    saveState({
      ...currentState,
      orders: updatedOrders,
    });

    store.addToast(tr('Order updated'), `${order.orderNumber} · ${status}`, 'info');
  },

  // INVENTORY - stock always moves on one colour x size row.
  adjustStock: async (productId: string, variantId: string, changeQty: number, reason: posApi.StockReason = 'ADJUSTMENT') => {
    const product = currentState.products.find((p) => p.id === productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) return;

    await posApi.adjustStock(variantId, changeQty, reason, currentStaffId);

    const [products, inventoryLogs] = await Promise.all([posApi.fetchProducts(), posApi.fetchInventoryLogs()]);
    saveState({ ...currentState, products, inventoryLogs });
    store.addToast(tr('Stock changed'), `${product.name} · ${variant.sku}`, 'info');
  },

  // CUSTOMERS
  addCustomer: async (
    cust: Omit<Customer, 'id' | 'ordersCount' | 'totalSpend' | 'averageOrderValue' | 'createdAt'>
  ): Promise<Customer> => {
    const newCustomer = await posApi.createCustomer({
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      address: cust.address,
      city: cust.city,
    });

    const customers = await posApi.fetchCustomers();
    saveState({ ...currentState, customers });
    store.addToast(tr('Customer added'), newCustomer.name, 'success');
    return newCustomer;
  },

  updateCustomer: async (
    id: string,
    updates: { name?: string; phone?: string; email?: string; address?: string; city?: string; gstin?: string }
  ): Promise<void> => {
    await posApi.updateCustomer(id, updates);
    const customers = await posApi.fetchCustomers();
    saveState({ ...currentState, customers });
    store.addToast(tr('Customer saved'), undefined, 'success');
  },

  // STAFF
  createStaffMember: async (input: {
    displayName: string;
    email: string;
    password: string;
    role: 'OWNER' | 'MANAGER' | 'BILLING' | 'FULFILLMENT';
    permissions: string[];
  }): Promise<StaffMember> => {
    const newStaff = await posApi.createStaffAccount({
      ...input,
      dbRole: dbRoleForStaffRole(input.role),
    });

    const staff = await posApi.fetchStaff();
    saveState({ ...currentState, staff });
    store.addToast(tr('Staff login created'), `${newStaff.name} · ${newStaff.role}`, 'success');
    return newStaff;
  },

  updateStaffPermissions: async (
    staffId: string,
    updates: { role?: 'OWNER' | 'MANAGER' | 'BILLING' | 'FULFILLMENT'; permissions?: string[]; isActive?: boolean }
  ) => {
    await posApi.updateStaffPermissions(staffId, updates);
    const staff = await posApi.fetchStaff();
    saveState({ ...currentState, staff });
    store.addToast(tr('Staff saved'), undefined, 'info');
  },

  // RETURNS
  updateReturnStatus: async (returnId: string, status: ReturnStatus) => {
    const ret = currentState.returns.find((r) => r.id === returnId);
    if (!ret) return;

    await posApi.updateReturnStatusDb(returnId, status);

    // Approving a refund puts the returned units back into sellable stock -
    // without this, inventory would drift every time a return is processed.
    if (status === 'REFUNDED' && ret.variantId && ret.qty) {
      await posApi.adjustStock(ret.variantId, ret.qty, 'RETURN_RESTOCK', currentStaffId);
    }

    const [returns, payments, products, inventoryLogs] = await Promise.all([
      posApi.fetchReturns(),
      posApi.fetchPaymentTransactions(),
      posApi.fetchProducts(),
      posApi.fetchInventoryLogs(),
    ]);
    saveState({ ...currentState, returns, payments, products, inventoryLogs });

    store.addToast(tr('Return updated'), `${ret.returnNumber} · ${status}`, 'info');
  },

  createReturnRequest: async (
    data: Omit<ReturnRequest, 'id' | 'returnNumber' | 'createdAt' | 'status'> & { billItemId: string; qty: number }
  ): Promise<ReturnRequest> => {
    const newReturn = await posApi.createReturn({
      billId: data.orderId,
      billItemId: data.billItemId,
      qty: data.qty,
      reason: data.reason,
      condition: data.condition,
      refundAmount: data.refundAmount,
      staffId: currentStaffId,
    });

    const returns = await posApi.fetchReturns();
    saveState({ ...currentState, returns });

    store.addToast(tr('Return started'), `${newReturn.returnNumber} · ${data.customerName}`, 'info');
    return newReturn;
  },

  // SETTINGS
  updateSettings: async (updates: Partial<CommerceSettings>) => {
    await posApi.saveSettings({
      taxRate: updates.taxRate,
      taxThreshold: updates.taxThreshold,
      taxRateLow: updates.taxRateLow,
      taxRateHigh: updates.taxRateHigh,
      shippingFlatRate: updates.shippingFlatRate,
      freeShippingThreshold: updates.freeShippingThreshold,
      currency: updates.currency,
      invoicePrefix: updates.invoicePrefix,
      printerName: updates.printer?.name,
      printerConnection: updates.printer?.connection,
    });
    const settings = await posApi.fetchSettings();
    saveState({
      ...currentState,
      settings,
    });
    store.addToast(tr('Settings saved'), undefined, 'success');
  },

  reloadFromDatabase: async () => {
    await initStore();
    store.addToast(tr('Refreshed'), tr('Latest products, bills and customers loaded.'), 'info');
  },

  testPrint: async () => {
    await posApi.recordTestPrint();
    const settings = await posApi.fetchSettings();
    saveState({ ...currentState, settings });
    store.addToast(tr('Test print saved'), tr('The time of this test print is saved in settings.'), 'success');
  },
};

export function useStore(): CommerceState {
  const [state, setState] = useState<CommerceState>(store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  return state;
}
