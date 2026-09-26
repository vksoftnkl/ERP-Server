import { Prisma } from '@prisma/client';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { PdcPostingMode, PdcStatus } from '../receipt/types/receipt-enum';
import { toAmount, toDateString, toIsoString } from '../receipt/receipt.utils';
import { dueBucketOf, type LockedCheque } from './cheques.guards';
import type { ChequeRow } from './types/cheque-api.types';

/**
 * The two things every endpoint in this module does: file a status step, and
 * hand the row back in the shape the screen reads.
 */

// ─── The trail ───────────────────────────────────────────────────────────────

/**
 * One `public.txn_status_log` row per STEP, which is what §6.2 and §7's last
 * check ("every transition appears in `history` with who and when") mean.
 *
 * ── `srcDocType` is OTHER, and that is the right answer ──────────────────
 * `ck_tsl_src_doc_type` admits fourteen document types and a cheque is none of
 * them. It is not a RECEIPT — the receipt has its own trail, under its own id,
 * and filing the cheque's deposits there would interleave two documents'
 * histories under one heading. The helper's own comment says OTHER exists "so
 * a new document type never forces an ALTER on the table", and this is that
 * case. `tsl_src_doc_id` is the cheque's own `apd_id`, so nothing is ambiguous.
 *
 * ── `accYear` is the CHEQUE's year ───────────────────────────────────────
 * `txn_status_log` is LIST-partitioned on `tsl_acc_year` and the register row
 * never leaves the partition of the year it arrived in — so a cheque received
 * in March and cleared in May files both steps in 2025-2026, beside each other,
 * which is the only way `history` reads as one story.
 */
export async function logChequeStatus(
  tx: Prisma.TransactionClient,
  cheque: Pick<
    LockedCheque,
    'apdId' | 'apdAccYear' | 'apdCompanyId' | 'apdBranchId' | 'apdTenantId' | 'apdInstrumentNo'
  >,
  entry: {
    fromStatus: PdcStatus | null;
    toStatus: PdcStatus;
    event?: TxnStatusEvent;
    remarks: string | null;
    actor: string;
    changedOn: Date;
    sessionId?: string | null;
  },
): Promise<void> {
  await appendTxnStatusLog(tx, {
    companyId: cheque.apdCompanyId,
    branchId: cheque.apdBranchId,
    tenantId: cheque.apdTenantId,
    accYear: cheque.apdAccYear,
    srcModule: TxnStatusSrcModule.ACCOUNTS,
    srcDocType: TxnStatusDocType.OTHER,
    srcDocId: cheque.apdId,
    srcDocRefno: cheque.apdInstrumentNo,
    event: entry.event ?? eventFor(entry.toStatus),
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    changedBy: entry.actor,
    changedOn: entry.changedOn,
    remarks: entry.remarks,
    sessionId: entry.sessionId ?? null,
  });
}

/**
 * Which `tsl_event` a status move files under.
 *
 * CANCELLED for the two ways a cheque leaves without being paid, because
 * `ck_tsl_reason_required` forces those to say why — and both of them do.
 * STATUS_CHANGED for everything else, which is honest: the helper's vocabulary
 * has no DEPOSITED or BOUNCED, and inventing tokens it does not define would
 * make this module's trail read differently from every other module's.
 * `tsl_to_status` carries the real word.
 */
function eventFor(status: PdcStatus): TxnStatusEvent {
  switch (status) {
    case PdcStatus.CANCELLED:
    case PdcStatus.RETURNED:
      return TxnStatusEvent.CANCELLED;
    case PdcStatus.CLEARED:
      return TxnStatusEvent.CLOSED;
    default:
      return TxnStatusEvent.STATUS_CHANGED;
  }
}

// ─── The row ─────────────────────────────────────────────────────────────────

export interface ChequeRowExtras {
  partyName: string;
  bankLedgerName: string | null;
  apdStatusOn?: Date | null;
  apdStatusBy?: string | null;
}

/**
 * A locked register row as the wire shape.
 *
 * `dueBucket` is computed here (§10 — "no stored due bucket"), from the same
 * four boundaries the grid's CASE uses. It is the one field on this row that
 * is a function of TODAY rather than of the row, which is exactly why no
 * column holds it: a stored copy would be wrong every morning.
 */
export function toChequeRow(cheque: LockedCheque, extras: ChequeRowExtras): ChequeRow {
  return {
    apdId: cheque.apdId,
    apdAccYear: cheque.apdAccYear,
    apdCompanyId: cheque.apdCompanyId,
    apdBranchId: cheque.apdBranchId,
    apdTraType: cheque.apdTraType,
    apdPartyId: cheque.apdPartyId,
    partyName: extras.partyName,
    apdInstrumentType: cheque.apdInstrumentType,
    apdInstrumentNo: cheque.apdInstrumentNo,
    apdInstrumentDate: toDateString(cheque.apdInstrumentDate) ?? '',
    apdAmount: toAmount(cheque.apdAmount),
    apdBankName: cheque.apdBankName,
    apdBankBranch: cheque.apdBankBranch,
    apdIfsc: cheque.apdIfsc,
    apdMicr: cheque.apdMicr,
    apdDrawerName: cheque.apdDrawerName,
    apdReceivedOn: toDateString(cheque.apdReceivedOn) ?? '',
    apdBankLedgerId: cheque.apdBankLedgerId,
    bankLedgerName: extras.bankLedgerName,
    apdPostingMode: cheque.apdPostingMode,
    apdStatus: cheque.apdStatus,
    dueBucket: dueBucketOf(cheque.apdInstrumentDate, cheque.apdStatus),
    apdPresentCount: cheque.apdPresentCount,
    apdDepositDate: toDateString(cheque.apdDepositDate),
    apdDepositSlipNo: cheque.apdDepositSlipNo,
    apdClearDate: toDateString(cheque.apdClearDate),
    apdBounceDate: toDateString(cheque.apdBounceDate),
    apdBounceReason: cheque.apdBounceReason,
    apdBounceCharges: toAmount(cheque.apdBounceCharges),
    apdRemarks: cheque.apdRemarks,
    apdStatusOn: toIsoString(extras.apdStatusOn ?? null),
    apdStatusBy: extras.apdStatusBy ?? null,
  };
}

/**
 * Re-read one row after a write and return it in wire shape, so what the
 * caller gets back is what the database now holds rather than what the service
 * believes it wrote.
 */
export async function reloadChequeRow(
  tx: Prisma.TransactionClient,
  apdId: string,
  apdAccYear: string,
): Promise<ChequeRow> {
  const row = await tx.accPdcRegister.findUniqueOrThrow({
    where: { apdId_apdAccYear: { apdId, apdAccYear } },
    include: {
      party: { select: { ledName: true } },
      bankLedger: { select: { ledName: true } },
    },
  });

  return toChequeRow(
    {
      ...row,
      apdAmount: new Prisma.Decimal(row.apdAmount),
      apdBounceCharges: new Prisma.Decimal(row.apdBounceCharges),
      apdPostingMode: row.apdPostingMode as PdcPostingMode,
      apdStatus: row.apdStatus as PdcStatus,
    },
    {
      partyName: row.party?.ledName ?? '',
      bankLedgerName: row.bankLedger?.ledName ?? null,
      apdStatusOn: row.apdStatusOn,
      apdStatusBy: row.apdStatusBy,
    },
  );
}
