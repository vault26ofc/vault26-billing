import React, { useEffect, useState } from 'react';
import { store } from '../../services/store';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { MetricBlock } from '../../components/ui/MetricBlock';
import { formatINR } from '../../utils/formatters';
import { formatRate } from '../../utils/tax';
import { fetchMonthlyData, fetchInvoiceIdentity, totalsFor, MonthlyData, STORE_STATE_MISSING } from '../../api/monthlyReport';
import { buildMonthlyReportPdf } from '../../utils/monthlyReportPdf';
import { Download, RefreshCw, Store, Globe } from 'lucide-react';
import { useT } from '../../i18n';
import { WEBSITE_ADMIN_INVOICE_URL } from '../../constants/website';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Current month/year in the shop's timezone (IST), not the device's.
function nowIst(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .split('-');
  return { year: Number(parts[0]), month: Number(parts[1]) };
}

export const MonthlyBillsPage: React.FC = () => {
  const t = useT();
  const current = nowIst();
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missingState, setMissingState] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => current.year - i);
  const isFuture = year > current.year || (year === current.year && month > current.month);
  // The PDF itself is in English (GST records); the screen follows the language switch.
  const pdfMonthLabel = `${MONTHS[month - 1]} ${year}`;
  const monthLabel = `${t(MONTHS[month - 1])} ${year}`;

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    setMissingState(false);
    try {
      setData(await fetchMonthlyData(year, month));
    } catch (err) {
      setData(null);
      setMissingState(err instanceof Error && err.name === STORE_STATE_MISSING);
      setLoadError(err instanceof Error ? err.message : t('Could not load this month.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFuture) {
      setData(null);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const handleDownload = async () => {
    if (!data) return;
    setIsGenerating(true);
    try {
      // Re-fetch so the PDF matches the database at the moment of download.
      const [fresh, identity] = await Promise.all([fetchMonthlyData(year, month), fetchInvoiceIdentity()]);
      setData(fresh);
      const doc = buildMonthlyReportPdf(fresh, identity, pdfMonthLabel);
      doc.save(`Vault26_GST_Report_${year}-${String(month).padStart(2, '0')}.pdf`);
      store.addToast(
        t('PDF downloaded'),
        t('{a} shop bills + {b} website invoices', { a: fresh.offline.length, b: fresh.online.length }),
        'success'
      );
    } catch (err) {
      store.addToast(t('PDF not made'), err instanceof Error ? err.message : undefined, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const offline = data ? totalsFor(data.offline) : null;
  const online = data ? totalsFor(data.online) : null;
  const register = data ? [...data.offline, ...data.online] : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">{t('Monthly GST report')}</h1>
        <p className="text-base text-v26-muted mt-1">
          {t('One PDF with every bill of the month (shop + delivered website orders) and the GST totals.')}
        </p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="sm:w-52">
          <Select
            label={t('Month')}
            value={String(month)}
            onChange={(e) => setMonth(Number(e.target.value))}
            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: t(m) }))}
          />
        </div>
        <div className="sm:w-36">
          <Select
            label={t('Year')}
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="secondary" icon={<RefreshCw size={18} />} onClick={load} disabled={isLoading || isFuture}>
            {t('Refresh')}
          </Button>
          <Button
            variant="primary"
            icon={<Download size={18} />}
            onClick={handleDownload}
            disabled={!data || isLoading || isGenerating || register.length === 0}
          >
            {isGenerating ? t('Making PDF…') : t('Download PDF')}
          </Button>
        </div>
      </div>

      {isFuture && <div className="card p-4 text-base text-v26-muted">{t('{m} has not started yet.', { m: monthLabel })}</div>}

      {loadError && (
        <div className="p-4 border border-status-redBorder bg-status-redBg text-base text-status-red space-y-2">
          <div className="font-bold">{loadError}</div>
          {missingState && (
            <a href={WEBSITE_ADMIN_INVOICE_URL} target="_blank" rel="noopener" className="underline font-bold">
              {t('Open the Invoice template')}
            </a>
          )}
        </div>
      )}

      {isLoading && <div className="text-base text-v26-muted">{t('Loading {m}…', { m: monthLabel })}</div>}

      {data && offline && online && !isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricBlock
              label={t('Shop bills')}
              value={offline.count}
              subtext={`${formatINR(offline.total)}${data.voided.length > 0 ? ` · ${t('{n} cancelled', { n: data.voided.length })}` : ''}`}
            />
            <MetricBlock label={t('Website invoices')} value={online.count} subtext={formatINR(online.total)} />
            <MetricBlock label={t('Total sales')} value={formatINR(offline.total + online.total)} subtext={monthLabel} />
            <MetricBlock
              label={t('GST collected')}
              value={formatINR(offline.tax + online.tax)}
              subtext={t('on {amount} taxable', { amount: formatINR(offline.taxable + online.taxable) })}
            />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr>
                  <th className="table-head py-3 px-4">{t('Bill no.')}</th>
                  <th className="table-head py-3 px-4">{t('Date')}</th>
                  <th className="table-head py-3 px-4">{t('Sold in')}</th>
                  <th className="table-head py-3 px-4">{t('Customer')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('GST %')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('GST')}</th>
                  <th className="table-head py-3 px-4 text-right">{t('Total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v26-line">
                {register.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-v26-muted">
                      {t('No bills in {m}.', { m: monthLabel })}
                    </td>
                  </tr>
                ) : (
                  register.map((inv) => (
                    <tr key={`${inv.channel}-${inv.id}`}>
                      <td className="py-2.5 px-4 font-bold whitespace-nowrap">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-4 text-v26-muted whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {inv.channel === 'OFFLINE' ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Store size={16} /> {t('Shop')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-status-blue">
                            <Globe size={16} /> {t('Website')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">{inv.customerName === 'Walk-in Customer' ? t('Walk-in customer') : inv.customerName}</td>
                      <td className="py-2.5 px-4 text-right">
                        {formatRate(inv.taxRate)}%{inv.taxIsCustom ? ` (${t('custom')})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right">{formatINR(inv.taxAmount)}</td>
                      <td className="py-2.5 px-4 text-right font-bold">{formatINR(inv.grandTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
