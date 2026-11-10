import JsBarcode from 'jsbarcode';
import { variantLabel } from './singleItem';
import { formatINR } from './formatters';
import { billQrSvg } from './billQr';
import { splitCgstSgst, formatRate } from './tax';
import { methodWord } from './paymentWords';

// HTML-escape text that came from people (names, notes) before it goes into
// the print document.
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PrintableReceiptData {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerGstin?: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  items: Array<{
    name: string;
    variantName?: string;
    size?: string;
    color?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  discountReason?: string;
  discountPercent?: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentSplits?: Array<{
    method: string;
    amount: number;
  }>;
  changeAmount?: number;
  // Business identity from the website's Invoice template; blank fields are
  // simply left off the print.
  storeSettings?: {
    storeName?: string;
    tagline?: string;
    address?: string;
    cityState?: string;
    // The shop's state = place of supply for a shop sale.
    state?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    terms?: string;
    footer?: string;
    taxRate?: number;
    taxIsCustom?: boolean;
  };
}

/**
 * Generates a real, scannable CODE128 barcode as inline SVG markup for the
 * given code (encodes the actual order number - not a decorative pattern).
 */
function getVectorBarcodeSvg(code: string): string {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const displayWidth = 180;
  const displayHeight = 32;
  try {
    JsBarcode(svgEl, code, {
      format: 'CODE128',
      width: 2,
      height: displayHeight,
      displayValue: false,
      margin: 0,
    });
    // JsBarcode sizes the SVG to the barcode's natural pixel width - for a
    // long order number that's often wider than the 180px slot on the
    // receipt, which is what was pushing it out of its box. Pin a viewBox
    // to that natural size, then force the display width/height back down
    // so it scales to fit instead of overflowing.
    const naturalWidth = parseFloat(svgEl.getAttribute('width') || String(displayWidth));
    const naturalHeight = parseFloat(svgEl.getAttribute('height') || String(displayHeight));
    svgEl.setAttribute('viewBox', `0 0 ${naturalWidth} ${naturalHeight}`);
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.setAttribute('width', String(displayWidth));
    svgEl.setAttribute('height', String(displayHeight));
  } catch {
    return `
      <div style="font-family: monospace; font-size: 10px; letter-spacing: 3px; font-weight: 700; color: #000000; margin-top: 3px; text-align: center;">${code}</div>
    `;
  }

  const barcodeMarkup = new XMLSerializer().serializeToString(svgEl);

  return `
    <div style="text-align: center; margin: 8px 0 4px;">
      <div style="display: inline-block; width: ${displayWidth}px; max-width: 100%;">${barcodeMarkup}</div>
      <div style="font-family: monospace; font-size: 10px; letter-spacing: 3px; font-weight: 700; color: #000000; margin-top: 3px;">${code}</div>
    </div>
  `;
}

// Full-bill QR for printed receipts/invoices (see utils/billQr.ts).
function getBillQrHtml(data: PrintableReceiptData, sizePx: number): string {
  const svg = billQrSvg(
    {
      ...data,
      taxRate: data.storeSettings?.taxRate,
      storeName: data.storeSettings?.storeName,
      gstin: data.storeSettings?.gstin,
    },
    sizePx
  );
  if (!svg) return '';
  return `
    <div style="text-align: center; margin: 6px 0 2px;">
      <div style="display: inline-block;">${svg}</div>
      <div style="font-family: monospace; font-size: 9px; color: #333333; text-transform: uppercase;">Scan for full bill</div>
    </div>
  `;
}

/**
 * 1. 80mm THERMAL RECEIPT PRINTER ENGINE
 * For standard 80 mm thermal roll bill printers.
 * Also renders cleanly when printed or saved as PDF without any dashed boxes or color fringing.
 */
export function printThermalReceipt(data: PrintableReceiptData): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve(false);
      return;
    }

    const itemsHtml = data.items
      .map(
        (item) => `
        <div class="item-row">
          <div class="item-info">
            <div class="item-name">${esc(item.name)}</div>
            <div class="item-meta">${variantLabel(item.size, item.color) ? esc(variantLabel(item.size, item.color)) + ' ' : ''}× ${item.quantity} @ ${formatINR(item.unitPrice)}</div>
          </div>
          <div class="item-total">${formatINR(item.total)}</div>
        </div>
      `
      )
      .join('');

    const tenderHtml =
      data.paymentSplits && data.paymentSplits.length > 0
        ? data.paymentSplits
            .map(
              (s) => `
          <div class="flex justify-between meta-line">
            <span class="label">${methodWord(s.method)}:</span>
            <span class="font-bold">${formatINR(s.amount)}</span>
          </div>
        `
            )
            .join('')
        : `
          <div class="flex justify-between meta-line">
            <span class="label">${methodWord(data.paymentMethod)}:</span>
            <span class="font-bold">${formatINR(data.grandTotal)}</span>
          </div>
        `;

    const changeHtml =
      data.changeAmount && data.changeAmount > 0
        ? `
        <div class="flex justify-between meta-line" style="font-weight: 700; margin-top: 3px;">
          <span class="label">CHANGE GIVEN:</span>
          <span class="font-bold">${formatINR(data.changeAmount)}</span>
        </div>
      `
        : '';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt - ${data.orderNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 80mm;
              margin: 0 auto;
              padding: 0;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              display: flex;
              justify-content: center;
              align-items: flex-start;
              padding: 4mm 0 8mm;
            }
            .receipt {
              width: 72mm;
              max-width: 74mm;
              margin: 0 auto;
              padding: 0 1mm;
              background: #ffffff;
              border: none !important;
              box-shadow: none !important;
            }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            
            .brand-title {
              font-size: 20px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1.1;
              color: #000000;
            }
            .brand-subtitle {
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 1.2px;
              text-transform: uppercase;
              color: #333333;
              margin-top: 2px;
            }
            .store-address {
              font-size: 8.5px;
              color: #555555;
              margin-top: 2px;
              line-height: 1.3;
            }
            
            .divider {
              border-bottom: 2px solid #000000;
              margin: 8px 0;
            }
            .divider-dashed {
              border-bottom: 1px dashed #777777;
              margin: 8px 0;
            }
            
            .flex {
              display: flex;
            }
            .justify-between {
              justify-content: space-between;
            }
            .items-start {
              align-items: flex-start;
            }
            
            .meta-line {
              font-size: 10.5px;
              margin-bottom: 3px;
              color: #000000;
            }
            .meta-line .label {
              color: #555555;
              font-weight: 600;
            }
            
            .items-container {
              margin: 6px 0;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 6px;
            }
            .item-info {
              flex: 1;
              padding-right: 6px;
            }
            .item-name {
              font-size: 11px;
              font-weight: 700;
              color: #000000;
              line-height: 1.25;
            }
            .item-meta {
              font-size: 9.5px;
              color: #555555;
              margin-top: 1px;
            }
            .item-total {
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              color: #000000;
            }
            
            .totals-container {
              margin: 6px 0;
            }
            .grand-total {
              font-size: 15px;
              font-weight: 900;
              padding-top: 5px;
              border-top: 2px solid #000000;
              margin-top: 5px;
              color: #000000;
            }
            
            .barcode-wrap {
              text-align: center;
              margin: 10px 0 4px;
              padding-top: 6px;
              border-top: 1px solid #000000;
            }
            .policy-footer {
              font-size: 8px;
              color: #666666;
              text-transform: uppercase;
              letter-spacing: 0.6px;
              margin-top: 4px;
              line-height: 1.3;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <!-- Brand Header -->
            <div class="text-center">
              <div class="brand-title">${esc(data.storeSettings?.storeName || 'Vault 26')}</div>
              ${data.storeSettings?.tagline ? `<div class="brand-subtitle">${esc(data.storeSettings.tagline)}</div>` : ''}
              ${data.storeSettings?.address ? `<div class="store-address">${esc(data.storeSettings.address)}</div>` : ''}
              ${data.storeSettings?.cityState ? `<div class="store-address">${esc(data.storeSettings.cityState)}</div>` : ''}
              ${data.storeSettings?.phone ? `<div class="store-address">Ph: ${esc(data.storeSettings.phone)}</div>` : ''}
              ${data.storeSettings?.gstin ? `<div class="store-address">GSTIN: ${esc(data.storeSettings.gstin)}</div>` : ''}
            </div>

            <div class="divider"></div>

            <!-- Receipt Metadata -->
            <div class="meta-line flex justify-between">
              <span class="label">BILL NO:</span>
              <span class="font-bold">${esc(data.orderNumber)}</span>
            </div>
            <div class="meta-line flex justify-between">
              <span class="label">DATE:</span>
              <span>${esc(data.createdAt)}</span>
            </div>
            <div class="meta-line flex justify-between">
              <span class="label">CUSTOMER:</span>
              <span class="font-bold">${esc(data.customerName)}</span>
            </div>
            ${
              data.customerPhone
                ? `
            <div class="meta-line flex justify-between">
              <span class="label">PHONE:</span>
              <span>${esc(data.customerPhone)}</span>
            </div>
            `
                : ''
            }
            ${
              data.customerGstin
                ? `
            <div class="meta-line flex justify-between">
              <span class="label">CUSTOMER GSTIN:</span>
              <span class="font-bold">${esc(data.customerGstin)}</span>
            </div>
            `
                : ''
            }

            <div class="divider-dashed"></div>

            <!-- Line Items -->
            <div class="items-container">
              ${itemsHtml}
            </div>

            <div class="divider-dashed"></div>

            <!-- Totals -->
            <div class="totals-container">
              <div class="meta-line flex justify-between">
                <span class="label">SUBTOTAL:</span>
                <span>${formatINR(data.subtotal)}</span>
              </div>
              ${
                data.discount > 0
                  ? `
              <div class="meta-line flex justify-between">
                <span class="label">DISCOUNT${data.discountReason ? ` (${esc(data.discountReason)})` : ''}:</span>
                <span class="font-bold">-${formatINR(data.discount)}</span>
              </div>
              `
                  : ''
              }
              <div class="meta-line flex justify-between">
                <span class="label">GST (${formatRate(data.storeSettings?.taxRate ?? 0)}%):</span>
                <span>${formatINR(data.taxAmount)}</span>
              </div>
              <div class="grand-total flex justify-between">
                <span>TOTAL:</span>
                <span>${formatINR(data.grandTotal)}</span>
              </div>
            </div>

            <div class="divider-dashed"></div>

            <!-- Tender Breakdown -->
            <div>
              <div class="meta-line font-bold uppercase" style="color: #000; margin-bottom: 4px;">PAID BY:</div>
              ${tenderHtml}
              ${changeHtml}
            </div>

            <!-- Authentic Vector Barcode -->
            <div class="barcode-wrap">
              ${getVectorBarcodeSvg(data.orderNumber)}
              ${getBillQrHtml(data, 180)}
              ${data.storeSettings?.footer ? `<div class="policy-footer">${esc(data.storeSettings.footer)}</div>` : ''}
              <div class="policy-footer">Thank you for shopping at ${esc(data.storeSettings?.storeName || 'Vault 26')}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Trigger print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve(true);
      } catch (err) {
        console.error('Iframe print error:', err);
        window.print();
        resolve(true);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 250);
  });
}

/**
 * 2. A4 GST TAX INVOICE
 * For A4 printers and "Save as PDF". Business details, terms and footer come
 * from the Vault 26 Invoice template. There is no HSN column: Vault 26
 * products carry no HSN code, and printing a made-up one would be wrong.
 */
export function printTaxInvoice(data: PrintableReceiptData): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve(false);
      return;
    }

    const itemsRows = data.items
      .map(
        (item, index) => `
        <tr style="border-bottom: 1px solid #E5E5E7;">
          <td style="padding: 10px 8px; font-weight: 600; color: #0A0A0A;">
            ${index + 1}. ${esc(item.name)}
          </td>
          <td style="padding: 10px 8px; font-size: 11px; color: #555555;">
            ${esc(variantLabel(item.size, item.color)) || '—'}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 600;">
            ${item.quantity}
          </td>
          <td style="padding: 10px 8px; text-align: right; color: #444444;">
            ${formatINR(item.unitPrice)}
          </td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #0A0A0A;">
            ${formatINR(item.total)}
          </td>
        </tr>
      `
      )
      .join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Tax Invoice - ${data.orderNumber}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 14mm 16mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              background: #ffffff !important;
              color: #0A0A0A !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              line-height: 1.4;
            }
            .invoice-box {
              max-width: 800px;
              margin: 0 auto;
            }
            .header-flex {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0A0A0A;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .brand-name {
              font-size: 28px;
              font-weight: 900;
              letter-spacing: -1px;
              color: #0A0A0A;
            }
            .brand-sub {
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 2px;
              color: #555555;
              text-transform: uppercase;
              margin-top: 2px;
            }
            .store-info {
              font-size: 11px;
              color: #555555;
              margin-top: 8px;
              line-height: 1.4;
            }
            .invoice-badge {
              display: inline-block;
              background: #0A0A0A;
              color: #ffffff;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 1.5px;
              padding: 4px 10px;
              text-transform: uppercase;
            }
            .invoice-number {
              font-size: 20px;
              font-weight: 900;
              margin-top: 6px;
              color: #0A0A0A;
            }
            .invoice-date {
              font-size: 11px;
              color: #666666;
              margin-top: 3px;
            }
            .grid-2 {
              display: flex;
              gap: 16px;
              margin-bottom: 24px;
            }
            .info-card {
              flex: 1;
              background: #F9F9FB;
              border: 1px solid #E5E5E7;
              padding: 14px 16px;
            }
            .card-title {
              font-size: 10px;
              font-weight: 800;
              letter-spacing: 1px;
              text-transform: uppercase;
              color: #777777;
              margin-bottom: 6px;
            }
            .card-name {
              font-size: 14px;
              font-weight: 800;
              color: #0A0A0A;
            }
            .card-detail {
              font-size: 11px;
              color: #555555;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
              font-size: 12px;
            }
            th {
              background: #F1F1F3;
              border-top: 1px solid #0A0A0A;
              border-bottom: 2px solid #0A0A0A;
              padding: 8px;
              font-size: 10px;
              font-weight: 800;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              color: #444444;
            }
            .ledger-flex {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 24px;
            }
            .ledger-box {
              width: 320px;
            }
            .ledger-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 12px;
              color: #555555;
            }
            .ledger-row.total {
              border-top: 2px solid #0A0A0A;
              margin-top: 8px;
              padding-top: 8px;
              font-size: 18px;
              font-weight: 900;
              color: #0A0A0A;
            }
            .footer-notes {
              border-top: 1px solid #E5E5E7;
              padding-top: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 10.5px;
              color: #666666;
            }
            .signature-box {
              text-align: center;
              width: 200px;
              border-top: 1px solid #0A0A0A;
              padding-top: 6px;
              font-weight: 700;
              font-size: 11px;
              color: #0A0A0A;
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <!-- Header -->
            <div class="header-flex">
              <div>
                <div class="brand-name">${esc(data.storeSettings?.storeName || 'Vault 26')}</div>
                ${data.storeSettings?.tagline ? `<div class="brand-sub">${esc(data.storeSettings.tagline)}</div>` : ''}
                <div class="store-info">
                  ${data.storeSettings?.address ? `<div>${esc(data.storeSettings.address)}</div>` : ''}
                  ${data.storeSettings?.cityState ? `<div>${esc(data.storeSettings.cityState)}</div>` : ''}
                  ${data.storeSettings?.phone ? `<div>Phone: ${esc(data.storeSettings.phone)}</div>` : ''}
                  ${data.storeSettings?.email ? `<div>${esc(data.storeSettings.email)}</div>` : ''}
                  ${data.storeSettings?.gstin ? `<div><b>GSTIN: ${esc(data.storeSettings.gstin)}</b></div>` : ''}
                </div>
              </div>

              <div style="text-align: right;">
                <div class="invoice-badge">TAX INVOICE</div>
                <div class="invoice-number">${esc(data.orderNumber)}</div>
                <div class="invoice-date">Date: ${esc(data.createdAt)}</div>
              </div>
            </div>

            <!-- Customer & payment -->
            <div class="grid-2">
              <div class="info-card">
                <div class="card-title">BILLED TO</div>
                <div class="card-name">${esc(data.customerName)}</div>
                ${data.customerPhone ? `<div class="card-detail">Phone: ${esc(data.customerPhone)}</div>` : ''}
                ${data.customerEmail ? `<div class="card-detail">Email: ${esc(data.customerEmail)}</div>` : ''}
                ${data.customerGstin ? `<div class="card-detail"><b>GSTIN: ${esc(data.customerGstin)}</b></div>` : ''}
                ${data.storeSettings?.state ? `<div class="card-detail">Place of supply: ${esc(data.storeSettings.state)}</div>` : ''}
              </div>

              <div class="info-card">
                <div class="card-title">PAYMENT</div>
                <div class="card-name" style="color: #0A0A0A;">${methodWord(
                  data.paymentSplits && data.paymentSplits.length > 1 ? 'SPLIT' : data.paymentMethod
                )}</div>
                <div class="card-detail">Status: Paid in full</div>
                <div class="card-detail">${
                  data.paymentSplits && data.paymentSplits.length > 0
                    ? data.paymentSplits.map((s) => `${methodWord(s.method)}: ${formatINR(s.amount)}`).join(', ')
                    : `${methodWord(data.paymentMethod)}: ${formatINR(data.grandTotal)}`
                }</div>
                ${
                  data.changeAmount && data.changeAmount > 0
                    ? `<div class="card-detail" style="font-weight: 700; color: #0A0A0A;">Change given: ${formatINR(data.changeAmount)}</div>`
                    : ''
                }
              </div>
            </div>

            <!-- Garment Items Table -->
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">ITEM</th>
                  <th style="text-align: left;">COLOUR / SIZE</th>
                  <th style="text-align: center;">QTY</th>
                  <th style="text-align: right;">RATE</th>
                  <th style="text-align: right;">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <!-- Ledger Summary -->
            <div class="ledger-flex">
              <div class="ledger-box">
                <div class="ledger-row">
                  <span>Subtotal:</span>
                  <span style="font-weight: 600; color: #0A0A0A;">${formatINR(data.subtotal)}</span>
                </div>
                ${
                  data.discount > 0
                    ? `
                <div class="ledger-row" style="color: #059669;">
                  <span>Discount${data.discountReason ? ` (${esc(data.discountReason)})` : ''}:</span>
                  <span style="font-weight: 700;">-${formatINR(data.discount)}</span>
                </div>
                `
                    : ''
                }
                <div class="ledger-row">
                  <span>Taxable value:</span>
                  <span>${formatINR(data.subtotal - data.discount)}</span>
                </div>
                <div class="ledger-row">
                  <span>CGST (${formatRate((data.storeSettings?.taxRate ?? 0) / 2)}%):</span>
                  <span>${formatINR(splitCgstSgst(data.taxAmount).cgst)}</span>
                </div>
                <div class="ledger-row">
                  <span>SGST (${formatRate((data.storeSettings?.taxRate ?? 0) / 2)}%):</span>
                  <span>${formatINR(splitCgstSgst(data.taxAmount).sgst)}</span>
                </div>
                ${data.storeSettings?.taxIsCustom ? `<div class="ledger-row" style="font-size: 10px;">Custom tax rate set by the owner</div>` : ''}
                <div class="ledger-row total">
                  <span>TOTAL:</span>
                  <span>${formatINR(data.grandTotal)}</span>
                </div>
              </div>
            </div>

            <!-- Footer Notes & Signature -->
            <div class="footer-notes">
              <div style="max-width: 440px;">
                ${
                  data.storeSettings?.terms
                    ? `<div style="font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">TERMS &amp; CONDITIONS:</div>
                <div style="white-space: pre-line;">${esc(data.storeSettings.terms)}</div>`
                    : ''
                }
                ${data.storeSettings?.footer ? `<div style="margin-top: 4px; white-space: pre-line;">${esc(data.storeSettings.footer)}</div>` : ''}
                <div style="margin-top: 4px;">This is a computer-generated tax invoice.</div>
                <div style="margin-top: 8px; display: flex; align-items: center; gap: 16px;">
                  ${getVectorBarcodeSvg(data.orderNumber)}
                  ${getBillQrHtml(data, 110)}
                </div>
              </div>

              <div style="text-align: right;">
                <div style="height: 48px;"></div>
                <div class="signature-box">
                  FOR ${esc((data.storeSettings?.storeName || 'Vault 26').toUpperCase())}<br>
                  <span style="font-size: 9px; font-weight: 400; color: #666666;">Authorized Signatory</span>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Trigger print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve(true);
      } catch (err) {
        console.error('Iframe print error:', err);
        window.print();
        resolve(true);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 250);
  });
}
