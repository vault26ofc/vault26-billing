import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { formatINR } from '../../utils/formatters';
import { BarcodeSvg } from '../../components/common/BarcodeSvg';
import { BillQr } from '../../components/common/BillQr';
import { splitCgstSgst, formatRate } from '../../utils/tax';
import { variantLabel } from '../../utils/singleItem';
import { ArrowLeft, Printer, FileText, Ban } from 'lucide-react';
import { useT } from '../../i18n';
import { methodWord, paymentWord } from '../../utils/paymentWords';
import { printBill } from '../../utils/printBill';

export const BillDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, settings, currentStaff } = useStore();
  const t = useT();
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const canVoid = currentStaff?.permissions.includes('BILLS');

  const bill = orders.find((o) => o.id === id || o.orderNumber === id);

  if (!bill) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="font-display text-3xl">{t('Bill not found')}</h2>
        <p className="text-base text-v26-muted">{t('This bill does not exist.')}</p>
        <Button variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => navigate('/bills')}>
          {t('Back to bills')}
        </Button>
      </div>
    );
  }

  const handlePrint = async (kind: 'SLIP' | 'TAX_INVOICE') => {
    const ok = await printBill(bill, settings, kind);
    if (!ok) store.addToast(t('Could not open printing'), t('Please try again.'), 'error');
  };

  // Always the rate this bill was actually charged, never today's settings.
  const billTaxRate = bill.taxRate ?? 0;
  const { cgst, sgst } = splitCgstSgst(bill.taxAmount);
  const itemCount = bill.items.reduce((s, i) => s + i.quantity, 0);

  const handleVoidBill = async () => {
    if (!voidReason.trim()) {
      store.addToast(t('Write a reason'), t('A reason is needed to cancel a bill.'), 'error');
      return;
    }
    setIsVoiding(true);
    try {
      await store.voidBill(bill.id, voidReason.trim());
      setVoidOpen(false);
      setVoidReason('');
    } catch (err) {
      store.addToast(t('Could not cancel the bill'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className={`flex justify-between gap-4 ${strong ? 'text-xl font-black border-t border-v26-ink pt-2 mt-1' : 'text-base'}`}>
      <span className={strong ? '' : 'text-v26-muted'}>{label}</span>
      <span className={strong ? '' : 'font-bold'}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate('/bills')}>
            {t('Bills')}
          </Button>
          <h1 className="font-display text-2xl sm:text-3xl">{bill.orderNumber}</h1>
          <StatusBadge status={bill.billStatus === 'VOID' ? 'VOID' : bill.paymentStatus} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<Printer size={18} />} onClick={() => handlePrint('SLIP')}>
            {t('Print bill')}
          </Button>
          <Button variant="secondary" icon={<FileText size={18} />} onClick={() => handlePrint('TAX_INVOICE')}>
            {t('Print GST invoice (A4)')}
          </Button>
          {canVoid && bill.billStatus !== 'VOID' && (
            <Button variant="danger" icon={<Ban size={18} />} onClick={() => setVoidOpen(true)} disabled={isVoiding}>
              {t('Cancel bill')}
            </Button>
          )}
        </div>
      </div>

      {bill.billStatus === 'VOID' && (
        <div className="border border-status-redBorder bg-status-redBg text-status-red p-4 text-base font-bold">
          {t('This bill was cancelled. Its items went back into stock.')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2">
          <div className="px-5 py-4 border-b border-v26-line flex flex-wrap justify-between gap-2">
            <div>
              <div className="label">{t('Customer')}</div>
              <div className="text-lg font-bold">
                {bill.customerName === 'Walk-in Customer' ? t('Walk-in customer') : bill.customerName}
              </div>
              {bill.customerPhone && <div className="text-base text-v26-muted">{bill.customerPhone}</div>}
              {bill.customerGstin && <div className="text-base font-bold">GSTIN: {bill.customerGstin}</div>}
            </div>
            <div className="text-left sm:text-right">
              <div className="label">{t('Date')}</div>
              <div className="text-base font-bold">{bill.createdAt}</div>
              {bill.staffName && (
                <div className="text-base text-v26-muted">
                  {t('Billed by')}: {bill.staffName}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-base border-collapse">
              <thead>
                <tr>
                  <th className="table-head py-3 px-5">{t('Item')}</th>
                  <th className="table-head py-3 px-3 text-center">{t('Qty')}</th>
                  <th className="table-head py-3 px-3 text-right">{t('Price')}</th>
                  <th className="table-head py-3 px-5 text-right">{t('Amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {bill.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-5">
                      <div className="font-bold">{item.name}</div>
                      {variantLabel(item.size, item.color) && (
                        <div className="text-sm text-v26-muted">{variantLabel(item.size, item.color)}</div>
                      )}
                      {!!item.itemDiscount && (
                        <div className="text-sm text-status-green font-bold">
                          {t('Discount')} −{formatINR(item.itemDiscount)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">{item.quantity}</td>
                    <td className="py-3 px-3 text-right">{formatINR(item.unitPrice)}</td>
                    <td className="py-3 px-5 text-right font-bold">{formatINR(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-v26-line flex justify-end">
            <div className="w-full sm:w-80 space-y-1.5">
              {row(t('Items ({n})', { n: itemCount }), formatINR(bill.subtotal))}
              {bill.discount > 0 &&
                row(
                  `${t('Discount')}${bill.discountReason ? ` (${bill.discountReason})` : ''}`,
                  <span className="text-status-green">−{formatINR(bill.discount)}</span>
                )}
              {row(t('Taxable value'), formatINR(bill.subtotal - bill.discount))}
              {row(`CGST (${formatRate(billTaxRate / 2)}%)`, formatINR(cgst))}
              {row(`SGST (${formatRate(billTaxRate / 2)}%)`, formatINR(sgst))}
              {bill.shippingFee > 0 && row(t('Delivery charge'), formatINR(bill.shippingFee))}
              {bill.taxIsCustom && <div className="text-sm text-v26-muted">{t('Custom tax rate set by the owner')}</div>}
              {row(t('Total'), formatINR(bill.grandTotal), true)}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5 space-y-2">
            <div className="section-title">{t('Payment')}</div>
            <div className="text-lg font-bold">{t(paymentWord(bill))}</div>
            {bill.paymentSplits && bill.paymentSplits.length > 1 &&
              bill.paymentSplits.map((s, idx) => (
                <div key={idx} className="flex justify-between text-base">
                  <span className="text-v26-muted">{t(methodWord(s.method))}</span>
                  <span className="font-bold">{formatINR(s.amount)}</span>
                </div>
              ))}
            {!!bill.changeAmount && bill.changeAmount > 0 && (
              <div className="flex justify-between text-base text-status-green font-bold">
                <span>{t('Change given')}</span>
                <span>{formatINR(bill.changeAmount)}</span>
              </div>
            )}
            {bill.notes && (
              <div className="pt-2 border-t border-v26-line text-base">
                <span className="text-v26-muted">{t('Note')}: </span>
                {bill.notes}
              </div>
            )}
          </div>

          <div className="card p-5 flex flex-col items-center gap-4">
            <BarcodeSvg value={bill.orderNumber} width={200} height={34} />
            <BillQr bill={{ ...bill, storeName: settings.brand || settings.storeName, gstin: settings.gstin }} />
          </div>
        </div>
      </div>

      <Modal
        isOpen={voidOpen}
        onClose={() => setVoidOpen(false)}
        title={t('Cancel bill {no}?', { no: bill.orderNumber })}
        subtitle={t('All {n} items go back into stock. This cannot be undone.', { n: itemCount })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidOpen(false)}>
              {t('Keep the bill')}
            </Button>
            <Button variant="accent" icon={<Ban size={18} />} onClick={handleVoidBill} disabled={isVoiding}>
              {isVoiding ? t('Cancelling…') : t('Yes, cancel bill')}
            </Button>
          </>
        }
      >
        <label className="label mb-1.5" htmlFor="void-reason">
          {t('Why is this bill being cancelled?')}
        </label>
        <textarea
          id="void-reason"
          rows={3}
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          className="field"
          autoFocus
        />
      </Modal>
    </div>
  );
};
