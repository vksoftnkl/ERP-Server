import { Prisma } from '@prisma/client';
import {
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import { PdcPostingMode, PdcStatus } from '../receipt/types/receipt-enum';
import { daysBetween, todayUtc } from '../receipt/receipt.utils';
import { ChequeDueBucket, STALE_AFTER_DAYS } from './types/cheque-enum';
import type { ChequeErrorDetail } from './types/cheque-api.types';

/**
 * The checks that belong to no single endpoint, written once and shared by the
 * six services.
 *
 * Each is either something ONLY the service can enforce, or something the
 * database enforces with a message nobody can read. `ck_apd_seq` is true and
 * useless; "deposit on or after 20-09, the date on the cheque" is the same
 * rule said to the person who has to fix it.
 */

// ─── The row, under a lock ───────────────────────────────────────────────────

/** A register row as every mutating path needs it, read under `FOR UPDATE`. */
export interface LockedCheque {
  apdId: string;
  apdAccYear: string;
  apdCompanyId: string;
  apdBranchId: string;
  apdTenantId: string | null;
  apdTraType: string;
  apdPartyId: string;
  apdSalesmanId: string | null;
  apdInstrumentType: string;
  apdInstrumentNo: string;
  apdInstrumentDate: Date;
  apdAmount: Prisma.Decimal;
  apdBankName: string | null;
  apdBankBranch: string | null;
  apdIfsc: string | null;
  apdMicr: string | null;
  apdDrawerName: string | null;
  apdReceivedOn: Date;
  apdBankLedgerId: string | null;
  apdPostingMode: PdcPostingMode;
  apdVoucherId: string | null;
  apdVoucherAccYear: string | null;
  apdTenderId: string | null;
  apdStatus: PdcStatus;
  apdPresentCount: number;
  apdDepositDate: Date | null;
  apdDepositSlipNo: string | null;
  apdClearDate: Date | null;
  apdClearVoucherId: string | null;
  apdClearAccYear: string | null;
  apdBounceDate: Date | null;
  apdBounceReason: string | null;
  apdBounceCharges: Prisma.Decimal;
  apdBounceVoucherId: string | null;
  apdBounceAccYear: string | null;
  apdChargeVoucherId: string | null;
  apdChargeAccYear: string | null;
  apdReplacedById: string | null;
  apdReplacedByAccYear: string | null;
  apdRemarks: string | null;
  apdIsDeleted: boolean;
}

interface LockedChequeRow {
  apd_id: string;
  apd_acc_year: string;
  apd_company_id: string;
  apd_branch_id: string;
  apd_tenant_id: string | null;
  apd_tra_type: string;
  apd_party_id: string;
  apd_salesman_id: string | null;
  apd_instrument_type: string;
  apd_instrument_no: string;
  apd_instrument_date: Date;
  apd_amount: Prisma.Decimal;
  apd_bank_name: string | null;
  apd_bank_branch: string | null;
  apd_ifsc: string | null;
  apd_micr: string | null;
  apd_drawer_name: string | null;
  apd_received_on: Date;
  apd_bank_ledger_id: string | null;
  apd_posting_mode: string;
  apd_voucher_id: string | null;
  apd_voucher_acc_year: string | null;
  apd_tender_id: string | null;
  apd_status: string;
  apd_present_count: number;
  apd_deposit_date: Date | null;
  apd_deposit_slip_no: string | null;
  apd_clear_date: Date | null;
  apd_clear_voucher_id: string | null;
  apd_clear_acc_year: string | null;
  apd_bounce_date: Date | null;
  apd_bounce_reason: string | null;
  apd_bounce_charges: Prisma.Decimal;
  apd_bounce_voucher_id: string | null;
  apd_bounce_acc_year: string | null;
  apd_charge_voucher_id: string | null;
  apd_charge_acc_year: string | null;
  apd_replaced_by_id: string | null;
  apd_replaced_by_acc_year: string | null;
  apd_remarks: string | null;
  apd_is_deleted: boolean;
}

/**
 * `SELECT … FOR UPDATE` on every register row a call names, before anything is
 * read for the arithmetic.
 *
 * Two operators acting on the same cheque at the same moment is the one
 * concurrency case this module has — one clearing it while the other records
 * the bounce the bank has just told them about — and this is the whole of its
 * answer. The second transaction blocks here, re-reads `apd_status` AFTER the
 * first has committed, and `assertStatus` turns it into a 409 naming the
 * instrument and the status it actually has.
 *
 * ORDER BY apd_id, so two deposits naming an overlapping set of cheques take
 * them in the same order and cannot deadlock on each other. Prisma has no
 * `FOR UPDATE`, so this is raw.
 */
export async function lockCheques(
  tx: Prisma.TransactionClient,
  keys: readonly { apdId: string; apdAccYear: string }[],
): Promise<Map<string, LockedCheque>> {
  if (keys.length === 0) {
    return new Map();
  }

  const ids = keys.map((key) => key.apdId);
  const years = [...new Set(keys.map((key) => key.apdAccYear))];

  const rows = await tx.$queryRaw<LockedChequeRow[]>`
    SELECT apd_id, apd_acc_year, apd_company_id, apd_branch_id, apd_tenant_id,
           apd_tra_type, apd_party_id, apd_salesman_id,
           apd_instrument_type, apd_instrument_no, apd_instrument_date,
           apd_amount, apd_bank_name, apd_bank_branch, apd_ifsc, apd_micr,
           apd_drawer_name, apd_received_on, apd_bank_ledger_id,
           apd_posting_mode, apd_voucher_id, apd_voucher_acc_year,
           apd_tender_id, apd_status, apd_present_count,
           apd_deposit_date, apd_deposit_slip_no,
           apd_clear_date, apd_clear_voucher_id, apd_clear_acc_year,
           apd_bounce_date, apd_bounce_reason, apd_bounce_charges,
           apd_bounce_voucher_id, apd_bounce_acc_year,
           apd_charge_voucher_id, apd_charge_acc_year,
           apd_replaced_by_id, apd_replaced_by_acc_year,
           apd_remarks, apd_is_deleted
      FROM accounts.acc_pdc_register
     WHERE apd_id       = ANY(${ids}::uuid[])
       AND apd_acc_year = ANY(${years}::bpchar[])
     ORDER BY apd_id
       FOR UPDATE`;

  return new Map(rows.map((row) => [chequeKey(row.apd_id, row.apd_acc_year), toLockedCheque(row)]));
}

export function chequeKey(apdId: string, apdAccYear: string): string {
  return `${apdId}|${apdAccYear}`;
}

function toLockedCheque(row: LockedChequeRow): LockedCheque {
  return {
    apdId: row.apd_id,
    apdAccYear: row.apd_acc_year,
    apdCompanyId: row.apd_company_id,
    apdBranchId: row.apd_branch_id,
    apdTenantId: row.apd_tenant_id,
    apdTraType: row.apd_tra_type,
    apdPartyId: row.apd_party_id,
    apdSalesmanId: row.apd_salesman_id,
    apdInstrumentType: row.apd_instrument_type,
    apdInstrumentNo: row.apd_instrument_no,
    apdInstrumentDate: row.apd_instrument_date,
    apdAmount: new Prisma.Decimal(row.apd_amount),
    apdBankName: row.apd_bank_name,
    apdBankBranch: row.apd_bank_branch,
    apdIfsc: row.apd_ifsc,
    apdMicr: row.apd_micr,
    apdDrawerName: row.apd_drawer_name,
    apdReceivedOn: row.apd_received_on,
    apdBankLedgerId: row.apd_bank_ledger_id,
    apdPostingMode: row.apd_posting_mode as PdcPostingMode,
    apdVoucherId: row.apd_voucher_id,
    apdVoucherAccYear: row.apd_voucher_acc_year,
    apdTenderId: row.apd_tender_id,
    apdStatus: row.apd_status as PdcStatus,
    apdPresentCount: row.apd_present_count,
    apdDepositDate: row.apd_deposit_date,
    apdDepositSlipNo: row.apd_deposit_slip_no,
    apdClearDate: row.apd_clear_date,
    apdClearVoucherId: row.apd_clear_voucher_id,
    apdClearAccYear: row.apd_clear_acc_year,
    apdBounceDate: row.apd_bounce_date,
    apdBounceReason: row.apd_bounce_reason,
    apdBounceCharges: new Prisma.Decimal(row.apd_bounce_charges),
    apdBounceVoucherId: row.apd_bounce_voucher_id,
    apdBounceAccYear: row.apd_bounce_acc_year,
    apdChargeVoucherId: row.apd_charge_voucher_id,
    apdChargeAccYear: row.apd_charge_acc_year,
    apdReplacedById: row.apd_replaced_by_id,
    apdReplacedByAccYear: row.apd_replaced_by_acc_year,
    apdRemarks: row.apd_remarks,
    apdIsDeleted: row.apd_is_deleted,
  };
}

/**
 * One cheque, locked, scoped and alive — what every single-row endpoint opens
 * with.
 *
 * The company and the branch are checked for the reason the receipt's
 * `assertHeaderScope` gives: a uuid is a bearer token, and without them anyone
 * holding one could deposit, clear or bounce a cheque belonging to a company
 * they have no business in. A mismatch is a **404, not a 403** — a caller
 * scoped elsewhere should not learn that this cheque exists.
 */
export async function lockChequeOrThrow(
  tx: Prisma.TransactionClient,
  keys: { apdId: string; apdAccYear: string; apdCompanyId: string; apdBranchId: string },
  field = 'apdId',
): Promise<LockedCheque> {
  const locked = await lockCheques(tx, [keys]);
  const cheque = locked.get(chequeKey(keys.apdId, keys.apdAccYear));

  if (
    !cheque ||
    cheque.apdIsDeleted ||
    cheque.apdCompanyId !== keys.apdCompanyId ||
    cheque.apdBranchId !== keys.apdBranchId
  ) {
    throwAccountsNotFound<ChequeErrorDetail>(
      'Cheque not found',
      field,
      `No live cheque ${keys.apdId} at this company / branch in ${keys.apdAccYear}`,
    );
  }

  // 'P' rows are OUR cheques handed to suppliers. They live in the same table
  // and belong to menu 52, whose lifecycle is the mirror of this one and not
  // the same one — presenting one of ours for deposit is meaningless.
  if (cheque.apdTraType !== 'R') {
    throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
      {
        field,
        message:
          `${cheque.apdInstrumentNo} is an ISSUED cheque, not a received one. ` +
          'It belongs to the Issued Cheques screen.',
      },
    ]);
  }

  return cheque;
}

// ─── The transitions ─────────────────────────────────────────────────────────

/**
 * §6.3 — a refusal NAMES the state, and says what can be done from it.
 *
 * "221870 is DEPOSITED — bounce or clear it" tells the operator both what is
 * true and what to do next. "ck_apd_status violated" tells them neither.
 */
export function assertStatus(
  cheque: LockedCheque,
  allowed: readonly PdcStatus[],
  action: string,
  field = 'apdId',
): void {
  if (allowed.includes(cheque.apdStatus)) {
    return;
  }
  throwAccountsConflict<ChequeErrorDetail>(`Cheque cannot be ${action}`, [
    {
      field,
      message:
        `${cheque.apdInstrumentNo} is ${cheque.apdStatus} — ` +
        `${whatCanBeDone(cheque.apdStatus)}.`,
    },
  ]);
}

function whatCanBeDone(status: PdcStatus): string {
  switch (status) {
    case PdcStatus.HELD:
      return 'deposit it, replace it, or return it';
    case PdcStatus.DEPOSITED:
      return 'clear it or bounce it';
    case PdcStatus.BOUNCED:
      return 're-present it or replace it';
    case PdcStatus.CLEARED:
      return 'it is settled and nothing further happens to it';
    case PdcStatus.RETURNED:
      return 'the party has the paper back';
    case PdcStatus.CANCELLED:
      return 'it is void; key the replacement as a new receipt';
    case PdcStatus.REPLACED:
      return 'act on the cheque that replaced it';
    default:
      return 'nothing can be done with it';
  }
}

// ─── The dates ───────────────────────────────────────────────────────────────

/**
 * `ck_apd_seq` and `ck_apd_dates` in words an operator can act on.
 *
 * `after` is inclusive throughout: a cheque dated today may be banked today,
 * and a cheque deposited this morning may be reported cleared this afternoon.
 * Same-day is the normal case for a current-dated cheque, not an edge one.
 */
export function assertDateOnOrAfter(
  date: Date,
  earliest: Date,
  what: string,
  earliestLabel: string,
  field: string,
): void {
  if (date.getTime() >= earliest.getTime()) {
    return;
  }
  throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
    {
      field,
      message: `${what} on or after ${formatDate(earliest)}, ${earliestLabel}`,
    },
  ]);
}

/**
 * A date in the future is almost always a typo — and on a bounce or a clearing
 * it is a claim about something the bank has not done yet.
 */
export function assertNotInFuture(date: Date, what: string, field: string): void {
  const today = todayUtc();
  if (date.getTime() <= today.getTime()) {
    return;
  }
  throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
    {
      field,
      message: `${what} cannot be dated ${formatDate(date)} — that is in the future`,
    },
  ]);
}

/** dd-MM, the form §7's refusals are quoted in ("deposit on or after 20-09"). */
export function formatDate(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
}

// ─── The due bucket (§10 — computed, never stored) ───────────────────────────

/**
 * The TypeScript half of the grid's `due_bucket` CASE. Same four boundaries.
 *
 * NULL once the cheque has left play: a CLEARED cheque is not "overdue", it is
 * finished, and colouring it red on the strength of a date three months old
 * would be noise.
 */
export function dueBucketOf(
  instrumentDate: Date,
  status: PdcStatus,
  asOf: Date = todayUtc(),
): ChequeDueBucket | null {
  if (status !== PdcStatus.HELD && status !== PdcStatus.DEPOSITED) {
    return null;
  }
  const days = daysBetween(instrumentDate, asOf);
  if (days < 0) {
    return ChequeDueBucket.FUTURE;
  }
  if (days === 0) {
    return ChequeDueBucket.DUE_TODAY;
  }
  return days > STALE_AFTER_DAYS ? ChequeDueBucket.STALE : ChequeDueBucket.OVERDUE;
}

// ─── Cheques In Hand — from the cheque's OWN tender row (§5) ──────────────────

export interface ChequesInHandLedger {
  ledgerId: string;
  ledgerName: string;
  /** The tender row it came from, so a caller can say where the answer is from. */
  tenderId: string;
  tenderAccYear: string;
}

/**
 * §5, the first of the two rules to keep in front of you.
 *
 * The control ledger a received cheque sits in is the one its RECEIPT posted
 * it to, recorded on `acc_tender_detail.td_tender_ledger_id`, and it is read
 * back from there — never from today's tender master.
 *
 * Because the master is configuration and configuration changes. A shop that
 * re-points its Cheque tender at a new ledger in April still holds cheques
 * posted to the old one in March, and clearing one of those against today's
 * answer would credit a ledger that never held it — leaving the old ledger
 * overstated forever and the new one negative. The tender row is the record of
 * what actually happened.
 *
 * Only ON_RECEIPT rows need it. An ON_CLEARING cheque was never posted
 * anywhere, which is why this returns null rather than throwing for them.
 */
export async function resolveChequesInHand(
  tx: Prisma.TransactionClient,
  cheque: LockedCheque,
  field = 'apdId',
): Promise<ChequesInHandLedger> {
  if (!cheque.apdTenderId) {
    throwAccountsBadRequest<ChequeErrorDetail>('Cheque is not linked to its receipt', [
      {
        field,
        message:
          `${cheque.apdInstrumentNo} has no tender row, so the ledger it was posted to cannot ` +
          'be known. A cheque posted ON_RECEIPT always has one; this row was written by hand ' +
          'or by an import that skipped it.',
      },
    ]);
  }

  const tender = await tx.accTenderDetail.findFirst({
    where: { tdId: cheque.apdTenderId, tdIsDeleted: false },
    select: {
      tdId: true,
      tdAccYear: true,
      tdTenderLedgerId: true,
      ledger: { select: { ledName: true } },
    },
  });

  if (!tender) {
    throwAccountsBadRequest<ChequeErrorDetail>('Cheque is not linked to its receipt', [
      {
        field,
        message:
          `The tender row behind ${cheque.apdInstrumentNo} has been deleted, so the ledger it ` +
          'was posted to cannot be known.',
      },
    ]);
  }

  return {
    ledgerId: tender.tdTenderLedgerId,
    ledgerName: tender.ledger?.ledName ?? 'Cheques in Hand',
    tenderId: tender.tdId,
    tenderAccYear: tender.tdAccYear,
  };
}

// ─── The bank ────────────────────────────────────────────────────────────────

export interface ChequeBankLedger {
  ledgerId: string;
  ledgerName: string;
}

/**
 * The bank a cheque is deposited into: a live BANK ledger this company can
 * see.
 *
 * Visibility is the accounts module's usual rule — a global ledger
 * (`led_company_id IS NULL`) or one this company owns. The foreign key proves
 * the ledger EXISTS; it says nothing about whether this company may use it,
 * which is why this cannot be left to the database.
 *
 * The TYPE is checked and the group is not: `led_ledger_type = 'BANK'` is the
 * column the chart actually maintains, while group names vary between charts
 * ("Bank Accounts", "Bank OD A/c", "Current Assets") and matching on them
 * would be the ledger-name lookup §10 forbids wearing a different hat.
 */
export async function loadBankLedger(
  tx: Prisma.TransactionClient,
  companyId: string,
  bankLedgerId: string,
  field = 'bankLedgerId',
): Promise<ChequeBankLedger> {
  const ledger = await tx.accLedgerMaster.findFirst({
    where: {
      ledId: bankLedgerId,
      ledIsDeleted: false,
      OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
    },
    select: { ledId: true, ledName: true, ledIsActive: true, ledLedgerType: true },
  });

  if (!ledger) {
    throwAccountsNotFound<ChequeErrorDetail>(
      'Bank ledger not found',
      field,
      `No ledger ${bankLedgerId} is visible to this company`,
    );
  }
  if (!ledger.ledIsActive) {
    throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
      { field, message: `"${ledger.ledName}" is inactive and cannot take a deposit` },
    ]);
  }
  if (ledger.ledLedgerType !== 'BANK') {
    throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
      {
        field,
        message:
          `"${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger. ` +
          'A cheque is deposited into a BANK ledger.',
      },
    ]);
  }

  return { ledgerId: ledger.ledId, ledgerName: ledger.ledName };
}
