// Products, prices, photos and colour x size stock are created only in the
// Vault 26 website admin, so the billing app links there instead of keeping
// its own product form. (The admin edits a product in a side panel on the
// Products list, so there is no separate URL per product.)
export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL as string | undefined) || 'https://vault26.co.in';
export const WEBSITE_ADMIN_PRODUCTS_URL = `${WEBSITE_URL}/admin/products`;
export const WEBSITE_ADMIN_INVOICE_URL = `${WEBSITE_URL}/admin/invoice-template`;
