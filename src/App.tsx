import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { supabase } from './lib/supabaseClient';
import { initStore, useStore } from './services/store';
import { PermissionKey } from './constants/permissions';

// POS BILLING
import { PosBillingPage } from './pages/billing/PosBillingPage';

// BILLS & TRANSACTIONS
import { BillsPage } from './pages/bills/BillsPage';
import { BillDetailPage } from './pages/bills/BillDetailPage';

// PRODUCTS & CUSTOMERS
import { ProductsPage } from './pages/products/ProductsPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';

// SETTINGS (Includes Business, Billing, Printer & Staff)
import { SettingsPage } from './pages/settings/SettingsPage';

// PRICE TAGS & AUDIT
import { PriceTagGeneratorPage } from './pages/tags/PriceTagGeneratorPage';
import { SalesAuditPage } from './pages/audit/SalesAuditPage';

// MONTHLY BILLS (invoice + report download)
import { MonthlyBillsPage } from './pages/monthly/MonthlyBillsPage';

// Redirect helpers for legacy URLs
const RedirectBillId: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/bills/${id}`} replace />;
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'checking' | 'authed' | 'anon'>('checking');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'authed' : 'anon');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authed' : 'anon');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (status === 'authed') {
      initStore();
    }
  }, [status]);

  if (status === 'checking') return null;
  if (status === 'anon') return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RequirePermission: React.FC<{ permission: PermissionKey; children: React.ReactNode }> = ({
  permission,
  children,
}) => {
  const { currentStaff, ready } = useStore();
  // Staff record not loaded yet - render rather than bounce, avoids a false
  // redirect while initStore() is still fetching.
  if (!ready || !currentStaff) return <>{children}</>;
  if (!currentStaff.permissions.includes(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login */}
        <Route path="/login" element={<Login />} />

        {/* Primary Authenticated Layout */}
        <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<RequirePermission permission="DASHBOARD"><Dashboard /></RequirePermission>} />

          {/* POS BILLING */}
          <Route path="billing/new" element={<RequirePermission permission="BILLING"><PosBillingPage /></RequirePermission>} />
          <Route path="billing" element={<Navigate to="/billing/new" replace />} />

          {/* BILLS & TRANSACTIONS */}
          <Route path="bills" element={<RequirePermission permission="BILLS"><BillsPage /></RequirePermission>} />
          <Route path="bills/:id" element={<RequirePermission permission="BILLS"><BillDetailPage /></RequirePermission>} />

          {/* PRODUCTS & INVENTORY */}
          <Route path="products" element={<RequirePermission permission="PRODUCTS"><ProductsPage /></RequirePermission>} />
          <Route path="products/:id" element={<RequirePermission permission="PRODUCTS"><ProductDetailPage /></RequirePermission>} />

          {/* CUSTOMERS */}
          <Route path="customers" element={<RequirePermission permission="CUSTOMERS"><CustomersPage /></RequirePermission>} />
          <Route path="customers/:id" element={<RequirePermission permission="CUSTOMERS"><CustomerDetailPage /></RequirePermission>} />

          {/* PRICE TAGS & SALES AUDIT */}
          <Route path="tags" element={<RequirePermission permission="TAGS"><PriceTagGeneratorPage /></RequirePermission>} />
          <Route path="audit" element={<RequirePermission permission="AUDIT"><SalesAuditPage /></RequirePermission>} />
          <Route path="monthly-bills" element={<RequirePermission permission="MONTHLY_BILLS"><MonthlyBillsPage /></RequirePermission>} />

          {/* SETTINGS (BUSINESS, BILLING, PRINTER, STAFF) */}
          <Route path="settings" element={<RequirePermission permission="SETTINGS"><SettingsPage /></RequirePermission>} />

          {/* LEGACY URL BACKWARDS COMPATIBILITY REDIRECTS */}
          <Route path="invoices" element={<Navigate to="/bills" replace />} />
          <Route path="invoices/:id" element={<RedirectBillId />} />
          <Route path="orders" element={<Navigate to="/bills" replace />} />
          <Route path="orders/:id" element={<RedirectBillId />} />
          <Route path="payments" element={<Navigate to="/bills" replace />} />
          <Route path="inventory" element={<Navigate to="/products" replace />} />
          <Route path="inventory/history" element={<Navigate to="/products" replace />} />
          <Route path="collections" element={<Navigate to="/products" replace />} />
          <Route path="staff" element={<Navigate to="/settings" replace />} />
          <Route path="fulfillment" element={<Navigate to="/dashboard" replace />} />
          <Route path="shipping" element={<Navigate to="/dashboard" replace />} />
          <Route path="returns" element={<Navigate to="/dashboard" replace />} />
          <Route path="analytics" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
