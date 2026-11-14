import { Prisma } from '@prisma/client';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { D, ZERO, baseOf, n, r2, r3, r4, type Dec } from './sale-return-money';
import type {
  BillTenderRow,
  LoyaltyRule,
  OpenBillFacts,
  SaleReturnBillReader,
  SchemeFacts,
  UnwindAddBack,
} from './sale-return-bill-reader';
import type { MoneyIssue, ReturnMoney } from './sale-return-preview';

/**
 * Plan v5 P2b — how a return's credit note is settled, and what else it gives
 * back besides money: one settle mode per return (D35), Adjust against the
 * customer's open bills (D1 / D2), Refund in money capped at what the bill
 * was paid in money (D3 / D33 / D34), the points / gift-voucher share (D48),
 * the agent's commission and the loyalty earned (D9 / D22), the scheme a part
 * return breaks (D47) and the customer's balance after it.
 *
 * Pure where it can be (the arithmetic, every check), then `buildSettlement`
 * puts the reads together — the same function /validate previews and /post
 * posts, as the money mirror is.
 *
 * Settle mode codes stay the table's (ck_sr_settle_mode): ADJUST = "Adjust",
 * CASH = "Refund", ADVANCE = "Credit note".
 */

type Client = Prisma.TransactionClient;
export type SettleMode = 'CASH' | 'ADJUST' | 'ADVANCE';

/** D33 — a refund goes out as cash, UPI or a bank transfer, nothing else. */
export const REFUND_TENDER_TYPES: readonly number[] = [1, 3, 6];
/** UPI and bank need their reference (UTR) number. */
export const REFUND_REF_TYPES: readonly number[] = [3, 6];
const TYPE = { CASH: 1, LOYALTY: 10, VOUCHER: 11 } as const;
const ON_ACCOUNT: readonly number[] = [7, 8, 9];

const min = (a: Dec, b: Dec) => Prisma.Decimal.min(a, b);
const max0 = (a: Dec) => Prisma.Decimal.max(ZERO, a);

// ─── points / voucher share (D48, D74) ─────────────────────────────────────

export interface ShareFigures {
  /** Money value of the points given back: part of the note, never refunded in money. */
  pointsBackAmt: Dec;
  /** The points themselves, at the bill's own redeem rate (D74). */
  points: Dec;
  /** Money a point was worth on the bill (amount ÷ units); 0 when the bill redeemed none. */
  rate: Dec;
  /** The gift-voucher share: stays a credit note, out of the refund cap. */
  voucherShare: Dec;
}

/**
 * D74 — points rounded the way a scheme counts them (`lsc_rounding_method`
 * at `lsc_points_decimals`, as the loyalty engine's roundPoints does): ROUND
 * is half up, FLOOR / CEIL as named, NONE keeps 4 dp (the ledger's scale).
 */
export function roundPoints(v: Dec, rounding: string | null | undefined, decimals: number): Dec {
  const dp = Math.max(0, Math.min(4, Math.trunc(decimals)));
  switch ((rounding ?? 'ROUND').toUpperCase()) {
    case 'NONE':
      return r4(v);
    case 'FLOOR':
      return v.toDecimalPlaces(dp, Prisma.Decimal.ROUND_FLOOR);
    case 'CEIL':
      return v.toDecimalPlaces(dp, Prisma.Decimal.ROUND_CEIL);
    default:
      return v.toDecimalPlaces(dp, Prisma.Decimal.ROUND_HALF_UP);
  }
}

/**
 * Each share is the note's part pro rata to what the bill was paid by points
 * / by vouchers, never more than what is left of it; the return that empties
 * the bill takes the rest.
 *
 * D74 / review 11-14 N5 — the points given back are counted the way the
 * scheme REDEEMS: points at its precision (`pointsDecimals`, half up; never
 * worth more than the bill's points money left, nor the note), each worth
 * the bill's own rate, so the money share is points × rate to the paisa
 * (redeem's own rule: amount = points × rate) and the rest of the note stays
 * credit. The return that empties the bill gives back exactly the points
 * and the money left. Without a scheme (`pointsDecimals` null) the points
 * stay at 4 dp of the money share, as before.
 */
export function sharesOf(input: {
  creditNote: Dec;
  billAmt: Dec;
  billPoints: Dec;
  billPointsUnits: Dec;
  billVoucher: Dec;
  priorPointsBackAmt: Dec;
  priorVoucherShare: Dec;
  emptiesBill: boolean;
  /** The redeeming scheme's `lsc_points_decimals`; null = no scheme found (4 dp, money as worked out). */
  pointsDecimals?: number | null;
  /** Σ points earlier returns of the bill gave back (sr_points_back). */
  priorPoints?: Dec;
}): ShareFigures {
  const none = { pointsBackAmt: ZERO, points: ZERO, rate: ZERO, voucherShare: ZERO };
  if (input.billAmt.lte(0) || input.creditNote.lte(0)) {
    return none;
  }
  const share = (paid: Dec, prior: Dec, room: Dec): Dec => {
    const left = max0(paid.minus(prior));
    const want = input.emptiesBill
      ? left
      : min(left, r2(input.creditNote.times(paid).dividedBy(input.billAmt)));
    return min(want, max0(room));
  };
  const rate = input.billPointsUnits.gt(0)
    ? input.billPoints.dividedBy(input.billPointsUnits)
    : ZERO;
  let pointsBackAmt = share(input.billPoints, input.priorPointsBackAmt, input.creditNote);
  let points = rate.gt(0) ? r4(pointsBackAmt.dividedBy(rate)) : ZERO;
  if (rate.gt(0) && pointsBackAmt.gt(0) && input.pointsDecimals != null) {
    const leftMoney = max0(input.billPoints.minus(input.priorPointsBackAmt));
    const leftUnits = max0(input.billPointsUnits.minus(input.priorPoints ?? ZERO));
    if (input.emptiesBill && pointsBackAmt.equals(leftMoney)) {
      // The last of them: exactly what is left, points and money alike.
      points = leftUnits;
    } else {
      const dp = Math.max(0, Math.min(4, Math.trunc(input.pointsDecimals)));
      const step = new Prisma.Decimal(1).dividedBy(new Prisma.Decimal(10).pow(dp));
      points = min(
        leftUnits,
        pointsBackAmt.dividedBy(rate).toDecimalPlaces(dp, Prisma.Decimal.ROUND_HALF_UP),
      );
      // Never more money than the bill's points left, nor than the note.
      const cap = min(leftMoney, input.creditNote);
      while (points.gt(0) && r2(points.times(rate)).gt(cap)) {
        points = max0(points.minus(step));
      }
      pointsBackAmt = r2(points.times(rate));
    }
  }
  const voucherShare = share(
    input.billVoucher,
    input.priorVoucherShare,
    input.creditNote.minus(pointsBackAmt),
  );
  return { pointsBackAmt, points, rate: r4(rate), voucherShare };
}

/**
 * D9 / D74 / review 11-14 N3 — the points this return takes back of what the
 * bill EARNED: its share by line taxable over the bill's LINE taxable
 * (sb_taxable_amt also counts after-tax taxed charges since P0.3, so a share
 * of it never reached 1), rounded the way the scheme earns, never more than
 * is left after the earlier returns; the return that empties the bill takes
 * exactly the rest. A scheme whose return mode is IGNORE takes nothing back.
 */
export function loyaltyBackOf(input: {
  earned: Dec;
  priorReversed: Dec;
  lineTaxable: Dec;
  billLineTaxable: Dec;
  emptiesBill: boolean;
  rule: LoyaltyRule | null;
}): Dec {
  if (input.earned.lte(0) || (input.rule?.returnMode ?? '').toUpperCase() === 'IGNORE') {
    return ZERO;
  }
  const left = max0(input.earned.minus(input.priorReversed));
  if (input.emptiesBill) {
    return left;
  }
  if (input.billLineTaxable.lte(0)) {
    return ZERO;
  }
  const raw = input.earned.times(
    Prisma.Decimal.min(D(1), max0(input.lineTaxable).dividedBy(input.billLineTaxable)),
  );
  const rounded = input.rule ? roundPoints(raw, input.rule.rounding, input.rule.decimals) : r4(raw);
  return min(left, rounded);
}

/** A pro-rata take-back of a bill figure (agent commission, loyalty earned), the emptying return taking the rest. */
export function proRataBack(input: {
  onBill: Dec;
  prior: Dec;
  part: Dec;
  whole: Dec;
  emptiesBill: boolean;
  scale?: 2 | 4;
}): Dec {
  const left = max0(input.onBill.minus(input.prior));
  if (input.emptiesBill) {
    return left;
  }
  if (input.whole.lte(0)) {
    return ZERO;
  }
  const raw = input.onBill.times(input.part).dividedBy(input.whole);
  return min(left, input.scale === 4 ? r4(raw) : r2(raw));
}

// ─── refund (D3 / D33 / D34) ───────────────────────────────────────────────

export interface RefundTender {
  index: number;
  tenderId: string | null;
  tenderTypeId: number;
  amount: Dec;
  refNo: string | null;
}

/** What this note may refund: never the points / voucher share, never more than the bill's money cap. */
export function refundableOf(input: {
  creditNote: Dec;
  pointsBackAmt: Dec;
  voucherShare: Dec;
  cap: Dec | null;
}): Dec {
  const fromNote = max0(input.creditNote.minus(input.pointsBackAmt).minus(input.voucherShare));
  return input.cap === null ? fromNote : min(fromNote, max0(input.cap));
}

export function checkRefund(tenders: readonly RefundTender[], refundable: Dec): MoneyIssue[] {
  const issues: MoneyIssue[] = [];
  let total = ZERO;
  for (const t of tenders) {
    if (t.amount.lte(0)) {
      continue;
    }
    total = total.plus(t.amount);
    if (!REFUND_TENDER_TYPES.includes(t.tenderTypeId)) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_REFUND_TENDER,
        message: `Refund row ${t.index + 1}: tender type ${t.tenderTypeId} — a refund goes out as cash, UPI or bank transfer only`,
        field: `tenders[${t.index}].tdTenderTypeId`,
      });
    } else if (REFUND_REF_TYPES.includes(t.tenderTypeId) && !(t.refNo ?? '').trim()) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_REFUND_REF,
        message: `Refund row ${t.index + 1}: a UPI or bank refund needs its reference number`,
        field: `tenders[${t.index}].tdRefNo`,
      });
    }
  }
  if (total.gt(refundable)) {
    issues.push({
      level: 'REFUSE',
      code: SALES_ERROR_CODES.RETURN_REFUND_OVER_PAID,
      message: `The refund of ${total.toFixed(2)} is more than the ${refundable.toFixed(2)} this note may pay out in money`,
      field: 'tenders',
      params: { value: refundable.toFixed(2) },
    });
  }
  return issues;
}

/**
 * D33 — the refund grid starts as the bill was paid: its cash / UPI / bank
 * rows, the refundable spread over them pro rata (the last taking the rest);
 * a bill paid otherwise starts with one cash row.
 */
export function startTenders(
  billRows: readonly BillTenderRow[],
  refundable: Dec,
): {
  tenderId: string | null;
  tenderTypeId: number;
  name: string | null;
  ledgerId: string | null;
  amount: number;
}[] {
  const rows = billRows.filter(
    (r) => REFUND_TENDER_TYPES.includes(r.tenderTypeId) && r.amount.gt(0),
  );
  if (refundable.lte(0)) {
    return [];
  }
  if (rows.length === 0) {
    return [
      {
        tenderId: null,
        tenderTypeId: TYPE.CASH,
        name: 'Cash',
        ledgerId: null,
        amount: n(refundable)!,
      },
    ];
  }
  const total = rows.reduce((t, r) => t.plus(r.amount), ZERO);
  let left = refundable;
  return rows.map((r, i) => {
    const amount =
      i === rows.length - 1 ? left : min(left, r2(refundable.times(r.amount).dividedBy(total)));
    left = left.minus(amount);
    return {
      tenderId: r.tenderId,
      tenderTypeId: r.tenderTypeId,
      name: r.name,
      ledgerId: r.ledgerId,
      amount: n(amount)!,
    };
  });
}

// ─── adjust (D1 / D2) ──────────────────────────────────────────────────────

export interface AdjustAsk {
  index: number;
  ablId: string;
  ablAccYear: string;
  amount: Dec;
  /** What the screen saw the bill owe; a different figure now → SALES_RETURN_ADJUST_STALE. */
  dueNow: Dec | null;
}

export interface AdjustLine {
  bill: OpenBillFacts;
  isThisBill: boolean;
  amount: Dec;
}

/** The server's split: fill each bill in order, this bill first, until the note is used. */
export function proposeAdjust(
  bills: readonly OpenBillFacts[],
  adjustable: Dec,
  thisSbId: string | null,
): AdjustLine[] {
  let left = max0(adjustable);
  return bills.map((bill) => {
    const amount = min(left, bill.pending);
    left = left.minus(amount);
    return { bill, isThisBill: isThis(bill, thisSbId), amount };
  });
}

const isThis = (b: OpenBillFacts, sbId: string | null) =>
  !!sbId && b.srcDocType === 'SALE_BILL' && b.srcDocId === sbId;

/** The operator's split, checked: each bill open and owed that much, the total within the note. */
export function checkAdjust(
  asks: readonly AdjustAsk[],
  bills: readonly OpenBillFacts[],
  adjustable: Dec,
  thisSbId: string | null,
  /** N9 — the customer's open bills of a year the company may not write to, by ablId. */
  closed: ReadonlyMap<string, OpenBillFacts> = new Map(),
): { lines: AdjustLine[]; issues: MoneyIssue[] } {
  const byId = new Map(bills.map((b) => [b.ablId, b]));
  const issues: MoneyIssue[] = [];
  const merged = new Map<string, AdjustLine>();
  let total = ZERO;
  for (const a of asks) {
    if (a.amount.lte(0)) {
      continue;
    }
    const shut = closed.get(a.ablId);
    if (shut && !byId.has(a.ablId)) {
      // Its set-off rows would go in that year: refused, as a post into it is.
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.YEAR_LOCKED,
        message: `Adjust row ${a.index + 1}: bill ${shut.refno ?? shut.ablId} is in ${shut.ablAccYear}, a closed year — it cannot be adjusted now`,
        field: 'adjustments',
        params: { bill: shut.refno ?? '', year: shut.ablAccYear },
      });
      continue;
    }
    const bill = byId.get(a.ablId);
    if (!bill || bill.ablAccYear !== a.ablAccYear.trim()) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_ADJUST_STALE,
        message: `Adjust row ${a.index + 1}: bill ${a.ablId} is no longer an open bill of this customer`,
        field: `adjustments[${a.index}].ablId`,
      });
      continue;
    }
    if (a.dueNow !== null && !a.dueNow.equals(bill.pending)) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_ADJUST_STALE,
        message: `Adjust row ${a.index + 1}: bill ${bill.refno ?? bill.ablId} owes ${bill.pending.toFixed(2)} now, not the ${a.dueNow.toFixed(2)} shown`,
        field: `adjustments[${a.index}].dueNow`,
      });
    }
    const line = merged.get(bill.ablId) ?? {
      bill,
      isThisBill: isThis(bill, thisSbId),
      amount: ZERO,
    };
    line.amount = line.amount.plus(r2(a.amount));
    merged.set(bill.ablId, line);
    total = total.plus(r2(a.amount));
  }
  for (const line of merged.values()) {
    if (line.amount.gt(line.bill.pending)) {
      issues.push({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.RETURN_ADJUST_OVER,
        message: `Bill ${line.bill.refno ?? line.bill.ablId} is given ${line.amount.toFixed(2)} but owes ${line.bill.pending.toFixed(2)}`,
        field: 'adjustments',
      });
    }
  }
  if (total.gt(adjustable)) {
    issues.push({
      level: 'REFUSE',
      code: SALES_ERROR_CODES.RETURN_ADJUST_OVER,
      message: `The split adjusts ${total.toFixed(2)}, more than the ${adjustable.toFixed(2)} this note can adjust`,
      field: 'adjustments',
    });
  }
  return { lines: [...merged.values()], issues };
}

/**
 * D4 — the mode a new return starts in: the branch's `sales.return_settle_default`,
 * except that a bill with nothing left to adjust proposes a credit note and a
 * refund is never proposed by itself; Adjust needs a bill of this branch (D14).
 */
export function defaultSettleMode(
  setting: string | null,
  ctx: { adjustable: boolean; billDue: Dec },
): SettleMode {
  const s = (setting ?? 'ADJUST').toUpperCase();
  if (s === 'ADVANCE') {
    return 'ADVANCE';
  }
  return ctx.adjustable && ctx.billDue.gt(0) ? 'ADJUST' : 'ADVANCE';
}

// ─── the scheme a part return breaks (D47) ─────────────────────────────────

export interface SchemeShort {
  schemeId: string;
  kind: string;
  keptValue: Dec;
  text: string;
}

/**
 * For each scheme the bill's lines name: the figure it was earned on (qty of
 * its lines, or the bill value), before and after every return of the bill. A
 * scheme that qualified on the bill and no longer reaches its lowest slab (or
 * its minimum) is short: the customer keeps the benefit still on the lines
 * not returned — the discount on them and the free goods not brought back.
 * A drop to a LOWER slab that still qualifies is not reported (the benefit
 * per slab is the bill's business, not the return's).
 */
export function schemeShorts(
  money: Pick<ReturnMoney, 'billLines' | 'prior' | 'lines' | 'emptiesBill'>,
  schemes: ReadonlyMap<string, SchemeFacts>,
): SchemeShort[] {
  if (money.emptiesBill || money.billLines.length === 0) {
    return [];
  }
  const back = new Map<string, Dec>();
  for (const l of money.lines) {
    if (l.billItemId && !l.overQty) {
      back.set(l.billItemId, (back.get(l.billItemId) ?? ZERO).plus(l.qtyBase));
    }
  }
  const leftShare = (billItemId: string, base: Dec) => {
    if (base.lte(0)) {
      return ZERO;
    }
    const gone = (money.prior.get(billItemId)?.base ?? ZERO).plus(back.get(billItemId) ?? ZERO);
    return max0(base.minus(gone)).dividedBy(base);
  };
  const out: SchemeShort[] = [];
  for (const scheme of schemes.values()) {
    const lines = money.billLines.filter((l) => l.copy.schemeId === scheme.prmId);
    if (lines.length === 0) {
      continue;
    }
    const paid = lines.filter((l) => !l.copy.isFree);
    const byValue = (scheme.applyOn ?? '').toUpperCase() === 'BILL_AMOUNT';
    const valueOf = (l: (typeof money.billLines)[number]) =>
      scheme.includeTax ? l.netAmt : l.parts.taxableAmt;
    const pool = byValue ? money.billLines.filter((l) => !l.copy.isFree) : paid;
    const before = pool.reduce((t, l) => t.plus(byValue ? valueOf(l) : baseOf(l)), ZERO);
    const after = pool.reduce(
      (t, l) =>
        t.plus((byValue ? valueOf(l) : baseOf(l)).times(leftShare(l.billItemId, baseOf(l)))),
      ZERO,
    );
    const floor = (() => {
      const lowest = scheme.slabs.length
        ? scheme.slabs.reduce((m, s) => (s.exceeds.lt(m) ? s.exceeds : m), scheme.slabs[0].exceeds)
        : null;
      const minimum = byValue ? scheme.minBillAmount : scheme.minQty;
      return { lowest, minimum };
    })();
    const reaches = (x: Dec) =>
      (floor.lowest === null || x.gt(floor.lowest)) &&
      (floor.minimum.lte(0) || x.gte(floor.minimum));
    if (floor.lowest === null && floor.minimum.lte(0)) {
      continue;
    }
    if (!reaches(before) || reaches(after)) {
      continue;
    }
    let kept = ZERO;
    for (const l of paid) {
      kept = kept.plus(
        l.parts.schDiscAmt.plus(l.parts.billSchAmt).times(leftShare(l.billItemId, baseOf(l))),
      );
    }
    for (const l of lines.filter((x) => x.copy.isFree)) {
      const perBase = l.factor.gt(0)
        ? (l.perUnit.ratePreTax ?? l.perUnit.rate ?? l.perUnit.actPrice ?? ZERO).dividedBy(l.factor)
        : ZERO;
      kept = kept.plus(perBase.times(baseOf(l)).times(leftShare(l.billItemId, baseOf(l))));
    }
    kept = r2(kept);
    if (kept.lte(0)) {
      continue;
    }
    out.push({
      schemeId: scheme.prmId,
      kind: `${scheme.applyOn ?? ''}/${scheme.benefit ?? ''}`,
      keptValue: kept,
      text:
        `${scheme.name ?? scheme.code ?? 'Scheme'}: after this return the bill has ` +
        `${byValue ? r2(after).toFixed(2) : r3(after).toString()} left, below the scheme's ` +
        `${byValue ? 'amount' : 'qty'}; the customer keeps ${kept.toFixed(2)} of its benefit`,
    });
  }
  return out;
}

// ─── put together ──────────────────────────────────────────────────────────

export interface SettlementPlan {
  mode: SettleMode;
  creditNote: Dec;
  shares: ShareFigures;
  memberId: string | null;
  agentCommBack: Dec;
  loyaltyReverse: Dec;
  /** Adjust: the bills and what each takes. */
  adjust: {
    lines: AdjustLine[];
    adjustable: Dec;
    adjusted: Dec;
    leftAsCredit: Dec;
    proposed: boolean;
  } | null;
  /** Refund: the money cap and the tenders asked for. */
  refund: {
    /** Money paid on the bill: its own money tenders + `receivedLater`. */
    paidInMoney: Dec;
    /** Money Receipts allocated to the bill after it was raised (user 11-13). */
    receivedLater: Dec;
    refundedBefore: Dec;
    cap: Dec | null;
    refundable: Dec;
    tenders: RefundTender[];
    refunded: Dec;
    cashOut: Dec;
    leftAsCredit: Dec;
    start: ReturnType<typeof startTenders>;
  } | null;
  credited: Dec;
  customerBalance: { before: Dec; after: Dec } | null;
  promoCheck: SchemeShort[];
  issues: MoneyIssue[];
}

export interface SettlementInput {
  mode: string | null;
  companyId: string;
  branchId: string;
  custId: string | null;
  /** The return's refund rows (CR tenders). */
  tenders: readonly RefundTender[];
  /** The operator's Adjust split; null = the server proposes one. */
  adjustments: readonly AdjustAsk[] | null;
  billSort: string | null;
  /** Lock the bills Adjust touches (at /post). */
  lock: boolean;
  /**
   * The /validate preview of an amend of a POSTED return: what its unwind
   * will give back (reader.unwindAddBack), so the Adjust bills and the
   * customer's balance are those the amend itself sees once it has unwound.
   * null everywhere else — a draft, a first post, and the amend's own
   * settlement, which runs AFTER its unwind (adding back again would count
   * the return's set-offs twice).
   */
  unwound: UnwindAddBack | null;
}

export async function buildSettlement(
  reader: SaleReturnBillReader,
  c: Client,
  money: ReturnMoney,
  input: SettlementInput,
): Promise<SettlementPlan> {
  const issues: MoneyIssue[] = [];
  const mode = ((input.mode ?? 'ADJUST').toUpperCase() as SettleMode) || 'ADJUST';
  const creditNote = money.totals.creditNote;
  const bill = money.bill;
  const prior = money.priorHeader;
  const lineTaxable = money.lines.reduce((t, l) => t.plus(l.parts.taxableAmt), ZERO);
  const billLineTaxable = money.billLines.reduce((t, l) => t.plus(l.parts.taxableAmt), ZERO);

  let shares: ShareFigures = { pointsBackAmt: ZERO, points: ZERO, rate: ZERO, voucherShare: ZERO };
  let paidInMoney = ZERO;
  let billRows: BillTenderRow[] = [];
  let agentCommBack = ZERO;
  let loyaltyReverse = ZERO;
  if (bill && prior) {
    billRows = await reader.billTenderRows(c, bill);
    const rules = await reader.billLoyaltyRules(c, bill);
    const sumOf = (types: readonly number[]) =>
      billRows
        .filter((r) => types.includes(r.tenderTypeId))
        .reduce((t, r) => t.plus(r.amount), ZERO);
    const points = sumOf([TYPE.LOYALTY]);
    const units = billRows
      .filter((r) => r.tenderTypeId === TYPE.LOYALTY)
      .reduce((t, r) => t.plus(r.unitsUsed), ZERO);
    paidInMoney = billRows
      .filter((r) => ![TYPE.LOYALTY, TYPE.VOUCHER, ...ON_ACCOUNT].includes(r.tenderTypeId))
      .reduce((t, r) => t.plus(r.amount), ZERO);
    shares = sharesOf({
      creditNote,
      billAmt: bill.billAmt,
      billPoints: points,
      billPointsUnits: units,
      billVoucher: sumOf([TYPE.VOUCHER]),
      priorPointsBackAmt: prior.pointsBackAmt,
      priorVoucherShare: prior.voucherShare,
      emptiesBill: money.emptiesBill,
      pointsDecimals: rules.redeem?.decimals ?? null,
      priorPoints: prior.pointsBack,
    });
    agentCommBack = proRataBack({
      onBill: bill.agentCommAmt,
      prior: prior.agentComm,
      part: lineTaxable,
      whole: billLineTaxable,
      emptiesBill: money.emptiesBill,
    });
    // D9 — the figure /post takes back (capped there by what the wallet holds).
    loyaltyReverse = loyaltyBackOf({
      earned: bill.loyaltyEarnPoints,
      priorReversed: prior.loyaltyReversed,
      lineTaxable,
      billLineTaxable,
      emptiesBill: money.emptiesBill,
      rule: rules.earn,
    });
  }

  // One mode per return (D35). Adjust needs a bill of this branch (D14).
  const adjustable = !!bill && bill.branchId === input.branchId;
  if (mode === 'ADJUST' && !adjustable) {
    issues.push({
      level: 'REFUSE',
      code: SALES_ERROR_CODES.RETURN_SETTLE_MODE,
      message: bill
        ? "This return is against another branch's bill — settle it by credit note or refund"
        : 'ADJUST needs a bill to adjust against — this return is not against a bill',
      field: 'srSettleMode',
    });
  }

  let adjust: SettlementPlan['adjust'] = null;
  let refund: SettlementPlan['refund'] = null;
  const afterShares = max0(creditNote.minus(shares.pointsBackAmt));
  // Review 11-14 B1 — a 0.00 note settles nothing: no bills to adjust, no
  // money to refund (a refund row with an amount is still refused).
  const zeroNote = creditNote.isZero();
  if (zeroNote && mode === 'CASH') {
    issues.push(...checkRefund(input.tenders, ZERO));
  }
  if (!zeroNote && mode === 'ADJUST' && adjustable && input.custId) {
    const all = await reader.openBills(c, {
      companyId: input.companyId,
      branchId: input.branchId,
      partyId: input.custId,
      firstSbId: bill.sbId,
      sort: input.billSort,
      lock: input.lock,
      addBack: input.unwound?.bills ?? null,
    });
    // N9 — a bill of a closed year is never proposed, nor taken in a split.
    const shut = await reader.closedYears(
      c,
      input.companyId,
      all.map((b) => b.ablAccYear),
    );
    const bills = all.filter((b) => !shut.has(b.ablAccYear));
    const closed = new Map(all.filter((b) => shut.has(b.ablAccYear)).map((b) => [b.ablId, b]));
    let lines: AdjustLine[];
    if (input.adjustments) {
      const checked = checkAdjust(input.adjustments, bills, afterShares, bill.sbId, closed);
      issues.push(...checked.issues);
      const named = new Map(checked.lines.map((l) => [l.bill.ablId, l]));
      lines = bills.map(
        (b) => named.get(b.ablId) ?? { bill: b, isThisBill: isThis(b, bill.sbId), amount: ZERO },
      );
    } else {
      lines = proposeAdjust(bills, afterShares, bill.sbId);
    }
    const adjusted = lines.reduce((t, l) => t.plus(l.amount), ZERO);
    adjust = {
      lines,
      adjustable: afterShares,
      adjusted,
      leftAsCredit: max0(afterShares.minus(adjusted)),
      proposed: !input.adjustments,
    };
  }
  if (!zeroNote && mode === 'CASH') {
    // No bill: nothing was paid on one to cap it by (the RETURN_NO_RECEIPT approval governs it, D5).
    // With one, the cap is what the customer paid on it in money — at the
    // counter and by Receipts allocated to it since (user 11-13) — less what
    // earlier returns already refunded.
    const receivedLater = bill && prior ? await reader.receivedLater(c, bill) : ZERO;
    paidInMoney = paidInMoney.plus(receivedLater);
    const cap = bill && prior ? max0(paidInMoney.minus(prior.refund)) : null;
    const refundable = refundableOf({
      creditNote,
      pointsBackAmt: shares.pointsBackAmt,
      voucherShare: shares.voucherShare,
      cap,
    });
    issues.push(...checkRefund(input.tenders, refundable));
    const refunded = input.tenders
      .filter((t) => REFUND_TENDER_TYPES.includes(t.tenderTypeId))
      .reduce((t, x) => t.plus(max0(x.amount)), ZERO);
    refund = {
      paidInMoney,
      receivedLater,
      refundedBefore: prior?.refund ?? ZERO,
      cap,
      refundable,
      tenders: [...input.tenders],
      refunded: min(refunded, afterShares),
      cashOut: input.tenders
        .filter((t) => t.tenderTypeId === TYPE.CASH)
        .reduce((t, x) => t.plus(max0(x.amount)), ZERO),
      leftAsCredit: max0(afterShares.minus(refunded)),
      start: startTenders(billRows, refundable),
    };
  }
  const credited = creditNote
    .minus(shares.pointsBackAmt)
    .minus(refund?.refunded ?? ZERO)
    .minus(adjust?.adjusted ?? ZERO);

  const schemeIds = money.billLines.map((l) => l.copy.schemeId).filter((x): x is string => !!x);
  const promoCheck = schemeIds.length
    ? schemeShorts(money, await reader.schemes(c, schemeIds))
    : [];
  for (const s of promoCheck) {
    issues.push({
      level: 'WARN',
      code: SALES_ERROR_CODES.RETURN_SCHEME_SHORT,
      message: s.text,
      field: 'items',
      params: { value: s.keptValue.toFixed(2) },
    });
  }

  let customerBalance: SettlementPlan['customerBalance'] = null;
  if (input.custId) {
    // An amend preview: the balance as the amend's unwind leaves it (the same customer's only).
    const unwound =
      input.unwound && input.unwound.partyId === input.custId ? input.unwound.balance : ZERO;
    const before = (await reader.customerBalance(c, input.companyId, input.custId)).plus(unwound);
    customerBalance = {
      before,
      after: before
        .minus(creditNote)
        .plus(refund?.refunded ?? ZERO)
        .plus(shares.pointsBackAmt),
    };
  }

  return {
    mode,
    creditNote,
    shares,
    memberId: bill?.loyaltyMemberId ?? null,
    agentCommBack,
    loyaltyReverse,
    adjust,
    refund,
    credited,
    customerBalance,
    promoCheck,
    issues,
  };
}

/** The preview's `settlement` block and its siblings (§6.2). */
export function settlementJson(p: SettlementPlan): Record<string, unknown> {
  return {
    mode: p.mode,
    creditNote: n(p.creditNote),
    pointsBackAmt: n(p.shares.pointsBackAmt),
    voucherShare: n(p.shares.voucherShare),
    credited: n(p.credited),
    adjust: p.adjust
      ? {
          proposed: p.adjust.proposed,
          adjustable: n(p.adjust.adjustable),
          adjusted: n(p.adjust.adjusted),
          leftAsCredit: n(p.adjust.leftAsCredit),
          bills: p.adjust.lines.map((l) => ({
            ablId: l.bill.ablId,
            ablAccYear: l.bill.ablAccYear,
            refno: l.bill.refno,
            billType: l.bill.billType,
            srcDocType: l.bill.srcDocType,
            srcDocId: l.bill.srcDocId,
            srcAccYear: l.bill.srcAccYear,
            docDate: l.bill.docDate,
            dueDate: l.bill.dueDate,
            billAmount: n(l.bill.billAmount),
            dueNow: n(l.bill.pending),
            adjustNow: n(l.amount),
            dueAfter: n(l.bill.pending.minus(l.amount)),
            isThisBill: l.isThisBill,
          })),
        }
      : null,
    refund: p.refund
      ? {
          paidInMoney: n(p.refund.paidInMoney),
          receivedLater: n(p.refund.receivedLater),
          refundedBefore: n(p.refund.refundedBefore),
          cap: n(p.refund.cap),
          refundable: n(p.refund.refundable),
          refunded: n(p.refund.refunded),
          cashOut: n(p.refund.cashOut),
          leftAsCredit: n(p.refund.leftAsCredit),
          startTenders: p.refund.start,
        }
      : null,
  };
}
