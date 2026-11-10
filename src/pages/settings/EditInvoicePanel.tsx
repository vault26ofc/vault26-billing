import React, { useState } from 'react';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatINR } from '../../utils/formatters';
import { OrderItem } from '../../types';
import { slabTaxRate, taxFor, formatRate } from '../../utils/tax';
import { variantLabel, ONE_SIZE } from '../../utils/singleItem';
import { Search, Trash2, Plus, Save, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n';

// OWNER only: change the items or totals of a bill that was already saved.
export const EditInvoicePanel: React.FC = () => {
  const { orders, products, settings } = useStore();
  const t = useT();
  const [search, setSearch] = useState('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  // '' = GST slab (worked out by the database); a number = custom % for this bill.
  const [customTaxRate, setCustomTaxRate] = useState('');
  const [shippingFee, setShippingFee] = useState('0');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // A colour x size row to add (never just a product - stock moves per size).
  const [addVariantId, setAddVariantId] = useState('');

  const selectedBill = orders.find((o) => o.id === selectedBillId);

  const matchingBills = search.trim()
    ? orders
        .filter((o) => o.billStatus !== 'VOID' && o.orderNumber.toLowerCase().includes(search.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const selectBill = (billId: string) => {
    const bill = orders.find((o) => o.id === billId);
    if (!bill) return;
    setSelectedBillId(billId);
    setItems(bill.items.map((i) => ({ ...i })));
    setDiscount(String(bill.discount));
    setDiscountReason(bill.discountReason || '');
    setCustomTaxRate(bill.taxIsCustom && bill.taxRate !== undefined ? String(bill.taxRate) : '');
    setShippingFee(String(bill.shippingFee));
    setNotes(bill.notes || '');
    setSearch('');
  };

  const updateItem = (idx: number, field: 'quantity' | 'unitPrice', value: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const quantity = field === 'quantity' ? value : it.quantity;
        const unitPrice = field === 'unitPrice' ? value : it.unitPrice;
        return { ...it, quantity, unitPrice, total: quantity * unitPrice - (it.itemDiscount || 0) };
      })
    );
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const addItem = () => {
    const product = products.find((p) => p.variants.some((v) => v.id === addVariantId));
    const variant = product?.variants.find((v) => v.id === addVariantId);
    if (!product || !variant) return;
    setItems((prev) => [
      ...prev,
      {
        id: undefined,
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        variantName: variantLabel(variant.size, variant.color),
        size: variant.size,
        color: variant.color,
        quantity: 1,
        unitPrice: variant.price,
        total: variant.price,
      },
    ]);
    setAddVariantId('');
  };

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity - (i.itemDiscount || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const isCustomTax = customTaxRate.trim() !== '';
  const previewTaxRate = isCustomTax ? Number(customTaxRate) || 0 : slabTaxRate(taxable, settings);
  const previewTax = taxFor(taxable, previewTaxRate);
  const grandTotal = taxable + previewTax + (Number(shippingFee) || 0);

  const handleSave = async () => {
    if (!selectedBillId || items.length === 0) return;
    if (isCustomTax) {
      const rate = Number(customTaxRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        store.addToast(t('Tax % is not right'), t('Type a number from 0 to 100, or leave it empty for the normal GST.'), 'error');
        return;
      }
    }
    setIsSaving(true);
    try {
      await store.editBill(selectedBillId, items, {
        discount: Number(discount) || 0,
        discountReason,
        customTaxRate: isCustomTax ? Number(customTaxRate) : null,
        shippingFee: Number(shippingFee) || 0,
        notes,
      });
      setSelectedBillId(null);
      setItems([]);
    } catch (err) {
      store.addToast(t('Bill not changed'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-base text-status-red bg-status-redBg border border-status-redBorder p-4">
        <AlertTriangle size={22} className="shrink-0" />
        <span>
          {t(
            'This changes a bill that was already given to a customer: its items, totals, stock and the customer’s spend. Use it only to fix a real mistake.'
          )}
        </span>
      </div>

      {!selectedBill ? (
        <>
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-v26-muted" />
            <input
              type="search"
              placeholder={t('Type the bill no. (for example V26S-2611-0001)')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field h-12 pl-11"
            />
          </div>
          {matchingBills.length > 0 && (
            <div className="border border-v26-line divide-y divide-v26-line">
              {matchingBills.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => selectBill(b.id)}
                  className="w-full text-left px-4 py-3 hover:bg-v26-soft flex flex-wrap items-center justify-between gap-2 text-base"
                >
                  <span className="font-bold">{b.orderNumber}</span>
                  <span className="text-v26-muted">
                    {b.customerName} · {formatINR(b.grandTotal)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xl font-black">{selectedBill.orderNumber}</div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedBillId(null);
                setItems([]);
              }}
            >
              {t('Choose another bill')}
            </Button>
          </div>

          <div className="overflow-x-auto border border-v26-line">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr>
                  <th className="table-head py-2.5 px-3">{t('Item')}</th>
                  <th className="table-head py-2.5 px-3 w-24">{t('Qty')}</th>
                  <th className="table-head py-2.5 px-3 w-32">{t('Price')}</th>
                  <th className="table-head py-2.5 px-3 text-right w-32">{t('Amount')}</th>
                  <th className="table-head py-2.5 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3">
                      <div className="font-bold">{item.name}</div>
                      {item.variantName && <div className="text-sm text-v26-muted">{item.variantName}</div>}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        aria-label={t('Qty')}
                        onChange={(e) => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                        className="field h-10 px-2"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        aria-label={t('Price')}
                        onChange={(e) => updateItem(idx, 'unitPrice', Math.max(0, Number(e.target.value) || 0))}
                        className="field h-10 px-2"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-bold">{formatINR(item.total)}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="h-10 w-10 flex items-center justify-center text-status-red hover:bg-status-redBg"
                        aria-label={t('Remove')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select value={addVariantId} onChange={(e) => setAddVariantId(e.target.value)} className="field h-11 flex-1">
              <option value="">{t('Add an item (choose colour and size)…')}</option>
              {products
                .filter((p) => p.variants.length > 0)
                .map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                        {[v.color, v.size === ONE_SIZE ? t('One size') : v.size].filter(Boolean).join(' / ')} · {formatINR(v.price)} ·{' '}
                        {v.stock <= 0 ? t('Sold out') : t('{n} in stock', { n: v.stock })}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            <Button type="button" variant="secondary" icon={<Plus size={18} />} onClick={addItem} disabled={!addVariantId}>
              {t('Add')}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label={t('Discount (₹)')} type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Input label={t('Discount reason')} value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
            <Input
              label={t('Custom GST % (leave empty for normal GST)')}
              type="number"
              value={customTaxRate}
              onChange={(e) => setCustomTaxRate(e.target.value)}
              placeholder={`${formatRate(slabTaxRate(taxable, settings))}%`}
            />
            <Input label={t('Delivery charge (₹)')} type="number" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
          </div>
          <Input label={t('Note')} value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-v26-line pt-4">
            <div className="text-base">
              <div className="text-v26-muted">
                {t('Items')}: {formatINR(subtotal)} · GST {formatRate(previewTaxRate)}%: {formatINR(previewTax)}
              </div>
              <div className="text-xl font-black">
                {t('New total')}: {formatINR(grandTotal)}
              </div>
            </div>
            <Button type="button" variant="accent" icon={<Save size={18} />} onClick={handleSave} disabled={isSaving || items.length === 0}>
              {isSaving ? t('Saving…') : t('Save changes to this bill')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
