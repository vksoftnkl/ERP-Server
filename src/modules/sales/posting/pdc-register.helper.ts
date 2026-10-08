import { Prisma } from '@prisma/client';
import { throwSalesBadRequest, type SalesErrorDetail } from 'src/common/utils/module-service.utils';
// accounts.acc_tender_types.ttm_type_id 5 — CHEQUE, seeded by
// prisma/migrations/20260731080000_add_tender_types_and_master. A tender line
// carrying this type is a physical instrument the company now holds, and an
// instrument has a life of its own after the sale: it is deposited, it clears,
// it bounces. None of that fits in acc_tender_detail, which only records what
// was tendered, so every cheque also opens a row in accounts.acc_pdc_register.
//
// The one definition of "a sales document registers its cheques": the sale
// order (order-pdc-posting.helper.ts) and the sale bill
// (bill/bill-pdc-posting.helper.ts) both run through here, so the mapping from
// a tender row to a register row cannot drift between them.
export const CHEQUE_TENDER_TYPE_ID = 5;
// ck_apd_instrument. Tender type 5 is a cheque; DD / pay order / mandates are
// their own tender types and are not registered from here.
const CHEQUE_INSTRUMENT_TYPE = 'CHEQUE';
// ck_apd_tra_type: R = receivable — a customer's cheque we hold. A sales
// document only ever takes money in, so the payable direction never arises.
const PDC_TRA_TYPE_RECEIVABLE = 'R';
// ck_apd_status values this helper writes. Everything past HELD (DEPOSITED,
// CLEARED, BOUNCED, …) belongs to the PDC screen, not to the document.
export const PDC_STATUS_HELD = 'HELD';
export const PDC_STATUS_CANCELLED = 'CANCELLED';
// ck_apd_posting_mode. ON_RECEIPT: the tender ledger was debited and the party
// credited the moment the money was taken. ck_apd_posting then insists the
// voucher is named.
const PDC_POSTING_ON_RECEIPT = 'ON_RECEIPT';
const PDC_POSTING_ON_CLEARING = 'ON_CLEARING';
// Column widths: apd_instrument_no VarChar(30), apd_bank_name VarChar(100),
// apd_drawer_name VarChar(150), apd_cancel_reason VarChar(250).
const INSTRUMENT_NO_MAX_LENGTH = 30;
const BANK_NAME_MAX_LENGTH = 100;
const DRAWER_NAME_MAX_LENGTH = 150;
const BANK_BRANCH_MAX_LENGTH = 100;
const CANCEL_REASON_MAX_LENGTH = 250;
// ck_apd_dates: apd_instrument_date within [received − 3 months,
// received + 1 year]. Stated here so the refusal names the cheque instead of
// being a bare 23514.
const INSTRUMENT_DATE_MONTHS_BACK = 3;
const INSTRUMENT_DATE_YEARS_FORWARD = 1;
const ZERO = new Prisma.Decimal(0);
/// The sales document whose instruments are being registered, in the terms the
/// register needs. Each caller maps its own header onto this.
export interface PdcDocument {
  // acc_tender_detail.td_src_module / td_src_doc_type / td_src_doc_id —
  // acc_pdc_register has no source-document columns of its own (it names the
  // tender row, apd_tender_id), so the document's instruments are found by way
  // of its tenders.
  srcModule: string;
  srcDocType: string;
  docId: string;
  companyId: string;
  branchId: string;
  tenantId: string | null;
  // The document's FY: apd_acc_year (the partition key) is the year the
  // instrument was RECEIVED in.
  accYear: string;
  refno: string;
  // The day the instrument arrived: apd_received_on, and the anchor of
  // ck_apd_dates.
  docDate: Date;
  // The customer's LEDGER id — customer and ledger share a primary key.
  partyId: string;
  // The drawer, unless a third party signed the cheque, which acc_tender_detail
  // has nowhere to say.
  partyName: string | null;
  salesmanId: string | null;
  // apd_status_by on the rows this call opens.
  userId: string | null;
}
/// How a caller words its refusals and how strict it is.
export interface PdcDocumentRules {
  // "order" / "bill" — slotted into every message.
  label: string;
  // The sale order has always refused a cheque dated before the order; a bill
  // takes a current cheque written a few days earlier, which ck_apd_dates
  // allows, so the bill only enforces the table's own window.
  refuseBackdated: boolean;
  // Refuse, naming the cheque, what ck_apd_dates would refuse as a bare 23514
  // (more than 3 months back or 1 year forward of the document date).
  checkDateWindow: boolean;
  // A register row past HELD is no longer the document's to change or remove.
  // Unset → a 400 naming the cheque (the order's historic answer).
  onMoved?: (row: StoredPdcRow, change: 'changed' | 'removed') => never;
}
/// One acc_tender_detail row, as far as the cheque register cares.
export interface PdcTenderLine {
  tdId: string;
  tdRowNo: number;
  // accounts.acc_tender_types.ttm_type_id — 5 is what puts the line here.
  tdTenderTypeId: number;
  // The instrument's face. td_total_amt, not td_amount: a cheque is written for
  // the whole sum it settles, surcharge included (ck_td_total_amt keeps the two
  // in step).
  tdTotalAmt: Prisma.Decimal;
  // acc_tender_types.ttm_ref_label for CHEQUE is 'Cheque No', so td_ref_no is
  // where the instrument number lives.
  tdRefNo: string | null;
  // The post-date written on the cheque.
  tdInstrumentDate: Date | null;
  tdBankName: string | null;
  // The tender's settlement ledger — our own bank, where the cheque will be
  // deposited.
  tdSettleLedgerId: string | null;
  tdNotes: string | null;
  // notes (48) — drawer / bank branch / IFSC / MICR, which the tender row has
  // no columns for. `undefined` = not sent: a new row falls back to the party
  // as drawer, and an existing row keeps what it holds. `null` or an object =
  // sent: written as given (a null drawer still falls back to the party).
  cheque?: PdcChequeDetail | null;
}
/// The instrument details a tender row cannot hold (TenderChequeDetailDto).
export interface PdcChequeDetail {
  drawerName?: string | null;
  bankBranch?: string | null;
  ifsc?: string | null;
  micr?: string | null;
}
/// The voucher the instrument was taken through. ck_apd_posting: an ON_RECEIPT
/// row must name its voucher, and both halves of the composite key travel
/// together.
export interface PdcVoucher {
  voucherId: string;
  accYear: string;
}
/// The stored register row, as far as the guards care.
export interface StoredPdcRow {
  apdId: string;
  apdAccYear: string;
  apdTenderId: string;
  apdInstrumentNo: string;
  apdStatus: string;
}
/// Brings accounts.acc_pdc_register in line with the cheques on a document:
///   * a cheque tender with no register row opens one, HELD
///   * a cheque tender that already has one re-syncs it (amount, cheque number,
///     date, bank — and the voucher, unless `keepStoredVoucher`)
///   * a register row whose tender is gone, voided, paid by something other
///     than a cheque, or no longer carries money is CANCELLED
///
/// `tenders` must be the document's LIVE tenders: a line left out is a line
/// whose cheque is cancelled.
///
/// Keyed off the tender row (apd_tender_id), never off a client-writable
/// column, so a payload cannot point a document at someone else's instrument.
/// Must run inside the caller's transaction.
export async function syncDocPdcRegister(
  tx: Prisma.TransactionClient,
  doc: PdcDocument,
  rules: PdcDocumentRules,
  tenders: PdcTenderLine[],
  voucher: PdcVoucher | null,
  actor: string,
  now: Date,
  opts: { keepStoredVoucher?: boolean; removedReason: string },
): Promise<string[]> {
  const cheques = toRegistrableCheques(tenders);
  const existing = await findDocPdcRows(tx, doc);
  if (cheques.length === 0 && existing.length === 0) {
    return [];
  }
  ensureNoRepeatedInstrument(cheques, rules);
  // The rows whose cheque is gone go FIRST: an edit that re-keys the same
  // cheque on a fresh tender row (new td_id, same number) must find the old
  // row already cancelled, or ux_apd_instrument sees the cheque twice.
  const liveTenderIds = new Set(cheques.map((cheque) => cheque.tdId));
  for (const row of existing) {
    if (liveTenderIds.has(row.apdTenderId)) {
      continue;
    }
    ensureInstrumentIsHeld(row, 'removed', rules);
    await cancelPdcRow(tx, row, opts.removedReason, doc.userId, actor, now, false);
  }
  await ensureInstrumentsAreFree(tx, doc, rules, cheques);
  const received = startOfUtcDay(doc.docDate);
  const byTender = new Map(existing.map((row) => [row.apdTenderId, row]));
  const registered: string[] = [];
  for (const cheque of cheques) {
    const stored = byTender.get(cheque.tdId);
    const data = {
      apdCompanyId: doc.companyId,
      apdBranchId: doc.branchId,
      apdTenantId: doc.tenantId,
      apdTraType: PDC_TRA_TYPE_RECEIVABLE,
      apdPartyId: doc.partyId,
      apdSalesmanId: doc.salesmanId,
      apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
      apdInstrumentNo: requireInstrumentNo(cheque, rules),
      apdInstrumentDate: requireInstrumentDate(cheque, received, rules),
      apdAmount: cheque.tdTotalAmt,
      apdBankName: cheque.tdBankName?.slice(0, BANK_NAME_MAX_LENGTH) ?? null,
      apdReceivedOn: received,
      apdBankLedgerId: cheque.tdSettleLedgerId ?? null,
      apdTenderId: cheque.tdId,
      apdRemarks: describeCheque(cheque, doc, rules),
    };
    // Left out of an update when the caller did not send them, so an edit
    // from a screen that never keyed them does not wipe what one did.
    const detailData =
      stored && cheque.cheque === undefined ? {} : toDetailData(cheque.cheque ?? null, doc);
    const voucherData = {
      apdPostingMode: voucher ? PDC_POSTING_ON_RECEIPT : PDC_POSTING_ON_CLEARING,
      apdVoucherId: voucher?.voucherId ?? null,
      apdVoucherAccYear: voucher?.accYear ?? null,
    };
    if (stored) {
      // An instrument the bank has already seen is no longer the document's to
      // move: its later events (deposit slip, clearing or bounce voucher) are
      // all stated against these very columns.
      ensureInstrumentIsHeld(stored, 'changed', rules);
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: stored.apdId, apdAccYear: stored.apdAccYear } },
        data: {
          ...data,
          ...detailData,
          ...(opts.keepStoredVoucher ? {} : voucherData),
          apdModifiedOn: now,
          apdModifiedBy: actor,
        },
      });
      registered.push(stored.apdId);
      continue;
    }
    const created = await tx.accPdcRegister.create({
      data: {
        ...data,
        ...detailData,
        ...voucherData,
        apdAccYear: doc.accYear,
        apdStatus: PDC_STATUS_HELD,
        apdStatusOn: now,
        apdStatusBy: doc.userId,
        apdCreatedOn: now,
        apdCreatedBy: actor,
      },
      select: { apdId: true },
    });
    registered.push(created.apdId);
  }
  return registered;
}
/// Takes every instrument the document holds out of the register, because it
/// stopped holding money (its voucher was cancelled) or went altogether.
///
/// `deleted`: a document that still exists only CANCELS its instruments — the
/// row stays for audit, and ux_apd_instrument skips it so the same cheque can
/// be tendered again — whereas a deleted document also retires them.
export async function cancelDocPdcRegister(
  tx: Prisma.TransactionClient,
  doc: Pick<PdcDocument, 'srcModule' | 'srcDocType' | 'docId' | 'accYear'>,
  rules: PdcDocumentRules,
  reason: string,
  deleted: boolean,
  statusBy: string | null,
  actor: string,
  now: Date,
): Promise<string[]> {
  const existing = await findDocPdcRows(tx, doc);
  // Every row is checked before any is cancelled, so a refusal leaves nothing
  // half-done.
  for (const row of existing) {
    ensureInstrumentIsHeld(row, 'removed', rules);
  }
  for (const row of existing) {
    await cancelPdcRow(tx, row, reason, statusBy, actor, now, deleted);
  }
  return existing.map((row) => row.apdId);
}
/// Refuses when any instrument the document holds has moved past HELD — for a
/// caller that must know BEFORE it starts undoing anything else.
export async function assertDocPdcHeld(
  tx: Prisma.TransactionClient,
  doc: Pick<PdcDocument, 'srcModule' | 'srcDocType' | 'docId' | 'accYear'>,
  rules: PdcDocumentRules,
): Promise<void> {
  for (const row of await findDocPdcRows(tx, doc)) {
    ensureInstrumentIsHeld(row, 'removed', rules);
  }
}
/// Every live (not CANCELLED, not deleted) instrument this document holds.
/// acc_pdc_register names the TENDER row it came in on, so the document's own
/// instruments are whatever hangs off its tender lines — deleted and voided ones
/// included, since a cheque line removed on an edit is precisely the row that
/// must now be cancelled.
export async function findDocPdcRows(
  tx: Prisma.TransactionClient,
  doc: Pick<PdcDocument, 'srcModule' | 'srcDocType' | 'docId' | 'accYear'>,
): Promise<StoredPdcRow[]> {
  const tenders = await tx.accTenderDetail.findMany({
    where: {
      tdSrcModule: doc.srcModule,
      tdSrcDocType: doc.srcDocType,
      tdSrcDocId: doc.docId,
    },
    select: { tdId: true },
  });
  if (tenders.length === 0) {
    return [];
  }
  const rows = await tx.accPdcRegister.findMany({
    where: {
      // Registered in the year it was received in, which is the document's own
      // — so the read stays on one partition.
      apdAccYear: doc.accYear,
      apdTenderId: { in: tenders.map((tender) => tender.tdId) },
      apdIsDeleted: false,
      apdStatus: { not: PDC_STATUS_CANCELLED },
    },
    select: {
      apdId: true,
      apdAccYear: true,
      apdTenderId: true,
      apdInstrumentNo: true,
      apdStatus: true,
    },
  });
  // apd_tender_id is nullable on the table; every row read here has one by
  // construction.
  return rows.filter((row): row is StoredPdcRow => row.apdTenderId !== null);
}
// ── internals ──────────────────────────────────────────────────────────────
// ck_apd_amount insists an instrument is worth something, so a zero-value line
// registers nothing and gives up whatever row it had, exactly as a zero tender
// posts no ledger line.
function toRegistrableCheques(tenders: PdcTenderLine[]): PdcTenderLine[] {
  return tenders
    .filter(
      (tender) =>
        tender.tdTenderTypeId === CHEQUE_TENDER_TYPE_ID &&
        (tender.tdTotalAmt ?? ZERO).greaterThan(0),
    )
    .sort((left, right) => left.tdRowNo - right.tdRowNo);
}
function refuse(message: string): never {
  throwSalesBadRequest<SalesErrorDetail>('Cheque cannot be registered', [
    { field: 'tenders', message },
  ]);
}
function requireInstrumentNo(cheque: PdcTenderLine, rules: PdcDocumentRules): string {
  const instrumentNo = cheque.tdRefNo?.trim();
  if (!instrumentNo) {
    refuse(
      `Tender line ${cheque.tdRowNo} is a cheque but carries no cheque number. ` +
        'Send it as tdRefNo — the cheque register is keyed by it.',
    );
  }
  void rules;
  return instrumentNo.slice(0, INSTRUMENT_NO_MAX_LENGTH);
}
// apd_instrument_date is the date written on the cheque and is what the due
// list works from, so it is required.
function requireInstrumentDate(
  cheque: PdcTenderLine,
  received: Date,
  rules: PdcDocumentRules,
): Date {
  if (!cheque.tdInstrumentDate) {
    refuse(
      `Tender line ${cheque.tdRowNo} is a cheque but carries no cheque date. ` +
        'Send it as tdInstrumentDate — it is the date the instrument matures on.',
    );
  }
  const instrumentDate = startOfUtcDay(cheque.tdInstrumentDate);
  if (rules.refuseBackdated && instrumentDate.getTime() < received.getTime()) {
    refuse(
      `Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, ` +
        `before the ${rules.label} date ${toDateText(received)}. A cheque cannot mature ` +
        'before the day it was received.',
    );
  }
  if (!rules.checkDateWindow) {
    return instrumentDate;
  }
  const earliest = new Date(received);
  earliest.setUTCMonth(earliest.getUTCMonth() - INSTRUMENT_DATE_MONTHS_BACK);
  const latest = new Date(received);
  latest.setUTCFullYear(latest.getUTCFullYear() + INSTRUMENT_DATE_YEARS_FORWARD);
  if (instrumentDate.getTime() < earliest.getTime()) {
    refuse(
      `Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, more than three ` +
        `months before the ${rules.label} date ${toDateText(received)} — the bank would refuse ` +
        'it as stale.',
    );
  }
  if (instrumentDate.getTime() > latest.getTime()) {
    refuse(
      `Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, more than a year ` +
        `after the ${rules.label} date ${toDateText(received)}. Check the year on the cheque.`,
    );
  }
  return instrumentDate;
}
// ux_apd_instrument makes (company, party, instrument type, number, year)
// unique among live rows, so one payload cannot tender the same cheque twice.
function ensureNoRepeatedInstrument(cheques: PdcTenderLine[], rules: PdcDocumentRules): void {
  const seen = new Map<string, number>();
  for (const cheque of cheques) {
    const instrumentNo = requireInstrumentNo(cheque, rules);
    const firstRow = seen.get(instrumentNo);
    if (firstRow !== undefined) {
      refuse(
        `Cheque ${instrumentNo} is tendered twice on this ${rules.label} (lines ${firstRow} and ` +
          `${cheque.tdRowNo}). One cheque can only be taken once.`,
      );
    }
    seen.set(instrumentNo, cheque.tdRowNo);
  }
}
// The same index again, against instruments already registered for this
// customer — usually on another document. Checked here so the answer names the
// cheque rather than being a raw 23505.
async function ensureInstrumentsAreFree(
  tx: Prisma.TransactionClient,
  doc: PdcDocument,
  rules: PdcDocumentRules,
  cheques: PdcTenderLine[],
): Promise<void> {
  if (cheques.length === 0) {
    return;
  }
  const numbers = cheques.map((cheque) => requireInstrumentNo(cheque, rules));
  const clashes = await tx.accPdcRegister.findMany({
    where: {
      apdCompanyId: doc.companyId,
      apdAccYear: doc.accYear,
      apdPartyId: doc.partyId,
      apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
      apdInstrumentNo: { in: numbers },
      apdIsDeleted: false,
      apdStatus: { not: PDC_STATUS_CANCELLED },
    },
    select: { apdInstrumentNo: true, apdTenderId: true },
  });
  const ownTenderIds = new Set(cheques.map((cheque) => cheque.tdId));
  for (const clash of clashes) {
    // A row this document already owns is an edit, not a clash.
    if (clash.apdTenderId && ownTenderIds.has(clash.apdTenderId)) {
      continue;
    }
    refuse(
      `Cheque ${clash.apdInstrumentNo} is already registered for this customer in ` +
        `${doc.accYear}. The same instrument cannot be taken twice.`,
    );
  }
}
// Once the bank has the cheque the document is no longer what tells its story:
// the deposit slip, the clearing voucher and the bounce charges all hang off the
// register row.
function ensureInstrumentIsHeld(
  row: StoredPdcRow,
  change: 'changed' | 'removed',
  rules: PdcDocumentRules,
): void {
  if (row.apdStatus === PDC_STATUS_HELD) {
    return;
  }
  if (rules.onMoved) {
    rules.onMoved(row, change);
  }
  throwSalesBadRequest<SalesErrorDetail>(`Cheque cannot be ${change}`, [
    {
      field: 'tenders',
      message:
        `Cheque ${row.apdInstrumentNo} on this ${rules.label} is ${row.apdStatus} in the cheque ` +
        `register, so it can no longer be ${change} from the ${rules.label}. ` +
        'Settle it on the PDC screen first.',
    },
  ]);
}
// Cancelled rather than hard deleted: ux_apd_instrument skips CANCELLED and
// deleted rows, so the cheque number is freed while the row stays for audit.
async function cancelPdcRow(
  tx: Prisma.TransactionClient,
  row: StoredPdcRow,
  reason: string,
  statusBy: string | null,
  actor: string,
  now: Date,
  deleted: boolean,
): Promise<void> {
  await tx.accPdcRegister.update({
    where: { apdId_apdAccYear: { apdId: row.apdId, apdAccYear: row.apdAccYear } },
    data: {
      apdStatus: PDC_STATUS_CANCELLED,
      // ck_apd_cancelled: a cancellation must say why.
      apdCancelReason: reason.slice(0, CANCEL_REASON_MAX_LENGTH),
      apdCancelDate: startOfUtcDay(now),
      apdStatusOn: now,
      apdStatusBy: statusBy,
      apdIsActive: false,
      ...(deleted ? { apdIsDeleted: true } : {}),
      apdModifiedOn: now,
      apdModifiedBy: actor,
    },
  });
}
function toDetailData(detail: PdcChequeDetail | null, doc: PdcDocument) {
  return {
    apdDrawerName:
      (detail?.drawerName?.trim() || doc.partyName)?.slice(0, DRAWER_NAME_MAX_LENGTH) ?? null,
    apdBankBranch: detail?.bankBranch?.trim().slice(0, BANK_BRANCH_MAX_LENGTH) || null,
    apdIfsc: detail?.ifsc?.trim().toUpperCase() || null,
    apdMicr: detail?.micr?.trim() || null,
  };
}
/// notes (48) — the `cheque` objects a save payload carried, by the td_id the
/// tender sync persisted each row under: matched by td_id when the row sent
/// one, else by the row number the sync gave it (`tdRowNo ?? position`). Only
/// live CHEQUE rows; a row that did not send `cheque` has no entry.
export function matchChequeDetails(
  payload: readonly {
    tdId?: string;
    tdRowNo?: number;
    cheque?: PdcChequeDetail | null;
  }[],
  persisted: readonly {
    tdId: string;
    tdRowNo: number;
    tdTenderTypeId: number | string;
    tdIsDeleted?: boolean | null;
  }[],
): Record<string, PdcChequeDetail | null> {
  const live = persisted.filter(
    (row) => !row.tdIsDeleted && Number(row.tdTenderTypeId) === CHEQUE_TENDER_TYPE_ID,
  );
  const out: Record<string, PdcChequeDetail | null> = {};
  payload.forEach((sent, index) => {
    if (sent.cheque === undefined) {
      return;
    }
    const rowNo = sent.tdRowNo ?? index + 1;
    const row = sent.tdId
      ? live.find((r) => r.tdId === sent.tdId)
      : live.find((r) => r.tdRowNo === rowNo);
    if (row) {
      out[row.tdId] = sent.cheque
        ? {
            drawerName: sent.cheque.drawerName ?? null,
            bankBranch: sent.cheque.bankBranch ?? null,
            ifsc: sent.cheque.ifsc ?? null,
            micr: sent.cheque.micr ?? null,
          }
        : null;
    }
  });
  return out;
}
/// The four details as a register row holds them, for a read that echoes them
/// back on the tender row (`/bills/get`, the order's read).
export async function readPdcChequeDetails(
  client: Prisma.TransactionClient,
  tenderIds: readonly string[],
): Promise<Map<string, Required<PdcChequeDetail>>> {
  if (tenderIds.length === 0) {
    return new Map();
  }
  const rows = await client.accPdcRegister.findMany({
    where: {
      apdTenderId: { in: [...tenderIds] },
      apdIsDeleted: false,
      apdStatus: { not: PDC_STATUS_CANCELLED },
    },
    select: {
      apdTenderId: true,
      apdDrawerName: true,
      apdBankBranch: true,
      apdIfsc: true,
      apdMicr: true,
    },
  });
  return new Map(
    rows
      .filter((row) => row.apdTenderId !== null)
      .map((row) => [
        row.apdTenderId!,
        {
          drawerName: row.apdDrawerName,
          bankBranch: row.apdBankBranch,
          ifsc: row.apdIfsc,
          micr: row.apdMicr,
        },
      ]),
  );
}
function describeCheque(cheque: PdcTenderLine, doc: PdcDocument, rules: PdcDocumentRules): string {
  const note = cheque.tdNotes?.trim();
  const base = `Cheque tendered against ${rules.label} ${doc.refno}`;
  return note ? `${base} (${note})` : base;
}
// apd_instrument_date / apd_received_on / apd_cancel_date are DATE columns, and
// ck_apd_dates compares them as dates, so everything is brought to UTC midnight
// first.
function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}
function toDateText(value: Date): string {
  return value.toISOString().slice(0, 10);
}
