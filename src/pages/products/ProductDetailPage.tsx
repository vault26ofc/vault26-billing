import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatINR } from '../../utils/formatters';
import { ArrowLeft, Shirt, Tag, Plus, Minus, ExternalLink, PlusCircle } from 'lucide-react';
import { useT } from '../../i18n';
import { WEBSITE_ADMIN_PRODUCTS_URL } from '../../constants/website';
import { variantStockStatus } from '../../utils/stock';
import { ONE_SIZE } from '../../utils/singleItem';

type AdjustReason = 'RESTOCK' | 'ADJUSTMENT' | 'DAMAGED';

const REASON_WORDS: Record<string, string> = {
  SALE: 'Sold in shop',
  RESTOCK: 'New stock',
  ADJUSTMENT: 'Correction',
  RETURN_RESTOCK: 'Returned',
  DAMAGED: 'Damaged',
  VOID: 'Bill cancelled',
  EDIT: 'Bill changed',
};

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, inventoryLogs, settings, currentStaff } = useStore();
  const t = useT();
  const canBill = !currentStaff || currentStaff.permissions.includes('BILLING');
  const canTags = !currentStaff || currentStaff.permissions.includes('TAGS');

  const product = products.find((p) => p.id === id || p.sku.toLowerCase() === id?.toLowerCase());

  const [adjustingVariantId, setAdjustingVariantId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState<AdjustReason>('RESTOCK');
  const [busy, setBusy] = useState(false);

  if (!product) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-v26-paper border border-v26-line flex items-center justify-center mx-auto text-v26-muted">
          <Shirt size={26} />
        </div>
        <h2 className="font-display text-3xl">{t('Product not found')}</h2>
        <Button variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => navigate('/products')}>
          {t('Back to products')}
        </Button>
      </div>
    );
  }

  const activeVariant = product.variants.find((v) => v.id === adjustingVariantId);
  const codeByVariant = new Map(product.variants.map((v) => [v.id, v.sku]));
  const productLogs = inventoryLogs.filter((l) => l.productId === product.id);
  const sizeText = (size: string) => (size === ONE_SIZE ? t('One size') : size);

  const runAdjust = async (variantId: string, change: number, reason: AdjustReason) => {
    setBusy(true);
    try {
      await store.adjustStock(product.id, variantId, change, reason);
    } catch (err) {
      store.addToast(t('Stock not changed'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingVariantId) return;
    const qty = Math.abs(Number(adjustQty) || 0);
    if (qty === 0) return;
    await runAdjust(adjustingVariantId, adjustReason === 'DAMAGED' ? -qty : qty, adjustReason);
    setAdjustingVariantId(null);
    setAdjustQty('1');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate('/products')}>
          {t('Products')}
        </Button>
        <div className="flex flex-wrap gap-2">
          {canTags && (
            <Button variant="secondary" icon={<Tag size={18} />} onClick={() => navigate(`/tags?productId=${product.id}`)}>
              {t('Print price tags')}
            </Button>
          )}
          {canBill && (
            <Button variant="secondary" icon={<PlusCircle size={18} />} onClick={() => navigate('/billing/new')}>
              {t('New bill')}
            </Button>
          )}
          <Button
            variant="primary"
            icon={<ExternalLink size={18} />}
            onClick={() => window.open(WEBSITE_ADMIN_PRODUCTS_URL, '_blank', 'noopener')}
          >
            {t('Edit in website admin')}
          </Button>
        </div>
      </div>

      <div className="card p-5 flex flex-col sm:flex-row gap-5">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full sm:w-40 aspect-[4/5] object-cover border border-v26-line" />
        ) : (
          <div className="w-full sm:w-40 aspect-[4/5] bg-v26-soft border border-v26-line flex items-center justify-center text-v26-muted">
            <Shirt size={40} />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            {product.storeOnly && <StatusBadge status="STORE_ONLY" showDot={false} className="bg-v26-ink text-white border-v26-ink" />}
            {product.status === 'ARCHIVED' && <StatusBadge status="ARCHIVED" />}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl">{product.name}</h1>
          <div className="text-base text-v26-muted">{product.category}</div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black">{formatINR(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-base text-v26-muted line-through">{formatINR(product.compareAtPrice)}</span>
            )}
          </div>
          <div className="text-lg">
            <b>{product.totalStock}</b> {t('pieces in stock')}
          </div>
          {product.description && <p className="text-base text-v26-muted max-w-2xl">{product.description}</p>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-v26-line">
          <h2 className="font-display text-2xl">{t('Stock by colour and size')}</h2>
          <p className="text-base text-v26-muted">{t('Use + and − to change stock by one piece.')}</p>
        </div>

        {product.variants.length === 0 ? (
          <div className="p-6 text-base text-status-red font-bold">
            {t('This product has no colours or sizes yet. Add them in the website admin before billing it.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base border-collapse">
              <thead>
                <tr>
                  <th className="table-head py-3 px-5">{t('Colour')}</th>
                  <th className="table-head py-3 px-4">{t('Size')}</th>
                  <th className="table-head py-3 px-4">{t('Code')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('Price')}</th>
                  <th className="table-head py-3 px-4 text-center">{t('In stock')}</th>
                  <th className="table-head py-3 px-5 text-right">{t('Change stock')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {product.variants.map((v) => (
                  <tr key={v.id}>
                    <td className="py-3 px-5 font-bold">{v.color || '—'}</td>
                    <td className="py-3 px-4 font-bold">{sizeText(v.size)}</td>
                    <td className="py-3 px-4 text-v26-muted">{v.sku}</td>
                    <td className="py-3 px-4 text-right">{formatINR(v.price)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="text-xl font-black">{v.stock}</div>
                      <StatusBadge status={variantStockStatus(v, settings.lowStockThreshold)} showDot={false} />
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          aria-label={t('Remove one piece')}
                          disabled={v.stock <= 0 || busy}
                          onClick={() => void runAdjust(v.id, -1, 'ADJUSTMENT')}
                          className="w-11 h-11 border border-v26-line hover:border-v26-ink disabled:opacity-30 flex items-center justify-center"
                        >
                          <Minus size={18} />
                        </button>
                        <button
                          aria-label={t('Add one piece')}
                          disabled={busy}
                          onClick={() => void runAdjust(v.id, 1, 'RESTOCK')}
                          className="w-11 h-11 border border-v26-line hover:border-v26-ink disabled:opacity-30 flex items-center justify-center"
                        >
                          <Plus size={18} />
                        </button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-11"
                          onClick={() => {
                            setAdjustingVariantId(v.id);
                            setAdjustQty('1');
                            setAdjustReason('RESTOCK');
                          }}
                        >
                          {t('More…')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-v26-line">
          <h2 className="font-display text-2xl">{t('Stock history')}</h2>
        </div>
        {productLogs.length === 0 ? (
          <div className="p-6 text-base text-v26-muted">{t('No stock changes yet.')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base border-collapse">
              <thead>
                <tr>
                  <th className="table-head py-3 px-5">{t('When')}</th>
                  <th className="table-head py-3 px-4">{t('Code')}</th>
                  <th className="table-head py-3 px-4">{t('What happened')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('Change')}</th>
                  <th className="table-head py-3 px-5 text-right">{t('Stock after')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {productLogs.slice(0, 10).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-5 text-v26-muted whitespace-nowrap">{log.date.substring(0, 16)}</td>
                    <td className="py-2.5 px-4">{codeByVariant.get(log.variantSku) || '—'}</td>
                    <td className="py-2.5 px-4">{t(REASON_WORDS[log.reason] || log.reason)}</td>
                    <td className={`py-2.5 px-4 text-right font-bold ${log.changeQty > 0 ? 'text-status-green' : 'text-status-red'}`}>
                      {log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty}
                    </td>
                    <td className="py-2.5 px-5 text-right font-bold">{log.newStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeVariant && (
        <Modal
          isOpen={!!adjustingVariantId}
          onClose={() => setAdjustingVariantId(null)}
          title={t('Change stock')}
          subtitle={`${product.name} · ${activeVariant.color ? `${activeVariant.color} / ` : ''}${sizeText(activeVariant.size)} · ${t('now {n} pieces', { n: activeVariant.stock })}`}
        >
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <Select
              label={t('What happened?')}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value as AdjustReason)}
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
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              min="1"
              required
            />
            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setAdjustingVariantId(null)}>
                {t('Cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {t('Save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
