import { CommerceSettings, Order } from '../types';
import { PrintableReceiptData, printTaxInvoice, printThermalReceipt } from './receiptPrinter';

// Every place that prints a shop bill builds the print the same way: the
// bill's own amounts and tax rate, plus the business details from settings.
export function receiptDataFor(bill: Order, settings: CommerceSettings): PrintableReceiptData {
  return {
    orderNumber: bill.orderNumber,
    createdAt: bill.createdAt,
    customerName: bill.customerName,
    customerPhone: bill.customerPhone,
    customerEmail: bill.customerEmail,
    customerGstin: bill.customerGstin,
    items: bill.items,
    subtotal: bill.subtotal,
    discount: bill.discount,
    discountReason: bill.discountReason,
    taxAmount: bill.taxAmount,
    grandTotal: bill.grandTotal,
    paymentMethod: bill.paymentMethod,
    paymentSplits: bill.paymentSplits,
    changeAmount: bill.changeAmount,
    storeSettings: {
      storeName: settings.brand || settings.storeName,
      tagline: settings.tagline,
      address: settings.address,
      cityState: settings.cityState,
      state: settings.state,
      phone: settings.phone,
      email: settings.email,
      gstin: settings.gstin,
      terms: settings.terms,
      footer: settings.footer,
      // Always the rate this bill was actually charged, never today's settings.
      taxRate: bill.taxRate ?? 0,
      taxIsCustom: bill.taxIsCustom,
    },
  };
}

export function printBill(bill: Order, settings: CommerceSettings, kind: 'SLIP' | 'TAX_INVOICE'): Promise<boolean> {
  const data = receiptDataFor(bill, settings);
  return kind === 'SLIP' ? printThermalReceipt(data) : printTaxInvoice(data);
}
