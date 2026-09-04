import { Prisma } from '@prisma/client';
import { throwSalesBadRequest } from 'src/common/utils/module-service.utils';
import { SaleOrderErrorDetail, SaleOrderErrorResponse } from './types/sale-order-api.types';
// accounts.acc_tender_types.ttm_type_id 5 — CHEQUE, seeded by
// prisma/migrations/20260731080000_add_tender_types_and_master. A tender line
// carrying this type is a physical instrument the company now holds, and an
// instrument has a life of its own after the sale: it is deposited, it clears,
// it bounces. None of that fits in acc_tender_detail, which only records what
// was tendered, so every cheque also opens a row in accounts.acc_pdc_register.
export const CHEQUE_TENDER_TYPE_ID = 5;
// ck_apd_instrument. Tender type 5 is a cheque; DD / pay order / mandates are
// their own tender types and are not registered from here.
const CHEQUE_INSTRUMENT_TYPE = 'CHEQUE';
// ck_apd_tra_type: R = receivable — a customer's cheque we hold. An order only
// ever takes money in, so the payable direction never arises here.
const PDC_TRA_TYPE_RECEIVABLE = 'R';
// ck_apd_status values this helper writes. Everything past HELD (DEPOSITED,
// CLEARED, BOUNCED, …) belongs to the PDC screen, not to the order.
const PDC_STATUS_HELD = 'HELD';
const PDC_STATUS_CANCELLED = 'CANCELLED';
// ck_apd_posting_mode. The order's advance receipt is raised the moment the
// money is taken — the tender ledger is debited and the party credited on day
// one — which is exactly what ON_RECEIPT means. ck_apd_posting then insists the
// voucher is named, and it is.
const PDC_POSTING_ON_RECEIPT = 'ON_RECEIPT';
const PDC_POSTING_ON_CLEARING = 'ON_CLEARING';
// The same source pair the order's tender rows carry in acc_tender_detail
// (td_src_module / td_src_doc_type). acc_pdc_register has no source-document
// columns of its own — it names the tender row instead (apd_tender_id) — so the
// order's instruments are found by way of its tenders.
const ORDER_SRC_MODULE = 'SALES';
const ORDER_SRC_DOC_TYPE = 'SALES_ORDER';
// ck_apd_cancelled demands a reason on every CANCELLED / RETURNED row.
const TENDER_REMOVED_CANCEL_REASON = 'Cheque no longer tendered on the sale order';
const ORDER_UNPOSTED_CANCEL_REASON = 'Sale order no longer holds tendered money';
const ORDER_DELETED_CANCEL_REASON = 'Sale order deleted';
// Column widths: apd_instrument_no VarChar(30), apd_bank_name VarChar(100),
// apd_drawer_name VarChar(150), apd_cancel_reason VarChar(250).
const INSTRUMENT_NO_MAX_LENGTH = 30;
const BANK_NAME_MAX_LENGTH = 100;
const DRAWER_NAME_MAX_LENGTH = 150;
const CANCEL_REASON_MAX_LENGTH = 250;
const ZERO = new Prisma.Decimal(0);
/// Identifies the order whose instruments are being read, for the paths that run
/// from the stored row rather than from a whole order.
export interface OrderPdcRef {
  soId: string;
  soCompanyId: string;
  soAccYear: string;
}
/// The subset of a SaleOrder row the register needs. Declared structurally, like
/// OrderAdvancePostingSource, so the caller passes the Prisma row straight
/// through.
export interface OrderPdcSource extends OrderPdcRef {
  soBranchId: string;
  soTenantId: string | null;
  soOrderRefno: string;
  // The day the instrument arrived: apd_received_on, and the floor
  // ck_apd_dates puts under apd_instrument_date.
  soOrderDate: Date;
  soCustId: string;
  // Whoever the order is made out to — the drawer, unless a third party signed
  // the cheque, which acc_tender_detail has nowhere to say.
  soCustName: string;
  soSalesmanId: string[];
  soUserId: string;
}
/// One acc_tender_detail row, as far as the cheque register cares.
export interface OrderPdcTenderLine {
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
  // deposited (acc_tender_master.tnd_settlement_ledger_id, snapshotted onto the
  // line).
  tdSettleLedgerId: string | null;
  tdNotes: string | null;
}
/// The advance receipt the instrument was taken through. ck_apd_posting: an
/// ON_RECEIPT row must name its voucher, and both halves of the voucher's
/// composite key travel together.
export interface OrderPdcVoucher {
  voucherId: string;
  accYear: string;
}
/// Brings accounts.acc_pdc_register in line with the cheques on an order.
///
/// Runs on every create and update, off the order's live tender rows:
///   * a cheque tender with no register row opens one, HELD
///   * a cheque tender that already has one re-syncs it (amount, cheque number,
///     date, bank, voucher — a tender is editable until it is posted onward)
///   * a register row whose tender is gone, was paid by something other than a
///     cheque, or no longer carries money is CANCELLED
///
/// Keyed off the tender row (apd_tender_id), never off a client-writable
/// column, so a payload cannot point an order at someone else's instrument.
///
/// Must run inside the caller's transaction: an order holding a cheque with no
/// register row behind it is the inconsistency this prevents.
export async function syncOrderPdcRegister(
  tx: Prisma.TransactionClient,
  order: OrderPdcSource,
  tenders: OrderPdcTenderLine[],
  voucher: OrderPdcVoucher | null,
  actor: string,
  now: Date,
): Promise<string[]> {
  const cheques = toRegistrableCheques(tenders);
  const existing = await findOrderPdcRows(tx, order);
  if (cheques.length === 0 && existing.length === 0) {
    return [];
  }
  ensureNoRepeatedInstrument(cheques);
  await ensureInstrumentsAreFree(tx, order, cheques);
  const received = startOfUtcDay(order.soOrderDate);
  const byTender = new Map(existing.map((row) => [row.apdTenderId, row]));
  const registered: string[] = [];
  const kept = new Set<string>();
  for (const cheque of cheques) {
    const stored = byTender.get(cheque.tdId);
    const data = {
      apdCompanyId: order.soCompanyId,
      apdBranchId: order.soBranchId,
      apdTenantId: order.soTenantId,
      apdTraType: PDC_TRA_TYPE_RECEIVABLE,
      // Customer and ledger share a primary key, so soCustId is already the
      // acc_ledger_master id fk_apd_party wants.
      apdPartyId: order.soCustId,
      // acc_pdc_register carries a single salesman; the order carries an array.
      apdSalesmanId: order.soSalesmanId?.[0] ?? null,
      apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
      apdInstrumentNo: requireInstrumentNo(cheque),
      apdInstrumentDate: requireInstrumentDate(cheque, received),
      apdAmount: cheque.tdTotalAmt,
      apdBankName: cheque.tdBankName?.slice(0, BANK_NAME_MAX_LENGTH) ?? null,
      apdDrawerName: order.soCustName?.slice(0, DRAWER_NAME_MAX_LENGTH) ?? null,
      apdReceivedOn: received,
      apdBankLedgerId: cheque.tdSettleLedgerId ?? null,
      apdPostingMode: voucher ? PDC_POSTING_ON_RECEIPT : PDC_POSTING_ON_CLEARING,
      apdVoucherId: voucher?.voucherId ?? null,
      apdVoucherAccYear: voucher?.accYear ?? null,
      apdTenderId: cheque.tdId,
      apdRemarks: describeCheque(cheque, order),
    };
    if (stored) {
      // An instrument the bank has already seen is no longer the order's to
      // move: its later events (deposit slip, clearing or bounce voucher) are
      // all stated against these very columns.
      ensureInstrumentIsHeld(stored, 'changed');
      await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: stored.apdId, apdAccYear: stored.apdAccYear } },
        data: { ...data, apdModifiedOn: now, apdModifiedBy: actor },
      });
      kept.add(stored.apdId);
      registered.push(stored.apdId);
      continue;
    }
    const created = await tx.accPdcRegister.create({
      data: {
        ...data,
        // The FY the instrument was RECEIVED in — the order's own — and the
        // partition key. It routinely matures in a later year; that is the
        // register's business, not the order's.
        apdAccYear: order.soAccYear,
        apdStatus: PDC_STATUS_HELD,
        apdStatusOn: now,
        apdStatusBy: order.soUserId,
        apdCreatedOn: now,
        apdCreatedBy: actor,
      },
      select: { apdId: true },
    });
    registered.push(created.apdId);
  }
  for (const row of existing) {
    if (kept.has(row.apdId)) {
      continue;
    }
    ensureInstrumentIsHeld(row, 'removed');
    await cancelPdcRow(tx, row, TENDER_REMOVED_CANCEL_REASON, order.soUserId, actor, now, false);
  }
  return registered;
}
/// Takes every instrument the order holds out of the register, because the
/// order stopped holding money (its receipt was cancelled) or went altogether.
///
/// `deleted` is the difference between the two: an order that still exists only
/// CANCELS its instruments — the row stays for audit, and ux_apd_instrument
/// skips it so the same cheque can be tendered again — whereas a deleted order
/// also retires them, since nothing may keep pointing at a document that is
/// gone.
export async function cancelOrderPdcRegister(
  tx: Prisma.TransactionClient,
  order: OrderPdcRef,
  reason: 'unposted' | 'deleted',
  statusBy: string | null,
  actor: string,
  now: Date,
): Promise<string[]> {
  const existing = await findOrderPdcRows(tx, order);
  const cancelled: string[] = [];
  for (const row of existing) {
    ensureInstrumentIsHeld(row, 'removed');
    await cancelPdcRow(
      tx,
      row,
      reason === 'deleted' ? ORDER_DELETED_CANCEL_REASON : ORDER_UNPOSTED_CANCEL_REASON,
      statusBy,
      actor,
      now,
      reason === 'deleted',
    );
    cancelled.push(row.apdId);
  }
  return cancelled;
}
// ── internals ──────────────────────────────────────────────────────────────
// The stored register row, as far as this helper's guards care.
interface StoredPdcRow {
  apdId: string;
  apdAccYear: string;
  apdTenderId: string;
  apdInstrumentNo: string;
  apdStatus: string;
}
// The cheque tenders that can actually be registered. ck_apd_amount insists an
// instrument is worth something, so a zero-value line — a cheque edited down to
// nothing — registers nothing and gives up whatever row it had, exactly as a
// zero tender posts no ledger line.
function toRegistrableCheques(tenders: OrderPdcTenderLine[]): OrderPdcTenderLine[] {
  return tenders
    .filter(
      (tender) =>
        tender.tdTenderTypeId === CHEQUE_TENDER_TYPE_ID &&
        (tender.tdTotalAmt ?? ZERO).greaterThan(0),
    )
    .sort((left, right) => left.tdRowNo - right.tdRowNo);
}
// Every live instrument this order holds. acc_pdc_register names the TENDER row
// it came in on, so the order's own instruments are whatever hangs off its
// tender lines — deleted ones included, since a cheque line removed on an edit
// is precisely the row that must now be cancelled.
async function findOrderPdcRows(
  tx: Prisma.TransactionClient,
  order: OrderPdcRef,
): Promise<StoredPdcRow[]> {
  const tenders = await tx.accTenderDetail.findMany({
    where: {
      tdSrcModule: ORDER_SRC_MODULE,
      tdSrcDocType: ORDER_SRC_DOC_TYPE,
      tdSrcDocId: order.soId,
    },
    select: { tdId: true },
  });
  if (tenders.length === 0) {
    return [];
  }
  const rows = await tx.accPdcRegister.findMany({
    where: {
      // The instrument is registered in the year it was received in, which is
      // the order's own — so the read stays on one partition.
      apdAccYear: order.soAccYear,
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
  // apd_tender_id is nullable on the table (an instrument can be registered
  // without a tender behind it); every row read here has one by construction.
  return rows.filter((row): row is StoredPdcRow => row.apdTenderId !== null);
}
function requireInstrumentNo(cheque: OrderPdcTenderLine): string {
  const instrumentNo = cheque.tdRefNo?.trim();
  if (!instrumentNo) {
    throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      'Cheque cannot be registered',
      [
        {
          field: 'tenders',
          message:
            `Tender line ${cheque.tdRowNo} is a cheque but carries no cheque number. ` +
            'Send it as tdRefNo — the cheque register is keyed by it.',
        },
      ],
    );
  }
  return instrumentNo.slice(0, INSTRUMENT_NO_MAX_LENGTH);
}
// apd_instrument_date is the post-date written on the cheque and is what the
// due list works from, so it is required — and ck_apd_dates refuses one dated
// before the day it arrived, which the database would answer with a bare 23514.
function requireInstrumentDate(cheque: OrderPdcTenderLine, received: Date): Date {
  if (!cheque.tdInstrumentDate) {
    throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      'Cheque cannot be registered',
      [
        {
          field: 'tenders',
          message:
            `Tender line ${cheque.tdRowNo} is a cheque but carries no cheque date. ` +
            'Send it as tdInstrumentDate — it is the date the instrument matures on.',
        },
      ],
    );
  }
  const instrumentDate = startOfUtcDay(cheque.tdInstrumentDate);
  if (instrumentDate.getTime() < received.getTime()) {
    throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      'Cheque cannot be registered',
      [
        {
          field: 'tenders',
          message:
            `Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, ` +
            `before the order date ${toDateText(received)}. A cheque cannot mature ` +
            'before the day it was received.',
        },
      ],
    );
  }
  return instrumentDate;
}
// ux_apd_instrument makes (company, party, instrument type, number, year)
// unique among live rows, so one payload cannot tender the same cheque twice.
function ensureNoRepeatedInstrument(cheques: OrderPdcTenderLine[]): void {
  const seen = new Map<string, number>();
  for (const cheque of cheques) {
    const instrumentNo = requireInstrumentNo(cheque);
    const firstRow = seen.get(instrumentNo);
    if (firstRow !== undefined) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Cheque cannot be registered',
        [
          {
            field: 'tenders',
            message:
              `Cheque ${instrumentNo} is tendered twice on this order (lines ${firstRow} and ` +
              `${cheque.tdRowNo}). One cheque can only be taken once.`,
          },
        ],
      );
    }
    seen.set(instrumentNo, cheque.tdRowNo);
  }
}
// The same index again, this time against instruments already registered for
// this customer — usually on another document. Checked here so the answer names
// the cheque rather than being a raw 23505 the save path would report as a
// duplicate order number.
async function ensureInstrumentsAreFree(
  tx: Prisma.TransactionClient,
  order: OrderPdcSource,
  cheques: OrderPdcTenderLine[],
): Promise<void> {
  if (cheques.length === 0) {
    return;
  }
  const numbers = cheques.map((cheque) => requireInstrumentNo(cheque));
  const clashes = await tx.accPdcRegister.findMany({
    where: {
      apdCompanyId: order.soCompanyId,
      apdAccYear: order.soAccYear,
      apdPartyId: order.soCustId,
      apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
      apdInstrumentNo: { in: numbers },
      apdIsDeleted: false,
      apdStatus: { not: PDC_STATUS_CANCELLED },
    },
    select: { apdInstrumentNo: true, apdTenderId: true },
  });
  const ownTenderIds = new Set(cheques.map((cheque) => cheque.tdId));
  for (const clash of clashes) {
    // A row this order already owns is an edit, not a clash.
    if (clash.apdTenderId && ownTenderIds.has(clash.apdTenderId)) {
      continue;
    }
    throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      'Cheque cannot be registered',
      [
        {
          field: 'tenders',
          message:
            `Cheque ${clash.apdInstrumentNo} is already registered for this customer in ` +
            `${order.soAccYear}. The same instrument cannot be taken twice.`,
        },
      ],
    );
  }
}
// Once the bank has the cheque the order is no longer what tells its story: the
// deposit slip, the clearing voucher and the bounce charges all hang off the
// register row. The database would let the row be overwritten, so the rule is
// stated here instead.
function ensureInstrumentIsHeld(row: StoredPdcRow, change: 'changed' | 'removed'): void {
  if (row.apdStatus === PDC_STATUS_HELD) {
    return;
  }
  throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
    `Cheque cannot be ${change === 'changed' ? 'changed' : 'removed'}`,
    [
      {
        field: 'tenders',
        message:
          `Cheque ${row.apdInstrumentNo} on this order is ${row.apdStatus} in the cheque ` +
          `register, so it can no longer be ${change} from the order. ` +
          'Settle it on the PDC screen first.',
      },
    ],
  );
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
function describeCheque(cheque: OrderPdcTenderLine, order: OrderPdcSource): string {
  const note = cheque.tdNotes?.trim();
  const base = `Cheque tendered against order ${order.soOrderRefno}`;
  return note ? `${base} (${note})` : base;
}
// apd_instrument_date / apd_received_on / apd_cancel_date are DATE columns, and
// ck_apd_dates compares them as dates. A timestamp would make a cheque dated on
// the order's own day look earlier or later than it depending on the clock, so
// everything is brought to UTC midnight first.
function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}
function toDateText(value: Date): string {
  return value.toISOString().slice(0, 10);
}
