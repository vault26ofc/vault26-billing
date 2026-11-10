# Vault 26 Billing

Shop billing for Vault 26. It uses the same database as vault26.co.in, so products, prices and stock are always the same in the shop and on the website.

**What it does**

- **New bill** – pick items by colour and size (or scan the barcode), add a discount, take cash / UPI / card / split payment, print the bill (80 mm) or an A4 GST invoice.
- **All bills** – shop bills and delivered website orders; reprint or cancel a shop bill (stock goes back).
- **Products & stock** – stock for every colour and size, add or remove pieces, stock history. New products are added only in the Vault 26 website admin.
- **Customers** – name and phone, their bills, optional GSTIN for business customers.
- **Price tags** – hang tag, sticker or box label with barcode, printed in batches.
- **Check sales** – shop vs website, the cash count for the drawer, discounts per staff member, printable report.
- **Monthly GST report** – one PDF with every shop bill and delivered website order of the month, CGST / SGST / IGST totals.
- **Settings & staff** – GST slab, printer, staff logins (username + password) and what each person can open. The owner can also change a saved bill.
- **English / తెలుగు** switch on every screen (printed bills stay in English).

**Store only products** – tick "Store only" on a product in the Vault 26 admin. It can be billed here but is never shown or sold on the website.

## Bill numbers

- Shop bills: `V26S-YYMM-0001` (restarts every month)
- Website invoices: `V26W-YYMM-0001`, given when the order is delivered

Numbers come from the database, so there are no gaps.

## Set up

1. **Database** (Supabase SQL editor), in this order:
   1. `db/migrations/0001_staff_role.sql`
   2. `db/migrations/0002_pos_schema.sql`
   3. the website repo's `supabase/migrations/20261110010000_store_only_products.sql`
   4. `db/first_owner.sql` (follow the steps written inside it)
2. **Business details** – Vault 26 admin → Invoice template. The shop address and phone are filled in by `0002`; add the **GSTIN** there before giving GST bills.
3. **App**
   ```bash
   cp .env.example .env   # fill in the two values from the website's .env
   npm ci
   npm run dev            # local
   npm run build          # for hosting (dist/)
   ```
   `vercel.json` is included for Vercel hosting (set the same two variables there).

## Code map

- `src/pages/` – one folder per screen
- `src/api/pos.ts` – shop data (bills, customers, staff, stock); `src/api/website.ts` – website orders and the Invoice template; `src/api/monthlyReport.ts` – GST report data
- `src/services/store.ts` – the app's shared state
- `src/i18n/` – the language switch; `te.ts` holds every Telugu sentence (the English sentence is the key)
- `src/utils/receiptPrinter.ts`, `src/utils/monthlyReportPdf.ts` – printed bills and the monthly PDF
- `db/migrations/` – database changes for billing (all new objects start with `pos_`)
