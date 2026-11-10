import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { formatINR, istToday, toIstDateTime } from '../../utils/formatters';
import { Store, Globe, Printer, Search } from 'lucide-react';
import { useT } from '../../i18n';
import { paymentWord } from '../../utils/paymentWords';
import { splitCgstSgst, formatRate } from '../../utils/tax';
import { Order } from '../../types';

type Range = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
type Channel = 'ALL' | 'OFFLINE' | 'ONLINE';

// Money in one payment method on a shop bill (from its real payment rows).
function paidBy(o: Order, method: string): number {
  if (o.paymentSplits && o.paymentSplits.length > 0) {
    return o.paymentSplits.filter((s) => s.method === method).reduce((s, p) => s + p.amount, 0);
  }
  return o.paymentMethod === method ? o.grandTotal : 0;
}

export const SalesAuditPage: React.FC = () => {
  const navigate = useNavigate();
  const { orders: posBills, onlineOrders: webOrders, returns, settings } = useStore();
  const t = useT();

  const orders = useMemo(
    () => [...posBills, ...webOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [posBills, webOrders]
  );

  const [channelFilter, setChannelFilter] = useState<Channel>('ALL');
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState<Range>('ALL');

  const todayStr = istToday();

  const timeFilteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (timeRange === 'TODAY') return o.createdAt.startsWith(todayStr);
      if (timeRange === 'WEEK') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return o.createdAt >= toIstDateTime(weekAgo);
      }
      if (timeRange === 'MONTH') return o.createdAt.startsWith(todayStr.substring(0, 7));
      return true;
    });
  }, [orders, timeRange, todayStr]);

  const shopBills = useMemo(() => timeFilteredOrders.filter((o) => o.channel === 'OFFLINE'), [timeFilteredOrders]);
  // Cancelled bills are listed but never counted as sales.
  const shopCounted = useMemo(() => shopBills.filter((o) => o.billStatus !== 'VOID'), [shopBills]);
  const webOrdersInRange = useMemo(() => timeFilteredOrders.filter((o) => o.channel === 'ONLINE'), [timeFilteredOrders]);

  const sum = (list: Order[], f: (o: Order) => number) => list.reduce((s, o) => s + f(o), 0);

  const shopGross = sum(shopCounted, (o) => o.subtotal);
  const shopDiscounts = sum(shopCounted, (o) => o.discount || 0);
  const shopTax = sum(shopCounted, (o) => o.taxAmount);
  const shopTotal = sum(shopCounted, (o) => o.grandTotal);
  const shopAverage = shopCounted.length ? Math.round(shopTotal / shopCounted.length) : 0;
  const shopIds = useMemo(() => new Set(shopCounted.map((o) => o.id)), [shopCounted]);
  const openReturns = returns.filter((r) => shopIds.has(r.orderId) && r.status !== 'REFUNDED' && r.status !== 'REJECTED').length;

  // Cash: what customers handed over, the change given back, and what stays in the drawer.
  const cashInDrawer = sum(shopCounted, (o) => paidBy(o, 'CASH'));
  const changeGiven = sum(shopCounted, (o) =>
    (o.paymentSplits || []).filter((s) => s.method === 'CASH').reduce((s, p) => s + (p.change || 0), 0)
  );
  const cashReceived = cashInDrawer + changeGiven;
  const cardTotal = sum(shopCounted, (o) => paidBy(o, 'CARD'));
  const upiTotal = sum(shopCounted, (o) => paidBy(o, 'UPI'));
  const otherTotal = sum(shopCounted, (o) => paidBy(o, 'OTHER'));

  const staffBreakdown = useMemo(() => {
    const byStaff = new Map<string, { staffId: string; staffName: string; billCount: number; totalDiscount: number; netRevenue: number }>();
    shopCounted.forEach((o) => {
      const key = o.staffId || 'unknown';
      const entry = byStaff.get(key) || { staffId: key, staffName: o.staffName || '', billCount: 0, totalDiscount: 0, netRevenue: 0 };
      entry.billCount += 1;
      entry.totalDiscount += o.discount || 0;
      entry.netRevenue += o.grandTotal;
      byStaff.set(key, entry);
    });
    return Array.from(byStaff.values()).sort((a, b) => b.totalDiscount - a.totalDiscount);
  }, [shopCounted]);

  const webGross = sum(webOrdersInRange, (o) => o.subtotal);
  const webDiscounts = sum(webOrdersInRange, (o) => o.discount || 0);
  const webTax = sum(webOrdersInRange, (o) => o.taxAmount);
  const webDelivery = sum(webOrdersInRange, (o) => o.shippingFee || 0);
  const webTotal = sum(webOrdersInRange, (o) => o.grandTotal);
  const webAverage = webOrdersInRange.length ? Math.round(webTotal / webOrdersInRange.length) : 0;
  const webPaidOnline = sum(webOrdersInRange.filter((o) => o.paymentMethod === 'RAZORPAY'), (o) => o.grandTotal);
  const webCod = sum(webOrdersInRange.filter((o) => o.paymentMethod === 'COD'), (o) => o.grandTotal);

  const totalSales = shopTotal + webTotal;
  const totalTax = shopTax + webTax;
  const counted = [...shopCounted, ...webOrdersInRange];

  const listed = useMemo(() => {
    const base = channelFilter === 'OFFLINE' ? shopBills : channelFilter === 'ONLINE' ? webOrdersInRange : timeFilteredOrders;
    const q = search.trim().toLowerCase();
    return base.filter(
      (o) =>
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        (o.discountReason && o.discountReason.toLowerCase().includes(q))
    );
  }, [channelFilter, shopBills, webOrdersInRange, timeFilteredOrders, search]);

  const rangeLabel: Record<Range, string> = {
    ALL: t('All time'),
    TODAY: t('Today'),
    WEEK: t('Last 7 days'),
    MONTH: t('This month'),
  };
  const printRange: Record<Range, string> = { ALL: 'All time', TODAY: 'Today', WEEK: 'Last 7 days', MONTH: 'This month' };

  const pill = (active: boolean) =>
    `h-10 px-4 text-base font-bold whitespace-nowrap transition-colors ${
      active ? 'bg-v26-ink text-white' : 'bg-v26-paper text-v26-ink border border-v26-line hover:border-v26-ink'
    }`;

  const line = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-3 py-2 ${strong ? 'font-black text-lg' : 'text-base'}`}>
      <span className={strong ? '' : 'text-v26-muted'}>{label}</span>
      <span className="font-bold whitespace-nowrap">{value}</span>
    </div>
  );

  const shopPct = totalSales > 0 ? Math.round((shopTotal / totalSales) * 100) : 0;
  const walkIn = (name: string) => (name === 'Walk-in Customer' ? t('Walk-in customer') : name);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{t('Check sales')}</h1>
          <p className="text-base text-v26-muted mt-1">{t('Shop and website sales side by side, and the money count for the shop.')}</p>
        </div>
        <Button variant="primary" icon={<Printer size={18} />} onClick={() => window.print()}>
          {t('Print sales report')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map((r) => (
          <button key={r} onClick={() => setTimeRange(r)} className={pill(timeRange === r)}>
            {rangeLabel[r]}
          </button>
        ))}
      </div>

      <div className="card p-5 space-y-3 no-print">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="label">{t('Total sales')}</div>
            <div className="text-3xl font-black">{formatINR(totalSales)}</div>
          </div>
          <div className="text-base text-v26-muted">
            {t('GST')}: <b className="text-v26-ink">{formatINR(totalTax)}</b>
          </div>
        </div>
        <div className="w-full h-4 bg-v26-soft flex overflow-hidden" aria-hidden="true">
          <div style={{ width: `${shopPct}%` }} className="bg-v26-ink" />
          <div style={{ width: `${totalSales > 0 ? 100 - shopPct : 0}%` }} className="bg-status-blue" />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-base">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-v26-ink inline-block" /> {t('Shop')}: <b>{formatINR(shopTotal)}</b> ({shopPct}%)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-status-blue inline-block" /> {t('Website')}: <b>{formatINR(webTotal)}</b> (
            {totalSales > 0 ? 100 - shopPct : 0}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 no-print">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-v26-line">
            <h2 className="font-display text-2xl flex items-center gap-2">
              <Store size={22} /> {t('Shop')}
            </h2>
            <span className="text-base font-bold">{t('{n} bills', { n: shopCounted.length })}</span>
          </div>
          <div className="divide-y divide-v26-line">
            {line(t('Before discount'), formatINR(shopGross))}
            {line(t('Discounts given'), `−${formatINR(shopDiscounts)}`)}
            {line(t('GST collected'), formatINR(shopTax))}
            {line(t('Shop total'), formatINR(shopTotal), true)}
          </div>
          <div className="mt-4 bg-v26-soft p-4">
            <div className="section-title mb-1">{t('Money count')}</div>
            <div className="divide-y divide-v26-line">
              {line(t('Cash received from customers'), formatINR(cashReceived))}
              {line(t('Change given back'), `−${formatINR(changeGiven)}`)}
              {line(t('Cash that should be in the drawer'), formatINR(cashInDrawer), true)}
              {line(t('Card'), formatINR(cardTotal))}
              {line(t('UPI'), formatINR(upiTotal))}
              {otherTotal > 0 && line(t('Other'), formatINR(otherTotal))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-base text-v26-muted">
            <span>
              {t('Average bill')}: <b className="text-v26-ink">{formatINR(shopAverage)}</b>
            </span>
            <span>
              {t('Open returns')}: <b className="text-v26-ink">{openReturns}</b>
            </span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-v26-line">
            <h2 className="font-display text-2xl flex items-center gap-2 text-status-blue">
              <Globe size={22} /> {t('Website')}
            </h2>
            <span className="text-base font-bold">{t('{n} delivered orders', { n: webOrdersInRange.length })}</span>
          </div>
          <div className="divide-y divide-v26-line">
            {line(t('Before discount'), formatINR(webGross))}
            {line(t('Coupon discounts'), `−${formatINR(webDiscounts)}`)}
            {line(t('Delivery charges'), formatINR(webDelivery))}
            {line(t('GST (as on the website invoice)'), formatINR(webTax))}
            {line(t('Website total'), formatINR(webTotal), true)}
          </div>
          <div className="mt-4 bg-v26-soft p-4">
            <div className="section-title mb-1">{t('How customers paid')}</div>
            <div className="divide-y divide-v26-line">
              {line(t('Paid online'), formatINR(webPaidOnline))}
              {line(t('Cash on delivery'), formatINR(webCod))}
            </div>
          </div>
          <div className="mt-3 text-base text-v26-muted">
            {t('Average order')}: <b className="text-v26-ink">{formatINR(webAverage)}</b>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden no-print">
        <div className="px-5 py-4 border-b border-v26-line">
          <h2 className="font-display text-2xl">{t('Staff')}</h2>
          <p className="text-base text-v26-muted">{t('Who made shop bills, and how much discount each person gave.')}</p>
        </div>
        {staffBreakdown.length === 0 ? (
          <div className="p-8 text-center text-base text-v26-muted">{t('No shop bills in this time.')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr>
                  <th className="table-head py-3 px-5">{t('Name')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('Bills')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('Discount given')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('Discount per bill')}</th>
                  <th className="table-head py-3 px-5 text-right">{t('Sales')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {staffBreakdown.map((s) => (
                  <tr key={s.staffId}>
                    <td className="py-3 px-5 font-bold">{s.staffName || t('Unknown')}</td>
                    <td className="py-3 px-4 text-right">{s.billCount}</td>
                    <td className="py-3 px-4 text-right font-bold text-status-green">{formatINR(s.totalDiscount)}</td>
                    <td className="py-3 px-4 text-right text-v26-muted">{formatINR(Math.round(s.totalDiscount / s.billCount))}</td>
                    <td className="py-3 px-5 text-right font-bold">{formatINR(s.netRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden no-print">
        <div className="p-4 border-b border-v26-line space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setChannelFilter('ALL')} className={pill(channelFilter === 'ALL')}>
              {t('All')} ({timeFilteredOrders.length})
            </button>
            <button onClick={() => setChannelFilter('OFFLINE')} className={pill(channelFilter === 'OFFLINE')}>
              {t('Shop')} ({shopBills.length})
            </button>
            <button onClick={() => setChannelFilter('ONLINE')} className={pill(channelFilter === 'ONLINE')}>
              {t('Website')} ({webOrdersInRange.length})
            </button>
          </div>
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-v26-muted" />
            <input
              type="search"
              placeholder={t('Search bill no., name or discount reason')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field h-12 pl-11"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr>
                <th className="table-head py-3 px-4">{t('Bill no.')}</th>
                <th className="table-head py-3 px-4">{t('Sold in')}</th>
                <th className="table-head py-3 px-4">{t('Date')}</th>
                <th className="table-head py-3 px-4">{t('Customer')}</th>
                <th className="table-head py-3 px-4">{t('Billed by')}</th>
                <th className="table-head py-3 px-4 text-right">{t('Discount')}</th>
                <th className="table-head py-3 px-4 text-right">{t('GST')}</th>
                <th className="table-head py-3 px-4 text-right">{t('Total')}</th>
                <th className="table-head py-3 px-4">{t('Paid by')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-v26-line">
              {listed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-v26-muted">
                    {t('No bills found.')}
                  </td>
                </tr>
              ) : (
                listed.map((o) => {
                  const isShop = o.channel === 'OFFLINE';
                  return (
                    <tr
                      key={o.id}
                      onClick={() => isShop && navigate(`/bills/${o.id}`)}
                      className={`hover:bg-v26-soft ${isShop ? 'cursor-pointer' : ''} ${o.billStatus === 'VOID' ? 'opacity-60' : ''}`}
                    >
                      <td className="py-3 px-4 font-bold whitespace-nowrap">
                        {o.orderNumber}
                        {o.billStatus === 'VOID' && <div className="text-sm text-status-red">{t('Cancelled')}</div>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{isShop ? t('Shop') : t('Website')}</td>
                      <td className="py-3 px-4 text-v26-muted whitespace-nowrap">{o.createdAt.substring(0, 16)}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold">{walkIn(o.customerName)}</div>
                        {o.customerPhone && <div className="text-sm text-v26-muted">{o.customerPhone}</div>}
                      </td>
                      <td className="py-3 px-4">{o.staffName || '—'}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {o.discount > 0 ? (
                          <>
                            <span className="font-bold text-status-green">−{formatINR(o.discount)}</span>
                            {o.discountReason && <div className="text-sm text-v26-muted max-w-[160px] truncate ml-auto">{o.discountReason}</div>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-v26-muted whitespace-nowrap">{formatINR(o.taxAmount)}</td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">{formatINR(o.grandTotal)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{t(paymentWord(o))}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printed sales report (English, for the records). */}
      <div className="hidden print:block text-xs text-black p-6 max-w-4xl mx-auto space-y-5">
        <div className="border-b-2 border-black pb-3 flex justify-between items-start">
          <div>
            <div className="font-black text-2xl">{settings.brand || settings.storeName}</div>
            <div className="text-[11px] font-bold">SALES REPORT</div>
            {settings.gstin && <div className="text-xs mt-1">GSTIN: {settings.gstin}</div>}
            {settings.address && <div className="text-xs">{[settings.address, settings.cityState].filter(Boolean).join(', ')}</div>}
          </div>
          <div className="text-right text-xs">
            <div>Printed: {toIstDateTime(new Date()).substring(0, 16)}</div>
            <div className="font-bold">Period: {printRange[timeRange]}</div>
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-neutral-100 border-b border-black">
              <th className="p-2 border-r border-black text-left">Sold in</th>
              <th className="p-2 border-r border-black text-center">Bills</th>
              <th className="p-2 border-r border-black text-right">Before discount</th>
              <th className="p-2 border-r border-black text-right">Discounts</th>
              <th className="p-2 border-r border-black text-right">GST</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            <tr>
              <td className="p-2 border-r border-black font-bold">Shop</td>
              <td className="p-2 border-r border-black text-center">{shopCounted.length}</td>
              <td className="p-2 border-r border-black text-right">{formatINR(shopGross)}</td>
              <td className="p-2 border-r border-black text-right">-{formatINR(shopDiscounts)}</td>
              <td className="p-2 border-r border-black text-right">{formatINR(shopTax)}</td>
              <td className="p-2 text-right font-bold">{formatINR(shopTotal)}</td>
            </tr>
            <tr>
              <td className="p-2 border-r border-black font-bold">Website (delivered)</td>
              <td className="p-2 border-r border-black text-center">{webOrdersInRange.length}</td>
              <td className="p-2 border-r border-black text-right">{formatINR(webGross)}</td>
              <td className="p-2 border-r border-black text-right">-{formatINR(webDiscounts)}</td>
              <td className="p-2 border-r border-black text-right">{formatINR(webTax)}</td>
              <td className="p-2 text-right font-bold">{formatINR(webTotal)}</td>
            </tr>
            <tr className="bg-neutral-200 font-bold">
              <td className="p-2 border-r border-black">Total</td>
              <td className="p-2 border-r border-black text-center">{counted.length}</td>
              <td className="p-2 border-r border-black text-right">{formatINR(shopGross + webGross)}</td>
              <td className="p-2 border-r border-black text-right">-{formatINR(shopDiscounts + webDiscounts)}</td>
              <td className="p-2 border-r border-black text-right">{formatINR(totalTax)}</td>
              <td className="p-2 text-right">{formatINR(totalSales)}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-neutral-100 border-b border-black">
              <th className="p-1.5 border-r border-black">#</th>
              <th className="p-1.5 border-r border-black text-left">Bill no.</th>
              <th className="p-1.5 border-r border-black text-left">Date</th>
              <th className="p-1.5 border-r border-black text-left">Sold in</th>
              <th className="p-1.5 border-r border-black text-left">Customer</th>
              <th className="p-1.5 border-r border-black text-right">GST %</th>
              <th className="p-1.5 border-r border-black text-right">Taxable</th>
              <th className="p-1.5 border-r border-black text-right">CGST</th>
              <th className="p-1.5 border-r border-black text-right">SGST</th>
              <th className="p-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {counted.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-2 text-center">
                  No bills in this period.
                </td>
              </tr>
            ) : (
              [...counted]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((o, idx) => {
                  const { cgst, sgst } = splitCgstSgst(o.taxAmount);
                  return (
                    <tr key={o.id} style={{ breakInside: 'avoid' }}>
                      <td className="p-1.5 border-r border-black">{idx + 1}</td>
                      <td className="p-1.5 border-r border-black font-bold">{o.orderNumber}</td>
                      <td className="p-1.5 border-r border-black">{o.createdAt.substring(0, 16)}</td>
                      <td className="p-1.5 border-r border-black">{o.channel === 'OFFLINE' ? 'Shop' : 'Website'}</td>
                      <td className="p-1.5 border-r border-black">{o.customerName}</td>
                      <td className="p-1.5 border-r border-black text-right">
                        {formatRate(o.taxRate ?? 0)}%{o.taxIsCustom ? '*' : ''}
                      </td>
                      <td className="p-1.5 border-r border-black text-right">{formatINR(o.subtotal - (o.discount || 0))}</td>
                      <td className="p-1.5 border-r border-black text-right">{formatINR(cgst)}</td>
                      <td className="p-1.5 border-r border-black text-right">{formatINR(sgst)}</td>
                      <td className="p-1.5 text-right font-bold">{formatINR(o.grandTotal)}</td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
        {counted.some((o) => o.taxIsCustom) && <div className="text-[9px]">* Custom tax rate set by the owner on that bill.</div>}
        <div className="text-[9px]">
          CGST/SGST shown as an even split. A website order delivered to another state is IGST - see the Monthly GST report.
        </div>

        <div className="grid grid-cols-2 gap-4 border border-black p-3">
          <div className="space-y-1">
            <div className="font-bold">SHOP MONEY COUNT</div>
            <div className="flex justify-between"><span>Cash received</span><span>{formatINR(cashReceived)}</span></div>
            <div className="flex justify-between"><span>Change given back</span><span>-{formatINR(changeGiven)}</span></div>
            <div className="flex justify-between font-bold border-t border-black pt-1"><span>Cash in drawer</span><span>{formatINR(cashInDrawer)}</span></div>
          </div>
          <div className="space-y-1">
            <div className="font-bold">OTHER PAYMENTS</div>
            <div className="flex justify-between"><span>Card</span><span>{formatINR(cardTotal)}</span></div>
            <div className="flex justify-between"><span>UPI</span><span>{formatINR(upiTotal)}</span></div>
            <div className="flex justify-between"><span>Website, paid online</span><span>{formatINR(webPaidOnline)}</span></div>
            <div className="flex justify-between"><span>Website, cash on delivery</span><span>{formatINR(webCod)}</span></div>
          </div>
        </div>

        <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs">
          {['Cashier', 'Store manager', 'Accountant'].map((role) => (
            <div key={role}>
              <div className="h-12 border-b border-black" />
              <div className="font-bold mt-1">{role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SalesAuditPage;
