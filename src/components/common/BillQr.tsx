import React, { useMemo } from 'react';
import { billQrSvg, BillQrInput } from '../../utils/billQr';
import { useT } from '../../i18n';

// Full-bill QR (scan with any phone camera to read the whole bill offline).
// Sits alongside the bill-number barcode, which stays for counter scanners.
export const BillQr: React.FC<{ bill: BillQrInput; size?: number }> = ({ bill, size = 170 }) => {
  const t = useT();
  const svg = useMemo(() => billQrSvg(bill, size), [bill, size]);
  if (!svg) return null;
  return (
    <div className="flex flex-col items-center select-none">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="text-sm text-v26-muted mt-1">{t('Scan for full bill')}</span>
    </div>
  );
};
