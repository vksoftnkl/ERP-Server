import { Prisma } from '@prisma/client';
import { throwAccountsConflict } from 'src/common/utils/module-service.utils';
import { BillType, CANCELLABLE_PDC_STATUSES } from './types/receipt-enum';
import { receiptChequeFilter, type ReceiptChequeScope } from './receipt-cheque-links';
import { ZERO } from './receipt.utils';
import type { ReceiptErrorDetail } from './types/receipt-api.types';

/**
 * The two refusals that guard EVERY unwind of a posted receipt, whichever
 * route is doing the unwinding.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THESE LIVE HERE AND NOT IN THE CANCEL SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `/cancel` and `/amend` are different documents-level operations — one unmakes
 * a receipt, the other restates it — but they take the money apart the same
 * way, so they must refuse on the same facts. R20 says so in as many words:
 * *"The refusal list in §4 is identical either way, so no client can amend past
 * an instrument that has left the drawer."*
 *
 * Two copies of that list is how the copies drift, and the day they drift is
 * the day `accounts.allow_posted_amend` quietly becomes a way around a rule
 * cancel still enforces — which is exactly what the setting is NOT. One
 * definition, two callers.
 *
 * These are facts about the WORLD, not rules about the software, which is why
 * no setting can make them negotiable: a bank has acted on the cheque, or the
 * money is already somewhere else. Neither is undone by a company preference.
 */

/** What the refusal message calls the thing being attempted. */
export type UnwindVerb = 'cancelled' | 'amended';

function refusal(verb: UnwindVerb): string {
  return `Receipt cannot be ${verb}`;
}

/**
 * Refuse when any cheque of the receipt has gone past HELD.
 *
 * Once an instrument has left the drawer the bank's record and ours have to
 * agree, and a receipt that never existed — or that now says something else —
 * cannot have produced the deposit slip that is already lodged. Deposited money
 * is unwound on the Received Cheques screen (menu 51), which owns the
 * instrument's lifecycle, and only then may the receipt behind it be touched.
 *
 * This is the refusal that defines the window amend actually serves, and the
 * window is the one that matters: a cheque still in the drawer, minutes after
 * entry. That is where the reported pain is.
 *
 * ── Which cheques are "the receipt's" ─────────────────────────────────────
 *
 * `receiptChequeFilter`, and NOT `apd_voucher_id` on its own. A re-presented
 * cheque has that column repointed at its re-issue voucher, and a guard reading
 * it alone decided the receipt had no cheque at all — then let an amend through
 * that reversed nothing and settled a second bill with money the customer never
 * paid twice. See `receipt-cheque-links.ts` for the measured case.
 */
export async function assertChequesStillHeld(
  tx: Prisma.TransactionClient,
  scope: ReceiptChequeScope,
  verb: UnwindVerb,
): Promise<void> {
  const moved = await tx.accPdcRegister.findMany({
    where: {
      ...(await receiptChequeFilter(tx, scope)),
      apdIsDeleted: false,
      apdStatus: { notIn: [...CANCELLABLE_PDC_STATUSES] },
    },
    select: { apdInstrumentNo: true, apdStatus: true },
  });

  if (moved.length > 0) {
    const first = moved[0];
    throwAccountsConflict<ReceiptErrorDetail>(refusal(verb), [
      {
        field: 'avhVoucherId',
        message:
          `Cheque ${first.apdInstrumentNo} is ${first.apdStatus}. Once an instrument has left ` +
          'the drawer the receipt behind it cannot be unmade — unwind it on the Received ' +
          'Cheques screen first.',
      },
    ]);
  }
}

/**
 * Refuse when the on-account remainder this receipt produced has been spent.
 *
 * The ADVANCE bill is money the company holds and has not earned. If a later
 * receipt has already applied part of it to somebody's invoice, taking it back
 * leaves that invoice settled by money that no longer exists — and the later
 * receipt, which did nothing wrong, is the document that ends up wrong.
 *
 * Returns the advances so the caller can retire them, because it has just read
 * exactly the rows the caller is about to soft-delete and a second read would
 * be a second answer to the same question.
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
      throwAccountsConflict<ReceiptErrorDetail>(refusal(verb), [
        {
          field: 'avhVoucherId',
          message:
            `The on-account balance from ${advance.ablDocRefno} has already been used — ` +
            `${advance.ablBillAmount.minus(pending).toFixed(2)} of it is settling another bill. ` +
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
