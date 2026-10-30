import { Prisma } from '@prisma/client';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from './txn-status-log.helper';

/**
 * Notes 90 A — a temporary credit's own trail in `txn_status_log`, keyed by
 * `atc_id` under doc type TEMP_CREDIT.
 *
 * Three writers move `acc_temp_credit.atc_status` and none of them used to say
 * so: the bill post creates it OPEN, the bill cancel / amend and a voided
 * TEMP_CR tender set CANCELLED, and `BillBalanceRecomputeService` walks it
 * OPEN → PARTIAL → SETTLED (and back on a reversal, or to WRITTEN_OFF) with a
 * raw UPDATE. The client's history grid (132) reads this trail by the row's id
 * — it read nothing, because nothing was written. Every writer now calls this
 * for each REAL transition; a recompute that moves nothing logs nothing.
 */

export interface TempCreditStatusRow {
  atcId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  /** The bill's refno — what the row is known as on every screen. */
  billRefno: string | null;
}

export interface TempCreditStatusStep {
  credit: TempCreditStatusRow;
  event: TxnStatusEvent;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  changedOn: Date;
  remarks: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
}

/** One step. `remarks` is built by the caller — see `movementRemark`. */
export async function appendTempCreditStatus(
  tx: Prisma.TransactionClient,
  step: TempCreditStatusStep,
): Promise<void> {
  await appendTxnStatusLog(tx, {
    companyId: step.credit.companyId,
    branchId: step.credit.branchId,
    tenantId: step.credit.tenantId ?? null,
    accYear: step.credit.accYear,
    srcModule: TxnStatusSrcModule.SALES,
    srcDocType: TxnStatusDocType.TEMP_CREDIT,
    srcDocId: step.credit.atcId,
    srcDocRefno: step.credit.billRefno,
    event: step.event,
    fromStatus: step.fromStatus,
    toStatus: step.toStatus,
    changedOn: step.changedOn,
    changedBy: step.changedBy,
    remarks: step.remarks,
    deviceId: step.deviceId ?? null,
    sessionId: step.sessionId ?? null,
  });
}

/** The event a settlement step files under, from the status it lands on. */
export function settlementEventOf(toStatus: string, fromStatus: string): TxnStatusEvent {
  switch (toStatus) {
    case 'PARTIAL':
      // PARTIAL after SETTLED / WRITTEN_OFF is a reversal giving the balance back.
      return fromStatus === 'OPEN' ? TxnStatusEvent.PARTIAL : TxnStatusEvent.REOPENED;
    case 'SETTLED':
      return TxnStatusEvent.SETTLED;
    case 'WRITTEN_OFF':
      return TxnStatusEvent.WRITTEN_OFF;
    case 'OPEN':
      return TxnStatusEvent.REOPENED;
    case 'CANCELLED':
      return TxnStatusEvent.CANCELLED;
    default:
      return TxnStatusEvent.STATUS_CHANGED;
  }
}

/**
 * "received 10.00 by RCT/0012, balance 200.00" — the remark of a settlement
 * step. `before` − `after` is what moved: positive = received, negative = a
 * reversal that gave the balance back.
 */
export function movementRemark(
  before: Prisma.Decimal,
  after: Prisma.Decimal,
  toStatus: string,
  refno: string | null,
): string {
  const delta = before.minus(after).toDecimalPlaces(2);
  const by = refno ? ` by ${refno}` : '';
  const balance = `balance ${after.toFixed(2)}`;
  if (delta.greaterThan(0)) {
    const verb = toStatus === 'WRITTEN_OFF' ? 'written off' : 'received';
    return `${verb} ${delta.toFixed(2)}${by}, ${balance}`;
  }
  if (delta.lessThan(0)) {
    return `reversed ${delta.negated().toFixed(2)}${by}, ${balance}`;
  }
  return `${balance}${by}`;
}
