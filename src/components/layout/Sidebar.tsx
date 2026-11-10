import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Shirt,
  Users,
  Settings,
  X,
  Search,
  RotateCcw,
  Tag,
  FileCheck,
  CalendarRange,
  LogOut,
} from 'lucide-react';
import { store, useStore } from '../../services/store';
import { PermissionKey } from '../../constants/permissions';
import { signOut } from '../../api/auth';
import { useT } from '../../i18n';
import { roleWord } from '../../utils/roleWord';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
  onOpenNew: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpenSearch }) => {
  const location = useLocation();
  const { currentStaff } = useStore();
  const t = useT();

  const allNavItems: Array<{ label: string; path: string; icon: React.ReactNode; permission: PermissionKey }> = [
    { label: t('Home'), path: '/dashboard', icon: <LayoutDashboard size={20} />, permission: 'DASHBOARD' },
    { label: t('All bills'), path: '/bills', icon: <Receipt size={20} />, permission: 'BILLS' },
    { label: t('Products & stock'), path: '/products', icon: <Shirt size={20} />, permission: 'PRODUCTS' },
    { label: t('Customers'), path: '/customers', icon: <Users size={20} />, permission: 'CUSTOMERS' },
    { label: t('Price tags'), path: '/tags', icon: <Tag size={20} />, permission: 'TAGS' },
    { label: t('Check sales'), path: '/audit', icon: <FileCheck size={20} />, permission: 'AUDIT' },
    { label: t('Monthly GST report'), path: '/monthly-bills', icon: <CalendarRange size={20} />, permission: 'MONTHLY_BILLS' },
    { label: t('Settings & staff'), path: '/settings', icon: <Settings size={20} />, permission: 'SETTINGS' },
  ];

  // Nothing loaded yet (still fetching currentStaff) -> show everything rather
  // than flashing an empty sidebar; once currentStaff arrives, filter for real.
  const can = (p: PermissionKey) => !currentStaff || currentStaff.permissions.includes(p);
  const navItems = allNavItems.filter((item) => can(item.permission));

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== '/dashboard' && location.pathname.startsWith(path)) ||
    (path === '/bills' && (location.pathname.startsWith('/invoices') || location.pathname.startsWith('/orders')));

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-v26-ink/50 z-40" onClick={onClose} />}

      <aside
        aria-hidden={!isOpen}
        className={`fixed top-0 bottom-0 left-0 z-50 w-80 max-w-[88vw] bg-v26-paper border-r border-v26-line flex flex-col transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full invisible'
        } no-print select-none`}
      >
        <div className="px-5 h-16 border-b border-v26-line flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-v26-ink">Vault 26</span>
            <span className="text-sm font-bold text-v26-red">{t('Billing')}</span>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center text-v26-muted hover:text-v26-ink"
            aria-label={t('Close menu')}
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-4 border-b border-v26-line space-y-2">
          {can('BILLING') && (
            <NavLink
              to="/billing/new"
              onClick={onClose}
              className="w-full h-14 bg-v26-red text-white px-4 flex items-center gap-3 text-lg font-bold hover:bg-v26-red-dark transition-colors"
            >
              <PlusCircle size={22} />
              <span>{t('New bill')}</span>
            </NavLink>
          )}

          <button
            onClick={() => {
              onClose();
              onOpenSearch();
            }}
            className="w-full h-11 bg-v26-paper border border-v26-line text-v26-muted px-3 flex items-center gap-2 text-base hover:text-v26-ink hover:border-v26-ink transition-colors"
          >
            <Search size={18} />
            <span>{t('Search')}</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1" aria-label={t('Menu')}>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 h-12 text-base transition-colors ${
                  active ? 'bg-v26-ink text-white font-bold' : 'text-v26-ink hover:bg-v26-soft'
                }`}
              >
                <span className={active ? 'text-white' : 'text-v26-muted'}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-v26-line space-y-2">
          {currentStaff && (
            <div className="text-sm">
              <div className="font-bold text-v26-ink truncate">{currentStaff.name}</div>
              <div className="text-v26-muted">{t(roleWord(currentStaff.role))}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => store.reloadFromDatabase()}
              className="h-10 border border-v26-line text-sm text-v26-ink hover:border-v26-ink flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={15} />
              <span>{t('Refresh')}</span>
            </button>
            <button
              onClick={async () => {
                await signOut();
                // A full reload clears everything this login loaded before the next person signs in.
                window.location.replace('/login');
              }}
              className="h-10 border border-v26-line text-sm text-v26-ink hover:border-v26-ink flex items-center justify-center gap-1.5"
            >
              <LogOut size={15} />
              <span>{t('Sign out')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
