import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isValidGstin, normalizeGstin } from '../../utils/gstin';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricBlock } from '../../components/ui/MetricBlock';
import { Input } from '../../components/ui/Input';
import { formatINR } from '../../utils/formatters';
import { ArrowLeft, Mail, Phone, MapPin, Receipt, Pencil } from 'lucide-react';
import { useT } from '../../i18n';
import { methodWord } from '../../utils/paymentWords';
import { variantLabel } from '../../utils/singleItem';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { customers, orders, returns, currentStaff } = useStore();
  const t = useT();
  const canBill = !currentStaff || currentStaff.permissions.includes('BILLING');

  const customer = customers.find((c) => c.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = () => {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone);
    setEditAddress(customer.address);
    setEditCity(customer.city);
    setEditGstin(customer.gstin || '');
    setIsEditing(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (editGstin && !isValidGstin(editGstin)) {
      store.addToast(t('GSTIN is not right'), t('Type the full 15-letter GSTIN, or leave it empty.'), 'error');
      return;
    }
    setIsSaving(true);
    try {
      await store.updateCustomer(customer.id, {
        name: editName,
        phone: editPhone,
        address: editAddress,
        city: editCity,
        gstin: editGstin,
      });
      setIsEditing(false);
    } catch (err) {
      store.addToast(t('Customer not saved'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!customer) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="font-display text-3xl">{t('Customer not found')}</h2>
        <Button variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => navigate('/customers')}>
          {t('Back to customers')}
        </Button>
      </div>
    );
  }

  // This customer's bills: billed to them, or (only when they have an email)
  // sent to that same email.
  const email = customer.email.trim().toLowerCase();
  const customerOrders = orders.filter(
    (o) => o.customerId === customer.id || (!!email && o.customerEmail.trim().toLowerCase() === email)
  );
  const customerReturns = returns.filter((r) => r.customerId === customer.id);

  // Computed from this customer's own bills.
  const itemCounts = new Map<string, number>();
  const paymentCounts = new Map<string, number>();
  customerOrders.forEach((o) => {
    o.items.forEach((i) => itemCounts.set(i.name, (itemCounts.get(i.name) || 0) + i.quantity));
    paymentCounts.set(o.paymentMethod, (paymentCounts.get(o.paymentMethod) || 0) + 1);
  });
  const topItem = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topPayment = [...paymentCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {!isEditing && (
            <Button variant="secondary" icon={<Pencil size={18} />} onClick={startEditing}>
              {t('Edit details')}
            </Button>
          )}
          {canBill && (
            <Button variant="accent" icon={<Receipt size={18} />} onClick={() => navigate(`/billing/new?customerId=${customer.id}`)}>
              {t('New bill for this customer')}
            </Button>
          )}
        </div>
      </div>

      <div className="card p-5">
        {isEditing ? (
          <form onSubmit={handleSaveCustomer} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('Name')} required value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input label={t('Phone')} type="tel" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Input label={t('City')} value={editCity} onChange={(e) => setEditCity(e.target.value)} />
            <div className="sm:col-span-2">
              <Input
                label={t('GSTIN (only for business customers)')}
                value={editGstin}
                maxLength={15}
                onChange={(e) => setEditGstin(normalizeGstin(e.target.value))}
                className="uppercase"
                error={editGstin && !isValidGstin(editGstin) ? t('Type the full 15-letter GSTIN, or leave it empty.') : undefined}
              />
            </div>
            <div className="sm:col-span-2">
              <Input label={t('Address')} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                {t('Cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? t('Saving…') : t('Save')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl sm:text-4xl">{customer.name}</h1>
              <StatusBadge status={customer.segment} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-base">
              <span className="flex items-center gap-2">
                <Phone size={18} className="text-v26-muted" /> {customer.phone}
              </span>
              {customer.email && (
                <span className="flex items-center gap-2">
                  <Mail size={18} className="text-v26-muted" /> {customer.email}
                </span>
              )}
              {(customer.address || customer.city) && (
                <span className="flex items-center gap-2">
                  <MapPin size={18} className="text-v26-muted" /> {[customer.address, customer.city].filter(Boolean).join(', ')}
                </span>
              )}
              {customer.gstin && <span className="font-bold">GSTIN: {customer.gstin}</span>}
            </div>
            <div className="text-sm text-v26-muted">
              {t('Customer since')} {customer.createdAt}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBlock label={t('Total spent')} value={formatINR(customer.totalSpend)} />
        <MetricBlock label={t('Bills')} value={customerOrders.length} />
        <MetricBlock label={t('Average bill')} value={formatINR(customer.averageOrderValue)} />
        <MetricBlock label={t('Returns')} value={customerReturns.length} />
      </div>

      {(topItem || topPayment) && (
        <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="label">{t('Buys most')}</div>
            <div className="text-lg font-bold">{topItem || '—'}</div>
          </div>
          <div>
            <div className="label">{t('Usually pays by')}</div>
            <div className="text-lg font-bold">{topPayment ? t(methodWord(topPayment)) : '—'}</div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-v26-line">
          <h2 className="font-display text-2xl">{t('Bills')}</h2>
        </div>
        {customerOrders.length === 0 ? (
          <div className="p-8 text-center text-base text-v26-muted">{t('No bills yet for this customer.')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr>
                  <th className="table-head py-3 px-5">{t('Bill no.')}</th>
                  <th className="table-head py-3 px-4">{t('Date')}</th>
                  <th className="table-head py-3 px-4">{t('Items')}</th>
                  <th className="table-head py-3 px-5 text-right">{t('Total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {customerOrders.map((ord) => (
                  <tr key={ord.id} onClick={() => navigate(`/bills/${ord.id}`)} className="hover:bg-v26-soft cursor-pointer">
                    <td className="py-3 px-5 font-bold whitespace-nowrap">
                      {ord.orderNumber}
                      {ord.billStatus === 'VOID' && <span className="ml-2 text-sm text-status-red">{t('Cancelled')}</span>}
                    </td>
                    <td className="py-3 px-4 text-v26-muted whitespace-nowrap">{ord.createdAt.substring(0, 10)}</td>
                    <td className="py-3 px-4">
                      {ord.items
                        .map((i) => (variantLabel(i.size, i.color) ? `${i.name} (${variantLabel(i.size, i.color)})` : i.name))
                        .join(', ')}
                    </td>
                    <td className="py-3 px-5 text-right font-bold whitespace-nowrap">{formatINR(ord.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {customerReturns.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-v26-line">
            <h2 className="font-display text-2xl">{t('Returns')}</h2>
          </div>
          <div className="divide-y divide-v26-line">
            {customerReturns.map((ret) => (
              <div key={ret.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold">{ret.returnNumber}</div>
                  <div className="text-base">
                    {ret.productTitle}
                    {ret.variantName ? ` — ${ret.variantName}` : ''}
                  </div>
                  <div className="text-sm text-v26-muted">
                    {t('Reason')}: {ret.reason}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <StatusBadge status={ret.status} />
                  <div className="font-bold">{formatINR(ret.refundAmount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
