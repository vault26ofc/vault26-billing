// The 4 real POS roles backed by the pos_role DB enum. StaffRole (app-wide
// type) also has a legacy 'ADMIN' value that has no DB-level POS role.
export type DbStaffRole = 'OWNER' | 'MANAGER' | 'BILLING' | 'FULFILLMENT';

export type PermissionKey =
  | 'DASHBOARD'
  | 'BILLING'
  | 'BILLS'
  | 'TAGS'
  | 'AUDIT'
  | 'MONTHLY_BILLS'
  | 'PRODUCTS'
  | 'CUSTOMERS'
  | 'SETTINGS';

export const ALL_PERMISSIONS: PermissionKey[] = [
  'DASHBOARD',
  'BILLING',
  'BILLS',
  'TAGS',
  'AUDIT',
  'MONTHLY_BILLS',
  'PRODUCTS',
  'CUSTOMERS',
  'SETTINGS',
];

// Plain words for each screen (translated with tr() where shown).
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  DASHBOARD: 'Home',
  BILLING: 'Make new bills',
  BILLS: 'See and cancel bills',
  TAGS: 'Print price tags',
  AUDIT: 'Check sales',
  MONTHLY_BILLS: 'Monthly GST report',
  PRODUCTS: 'Products & stock',
  CUSTOMERS: 'Customers',
  SETTINGS: 'Settings & staff',
};

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<DbStaffRole, PermissionKey[]> = {
  OWNER: [...ALL_PERMISSIONS],
  MANAGER: ['DASHBOARD', 'BILLING', 'BILLS', 'TAGS', 'AUDIT', 'MONTHLY_BILLS', 'PRODUCTS', 'CUSTOMERS'],
  BILLING: ['DASHBOARD', 'BILLING', 'BILLS', 'CUSTOMERS'],
  FULFILLMENT: ['DASHBOARD', 'BILLS'],
};

// user_roles is the database access gate. 'staff' can use the billing app
// only; OWNER/MANAGER get 'admin' (they can also open the Vault 26 website
// admin, and only admins can create or change staff logins).
export function dbRoleForStaffRole(role: DbStaffRole): 'admin' | 'staff' {
  return role === 'OWNER' || role === 'MANAGER' ? 'admin' : 'staff';
}
