import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../services/store';
import { formatINR, istToday } from '../utils/formatters';
import {
  PlusCircle,
  Receipt,
  Shirt,
  Users,
  Tag,
  FileCheck,
  CalendarRange,
  Settings,
  ArrowRight,
  Store,
  Globe,
} from 'lucide-react';
import { useT } from '../i18n';
import { paymentWord } from '../utils/paymentWords';
import { PermissionKey } from '../constants/permissions';
import { productStockSummary } from '../utils/stock';

// Home: one big tile per job, so anyone can find what to do at a glance.
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { orders, onlineOrders, products, settings, currentStaff } = useStore();
  const t = useT();
  const can = (p: PermissionKey) => !currentStaff || currentStaff.permissions.includes(p);

  // Today = since midnight IST. Cancelled bills are not sales.
  const today = istToday();
  const todayBills = orders.filter((o) => o.createdAt.startsWith(today) && o.billStatus !== 'VOID');
  const todaySales = todayBills.reduce((sum, o) => sum + o.grandTotal, 0);
  const averageBill = todayBills.length > 0 ? Math.round(todaySales / todayBills.length) : 0;
  const todayWeb = onlineOrders.filter((o) => o.createdAt.startsWith(today));
  const needRestock = products.filter((p) => productStockSummary(p, settings.lowStockThreshold).status !== 'IN_STOCK').length;

  const tiles: { perm: PermissionKey; path: string; icon: React.ReactNode; title: string; text: string; badge?: string }[] = [
    { perm: 'BILLS', path: '/bills', icon: <Receipt size={30} />, title: t('All bills'), text: t('See, print or cancel a bill') },
    {
      perm: 'PRODUCTS',
      path: '/products',
      icon: <Shirt size={30} />,
      title: t('Products & stock'),
      text: t('How many pieces are left'),
      badge: needRestock > 0 ? t('{n} need restock', { n: needRestock }) : undefined,
    },
    { perm: 'CUSTOMERS', path: '/customers', icon: <Users size={30} />, title: t('Customers'), text: t('Names, phones, what they bought') },
    { perm: 'TAGS', path: '/tags', icon: <Tag size={30} />, title: t('Price tags'), text: t('Print tags with barcode') },
    { perm: 'AUDIT', path: '/audit', icon: <FileCheck size={30} />, title: t('Check sales'), text: t('Shop vs website, cash count') },
    { perm: 'MONTHLY_BILLS', path: '/monthly-bills', icon: <CalendarRange size={30} />, title: t('Monthly GST report'), text: t('One PDF for the month') },
    { perm: 'SETTINGS', path: '/settings', icon: <Settings size={30} />, title: t('Settings & staff'), text: t('Shop details, GST, logins') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">
          {currentStaff ? t('Hello, {name}', { name: currentStaff.name }) : t('Home')}
        </h1>
        <p className="text-base text-v26-muted mt-1">{t('What do you want to do?')}</p>
      </div>

      {can('BILLING') && (
        <button
          onClick={() => navigate('/billing/new')}
          className="w-full bg-v26-red hover:bg-v26-red-dark text-white p-6 sm:p-8 flex items-center justify-between gap-4 text-left transition-colors"
        >
          <span className="flex items-center gap-4">
            <PlusCircle size={44} className="shrink-0" />
            <span>
              <span className="block font-display text-3xl sm:text-4xl">{t('New bill')}</span>
              <span className="block text-base sm:text-lg text-white/85">{t('Add items, take payment, print the bill.')}</span>
            </span>
          </span>
          <ArrowRight size={32} className="shrink-0" />
        </button>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {tiles
          .filter((tile) => can(tile.perm))
          .map((tile) => (
            <button
              key={tile.path}
              onClick={() => navigate(tile.path)}
              className="card p-4 sm:p-5 text-left hover:border-v26-ink hover:bg-v26-soft transition-colors flex flex-col gap-3 min-h-[9.5rem]"
            >
              <span className="text-v26-red">{tile.icon}</span>
              <span>
                <span className="block text-lg sm:text-xl font-bold leading-snug">{tile.title}</span>
                <span className="block text-sm sm:text-base text-v26-muted">{tile.text}</span>
              </span>
              {tile.badge && <span className="mt-auto text-sm font-bold text-status-amber">{tile.badge}</span>}
            </button>
          ))}
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-v26-line">
          <h2 className="font-display text-2xl">{t('Today')}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-v26-line">
          <div className="p-5">
            <div className="label flex items-center gap-1.5">
              <Store size={16} /> {t('Shop sales')}
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{formatINR(todaySales)}</div>
          </div>
          <div className="p-5">
            <div className="label">{t('Shop bills')}</div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{todayBills.length}</div>
          </div>
          <div className="p-5">
            <div className="label">{t('Average bill')}</div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{formatINR(averageBill)}</div>
          </div>
          <div className="p-5">
            <div className="label flex items-center gap-1.5">
              <Globe size={16} /> {t('Website orders delivered')}
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{todayWeb.length}</div>
          </div>
        </div>
      </div>

      {can('BILLS') && orders.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-v26-line flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">{t('Latest bills')}</h2>
            <button onClick={() => navigate('/bills')} className="text-base font-bold underline flex items-center gap-1">
              {t('All bills')} <ArrowRight size={16} />
            </button>
          </div>
          <div className="divide-y divide-v26-line">
            {orders.slice(0, 5).map((bill) => (
              <button
                key={bill.id}
                onClick={() => navigate(`/bills/${bill.id}`)}
                className="w-full text-left px-5 py-3.5 hover:bg-v26-soft flex items-center justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block text-base font-bold">
                    {bill.orderNumber}
                    {bill.billStatus === 'VOID' && <span className="ml-2 text-sm text-status-red">{t('Cancelled')}</span>}
                  </span>
                  <span className="block text-sm text-v26-muted truncate">
                    {bill.createdAt.substring(11, 16)} · {bill.customerName === 'Walk-in Customer' ? t('Walk-in customer') : bill.customerName} ·{' '}
                    {t(paymentWord(bill))}
                  </span>
                </span>
                <span className="text-lg font-black whitespace-nowrap">{formatINR(bill.grandTotal)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
