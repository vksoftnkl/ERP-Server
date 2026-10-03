import { Prisma } from '@prisma/client';
import {
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import { leavesLeft, loadChequeBooks, type ChequeBookFacts } from '../vouchers/cheque-book.helper';
import { money, toDateOnly, trimOrNull, ZERO } from '../receipt/receipt.utils';
import type { PaymentErrorDetail } from './types/payment-api.types';
import {
  BillSettlementMode,
  CHEQUE_TENDER_TYPE_ID,
  DrCr,
  FREE_LEDGER_SETTLEMENT_MODE,
  PAYMENT_ROLE_SETTLEMENT_MODE,
  PAYMENT_ROLE_SIDE,
  PaymentLedgerRole,
} from './types/payment-enum';
import type { SavePaymentOtherLineDto, SavePaymentTenderDto } from './dto/save-payment.dto';
import type { PaymentParty, PaymentWriteClient } from './payment.guards';
import type { PaymentSettings } from './payment.settings';
import { computePaymentTds, type PaymentTdsComputed, type PaymentTdsFacts } from './payment-tds';

/**
 * §5.1 rules 3 and 4 for the PAYMENT — turning what the client sent into what
 * the module posts. Shared by `/payments/create` and `/payments/post`, for the
 * receipt's reason: the post RE-VALIDATES the draft, and two definitions of a
 * cheque is how the second one is found in production.
 *
 * What is the payment's own:
 *
 *   · a CHEQUE row names a BOOK and never a leaf. The bank the cheque is drawn
 *     on is the book's; the leaf is taken at post, under the book's row lock;
 *   · a transfer row may carry a BENEFICIARY;
 *   · the other-ledger band takes the payment's roles, and the server SEEDS
 *     TDS_PAYABLE from the tds_rates lookup when the party is TDS-applicable
 *     — a client figure that disagrees is a 409 naming both.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Tenders
// ═══════════════════════════════════════════════════════════════════════════

export interface NormalisedPaymentCheque {
  chequeBookId: string;
  bookNo: string;
  bankLedgerId: string;
  bankName: string;
  favouring: string | null;
  acPayee: boolean;
  bankBranch: string | null;
  ifsc: string | null;
  micr: string | null;
  drawerName: string | null;
}

export interface NormalisedPaymentBeneficiary {
  name: string | null;
  accountNo: string | null;
  ifsc: string | null;
}

export interface NormalisedPaymentTender {
  rowNo: number;
  tenderId: string;
  tenderName: string;
  tenderTypeId: number;
  tenderTypeName: string;
  isCashType: boolean;
  /** Where the money leaves from. The book's bank on a cheque. */
  tenderLedgerId: string;
  /** A clearing ledger the master names. Never on a cheque we issue. */
  clearingLedgerId: string | null;
  amount: Prisma.Decimal;
  receivedAmt: Prisma.Decimal;
  changeAmt: Prisma.Decimal;
  /**
   * The bank's charge on this transfer, INSIDE the amount: `amount` is what
   * leaves our bank, and the party receives `amount − mdrAmt`.
   */
  mdrAmt: Prisma.Decimal;
  refNo: string | null;
  bankName: string | null;
  payerVpa: string | null;
  instrumentDate: Date | null;
  isCheque: boolean;
  /** Computed, never sent: a cheque dated after the payment (ck_td_pdc). */
  isPdc: boolean;
  notes: string | null;
  settlementMode: BillSettlementMode;
  cheque: NormalisedPaymentCheque | null;
  beneficiary: NormalisedPaymentBeneficiary | null;
  tdId: string | null;
}

/**
 * A tender row as `/create` sends it, or as `/post` re-reads it from
 * `acc_tender_detail` — where the money is the column's Decimal, and stays
 * one: a numeric(·,2) figure is not sent through a float on its way back in.
 */
export type PaymentTenderInput = Omit<
  SavePaymentTenderDto,
  'tdAmount' | 'tdReceivedAmt' | 'tdChangeAmt' | 'tdMdrAmt'
> & {
  tdAmount: number | Prisma.Decimal;
  tdReceivedAmt?: number | Prisma.Decimal;
  tdChangeAmt?: number | Prisma.Decimal;
  tdMdrAmt?: number | Prisma.Decimal;
};

export async function normalisePaymentTenders(
  client: PaymentWriteClient,
  params: {
    tenders: readonly PaymentTenderInput[];
    companyId: string;
    branchId: string;
    paymentDate: Date;
    partyName: string;
  },
): Promise<NormalisedPaymentTender[]> {
  if (params.tenders.length === 0) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      {
        field: 'tenders',
        message:
          'A payment with no instruments is a journal, not a payment. Even a payment settled ' +
          'entirely from a debit the party holds needs a journal voucher instead.',
      },
    ]);
  }

  const masters = await client.accTenderMaster.findMany({
    where: {
      tndId: { in: [...new Set(params.tenders.map((tender) => tender.tdTenderId))] },
      tndIsDeleted: false,
    },
    select: {
      tndId: true,
      tndName: true,
      tndCompanyId: true,
      tndBranchId: true,
      tndTypeId: true,
      tndLedgerId: true,
      tndSettlementLedgerId: true,
      tndEditLedger: true,
      tndIsActive: true,
      tenderType: { select: { ttmTypeId: true, ttmTypeName: true, ttmIsCash: true } },
    },
  });
  const masterById = new Map(masters.map((master) => [master.tndId, master]));

  // The books every cheque row names, in one read.
  const bookIds = params.tenders
    .filter((tender) => tender.tdTenderTypeId === CHEQUE_TENDER_TYPE_ID)
    .map((tender) => tender.cheque?.chequeBookId ?? '')
    .filter(Boolean);
  const books = await loadChequeBooks(client as Prisma.TransactionClient, bookIds);

  const seenRowNos = new Set<number>();
  const normalised: NormalisedPaymentTender[] = [];

  params.tenders.forEach((tender, index) => {
    const field = (name: string): string => `tenders.${index}.${name}`;

    if (seenRowNos.has(tender.tdRowNo)) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        { field: field('tdRowNo'), message: `Row number ${tender.tdRowNo} appears twice` },
      ]);
    }
    seenRowNos.add(tender.tdRowNo);

    const master = masterById.get(tender.tdTenderId);
    if (!master) {
      throwAccountsNotFound<PaymentErrorDetail>(
        'Tender not found',
        field('tdTenderId'),
        `No live tender with id ${tender.tdTenderId}`,
      );
    }
    if (!master.tndIsActive) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        { field: field('tdTenderId'), message: `Tender "${master.tndName}" is inactive` },
      ]);
    }
    if (master.tndCompanyId !== params.companyId) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: field('tdTenderId'),
          message: `Tender "${master.tndName}" belongs to another company`,
        },
      ]);
    }
    if (master.tndBranchId !== null && master.tndBranchId !== params.branchId) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: field('tdTenderId'),
          message: `Tender "${master.tndName}" is not available at this branch`,
        },
      ]);
    }
    if (master.tndTypeId !== tender.tdTenderTypeId) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: field('tdTenderTypeId'),
          message: `Tender "${master.tndName}" is type ${master.tndTypeId}, not ${tender.tdTenderTypeId}`,
        },
      ]);
    }

    const amount = money(tender.tdAmount);
    if (amount.lessThanOrEqualTo(0)) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        { field: field('tdAmount'), message: 'A tender row must carry more than zero' },
      ]);
    }

    const isCheque = master.tndTypeId === CHEQUE_TENDER_TYPE_ID;
    const isCashType = master.tenderType?.ttmIsCash ?? false;
    // A cheque is dated the payment unless the operator dated it later.
    const instrumentDate = tender.tdInstrumentDate
      ? toDateOnly(tender.tdInstrumentDate)
      : isCheque
        ? params.paymentDate
        : null;

    let cheque: NormalisedPaymentCheque | null = null;
    let tenderLedgerId: string;
    if (isCheque) {
      // notes (55): the leaf is the book's to give, at post. A number keyed
      // here would be a second numbering of the same paper.
      if (trimOrNull(tender.tdRefNo)) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: field('tdRefNo'),
            message:
              'A cheque we issue takes its number from the book at post — leave tdRefNo empty ' +
              'and name the book in cheque.chequeBookId.',
          },
        ]);
      }
      const book = tender.cheque?.chequeBookId ? books.get(tender.cheque.chequeBookId) : undefined;
      if (!tender.cheque?.chequeBookId) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: field('cheque.chequeBookId'),
            message: 'A cheque row must name the book its leaf comes from',
          },
        ]);
      }
      if (!book || book.isDeleted) {
        throwAccountsNotFound<PaymentErrorDetail>(
          'Cheque book not found',
          field('cheque.chequeBookId'),
          `No live cheque book ${tender.cheque.chequeBookId}`,
        );
      }
      assertBookUsable(book, params, field('cheque.chequeBookId'));
      if (instrumentDate && instrumentDate < params.paymentDate) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: field('tdInstrumentDate'),
            message: 'A cheque we issue is dated the payment or later — it cannot be back-dated',
          },
        ]);
      }
      cheque = {
        chequeBookId: book.chequeBookId,
        bookNo: book.bookNo,
        bankLedgerId: book.bankLedgerId,
        bankName: book.bankName,
        favouring: trimOrNull(tender.cheque.favouring) ?? params.partyName.slice(0, 150),
        acPayee: tender.cheque.acPayee ?? true,
        bankBranch: trimOrNull(tender.cheque.bankBranch),
        ifsc: trimOrNull(tender.cheque.ifsc),
        micr: trimOrNull(tender.cheque.micr),
        drawerName: trimOrNull(tender.cheque.drawerName),
      };
      // The money leaves the account the book is on, whatever the tender
      // master's own ledger (which, for the CHEQUE type, is Cheques in Hand —
      // a RECEIVED cheque's home, never an issued one's).
      tenderLedgerId = book.bankLedgerId;
    } else {
      tenderLedgerId = master.tndEditLedger
        ? (tender.tdTenderLedgerId ?? master.tndLedgerId)
        : master.tndLedgerId;
      if (
        !master.tndEditLedger &&
        tender.tdTenderLedgerId &&
        tender.tdTenderLedgerId !== master.tndLedgerId
      ) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: field('tdTenderLedgerId'),
            message: `Tender "${master.tndName}" does not allow its ledger to be changed`,
          },
        ]);
      }
    }

    const received = money(tender.tdReceivedAmt ?? 0);
    const change = money(tender.tdChangeAmt ?? 0);
    if (received.greaterThan(0) && !received.minus(change).equals(amount)) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: field('tdReceivedAmt'),
          message:
            `Paid ${received.toFixed(2)} less change ${change.toFixed(2)} is ` +
            `${received.minus(change).toFixed(2)}, but the row is for ${amount.toFixed(2)}`,
        },
      ]);
    }

    const beneficiary: NormalisedPaymentBeneficiary | null =
      !isCheque && !isCashType && tender.beneficiary
        ? {
            name: trimOrNull(tender.beneficiary.name),
            accountNo: trimOrNull(tender.beneficiary.accountNo),
            ifsc: trimOrNull(tender.beneficiary.ifsc)?.toUpperCase() ?? null,
          }
        : null;

    normalised.push({
      rowNo: tender.tdRowNo,
      tenderId: master.tndId,
      tenderName: master.tndName,
      tenderTypeId: master.tndTypeId,
      tenderTypeName: master.tenderType?.ttmTypeName ?? '',
      isCashType,
      tenderLedgerId,
      clearingLedgerId: isCheque ? null : master.tndSettlementLedgerId,
      amount,
      receivedAmt: received,
      changeAmt: change,
      mdrAmt: money(tender.tdMdrAmt ?? 0),
      refNo: isCheque ? null : trimOrNull(tender.tdRefNo),
      bankName: trimOrNull(tender.tdBankName) ?? cheque?.bankName ?? null,
      payerVpa: trimOrNull(tender.tdPayerVpa),
      instrumentDate,
      isCheque,
      isPdc: Boolean(isCheque && instrumentDate && instrumentDate > params.paymentDate),
      notes: trimOrNull(tender.tdNotes),
      settlementMode: settlementModeForTenderType(master.tndTypeId),
      cheque,
      beneficiary,
      tdId: tender.tdId ?? null,
    });
  });

  return normalised.sort((left, right) => left.rowNo - right.rowNo);
}

/**
 * A book a payment may draw on: this company's, this branch's (or every
 * branch's), ACTIVE, with a leaf left. A finished or closed book is a 409 —
 * the plan's "finished book → 409" — here on the draft as well as at post, so
 * the operator is told before the money is counted.
 */
function assertBookUsable(
  book: ChequeBookFacts,
  params: { companyId: string; branchId: string },
  field: string,
): void {
  if (book.companyId !== params.companyId) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      { field, message: `Cheque book ${book.bookNo} belongs to another company` },
    ]);
  }
  if (book.branchId !== null && book.branchId !== params.branchId) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      { field, message: `Cheque book ${book.bookNo} is not usable at this branch` },
    ]);
  }
  if (book.status !== 'ACTIVE' || leavesLeft(book) <= 0) {
    throwAccountsConflict<PaymentErrorDetail>('Cheque book has no leaf to give', [
      {
        field,
        message:
          `Book ${book.bookNo} on ${book.bankName} is ${book.status === 'ACTIVE' ? 'used up' : book.status} ` +
          '— start a new book (Cheque Books, menu 263) or pick another.',
      },
    ]);
  }
}

function settlementModeForTenderType(typeId: number): BillSettlementMode {
  switch (typeId) {
    case 1:
      return BillSettlementMode.CASH;
    case 2:
      return BillSettlementMode.CARD;
    case 3:
      return BillSettlementMode.UPI;
    case 4:
      return BillSettlementMode.WALLET;
    case CHEQUE_TENDER_TYPE_ID:
      return BillSettlementMode.CHEQUE;
    default:
      return BillSettlementMode.BANK;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Other-ledger lines
// ═══════════════════════════════════════════════════════════════════════════

export interface NormalisedPaymentOtherLine {
  lineNo: number;
  role: string | null;
  ledgerId: string;
  ledgerName: string | null;
  drCr: DrCr;
  amount: Prisma.Decimal;
  settlesBill: boolean;
  narration: string | null;
  settlementMode: BillSettlementMode;
  /** The BANK_CHARGES line seeded from the tenders — an extra the money paid for. */
  isInstrumentSplit: boolean;
  /** Who authorised a BALANCES_WRITTEN_BACK line above the threshold. */
  approvedBy: string | null;
}

/**
 * The other-ledger band, validated and completed.
 *
 * ── What the server SEEDS ────────────────────────────────────────────────
 * BANK_CHARGES from `tdMdrAmt`, as the receipt does; and — unlike the receipt,
 * which has no rate to go on — TDS_PAYABLE from `accounts.tds_rates` when the
 * party is TDS-applicable (§5.2). The receipt could only REPORT that a TDS
 * line was expected; a payment is where this company is the deductor, the
 * rate table exists since the Voucher Register, and the same lookup PmtV uses
 * answers the figure.
 *
 * ── The client's own TDS line ────────────────────────────────────────────
 * Accepted when it agrees with the server's to the paisa, refused as a 409
 * naming both when it does not. On a party that is NOT TDS-applicable a keyed
 * TDS_PAYABLE line is refused (notes 62 B2): the CR would reach TDS Payable
 * but no `acc_tds_register` row could — the master names no section, and
 * `atd_section` is what 26Q is filed under — so the deduction would be in the
 * books and missing from the return. Flag the party in its master instead.
 *
 * ── ROUND_OFF, one way only (notes 62 E2) ────────────────────────────────
 * Rounding DOWN (paying 5,000 on 5,000.40) is a reduction of the bill and
 * rides on `allocations[].roundoff`. Rounding UP (paying 5,000 on 4,999.60)
 * is the opposite: money that went out on top of the bill. It is keyed as a
 * DR ROUND_OFF line — an extra, like interest paid — so the 0.40 is expensed
 * to Round Off instead of being parked on the supplier as a 0.40 advance.
 */
export async function normalisePaymentOtherLines(
  client: PaymentWriteClient,
  params: {
    lines: readonly SavePaymentOtherLineDto[];
    tenders: readonly NormalisedPaymentTender[];
    companyId: string;
    branchId: string;
    party: PaymentParty;
    partyId: string;
    settings: PaymentSettings;
    /** The rate in force for the party; null when the party is not TDS-applicable. */
    tds: PaymentTdsFacts | null;
    ledgerForRole: (role: string) => { ledgerId: string; ledgerName: string } | null;
  },
): Promise<{ lines: NormalisedPaymentOtherLine[]; tds: PaymentTdsComputed | null }> {
  const lines: NormalisedPaymentOtherLine[] = [];
  const freeLedgerIds = params.lines
    .filter((line) => !line.role && line.ledgerId)
    .map((line) => line.ledgerId!);

  const freeLedgers =
    freeLedgerIds.length === 0
      ? []
      : await client.accLedgerMaster.findMany({
          where: {
            ledId: { in: [...new Set(freeLedgerIds)] },
            ledIsDeleted: false,
            OR: [{ ledCompanyId: null }, { ledCompanyId: params.companyId }],
          },
          select: { ledId: true, ledName: true, ledIsActive: true },
        });
  const freeLedgerById = new Map(freeLedgers.map((ledger) => [ledger.ledId, ledger]));

  params.lines.forEach((line, index) => {
    const field = (name: string): string => `otherLines.${index}.${name}`;
    const lineNo = index + 1;
    const amount = money(line.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        { field: field('amount'), message: 'An other-ledger line must carry more than zero' },
      ]);
    }
    if (Boolean(line.role) === Boolean(line.ledgerId)) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: field('role'),
          message:
            'Give the line either a role — which every report can find again — or a ledger ' +
            'chosen by hand. Not both, and not neither.',
        },
      ]);
    }

    if (line.role) {
      const role = line.role as PaymentLedgerRole;
      const roundingUp = role === PaymentLedgerRole.ROUND_OFF && line.drCr === DrCr.DR;
      const side = roundingUp ? DrCr.DR : PAYMENT_ROLE_SIDE[role];
      if (!side) {
        const rides =
          role === PaymentLedgerRole.DISCOUNT_RECEIVED ||
          line.role === 'WRITE_OFF' ||
          role === PaymentLedgerRole.ROUND_OFF;
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: field('role'),
            message: rides
              ? `${line.role} is not keyed as a line — it rides on allocations[].discount / .writeoff / ` +
                '.roundoff, and sending both would count it twice.' +
                (role === PaymentLedgerRole.ROUND_OFF
                  ? ' (Paying a few paise MORE than a bill is a DR ROUND_OFF line.)'
                  : '')
              : `"${line.role}" is not a role a payment may post to. Use one of ` +
                `${[...Object.keys(PAYMENT_ROLE_SIDE), 'ROUND_OFF (DR)'].join(', ')}, or pick a ledger by hand.`,
          },
        ]);
      }
      if (side !== line.drCr) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          { field: field('drCr'), message: `${line.role} posts ${side}, not ${line.drCr}` },
        ]);
      }
      const mapped = params.ledgerForRole(line.role);
      if (!mapped) {
        throwAccountsBadRequest<PaymentErrorDetail>('Posting ledgers are not configured', [
          {
            field: field('role'),
            message: `Nothing maps "${line.role}" to a ledger — accounts.acc_ledger_map has no row for it`,
          },
        ]);
      }
      const mode = PAYMENT_ROLE_SETTLEMENT_MODE[line.role];
      const settles = line.drCr === DrCr.CR && (line.settlesBill ?? Boolean(mode));
      if (settles && !mode) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: field('settlesBill'),
            message: `${line.role} cannot settle a bill — it is not a deduction from what we owe. Leave settlesBill off.`,
          },
        ]);
      }
      const approvedBy = trimOrNull(line.approvedBy);
      if (
        role === PaymentLedgerRole.BALANCES_WRITTEN_BACK &&
        amount.greaterThan(params.settings.writeoffApprovalAbove) &&
        !approvedBy
      ) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: field('approvedBy'),
            message:
              `Writing back ${amount.toFixed(2)} needs an approver ` +
              `(accounts.writeoff_approval_above is ${params.settings.writeoffApprovalAbove.toFixed(2)})`,
          },
        ]);
      }
      lines.push({
        lineNo,
        role: line.role,
        ledgerId: mapped.ledgerId,
        ledgerName: mapped.ledgerName,
        drCr: line.drCr,
        amount,
        settlesBill: settles,
        narration: trimOrNull(line.narration),
        settlementMode: mode ?? FREE_LEDGER_SETTLEMENT_MODE,
        isInstrumentSplit: false,
        approvedBy,
      });
      return;
    }

    const ledger = freeLedgerById.get(line.ledgerId!);
    if (!ledger) {
      throwAccountsNotFound<PaymentErrorDetail>(
        'Ledger not found',
        field('ledgerId'),
        `No live ledger ${line.ledgerId} is visible to this company`,
      );
    }
    if (!ledger.ledIsActive) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        { field: field('ledgerId'), message: `"${ledger.ledName}" is inactive` },
      ]);
    }
    if (ledger.ledId === params.partyId) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: field('ledgerId'),
          message: `"${ledger.ledName}" is the party of this payment and cannot also be a line on it`,
        },
      ]);
    }
    lines.push({
      lineNo,
      role: null,
      ledgerId: ledger.ledId,
      ledgerName: ledger.ledName,
      drCr: line.drCr,
      amount,
      settlesBill: line.drCr === DrCr.CR && (line.settlesBill ?? false),
      narration: trimOrNull(line.narration),
      settlementMode: FREE_LEDGER_SETTLEMENT_MODE,
      isInstrumentSplit: false,
      approvedBy: null,
    });
  });

  // ── The bank's charge, seeded from the tenders ──────────────────────────
  seedBankCharges(lines, params);

  // ── TDS, seeded from the rate table ─────────────────────────────────────
  const tds = seedTds(lines, params);

  return { lines, tds };
}

/**
 * The BANK_CHARGES line, added when the client left it out and REFUSED when
 * the client sent one that disagrees with the tenders. On a payment the charge
 * is INSIDE the tender amount: the bank is credited the whole `tdAmount`, the
 * party is discharged of `tdAmount − tdMdrAmt`, and the charge is an ordinary
 * DR extra in the engine's identity — hence `isInstrumentSplit` is
 * informational here, not an exclusion.
 */
function seedBankCharges(
  lines: NormalisedPaymentOtherLine[],
  params: Parameters<typeof normalisePaymentOtherLines>[1],
): void {
  const total = params.tenders
    .reduce((sum, tender) => sum.plus(tender.mdrAmt), ZERO)
    .toDecimalPlaces(2);
  const existing = lines.filter((line) => line.role === PaymentLedgerRole.BANK_CHARGES);
  const supplied = existing.reduce((sum, line) => sum.plus(line.amount), ZERO);

  if (total.lessThanOrEqualTo(0)) {
    if (supplied.greaterThan(0)) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: 'tenders.tdMdrAmt',
          message:
            `The payload carries ${supplied.toFixed(2)} of bank charges, but no tender row has any. ` +
            'Put it on the instrument it came from.',
        },
      ]);
    }
    return;
  }
  if (existing.length > 0) {
    if (!supplied.equals(total)) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: 'tenders.tdMdrAmt',
          message:
            `The tenders carry ${total.toFixed(2)} of bank charges and the BANK_CHARGES line ` +
            `says ${supplied.toFixed(2)}. They must agree.`,
        },
      ]);
    }
    for (const line of existing) {
      line.isInstrumentSplit = true;
    }
    return;
  }
  const mapped = params.ledgerForRole(PaymentLedgerRole.BANK_CHARGES);
  if (!mapped) {
    throwAccountsBadRequest<PaymentErrorDetail>('Posting ledgers are not configured', [
      {
        field: 'tenders.tdMdrAmt',
        message: `The tenders carry ${total.toFixed(2)} of bank charges, and nothing maps "BANK_CHARGES" to a ledger`,
      },
    ]);
  }
  lines.push({
    lineNo: lines.length + 1,
    role: PaymentLedgerRole.BANK_CHARGES,
    ledgerId: mapped.ledgerId,
    ledgerName: mapped.ledgerName,
    drCr: DrCr.DR,
    amount: total,
    settlesBill: false,
    narration: null,
    settlementMode: FREE_LEDGER_SETTLEMENT_MODE,
    isInstrumentSplit: true,
    approvedBy: null,
  });
}

/**
 * §5.2 — the TDS_PAYABLE line, from the rate in force. The NET the supplier
 * receives for their bills (and any advance) is Σ tender amounts less EVERY DR
 * line — the bank's charges, which never reach them, and anything else paid
 * on top: interest is 194A, not the party's section, and a free DR line or a
 * rounding-up is not a payment for what they supplied (notes 62 B1). The
 * deduction is on the gross, so the base is grossed up.
 */
function seedTds(
  lines: NormalisedPaymentOtherLine[],
  params: Parameters<typeof normalisePaymentOtherLines>[1],
): PaymentTdsComputed | null {
  const keyed = lines.filter((line) => line.role === PaymentLedgerRole.TDS_PAYABLE);
  const keyedTotal = keyed.reduce((sum, line) => sum.plus(line.amount), ZERO);

  if (!params.party.ledIsTdsApplicable) {
    if (keyed.length > 0) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: 'otherLines',
          message:
            `${params.party.ledName} is not TDS-applicable in its ledger master, so TDS of ` +
            `${keyedTotal.toFixed(2)} would reach TDS Payable with no section to file it under ` +
            'in 26Q. Mark the party TDS-applicable (section and deductee type) and the payment ' +
            'will work the deduction out itself.',
        },
      ]);
    }
    return null;
  }
  if (!params.tds || !params.tds.rate) {
    throwAccountsBadRequest<PaymentErrorDetail>('TDS rate is not configured', [
      {
        field: 'avhPartyId',
        message:
          `${params.party.ledName} is TDS-applicable under ${params.party.ledTdsSection ?? 'no section'} ` +
          `(${params.party.ledTdsDeducteeType ?? 'ANY'}) and no rate is in force for it in accounts.tds_rates`,
      },
    ]);
  }
  // The BANK_CHARGES line is among the DR lines by now (seedBankCharges ran
  // first). Never below zero: a payload whose extras exceed its money is
  // refused by the engine's identity, and a negative base would only reach
  // ck_atd_base first with a less useful message.
  const extras = lines
    .filter((line) => line.drCr === DrCr.DR)
    .reduce((sum, line) => sum.plus(line.amount), ZERO);
  const paid = params.tenders.reduce((sum, tender) => sum.plus(tender.amount), ZERO);
  const net = Prisma.Decimal.max(paid.minus(extras), ZERO);
  const computed = computePaymentTds(params.party, params.tds, net);
  if (!computed) {
    return null;
  }
  const serverTax = computed.deducted ? computed.tax : ZERO;

  if (keyed.length > 0) {
    if (!keyedTotal.equals(serverTax)) {
      throwAccountsConflict<PaymentErrorDetail>('TDS does not agree', [
        {
          field: 'otherLines',
          message:
            `The client keyed TDS of ${keyedTotal.toFixed(2)}, but ${computed.section} @ ` +
            `${computed.rate.toString()}% on ${computed.base.toFixed(2)} (${computed.rateSource}) ` +
            `comes to ${serverTax.toFixed(2)}${computed.reason ? ` — ${computed.reason}` : ''}. ` +
            'Re-read /payments/open-items and re-post.',
        },
      ]);
    }
    for (const line of keyed) {
      line.settlesBill = true;
      line.settlementMode = BillSettlementMode.TDS;
    }
    return computed;
  }
  if (serverTax.lessThanOrEqualTo(0)) {
    return computed;
  }
  const mapped = params.ledgerForRole(PaymentLedgerRole.TDS_PAYABLE);
  if (!mapped) {
    throwAccountsBadRequest<PaymentErrorDetail>('Posting ledgers are not configured', [
      {
        field: 'avhPartyId',
        message: `${params.party.ledName} is TDS-applicable, and nothing maps "TDS_PAYABLE" to a ledger`,
      },
    ]);
  }
  lines.push({
    lineNo: lines.length + 1,
    role: PaymentLedgerRole.TDS_PAYABLE,
    ledgerId: mapped.ledgerId,
    ledgerName: mapped.ledgerName,
    drCr: DrCr.CR,
    amount: serverTax,
    settlesBill: true,
    narration: `TDS ${computed.section} @ ${computed.rate.toString()}% on ${computed.base.toFixed(2)}`,
    settlementMode: BillSettlementMode.TDS,
    isInstrumentSplit: false,
    approvedBy: null,
  });
  return computed;
}
