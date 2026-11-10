export function formatINR(amount: number): string {
  if (isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

const IST = 'Asia/Kolkata';

// Bill times are kept as "YYYY-MM-DD HH:mm:ss" in IST (see toIstDateTime). A
// time with no zone on it is read as IST, never as UTC or the device's zone.
function parseTimestamp(value: string): Date {
  const v = value.trim();
  const naive = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(:\d{2})?)?$/.exec(v);
  if (naive) return new Date(`${naive[1]}T${naive[2] ?? '00:00'}${naive[3] ?? ':00'}+05:30`);
  return new Date(v);
}

/** A timestamp as "YYYY-MM-DD HH:mm:ss" in IST — how every bill time is shown and compared. */
export function toIstDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? parseTimestamp(value) : value;
  if (isNaN(d.getTime())) return typeof value === 'string' ? value : '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: IST,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((part) => [part.type, part.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** Today's date in IST, "YYYY-MM-DD" — the shop's day starts at midnight IST. */
export function istToday(): string {
  return toIstDateTime(new Date()).substring(0, 10);
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const d = parseTimestamp(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      timeZone: IST,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateTimeString?: string): string {
  if (!dateTimeString) return '—';
  try {
    const d = parseTimestamp(dateTimeString);
    if (isNaN(d.getTime())) return dateTimeString;
    return d.toLocaleDateString('en-GB', {
      timeZone: IST,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateTimeString;
  }
}

export function getStatusTheme(status: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status.toUpperCase().replace(/\s+/g, '_')) {
    case 'PAID':
    case 'DELIVERED':
    case 'SUCCESS':
    case 'IN_STOCK':
    case 'VIP':
    case 'ONLINE':
    case 'ACTIVE':
    case 'APPROVED':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };

    case 'UNFULFILLED':
    case 'PROCESSING':
    case 'PENDING':
    case 'PACKED':
    case 'SHIPPED':
    case 'IN_TRANSIT':
    case 'HIGH_VALUE':
    case 'LOW_STOCK':
    case 'REQUESTED':
    case 'RECEIVED':
    case 'INSPECTED':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      };

    case 'CANCELLED':
    case 'REFUNDED':
    case 'FAILED':
    case 'OUT_OF_STOCK':
    case 'AT_RISK':
    case 'REJECTED':
    case 'OFFLINE':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-800',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      };

    case 'RETURNED':
    case 'EXCHANGED':
      return {
        bg: 'bg-status-blueBg',
        text: 'text-status-blue',
        border: 'border-status-blueBorder',
        dot: 'bg-status-blue',
      };

    case 'DRAFT':
    case 'ARCHIVED':
    case 'NEW':
    default:
      return {
        bg: 'bg-zinc-100',
        text: 'text-zinc-700',
        border: 'border-zinc-300',
        dot: 'bg-zinc-400',
      };
  }
}

// Plain words for every status code the app shows (then translated by tr()).
const STATUS_WORDS: Record<string, string> = {
  PAID: 'Paid',
  PENDING: 'Pending',
  REFUNDED: 'Refunded',
  FAILED: 'Failed',
  SUCCESS: 'Done',
  COMPLETED: 'Done',
  VOID: 'Cancelled',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
  EXCHANGED: 'Exchanged',
  DELIVERED: 'Delivered',
  UNFULFILLED: 'Not handed over',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'On the way',
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  RECEIVED: 'Received',
  INSPECTED: 'Checked',
  REJECTED: 'Rejected',
  ACTIVE: 'Active',
  ARCHIVED: 'Hidden',
  DRAFT: 'Draft',
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  ONLINE: 'Online',
  OFFLINE: 'Off',
  VIP: 'VIP',
  HIGH_VALUE: 'Big buyer',
  NEW: 'New',
  AT_RISK: 'Not visiting',
  STORE_ONLY: 'Store only',
};

export function statusLabel(status: string): string {
  const key = status.toUpperCase().replace(/\s+/g, '_');
  return STATUS_WORDS[key] || status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}
