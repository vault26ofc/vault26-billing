// Job names in plain words (translated with tr() where shown).
export function roleWord(role: string): string {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'MANAGER':
      return 'Manager';
    case 'BILLING':
      return 'Cashier';
    case 'FULFILLMENT':
      return 'Packing staff';
    default:
      return role;
  }
}
