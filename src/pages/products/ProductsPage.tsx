import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricBlock } from '../../components/ui/MetricBlock';
import { formatINR } from '../../utils/formatters';
import { WEBSITE_ADMIN_PRODUCTS_URL } from '../../constants/website';
import { ExternalLink, Search, Tag, Shirt } from 'lucide-react';
import { useT } from '../../i18n';
import { productStockSummary } from '../../utils/stock';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { products, settings, currentStaff } = useStore();
  const t = useT();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const canBill = !currentStaff || currentStaff.permissions.includes('BILLING');
  const canTags = !currentStaff || currentStaff.permissions.includes('TAGS');

  const totalUnits = products.reduce((sum, p) => sum + p.totalStock, 0);
  const totalValue = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.price * v.stock, 0), 0);
  const needAttention = products.filter((p) => productStockSummary(p, settings.lowStockThreshold).status !== 'IN_STOCK').length;

  const categories = useMemo(() => {
    const names = Array.from(new Set(products.map((p) => p.category))).sort();
    return names.map((name) => ({ name, count: products.filter((p) => p.category === name).length }));
  }, [products]);

  const q = search.trim().toLowerCase();
  const filtered = products.filter((p) => {
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(q));
    return matchesSearch && (category === 'ALL' || p.category === category);
  });

  const pill = (active: boolean) =>
    `h-10 px-4 text-base font-bold whitespace-nowrap transition-colors ${
      active ? 'bg-v26-ink text-white' : 'bg-v26-paper text-v26-ink border border-v26-line hover:border-v26-ink'
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{t('Products & stock')}</h1>
          <p className="text-base text-v26-muted mt-1">{t('New products are added in the Vault 26 website admin.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canTags && (
            <Button variant="secondary" icon={<Tag size={18} />} onClick={() => navigate('/tags')}>
              {t('Price tags')}
            </Button>
          )}
          <Button
            variant="primary"
            icon={<ExternalLink size={18} />}
            onClick={() => window.open(WEBSITE_ADMIN_PRODUCTS_URL, '_blank', 'noopener')}
          >
            {t('Add product (website admin)')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricBlock label={t('Pieces in stock')} value={totalUnits} />
        <MetricBlock label={t('Stock value (selling price)')} value={formatINR(totalValue)} />
        <MetricBlock
          label={t('Need restock')}
          value={needAttention}
          subValue={t('Low means {n} pieces or fewer in a size', { n: settings.lowStockThreshold })}
        />
      </div>

      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-v26-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search product name or code')}
            className="field h-12 pl-11"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={pill(category === 'ALL')} onClick={() => setCategory('ALL')}>
            {t('All')} ({products.length})
          </button>
          {categories.map((c) => (
            <button key={c.name} className={pill(category === c.name)} onClick={() => setCategory(c.name)}>
              {c.name} ({c.count})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-base text-v26-muted">{t('No products found.')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((prod) => {
            const stock = productStockSummary(prod, settings.lowStockThreshold);
            return (
              <div key={prod.id} className="card flex flex-col">
                <button onClick={() => navigate(`/products/${prod.id}`)} className="flex gap-4 p-4 text-left hover:bg-v26-soft">
                  {prod.image ? (
                    <img src={prod.image} alt="" className="w-20 h-24 object-cover border border-v26-line shrink-0" />
                  ) : (
                    <div className="w-20 h-24 bg-v26-soft border border-v26-line flex items-center justify-center shrink-0 text-v26-muted">
                      <Shirt size={28} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold leading-snug">{prod.name}</div>
                    <div className="text-sm text-v26-muted">{prod.category}</div>
                    <div className="text-xl font-black mt-1">{formatINR(prod.price)}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge status={stock.status} />
                      {prod.storeOnly && <StatusBadge status="STORE_ONLY" showDot={false} className="bg-v26-ink text-white border-v26-ink" />}
                      {prod.status === 'ARCHIVED' && <StatusBadge status="ARCHIVED" />}
                    </div>
                  </div>
                </button>
                <div className="mt-auto px-4 py-3 border-t border-v26-line flex items-center justify-between gap-2">
                  <span className="text-base">
                    <b>{prod.totalStock}</b> {t('pieces')}
                    {prod.needsSizeCounts && <span className="text-status-red font-bold"> · {t('no sizes yet')}</span>}
                  </span>
                  <div className="flex gap-2">
                    {canBill && (
                      <Button size="sm" variant="secondary" onClick={() => navigate('/billing/new')}>
                        {t('Bill')}
                      </Button>
                    )}
                    <Button size="sm" variant="primary" onClick={() => navigate(`/products/${prod.id}`)}>
                      {t('Stock')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
