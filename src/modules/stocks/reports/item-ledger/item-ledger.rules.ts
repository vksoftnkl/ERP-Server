import { Prisma } from '@prisma/client';
import type { DocKind, PartyRef, RowKind } from './types/item-ledger.types';

/**
 * The pure half of the Item Ledger (plan 2026-11-11 §5.3): report types and
 * their words, the party label of a counter bill, which screen a row opens,
 * the unit conversion and the number formats. No database here, so the specs
 * pin every rule without a fixture.
 */

type Dec = Prisma.Decimal;
type Num = Dec | string | number;

export const STOCK_BUCKETS = ['SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE'] as const;
export const BUCKET_CHOICES = [...STOCK_BUCKETS, 'ALL'] as const;
export type BucketChoice = (typeof BUCKET_CHOICES)[number];

export const VALUE_AT = ['WITHOUT_TAX', 'WITH_TAX'] as const;
export type ValueAt = (typeof VALUE_AT)[number];

export const ORDERS = ['asc', 'desc'] as const;
export type Order = (typeof ORDERS)[number];

/** The words a bucket goes by. */
export const BUCKET_LABEL: Readonly<Record<string, string>> = {
  SALEABLE: 'Saleable',
  DAMAGED: 'Damaged',
  QUARANTINE: 'Quarantine',
  EXPIRED: 'Expired',
  SAMPLE: 'Sample',
};

export function bucketLabel(bucket: string | null | undefined): string {
  return bucket ? (BUCKET_LABEL[bucket] ?? bucket) : '';
}

interface ReportTypeDef {
  label: string;
  /** The kind a row of this type normally has; MIXED = depends on the leg. */
  kind: RowKind | 'MIXED';
  /** The tile's plural word. */
  tile: string;
}

/**
 * §5.3 — one definition, shared later by the Stock Summary. The SQL side of the
 * mapping is `reportTypeCase` in item-ledger.sql.ts; the codes here are the
 * codes it yields, and the `types` filter accepts exactly these.
 */
export const REPORT_TYPES = {
  OPENING: { label: 'Opening stock', kind: 'IN', tile: 'opening' },
  GRN: { label: 'GRN', kind: 'IN', tile: 'GRNs' },
  PURCHASE: { label: 'Purchase', kind: 'IN', tile: 'purchases' },
  SHORTAGE_RECEIPT: { label: 'Shortage receipt', kind: 'IN', tile: 'shortage receipts' },
  PURCHASE_RETURN: { label: 'Purchase return', kind: 'OUT', tile: 'purchase returns' },
  SALE: { label: 'Sale', kind: 'OUT', tile: 'sales' },
  SALE_RETURN: { label: 'Sale return', kind: 'IN', tile: 'sale returns' },
  DC: { label: 'Delivery challan', kind: 'OUT', tile: 'challans' },
  DC_RETURN: { label: 'Challan return', kind: 'IN', tile: 'challan returns' },
  GODOWN_TRANSFER: { label: 'Godown transfer', kind: 'INTERNAL', tile: 'godown transfers' },
  BRANCH_OUT: { label: 'Branch outward', kind: 'OUT', tile: 'branch out' },
  BRANCH_IN: { label: 'Branch inward', kind: 'IN', tile: 'branch in' },
  ADJUST_PLUS: { label: 'Adjustment +', kind: 'IN', tile: 'adjustments +' },
  ADJUST_MINUS: { label: 'Adjustment −', kind: 'OUT', tile: 'adjustments −' },
  COUNT_EXCESS: { label: 'Count excess', kind: 'IN', tile: 'count excess' },
  COUNT_SHORT: { label: 'Count shortage', kind: 'OUT', tile: 'count shortage' },
  DAMAGE: { label: 'Damage', kind: 'OUT', tile: 'damage' },
  EXPIRED: { label: 'Expired', kind: 'OUT', tile: 'expired' },
  SAMPLE: { label: 'Sample', kind: 'OUT', tile: 'samples' },
  GIFT: { label: 'Gift', kind: 'OUT', tile: 'gifts' },
  BUCKET_MOVE: { label: 'Bucket move', kind: 'INTERNAL', tile: 'bucket moves' },
  REPACK: { label: 'Repack', kind: 'MIXED', tile: 'repacks' },
  REVALUED: { label: 'Revalued', kind: 'VALUE', tile: 'revaluations' },
} as const satisfies Record<string, ReportTypeDef>;

export type ReportType = keyof typeof REPORT_TYPES;
export const REPORT_TYPE_CODES = Object.keys(REPORT_TYPES) as ReportType[];

/** The display order of the By-voucher-type pane and the options list. */
export function reportTypeOrder(type: string): number {
  const i = REPORT_TYPE_CODES.indexOf(type as ReportType);
  return i < 0 ? REPORT_TYPE_CODES.length : i;
}

/**
 * The same mapping as the SQL `reportTypeCase`, for a (txn type, source doc
 * type) pair — used by /options and pinned by the specs so the two cannot
 * drift. `toOtherBranch` decides a TRANSFER_OUT (branch outward vs godown
 * transfer); `internal` = both legs in scope.
 */
export function reportTypeOf(
  txnType: string,
  srcDocType: string | null,
  opts: { internal?: boolean; toOtherBranch?: boolean } = {},
): string {
  if (opts.internal) {
    return txnType.startsWith('TRANSFER') ? 'GODOWN_TRANSFER' : 'BUCKET_MOVE';
  }
  switch (txnType) {
    case 'OPENING':
      return 'OPENING';
    case 'PURCHASE':
      return srcDocType === 'GRN'
        ? 'GRN'
        : srcDocType === 'SHORTAGE_RECEIPT'
          ? 'SHORTAGE_RECEIPT'
          : 'PURCHASE';
    case 'PURCHASE_RETURN':
    case 'SALE':
    case 'SALE_RETURN':
    case 'DC_RETURN':
    case 'ADJUST_PLUS':
    case 'ADJUST_MINUS':
    case 'DAMAGE':
      return txnType;
    case 'DC_ISSUE':
      return 'DC';
    case 'PHYSICAL_PLUS':
      return 'COUNT_EXCESS';
    case 'PHYSICAL_MINUS':
      return 'COUNT_SHORT';
    case 'EXPIRY_WRITEOFF':
      return 'EXPIRED';
    case 'SAMPLE_ISSUE':
      return 'SAMPLE';
    case 'GIFT_ISSUE':
      return 'GIFT';
    case 'BUCKET_OUT':
    case 'BUCKET_IN':
      return 'BUCKET_MOVE';
    case 'REPACK_IN':
    case 'REPACK_OUT':
      return 'REPACK';
    case 'TRANSFER_IN':
      // A branch inward is its own TRANSFER_IN voucher; a godown transfer's IN
      // leg sits under the TRANSFER_OUT voucher that wrote both legs.
      return srcDocType === 'TRANSFER_IN' ? 'BRANCH_IN' : 'GODOWN_TRANSFER';
    case 'TRANSFER_OUT':
      return opts.toOtherBranch ? 'BRANCH_OUT' : 'GODOWN_TRANSFER';
    default:
      return txnType;
  }
}

/** The grid's Type chip words for one row (§5.3's label column). */
export function rowTypeLabel(
  type: string,
  kind: RowKind,
  otherBucket: string | null = null,
): string {
  if (type === 'GODOWN_TRANSFER') {
    return kind === 'OUT'
      ? 'Godown transfer out'
      : kind === 'IN'
        ? 'Godown transfer in'
        : 'Godown transfer';
  }
  if (type === 'BUCKET_MOVE') {
    if (kind === 'OUT' && otherBucket) return `To ${bucketLabel(otherBucket)}`;
    if (kind === 'IN' && otherBucket) return `From ${bucketLabel(otherBucket)}`;
    return kind === 'OUT' ? 'Bucket move out' : kind === 'IN' ? 'Bucket move in' : 'Bucket move';
  }
  if (type === 'REPACK') {
    return kind === 'OUT' ? 'Repack out' : 'Repack in';
  }
  return REPORT_TYPES[type as ReportType]?.label ?? type;
}

/** The tile's word for a type ("41 sales · 1 branch out · 1 to damaged"). */
export function tileLabel(type: string, kind: RowKind, otherBucket: string | null): string {
  if (type === 'BUCKET_MOVE' && otherBucket) {
    return `${kind === 'OUT' ? 'to' : 'from'} ${bucketLabel(otherBucket).toLowerCase()}`;
  }
  if (type === 'GODOWN_TRANSFER' && kind !== 'INTERNAL') {
    return kind === 'OUT' ? 'godown transfers out' : 'godown transfers in';
  }
  return REPORT_TYPES[type as ReportType]?.tile ?? type.toLowerCase();
}

/** The label of a By-voucher-type line. */
export function byTypeLabel(type: string, pairClass: 'LIVE' | 'CANCELLED' | 'AMENDED'): string {
  const base = REPORT_TYPES[type as ReportType]?.label ?? type;
  if (pairClass === 'CANCELLED') return `${base} cancelled (pair)`;
  if (pairClass === 'AMENDED') return `${base} amended (pair, old lines)`;
  return base;
}

// ── which screen a row opens ───────────────────────────────────────────────

/** The documents that post through a "shadow" stock voucher (svh_link_src_*). */
export const SHADOW_DOC_TYPES = [
  'SALE_BILL',
  'DELIVERY_CHALLAN',
  'SALE_RETURN',
  'DC_RETURN',
  'GRN',
  'PURCHASE_BILL',
  'SHORTAGE_RECEIPT',
  'PURCHASE_RETURN',
] as const;

export const SALES_DOC_TYPES = ['SALE_BILL', 'DELIVERY_CHALLAN', 'SALE_RETURN', 'DC_RETURN'];
export const PURCHASE_DOC_TYPES = ['GRN', 'PURCHASE_BILL', 'SHORTAGE_RECEIPT', 'PURCHASE_RETURN'];

/**
 * §5.3 `doc.kind`: the shadow's link when there is one (the bill, not the
 * voucher), else the stock voucher itself by its voucher type.
 */
export function docKindOf(input: {
  linkDocType: string | null;
  voucherType: string | null;
  toBranchId: string | null;
  srcDocType: string | null;
}): DocKind | null {
  const link = input.linkDocType;
  if (link && (SHADOW_DOC_TYPES as readonly string[]).includes(link)) {
    return link as DocKind;
  }
  const vt = input.voucherType ?? input.srcDocType;
  switch (vt) {
    case 'OPENING':
    case 'PHYSICAL':
    case 'ADJUSTMENT':
    case 'ISSUE':
      return vt;
    case 'TRANSFER_OUT':
      return input.toBranchId ? 'BRANCH_OUTWARD' : 'GODOWN_TRANSFER';
    case 'TRANSFER_IN':
      return 'BRANCH_INWARD';
    default:
      return (SHADOW_DOC_TYPES as readonly string[]).includes(vt ?? '') ? (vt as DocKind) : null;
  }
}

// ── the party label (D5 / D6) ──────────────────────────────────────────────

export const COUNTER_CASH = 'Counter (cash)';

/**
 * §5.3 party rules.
 *
 * SALE_BILL: a walk-in when the bill has no customer or names the walk-in
 * ledger (`sales.default_customer_id`). A walk-in's label is the name the
 * cashier typed (`sb_cust_name`) when it is not blank and not the walk-in
 * ledger's own name, else "Counter (cash)". Any other bill: `sb_cust_name`,
 * falling back to the ledger name.
 *
 * Other sales docs: the ledger name of the row's party, "Counter (cash)" for
 * the walk-in or no party. Purchase docs: the supplier's ledger name. Stock
 * vouchers have no party (null).
 */
export function partyOf(input: {
  docKind: DocKind | null;
  srcModule: string | null;
  partyId: string | null;
  ledgerName: string | null;
  billCustomerId: string | null;
  billCustomerName: string | null;
  walkInId: string | null;
  walkInName: string | null;
}): PartyRef | null {
  const kind = input.docKind ?? '';
  const name = clean(input.ledgerName);
  if (kind === 'SALE_BILL') {
    const customerId = input.billCustomerId ?? input.partyId;
    const isWalkInLedger = sameId(customerId, input.walkInId);
    const walkIn = customerId === null || isWalkInLedger;
    const typed = clean(input.billCustomerName);
    if (walkIn) {
      const own = clean(input.walkInName) ?? (isWalkInLedger ? name : null);
      const label =
        typed && (!own || typed.toLowerCase() !== own.toLowerCase()) ? typed : COUNTER_CASH;
      return { id: customerId, label, walkIn: true };
    }
    return { id: customerId, label: typed ?? name ?? '', walkIn: false };
  }
  if (SALES_DOC_TYPES.includes(kind) || input.srcModule === 'SALES') {
    const walkIn = input.partyId === null || sameId(input.partyId, input.walkInId);
    return walkIn
      ? { id: input.partyId, label: COUNTER_CASH, walkIn: true }
      : { id: input.partyId, label: name ?? '', walkIn: false };
  }
  if (PURCHASE_DOC_TYPES.includes(kind) || input.srcModule === 'PURCHASE') {
    return input.partyId || name ? { id: input.partyId, label: name ?? '', walkIn: false } : null;
  }
  return null;
}

function clean(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * Two uuids as text, case aside: the database answers lower case, a setting
 * (sales.default_customer_id) may hold either. Never equal when one is absent.
 */
export function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A shadow refno ends `/r<n>`; n > 1 means the document as amended. */
export function revisionOf(voucherRefno: string | null | undefined): number | null {
  const m = /\/r(\d+)$/.exec(voucherRefno ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return n > 1 ? n : null;
}

/** dd/MM/yyyy from `YYYY-MM-DD` (text only, no zone involved). */
export function dmy(iso: string | null | undefined): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}

/** The day before an ISO date. */
export function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** 'Apr-2026' for '2026-04'. */
export function monthLabel(month: string): string {
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${names[Number(month.slice(5, 7)) - 1]}-${month.slice(0, 4)}`;
}

/** Every `YYYY-MM` from the month of `from` to the month of `to`, both included. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** The last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthEnd(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** A real calendar date in `YYYY-MM-DD`. */
export function isRealIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// ── the BRANCH_OUT transit words ───────────────────────────────────────────

export function transitText(status: string | null, receivedOn: string | null): string | null {
  switch (status) {
    case 'RECEIVED':
      return receivedOn ? `received ${dmy(receivedOn)}` : 'received';
    case 'PARTIAL':
      return 'part received';
    case 'IN_TRANSIT':
      return 'in transit';
    case 'CANCELLED':
      return 'recalled';
    default:
      return null;
  }
}

// ── units and number formats ───────────────────────────────────────────────

/** A base quantity in the Qty-in unit, 3 dp. */
export function qtyIn(base: Num, factor: Num): string {
  return new Prisma.Decimal(base).dividedBy(factor).toFixed(3);
}

/** A per-base-unit rate in the Qty-in unit, 2 dp. */
export function rateIn(baseRate: Num, factor: Num): string {
  return new Prisma.Decimal(baseRate).times(factor).toFixed(2);
}

/** value ÷ qty × factor, or null when the quantity is 0. */
export function rateOf(value: Num, baseQty: Num, factor: Num): string | null {
  const q = new Prisma.Decimal(baseQty);
  if (q.isZero()) return null;
  return new Prisma.Decimal(value).dividedBy(q).times(factor).abs().toFixed(2);
}

export function money(value: Num): string {
  return new Prisma.Decimal(value).toFixed(2);
}

export function dec(value: Num | null | undefined): Dec {
  return new Prisma.Decimal(value ?? 0);
}

/** The applied filters as one sentence (the print heading, the CSV's first line). */
export function printedAsOf(parts: {
  itemName: string;
  branchName: string | null;
  from: string;
  to: string;
  godownName: string | null;
  bucket: string;
  batchNo: string | null;
  unitName: string;
  valueAt: ValueAt;
  types: string[];
  showReversed: boolean;
}): string {
  return [
    parts.itemName,
    parts.branchName,
    `${dmy(parts.from)} to ${dmy(parts.to)}`,
    parts.godownName ?? 'All godowns',
    parts.bucket === 'ALL' ? 'All buckets' : bucketLabel(parts.bucket),
    parts.batchNo ? `Batch ${parts.batchNo}` : 'All batches',
    parts.types.length
      ? `Types: ${parts.types.map((t) => REPORT_TYPES[t as ReportType]?.label ?? t).join(', ')}`
      : 'All types',
    `Qty in ${parts.unitName}`,
    parts.valueAt === 'WITH_TAX' ? 'Cost with tax' : 'Cost without tax',
    parts.showReversed ? 'Cancelled & amended shown' : 'Cancelled & amended hidden',
  ]
    .filter(Boolean)
    .join(' · ');
}
