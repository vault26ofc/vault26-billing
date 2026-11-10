import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatINR } from '../../utils/formatters';
import { BarcodeSvg } from '../../components/common/BarcodeSvg';
import { TagFormat, Product } from '../../types';
import { Printer, Plus, Trash2 } from 'lucide-react';
import { useT } from '../../i18n';
import { ONE_SIZE } from '../../utils/singleItem';

interface TagVariantItem {
  id: string;
  sku: string;
  color: string;
  size: string;
  mrp: number;
  price: number;
  printQty: number;
}

// MM/YYYY in IST.
function thisMonth(): string {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .split('-');
  return `${m}/${y}`;
}

const sizeText = (size: string) => (size === ONE_SIZE ? 'One size' : size);

// MRP is the product's compare-at price from the website admin; when there is
// none, the selling price is the MRP. It is never made up.
function rowsFor(p: Product | undefined): TagVariantItem[] {
  if (!p) return [];
  return p.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    color: v.color,
    size: sizeText(v.size),
    mrp: Math.max(v.compareAtPrice ?? p.compareAtPrice ?? v.price, v.price),
    price: v.price,
    printQty: Math.max(1, Math.min(10, v.stock)),
  }));
}

export const PriceTagGeneratorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { products, settings } = useStore();
  const t = useT();

  const sellable = products.filter((p) => p.variants.length > 0);
  const preselected = searchParams.get('productId') || '';

  const [productId, setProductId] = useState('');
  const [tagFormat, setTagFormat] = useState<TagFormat>('HANG_TAG');
  const [brandName, setBrandName] = useState('');
  const [productName, setProductName] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [fabricSpecs, setFabricSpecs] = useState('');
  const [careText, setCareText] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Made in India');
  const [mfdDate, setMfdDate] = useState(thisMonth());
  const [variantList, setVariantList] = useState<TagVariantItem[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const loadProduct = (id: string) => {
    const p = sellable.find((x) => x.id === id);
    if (!p) return;
    setProductId(p.id);
    setProductName(p.name);
    setCollectionName(p.category);
    setFabricSpecs(p.material || '');
    setCareText(p.care || '');
    setVariantList(rowsFor(p));
    setPreviewIndex(0);
  };

  // Products and settings arrive after the screen opens.
  useEffect(() => {
    if (!productId && sellable.length > 0) loadProduct(sellable.find((p) => p.id === preselected)?.id || sellable[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellable.length, preselected]);
  useEffect(() => {
    if (!brandName) setBrandName(settings.brand || settings.storeName);
  }, [settings.brand, settings.storeName, brandName]);

  const addRow = () => {
    setVariantList((prev) => [
      ...prev,
      { id: `row-${Date.now()}`, sku: '', color: prev[0]?.color || '', size: '', mrp: prev[0]?.mrp || 0, price: prev[0]?.price || 0, printQty: 1 },
    ]);
  };
  const removeRow = (id: string) => {
    if (variantList.length <= 1) return;
    setVariantList((prev) => prev.filter((v) => v.id !== id));
    setPreviewIndex(0);
  };
  const updateRow = (id: string, field: keyof TagVariantItem, value: string | number) => {
    setVariantList((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const totalTags = useMemo(() => variantList.reduce((sum, v) => sum + (Number(v.printQty) || 0), 0), [variantList]);
  const expanded = useMemo(() => {
    const list: TagVariantItem[] = [];
    variantList.forEach((v) => {
      for (let i = 0; i < Math.max(1, Number(v.printQty) || 1); i++) list.push(v);
    });
    return list;
  }, [variantList]);

  const preview = variantList[previewIndex] || variantList[0];
  const marketer = [brandName, settings.cityState].filter(Boolean).join(', ');

  const formats: { id: TagFormat; title: string; size: string }[] = [
    { id: 'HANG_TAG', title: t('Hang tag'), size: '50 × 105 mm' },
    { id: 'STICKER', title: t('Sticker'), size: '50 × 30 mm' },
    { id: 'SHOEBOX', title: t('Box label'), size: '90 × 55 mm' },
  ];

  // One tag, drawn in mm for the printer and at the same proportions on screen.
  const renderTag = (item: TagVariantItem, forPrint: boolean) => {
    const mrpLine = item.mrp > item.price;
    if (tagFormat === 'STICKER') {
      return (
        <div style={{ width: '50mm', height: '30mm', border: '1px solid #0F0F0F', padding: '2mm', boxSizing: 'border-box', background: '#FFFFFF', color: '#0F0F0F', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Lato, Arial, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '9px', fontWeight: 900 }}>{brandName}</div>
              <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', maxWidth: '30mm', overflow: 'hidden', whiteSpace: 'nowrap' }}>{productName}</div>
            </div>
            <div style={{ background: '#0F0F0F', color: '#FFFFFF', fontSize: '9px', fontWeight: 900, padding: '0.5mm 1.5mm' }}>{item.size}</div>
          </div>
          {item.sku && <BarcodeSvg value={item.sku} width={forPrint ? 140 : 150} height={18} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '0.8px solid #0F0F0F', paddingTop: '0.8mm' }}>
            <span style={{ fontSize: '7px' }}>{item.color}</span>
            <span>
              {mrpLine && <span style={{ fontSize: '7px', textDecoration: 'line-through', marginRight: '1mm' }}>MRP {formatINR(item.mrp)}</span>}
              <span style={{ fontSize: '10px', fontWeight: 900 }}>
                {mrpLine ? '' : 'MRP '}
                {formatINR(item.price)}
              </span>
            </span>
          </div>
        </div>
      );
    }
    if (tagFormat === 'SHOEBOX') {
      return (
        <div style={{ width: '90mm', height: '55mm', border: '1.5px solid #0F0F0F', padding: '3mm', boxSizing: 'border-box', background: '#FFFFFF', color: '#0F0F0F', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Lato, Arial, sans-serif' }}>
          <div style={{ borderBottom: '1px solid #0F0F0F', paddingBottom: '1mm' }}>
            <div style={{ fontSize: '11px', fontWeight: 900 }}>{brandName}</div>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase' }}>{productName}</div>
          </div>
          <div style={{ display: 'flex', gap: '2mm', margin: '1mm 0' }}>
            <div style={{ background: '#0F0F0F', color: '#FFFFFF', padding: '1mm 2mm', textAlign: 'center' }}>
              <div style={{ fontSize: '6px' }}>SIZE</div>
              <div style={{ fontSize: '11px', fontWeight: 900 }}>{item.size}</div>
            </div>
            <div style={{ border: '1px solid #0F0F0F', padding: '1mm 2mm', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '6px' }}>COLOUR</div>
              <div style={{ fontSize: '8px', fontWeight: 700 }}>{item.color || '—'}</div>
            </div>
            <div style={{ border: '1px solid #0F0F0F', padding: '1mm 2mm' }}>
              <div style={{ fontSize: '6px' }}>MFD</div>
              <div style={{ fontSize: '8px', fontWeight: 700 }}>{mfdDate}</div>
            </div>
          </div>
          {fabricSpecs && <div style={{ fontSize: '7px' }}>{fabricSpecs}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #0F0F0F', paddingTop: '1mm' }}>
            {item.sku ? <BarcodeSvg value={item.sku} width={130} height={18} /> : <span />}
            <div style={{ textAlign: 'right' }}>
              {mrpLine && <div style={{ fontSize: '7px', textDecoration: 'line-through' }}>MRP {formatINR(item.mrp)}</div>}
              <div style={{ fontSize: '12px', fontWeight: 900 }}>
                {mrpLine ? '' : 'MRP '}
                {formatINR(item.price)}
              </div>
              <div style={{ fontSize: '5.5px' }}>INCL. OF ALL TAXES</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ width: '52mm', height: '105mm', border: '1.5px solid #0F0F0F', padding: '3mm', boxSizing: 'border-box', textAlign: 'center', background: '#FFFFFF', color: '#0F0F0F', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Lato, Arial, sans-serif' }}>
        <div>
          <div style={{ width: '3.5mm', height: '3.5mm', borderRadius: '50%', border: '1.5px solid #0F0F0F', margin: '0 auto 2mm' }} />
          <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'Imbue, Georgia, serif' }}>{brandName}</div>
          {collectionName && <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase' }}>{collectionName}</div>}
          <div style={{ borderBottom: '1px solid #0F0F0F', margin: '2mm 0' }} />
          <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.2 }}>{productName}</div>
          {item.color && <div style={{ fontSize: '8px', marginTop: '1mm' }}>COLOUR: <strong>{item.color}</strong></div>}
          <div style={{ background: '#0F0F0F', color: '#FFFFFF', fontWeight: 900, fontSize: '13px', padding: '1.5mm 0', margin: '2mm 0', textTransform: 'uppercase' }}>
            SIZE: {item.size}
          </div>
          {fabricSpecs && <div style={{ fontSize: '7.5px', lineHeight: 1.2 }}>{fabricSpecs}</div>}
          {careText && <div style={{ fontSize: '6.5px', lineHeight: 1.2, marginTop: '1mm' }}>{careText}</div>}
        </div>
        <div>
          {item.sku && <BarcodeSvg value={item.sku} width={150} height={24} />}
          <div style={{ borderTop: '1px solid #0F0F0F', paddingTop: '1.5mm', marginTop: '1.5mm' }}>
            {mrpLine && <div style={{ fontSize: '8px', textDecoration: 'line-through' }}>MRP {formatINR(item.mrp)}</div>}
            <div style={{ fontSize: '15px', fontWeight: 900 }}>
              {mrpLine ? '' : 'MRP '}
              {formatINR(item.price)}
            </div>
            <div style={{ fontSize: '6.5px', textTransform: 'uppercase' }}>INCL. OF ALL TAXES · NET QTY: 1 N</div>
          </div>
          <div style={{ fontSize: '6px', marginTop: '1.5mm', textTransform: 'uppercase', lineHeight: 1.3 }}>
            <div>MFD: {mfdDate} · {countryOfOrigin}</div>
            {marketer && <div>MARKETED BY: {marketer}</div>}
          </div>
        </div>
      </div>
    );
  };

  if (sellable.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl sm:text-4xl">{t('Price tags')}</h1>
        <div className="card p-8 text-base text-v26-muted">{t('No products with colours and sizes yet.')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{t('Price tags')}</h1>
          <p className="text-base text-v26-muted mt-1">{t('Choose a product, check the sizes, print.')}</p>
        </div>
        <Button variant="accent" size="lg" icon={<Printer size={22} />} onClick={() => window.print()} disabled={totalTags === 0}>
          {t('Print {n} tags', { n: totalTags })}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start no-print">
        <div className="xl:col-span-7 space-y-5">
          <div className="card p-5 space-y-4">
            <div className="section-title">1. {t('Product')}</div>
            <Select value={productId} onChange={(e) => loadProduct(e.target.value)} options={sellable.map((p) => ({ value: p.id, label: p.name }))} />
          </div>

          <div className="card p-5 space-y-4">
            <div className="section-title">2. {t('Tag type')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTagFormat(f.id)}
                  className={`p-4 text-left border transition-colors ${
                    tagFormat === f.id ? 'bg-v26-ink text-white border-v26-ink' : 'border-v26-line hover:border-v26-ink'
                  }`}
                >
                  <div className="text-lg font-bold">{f.title}</div>
                  <div className={`text-sm ${tagFormat === f.id ? 'text-white/75' : 'text-v26-muted'}`}>{f.size}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="section-title">3. {t('What the tag says')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t('Brand')} value={brandName} onChange={(e) => setBrandName(e.target.value)} />
              <Input label={t('Product name')} value={productName} onChange={(e) => setProductName(e.target.value)} />
              <Input label={t('Category')} value={collectionName} onChange={(e) => setCollectionName(e.target.value)} />
              <Input label={t('Material')} value={fabricSpecs} onChange={(e) => setFabricSpecs(e.target.value)} />
              <Input label={t('Wash care')} value={careText} onChange={(e) => setCareText(e.target.value)} />
              <Input label={t('Made in')} value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} />
              <Input label={t('Month made (MM/YYYY)')} value={mfdDate} onChange={(e) => setMfdDate(e.target.value)} />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-v26-line flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-title">4. {t('Sizes and how many tags')}</div>
                <div className="text-sm text-v26-muted">{t('Tap a row to see it in the preview.')}</div>
              </div>
              <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={addRow}>
                {t('Add row')}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr>
                    <th className="table-head py-2.5 px-3">{t('Size')}</th>
                    <th className="table-head py-2.5 px-3">{t('Colour')}</th>
                    <th className="table-head py-2.5 px-3">{t('Code (barcode)')}</th>
                    <th className="table-head py-2.5 px-3">MRP ₹</th>
                    <th className="table-head py-2.5 px-3">{t('Price')} ₹</th>
                    <th className="table-head py-2.5 px-3">{t('Tags')}</th>
                    <th className="table-head py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-v26-line">
                  {variantList.map((v, idx) => (
                    <tr key={v.id} onClick={() => setPreviewIndex(idx)} className={previewIndex === idx ? 'bg-status-amberBg' : ''}>
                      <td className="py-2 px-3">
                        <input aria-label={t('Size')} value={v.size} onChange={(e) => updateRow(v.id, 'size', e.target.value)} className="field h-10 px-2 w-24 font-bold" />
                      </td>
                      <td className="py-2 px-3">
                        <input aria-label={t('Colour')} value={v.color} onChange={(e) => updateRow(v.id, 'color', e.target.value)} className="field h-10 px-2 w-28" />
                      </td>
                      <td className="py-2 px-3">
                        <input aria-label={t('Code (barcode)')} value={v.sku} onChange={(e) => updateRow(v.id, 'sku', e.target.value.toUpperCase())} className="field h-10 px-2 w-36" />
                      </td>
                      <td className="py-2 px-3">
                        <input aria-label="MRP" type="number" value={v.mrp} onChange={(e) => updateRow(v.id, 'mrp', Number(e.target.value) || 0)} className="field h-10 px-2 w-24" />
                      </td>
                      <td className="py-2 px-3">
                        <input aria-label={t('Price')} type="number" value={v.price} onChange={(e) => updateRow(v.id, 'price', Number(e.target.value) || 0)} className="field h-10 px-2 w-24 font-bold" />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          aria-label={t('Tags')}
                          type="number"
                          min={1}
                          max={99}
                          value={v.printQty}
                          onChange={(e) => updateRow(v.id, 'printQty', Math.max(1, Number(e.target.value) || 1))}
                          className="field h-10 px-2 w-20 font-bold border-v26-ink"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRow(v.id);
                          }}
                          disabled={variantList.length <= 1}
                          className="h-10 w-10 flex items-center justify-center text-v26-muted hover:text-status-red disabled:opacity-30"
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
            <div className="px-5 py-3 border-t border-v26-line text-base font-bold text-right">{t('Total tags')}: {totalTags}</div>
          </div>
        </div>

        <div className="xl:col-span-5 xl:sticky xl:top-20 space-y-3">
          <div className="card p-5 space-y-4">
            <div className="section-title">{t('Preview')}</div>
            <div className="bg-v26-soft p-6 flex items-center justify-center min-h-[420px] overflow-hidden">
              {preview ? renderTag(preview, false) : null}
            </div>
            <Button variant="accent" fullWidth size="lg" icon={<Printer size={22} />} onClick={() => window.print()} disabled={totalTags === 0}>
              {t('Print {n} tags', { n: totalTags })}
            </Button>
          </div>
        </div>
      </div>

      {/* Printed only: every tag, repeated by its count. */}
      <div className="hidden print:block">
        <style
          dangerouslySetInnerHTML={{
            __html: `@media print { body { background:#fff !important; margin:0 !important; } .tag-grid { display:flex !important; flex-wrap:wrap !important; gap:4mm !important; padding:4mm !important; } .tag-card { break-inside:avoid !important; page-break-inside:avoid !important; } }`,
          }}
        />
        <div className="tag-grid">
          {expanded.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="tag-card">
              {renderTag(item, true)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PriceTagGeneratorPage;
