import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { formatINR } from '../../utils/formatters';
import { slabTaxRate, taxFor, splitCgstSgst, formatRate } from '../../utils/tax';
import { isValidGstin, normalizeGstin } from '../../utils/gstin';
import { singleItemVariant, variantLabel, ONE_SIZE } from '../../utils/singleItem';
import { Product, ProductVariant, PaymentSplit, Order } from '../../types';
import { printBill } from '../../utils/printBill';
import { methodWord } from '../../utils/paymentWords';
import { useT } from '../../i18n';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  FileText,
  ShoppingBag,
  UserPlus,
  RefreshCw,
  AlertCircle,
  X,
  Percent,
  Check,
  Shirt,
  ArrowRight,
} from 'lucide-react';

interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  itemDiscount?: number;
  itemDiscountPercent?: number;
  itemDiscountReason?: string;
}

// Saved on the bill in English (it is part of the GST record); shown translated.
const DISCOUNT_REASONS = [
  'NONE',
  'Festival sale',
  'Staff discount',
  'Regular customer',
  'Clearance sale',
  'Damaged or display piece',
  "Owner's discount",
  'CUSTOM',
];

type Method = 'CASH' | 'UPI' | 'CARD' | 'OTHER';
const METHODS: Method[] = ['CASH', 'UPI', 'CARD', 'OTHER'];

// Distinct colours of a product in variant order ('' = no colour).
const productColors = (product: Product): string[] => [...new Set(product.variants.map((v) => v.color))];

export const PosBillingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCustId = searchParams.get('customerId') || '';
  const t = useT();

  const { products, customers, settings, currentStaff, categories: dbCategories } = useStore();
  const isOwner = currentStaff?.role === 'OWNER';
  const sizeText = (size: string) => (size === ONE_SIZE ? t('One size') : size);

  // Search & filter
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState('ALL');

  // Customer: walk-in unless the cashier picks someone (or came from a customer's page).
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustId);
  const isGuest = !selectedCustomerId;
  const [customerSearch, setCustomerSearch] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Bill discount
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('NONE');
  const [customDiscountReason, setCustomDiscountReason] = useState<string>('');

  // OWNER-only tax % for this one bill. null = normal GST slab.
  const [customTaxRate, setCustomTaxRate] = useState<number | null>(null);
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [customTaxInput, setCustomTaxInput] = useState('');

  // Item discount box
  const [itemDiscountTarget, setItemDiscountTarget] = useState<CartItem | null>(null);
  const [itemDiscType, setItemDiscType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [itemDiscVal, setItemDiscVal] = useState<number>(0);
  const [itemDiscReason, setItemDiscReason] = useState<string>('');

  // Colour / size picker
  const [activeVariantProduct, setActiveVariantProduct] = useState<Product | null>(null);
  const [pickerColor, setPickerColor] = useState<string | null>(null);

  // Payment (one method, or split across several)
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([{ id: 'split-1', method: 'CASH', amount: 0 }]);
  const [cashTendered, setCashTendered] = useState<string>('');

  // Saving & printing
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Phone / small screens: the bill opens as a full screen panel.
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Categories from the website admin, plus any a product is in.
  const categories = useMemo(() => {
    const cats = new Set<string>();
    dbCategories.forEach((c) => cats.add(c.name));
    products.forEach((p) => (p.categories || [p.category]).forEach((name) => cats.add(name)));
    return ['ALL', ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }, [products, dbCategories]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const customerMatches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) => c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, customerSearch]);

  // Customer GST (business customers): off by default; turns on with their saved GSTIN.
  const [gstEnabled, setGstEnabled] = useState(false);
  const [customerGstin, setCustomerGstin] = useState('');
  useEffect(() => {
    const saved = selectedCustomer?.gstin || '';
    setCustomerGstin(saved);
    setGstEnabled(!!saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);
  const gstinInvalid = gstEnabled && !isValidGstin(customerGstin);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q));
      // A product shows under every category it is in, not just its main one.
      const matchesCat = activeCategory === 'ALL' || (p.categories || [p.category]).includes(activeCategory);
      return matchesSearch && matchesCat;
    });
  }, [products, search, activeCategory]);

  // ---------------------------------------------------------------- totals
  const grossSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0), [cart]);
  const itemDiscountsTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.itemDiscount || 0), 0), [cart]);
  const subtotalAfterItemDisc = Math.max(0, grossSubtotal - itemDiscountsTotal);

  const billDiscountAmount = useMemo(() => {
    if (discountType === 'PERCENT') return Math.round((subtotalAfterItemDisc * Math.min(100, Math.max(0, discountValue))) / 100);
    return Math.min(subtotalAfterItemDisc, Math.max(0, discountValue));
  }, [subtotalAfterItemDisc, discountType, discountValue]);

  const totalDiscountAmount = itemDiscountsTotal + billDiscountAmount;
  const taxableAmount = Math.max(0, grossSubtotal - totalDiscountAmount);
  // The GST slab is decided on the whole bill after every discount (the
  // database decides again when saving - this is the on-screen preview).
  const slabRate = slabTaxRate(taxableAmount, settings);
  const taxRate = customTaxRate ?? slabRate;
  const taxAmount = taxFor(taxableAmount, taxRate);
  const grandTotal = taxableAmount + taxAmount;
  const totalItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const amountPaid = useMemo(() => paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0), [paymentSplits]);
  const remainingDue = Math.max(0, grandTotal - amountPaid);
  const overPaid = Math.max(0, amountPaid - grandTotal);

  const cashSplit = paymentSplits.find((s) => s.method === 'CASH');
  const cashAmountExpected = cashSplit ? Number(cashSplit.amount) || 0 : 0;
  const numCashTendered = Number(cashTendered) || 0;
  const changeToReturn = Math.max(0, numCashTendered - cashAmountExpected);
  const cashShort = !!cashSplit && numCashTendered > 0 && numCashTendered < cashAmountExpected;

  // One payment method always covers the whole bill.
  useEffect(() => {
    if (paymentSplits.length === 1 && paymentSplits[0].amount !== grandTotal) {
      setPaymentSplits([{ ...paymentSplits[0], amount: grandTotal }]);
    }
  }, [grandTotal, paymentSplits]);

  const handleApplyCustomTax = () => {
    const rate = Number(customTaxInput);
    if (customTaxInput.trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      store.addToast(t('Tax % is not right'), t('Type a number from 0 to 100.'), 'error');
      return;
    }
    setCustomTaxRate(rate);
    setIsEditingTax(false);
  };

  const handleClearCustomTax = () => {
    setCustomTaxRate(null);
    setCustomTaxInput('');
    setIsEditingTax(false);
  };

  // ---------------------------------------------------------------- cart
  const handleAddVariantToCart = (product: Product, variant: ProductVariant) => {
    if (variant.stock <= 0) {
      store.addToast(t('Sold out'), `${product.name} · ${[variant.color, sizeText(variant.size)].filter(Boolean).join(' / ')}`, 'warning');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.variant.id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock) {
          store.addToast(t('No more in stock'), t('Only {n} in stock.', { n: variant.stock }), 'warning');
          return prev;
        }
        return prev.map((i) => (i.variant.id === variant.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
    setActiveVariantProduct(null);
    setPickerColor(null);
  };

  // Tapping a product always asks for colour and size, so stock moves on the
  // exact row - except a product sold as one single piece.
  const handleProductTap = (product: Product) => {
    if (product.needsSizeCounts || product.variants.length === 0) {
      store.addToast(t('No sizes yet'), t('{name} has no colours or sizes yet. Add them in the website admin first.', { name: product.name }), 'warning');
      return;
    }
    const single = singleItemVariant(product.variants);
    if (single) return handleAddVariantToCart(product, single);
    if (product.variants.length === 1) return handleAddVariantToCart(product, product.variants[0]);
    const colors = productColors(product);
    setPickerColor(colors.length === 1 ? colors[0] : null);
    setActiveVariantProduct(product);
  };

  const handleUpdateQuantity = (variantId: string, change: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variant.id !== variantId) return item;
          const nextQty = item.quantity + change;
          if (nextQty > item.variant.stock) {
            store.addToast(t('No more in stock'), t('Only {n} in stock.', { n: item.variant.stock }), 'warning');
            return item;
          }
          // An item discount can never be more than the line itself.
          const lineGross = item.variant.price * nextQty;
          return { ...item, quantity: nextQty, itemDiscount: item.itemDiscount ? Math.min(item.itemDiscount, lineGross) : item.itemDiscount };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (variantId: string) => setCart((prev) => prev.filter((i) => i.variant.id !== variantId));

  const handleOpenItemDiscount = (item: CartItem) => {
    setItemDiscountTarget(item);
    setItemDiscType(item.itemDiscountPercent || !item.itemDiscount ? 'PERCENT' : 'FIXED');
    setItemDiscVal(item.itemDiscountPercent || item.itemDiscount || 10);
    setItemDiscReason(item.itemDiscountReason || '');
  };

  const itemDiscPreview = (target: CartItem) => {
    const lineGross = target.variant.price * target.quantity;
    const amt =
      itemDiscType === 'PERCENT'
        ? Math.round((lineGross * Math.min(100, Math.max(0, itemDiscVal))) / 100)
        : Math.min(lineGross, Math.max(0, itemDiscVal));
    return { lineGross, amt };
  };

  const handleApplyItemDiscount = () => {
    if (!itemDiscountTarget) return;
    const { lineGross, amt } = itemDiscPreview(itemDiscountTarget);
    setCart((prev) =>
      prev.map((i) =>
        i.variant.id === itemDiscountTarget.variant.id
          ? {
              ...i,
              itemDiscount: amt,
              itemDiscountPercent: itemDiscType === 'PERCENT' ? itemDiscVal : undefined,
              itemDiscountReason: itemDiscReason.trim() || 'Item discount',
            }
          : i
      )
    );
    void lineGross;
    setItemDiscountTarget(null);
  };

  const handleRemoveItemDiscount = (variantId: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.variant.id !== variantId) return i;
        const rest = { ...i };
        delete rest.itemDiscount;
        delete rest.itemDiscountPercent;
        delete rest.itemDiscountReason;
        return rest;
      })
    );
  };

  // ---------------------------------------------------------------- customer
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      store.addToast(t('Name and phone are needed'), undefined, 'error');
      return;
    }
    setSavingCustomer(true);
    try {
      const created = await store.addCustomer({
        name: newCustName.trim(),
        email: '',
        phone: newCustPhone.trim(),
        address: '',
        city: '',
        segment: 'NEW',
      });
      setSelectedCustomerId(created.id);
      setIsAddingCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      setCustomerSearch('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      store.addToast(
        t('Customer not saved'),
        /duplicate|unique/i.test(msg) ? t('A customer with this phone number already exists.') : msg,
        'error'
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  // ---------------------------------------------------------------- payment
  const handleAddPaymentSplit = () => {
    const newId = `split-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`;
    setPaymentSplits((prev) => [...prev, { id: newId, method: 'UPI', amount: remainingDue > 0 ? remainingDue : 0 }]);
  };
  const handleRemovePaymentSplit = (id: string) => {
    if (paymentSplits.length <= 1) return;
    setPaymentSplits((prev) => prev.filter((s) => s.id !== id));
  };
  const handleUpdateSplit = (id: string, updates: Partial<PaymentSplit>) => {
    setPaymentSplits((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };
  const handleSetSinglePaymentMethod = (method: Method) => {
    setPaymentSplits([{ id: 'split-1', method, amount: grandTotal }]);
    if (method !== 'CASH') setCashTendered('');
  };

  const resetBill = () => {
    setCart([]);
    setShowDiscount(false);
    setDiscountValue(0);
    setDiscountReason('NONE');
    setCustomDiscountReason('');
    setCustomTaxRate(null);
    setCustomTaxInput('');
    setIsEditingTax(false);
    setPaymentSplits([{ id: 'split-1', method: 'CASH', amount: 0 }]);
    setCashTendered('');
    setSelectedCustomerId('');
    setCustomerSearch('');
  };

  const canSettle = cart.length > 0 && remainingDue <= 0 && overPaid === 0 && !cashShort && !isProcessingPayment;

  // Save first, then print.
  const handleCompletePayment = async (shouldPrint: boolean) => {
    if (cart.length === 0) {
      store.addToast(t('The bill is empty'), t('Add at least one item.'), 'warning');
      return;
    }
    if (remainingDue > 0) {
      store.addToast(t('Payment not complete'), t('{amount} is still to be paid.', { amount: formatINR(remainingDue) }), 'error');
      return;
    }
    if (overPaid > 0) {
      store.addToast(t('Payment is more than the bill'), t('Fix the amounts so they add up to the total.'), 'error');
      return;
    }
    if (cashShort) {
      store.addToast(t('Cash received is less than the cash amount'), undefined, 'error');
      return;
    }
    if (gstinInvalid) {
      store.addToast(t('GSTIN is not right'), t('Type the full 15-letter GSTIN, or turn off customer GST.'), 'error');
      return;
    }

    setIsProcessingPayment(true);
    setPrintError(null);

    const effectiveDiscountReason =
      (discountReason === 'CUSTOM' ? customDiscountReason.trim() : '') ||
      (discountReason !== 'NONE' && discountReason !== 'CUSTOM'
        ? discountReason
        : totalDiscountAmount > 0
          ? `${discountValue}${discountType === 'PERCENT' ? '%' : ' Rs'} discount`
          : undefined);

    const orderItems = cart.map((item) => ({
      productId: item.product.id,
      variantId: item.variant.id,
      name: item.product.name,
      variantName: variantLabel(item.variant.size, item.variant.color),
      size: item.variant.size,
      color: item.variant.color,
      quantity: item.quantity,
      unitPrice: item.variant.price,
      total: item.variant.price * item.quantity - (item.itemDiscount || 0),
      itemDiscount: item.itemDiscount || 0,
      discountReason: item.itemDiscountReason,
    }));

    // Cash received / change go on the cash payment row.
    const splits = paymentSplits.map((s) =>
      s.method === 'CASH' && numCashTendered > 0 ? { ...s, tendered: numCashTendered, change: changeToReturn } : s
    );

    try {
      const savedBill = await store.createOrder({
        customerId: isGuest ? 'guest' : selectedCustomerId,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerEmail: selectedCustomer?.email || '',
        customerPhone: selectedCustomer?.phone || '',
        customerGstin: gstEnabled ? normalizeGstin(customerGstin) : undefined,
        channel: 'OFFLINE',
        shippingAddress: { street: '', city: '', state: '', pincode: '', country: 'India' },
        items: orderItems,
        subtotal: grossSubtotal,
        discount: totalDiscountAmount,
        discountType,
        discountPercent: discountType === 'PERCENT' ? discountValue : grossSubtotal > 0 ? Math.round((totalDiscountAmount / grossSubtotal) * 100) : 0,
        discountReason: effectiveDiscountReason,
        shippingFee: 0,
        taxAmount,
        taxRate,
        taxIsCustom: customTaxRate !== null,
        grandTotal,
        paymentStatus: 'PAID',
        fulfillmentStatus: 'DELIVERED',
        paymentMethod: splits.length > 1 ? 'SPLIT' : splits[0]?.method || 'CASH',
        paymentSplits: splits,
        tenderedAmount: numCashTendered > 0 ? numCashTendered : undefined,
        changeAmount: changeToReturn || undefined,
        notes: undefined,
      });

      setIsProcessingPayment(false);
      setReceiptOrder(savedBill);
      resetBill();
      setMobileCartOpen(false);
      if (shouldPrint) void doPrint(savedBill, 'SLIP');
    } catch (err) {
      setIsProcessingPayment(false);
      store.addToast(t('Bill not saved'), err instanceof Error ? err.message : t('Nothing was charged. Please try again.'), 'error');
    }
  };

  const doPrint = async (bill: Order, kind: 'SLIP' | 'TAX_INVOICE') => {
    setIsPrinting(true);
    setPrintError(null);
    try {
      const ok = await printBill(bill, settings, kind);
      if (!ok) setPrintError(t('The print window did not open.'));
    } catch {
      setPrintError(t('The print window did not open.'));
    } finally {
      setIsPrinting(false);
    }
  };

  // Keyboard: '/' search, F2 save & print, F4 save without printing, Esc clears search.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current && search) {
        setSearch('');
      } else if (e.key === 'F2' || e.key === 'F4') {
        e.preventDefault();
        if (canSettle && !receiptOrder) void handleCompletePayment(e.key === 'F2');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const pill = (active: boolean) =>
    `h-11 px-3 text-base font-bold whitespace-nowrap transition-colors border ${
      active ? 'bg-v26-ink text-white border-v26-ink' : 'bg-v26-paper text-v26-ink border-v26-line hover:border-v26-ink'
    }`;

  const stepTitle = (n: number, text: string, right?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 bg-v26-ink text-white text-sm font-bold flex items-center justify-center">{n}</span>
        <span className="text-lg font-bold">{text}</span>
      </div>
      {right}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">{t('New bill')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMobileCartOpen(true)}
            className="lg:hidden h-11 bg-v26-ink text-white px-4 text-base font-bold flex items-center gap-2"
          >
            <ShoppingBag size={18} />
            {t('Bill')} ({totalItemCount}) · {formatINR(grandTotal)}
          </button>
          <Button variant="secondary" onClick={() => navigate('/bills')}>
            {t('All bills')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ---------------- products ---------------- */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-v26-muted" />
              <input
                type="search"
                ref={searchInputRef}
                placeholder={t('Search product, or scan the barcode')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field h-12 pl-11"
              />
            </div>
            <Select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              aria-label={t('Category')}
              className="sm:w-60"
              buttonClassName="h-12"
              options={categories.map((cat) => ({ value: cat, label: cat === 'ALL' ? t('All categories') : cat }))}
            />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="card py-12 text-center text-base text-v26-muted">{t('No products found.')}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
              {filteredProducts.map((prod) => {
                const colors = productColors(prod);
                const oneColourSizes = prod.variants.length > 1 && colors.length === 1 && !singleItemVariant(prod.variants);
                return (
                  <div key={prod.id} className="card flex flex-col hover:border-v26-ink transition-colors">
                    <button type="button" onClick={() => handleProductTap(prod)} className="text-left p-2.5 flex-1">
                      <div className="aspect-square bg-v26-soft overflow-hidden relative">
                        {prod.image ? (
                          <img src={prod.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-v26-muted">
                            <Shirt size={32} />
                          </div>
                        )}
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
                          {prod.storeOnly && <span className="bg-v26-ink text-white text-xs font-bold px-1.5 py-0.5">{t('Store only')}</span>}
                          {prod.status === 'ARCHIVED' && <span className="bg-v26-paper text-v26-ink text-xs font-bold px-1.5 py-0.5">{t('Hidden')}</span>}
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 bg-v26-ink/90 text-white text-xs font-bold px-1.5 py-0.5">
                          {prod.needsSizeCounts ? t('no sizes yet') : t('{n} in stock', { n: prod.totalStock })}
                        </div>
                      </div>
                      <div className="mt-2 text-base font-bold leading-snug line-clamp-2">{prod.name}</div>
                      <div className="text-lg font-black">{formatINR(prod.price)}</div>
                    </button>
                    {oneColourSizes && (
                      <div className="px-2.5 pb-2.5 flex flex-wrap gap-1">
                        {prod.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            disabled={v.stock <= 0}
                            onClick={() => handleAddVariantToCart(prod, v)}
                            className="min-w-[2.75rem] h-10 px-2 border border-v26-line hover:bg-v26-ink hover:text-white text-sm font-bold disabled:opacity-30"
                            title={t('{n} in stock', { n: v.stock })}
                          >
                            {sizeText(v.size)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------------- the bill ---------------- */}
        <div
          className={`lg:col-span-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-100px)] overflow-y-auto bg-v26-paper border border-v26-line ${
            mobileCartOpen ? 'fixed inset-0 z-50 block' : 'hidden lg:block'
          }`}
        >
          <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-v26-line sticky top-0 bg-v26-paper z-20">
            <span className="text-lg font-bold">{t('Bill')}</span>
            <button onClick={() => setMobileCartOpen(false)} className="h-11 w-11 flex items-center justify-center" aria-label={t('Close')}>
              <X size={22} />
            </button>
          </div>

          {/* 1. Customer */}
          <div className="p-4 border-b border-v26-line">
            {stepTitle(1, t('Customer'))}
            {selectedCustomer ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-v26-soft">
                <div className="min-w-0">
                  <div className="text-base font-bold truncate">{selectedCustomer.name}</div>
                  <div className="text-sm text-v26-muted">{selectedCustomer.phone}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setSelectedCustomerId('')}>
                  {t('Walk-in instead')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-base">
                  <b>{t('Walk-in customer')}</b> <span className="text-v26-muted">— {t('or find a saved customer:')}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="search"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder={t('Phone or name')}
                    className="field h-11 flex-1"
                  />
                  <Button variant="secondary" icon={<UserPlus size={18} />} onClick={() => setIsAddingCustomer((v) => !v)}>
                    {t('New')}
                  </Button>
                </div>
                {customerMatches.length > 0 && (
                  <div className="border border-v26-line divide-y divide-v26-line">
                    {customerMatches.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerSearch('');
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-v26-soft flex justify-between gap-2 text-base"
                      >
                        <span className="font-bold truncate">{c.name}</span>
                        <span className="text-v26-muted">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {customerSearch.trim() && customerMatches.length === 0 && (
                  <div className="text-sm text-v26-muted">{t('No saved customer found.')}</div>
                )}
                {isAddingCustomer && (
                  <form onSubmit={handleQuickAddCustomer} className="p-3 border border-v26-ink space-y-2">
                    <input
                      type="text"
                      required
                      placeholder={t('Name')}
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="field h-11"
                      autoFocus
                    />
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder={t('Phone')}
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="field h-11"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingCustomer(false)}>
                        {t('Cancel')}
                      </Button>
                      <Button type="submit" variant="primary" size="sm" disabled={savingCustomer}>
                        {t('Save customer')}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="mt-3">
              <label className="flex items-center gap-3 cursor-pointer w-fit text-base">
                <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} className="w-5 h-5 accent-v26-ink" />
                {t('Business customer (add their GSTIN)')}
              </label>
              {gstEnabled && (
                <div className="mt-2">
                  <input
                    type="text"
                    maxLength={15}
                    placeholder={t('Customer GSTIN (15 letters)')}
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(normalizeGstin(e.target.value))}
                    className={`field h-11 uppercase tracking-wider ${customerGstin && gstinInvalid ? 'border-status-red' : ''}`}
                  />
                  <div className={`text-sm mt-1 ${gstinInvalid ? 'text-status-red' : 'text-v26-muted'}`}>
                    {!customerGstin
                      ? t('It prints on the bill.')
                      : gstinInvalid
                        ? t('{n} of 15 letters - not complete yet', { n: customerGstin.length })
                        : isGuest
                          ? t('Correct. It prints on this bill only.')
                          : t('Correct. It prints on the bill and is saved for this customer.')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Items */}
          <div className="p-4 border-b border-v26-line">
            {stepTitle(
              2,
              t('Items ({n})', { n: totalItemCount }),
              cart.length > 0 && (
                <button type="button" onClick={() => setConfirmClear(true)} className="text-sm font-bold text-status-red flex items-center gap-1">
                  <Trash2 size={15} /> {t('Clear bill')}
                </button>
              )
            )}
            {cart.length === 0 ? (
              <div className="py-8 text-center text-v26-muted space-y-1">
                <ShoppingBag size={28} className="mx-auto" />
                <div className="text-base">{t('Tap a product to add it.')}</div>
              </div>
            ) : (
              <div className="divide-y divide-v26-line">
                {cart.map((item) => {
                  const lineGross = item.variant.price * item.quantity;
                  return (
                    <div key={item.variant.id} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-base font-bold">{item.product.name}</div>
                          <div className="text-sm text-v26-muted">
                            {[item.variant.color, sizeText(item.variant.size)].filter(Boolean).join(' / ')} · {formatINR(item.variant.price)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {item.itemDiscount ? (
                            <>
                              <div className="text-sm text-v26-muted line-through">{formatINR(lineGross)}</div>
                              <div className="text-base font-black text-status-green">{formatINR(lineGross - item.itemDiscount)}</div>
                            </>
                          ) : (
                            <div className="text-base font-black">{formatINR(lineGross)}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center">
                          <button
                            onClick={() => handleUpdateQuantity(item.variant.id, -1)}
                            className="w-11 h-11 border border-v26-line hover:border-v26-ink flex items-center justify-center"
                            aria-label={t('One less')}
                          >
                            <Minus size={18} />
                          </button>
                          <span className="w-10 text-center text-lg font-black">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.variant.id, 1)}
                            className="w-11 h-11 border border-v26-line hover:border-v26-ink flex items-center justify-center"
                            aria-label={t('One more')}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenItemDiscount(item)}
                            className={`h-10 px-3 text-sm font-bold border flex items-center gap-1 ${
                              item.itemDiscount ? 'bg-status-greenBg text-status-green border-status-greenBorder' : 'border-v26-line hover:border-v26-ink'
                            }`}
                          >
                            <Percent size={15} />
                            {item.itemDiscount ? `−${formatINR(item.itemDiscount)}` : t('Discount')}
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.variant.id)}
                            className="h-10 w-10 flex items-center justify-center text-v26-muted hover:text-status-red"
                            aria-label={t('Remove')}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Discount on the whole bill */}
          <div className="p-4 border-b border-v26-line">
            {stepTitle(
              3,
              t('Discount on whole bill'),
              !showDiscount && (
                <Button variant="secondary" size="sm" onClick={() => setShowDiscount(true)} disabled={cart.length === 0}>
                  {t('Add')}
                </Button>
              )
            )}
            {showDiscount && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={pill(discountType === 'PERCENT')}
                    onClick={() => {
                      setDiscountType('PERCENT');
                      setDiscountValue(0);
                    }}
                  >
                    {t('Percent (%)')}
                  </button>
                  <button
                    type="button"
                    className={pill(discountType === 'FIXED')}
                    onClick={() => {
                      setDiscountType('FIXED');
                      setDiscountValue(0);
                    }}
                  >
                    {t('Rupees (₹)')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(discountType === 'PERCENT' ? [5, 10, 15, 20, 30, 50] : [100, 250, 500, 1000]).map((v) => (
                    <button key={v} type="button" onClick={() => setDiscountValue(v)} className={pill(discountValue === v)}>
                      {discountType === 'PERCENT' ? `${v}%` : `₹${v}`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'PERCENT' ? 100 : subtotalAfterItemDisc}
                  value={discountValue || ''}
                  onChange={(e) =>
                    setDiscountValue(
                      discountType === 'PERCENT'
                        ? Math.min(100, Math.max(0, Number(e.target.value) || 0))
                        : Math.min(subtotalAfterItemDisc, Math.max(0, Number(e.target.value) || 0))
                    )
                  }
                  placeholder={discountType === 'PERCENT' ? t('Other %') : t('Other amount')}
                  aria-label={t('Discount')}
                  className="field h-11"
                />
                <Select
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  aria-label={t('Reason')}
                  options={DISCOUNT_REASONS.map((reason) => ({
                    value: reason,
                    label: reason === 'NONE' ? t('Reason (optional)') : reason === 'CUSTOM' ? t('Other reason…') : t(reason),
                  }))}
                />
                {discountReason === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder={t('Write the reason')}
                    value={customDiscountReason}
                    onChange={(e) => setCustomDiscountReason(e.target.value)}
                    className="field h-11"
                  />
                )}
                <button
                  type="button"
                  className="text-sm font-bold underline text-v26-muted"
                  onClick={() => {
                    setShowDiscount(false);
                    setDiscountValue(0);
                    setDiscountReason('NONE');
                    setCustomDiscountReason('');
                  }}
                >
                  {t('Remove discount')}
                </button>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="p-4 border-b border-v26-line space-y-1.5 text-base">
            <div className="flex justify-between">
              <span className="text-v26-muted">{t('Items ({n})', { n: totalItemCount })}</span>
              <span className="font-bold">{formatINR(grossSubtotal)}</span>
            </div>
            {totalDiscountAmount > 0 && (
              <div className="flex justify-between text-status-green font-bold">
                <span>{t('Discount')}</span>
                <span>−{formatINR(totalDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center gap-2">
              <span className="text-v26-muted flex flex-wrap items-center gap-2">
                GST {formatRate(taxRate)}%{customTaxRate !== null ? ` (${t('custom')})` : ''}
                {isOwner && !isEditingTax && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTaxInput(customTaxRate !== null ? String(customTaxRate) : '');
                      setIsEditingTax(true);
                    }}
                    className="text-sm font-bold underline text-v26-ink"
                  >
                    {t('Change %')}
                  </button>
                )}
                {isOwner && customTaxRate !== null && !isEditingTax && (
                  <button type="button" onClick={handleClearCustomTax} className="text-sm font-bold underline text-v26-ink">
                    {t('Normal GST')}
                  </button>
                )}
              </span>
              <span className="font-bold">{formatINR(taxAmount)}</span>
            </div>
            {isEditingTax && (
              <div className="flex items-center gap-2 p-2 border border-v26-ink">
                <span className="text-sm shrink-0">{t('GST % for this bill')}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  autoFocus
                  value={customTaxInput}
                  onChange={(e) => setCustomTaxInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomTax()}
                  className="field h-10 w-24"
                />
                <button type="button" onClick={handleApplyCustomTax} className="h-10 w-10 flex items-center justify-center bg-v26-ink text-white" aria-label={t('Save')}>
                  <Check size={18} />
                </button>
                <button type="button" onClick={() => setIsEditingTax(false)} className="h-10 w-10 flex items-center justify-center border border-v26-line" aria-label={t('Cancel')}>
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="flex justify-between text-sm text-v26-muted">
              <span>
                CGST {formatRate(taxRate / 2)}% + SGST {formatRate(taxRate / 2)}%
              </span>
              <span>
                {formatINR(splitCgstSgst(taxAmount).cgst)} + {formatINR(splitCgstSgst(taxAmount).sgst)}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t-2 border-v26-ink">
              <span className="text-lg font-bold">{t('Total to pay')}</span>
              <span className="text-3xl font-black">{formatINR(grandTotal)}</span>
            </div>
          </div>

          {/* 4. Payment */}
          <div className="p-4 space-y-3">
            {stepTitle(
              4,
              t('How did they pay?'),
              <button type="button" onClick={handleAddPaymentSplit} className="text-sm font-bold underline flex items-center gap-1">
                <Plus size={15} /> {t('Split payment')}
              </button>
            )}

            {paymentSplits.length === 1 ? (
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => handleSetSinglePaymentMethod(m)} className={`${pill(paymentSplits[0].method === m)} h-14 px-1`}>
                    {t(methodWord(m))}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {paymentSplits.map((split) => (
                  <div key={split.id} className="flex items-center gap-2">
                    <Select
                      value={split.method}
                      onChange={(e) => handleUpdateSplit(split.id, { method: e.target.value as Method })}
                      className="w-36 shrink-0"
                      aria-label={t('Paid by')}
                      options={METHODS.map((m) => ({ value: m, label: t(methodWord(m)) }))}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="₹"
                      value={split.amount || ''}
                      onChange={(e) => handleUpdateSplit(split.id, { amount: Number(e.target.value) || 0 })}
                      className="field h-11 flex-1 font-bold"
                      aria-label={t('Amount')}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePaymentSplit(split.id)}
                      className="h-11 w-11 flex items-center justify-center text-v26-muted hover:text-status-red"
                      aria-label={t('Remove')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between text-base">
                  <span className="text-v26-muted">{t('Paid so far')}</span>
                  <span className="font-bold">{formatINR(amountPaid)}</span>
                </div>
              </div>
            )}

            {cashSplit && (
              <div className="p-3 bg-v26-soft space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="cash-received" className="text-base">
                    {t('Cash received')}
                  </label>
                  <input
                    id="cash-received"
                    type="number"
                    inputMode="numeric"
                    placeholder={String(cashAmountExpected)}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="field h-11 w-36 text-right font-bold"
                  />
                </div>
                {numCashTendered > 0 && !cashShort && (
                  <div className="flex items-center justify-between text-lg font-black text-status-green">
                    <span>{t('Give back')}</span>
                    <span>{formatINR(changeToReturn)}</span>
                  </div>
                )}
                {cashShort && <div className="text-base font-bold text-status-red">{t('Cash received is less than the cash amount')}</div>}
              </div>
            )}

            {remainingDue > 0 && cart.length > 0 && (
              <div className="flex items-center justify-between text-base font-bold text-status-red bg-status-redBg p-3 border border-status-redBorder">
                <span className="flex items-center gap-2">
                  <AlertCircle size={18} /> {t('Still to pay')}
                </span>
                <span>{formatINR(remainingDue)}</span>
              </div>
            )}
            {overPaid > 0 && (
              <div className="text-base font-bold text-status-red">{t('Payment is more than the bill by {amount}', { amount: formatINR(overPaid) })}</div>
            )}

            <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-v26-paper border-t border-v26-line space-y-2">
              <button
                type="button"
                disabled={!canSettle}
                onClick={() => void handleCompletePayment(true)}
                className="w-full h-16 bg-v26-red text-white text-lg font-bold hover:bg-v26-red-dark disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isProcessingPayment ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    {t('Saving…')}
                  </>
                ) : (
                  <>
                    <Printer size={22} />
                    {t('Save & print bill')} · {formatINR(grandTotal)}
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!canSettle}
                onClick={() => void handleCompletePayment(false)}
                className="w-full h-12 border border-v26-line hover:border-v26-ink text-base font-bold disabled:opacity-30"
              >
                {t('Save without printing')}
              </button>
              <div className="text-xs text-center text-v26-muted hidden lg:block">F2 · F4</div>
            </div>
          </div>
        </div>
      </div>

      {/* Colour & size picker */}
      {activeVariantProduct && (
        <Modal
          isOpen
          onClose={() => {
            setActiveVariantProduct(null);
            setPickerColor(null);
          }}
          title={activeVariantProduct.name}
          subtitle={productColors(activeVariantProduct).length > 1 ? t('Choose colour, then size') : t('Choose size')}
          maxWidth="lg"
        >
          <div className="space-y-5">
            {productColors(activeVariantProduct).length > 1 && (
              <div>
                <div className="label mb-2">1. {t('Colour')}</div>
                <div className="flex flex-wrap gap-2">
                  {productColors(activeVariantProduct).map((c) => {
                    const colourStock = activeVariantProduct.variants.filter((v) => v.color === c).reduce((sum, v) => sum + v.stock, 0);
                    return (
                      <button
                        key={c || 'none'}
                        type="button"
                        onClick={() => setPickerColor(c)}
                        className={`px-4 py-2.5 border text-left ${
                          pickerColor === c ? 'bg-v26-ink text-white border-v26-ink' : 'border-v26-line hover:border-v26-ink'
                        } ${colourStock <= 0 ? 'opacity-50' : ''}`}
                      >
                        <div className="text-base font-bold">{c || t('No colour')}</div>
                        <div className="text-sm">{colourStock <= 0 ? t('Sold out') : t('{n} in stock', { n: colourStock })}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="label mb-2">{productColors(activeVariantProduct).length > 1 ? `2. ${t('Size')}` : t('Size')}</div>
              {productColors(activeVariantProduct).length > 1 && pickerColor === null ? (
                <div className="p-4 border border-dashed border-v26-line text-base text-v26-muted">{t('Choose a colour first.')}</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {activeVariantProduct.variants
                    .filter((v) => productColors(activeVariantProduct).length <= 1 || v.color === pickerColor)
                    .map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        disabled={v.stock <= 0}
                        onClick={() => handleAddVariantToCart(activeVariantProduct, v)}
                        className="p-3 border border-v26-line hover:border-v26-ink hover:bg-v26-soft disabled:opacity-30 flex flex-col items-center gap-1"
                      >
                        <span className="text-2xl font-black">{sizeText(v.size)}</span>
                        <span className="text-sm">{formatINR(v.price)}</span>
                        <span
                          className={`text-sm font-bold px-1.5 ${
                            v.stock <= 0 ? 'text-status-red' : v.stock <= settings.lowStockThreshold ? 'text-status-amber' : 'text-v26-muted'
                          }`}
                        >
                          {v.stock <= 0 ? t('Sold out') : t('{n} in stock', { n: v.stock })}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Bill saved */}
      {receiptOrder && (
        <Modal isOpen onClose={() => setReceiptOrder(null)} title={t('Bill saved')} subtitle={receiptOrder.orderNumber}>
          <div className="space-y-4">
            {printError && (
              <div className="p-3 bg-status-amberBg border border-status-amberBorder text-status-amber text-base font-bold flex items-center gap-2">
                <AlertCircle size={18} /> {printError} {t('The bill is saved.')}
              </div>
            )}
            <div className="text-center py-2">
              <div className="text-4xl font-black">{formatINR(receiptOrder.grandTotal)}</div>
              <div className="text-base text-v26-muted mt-1">
                {receiptOrder.items.reduce((s, i) => s + i.quantity, 0)} {t('pieces')} ·{' '}
                {receiptOrder.paymentSplits && receiptOrder.paymentSplits.length > 1
                  ? receiptOrder.paymentSplits.map((s) => `${t(methodWord(s.method))} ${formatINR(s.amount)}`).join(' + ')
                  : t(methodWord(receiptOrder.paymentMethod))}
              </div>
              {!!receiptOrder.changeAmount && receiptOrder.changeAmount > 0 && (
                <div className="text-xl font-black text-status-green mt-2">
                  {t('Give back')} {formatINR(receiptOrder.changeAmount)}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="secondary" icon={<Printer size={18} />} onClick={() => void doPrint(receiptOrder, 'SLIP')} disabled={isPrinting}>
                {isPrinting ? t('Printing…') : t('Print bill')}
              </Button>
              <Button variant="secondary" icon={<FileText size={18} />} onClick={() => void doPrint(receiptOrder, 'TAX_INVOICE')} disabled={isPrinting}>
                {t('Print GST invoice (A4)')}
              </Button>
            </div>
            <Button variant="primary" size="lg" fullWidth icon={<ArrowRight size={20} />} iconPosition="right" onClick={() => setReceiptOrder(null)}>
              {t('Next bill')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Item discount */}
      {itemDiscountTarget && (
        <Modal
          isOpen
          onClose={() => setItemDiscountTarget(null)}
          title={t('Discount on this item')}
          subtitle={`${itemDiscountTarget.product.name} · ${[itemDiscountTarget.variant.color, sizeText(itemDiscountTarget.variant.size)]
            .filter(Boolean)
            .join(' / ')} · ${itemDiscountTarget.quantity} × ${formatINR(itemDiscountTarget.variant.price)}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setItemDiscType('PERCENT')} className={pill(itemDiscType === 'PERCENT')}>
                {t('Percent (%)')}
              </button>
              <button type="button" onClick={() => setItemDiscType('FIXED')} className={pill(itemDiscType === 'FIXED')}>
                {t('Rupees (₹)')}
              </button>
            </div>
            <input
              type="number"
              min="0"
              max={itemDiscType === 'PERCENT' ? 100 : itemDiscountTarget.variant.price * itemDiscountTarget.quantity}
              value={itemDiscVal || ''}
              onChange={(e) => setItemDiscVal(Number(e.target.value) || 0)}
              aria-label={t('Discount')}
              className="field h-12 text-lg font-bold"
              autoFocus
            />
            <input
              type="text"
              value={itemDiscReason}
              onChange={(e) => setItemDiscReason(e.target.value)}
              placeholder={t('Reason (optional)')}
              className="field h-11"
            />
            {(() => {
              const { lineGross, amt } = itemDiscPreview(itemDiscountTarget);
              return (
                <div className="p-3 bg-status-greenBg border border-status-greenBorder text-status-green text-base space-y-1">
                  <div className="flex justify-between">
                    <span>{t('Discount')}</span>
                    <span className="font-bold">−{formatINR(amt)}</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span>{t('New price for this line')}</span>
                    <span>{formatINR(Math.max(0, lineGross - amt))}</span>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {itemDiscountTarget.itemDiscount ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    handleRemoveItemDiscount(itemDiscountTarget.variant.id);
                    setItemDiscountTarget(null);
                  }}
                >
                  {t('Remove discount')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setItemDiscountTarget(null)}>
                  {t('Cancel')}
                </Button>
                <Button variant="primary" onClick={handleApplyItemDiscount}>
                  {t('Apply')}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear bill */}
      <Modal
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('Clear this bill?')}
        subtitle={t('{n} items will be removed. Nothing has been charged yet.', { n: totalItemCount })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              {t('Keep items')}
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                resetBill();
                setConfirmClear(false);
              }}
            >
              {t('Yes, clear')}
            </Button>
          </>
        }
      >
        <span />
      </Modal>
    </div>
  );
};
