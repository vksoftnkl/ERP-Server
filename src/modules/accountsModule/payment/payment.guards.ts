import { Prisma } from '@prisma/client';
import {
  throwAccountsBadRequest,
  throwAccountsNotFound,
  type AccountsWriteClient,
} from 'src/common/utils/module-service.utils';
import { isMoneyLedger, loadLedgerFacts } from '../vouchers/voucher-facts';
import {
  accYearOf,
  assertAccYearWritable,
  assertVoucherPartitionExists,
  lockBills,
  type LockedBill,
} from '../receipt/receipt.guards';
import type { PaymentErrorDetail } from './types/payment-api.types';
import {
  HELD_DEBIT_BILL_TYPES,
  PAYABLE_BILL_TYPES,
  PAYMENT_VOUCHER_TYPE_CODE,
} from './types/payment-enum';

/**
 * The checks shared by the payment's services. The year, the partition and
 * the row locks are the receipt's own functions, re-exported: they know
 * nothing about direction. What is the payment's own is the PAYEE and the
 * side of the bills.
 */

export type PaymentWriteClient = AccountsWriteClient;
export { accYearOf, assertAccYearWritable, assertVoucherPartitionExists, lockBills };
export type { LockedBill };

// ─── D1 — the payee ──────────────────────────────────────────────────────────

export interface PaymentParty {
  ledId: string;
  ledName: string;
  ledIsBillByBill: boolean;
  ledIsTdsApplicable: boolean;
  /** `led_tds_nature_of_payment` — the section (194C, 194J…). */
  ledTdsSection: string | null;
  ledTdsDeducteeType: string | null;
  ledPanNo: string | null;
  groupName: string | null;
  /** notes (56): under Cash-in-Hand / Bank Accounts / Bank OD A/c. */
  isMoneyLedger: boolean;
}

/**
 * D1, as the receipt's R5: ANY live party ledger the company can see is the
 * payee — a supplier, a customer being refunded, a director being repaid. One
 * refusal the receipt does not have: a CASH or BANK ledger. Paying money from
 * one bank account to another is a Contra, and posting it as a payment would
 * put a "supplier" in the payables list who is our own bank.
 *
 * The reads (`/open-items`, `/party-context`) pass `allowMoneyLedger` and
 * REPORT the fact instead, so the screen can grey the party out with a reason
 * before a single figure is keyed; every write refuses.
 */
export async function loadPayee(
  client: PaymentWriteClient,
  companyId: string,
  partyId: string,
  field = 'avhPartyId',
  options: { allowMoneyLedger?: boolean } = {},
): Promise<PaymentParty> {
  const facts = (
    await loadLedgerFacts(client as Prisma.TransactionClient, companyId, [partyId])
  ).get(partyId);
  if (!facts || facts.isDeleted) {
    throwAccountsNotFound<PaymentErrorDetail>(
      'Party not found',
      field,
      `No ledger ${partyId} is visible to this company`,
    );
  }
  if (!facts.isActive) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      { field, message: `"${facts.name}" is inactive and cannot be paid` },
    ]);
  }
  const money = isMoneyLedger(facts);
  if (money && !options.allowMoneyLedger) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      {
        field,
        message:
          `"${facts.name}" is a cash / bank ledger (${facts.groupName}). Moving money between ` +
          'cash and bank is a Contra — use the Voucher Register, not a payment.',
      },
    ]);
  }
  return {
    ledId: facts.ledId,
    ledName: facts.name,
    ledIsBillByBill: facts.isBillByBill,
    ledIsTdsApplicable: facts.isTdsApplicable,
    ledTdsSection: facts.tdsSection?.trim() || null,
    ledTdsDeducteeType: facts.tdsDeducteeType,
    ledPanNo: facts.pan?.trim() || null,
    groupName: facts.groupName || null,
    isMoneyLedger: money,
  };
}

// ─── The voucher type ────────────────────────────────────────────────────────

export interface PaymentVoucherType {
  vchrTypeId: number;
  vchrTypeCode: string;
  vchrTypeName: string;
}

/** The 'Pmt' voucher type, BY CODE — the id is a serial and differs per box. */
export async function loadPaymentVoucherType(
  client: PaymentWriteClient,
): Promise<PaymentVoucherType> {
  const type = await client.accVoucherType.findFirst({
    where: { vchrTypeCode: PAYMENT_VOUCHER_TYPE_CODE },
    select: { vchrTypeId: true, vchrTypeCode: true, vchrTypeName: true, vchrIsActive: true },
  });
  if (!type || !type.vchrIsActive) {
    throwAccountsNotFound<PaymentErrorDetail>(
      'Payment voucher type is not configured',
      'avhVoucherTypeId',
      `accounts.acc_voucher_types has no active row with vchr_type_code = '${PAYMENT_VOUCHER_TYPE_CODE}'. ` +
        'Run migration 20260929090000.',
    );
  }
  return {
    vchrTypeId: type.vchrTypeId,
    vchrTypeCode: type.vchrTypeCode,
    vchrTypeName: type.vchrTypeName,
  };
}

// ─── The four keys ───────────────────────────────────────────────────────────

export function assertHeaderScope(
  header: {
    avhVoucherId: string;
    avhCompanyId: string;
    avhBranchId: string;
    avhAccYear: string;
  },
  keys: { companyId: string; branchId: string; accYear: string; voucherId: string },
): void {
  if (
    header.avhCompanyId !== keys.companyId ||
    header.avhBranchId !== keys.branchId ||
    header.avhAccYear !== keys.accYear
  ) {
    throwAccountsNotFound<PaymentErrorDetail>(
      'Payment not found',
      'avhVoucherId',
      `No payment ${keys.voucherId} at this company / branch / year`,
    );
  }
}

// ─── §5.2 step 3 — a bill on the right side ──────────────────────────────────

/**
 * A bill named by a post has to BE the thing the post thinks it is: alive,
 * this party's, this company's, and on the right side of their account. A
 * PAYABLE is CR (we owe them); a held DEBIT is DR (they hold ours) — the
 * mirror of the receipt's rule, and the reason a supplier who is also a
 * customer cannot have a sales invoice "paid" by a payment.
 */
export function assertPayableUsable(
  bill: LockedBill | undefined,
  expect: {
    billId: string;
    partyId: string;
    companyId: string;
    kind: 'PAYABLE' | 'DEBIT';
    field: string;
  },
): LockedBill {
  if (!bill || bill.ablIsDeleted) {
    throwAccountsNotFound<PaymentErrorDetail>(
      'Bill not found',
      expect.field,
      `No live bill ${expect.billId}`,
    );
  }
  if (bill.ablPartyId !== expect.partyId) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      { field: expect.field, message: `Bill ${bill.ablDocRefno} belongs to another party` },
    ]);
  }
  if (bill.ablCompanyId !== expect.companyId) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      { field: expect.field, message: `Bill ${bill.ablDocRefno} belongs to another company` },
    ]);
  }
  const allowed: readonly string[] =
    expect.kind === 'PAYABLE' ? PAYABLE_BILL_TYPES : HELD_DEBIT_BILL_TYPES;
  if (!allowed.includes(bill.ablBillType)) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      {
        field: expect.field,
        message:
          `Bill ${bill.ablDocRefno} is a ${bill.ablBillType} bill and cannot be settled as ` +
          `${expect.kind === 'PAYABLE' ? 'a payable' : 'a debit we hold'} by a payment`,
      },
    ]);
  }
  const wantSide = expect.kind === 'PAYABLE' ? 'CR' : 'DR';
  if (bill.ablDrCr !== wantSide) {
    throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
      {
        field: expect.field,
        message:
          `Bill ${bill.ablDocRefno} sits on the ${bill.ablDrCr} side of this party's account, ` +
          `and a ${expect.kind === 'PAYABLE' ? 'payable' : 'held debit'} must be ${wantSide}`,
      },
    ]);
  }
  return bill;
}
