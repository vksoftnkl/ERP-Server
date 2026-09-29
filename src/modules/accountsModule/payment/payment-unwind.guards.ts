import { Prisma } from '@prisma/client';
import { throwAccountsConflict } from 'src/common/utils/module-service.utils';
import { BillType, CANCELLABLE_PDC_STATUSES } from './types/payment-enum';
import { paymentChequeFilter, type PaymentChequeScope } from './payment-cheque-links';
import { ZERO } from '../receipt/receipt.utils';
import type { PaymentErrorDetail } from './types/payment-api.types';

/**
 * The refusals that guard EVERY unwind of a posted payment — cancel and amend
 * alike, one definition (R20 §4). The receipt's two, mirrored, plus the one
 * the plan adds for a payment (§3): a transfer the bank has SETTLED.
 */

export type UnwindVerb = 'cancelled' | 'amended';

function refusal(verb: UnwindVerb): string {
  return `Payment cannot be ${verb}`;
}

/**
 * Refuse when any cheque of the payment has gone past HELD — presented,
 * returned, replaced. Once the bank has acted on our cheque the payment behind
 * it cannot be unmade here; the instrument is unwound on the Issued Cheques
 * screen (menu 52) first.
 */
export async function assertIssuedChequesStillHeld(
  tx: Prisma.TransactionClient,
  scope: PaymentChequeScope,
  verb: UnwindVerb,
): Promise<void> {
  const moved = await tx.accPdcRegister.findMany({
    where: {
      ...(await paymentChequeFilter(tx, scope)),
      apdIsDeleted: false,
      apdStatus: { notIn: [...CANCELLABLE_PDC_STATUSES] },
    },
    select: { apdInstrumentNo: true, apdStatus: true },
  });
  if (moved.length > 0) {
    const first = moved[0];
    throwAccountsConflict<PaymentErrorDetail>(refusal(verb), [
      {
        field: 'avhVoucherId',
        message:
          `Cheque ${first.apdInstrumentNo} is ${first.apdStatus}. Once our cheque has been acted on ` +
          `the payment behind it cannot be ${verb} here — unwind it on the Issued Cheques screen ` +
          '(menu 52) first.',
      },
    ]);
  }
}

/**
 * Refuse when a transfer row of the payment has been marked SETTLED by the
 * bank reconciliation: the money has demonstrably left, and a payment that
 * "never existed" cannot have produced the bank statement line.
 */
export async function assertNoSettledTransfer(
  tx: Prisma.TransactionClient,
  paymentVoucherId: string,
  verb: UnwindVerb,
): Promise<void> {
  const settled = await tx.accTenderDetail.findFirst({
    where: { tdSrcDocId: paymentVoucherId, tdIsDeleted: false, tdSettleStatus: 'SETTLED' },
    select: { tdRowNo: true, tdRefNo: true, tdSettledOn: true },
  });
  if (settled) {
    throwAccountsConflict<PaymentErrorDetail>(refusal(verb), [
      {
        field: 'avhVoucherId',
        message:
          `Tender row ${settled.tdRowNo}${settled.tdRefNo ? ` (${settled.tdRefNo})` : ''} is SETTLED ` +
          `by the bank${settled.tdSettledOn ? ` on ${settled.tdSettledOn.toISOString().slice(0, 10)}` : ''}. ` +
          `A payment the bank has cleared cannot be ${verb} — reverse it with a receipt from the party.`,
      },
    ]);
  }
}

/**
 * Refuse when the on-account remainder this payment produced — the ADVANCE
 * (DR) bill, what the supplier holds of ours — has been spent against a later
 * purchase bill. Returns the advances so the caller can retire them.
 */
export async function assertAdvancesUntouched(
  tx: Prisma.TransactionClient,
  voucherIds: readonly string[],
  years: readonly string[],
  verb: UnwindVerb,
): Promise<Array<{ ablId: string; ablAccYear: string; ablDocRefno: string }>> {
  const advances = await tx.accBillBalance.findMany({
    where: {
      ablVoucherId: { in: [...voucherIds] },
      ablAccYear: { in: [...years] },
      ablBillType: BillType.ADVANCE,
      ablIsDeleted: false,
    },
    select: {
      ablId: true,
      ablAccYear: true,
      ablDocRefno: true,
      ablBillAmount: true,
      ablPendingAmount: true,
    },
  });
  for (const advance of advances) {
    const pending = advance.ablPendingAmount ?? ZERO;
    if (!pending.equals(advance.ablBillAmount)) {
      throwAccountsConflict<PaymentErrorDetail>(refusal(verb), [
        {
          field: 'avhVoucherId',
          message:
            `The advance from ${advance.ablDocRefno} has already been used — ` +
            `${advance.ablBillAmount.minus(pending).toFixed(2)} of it is settling a purchase bill. ` +
            'Reverse that settlement first.',
        },
      ]);
    }
  }
  return advances.map((advance) => ({
    ablId: advance.ablId,
    ablAccYear: advance.ablAccYear,
    ablDocRefno: advance.ablDocRefno,
  }));
}
