-- db/migrations/0001_staff_role.sql
-- Vault 26 accounts were only 'admin' or 'customer'. Billing cashiers get a
-- third role, 'staff': they can sign in to the billing app but are NOT
-- admins, so the Vault 26 website admin panel stays closed to them.
--
-- This must run on its own, BEFORE 0002: Postgres only lets a new enum value
-- be used after the statement that adds it has been committed.

alter type public.app_role add value if not exists 'staff';
