import { Prisma } from '@prisma/client';
import type { ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import { BillAdjType, BillSettlementMode, BillType, DrCr } from './types/receipt-enum';
import { distributeProRata, money, sum, ZERO } from './receipt.utils';

/**
 * §5.2 step 5 — the one place allocation is decided.
 *
 * A PURE function: no Prisma, no request context, no clock. Everything it needs
 * arrives in `AllocationInput` and everything it decides leaves in
 * `AllocationResult`. That is not tidiness — it is the only way the screen's
 * preview and the server's post can be proved to agree (§12: "no allocation
 * logic in two places"). The client ports this file; the server runs it; a
 * disagreement is a test failure rather than a wrong receipt.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE MODEL, IN FULL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A receipt is a pool of SOURCES poured into a list of TARGETS, with whatever
 * is left held on account.
 *
 *  Sources, in the order they are consumed (§5.2 step 5):
 *    1. credits the party already holds  — an advance, a credit note
 *    2. settling deductions              — TDS, a claim: value that settles the
 *                                          bill without arriving as money
 *    3. instant money                    — cash, card, UPI, bank, and any
 *                                          cheque dated today or earlier
 *    4. post-dated cheques, by date      — each on a voucher of its own
 *
 *  Targets: the bills, in the order the caller listed them (which is the order
 *  `/receipts/open-items` returned them in, which is the order the
 *  `accounts.receipt_bill_sort` setting asked for — due date first by default).
 *
 * ── Why deductions are placed BEFORE credits, when §5.2 lists them after ───
 *
 * Because a deduction is bill-SPECIFIC and a credit is not. TDS withheld on
 * bill 2 belongs on bill 2; money is fungible and belongs wherever it is
 * poured. If credits ran first they would fill bill 1 completely, and a
 * pro-rata deduction would then have no room on the bill it was actually
 * withheld from — §9's "unpinned spreads pro-rata and sums exactly" would be
 * unsatisfiable. So deductions RESERVE their share of each bill first, and the
 * stated order then governs everything that fills what is left. The stated
 * order is preserved exactly where it is observable; this is the only reading
 * of it that has a solution.
 *
 * ── Why a credit posts NO voucher leg ─────────────────────────────────────
 *
 * §5.2 step 9 lists "the credit-applied pair (DR party / CR the credit's
 * liability ledger)" among the legs. That pair does not balance the books this
 * module keeps, and the module must not post it. The arithmetic:
 *
 *   Let  M = instant money, D = settling deductions, X = other DR lines that
 *   settle nothing, Y = other CR lines, C = credits applied, A = Σ allocations,
 *   O = on account, d = discount, w = write-off.
 *
 *   The identity (§5.2 step 4):     M + D + X + C = A + O + Y
 *   The ledger, party leg:          party CR = M + D + X + d + w − Y
 *   The bill sub-ledger:            party CR = (A + d + w) + O − C
 *
 *   Substituting the identity into the third line gives exactly the second.
 *   They agree — with no leg for the credit. Add the pair and the party ledger
 *   comes out C short of the bill sub-ledger on every receipt that applies one,
 *   and a liability ledger grows by C every time an advance is CONSUMED.
 *
 * The "pair" §5.2 means is real, but it is the pair of `acc_bill_adjustment`
 * rows — one on the bill being settled, one on the credit being spent — which
 * `ck_abj_against` requires and which this engine emits. See the module README,
 * "Deviations from the plan".
 *
 * ── What the engine does NOT decide ───────────────────────────────────────
 *
 * Which ledger a role maps to, what a bill's pending amount is, whether the
 * year is open, whether the operator may write off. All of that is settled
 * before it is called; it is handed facts and returns rows.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Errors
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Thrown rather than returned, so the happy path reads as arithmetic and the
 * caller maps `kind` to a status code once. `CONFLICT` means the world moved
 * under the request (a bill was paid while the operator was typing) and is a
 * 409; `VALIDATION` means the request never added up and is a 400.
 */
export class AllocationError extends Error {
  constructor(
    readonly kind: 'CONFLICT' | 'VALIDATION',
    message: string,
    readonly details: ModuleErrorDetail[],
  ) {
    super(message);
    this.name = 'AllocationError';
  }
}

function conflict(message: string, details: ModuleErrorDetail[]): never {
  throw new AllocationError('CONFLICT', message, details);
}

function invalid(message: string, details: ModuleErrorDetail[]): never {
  throw new AllocationError('VALIDATION', message, details);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Input
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Which voucher a row belongs to, before any of them has an id.
 *
 * `RECEIPT` is the receipt itself. `PDC:<tenderRowNo>` is the voucher a
 * post-dated cheque gets of its own, dated the cheque (R2). The posting service
 * turns these into real ids; the engine only has to be consistent.
 */
export type VoucherKey = string;
export const RECEIPT_VOUCHER_KEY: VoucherKey = 'RECEIPT';
export const pdcVoucherKey = (tenderRowNo: number): VoucherKey => `PDC:${tenderRowNo}`;

/** One bill the receipt is settling, with what the caller says it settles. */
export interface AllocationBill {
  billId: string;
  billAccYear: string;
  docRefno: string;
  /**
   * The bill's TOTAL settlement by this receipt EXCLUDING discount and
   * write-off — money, deductions and credits together. The engine splits it
   * into rows; the caller does not say which source pays which part.
   */
  amount: Prisma.Decimal;
  discount: Prisma.Decimal;
  writeoff: Prisma.Decimal;
  /** What is pending RIGHT NOW, read under the row lock. */
  pendingAmount: Prisma.Decimal;
  /** Set on a write-off; the service has already checked the threshold. */
  writeoffApprovedBy: string | null;
}

/** One credit the party holds, being spent. */
export interface AllocationCredit {
  billId: string;
  billAccYear: string;
  billType: BillType;
  docRefno: string;
  amount: Prisma.Decimal;
  pendingAmount: Prisma.Decimal;
  /** ADVANCE_ADJUST for an advance, NOTE_ADJUST for a credit note. */
  adjType: BillAdjType;
  /** ADVANCE or CREDIT_NOTE. */
  settlementMode: BillSettlementMode;
}

/** One other-ledger line, after the service has resolved its ledger. */
export interface AllocationOtherLine {
  /** 1-based, and stable: `otherLineBills[].lineNo` refers to it. */
  lineNo: number;
  role: string | null;
  ledgerId: string;
  drCr: DrCr;
  amount: Prisma.Decimal;
  /**
   * Does this line reduce what the party owes on a BILL, or is it merely part
   * of the money moving?
   *
   * A DR line that settles nothing (`false`) still credits the party's account
   * — it simply cannot be aimed at a bill, so it flows to on account. A CR line
   * never settles: income the customer paid ON TOP of their bills reduces the
   * money available to settle them.
   */
  settlesBill: boolean;
  /** How the bill records it — TDS, CLAIM, JOURNAL. */
  settlementMode: BillSettlementMode;
  /**
   * The MDR half of an instrument split. Excluded from the identity (§5.2
   * step 9) because it is not extra value: it is part of `tdAmount`, already
   * counted once as money.
   */
  isInstrumentSplit: boolean;
}

/** One tender row, after the service has classified it. */
export interface AllocationTender {
  tenderRowNo: number;
  /** The full face value of the instrument — `td_amount`. */
  amount: Prisma.Decimal;
  isCheque: boolean;
  /** A cheque dated AFTER the receipt. Gets a voucher of its own. */
  isPostDated: boolean;
  /** A cheque's instrument date; null for everything else. */
  instrumentDate: Date | null;
  settlementMode: BillSettlementMode;
}

/** Pins one other-ledger line to one bill (§4.4 `otherLineBills`). */
export interface AllocationPin {
  lineNo: number;
  billId: string;
  billAccYear: string;
  amount: Prisma.Decimal;
}

export interface AllocationInput {
  /** The receipt's own date — what "post-dated" is measured against. */
  receiptDate: Date;
  bills: readonly AllocationBill[];
  credits: readonly AllocationCredit[];
  otherLines: readonly AllocationOtherLine[];
  tenders: readonly AllocationTender[];
  pins: readonly AllocationPin[];
  /** What the CLIENT says is left over. Checked, never trusted (§4.4). */
  claimedOnAccount: Prisma.Decimal;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Output
// ═══════════════════════════════════════════════════════════════════════════

/** One `acc_bill_adjustment` row, less the ids the service assigns. */
export interface AllocationAdjustment {
  billId: string;
  billAccYear: string;
  adjType: BillAdjType;
  settlementMode: BillSettlementMode;
  /**
   * The side of the PARTY's account this row moves. Every settlement of a
   * receivable is a credit to the party; `abj_dr_cr` records it so a row reads
   * on its own.
   */
  drCr: DrCr;
  amount: Prisma.Decimal;
  /**
   * When the bill is settled. The receipt's date for everything except a
   * post-dated cheque, whose rows are dated the CHEQUE — which is what makes
   * "settles on maturity" (§5.3 of the flow) a date comparison rather than a
   * status machine.
   */
  adjDate: Date;
  isPostDated: boolean;
  voucherKey: VoucherKey;
  /** The tender row this came from, for `abj_tender_id` / `abj_cheque_id`. */
  tenderRowNo: number | null;
  /** The other-ledger line this came from, for `abj_settlement_ledger_id`. */
  otherLineNo: number | null;
  againstBill: { billId: string; billAccYear: string } | null;
  approvedBy: string | null;
  /**
   * Does this row count towards its voucher's `avh_adjust_amount`?
   *
   * False on the MIRROR row of a credit pair. The pair records one event twice
   * — once on the bill being settled, once on the credit being spent — and
   * counting both would report a receipt as having adjusted twice what it did.
   */
  countsToAdjustAmount: boolean;
  remarks: string | null;
}

/** A remainder held on account, per voucher (§5.2 step 11). */
export interface AllocationOnAccount {
  voucherKey: VoucherKey;
  amount: Prisma.Decimal;
  /** The ADVANCE bill's date: the receipt's, or the cheque's for a PDC. */
  onDate: Date;
}

export interface AllocationResult {
  adjustments: AllocationAdjustment[];
  onAccount: AllocationOnAccount[];
  /** Σ of the above — what `/post` echoes back and the client checked against. */
  totalOnAccount: Prisma.Decimal;
  /** `avh_adjust_amount` per voucher, derived from the rows, never stamped. */
  adjustAmountByVoucher: Map<VoucherKey, Prisma.Decimal>;
  /** The party CR leg each voucher needs, so step 9 does not re-derive it. */
  partyCreditByVoucher: Map<VoucherKey, Prisma.Decimal>;
}

// ═══════════════════════════════════════════════════════════════════════════
//  The engine
// ═══════════════════════════════════════════════════════════════════════════

/** A pool of value waiting to be poured into bills, and where it came from. */
interface Source {
  kind: 'CREDIT' | 'MONEY' | 'CHEQUE';
  remaining: Prisma.Decimal;
  voucherKey: VoucherKey;
  adjDate: Date;
  isPostDated: boolean;
  settlementMode: BillSettlementMode;
  tenderRowNo: number | null;
  credit: AllocationCredit | null;
}

export function allocate(input: AllocationInput): AllocationResult {
  const bills = input.bills;

  assertBillsFit(bills);
  assertCreditsFit(input.credits);
  assertIdentity(input);

  const adjustments: AllocationAdjustment[] = [];

  // Remaining capacity per bill, in the caller's order. Filled down to zero.
  const capacity = bills.map((bill) => money(bill.amount));

  // ── 1 · Deductions reserve their share, pinned or pro-rata ───────────────
  reserveDeductions(input, bills, capacity, adjustments);

  // ── 2 · Everything else pours in, in the stated order ────────────────────
  const sources = buildSources(input);
  pour(bills, capacity, sources, adjustments);

  // Every bill must now be exactly full. It cannot fail if the identity held
  // and the pours were exact, which is precisely why it is asserted: a failure
  // here is a bug in this file, not bad input, and it must never reach the
  // database as a half-settled bill.
  const unfilled = capacity.findIndex((left) => !left.isZero());
  if (unfilled >= 0) {
    invalid('Allocation could not be completed', [
      {
        field: `allocations.${unfilled}.amount`,
        message:
          `Bill ${bills[unfilled].docRefno} is short by ${capacity[unfilled].toFixed(2)} — ` +
          'the receipt does not carry enough money, credit or deduction to settle what it claims',
      },
    ]);
  }

  // ── 3 · Discount and write-off, per bill ─────────────────────────────────
  addReductions(input, bills, adjustments);

  // ── 4 · What is left is held on account ──────────────────────────────────
  const onAccount = collectOnAccount(input, sources);
  const totalOnAccount = sum(onAccount.map((entry) => entry.amount));

  if (!totalOnAccount.equals(money(input.claimedOnAccount))) {
    invalid('Validation failed', [
      {
        field: 'onAccount',
        message:
          `The server holds ${totalOnAccount.toFixed(2)} on account, not ` +
          `${money(input.claimedOnAccount).toFixed(2)}. The client's figure is a preview; ` +
          're-read /receipts/open-items and re-post.',
      },
    ]);
  }

  return {
    adjustments,
    onAccount,
    totalOnAccount,
    adjustAmountByVoucher: totalPerVoucher(adjustments),
    partyCreditByVoucher: partyCreditPerVoucher(input, adjustments, onAccount),
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

function assertBillsFit(bills: readonly AllocationBill[]): void {
  const seen = new Set<string>();
  bills.forEach((bill, index) => {
    const key = `${bill.billId}|${bill.billAccYear}`;
    if (seen.has(key)) {
      invalid('Validation failed', [
        {
          field: `allocations.${index}.billId`,
          message: `Bill ${bill.docRefno} appears twice. Send one row per bill with the total.`,
        },
      ]);
    }
    seen.add(key);

    const settled = money(bill.amount).plus(bill.discount).plus(bill.writeoff);
    if (bill.amount.isNegative() || bill.discount.isNegative() || bill.writeoff.isNegative()) {
      invalid('Validation failed', [
        {
          field: `allocations.${index}.amount`,
          message: `Bill ${bill.docRefno}: amount, discount and write-off are all positive figures`,
        },
      ]);
    }
    if (settled.lessThanOrEqualTo(0)) {
      invalid('Validation failed', [
        {
          field: `allocations.${index}.amount`,
          message: `Bill ${bill.docRefno} settles nothing. Leave it out rather than sending a zero row.`,
        },
      ]);
    }
    // §5.2 step 3 — measured against what is pending NOW, under the row lock,
    // not against what the screen was showing when the operator started typing.
    if (settled.greaterThan(money(bill.pendingAmount))) {
      conflict('Bill moved while this receipt was being entered', [
        {
          field: `allocations.${index}.amount`,
          message:
            `Bill ${bill.docRefno} has ${money(bill.pendingAmount).toFixed(2)} pending, but this ` +
            `receipt settles ${settled.toFixed(2)} against it`,
        },
      ]);
    }
  });
}

function assertCreditsFit(credits: readonly AllocationCredit[]): void {
  const seen = new Set<string>();
  credits.forEach((credit, index) => {
    const key = `${credit.billId}|${credit.billAccYear}`;
    if (seen.has(key)) {
      invalid('Validation failed', [
        {
          field: `creditsApplied.${index}.billId`,
          message: `Credit ${credit.docRefno} appears twice. Send one row per credit with the total.`,
        },
      ]);
    }
    seen.add(key);

    if (money(credit.amount).lessThanOrEqualTo(0)) {
      invalid('Validation failed', [
        {
          field: `creditsApplied.${index}.amount`,
          message: `Credit ${credit.docRefno} applies nothing. Leave it out.`,
        },
      ]);
    }
    if (money(credit.amount).greaterThan(money(credit.pendingAmount))) {
      conflict('Credit moved while this receipt was being entered', [
        {
          field: `creditsApplied.${index}.amount`,
          message:
            `Credit ${credit.docRefno} has ${money(credit.pendingAmount).toFixed(2)} left, but this ` +
            `receipt applies ${money(credit.amount).toFixed(2)} of it`,
        },
      ]);
    }
  });
}

/**
 * §5.2 step 4, to the paisa:
 *
 *     Σ tdAmount + Σ DR-other + Σ creditsApplied
 *         = Σ allocations + onAccount + Σ CR-other
 *
 * The MDR-derived BANK_CHARGES line is excluded from "Σ DR-other" because it is
 * not extra value arriving — it is a slice of `tdAmount`, which the left-hand
 * side has already counted.
 *
 * Discount and write-off are NOT in this identity. They reduce what the bill
 * demands; they are not money, and adding them to both sides would only make
 * the equation longer.
 */
function assertIdentity(input: AllocationInput): void {
  const moneyIn = sum(input.tenders.map((tender) => money(tender.amount)));
  const otherDr = sum(
    input.otherLines
      .filter((line) => line.drCr === DrCr.DR && !line.isInstrumentSplit)
      .map((line) => money(line.amount)),
  );
  const otherCr = sum(
    input.otherLines.filter((line) => line.drCr === DrCr.CR).map((line) => money(line.amount)),
  );
  const credits = sum(input.credits.map((credit) => money(credit.amount)));
  const allocated = sum(input.bills.map((bill) => money(bill.amount)));
  const claimed = money(input.claimedOnAccount);

  const left = moneyIn.plus(otherDr).plus(credits);
  const right = allocated.plus(claimed).plus(otherCr);

  if (!left.equals(right)) {
    invalid('The receipt does not balance', [
      {
        field: 'onAccount',
        message:
          `Received ${moneyIn.toFixed(2)} + deductions ${otherDr.toFixed(2)} + credits ` +
          `${credits.toFixed(2)} = ${left.toFixed(2)}, but allocated ${allocated.toFixed(2)} + ` +
          `on account ${claimed.toFixed(2)} + other income ${otherCr.toFixed(2)} = ` +
          `${right.toFixed(2)}. Out by ${left.minus(right).toFixed(2)}.`,
      },
    ]);
  }

  // A CR-other line is funded out of money that has ARRIVED. Recognising
  // surcharge or interest against a post-dated cheque would put the income on
  // the receipt voucher and the money on a voucher dated three weeks later,
  // and neither would balance.
  const instant = sum(
    input.tenders.filter((tender) => !tender.isPostDated).map((tender) => money(tender.amount)),
  );
  if (otherCr.greaterThan(instant)) {
    invalid('Validation failed', [
      {
        field: 'otherLines',
        message:
          `Other income of ${otherCr.toFixed(2)} needs money that has arrived, and only ` +
          `${instant.toFixed(2)} has. A post-dated cheque cannot fund it.`,
      },
    ]);
  }
}

// ─── Step 1: deductions reserve ──────────────────────────────────────────────

/**
 * A settling deduction lands on the bill it was withheld from — pinned when the
 * caller said which, spread pro-rata across the bills' remaining capacity when
 * they did not.
 *
 * Pro-rata by CAPACITY and not by face value, because a pinned deduction has
 * already eaten into some bills and not others, and spreading the rest by face
 * value would re-open the possibility of overfilling one.
 */
function reserveDeductions(
  input: AllocationInput,
  bills: readonly AllocationBill[],
  capacity: Prisma.Decimal[],
  out: AllocationAdjustment[],
): void {
  const billIndex = new Map(
    bills.map((bill, index) => [`${bill.billId}|${bill.billAccYear}`, index]),
  );
  const deductions = input.otherLines.filter(
    (line) => line.drCr === DrCr.DR && line.settlesBill && !line.isInstrumentSplit,
  );

  // Pinned first, all of them, before any spreading: a pin is an instruction
  // and a spread is a default, and a default must not consume room an
  // instruction needed.
  const pinnedByLine = new Map<number, AllocationPin[]>();
  for (const pin of input.pins) {
    const list = pinnedByLine.get(pin.lineNo) ?? [];
    list.push(pin);
    pinnedByLine.set(pin.lineNo, list);
  }

  for (const [lineNo, pins] of pinnedByLine) {
    const line = deductions.find((candidate) => candidate.lineNo === lineNo);
    if (!line) {
      invalid('Validation failed', [
        {
          field: 'otherLineBills',
          message:
            `Line ${lineNo} is pinned to a bill, but it is not a deduction that settles one. ` +
            'Only a DR other-ledger line with settlesBill can be pinned.',
        },
      ]);
    }
    const pinnedTotal = sum(pins.map((pin) => money(pin.amount)));
    if (!pinnedTotal.equals(money(line.amount))) {
      invalid('Validation failed', [
        {
          field: 'otherLineBills',
          message:
            `Line ${lineNo} is ${money(line.amount).toFixed(2)} but its pins add up to ` +
            `${pinnedTotal.toFixed(2)}. Pin all of a line or none of it.`,
        },
      ]);
    }

    for (const pin of pins) {
      const index = billIndex.get(`${pin.billId}|${pin.billAccYear}`);
      if (index === undefined) {
        invalid('Validation failed', [
          {
            field: 'otherLineBills',
            message: `Line ${lineNo} is pinned to a bill this receipt does not allocate against`,
          },
        ]);
      }
      takeFromBill(bills, capacity, index, money(pin.amount), `otherLineBills (line ${lineNo})`);
      out.push(deductionRow(input, bills[index], line, money(pin.amount)));
    }
  }

  for (const line of deductions) {
    if (pinnedByLine.has(line.lineNo)) {
      continue;
    }
    const shares = distributeProRata(
      money(line.amount),
      capacity.map((left) => left),
    );
    shares.forEach((share, index) => {
      if (share.isZero()) {
        return;
      }
      takeFromBill(bills, capacity, index, share, `otherLines.${line.lineNo}.amount`);
      out.push(deductionRow(input, bills[index], line, share));
    });
  }
}

function deductionRow(
  input: AllocationInput,
  bill: AllocationBill,
  line: AllocationOtherLine,
  amount: Prisma.Decimal,
): AllocationAdjustment {
  return {
    billId: bill.billId,
    billAccYear: bill.billAccYear,
    // Full-value settlement: the bill closes for its whole face and the part
    // the customer withheld went to a ledger instead of a bank. ALLOCATION, and
    // the MODE says how (§2.5).
    adjType: BillAdjType.ALLOCATION,
    settlementMode: line.settlementMode,
    drCr: DrCr.CR,
    amount,
    adjDate: input.receiptDate,
    isPostDated: false,
    voucherKey: RECEIPT_VOUCHER_KEY,
    tenderRowNo: null,
    otherLineNo: line.lineNo,
    againstBill: null,
    approvedBy: null,
    countsToAdjustAmount: true,
    remarks: null,
  };
}

function takeFromBill(
  bills: readonly AllocationBill[],
  capacity: Prisma.Decimal[],
  index: number,
  amount: Prisma.Decimal,
  field: string,
): void {
  if (amount.greaterThan(capacity[index])) {
    invalid('Validation failed', [
      {
        field,
        message:
          `Bill ${bills[index].docRefno} has room for ${capacity[index].toFixed(2)} more, but ` +
          `${amount.toFixed(2)} was aimed at it. Raise the bill's amount or lower the line.`,
      },
    ]);
  }
  capacity[index] = capacity[index].minus(amount);
}

// ─── Step 2: the pour ────────────────────────────────────────────────────────

/**
 * The sources, in consumption order, with the CR-other lines already taken off
 * the front of the instant money.
 *
 * Taking them off the front rather than pro-rata across the tenders is
 * deliberate: it means the first rupee of cash pays the surcharge, so a receipt
 * of 100 cash + a 10,000 cheque with 20 of interest leaves 80 of cash for the
 * bills rather than 99.8 of a cheque that has not cleared.
 */
function buildSources(input: AllocationInput): Source[] {
  const sources: Source[] = input.credits.map((credit) => ({
    kind: 'CREDIT' as const,
    remaining: money(credit.amount),
    voucherKey: RECEIPT_VOUCHER_KEY,
    adjDate: input.receiptDate,
    isPostDated: false,
    settlementMode: credit.settlementMode,
    tenderRowNo: null,
    credit,
  }));

  const instant = input.tenders
    .filter((tender) => !tender.isPostDated)
    .sort((left, right) => left.tenderRowNo - right.tenderRowNo);

  // The instant tenders collapse into ONE pooled source, because §5.2 step 5
  // asks for "one MIXED row per bill for instant money": cash and UPI landing
  // on the same bill are one settlement, not two. A cheque dated today is
  // instant money for TIMING but keeps its own row — ck_abj_cheque_mode makes a
  // CHEQUE-mode row name its instrument, and a report of "what cleared" has to
  // find it.
  const pooled = instant.filter((tender) => !tender.isCheque);
  const currentCheques = instant.filter((tender) => tender.isCheque);

  let otherCr = sum(
    input.otherLines.filter((line) => line.drCr === DrCr.CR).map((line) => money(line.amount)),
  );
  let pooledTotal = sum(pooled.map((tender) => money(tender.amount)));

  // The CR-other lines eat pooled money first, then current-dated cheques —
  // assertIdentity has already proved there is enough non-post-dated money.
  const takeFromPooled = Prisma.Decimal.min(otherCr, pooledTotal);
  pooledTotal = pooledTotal.minus(takeFromPooled);
  otherCr = otherCr.minus(takeFromPooled);

  if (pooledTotal.greaterThan(0)) {
    sources.push({
      kind: 'MONEY',
      remaining: pooledTotal,
      voucherKey: RECEIPT_VOUCHER_KEY,
      adjDate: input.receiptDate,
      isPostDated: false,
      settlementMode: BillSettlementMode.MIXED,
      tenderRowNo: null,
      credit: null,
    });
  }

  for (const cheque of currentCheques) {
    let amount = money(cheque.amount);
    const take = Prisma.Decimal.min(otherCr, amount);
    amount = amount.minus(take);
    otherCr = otherCr.minus(take);
    if (amount.greaterThan(0)) {
      sources.push({
        kind: 'CHEQUE',
        remaining: amount,
        voucherKey: RECEIPT_VOUCHER_KEY,
        adjDate: input.receiptDate,
        isPostDated: false,
        settlementMode: BillSettlementMode.CHEQUE,
        tenderRowNo: cheque.tenderRowNo,
        credit: null,
      });
    }
  }

  // Post-dated cheques last, earliest maturity first: the bill that settles
  // soonest should be settled by the money that arrives soonest.
  const postDated = input.tenders
    .filter((tender) => tender.isPostDated)
    .sort(
      (left, right) =>
        (left.instrumentDate?.getTime() ?? 0) - (right.instrumentDate?.getTime() ?? 0) ||
        left.tenderRowNo - right.tenderRowNo,
    );

  for (const cheque of postDated) {
    sources.push({
      kind: 'CHEQUE',
      remaining: money(cheque.amount),
      voucherKey: pdcVoucherKey(cheque.tenderRowNo),
      // Dated the CHEQUE. This one field is what makes a post-dated cheque
      // settle on maturity instead of at post.
      adjDate: cheque.instrumentDate ?? input.receiptDate,
      isPostDated: true,
      settlementMode: BillSettlementMode.CHEQUE,
      tenderRowNo: cheque.tenderRowNo,
      credit: null,
    });
  }

  return sources;
}

function pour(
  bills: readonly AllocationBill[],
  capacity: Prisma.Decimal[],
  sources: Source[],
  out: AllocationAdjustment[],
): void {
  let cursor = 0;
  for (let index = 0; index < bills.length; index += 1) {
    while (capacity[index].greaterThan(0) && cursor < sources.length) {
      const source = sources[cursor];
      if (source.remaining.lessThanOrEqualTo(0)) {
        cursor += 1;
        continue;
      }
      const take = Prisma.Decimal.min(source.remaining, capacity[index]);
      source.remaining = source.remaining.minus(take);
      capacity[index] = capacity[index].minus(take);
      out.push(...settlementRows(bills[index], source, take));
    }
  }
}

/**
 * One source landing on one bill. A credit produces a PAIR — the row on the
 * bill being settled, and the mirror on the credit being spent, which is what
 * makes the credit's own `abl_pending_amount` fall.
 */
function settlementRows(
  bill: AllocationBill,
  source: Source,
  amount: Prisma.Decimal,
): AllocationAdjustment[] {
  const base = {
    adjDate: source.adjDate,
    isPostDated: source.isPostDated,
    voucherKey: source.voucherKey,
    tenderRowNo: source.tenderRowNo,
    otherLineNo: null,
    approvedBy: null,
    amount,
  };

  if (source.kind !== 'CREDIT' || source.credit === null) {
    return [
      {
        ...base,
        billId: bill.billId,
        billAccYear: bill.billAccYear,
        adjType: BillAdjType.ALLOCATION,
        settlementMode: source.settlementMode,
        drCr: DrCr.CR,
        againstBill: null,
        countsToAdjustAmount: true,
        remarks: null,
      },
    ];
  }

  const credit = source.credit;
  return [
    {
      ...base,
      billId: bill.billId,
      billAccYear: bill.billAccYear,
      adjType: credit.adjType,
      settlementMode: credit.settlementMode,
      drCr: DrCr.CR,
      againstBill: { billId: credit.billId, billAccYear: credit.billAccYear },
      countsToAdjustAmount: true,
      remarks: `Settled from ${credit.docRefno}`,
    },
    {
      ...base,
      billId: credit.billId,
      billAccYear: credit.billAccYear,
      adjType: credit.adjType,
      settlementMode: credit.settlementMode,
      // The mirror moves the CREDIT, which sits on the other side of the
      // party's account, so it is a debit.
      drCr: DrCr.DR,
      againstBill: { billId: bill.billId, billAccYear: bill.billAccYear },
      // One event, recorded twice. Counting both would double the receipt's
      // reported adjustment.
      countsToAdjustAmount: false,
      remarks: `Applied to ${bill.docRefno}`,
    },
  ];
}

// ─── Step 3: discount and write-off ──────────────────────────────────────────

function addReductions(
  input: AllocationInput,
  bills: readonly AllocationBill[],
  out: AllocationAdjustment[],
): void {
  bills.forEach((bill) => {
    const discount = money(bill.discount);
    if (discount.greaterThan(0)) {
      out.push({
        billId: bill.billId,
        billAccYear: bill.billAccYear,
        adjType: BillAdjType.DISCOUNT,
        settlementMode: BillSettlementMode.DISCOUNT,
        drCr: DrCr.CR,
        amount: discount,
        adjDate: input.receiptDate,
        isPostDated: false,
        voucherKey: RECEIPT_VOUCHER_KEY,
        tenderRowNo: null,
        otherLineNo: null,
        againstBill: null,
        approvedBy: null,
        countsToAdjustAmount: true,
        remarks: null,
      });
    }

    const writeoff = money(bill.writeoff);
    if (writeoff.greaterThan(0)) {
      // ck_abj_writeoff_approval refuses a WRITEOFF with no approver. The
      // service has already checked the threshold and the approver's right;
      // this is the last gate before the constraint, and it names the field.
      if (!bill.writeoffApprovedBy) {
        invalid('Validation failed', [
          {
            field: 'allocations.writeoffApprovedBy',
            message: `Writing off ${writeoff.toFixed(2)} on ${bill.docRefno} needs an approver`,
          },
        ]);
      }
      out.push({
        billId: bill.billId,
        billAccYear: bill.billAccYear,
        adjType: BillAdjType.WRITEOFF,
        settlementMode: BillSettlementMode.WRITEOFF,
        drCr: DrCr.CR,
        amount: writeoff,
        adjDate: input.receiptDate,
        isPostDated: false,
        voucherKey: RECEIPT_VOUCHER_KEY,
        tenderRowNo: null,
        otherLineNo: null,
        againstBill: null,
        approvedBy: bill.writeoffApprovedBy,
        countsToAdjustAmount: true,
        remarks: null,
      });
    }
  });
}

// ─── Step 4: the remainder ───────────────────────────────────────────────────

/**
 * R7 — a remainder is ALWAYS an ADVANCE bill, one per voucher that has one.
 *
 * A credit's remainder is refused rather than re-parked: spending an advance to
 * create another advance moves a number between two rows of the same table and
 * changes nothing about what the party owes, while producing a document trail
 * that says money was received when none was.
 */
function collectOnAccount(
  input: AllocationInput,
  sources: readonly Source[],
): AllocationOnAccount[] {
  const byVoucher = new Map<VoucherKey, AllocationOnAccount>();

  const add = (voucherKey: VoucherKey, amount: Prisma.Decimal, onDate: Date): void => {
    if (amount.lessThanOrEqualTo(0)) {
      return;
    }
    const existing = byVoucher.get(voucherKey);
    byVoucher.set(voucherKey, {
      voucherKey,
      amount: (existing?.amount ?? ZERO).plus(amount),
      onDate: existing?.onDate ?? onDate,
    });
  };

  for (const source of sources) {
    if (source.remaining.lessThanOrEqualTo(0)) {
      continue;
    }
    if (source.kind === 'CREDIT') {
      invalid('Validation failed', [
        {
          field: 'creditsApplied',
          message:
            `${source.credit?.docRefno ?? 'A credit'} has ${source.remaining.toFixed(2)} left over. ` +
            'A credit may only be applied to a bill — it cannot be held on account again. ' +
            'Apply less of it.',
        },
      ]);
    }
    add(source.voucherKey, source.remaining, source.adjDate);
  }

  // A DR other-ledger line that settles no bill still credits the party, and
  // the only place left for it is the advance.
  const floating = sum(
    input.otherLines
      .filter((line) => line.drCr === DrCr.DR && !line.settlesBill && !line.isInstrumentSplit)
      .map((line) => money(line.amount)),
  );
  add(RECEIPT_VOUCHER_KEY, floating, input.receiptDate);

  return [...byVoucher.values()].map((entry) => ({ ...entry, amount: money(entry.amount) }));
}

// ─── Derivations ─────────────────────────────────────────────────────────────

function totalPerVoucher(
  adjustments: readonly AllocationAdjustment[],
): Map<VoucherKey, Prisma.Decimal> {
  const totals = new Map<VoucherKey, Prisma.Decimal>();
  for (const row of adjustments) {
    if (!row.countsToAdjustAmount) {
      continue;
    }
    totals.set(row.voucherKey, (totals.get(row.voucherKey) ?? ZERO).plus(row.amount));
  }
  for (const [key, value] of totals) {
    totals.set(key, money(value));
  }
  return totals;
}

/**
 * The single CR party leg each voucher needs (§5.2 step 9, "ONE CR party for
 * the rest").
 *
 * Derived from the BILL side, not from the money side, because that is the side
 * that has to agree: whatever this receipt credited to the party's bills, plus
 * whatever it held on account, less whatever credit of theirs it spent.
 *
 *   party CR = Σ(rows that credit the party) − Σ(rows that debit them) + on account
 *
 * The mirror row of a credit pair is a DR and is therefore subtracted, which is
 * exactly the C in the header's arithmetic.
 */
function partyCreditPerVoucher(
  input: AllocationInput,
  adjustments: readonly AllocationAdjustment[],
  onAccount: readonly AllocationOnAccount[],
): Map<VoucherKey, Prisma.Decimal> {
  const totals = new Map<VoucherKey, Prisma.Decimal>();
  const add = (key: VoucherKey, amount: Prisma.Decimal): void => {
    totals.set(key, (totals.get(key) ?? ZERO).plus(amount));
  };

  for (const row of adjustments) {
    add(row.voucherKey, row.drCr === DrCr.CR ? row.amount : row.amount.negated());
  }
  for (const entry of onAccount) {
    add(entry.voucherKey, entry.amount);
  }
  // Nothing on the receipt voucher and no bills at all still needs the key
  // present, so the caller can ask for it without checking.
  if (!totals.has(RECEIPT_VOUCHER_KEY)) {
    totals.set(RECEIPT_VOUCHER_KEY, ZERO);
  }
  for (const tender of input.tenders) {
    if (tender.isPostDated) {
      const key = pdcVoucherKey(tender.tenderRowNo);
      if (!totals.has(key)) {
        totals.set(key, ZERO);
      }
    }
  }

  for (const [key, value] of totals) {
    totals.set(key, money(value));
  }
  return totals;
}
