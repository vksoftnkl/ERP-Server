import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OpenBillFacts } from '../../modules/sales/sale-return/sale-return-bill-reader';
import type { AdjustAsk } from '../../modules/sales/sale-return/sale-return-settlement';
import type {
  MobileReturnNote,
  MobileReturnOutcome,
  MobileReturnReplanReason,
  MobileReturnReplanned,
} from './types/mobile-return-api.types';

/*
 * The pure parts of the phone's sale return upload (VKSMAN canvas page 6b,
 * plan-mobile-sales-return-2026-11-20): the Adjust re-plan (D6) and what a
 * refused post means for the phone (D7). Decimal in, Decimal out; the service
 * reads the bills under the post's own lock and hands them in through the
 * desktop settlement's replan hook, which still checks the split it answers.
 */

const ZERO = new Prisma.Decimal(0);
const r2 = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const min = (a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal => (a.lessThan(b) ? a : b);
const keyOf = (billId: string, accYear: string): string => `${billId}|${accYear.trim()}`;

/** One Adjust row the phone sent: acc_bill_balance id, its year, the money. */
export interface PhoneAdjustRow {
  billId: string;
  billAccYear: string;
  amount: Prisma.Decimal;
}

export interface ReplanResult {
  /** The split to post, in the phone's order, then the bills freed money went to. */
  asks: AdjustAsk[];
  /** Every bill whose figure differs from the phone's. */
  replanned: MobileReturnReplanned[];
}

/**
 * D6 — the phone's Adjust split against the customer's open bills as they
 * stand now (read under the post's lock, this bill first, then the Receipt's
 * order), never refused for a stale row (as the receipt's D1):
 *  1. a bill that is no longer open here (paid, cancelled, another branch or
 *     a closed year) frees its whole row (BILL_SETTLED);
 *  2. a bill that owes less now is capped at what it owes (BILL_REDUCED);
 *  3. the split is cut, last bill first, to what the note can adjust
 *     (NOTE_SMALLER: the return came to less than the phone's estimate);
 *  4. money freed by 1-2 goes to the open bills in order, up to what the note
 *     can still adjust (FREED_MONEY); what is left stays on the note as credit.
 * Rows naming one bill twice are merged. A row of 0 is no row.
 */
export function replanAdjust(input: {
  rows: readonly PhoneAdjustRow[];
  bills: readonly OpenBillFacts[];
  adjustable: Prisma.Decimal;
}): ReplanResult {
  const open = new Map(input.bills.map((b) => [keyOf(b.ablId, b.ablAccYear), b]));
  // The phone's figure per bill, in the order it first named each.
  const asked = new Map<string, PhoneAdjustRow>();
  for (const row of input.rows) {
    const amount = r2(row.amount);
    if (amount.lte(0)) {
      continue;
    }
    const key = keyOf(row.billId, row.billAccYear);
    const seen = asked.get(key);
    asked.set(key, {
      billId: row.billId,
      billAccYear: row.billAccYear.trim(),
      amount: (seen?.amount ?? ZERO).plus(amount),
    });
  }
  const final = new Map<string, Prisma.Decimal>();
  const reasons = new Map<string, MobileReturnReplanReason>();
  let freed = ZERO;
  for (const [key, row] of asked) {
    const bill = open.get(key);
    if (!bill) {
      final.set(key, ZERO);
      reasons.set(key, 'BILL_SETTLED');
      freed = freed.plus(row.amount);
      continue;
    }
    const give = min(row.amount, bill.pending);
    if (give.lessThan(row.amount)) {
      reasons.set(key, give.isZero() ? 'BILL_SETTLED' : 'BILL_REDUCED');
      freed = freed.plus(row.amount.minus(give));
    }
    final.set(key, give);
  }
  const adjustable = Prisma.Decimal.max(ZERO, input.adjustable);
  let total = [...final.values()].reduce((t, v) => t.plus(v), ZERO);
  if (total.gt(adjustable)) {
    // The note is smaller than the split: cut from the last bill back. No
    // money is left over to refill.
    let over = total.minus(adjustable);
    for (const key of [...final.keys()].reverse()) {
      if (over.lte(0)) {
        break;
      }
      const has = final.get(key)!;
      const cut = min(has, over);
      if (cut.gt(0)) {
        final.set(key, has.minus(cut));
        reasons.set(key, 'NOTE_SMALLER');
        over = over.minus(cut);
      }
    }
    total = adjustable;
    freed = ZERO;
  }
  let leftover = min(freed, adjustable.minus(total));
  const refilled: string[] = [];
  for (const bill of input.bills) {
    if (leftover.lte(0)) {
      break;
    }
    const key = keyOf(bill.ablId, bill.ablAccYear);
    const has = final.get(key) ?? ZERO;
    const add = min(bill.pending.minus(has), leftover);
    if (add.lte(0)) {
      continue;
    }
    if (!final.has(key)) {
      refilled.push(key);
    }
    final.set(key, has.plus(add));
    reasons.set(key, 'FREED_MONEY');
    leftover = leftover.minus(add);
  }
  const order = [...asked.keys(), ...refilled];
  const asks: AdjustAsk[] = [];
  const replanned: MobileReturnReplanned[] = [];
  for (const key of order) {
    const [billId, billAccYear] = key.split('|');
    const amount = final.get(key) ?? ZERO;
    if (amount.gt(0)) {
      asks.push({
        index: asks.length,
        ablId: billId,
        ablAccYear: billAccYear,
        amount,
        dueNow: null,
      });
    }
    const from = asked.get(key)?.amount ?? ZERO;
    const reason = reasons.get(key);
    if (reason && !from.equals(amount)) {
      replanned.push({
        billId,
        billAccYear,
        refno: open.get(key)?.refno ?? null,
        from: from.toFixed(2),
        to: amount.toFixed(2),
        reason,
      });
    }
  }
  return { asks, replanned };
}

/**
 * D7 — the refusals only the office can clear: the post is HELD (the DRAFT
 * waits there). The approval gate (TILL_APPROVAL_REQUIRED), the WARN codes the
 * office may override (the return window, the GST credit-note cut-off, an
 * expired lot, a no-bill item with no price, a scheme a part return breaks),
 * no Post right on menu 13, and the till session (TILL_SESSION_*).
 */
export const MOBILE_RETURN_HELD_CODES: ReadonlySet<string> = new Set([
  'TILL_APPROVAL_REQUIRED',
  'SALES_RETURN_WINDOW',
  'GST_CREDIT_NOTE_CUTOFF',
  'SALES_RETURN_LOT_EXPIRED',
  'SALES_RETURN_NO_PRICE',
  'SALES_RETURN_SCHEME_SHORT',
  'SALES_RIGHT_POST',
]);

export const isHeldCode = (code: string): boolean =>
  MOBILE_RETURN_HELD_CODES.has(code) || code.startsWith('TILL_SESSION_');

/**
 * Every coded refusal of a refused post, as the desktop threw it (a 4xx
 * HttpException whose body carries errors[] with codes); null when the throw
 * is not a refusal (a database error, a 5xx, an uncoded throw): the upload
 * then fails whole, as before.
 */
export function refusalsOf(error: unknown): MobileReturnNote[] | null {
  if (!(error instanceof HttpException)) {
    return null;
  }
  const status = error.getStatus();
  if (status < 400 || status >= 500) {
    return null;
  }
  const body = error.getResponse();
  const errors = isRecord(body) && Array.isArray(body.errors) ? (body.errors as unknown[]) : [];
  const notes = errors.filter(isRecord).flatMap((e): MobileReturnNote[] => {
    if (typeof e.code !== 'string' || e.code === '') {
      return [];
    }
    // The desktop detail's own keys (event, amount, params, statutory …) stay:
    // the catalogue picks its wording variant and fills its placeholders by them.
    const { user: _user, ...detail } = e;
    void _user;
    return [
      {
        ...detail,
        code: e.code,
        message: typeof e.message === 'string' ? e.message : error.message,
        field: typeof e.field === 'string' ? e.field : null,
        line: typeof e.line === 'number' ? e.line : null,
      },
    ];
  });
  return notes.length > 0 ? notes : null;
}

/**
 * HELD when every refusal is one only the office can clear; SENT_BACK as soon
 * as one is the phone's to fix (it must be fixed before the office could post
 * it anyway). `first` is the refusal the answer names: the first held one, or
 * the first the phone must fix.
 */
export function outcomeOf(refusals: readonly MobileReturnNote[]): {
  status: Exclude<MobileReturnOutcome, 'POSTED'>;
  first: MobileReturnNote;
} {
  const fix = refusals.find((r) => !isHeldCode(r.code));
  return fix ? { status: 'SENT_BACK', first: fix } : { status: 'HELD', first: refusals[0] };
}

/** The phone's word for a till_approval status; a withdrawn request is not shown. */
export function phoneApprovalStatus(tapStatus: string): 'PENDING' | 'APPROVED' | 'REJECTED' | null {
  switch (tapStatus) {
    case 'PENDING':
      return 'PENDING';
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
    case 'EXPIRED':
      return 'REJECTED';
    default:
      return null;
  }
}

/** sale_bill.sb_return_status in the phone's three words. */
export function billReturnStatus(status: string | null): 'NONE' | 'PARTIAL' | 'FULL' {
  return status === 'FULL' ? 'FULL' : status === 'PARTIAL' ? 'PARTIAL' : 'NONE';
}

/** D9 — the bill window: sales.return_window_days when above 0, else 90 days. */
export const MOBILE_RETURN_DEFAULT_BILL_DAYS = 90;
export function billDaysOf(returnWindowDays: number): number {
  return returnWindowDays > 0 ? Math.trunc(returnWindowDays) : MOBILE_RETURN_DEFAULT_BILL_DAYS;
}

/** srm_default_condition when it is one of the phone's four, else null. */
export function phoneCondition(
  condition: string | null,
): 'RESTOCK' | 'DAMAGED' | 'EXPIRED' | 'SCRAP' | null {
  const c = (condition ?? '').trim().toUpperCase();
  return c === 'RESTOCK' || c === 'DAMAGED' || c === 'EXPIRED' || c === 'SCRAP' ? c : null;
}

/** sales.return_settle_default as the phone may use it: ADVANCE, else ADJUST; null when unset. */
export function phoneSettleDefault(value: string | null): 'ADJUST' | 'ADVANCE' | null {
  const v = (value ?? '').trim().toUpperCase();
  if (!v) {
    return null;
  }
  return v === 'ADVANCE' ? 'ADVANCE' : 'ADJUST';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
