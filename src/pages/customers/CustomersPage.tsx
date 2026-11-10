import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricBlock } from '../../components/ui/MetricBlock';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { formatINR } from '../../utils/formatters';
import { Plus, Search, Phone, MapPin } from 'lucide-react';
import { useT } from '../../i18n';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { customers, currentStaff } = useStore();
  const t = useT();
  const canBill = !currentStaff || currentStaff.permissions.includes('BILLING');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const totalSpend = customers.reduce((sum, c) => sum + c.totalSpend, 0);
  const avgSpend = customers.length ? Math.round(totalSpend / customers.length) : 0;
  const vipCount = customers.filter((c) => c.segment === 'VIP').length;

  const filterTabs = [
    { id: 'ALL', label: t('All'), count: customers.length },
    { id: 'VIP', label: t('VIP'), count: vipCount },
    { id: 'ACTIVE', label: t('Bought before'), count: customers.filter((c) => c.segment === 'ACTIVE').length },
    { id: 'NEW', label: t('New'), count: customers.filter((c) => c.segment === 'NEW').length },
  ];

  const q = search.trim().toLowerCase();
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.city.toLowerCase().includes(q);
    return matchesSearch && (activeTab === 'ALL' || c.segment === activeTab);
  });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      const newCust = await store.addCustomer({
        name: name.trim(),
        email: '',
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        segment: 'NEW',
      });
      setIsModalOpen(false);
      setName('');
      setPhone('');
      setAddress('');
      setCity('');
      navigate(`/customers/${newCust.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      store.addToast(
        t('Customer not saved'),
        /duplicate|unique/i.test(msg) ? t('A customer with this phone number already exists.') : msg,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{t('Customers')}</h1>
          <p className="text-base text-v26-muted mt-1">{t('People who bought in the shop.')}</p>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>
          {t('Add customer')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBlock label={t('Customers')} value={customers.length} />
        <MetricBlock label={t('VIP')} value={vipCount} subtext={t('Spent over ₹40,000')} />
        <MetricBlock label={t('Total spent')} value={formatINR(totalSpend)} />
        <MetricBlock label={t('Average per customer')} value={formatINR(avgSpend)} />
      </div>

      <div className="card">
        <Tabs tabs={filterTabs} activeTab={activeTab} onChange={setActiveTab} className="px-2" />
        <div className="p-4">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-v26-muted" />
            <input
              type="search"
              placeholder={t('Search name, phone or city')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field h-12 pl-11"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-10 text-center text-base text-v26-muted">{t('No customers found.')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr>
                  <th className="table-head py-3 px-4">{t('Name')}</th>
                  <th className="table-head py-3 px-4">{t('Phone & city')}</th>
                  <th className="table-head py-3 px-4">{t('Type')}</th>
                  <th className="table-head py-3 px-4 text-center">{t('Bills')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('Total spent')}</th>
                  <th className="table-head py-3 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {filteredCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    onClick={() => navigate(`/customers/${cust.id}`)}
                    className="hover:bg-v26-soft transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold">{cust.name}</div>
                      {cust.email && <div className="text-sm text-v26-muted">{cust.email}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Phone size={15} className="text-v26-muted" /> {cust.phone}
                      </div>
                      {cust.city && (
                        <div className="text-sm text-v26-muted flex items-center gap-1.5">
                          <MapPin size={14} /> {cust.city}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={cust.segment} />
                    </td>
                    <td className="py-3 px-4 text-center font-bold">{cust.ordersCount}</td>
                    <td className="py-3 px-4 text-right font-bold whitespace-nowrap">{formatINR(cust.totalSpend)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {canBill && (
                        <Button size="sm" variant="primary" onClick={() => navigate(`/billing/new?customerId=${cust.id}`)}>
                          {t('New bill')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('Add customer')}>
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <Input label={`${t('Name')} *`} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <Input
            label={`${t('Phone')} *`}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input label={t('City (optional)')} value={city} onChange={(e) => setCity(e.target.value)} />
          <div>
            <label className="label mb-1.5" htmlFor="new-customer-address">
              {t('Address (optional)')}
            </label>
            <textarea
              id="new-customer-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="field"
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t('Saving…') : t('Save customer')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
