import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../services/store';
import { Search, X, ArrowRight, Shirt, Users, Receipt } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { useT } from '../../i18n';
import { useScrollLock } from '../../utils/useScrollLock';

interface SearchResult {
  id: string;
  type: 'BILL' | 'PRODUCT' | 'CUSTOMER';
  title: string;
  subtitle: string;
  url: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// How many results to list. With nothing typed: the latest few of each kind.
// While typing: every match up to MAX_MATCHES; the list scrolls inside the box.
const PREVIEW_EACH = 5;
const MAX_MATCHES = 50;

// One search box for bills, products (and their codes) and customers.
export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { products, orders, customers } = useStore();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // The page behind stays still while the search is open.
  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    const bill = (o: (typeof orders)[number]): SearchResult => ({
      id: o.id,
      type: 'BILL',
      title: `${t('Bill')} ${o.orderNumber}`,
      subtitle: `${o.customerName === 'Walk-in Customer' ? t('Walk-in customer') : o.customerName} · ${formatINR(o.grandTotal)}`,
      url: `/bills/${o.id}`,
    });
    const product = (p: (typeof products)[number]): SearchResult => ({
      id: p.id,
      type: 'PRODUCT',
      title: p.name,
      subtitle: `${formatINR(p.price)} · ${t('{n} in stock', { n: p.totalStock })}`,
      url: `/products/${p.id}`,
    });
    const customer = (c: (typeof customers)[number]): SearchResult => ({
      id: c.id,
      type: 'CUSTOMER',
      title: c.name,
      subtitle: `${c.phone} · ${t('{n} bills', { n: c.ordersCount })}`,
      url: `/customers/${c.id}`,
    });

    if (!q) {
      return [
        ...orders.slice(0, PREVIEW_EACH).map(bill),
        ...products.slice(0, PREVIEW_EACH).map(product),
        ...customers.slice(0, PREVIEW_EACH).map(customer),
      ];
    }

    const matched: SearchResult[] = [];
    orders.forEach((o) => {
      if (o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerPhone.includes(q)) {
        matched.push(bill(o));
      }
    });
    products.forEach((p) => {
      if (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q))
      ) {
        matched.push(product(p));
      }
    });
    customers.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)) {
        matched.push(customer(c));
      }
    });
    return matched.slice(0, MAX_MATCHES);
  }, [query, products, orders, customers, t]);

  useEffect(() => {
    setSelectedIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [results]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.url);
      onClose();
    },
    [navigate, onClose]
  );

  // Arrow keys, Enter and Esc work wherever the focus is while the search is
  // open - not only inside the text box. Before, one click anywhere in the box
  // sent the arrows to the page behind, which scrolled instead.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Still picking a letter on a Telugu (or other) keyboard: not ours yet.
      if (e.isComposing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = results.length;
        if (n === 0) return;
        setSelectedIndex((prev) => (e.key === 'ArrowDown' ? (prev + 1) % n : (prev - 1 + n) % n));
        inputRef.current?.focus({ preventScroll: true });
      } else if (e.key === 'Enter') {
        // A button reached with Tab (Close, or a result) keeps its own Enter.
        const target = e.target as HTMLElement | null;
        if (target && target !== inputRef.current && target.tagName === 'BUTTON') return;
        e.preventDefault();
        if (results[selectedIndex]) handleSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, results, selectedIndex, handleSelect, onClose]);

  // Keep the highlighted result in sight when the arrows move past the edge.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (!list || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 8;
  }, [selectedIndex]);

  if (!isOpen) return null;

  const typeWord = { BILL: t('Bill'), PRODUCT: t('Product'), CUSTOMER: t('Customer') };

  return (
    <div className="fixed inset-0 z-50 bg-v26-ink/60 flex items-start justify-center p-3 sm:p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Search')}
        className="w-full max-w-2xl bg-v26-paper border border-v26-ink shadow-modal flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          // Clicking inside the box keeps the cursor in the text box, so typing
          // and the arrow keys carry on. The result list itself is left alone
          // so its scrollbar can still be dragged.
          if (e.target !== inputRef.current && e.target !== listRef.current) e.preventDefault();
        }}
      >
        <div className="p-3 border-b border-v26-line flex items-center gap-2">
          <Search size={22} className="text-v26-muted shrink-0 ml-1" />
          {/* type="text", not "search": a search box adds the browser's own
              clear cross next to our Close cross - two crosses. */}
          <input
            ref={inputRef}
            autoFocus
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            aria-label={t('Search')}
            placeholder={t('Type a bill no., product, phone or name')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-transparent text-lg focus:outline-none placeholder:text-[#8A8A8A]"
          />
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 flex items-center justify-center text-v26-muted hover:text-v26-ink hover:bg-v26-soft shrink-0"
            aria-label={t('Close')}
          >
            <X size={22} />
          </button>
        </div>

        <div ref={listRef} className="relative overflow-y-auto overscroll-contain flex-1 min-h-0 p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-base text-v26-muted">{t('Nothing found.')}</div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  type="button"
                  key={`${item.type}-${item.id}`}
                  data-index={idx}
                  onClick={() => handleSelect(item)}
                  onMouseMove={(e) => {
                    // Only a real mouse move picks a row. When the arrow keys
                    // scroll the list under a still mouse, the row under it
                    // must not steal the highlight back.
                    const last = lastPointer.current;
                    if (last && last.x === e.clientX && last.y === e.clientY) return;
                    lastPointer.current = { x: e.clientX, y: e.clientY };
                    if (!isSelected) setSelectedIndex(idx);
                  }}
                  className={`w-full text-left p-3 flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-v26-ink text-white' : 'text-v26-ink'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 shrink-0 ${isSelected ? 'bg-white/10' : 'bg-v26-soft'}`}>
                      {item.type === 'BILL' && <Receipt size={20} />}
                      {item.type === 'PRODUCT' && <Shirt size={20} />}
                      {item.type === 'CUSTOMER' && <Users size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold truncate">{item.title}</div>
                      <div className={`text-sm truncate ${isSelected ? 'text-white/75' : 'text-v26-muted'}`}>
                        {typeWord[item.type]} · {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={18} className="shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
