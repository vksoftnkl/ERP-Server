import { Prisma } from '@prisma/client';
import {
  throwAccountsBadRequest,
  throwAccountsNotFound,
  type AccountsWriteClient,
} from 'src/common/utils/module-service.utils';
import type { ReceiptErrorDetail } from './types/receipt-api.types';
import {
  CREDIT_BILL_TYPES,
  RECEIPT_VOUCHER_TYPE_CODE,
  RECEIVABLE_BILL_TYPES,
} from './types/receipt-enum';
import { isValidAccYear } from './receipt.utils';

/**
 * The checks that belong to no single endpoint, shared by the four services so
 * a rule is written once.
 *
 * Each is either something ONLY the service can enforce (§7) or something the
 * database enforces with a message nobody can read — a 23514 naming
 * `ck_abl_settled` is true and useless.
 */

export type ReceiptWriteClient = AccountsWriteClient;

// ─── §5.1 rule 2 / §5.2 step 2 — a writable year ─────────────────────────────

/**
 * `fy_status` and `fy_lock_date` both live on `public.fiscal_years`, and a
 * receipt is exactly the document that gets keyed into a year somebody closed
 * last week.
 *
 * A year with no `fiscal_years` row is ALLOWED. Plenty of companies are opened
 * before their years are set up, and refusing here would make the receipt
 * depend on a master screen nobody has run — the same rule the opening-balance
 * module settled on.
 *
 * Note this is checked for EVERY date a post touches, not just the receipt's:
 * a post-dated cheque dated after the year end would otherwise post a voucher
 * into a year the accountant has locked (§5.2 step 2).
 */
export async function assertAccYearWritable(
  client: ReceiptWriteClient,
  companyId: string,
  accYear: string,
  field: string,
): Promise<void> {
  if (!isValidAccYear(accYear)) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      {
        field,
        message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
      },
    ]);
  }

  const year = await client.fiscalYear.findFirst({
    where: { compId: companyId, fyYearName: accYear, isDeleted: false },
    select: { fyStatus: true, fyLockDate: true, fyYearName: true },
  });

  if (!year) {
    return;
  }
  if (year.fyStatus !== 'OPEN') {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      {
        field,
        message: `Accounting year ${year.fyYearName} is ${year.fyStatus} and cannot be written to`,
      },
    ]);
  }
  if (year.fyLockDate && year.fyLockDate.getTime() <= Date.now()) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      {
        field,
        message: `Accounting year ${year.fyYearName} was locked on ${year.fyLockDate
          .toISOString()
          .slice(0, 10)} and cannot be written to`,
      },
    ]);
  }
}

/**
 * Which accounting year a date falls in, for the Indian April–March year every
 * `acc_year` column in this database is shaped for.
 *
 * A post-dated cheque dated 2027-04-02 against a receipt in 2026-2027 belongs
 * to 2027-2028, and its voucher has to land in that partition — which is also
 * the year `assertAccYearWritable` must then be asked about.
 */
export function accYearOf(date: Date): string {
  const year = date.getUTCFullYear();
  // Months are 0-based: getUTCMonth() >= 3 is April onwards.
  const start = date.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${start + 1}`;
}

/**
 * The partition for a year must EXIST before a voucher is written into it.
 *
 * `acc_voucher_header` and `acc_vouchers` are LIST-partitioned on the year, and
 * a row with no partition fails with "no partition of relation
 * acc_voucher_header found for row" — a raw 500, at the moment an operator is
 * taking cheques. The receipt is the first document that routinely writes into
 * a year that is not the current one (a post-dated cheque dated 2 April posts
 * its voucher in the next year), so it is the first to hit it.
 *
 * Migration 20260915120000 teaches `public.ensure_acc_year_partitions` about
 * both tables and back-fills the years the rest of the system already has. This
 * check is what a database that has not had that migration applied gets
 * instead: a 400 naming the year and the function to run.
 */
export async function assertVoucherPartitionExists(
  tx: Prisma.TransactionClient,
  accYear: string,
  field: string,
): Promise<void> {
  const suffix = accYear.replace('-', '_');
  const rows = await tx.$queryRaw<Array<{ present: number }>>`
    SELECT count(*)::int AS present
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'accounts'
       AND c.relname IN (${`acc_voucher_header_${suffix}`}, ${`acc_vouchers_${suffix}`})`;

  if ((rows[0]?.present ?? 0) < 2) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Accounting year is not set up', [
      {
        field,
        message:
          `${accYear} has no voucher partitions. Run ` +
          `SELECT public.ensure_acc_year_partitions('${accYear}'); and try again.`,
      },
    ]);
  }
}

// ─── R5 — the party ──────────────────────────────────────────────────────────

export interface ReceiptParty {
  ledId: string;
  ledName: string;
  ledIsBillByBill: boolean;
  ledIsTdsApplicable: boolean;
  ledTdsDeducteeType: string | null;
  ledIsTcsApplicable: boolean;
  ledTanNo: string | null;
  groupName: string | null;
  groupNature: string | null;
}

/**
 * R5 — the picker offers PARTY ledgers, but ANY live ledger the company can see
 * is accepted, with an empty panel if it holds no bills.
 *
 * Accepted and not merely offered, because a deposit refund, a director's loan
 * repayment and a staff advance recovery are all money received against a
 * ledger that is not a debtor, and refusing them would send the operator to a
 * journal screen to do something the receipt screen does perfectly well.
 *
 * Visibility is the same rule the whole accounts module uses: a global ledger
 * (`led_company_id IS NULL`) or one this company owns. The foreign key proves
 * the ledger EXISTS; it says nothing about whether this company may use it,
 * which is why this cannot be left to the database.
 */
export async function loadParty(
  client: ReceiptWriteClient,
  companyId: string,
  partyId: string,
  field = 'avhPartyId',
): Promise<ReceiptParty> {
  const ledger = await client.accLedgerMaster.findFirst({
    where: {
      ledId: partyId,
      ledIsDeleted: false,
      OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
    },
    select: {
      ledId: true,
      ledName: true,
      ledIsActive: true,
      ledIsBillByBill: true,
      ledIsTdsApplicable: true,
      ledTdsDeducteeType: true,
      ledIsTcsApplicable: true,
      ledTanNo: true,
      accGroupMaster: { select: { accGroupName: true, accGroupNature: true } },
    },
  });

  if (!ledger) {
    throwAccountsNotFound<ReceiptErrorDetail>(
      'Party not found',
      field,
      `No ledger ${partyId} is visible to this company`,
    );
  }
  if (!ledger.ledIsActive) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      { field, message: `"${ledger.ledName}" is inactive and cannot receive a receipt` },
    ]);
  }

  return {
    ledId: ledger.ledId,
    ledName: ledger.ledName,
    ledIsBillByBill: ledger.ledIsBillByBill,
    ledIsTdsApplicable: ledger.ledIsTdsApplicable ?? false,
    ledTdsDeducteeType: ledger.ledTdsDeducteeType ?? null,
    ledIsTcsApplicable: ledger.ledIsTcsApplicable ?? false,
    ledTanNo: ledger.ledTanNo ?? null,
    groupName: ledger.accGroupMaster?.accGroupName ?? null,
    groupNature: ledger.accGroupMaster?.accGroupNature ?? null,
  };
}

// ─── The voucher type ────────────────────────────────────────────────────────

export interface ReceiptVoucherType {
  vchrTypeId: number;
  vchrTypeCode: string;
  vchrTypeName: string;
}

/**
 * The 'Rct' voucher type, BY CODE. `vchr_type_id` is a serial and differs
 * between environments; a hard-coded id posts receipts as whatever document
 * type happens to hold that number on the live box.
 */
export async function loadReceiptVoucherType(
  client: ReceiptWriteClient,
): Promise<ReceiptVoucherType> {
  const type = await client.accVoucherType.findFirst({
    where: { vchrTypeCode: RECEIPT_VOUCHER_TYPE_CODE },
    select: { vchrTypeId: true, vchrTypeCode: true, vchrTypeName: true, vchrIsActive: true },
  });

  if (!type || !type.vchrIsActive) {
    throwAccountsNotFound<ReceiptErrorDetail>(
      'Receipt voucher type is not configured',
      'avhVoucherTypeId',
      `accounts.acc_voucher_types has no active row with vchr_type_code = '${RECEIPT_VOUCHER_TYPE_CODE}'. ` +
        'Run migration 20260915120000.',
    );
  }

  return {
    vchrTypeId: type.vchrTypeId,
    vchrTypeCode: type.vchrTypeCode,
    vchrTypeName: type.vchrTypeName,
  };
}

// ─── The four keys ───────────────────────────────────────────────────────────

/**
 * Every route that acts on an existing voucher takes
 * `companyId · branchId · accYear · voucherId`, and this is what makes the
 * other three more than decoration.
 *
 * `(avh_voucher_id, avh_acc_year)` alone would name the row. The company and
 * the branch are checked because a uuid is a bearer token: anyone holding one
 * could otherwise post, read or cancel a receipt belonging to a company they
 * have no business in, and the database would see nothing wrong with it. The
 * failure is a 404 and not a 403 — a caller scoped to another company should
 * not be able to learn that this receipt exists.
 */
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
    throwAccountsNotFound<ReceiptErrorDetail>(
      'Receipt not found',
      'avhVoucherId',
      `No receipt ${keys.voucherId} at this company / branch / year`,
    );
  }
}

// ─── §5.2 step 3 — the row locks ─────────────────────────────────────────────

/** A bill as the posting path needs it, read under `FOR UPDATE`. */
export interface LockedBill {
  ablId: string;
  ablAccYear: string;
  ablPartyId: string;
  ablBillType: string;
  ablDocRefno: string;
  ablDocDate: Date;
  ablDueDate: Date | null;
  ablBillAmount: Prisma.Decimal;
  ablPendingAmount: Prisma.Decimal;
  ablDrCr: string;
  ablIsDeleted: boolean;
  ablCompanyId: string;
  ablBranchId: string;
}

interface LockedBillRow {
  abl_id: string;
  abl_acc_year: string;
  abl_party_id: string;
  abl_bill_type: string;
  abl_doc_refno: string;
  abl_doc_date: Date;
  abl_due_date: Date | null;
  abl_bill_amount: Prisma.Decimal;
  abl_pending_amount: Prisma.Decimal;
  abl_dr_cr: string;
  abl_is_deleted: boolean;
  abl_company_id: string;
  abl_branch_id: string;
}

/**
 * `SELECT … FOR UPDATE` on every bill and credit a post names, before anything
 * is read for the arithmetic.
 *
 * Two cashiers taking money for the same bill at the same moment is the ONE
 * concurrency case this module actually has, and this is the whole of its
 * answer: the second transaction blocks here, then re-reads
 * `abl_pending_amount` AFTER the first has committed, and the allocation
 * engine's own check (`amount + discount + writeoff <= pending`) turns it into
 * a 409 naming the bill. §9: "two concurrent posts against one bill: one 409,
 * never a 500."
 *
 * ORDER BY abl_id, so two receipts naming an overlapping set of bills take them
 * in the same order and cannot deadlock on each other. Prisma has no `FOR
 * UPDATE`, so this is raw — and it is the only raw statement in the module.
 */
export async function lockBills(
  tx: Prisma.TransactionClient,
  bills: readonly { billId: string; billAccYear: string }[],
): Promise<Map<string, LockedBill>> {
  if (bills.length === 0) {
    return new Map();
  }

  const ids = bills.map((bill) => bill.billId);
  const years = [...new Set(bills.map((bill) => bill.billAccYear))];

  const rows = await tx.$queryRaw<LockedBillRow[]>`
    SELECT abl_id, abl_acc_year, abl_party_id, abl_bill_type, abl_doc_refno,
           abl_doc_date, abl_due_date, abl_bill_amount, abl_pending_amount,
           abl_dr_cr, abl_is_deleted, abl_company_id, abl_branch_id
      FROM accounts.acc_bill_balance
     WHERE abl_id       = ANY(${ids}::uuid[])
       AND abl_acc_year = ANY(${years}::bpchar[])
     ORDER BY abl_id
       FOR UPDATE`;

  return new Map(
    rows.map((row) => [
      `${row.abl_id}|${row.abl_acc_year}`,
      {
        ablId: row.abl_id,
        ablAccYear: row.abl_acc_year,
        ablPartyId: row.abl_party_id,
        ablBillType: row.abl_bill_type,
        ablDocRefno: row.abl_doc_refno,
        ablDocDate: row.abl_doc_date,
        ablDueDate: row.abl_due_date,
        ablBillAmount: new Prisma.Decimal(row.abl_bill_amount),
        ablPendingAmount: new Prisma.Decimal(row.abl_pending_amount),
        ablDrCr: row.abl_dr_cr,
        ablIsDeleted: row.abl_is_deleted,
        ablCompanyId: row.abl_company_id,
        ablBranchId: row.abl_branch_id,
      },
    ]),
  );
}

/**
 * A bill named by a post has to BE the thing the post thinks it is: alive, this
 * party's, this company's, and on the right side of their account. Each of
 * these is a way for a well-formed request to settle somebody else's invoice.
 */
export function assertBillUsable(
  bill: LockedBill | undefined,
  expect: {
    billId: string;
    partyId: string;
    companyId: string;
    kind: 'RECEIVABLE' | 'CREDIT';
    field: string;
  },
): LockedBill {
  if (!bill || bill.ablIsDeleted) {
    throwAccountsNotFound<ReceiptErrorDetail>(
      'Bill not found',
      expect.field,
      `No live bill ${expect.billId}`,
    );
  }
  if (bill.ablPartyId !== expect.partyId) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      {
        field: expect.field,
        message: `Bill ${bill.ablDocRefno} belongs to another party`,
      },
    ]);
  }
  if (bill.ablCompanyId !== expect.companyId) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      { field: expect.field, message: `Bill ${bill.ablDocRefno} belongs to another company` },
    ]);
  }

  const allowed: readonly string[] =
    expect.kind === 'RECEIVABLE' ? RECEIVABLE_BILL_TYPES : CREDIT_BILL_TYPES;
  if (!allowed.includes(bill.ablBillType)) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      {
        field: expect.field,
        message:
          `Bill ${bill.ablDocRefno} is a ${bill.ablBillType} bill and cannot be settled as ` +
          `${expect.kind === 'RECEIVABLE' ? 'a receivable' : 'a credit'} by a receipt`,
      },
    ]);
  }
  // DR is what the party owes, CR is what they hold. A receipt collects the
  // first and spends the second; taking either from the wrong side would
  // deepen a debt while reporting that it had been paid.
  const wantSide = expect.kind === 'RECEIVABLE' ? 'DR' : 'CR';
  if (bill.ablDrCr !== wantSide) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      {
        field: expect.field,
        message:
          `Bill ${bill.ablDocRefno} sits on the ${bill.ablDrCr} side of this party's account, ` +
          `and a ${expect.kind === 'RECEIVABLE' ? 'receivable' : 'credit'} must be ${wantSide}`,
      },
    ]);
  }

  return bill;
}
