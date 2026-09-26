import { Prisma } from '@prisma/client';

/**
 * The small arithmetic and date helpers every sales document shares.
 *
 * They live in ONE file so a bill and a challan cannot round a paisa two
 * different ways: the leg builder, the register writer and the guards all
 * import these, and a figure that passed `assertBillAdds` in one module cannot
 * fail it in another for want of a rounding rule.
 */

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}

export function round4(v: number): number {
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 10_000) / 10_000;
}

export function money(v: number): string {
  return round2(v).toFixed(2);
}

/** Prisma Decimal | number | string | null → number, never NaN. */
export function num(v: Prisma.Decimal | number | string | bigint | null | undefined): number {
  if (v === null || v === undefined) {
    return 0;
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : 0;
  }
  if (typeof v === 'bigint') {
    return Number(v);
  }
  const n = Number(typeof v === 'string' ? v : v.toString());
  return Number.isFinite(n) ? n : 0;
}

export function isoDate(d: Date | string | null | undefined): string | null {
  if (!d) {
    return null;
  }
  if (typeof d === 'string') {
    return d.length >= 10 ? d.slice(0, 10) : d;
  }
  return d.toISOString().slice(0, 10);
}

export function isoDateTime(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function addDays(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * `YYYY-YYYY` for a calendar date, on the April–March year every table here
 * is partitioned by.
 */
export function accYearOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const y = d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${y + 1}`;
}

/**
 * INTRA when the place of supply is the company's own state, INTER otherwise.
 * A missing place of supply reads as intra-state — a walk-in over the counter
 * is by definition in the shop's state.
 */
export function supplyNatureOf(
  companyStateCode: string | null | undefined,
  posStateCode: string | null | undefined,
): 'INTRA' | 'INTER' {
  const c = (companyStateCode ?? '').trim();
  const p = (posStateCode ?? '').trim();
  if (!c || !p) {
    return 'INTRA';
  }
  return c === p ? 'INTRA' : 'INTER';
}

/** `avh_voucher_no` as the register wants it: the numeric tail of the refno. */
export function numericTail(refno: string | null | undefined, fallback: bigint): bigint {
  const m = /(\d+)\s*$/.exec(refno ?? '');
  if (!m) {
    return fallback;
  }
  try {
    return BigInt(m[1]);
  } catch {
    return fallback;
  }
}

/** One GST rate bucket per `taxId`, summed. */
export interface TaxBucketRow {
  taxId: string | null;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  acess: number;
}

export function bucketTaxes(
  rows: readonly {
    taxId: string | null;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    acess?: number;
  }[],
): TaxBucketRow[] {
  const by = new Map<string, TaxBucketRow>();
  for (const r of rows) {
    const key = r.taxId ?? '*';
    const b = by.get(key) ?? { taxId: r.taxId, cgst: 0, sgst: 0, igst: 0, cess: 0, acess: 0 };
    b.cgst += r.cgst;
    b.sgst += r.sgst;
    b.igst += r.igst;
    b.cess += r.cess;
    b.acess += r.acess ?? 0;
    by.set(key, b);
  }
  return [...by.values()].map((b) => ({
    taxId: b.taxId,
    cgst: round2(b.cgst),
    sgst: round2(b.sgst),
    igst: round2(b.igst),
    cess: round2(b.cess),
    acess: round2(b.acess),
  }));
}

/** Tender type ids of `accounts.acc_tender_types` the leg builder treats specially. */
export const TENDER_TYPE = {
  CASH: 1,
  CARD: 2,
  UPI: 3,
  WALLET: 4,
  CHEQUE: 5,
  BANK: 6,
  RRN: 7,
  TEMP_CREDIT: 8,
  CREDIT: 9,
  LOYALTY: 10,
  VOUCHER: 11,
} as const;

/** `accounts.acc_voucher_types.vchr_type_id` for every sales document. */
export const SALES_VOUCHER_TYPE = {
  BILL: 3,
  ORDER: 4,
  SALE_RETURN: 18,
  DELIVERY_CHALLAN: 19,
  DC_RETURN: 20,
  TENDER_CHANGE: 22,
} as const;

/**
 * `fixed.menu_master.menu_id` per document — what `user_menus` keys the four
 * rights on. Integers, not uuids: `um_menu_id` is `integer`.
 */
export const SALES_MENU_ID = {
  SALE_BILL: 12,
  SALES_ORDER: 11,
  SALE_RETURN: 13,
  DELIVERY_CHALLAN: 182,
  DC_RETURN: 182,
  TEMP_CREDIT: 12,
} as const;
