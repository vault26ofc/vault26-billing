import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  MonthlyData,
  MonthlyInvoice,
  isInterState,
  splitTax,
  totalsFor,
  ChannelTotals,
} from '../api/monthlyReport';
import { formatRate } from './tax';

export interface InvoiceIdentity {
  brand: string;
  tagline: string;
  address: string;
  gstin: string;
  phone: string;
  email: string;
  terms: string;
  footer: string;
  signatory: string;
}

// Vault 26 palette (see tailwind config): ink, muted, light grey panels.
const INK: [number, number, number] = [15, 15, 15];
const MUTED: [number, number, number] = [77, 77, 77];
const PAPER: [number, number, number] = [241, 241, 241];
const RULE: [number, number, number] = [217, 217, 217];

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

// jsPDF's built-in fonts have no rupee glyph, so amounts print as "Rs.".
function money(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rs(n: number): string {
  return `Rs. ${money(n)}`;
}

function istDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

const tableTheme = {
  theme: 'grid' as const,
  styles: {
    font: 'helvetica',
    fontSize: 7.5,
    cellPadding: 1.6,
    textColor: INK,
    lineColor: RULE,
    lineWidth: 0.2,
  },
  headStyles: { fillColor: INK, textColor: PAPER, fontStyle: 'bold' as const, fontSize: 7 },
  footStyles: { fillColor: PAPER, textColor: INK, fontStyle: 'bold' as const },
  margin: { left: MARGIN, right: MARGIN },
};

function drawBusinessHeader(doc: jsPDF, id: InvoiceIdentity, y: number): number {
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(id.brand, MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  if (id.tagline) {
    doc.text(id.tagline, MARGIN, y);
    y += 4;
  }
  const addressLines = doc.splitTextToSize(id.address, 110) as string[];
  doc.text(addressLines, MARGIN, y);
  y += addressLines.length * 3.4;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${id.gstin}`, MARGIN, y);
  y += 3.6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text([id.phone, id.email].filter(Boolean).join('  |  '), MARGIN, y);
  return y + 3;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(text, MARGIN, y);
  return y + 2;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 297 - 18) {
    doc.addPage();
    return 18;
  }
  return y;
}

function totalsRow(label: string, t: ChannelTotals): string[] {
  return [
    label,
    String(t.count),
    money(t.subtotal),
    money(t.discount),
    money(t.taxable),
    money(t.cgst),
    money(t.sgst),
    money(t.igst),
    money(t.shipping + t.other),
    money(t.total),
  ];
}

function drawSummary(doc: jsPDF, data: MonthlyData, id: InvoiceIdentity, monthLabel: string) {
  let y = drawBusinessHeader(doc, id, 18);

  // Title bar
  y += 3;
  doc.setFillColor(...INK);
  doc.rect(MARGIN, y, CONTENT_W, 10, 'F');
  doc.setTextColor(...PAPER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`MONTHLY SALES REPORT - ${monthLabel.toUpperCase()}`, MARGIN + 3, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generated ${istDateTime(new Date().toISOString())} IST`, PAGE_W - MARGIN - 3, y + 6.5, { align: 'right' });
  y += 15;

  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text(
    'Amounts in INR (Rs.). Offline = shop bills, V26S series (cancelled bills excluded). Online = website orders DELIVERED in this month, V26W series; tax as printed on the website invoice.',
    MARGIN,
    y,
    { maxWidth: CONTENT_W }
  );
  y += 7;

  const offline = totalsFor(data.offline);
  const online = totalsFor(data.online);
  const all = totalsFor([...data.offline, ...data.online]);

  y = sectionTitle(doc, '1. CHANNEL SUMMARY', y);
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Channel', 'Invoices', 'Subtotal', 'Discount', 'Taxable', 'CGST', 'SGST', 'IGST', 'Ship/Other', 'Total']],
    body: [totalsRow('Offline (POS)', offline), totalsRow('Online (Website)', online)],
    foot: [totalsRow('TOTAL', all)],
    columnStyles: { 0: { cellWidth: 26 } },
    didParseCell: (d) => {
      if (d.column.index > 0) d.cell.styles.halign = 'right';
    },
  });
  y = lastY(doc) + 8;

  // GST by rate - what the GSTR-1 rate-wise summary needs.
  const byRate = new Map<string, { channel: string; label: string; count: number; taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const inv of [...data.offline, ...data.online]) {
    const supply = isInterState(inv) ? 'Inter-state' : 'Intra-state';
    const label = `${formatRate(inv.taxRate)}%${inv.taxIsCustom ? ' (custom)' : ''}`;
    const key = `${inv.channel}|${label}|${supply}`;
    const e = byRate.get(key) || { channel: `${inv.channel === 'OFFLINE' ? 'Offline' : 'Online'} · ${supply}`, label, count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const t = splitTax(inv);
    e.count += 1;
    e.taxable += inv.taxable;
    e.cgst += t.cgst;
    e.sgst += t.sgst;
    e.igst += t.igst;
    byRate.set(key, e);
  }

  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, '2. GST BY RATE', y);
  const rateRows = Array.from(byRate.values());
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Channel / Supply', 'GST Rate', 'Invoices', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax']],
    body:
      rateRows.length > 0
        ? rateRows.map((r) => [
            r.channel,
            r.label,
            String(r.count),
            money(r.taxable),
            money(r.cgst),
            money(r.sgst),
            money(r.igst),
            money(r.cgst + r.sgst + r.igst),
          ])
        : [['No invoices this month', '', '', '', '', '', '', '']],
    didParseCell: (d) => {
      if (d.column.index > 1) d.cell.styles.halign = 'right';
    },
  });
  y = lastY(doc) + 8;

  // Payments actually recorded against offline bills.
  const byMethod = new Map<string, { count: number; amount: number }>();
  data.offline.forEach((inv) =>
    inv.payments.forEach((p) => {
      const e = byMethod.get(p.method) || { count: 0, amount: 0 };
      e.count += 1;
      e.amount += p.amount;
      byMethod.set(p.method, e);
    })
  );
  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, '3. OFFLINE PAYMENTS RECORDED', y);
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Method', 'Transactions', 'Amount']],
    body:
      byMethod.size > 0
        ? Array.from(byMethod.entries()).map(([m, e]) => [m, String(e.count), money(e.amount)])
        : [['No offline payments', '', '']],
    tableWidth: 110,
    didParseCell: (d) => {
      if (d.column.index > 0) d.cell.styles.halign = 'right';
    },
  });
  y = lastY(doc) + 8;

  // Bills whose recorded payments do not add up to the billed total.
  const mismatched = data.offline.filter((inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    return Math.abs(paid - inv.grandTotal) > 0.009;
  });
  if (mismatched.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, '4. NEEDS REVIEW - PAYMENTS RECORDED DO NOT MATCH BILL TOTAL', y);
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Bill No.', 'Date', 'Bill Total', 'Payments Recorded', 'Difference']],
      body: mismatched.map((inv) => {
        const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
        return [inv.invoiceNumber, istDate(inv.createdAt), money(inv.grandTotal), money(paid), money(paid - inv.grandTotal)];
      }),
      didParseCell: (d) => {
        if (d.column.index > 1) d.cell.styles.halign = 'right';
      },
    });
    y = lastY(doc) + 8;
  }

  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, `${mismatched.length > 0 ? '5' : '4'}. VOIDED BILLS (NOT INCLUDED IN TOTALS)`, y);
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Bill No.', 'Date', 'Customer', 'Amount', 'Notes']],
    body:
      data.voided.length > 0
        ? data.voided.map((inv) => [inv.invoiceNumber, istDate(inv.createdAt), inv.customerName, money(inv.grandTotal), inv.notes])
        : [['None', '', '', '', '']],
    columnStyles: { 3: { halign: 'right' }, 4: { cellWidth: 70 } },
  });
  y = lastY(doc) + 8;

  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, `${mismatched.length > 0 ? '6' : '5'}. INVOICE REGISTER`, y);
  const register = [...data.offline, ...data.online];
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['#', 'Invoice No.', 'Date', 'Channel', 'Customer', 'GST', 'Taxable', 'Tax', 'Total']],
    body:
      register.length > 0
        ? register.map((inv, i) => [
            String(i + 1),
            inv.invoiceNumber,
            istDate(inv.createdAt),
            inv.channel === 'OFFLINE' ? 'Offline (shop)' : 'Online (website)',
            inv.customerName,
            `${formatRate(inv.taxRate)}%${inv.taxIsCustom ? '*' : ''}`,
            money(inv.taxable),
            money(inv.taxAmount),
            money(inv.grandTotal),
          ])
        : [['', 'No invoices this month', '', '', '', '', '', '', '']],
    foot: register.length > 0 ? [['', 'TOTAL', '', '', '', '', money(all.taxable), money(all.tax), money(all.total)]] : undefined,
    didParseCell: (d) => {
      if (d.column.index > 4) d.cell.styles.halign = 'right';
    },
  });
  if (register.some((inv) => inv.taxIsCustom)) {
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text('* Custom tax rate applied by the owner on that bill.', MARGIN, lastY(doc) + 4);
  }
}

function drawInvoice(doc: jsPDF, inv: MonthlyInvoice, id: InvoiceIdentity) {
  const headerBottom = drawBusinessHeader(doc, id, 18);

  // Invoice badge + number, right side
  const rightX = PAGE_W - MARGIN;
  doc.setFillColor(...INK);
  doc.rect(rightX - 40, 12, 40, 8, 'F');
  doc.setTextColor(...PAPER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TAX INVOICE', rightX - 20, 17.3, { align: 'center' });
  doc.setTextColor(...INK);
  doc.setFontSize(12);
  doc.text(inv.invoiceNumber, rightX, 27, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Date: ${istDateTime(inv.createdAt)}`, rightX, 31.5, { align: 'right' });
  const channelLabel =
    inv.channel === 'OFFLINE'
      ? 'Channel: OFFLINE (shop)'
      : `Channel: ONLINE (website order ${inv.orderNumber || ''})`.replace(' )', ')');
  doc.text(channelLabel, rightX, 35.5, {
    align: 'right',
  });
  if (inv.status === 'RETURNED') doc.text('Status: RETURNED', rightX, 39.5, { align: 'right' });

  let y = Math.max(headerBottom, 42) + 3;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  // Billed to / supply & payment
  const colW = CONTENT_W / 2 - 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('BILLED TO', MARGIN, y);
  doc.text('SUPPLY & PAYMENT', MARGIN + colW + 6, y);
  y += 4;
  doc.setTextColor(...INK);
  doc.setFontSize(9);
  doc.text(inv.customerName, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const billedTo = [inv.customerPhone, inv.customerEmail, inv.customerAddress].filter(Boolean);
  const billedLines = doc.splitTextToSize(billedTo.join('\n'), colW) as string[];
  doc.setTextColor(...MUTED);
  doc.text(billedLines, MARGIN, y + 4);

  const supplyLines = [
    `Place of supply: ${inv.placeOfSupply}${isInterState(inv) ? ' (inter-state, IGST)' : ' (intra-state, CGST + SGST)'}`,
    `Payment: ${inv.payments.length > 0 ? inv.payments.map((p) => `${p.method} ${rs(p.amount)}`).join(', ') : '-'}`,
  ];
  const supplyWrapped = doc.splitTextToSize(supplyLines.join('\n'), colW) as string[];
  doc.setTextColor(...INK);
  doc.text(supplyWrapped, MARGIN + colW + 6, y);
  y += Math.max(billedLines.length * 3.4 + 4, supplyWrapped.length * 3.4) + 5;

  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['#', 'Description', 'Size / Color', 'Qty', 'Rate', 'Disc.', 'Amount']],
    body: inv.lines.map((l, i) => [
      String(i + 1),
      l.name,
      l.variant || '-',
      String(l.qty),
      money(l.unitPrice),
      l.discount > 0 ? money(l.discount) : '-',
      money(l.amount),
    ]),
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 62 } },
    didParseCell: (d) => {
      if (d.column.index >= 3) d.cell.styles.halign = 'right';
    },
  });
  y = lastY(doc) + 4;

  // Totals block, right aligned
  const t = splitTax(inv);
  const half = formatRate(inv.taxRate / 2);
  const rows: [string, string, boolean?][] = [['Subtotal', rs(inv.subtotal)]];
  if (inv.discount > 0) rows.push(['Discount', `- ${rs(inv.discount)}`]);
  rows.push(['Taxable value', rs(inv.taxable)]);
  if (isInterState(inv)) {
    rows.push([`IGST ${formatRate(inv.taxRate)}%`, rs(t.igst)]);
  } else {
    rows.push([`CGST ${half}%`, rs(t.cgst)]);
    rows.push([`SGST ${half}%`, rs(t.sgst)]);
  }
  if (inv.shipping > 0) rows.push(['Shipping', rs(inv.shipping)]);
  if (Math.abs(inv.otherCharges) > 0.009) rows.push(['Other charges', rs(inv.otherCharges)]);
  rows.push(['GRAND TOTAL', rs(inv.grandTotal), true]);

  y = ensureSpace(doc, y, rows.length * 5 + 40);
  const labelX = PAGE_W - MARGIN - 75;
  rows.forEach(([label, value, bold]) => {
    if (bold) {
      doc.setDrawColor(...INK);
      doc.line(labelX, y - 1, PAGE_W - MARGIN, y - 1);
      y += 1.5;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 8);
    doc.setTextColor(...(bold ? INK : MUTED));
    doc.text(label, labelX, y + 2.5);
    doc.setTextColor(...INK);
    doc.text(value, PAGE_W - MARGIN, y + 2.5, { align: 'right' });
    y += bold ? 6 : 4.6;
  });
  if (inv.taxIsCustom) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text('Custom tax rate applied by owner.', PAGE_W - MARGIN, y + 1, { align: 'right' });
    y += 4;
  }

  // Terms + signatory
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  if (id.terms) {
    doc.text('TERMS & CONDITIONS', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    const termLines = doc.splitTextToSize(id.terms, 110) as string[];
    doc.text(termLines, MARGIN, y + 3.5);
  }
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(`For ${id.brand}`, PAGE_W - MARGIN, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`${id.signatory || id.brand} - Authorised Signatory`, PAGE_W - MARGIN, y + 14, { align: 'right' });

  doc.setFontSize(6.5);
  doc.text('This is a computer-generated tax invoice.', MARGIN, 297 - 14);
  if (id.footer) doc.text(id.footer, PAGE_W - MARGIN, 297 - 14, { align: 'right' });
}

function drawSectionCover(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...INK);
  doc.rect(MARGIN, 120, CONTENT_W, 22, 'F');
  doc.setTextColor(...PAPER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, PAGE_W / 2, 131, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(subtitle, PAGE_W / 2, 137.5, { align: 'center' });
}

export function buildMonthlyReportPdf(data: MonthlyData, id: InvoiceIdentity, monthLabel: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  drawSummary(doc, data, id, monthLabel);

  doc.addPage();
  drawSectionCover(
    doc,
    'OFFLINE INVOICES',
    `${data.offline.length} shop bill${data.offline.length === 1 ? '' : 's'} · ${monthLabel}`
  );
  data.offline.forEach((inv) => {
    doc.addPage();
    drawInvoice(doc, inv, id);
  });

  doc.addPage();
  drawSectionCover(
    doc,
    'ONLINE INVOICES',
    `${data.online.length} delivered website order${data.online.length === 1 ? '' : 's'} · ${monthLabel}`
  );
  data.online.forEach((inv) => {
    doc.addPage();
    drawInvoice(doc, inv, id);
  });

  // Page footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(`${id.brand} · GSTIN ${id.gstin} · ${monthLabel}`, MARGIN, 297 - 8);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, 297 - 8, { align: 'right' });
  }

  return doc;
}
