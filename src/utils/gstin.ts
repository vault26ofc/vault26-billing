// Indian GSTIN: 2-digit state code, 10-char PAN, entity number, 'Z', checksum.
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const normalizeGstin = (s: string) => s.replace(/\s+/g, '').toUpperCase();

export const isValidGstin = (s: string) => GSTIN_RE.test(normalizeGstin(s));
