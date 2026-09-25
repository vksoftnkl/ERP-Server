import { Prisma, SaleBill } from '@prisma/client';
import {
  assertDocPdcHeld,
  cancelDocPdcRegister,
  CHEQUE_TENDER_TYPE_ID,
  syncDocPdcRegister,
  type PdcDocument,
  type PdcDocumentRules,
  type PdcTenderLine,
  type StoredPdcRow,
} from '../posting/pdc-register.helper';
import { throwSalesLocked } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
/// A sale bill's cheques in accounts.acc_pdc_register (notes 46).
///
/// A CHEQUE tender (type 5) posts like cash — DR the tender ledger (Cheques In
/// Hand), CR the party, inside the bill's own voucher — but the money is still a
/// piece of paper. The register row is what lets it be deposited, cleared or
/// bounced, and what /bills/retender's SALES_RETENDER_PDC_MOVED guard reads.
///
/// The mapping is the sale order's (../posting/pdc-register.helper.ts): one
/// row per cheque, tra type R, HELD, ON_RECEIPT naming the bill's voucher,
/// apd_tender_id = the td row.
///
/// Lifecycle:
///   * post (and the re-post of an amend) — syncBillPdcRegister: a td row that
///     kept its id keeps its register row; a new cheque opens one; one that is
///     gone or voided is CANCELLED
///   * cancel — cancelBillPdcRegister
///   * cancel / amend refuse up front (409 SALES_BILL_PDC_MOVED) while any cheque
///     is past HELD — assertBillPdcHeld, run before the IRN is touched
///   * re-tender — syncBillPdcRegister with the CONTRA voucher for the new rows
const BILL_SRC_MODULE = 'SALES';
const BILL_SRC_DOC_TYPE = 'SALE_BILL';
const TENDER_REMOVED_CANCEL_REASON = 'Cheque no longer tendered on the sale bill';
const BILL_CANCELLED_REASON_PREFIX = 'Sale bill cancelled';
const BILL_RULES: PdcDocumentRules = {
  label: 'bill',
  // A current cheque written a few days before the bill is ordinary at a
  // counter; ck_apd_dates' own window (3 months back) is the only limit.
  refuseBackdated: false,
  checkDateWindow: true,
  onMoved: (row: StoredPdcRow, change) =>
    throwSalesLocked(
      `Cheque ${row.apdInstrumentNo} on this bill is ${row.apdStatus} in the cheque register, so ` +
        `it can no longer be ${change} from the bill. Settle it on the Cheques screen first ` +
        '(a bounced cheque is a bounce, not a bill edit).',
      SALES_ERROR_CODES.BILL_PDC_MOVED,
      'tenders',
    ),
};
/// The subset of the bill header the register needs.
export type BillPdcSource = Pick<
  SaleBill,
  | 'sbId'
  | 'sbCompanyId'
  | 'sbBranchId'
  | 'sbTenantId'
  | 'sbAccYear'
  | 'sbBillRefno'
  | 'sbBillDate'
  | 'sbCustId'
  | 'sbCustName'
  | 'sbSalesmanId'
  | 'sbUserId'
>;
/// Registers the bill's live cheque tenders against `voucher`.
///
/// `voucher` names the voucher the NEW rows were posted through — the bill's own
/// on post, the re-tender's contra on /bills/retender. With `keepStoredVoucher`
/// a row that already exists keeps the voucher it was registered with (a
/// re-tender does not move the cheques it leaves alone).
export async function syncBillPdcRegister(
  tx: Prisma.TransactionClient,
  bill: BillPdcSource,
  voucher: { voucherId: string; accYear: string },
  actor: string,
  now: Date,
  opts: { keepStoredVoucher?: boolean } = {},
): Promise<string[]> {
  const doc = toPdcDocument(bill);
  if (!doc) {
    return [];
  }
  const tenders = await loadLiveTenders(tx, bill);
  return syncDocPdcRegister(tx, doc, BILL_RULES, tenders, voucher, actor, now, {
    keepStoredVoucher: opts.keepStoredVoucher,
    removedReason: TENDER_REMOVED_CANCEL_REASON,
  });
}
/// Cancel: every HELD cheque the bill holds → CANCELLED. The bill's voucher is
/// reversed by the caller, so the Cheques In Hand debit goes with it.
export async function cancelBillPdcRegister(
  tx: Prisma.TransactionClient,
  bill: Pick<BillPdcSource, 'sbId' | 'sbAccYear' | 'sbUserId'>,
  reason: string,
  actor: string,
  now: Date,
): Promise<string[]> {
  return cancelDocPdcRegister(
    tx,
    refOf(bill),
    BILL_RULES,
    `${BILL_CANCELLED_REASON_PREFIX}: ${reason}`,
    false,
    isUuid(bill.sbUserId) ? bill.sbUserId : null,
    actor,
    now,
  );
}
/// 409 SALES_BILL_PDC_MOVED when any of the bill's cheques is DEPOSITED,
/// CLEARED, BOUNCED, RETURNED or REPLACED.
export async function assertBillPdcHeld(
  tx: Prisma.TransactionClient,
  bill: Pick<BillPdcSource, 'sbId' | 'sbAccYear'>,
): Promise<void> {
  await assertDocPdcHeld(tx, refOf(bill), BILL_RULES);
}
function refOf(bill: Pick<BillPdcSource, 'sbId' | 'sbAccYear'>) {
  return {
    srcModule: BILL_SRC_MODULE,
    srcDocType: BILL_SRC_DOC_TYPE,
    docId: bill.sbId,
    accYear: bill.sbAccYear,
  };
}
// A bill with no customer ledger posts no voucher (postCore requires one), so
// there is no party to register the cheque against.
function toPdcDocument(bill: BillPdcSource): PdcDocument | null {
  if (!bill.sbCustId) {
    return null;
  }
  return {
    ...refOf(bill),
    companyId: bill.sbCompanyId,
    branchId: bill.sbBranchId,
    tenantId: bill.sbTenantId,
    refno: bill.sbBillRefno ?? bill.sbId,
    docDate: bill.sbBillDate,
    // Customer and ledger share a primary key.
    partyId: bill.sbCustId,
    partyName: bill.sbCustName,
    salesmanId: bill.sbSalesmanId?.[0] ?? null,
    userId: isUuid(bill.sbUserId) ? bill.sbUserId : null,
  };
}
// The LIVE tender rows: not deleted, not voided. td_is_voided is not on the
// Prisma model (the re-tender writes it raw), hence the raw read. A voided
// cheque is left out on purpose — that is what cancels its register row.
async function loadLiveTenders(
  tx: Prisma.TransactionClient,
  bill: Pick<BillPdcSource, 'sbId' | 'sbAccYear'>,
): Promise<PdcTenderLine[]> {
  const rows = await tx.$queryRaw<
    {
      td_id: string;
      td_row_no: number;
      td_tender_type_id: number;
      td_total_amt: Prisma.Decimal;
      td_ref_no: string | null;
      td_instrument_date: Date | null;
      td_bank_name: string | null;
      td_settle_ledger_id: string | null;
      td_notes: string | null;
    }[]
  >`
    SELECT td_id, td_row_no, td_tender_type_id, td_total_amt, td_ref_no, td_instrument_date,
           td_bank_name, td_settle_ledger_id, td_notes
      FROM accounts.acc_tender_detail
     WHERE td_src_module = ${BILL_SRC_MODULE} AND td_src_doc_type = ${BILL_SRC_DOC_TYPE}
       AND td_src_doc_id = ${bill.sbId}::uuid AND td_acc_year = ${bill.sbAccYear}::char(9)
       AND td_is_deleted = false AND td_is_voided = false
       AND td_tender_type_id = ${CHEQUE_TENDER_TYPE_ID}
     ORDER BY td_row_no`;
  return rows.map((row) => ({
    tdId: row.td_id,
    tdRowNo: Number(row.td_row_no),
    tdTenderTypeId: Number(row.td_tender_type_id),
    tdTotalAmt: new Prisma.Decimal(row.td_total_amt),
    tdRefNo: row.td_ref_no,
    tdInstrumentDate: row.td_instrument_date,
    tdBankName: row.td_bank_name,
    tdSettleLedgerId: row.td_settle_ledger_id,
    tdNotes: row.td_notes,
  }));
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
