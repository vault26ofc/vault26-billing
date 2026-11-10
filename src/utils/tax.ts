import { CommerceSettings } from '../types';

// Mirrors public.pos_slab_tax_rate() in the database, which is authoritative -
// this copy only drives the live preview on screen before the bill is saved.
export function slabTaxRate(
  taxableAmount: number,
  settings: Pick<CommerceSettings, 'taxThreshold' | 'taxRateLow' | 'taxRateHigh'>
): number {
  return taxableAmount <= settings.taxThreshold ? settings.taxRateLow : settings.taxRateHigh;
}

export function taxFor(taxableAmount: number, rate: number): number {
  return Math.round((taxableAmount * rate) / 100);
}

// Intra-state supply splits evenly into CGST + SGST; half of an odd paisa
// goes to CGST so the two always add back up to the whole tax.
export function splitCgstSgst(taxAmount: number): { cgst: number; sgst: number } {
  const cgst = Math.round((taxAmount / 2) * 100) / 100;
  return { cgst, sgst: Math.round((taxAmount - cgst) * 100) / 100 };
}

export function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/0+$/, '');
}
