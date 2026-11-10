import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatINR } from '../../utils/formatters';
import { Search, Printer, PlusCircle, FileCheck, Store, Globe, Eye } from 'lucide-react';
import { useT } from '../../i18n';
import { paymentWord } from '../../utils/paymentWords';
import { printBill } from '../../utils/printBill';
import { Order } from '../../types';

type Channel = 'ALL' | 'OFFLINE' | 'ONLINE';

export const BillsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { orders: posBills, onlineOrders, settings, currentStaff } = useStore();
  const t = useT();
  const canBill = !currentStaff || currentStaff.permissions.includes('BILLING');
  const canAudit = !currentStaff || currentStaff.permissions.includes('AUDIT');

  // Shop bills + website orders, newest first.
  const orders = useMemo(
    () => [...posBills, ...onlineOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [posBills, onlineOrders]
  );
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState<Channel>(() => {
    const ch = searchParams.get('channel');
    return ch === 'ONLINE' || ch === 'OFFLINE' ? ch : 'ALL';
  });

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((b) => {
      const isShop = b.channel === 'OFFLINE';
      const matchesChannel =
        channelFilter === 'ALL' || (channelFilter === 'OFFLINE' && isShop) || (channelFilter === 'ONLINE' && !isShop);

      const matchesSearch =
        !q ||
        b.orderNumber.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.customerPhone.includes(q) ||
        (b.discountReason && b.discountReason.toLowerCase().includes(q));

      const isSplit = b.paymentSplits && b.paymentSplits.length > 1;
      const matchesMethod =
        methodFilter === 'ALL' || (methodFilter === 'SPLIT' && isSplit) || (!isSplit && b.paymentMethod === methodFilter);

      return matchesChannel && matchesSearch && matchesMethod;
    });
  }, [orders, search, methodFilter, channelFilter]);

  const totalBilled = orders.filter((o) => o.billStatus !== 'VOID').reduce((sum, o) => sum + o.grandTotal, 0);

  const handlePrint = async (bill: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await printBill(bill, settings, 'SLIP');
    if (!ok) store.addToast(t('Could not open printing'), t('Try again, or open the bill and print from there.'), 'error');
  };

  const pill = (active: boolean) =>
    `h-10 px-4 text-base font-bold whitespace-nowrap transition-colors ${
      active ? 'bg-v26-ink text-white' : 'bg-v26-paper text-v26-ink border border-v26-line hover:border-v26-ink'
    }`;

  const channelLabel: Record<Channel, string> = {
    ALL: t('All'),
    OFFLINE: t('Shop'),
    ONLINE: t('Website'),
  };
  const methodLabel: Record<string, string> = {
    ALL: t('All'),
    CASH: t('Cash'),
    UPI: t('UPI'),
    CARD: t('Card'),
    SPLIT: t('Split payment'),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{t('All bills')}</h1>
          <p className="text-base text-v26-muted mt-1">
            {t('{n} bills', { n: orders.length })} · {t('Total')}: {formatINR(totalBilled)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAudit && (
            <Button variant="secondary" onClick={() => navigate('/audit')} icon={<FileCheck size={18} />}>
              {t('Check sales')}
            </Button>
          )}
          {canBill && (
            <Button variant="accent" onClick={() => navigate('/billing/new')} icon={<PlusCircle size={18} />}>
              {t('New bill')}
            </Button>
          )}
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-v26-muted" />
          <input
            type="search"
            placeholder={t('Search bill no., name or phone')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field h-12 pl-11"
          />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mr-1">{t('Sold in')}:</span>
            {(['ALL', 'OFFLINE', 'ONLINE'] as const).map((ch) => (
              <button key={ch} onClick={() => setChannelFilter(ch)} className={pill(channelFilter === ch)}>
                {channelLabel[ch]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mr-1">{t('Paid by')}:</span>
            {['ALL', 'CASH', 'UPI', 'CARD', 'SPLIT'].map((m) => (
              <button key={m} onClick={() => setMethodFilter(m)} className={pill(methodFilter === m)}>
                {methodLabel[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-v26-muted">
          {t('Showing {a} of {b}', { a: filteredBills.length, b: orders.length })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr>
                <th className="table-head py-3 px-4">{t('Bill no.')}</th>
                <th className="table-head py-3 px-4">{t('Sold in')}</th>
                <th className="table-head py-3 px-4">{t('Date')}</th>
                <th className="table-head py-3 px-4">{t('Customer')}</th>
                <th className="table-head py-3 px-4">{t('Items')}</th>
                <th className="table-head py-3 px-4">{t('Paid by')}</th>
                <th className="table-head py-3 px-4 text-right">{t('Total')}</th>
                <th className="table-head py-3 px-4">{t('Status')}</th>
                <th className="table-head py-3 px-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-v26-line">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-v26-muted">
                    {t('No bills found.')}
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => {
                  const itemCount = b.items.reduce((sum, i) => sum + i.quantity, 0);
                  const isShop = b.channel === 'OFFLINE';
                  return (
                    <tr
                      key={b.id}
                      onClick={() => isShop && navigate(`/bills/${b.id}`)}
                      className={`hover:bg-v26-soft transition-colors ${isShop ? 'cursor-pointer' : ''}`}
                    >
                      <td className="py-3 px-4 font-bold whitespace-nowrap">{b.orderNumber}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isShop ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                            <Store size={16} /> {t('Shop')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-status-blue">
                            <Globe size={16} /> {t('Website')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-v26-muted whitespace-nowrap">{b.createdAt.substring(0, 16)}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold">{b.customerName === 'Walk-in Customer' ? t('Walk-in customer') : b.customerName}</div>
                        {b.customerPhone && <div className="text-sm text-v26-muted">{b.customerPhone}</div>}
                      </td>
                      <td className="py-3 px-4">{itemCount}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{t(paymentWord(b))}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-black">{formatINR(b.grandTotal)}</div>
                        {b.discount > 0 && (
                          <div className="text-sm text-status-green font-bold">
                            {t('Discount')} −{formatINR(b.discount)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={b.billStatus === 'VOID' ? 'VOID' : b.paymentStatus} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isShop ? (
                          <div className="inline-flex gap-2">
                            <Button variant="secondary" size="sm" icon={<Eye size={16} />} onClick={() => navigate(`/bills/${b.id}`)}>
                              {t('Open')}
                            </Button>
                            <Button variant="primary" size="sm" icon={<Printer size={16} />} onClick={(e) => handlePrint(b, e)}>
                              {t('Print')}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-v26-muted">{t('Website order')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
