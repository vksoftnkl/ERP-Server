import { Prisma } from '@prisma/client';
import {
  isUniqueConstraintError,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import {
  allocateVoucherNumber,
  allocateVoucherSlno,
} from 'src/common/Sequence/voucher-sequence.helper';
import { deriveVoucherTotals } from '../accountVoucherHeader/voucher-totals.helper';
import { DrCr, VoucherStatus } from '../receipt/types/receipt-enum';
import { assertAccYearWritable, assertVoucherPartitionExists } from '../receipt/receipt.guards';
import { toAmount, toDateString } from '../receipt/receipt.utils';
import { CHEQUE_SRC_DOC_TYPE, CHEQUE_SRC_MODULE } from './types/cheque-enum';
import type {
  ChequeErrorDetail,
  ChequeVoucherLeg,
  ChequeVoucherRef,
} from './types/cheque-api.types';

/**
 * ONE way to write a voucher in this module.
 *
 * Four of the six endpoints post one — the clearing, the bounce, the re-issue
 * and the return reversal — and all four do it through here. They differ only
 * in their legs and their type code, which is exactly what a caller passes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE POSTING ORDER, AND WHY IT IS NOT NEGOTIABLE (§6.2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. header DRAFT
 *   2. legs
 *   3. re-derive the totals and refuse an imbalance BY NAME
 *   4. header POSTED — last
 *
 * `ck_avh_balanced` is
 *
 *     CHECK (avh_voucher_status <> 'POSTED' OR avh_total_debit = avh_total_credit)
 *
 * and a header flipped to POSTED before its legs exist passes it comparing 0
 * with 0. The order is what makes the constraint mean something. Step 3 is
 * what makes a failure readable: "chqbnc00003 is out by 250.00 (debit
 * 19300.00, credit 19050.00)" rather than a 23514 naming no voucher and no
 * amount.
 *
 * Migration 20260915120000 §11 adds `accounts.tr_av_refresh_totals`, which
 * derives `avh_total_debit` / `avh_total_credit` from the legs. Nothing here
 * writes those columns. Where the trigger has not been applied they stay at
 * their defaults and step 3 is the only thing standing between an unbalanced
 * voucher and the books — which is the honest reason it re-derives rather than
 * trusting the header.
 */

// ─── The type, by CODE ───────────────────────────────────────────────────────

export interface ChequeVoucherType {
  vchrTypeId: number;
  vchrTypeCode: string;
  vchrTypeName: string;
}

/**
 * `vchr_type_id` is a serial and differs between the dev box and the live one
 * — ChqClr landed on 13 here. A hard-coded id would post clearings as whatever
 * document type happens to hold that number in production, which is a class of
 * bug nobody finds for a year.
 */
export async function loadVoucherType(
  tx: Prisma.TransactionClient,
  code: string,
  field: string,
): Promise<ChequeVoucherType> {
  const type = await tx.accVoucherType.findFirst({
    where: { vchrTypeCode: code },
    select: { vchrTypeId: true, vchrTypeCode: true, vchrTypeName: true, vchrIsActive: true },
  });

  if (!type || !type.vchrIsActive) {
    throwAccountsNotFound<ChequeErrorDetail>(
      'Voucher type is not configured',
      field,
      `accounts.acc_voucher_types has no active row with vchr_type_code = '${code}'. ` +
        'Run migration 20260916120000.',
    );
  }

  return {
    vchrTypeId: type.vchrTypeId,
    vchrTypeCode: type.vchrTypeCode,
    vchrTypeName: type.vchrTypeName,
  };
}

// ─── A leg, before it is a row ───────────────────────────────────────────────

export interface ChequeLegSpec {
  drCr: DrCr;
  ledgerId: string;
  amount: Prisma.Decimal;
  /** `av_role` — the role this posted under, so the answer survives a remap. */
  role?: string | null;
  remarks?: string | null;
  /**
   * `av_recon_date` — the date the BANK says it happened, which is not always
   * the date we recorded it. The hook bank reconciliation will hang off.
   * Only ever set on a bank leg.
   */
  reconDate?: Date | null;
}

export interface WriteVoucherParams {
  typeCode: string;
  /** Names the field an error is reported against. */
  field: string;
  companyId: string;
  branchId: string;
  tenantId: string | null;
  /** The year the voucher lands in — NOT necessarily the cheque's own year. */
  accYear: string;
  voucherDate: Date;
  partyId: string;
  employeeId?: string[];
  /** `avh_doc_amount` — the money this voucher is ABOUT, for the day book. */
  docAmount: Prisma.Decimal;
  remarks: string | null;
  /** The voucher this one answers: the receipt, or the bounce being re-presented. */
  againstVoucherId?: string | null;
  againstAccYear?: string | null;
  /**
   * `avh_src_*`. Set ONLY by the clearing, where the cheque's own id under
   * `ux_avh_src` is what makes a second clearing impossible. See below.
   */
  srcDocId?: string | null;
  /** Turned into the "already cleared" message when `ux_avh_src` refuses. */
  duplicateMessage?: string;
  userId: string;
  sessionId?: string | null;
  deviceType?: string | null;
  deviceId?: string | null;
  actor: string;
  legs: readonly ChequeLegSpec[];
}

export interface WrittenVoucher {
  ref: ChequeVoucherRef;
  legs: ChequeVoucherLeg[];
  voucherTypeId: number;
  voucherNo: bigint;
}

/**
 * Header DRAFT → legs → totals checked → POSTED, in one call.
 *
 * The caller is already inside a transaction and stays inside it: a voucher
 * half-written is worse than one not written, and every caller here has rows
 * locked that must not be released early.
 */
export async function writeChequeVoucher(
  tx: Prisma.TransactionClient,
  params: WriteVoucherParams,
): Promise<WrittenVoucher> {
  const type = await loadVoucherType(tx, params.typeCode, params.field);

  // Both, and in this order: the year must be OPEN and its partitions must
  // exist. A bounce recorded in April against a cheque received in March lands
  // in the NEW year, and that year may have neither.
  await assertAccYearWritable(tx, params.companyId, params.accYear, params.field);
  await assertVoucherPartitionExists(tx, params.accYear, params.field);

  const legs = params.legs.filter((leg) => leg.amount.greaterThan(0));
  if (legs.length === 0) {
    throwAccountsBadRequest<ChequeErrorDetail>('Nothing to post', [
      {
        field: params.field,
        message: 'Every leg of this voucher came to zero, so there is nothing to record.',
      },
    ]);
  }

  const number = await allocateNumber(tx, {
    companyId: params.companyId,
    branchId: params.branchId,
    accYear: params.accYear,
    voucherTypeId: type.vchrTypeId,
    voucherDate: params.voucherDate,
  });

  const header = await createHeader(tx, params, type, number);

  await tx.accVoucher.createMany({
    data: legs.map((leg, index) => ({
      avVoucherId: header.avhVoucherId,
      avCompanyId: params.companyId,
      avBranchId: params.branchId,
      avTenantId: params.tenantId,
      avAccYear: params.accYear,
      avVoucherTypeId: type.vchrTypeId,
      avVoucherNo: number.voucherNo,
      avRowNo: index + 1,
      avVoucherDate: params.voucherDate,
      avVoucherRefno: number.voucherRefno,
      avDrCr: leg.drCr,
      avLedgerId: leg.ledgerId,
      avAmount: leg.amount,
      // The role travels WITH the leg (§2.6 of the receipt plan). The map says
      // where a role posts today; the leg records which role it was posted
      // under, so a report still answers correctly after a remap.
      avRole: leg.role ?? null,
      avRemarks: leg.remarks ?? null,
      avReconDate: leg.reconDate ?? null,
      avSessionId: params.sessionId ?? null,
      avUserId: params.userId,
      avCreatedBy: params.actor,
    })),
  });

  // Step 3 — re-derived from the LEGS, not read off the header, so this is
  // also the check on the trigger that maintains those columns.
  const totals = await deriveVoucherTotals(tx, header.avhVoucherId, params.accYear);
  if (!totals.difference.isZero()) {
    throwAccountsBadRequest<ChequeErrorDetail>('The voucher does not balance', [
      {
        field: params.field,
        message:
          `${number.voucherRefno} is out by ${totals.difference.abs().toFixed(2)} ` +
          `(debit ${totals.totalDebit.toFixed(2)}, credit ${totals.totalCredit.toFixed(2)}). ` +
          'Nothing has been posted.',
      },
    ]);
  }

  const now = new Date();
  await tx.accVoucherHeader.update({
    where: {
      avhVoucherId_avhAccYear: {
        avhVoucherId: header.avhVoucherId,
        avhAccYear: params.accYear,
      },
    },
    data: {
      avhVoucherStatus: VoucherStatus.POSTED,
      avhStatusOn: now,
      avhStatusBy: params.actor,
      avhPostedOn: now,
    },
  });

  const ledgerNames = await loadLedgerNames(
    tx,
    legs.map((leg) => leg.ledgerId),
  );

  return {
    ref: {
      voucherId: header.avhVoucherId,
      accYear: params.accYear,
      voucherRefno: number.voucherRefno,
      voucherDate: toDateString(params.voucherDate) ?? '',
      voucherStatus: VoucherStatus.POSTED,
      totalDebit: toAmount(totals.totalDebit),
      totalCredit: toAmount(totals.totalCredit),
    },
    legs: legs.map((leg, index) => ({
      rowNo: index + 1,
      drCr: leg.drCr,
      ledgerId: leg.ledgerId,
      ledgerName: ledgerNames.get(leg.ledgerId) ?? '',
      amount: toAmount(leg.amount),
      role: leg.role ?? null,
      remarks: leg.remarks ?? null,
    })),
    voucherTypeId: type.vchrTypeId,
    voucherNo: number.voucherNo,
  };
}

/**
 * The header, DRAFT.
 *
 * `avh_total_debit` / `avh_total_credit` are NOT written. They are derived by
 * `tr_av_refresh_totals`, and stamping them here would put `ck_avh_balanced`
 * back to comparing a writer's own two numbers with each other — which is
 * exactly the bug the receipt plan's §2.4 was raised about.
 *
 * ── `ux_avh_src` as an idempotency key ───────────────────────────────────
 * When `srcDocId` is given (the clearing, and nothing else) it goes into
 * `avh_src_doc_id` alongside ('ACCOUNTS', 'PDC'). That tuple is UNIQUE per
 * company and year for every live non-cancelled header, so a SECOND clearing
 * of the same cheque cannot be written at all — not because a check ran, but
 * because the index refuses it. Two operators clearing the same cheque at the
 * same moment are serialised by the row lock; the loser gets "already cleared
 * on <date>" here rather than a duplicate voucher.
 *
 * The bounce deliberately files nothing there: a cheque may bounce, be
 * re-presented and bounce again, and each of those is a real separate event
 * that the index would refuse.
 */
async function createHeader(
  tx: Prisma.TransactionClient,
  params: WriteVoucherParams,
  type: ChequeVoucherType,
  number: { voucherNo: bigint; voucherSlno: bigint; voucherRefno: string },
): Promise<{ avhVoucherId: string }> {
  try {
    return await tx.accVoucherHeader.create({
      data: {
        avhCompanyId: params.companyId,
        avhBranchId: params.branchId,
        avhTenantId: params.tenantId,
        avhAccYear: params.accYear,
        avhVoucherTypeId: type.vchrTypeId,
        avhVoucherNo: number.voucherNo,
        avhVoucherSlno: number.voucherSlno,
        avhVoucherRefno: number.voucherRefno,
        avhVoucherDate: params.voucherDate,
        avhPartyId: params.partyId,
        avhEmployeeId: params.employeeId ?? [],
        avhDocAmount: params.docAmount,
        avhRemarks: params.remarks,
        avhAgainstVoucherId: params.againstVoucherId ?? null,
        avhAgainstAccYear: params.againstAccYear ?? null,
        avhSrcModule: params.srcDocId ? CHEQUE_SRC_MODULE : null,
        avhSrcDocType: params.srcDocId ? CHEQUE_SRC_DOC_TYPE : null,
        avhSrcDocId: params.srcDocId ?? null,
        avhDeviceType: params.deviceType ?? null,
        avhDeviceId: params.deviceId ?? null,
        avhSessionId: params.sessionId ?? null,
        avhUserId: params.userId,
        avhVoucherStatus: VoucherStatus.DRAFT,
        avhCreatedBy: params.actor,
      },
      select: { avhVoucherId: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error) && params.duplicateMessage) {
      throwAccountsConflict<ChequeErrorDetail>('Already done', [
        { field: params.field, message: params.duplicateMessage },
      ]);
    }
    throw error;
  }
}

/**
 * The receipt module's allocator, reached directly rather than through
 * `ReceiptService.allocateNumber`.
 *
 * Two counters and not one, because they count different things:
 * `avh_voucher_no` runs per voucher TYPE and is the number printed on the
 * document, while `avh_voucher_slno` is unique per (company, year) across
 * EVERY type — so a clearing and a receipt posted in the same second would
 * otherwise collide on `ux_avh_voucher_slno`.
 */
export async function allocateNumber(
  tx: Prisma.TransactionClient,
  scope: {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherTypeId: number;
    voucherDate: Date;
  },
): Promise<{ voucherNo: bigint; voucherSlno: bigint; voucherRefno: string }> {
  const allocated = await allocateVoucherNumber(tx, {
    vchrTypeId: scope.voucherTypeId,
    companyId: scope.companyId,
    branchId: scope.branchId,
    accYear: scope.accYear,
    documentDate: scope.voucherDate,
  });
  const slno = await allocateVoucherSlno(tx, scope.companyId, scope.accYear);

  return { voucherNo: allocated.lastNo, voucherSlno: slno, voucherRefno: allocated.refno };
}

async function loadLedgerNames(
  tx: Prisma.TransactionClient,
  ledgerIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ledgerIds)];
  if (unique.length === 0) {
    return new Map();
  }
  const ledgers = await tx.accLedgerMaster.findMany({
    where: { ledId: { in: unique } },
    select: { ledId: true, ledName: true },
  });
  return new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName]));
}

// ─── Reading one back ────────────────────────────────────────────────────────

/**
 * A voucher as `/cheques/get` reports it.
 *
 * ── The totals are DERIVED here, not read off the header ─────────────────
 * `avh_total_debit` / `avh_total_credit` are maintained by
 * `accounts.tr_av_refresh_totals`, which migration 20260915120000 §11 adds —
 * and which was appended to that file AFTER it had been applied, so on any
 * database carrying that history the trigger does not exist and both columns
 * sit at their default of 0. Reading them would make this endpoint report a
 * balanced five-leg bounce as 0.00 / 0.00.
 *
 * Deriving from the LEGS is right whether the trigger is there or not, and it
 * is the same argument `deriveVoucherTotals` makes for itself: the legs are
 * the fact, the columns are a cache. It also makes this a check ON the
 * trigger — if the two ever disagreed, what the screen shows is the truth.
 */
export async function loadVoucherRef(
  tx: Prisma.TransactionClient,
  voucherId: string | null,
  accYear: string | null,
): Promise<ChequeVoucherRef | null> {
  if (!voucherId || !accYear) {
    return null;
  }
  const header = await tx.accVoucherHeader.findFirst({
    where: { avhVoucherId: voucherId, avhAccYear: accYear, avhIsDeleted: false },
    select: {
      avhVoucherId: true,
      avhAccYear: true,
      avhVoucherRefno: true,
      avhVoucherDate: true,
      avhVoucherStatus: true,
    },
  });
  if (!header) {
    return null;
  }
  const totals = await deriveVoucherTotals(tx, header.avhVoucherId, header.avhAccYear);
  return {
    voucherId: header.avhVoucherId,
    accYear: header.avhAccYear,
    voucherRefno: header.avhVoucherRefno,
    voucherDate: toDateString(header.avhVoucherDate) ?? '',
    voucherStatus: header.avhVoucherStatus,
    totalDebit: toAmount(totals.totalDebit),
    totalCredit: toAmount(totals.totalCredit),
  };
}

/** The legs of a voucher, for the drill-down. */
export async function loadVoucherLegs(
  tx: Prisma.TransactionClient,
  voucherId: string,
  accYear: string,
): Promise<ChequeVoucherLeg[]> {
  const legs = await tx.accVoucher.findMany({
    where: { avVoucherId: voucherId, avAccYear: accYear, avIsDeleted: false },
    orderBy: { avRowNo: 'asc' },
    select: {
      avRowNo: true,
      avDrCr: true,
      avLedgerId: true,
      avAmount: true,
      avRole: true,
      avRemarks: true,
      ledger: { select: { ledName: true } },
    },
  });
  return legs.map((leg) => ({
    rowNo: leg.avRowNo,
    drCr: leg.avDrCr,
    ledgerId: leg.avLedgerId,
    ledgerName: leg.ledger?.ledName ?? '',
    amount: toAmount(leg.avAmount),
    role: leg.avRole,
    remarks: leg.avRemarks,
  }));
}
