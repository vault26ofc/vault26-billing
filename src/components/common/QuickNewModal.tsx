import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useStore, store } from '../../services/store';
import { Shirt, UserPlus, Boxes, ArrowRight, Receipt } from 'lucide-react';
import { WEBSITE_ADMIN_PRODUCTS_URL } from '../../constants/website';
import { useT } from '../../i18n';
import { ONE_SIZE } from '../../utils/singleItem';

interface QuickNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ActiveAction = 'MENU' | 'NEW_CUSTOMER' | 'ADJUST_STOCK';

export const QuickNewModal: React.FC<QuickNewModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { products, currentStaff } = useStore();
  const t = useT();
  const can = (p: string) => !currentStaff || currentStaff.permissions.includes(p);
  const [activeAction, setActiveAction] = useState<ActiveAction>('MENU');
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState<'RESTOCK' | 'ADJUSTMENT' | 'DAMAGED'>('RESTOCK');

  const sellable = products.filter((p) => p.variants.length > 0);
  const activeProduct = sellable.find((p) => p.id === selectedProductId);

  // Products load after this modal mounts - pick the first one once they arrive.
  useEffect(() => {
    if (!isOpen) return;
    if (!activeProduct && sellable[0]) {
      setSelectedProductId(sellable[0].id);
      setSelectedVariantId(sellable[0].variants[0]?.id || '');
    }
  }, [isOpen, activeProduct, sellable]);

  const handleClose = () => {
    setActiveAction('MENU');
    onClose();
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) return;
    setSaving(true);
    try {
      const newCust = await store.addCustomer({
        name: customerName.trim(),
        email: '',
        phone: customerPhone.trim(),
        address: customerAddress.trim(),
        city: customerCity.trim(),
        segment: 'NEW',
      });
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerCity('');
      handleClose();
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

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.abs(Number(adjustQty) || 0);
    if (!selectedProductId || !selectedVariantId || qty === 0) return;
    setSaving(true);
    try {
      await store.adjustStock(selectedProductId, selectedVariantId, adjustReason === 'DAMAGED' ? -qty : qty, adjustReason);
      handleClose();
    } catch (err) {
      store.addToast(t('Stock not changed'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const option = (icon: React.ReactNode, title: string, text: string, onClick: () => void, primary = false) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 border flex items-center justify-between gap-3 transition-colors ${
        primary ? 'bg-v26-red border-v26-red text-white hover:bg-v26-red-dark' : 'border-v26-line hover:border-v26-ink'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className={`p-2.5 ${primary ? 'bg-white/15' : 'bg-v26-soft'}`}>{icon}</span>
        <span>
          <span className="block text-lg font-bold">{title}</span>
          <span className={`block text-sm ${primary ? 'text-white/80' : 'text-v26-muted'}`}>{text}</span>
        </span>
      </span>
      <ArrowRight size={20} />
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        activeAction === 'MENU' ? t('What do you want to do?') : activeAction === 'NEW_CUSTOMER' ? t('Add customer') : t('Change stock')
      }
      maxWidth={activeAction === 'MENU' ? 'md' : 'lg'}
    >
      {activeAction === 'MENU' && (
        <div className="space-y-2">
          {can('BILLING') &&
            option(<Receipt size={22} />, t('New bill'), t('Add items, take payment, print the bill.'), () => {
              handleClose();
              navigate('/billing/new');
            }, true)}
          {(can('CUSTOMERS') || can('BILLING')) &&
            option(<UserPlus size={22} />, t('Add customer'), t('Name and phone number.'), () => setActiveAction('NEW_CUSTOMER'))}
          {option(<Shirt size={22} />, t('Add product'), t('Opens the Vault 26 website admin.'), () => {
            window.open(WEBSITE_ADMIN_PRODUCTS_URL, '_blank', 'noopener');
            handleClose();
          })}
          {can('PRODUCTS') &&
            option(<Boxes size={22} />, t('Change stock'), t('New pieces came in, or remove damaged ones.'), () =>
              setActiveAction('ADJUST_STOCK')
            )}
        </div>
      )}

      {activeAction === 'NEW_CUSTOMER' && (
        <form onSubmit={handleCustomerSubmit} className="space-y-4">
          <Input label={`${t('Name')} *`} required value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoFocus />
          <Input
            label={`${t('Phone')} *`}
            type="tel"
            inputMode="tel"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
          <Input label={t('City (optional)')} value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} />
          <Input label={t('Address (optional)')} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          <div className="pt-2 flex justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => setActiveAction('MENU')}>
              {t('Back')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t('Saving…') : t('Save customer')}
            </Button>
          </div>
        </form>
      )}

      {activeAction === 'ADJUST_STOCK' && (
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          {sellable.length === 0 ? (
            <p className="text-base text-v26-muted">{t('No products with colours and sizes yet.')}</p>
          ) : (
            <>
              <Select
                label={t('Product')}
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const p = sellable.find((prod) => prod.id === e.target.value);
                  setSelectedVariantId(p?.variants[0]?.id || '');
                }}
                options={sellable.map((p) => ({ value: p.id, label: p.name }))}
              />
              {activeProduct && (
                <Select
                  label={t('Colour and size')}
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  options={activeProduct.variants.map((v) => ({
                    value: v.id,
                    label: `${[v.color, v.size === ONE_SIZE ? t('One size') : v.size].filter(Boolean).join(' / ')} — ${t('now {n} pieces', { n: v.stock })}`,
                  }))}
                />
              )}
              <Select
                label={t('What happened?')}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value as 'RESTOCK' | 'ADJUSTMENT' | 'DAMAGED')}
                options={[
                  { value: 'RESTOCK', label: t('New pieces came in (add)') },
                  { value: 'ADJUSTMENT', label: t('Counted again, add the missing pieces (add)') },
                  { value: 'DAMAGED', label: t('Damaged pieces (remove)') },
                ]}
              />
              <Input
                label={adjustReason === 'DAMAGED' ? t('How many to remove?') : t('How many to add?')}
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </>
          )}
          <div className="pt-2 flex justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => setActiveAction('MENU')}>
              {t('Back')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving || sellable.length === 0}>
              {t('Save')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
