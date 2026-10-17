import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { throwUnprocessable } from '../utils/module-service.utils';
import { VCH, type VoucherErrorDetail } from '../../modules/accountsModule/vouchers/vouchers.errors';

/**
 * Notes 126 §1 — every line on a CASH or BANK ledger carries a tender.
 *
 * The ledger says WHERE the money sits (`led_ledger_type` CASH / BANK, derived
 * from Cash-in-Hand / Bank Accounts); the tender row (`acc_tender_detail`) says
 * HOW it moved. It is a label, like a cost centre: the legs, the trial balance
 * and every ledger balance stay what they were. With it the Day Book can be read
 * by tender, and a money line with no tender is a transaction to look into.
 *
 * Called by every writer of legs, right after it wrote them: `postLegs` (till,
 * register, expense, settlement, sales documents, stock), the receipt and the
 * payment, the cheque vouchers, the order advance. A reversal mirror is not
 * judged — it undoes a voucher that was.
 *
 * A line is COVERED by the voucher's own tender rows — `td_voucher_id` or
 * `td_src_doc_id` naming it (the register, receipts, payments, ExpV), or naming
 * the document behind it (a bill, a return, an order: `td_src_doc_id`, rows not
 * claimed by another voucher), or for a re-tender's contra the row it voided and
 * the rows that replaced it — summed per ledger and side. What is short:
 *
 *   CASH  the server labels it with the branch's CASH tender (the row naming
 *         this very ledger: till, safe, in transit, awaiting receipt);
 *   BANK  only where the module knows the tender — `bankTender` BANK (the bank's
 *         own BANK tender: a remittance, a settlement payout) or CHEQUE (a
 *         cheque's clearing / bounce) — else VCH_MONEY_LINE_NO_TENDER.
 *
 * No tender master fits → VCH_NO_TENDER_FOR_LEDGER, naming the ledger. Both are
 * 422s on an accounts document; a SALES document (the counter) is never refused
 * (the user's rule): what the server cannot label is logged, and the "money
 * lines with no tender" report lists it.
 *
 * The rows it writes are `td_src_doc_type 'VOUCHER'` (src doc = the voucher),
 * `td_src_module 'TILL'` for the till's own transfers. The till's drawer and
 * safe readers skip them: the movement already counts that cash.
 */

export const MONEY_LINE_SRC_DOC_TYPE = 'VOUCHER';
const CASH_TENDER_TYPE_ID = 1;
const CHEQUE_TENDER_TYPE_ID = 5;
const BANK_TENDER_TYPE_ID = 6;

type Tx = Prisma.TransactionClient;
type Side = 'DR' | 'CR';

/** The voucher a set of legs was written into. */
export interface MoneyLineScope {
  voucherId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  voucherDate: string;
  /** avh_src_module / doc type / doc id — null on a register voucher, which IS the document. */
  srcModule?: string | null;
  srcDocType?: string | null;
  srcDocId?: string | null;
  partyId?: string | null;
  sessionId?: string | null;
  deviceId?: string | null;
  /** user_master.usr_id — td_user_id. */
  userId: string;
  createdBy?: string | null;
  /** How the server may label a BANK line nothing covers (see above). */
  bankTender?: 'BANK' | 'CHEQUE' | null;
  /**
   * Tenders the document itself named for a ledger and side (a Contra line's
   * `tenderId`, already fitted to the ledger by the derive): used before any
   * server pick.
   */
  tenders?: readonly { ledgerId: string; drCr: Side; tenderId: string }[];
  /** What a refusal calls the document. */
  docLabel?: string | null;
}

export interface MoneyLeg {
  ledgerId: string;
  drCr: Side;
  amount: Prisma.Decimal | number | string;
}

/** A money line the server could not label (refused, or on a SALES document only reported). */
export interface MoneyLineGap {
  ledgerId: string;
  ledgerName: string;
  ledgerType: 'CASH' | 'BANK';
  drCr: Side;
  amount: number;
  code: string;
  message: string;
}

const logger = new Logger('MoneyLines');

export async function coverMoneyLines(
  tx: Tx,
  scope: MoneyLineScope,
  legs: readonly MoneyLeg[],
): Promise<{ written: number; gaps: MoneyLineGap[] }> {
  const need = new Map<string, { ledgerId: string; drCr: Side; amount: Prisma.Decimal }>();
  for (const l of legs) {
    const amount = new Prisma.Decimal(l.amount);
    if (!l.ledgerId || amount.isZero()) {
      continue;
    }
    const key = `${l.ledgerId}|${l.drCr}`;
    const row = need.get(key) ?? { ledgerId: l.ledgerId, drCr: l.drCr, amount: new Prisma.Decimal(0) };
    row.amount = row.amount.plus(amount);
    need.set(key, row);
  }
  const ids = [...new Set([...need.values()].map((n) => n.ledgerId))];
  if (ids.length === 0) {
    return { written: 0, gaps: [] };
  }
  const money = await tx.$queryRaw<{ led_id: string; led_name: string; kind: 'CASH' | 'BANK' }[]>`
    SELECT led_id::text, led_name, upper(led_ledger_type) AS kind
      FROM accounts.acc_ledger_master
     WHERE led_id = ANY(${ids}::uuid[]) AND upper(led_ledger_type) IN ('CASH', 'BANK')`;
  if (money.length === 0) {
    return { written: 0, gaps: [] };
  }
  const moneyById = new Map(money.map((m) => [m.led_id, m]));

  const have = await coveredAmounts(tx, scope);
  const gaps: MoneyLineGap[] = [];
  let written = 0;
  let rowNo = await nextRowNo(tx, scope);
  const partyFor = counterpartOf(legs, scope.partyId ?? null);

  for (const n of need.values()) {
    const ledger = moneyById.get(n.ledgerId);
    if (!ledger) {
      continue;
    }
    const short = n.amount.minus(have.get(`${n.ledgerId}|${n.drCr}`) ?? 0).toDecimalPlaces(2);
    if (short.lessThanOrEqualTo(0)) {
      continue;
    }
    const named = scope.tenders?.find((t) => t.ledgerId === n.ledgerId && t.drCr === n.drCr);
    const pick = named ? await namedTender(tx, named.tenderId) : await tenderFor(tx, scope, ledger);
    if ('code' in pick) {
      gaps.push({
        ledgerId: n.ledgerId,
        ledgerName: ledger.led_name,
        ledgerType: ledger.kind,
        drCr: n.drCr,
        amount: Number(short.toFixed(2)),
        code: pick.code,
        message: pick.message,
      });
      continue;
    }
    await tx.$executeRaw`
      INSERT INTO accounts.acc_tender_detail (
        td_company_id, td_branch_id, td_tenant_id, td_acc_year,
        td_src_module, td_src_doc_type, td_src_doc_id, td_row_no, td_doc_date,
        td_party_ledger_id, td_voucher_id,
        td_tender_id, td_tender_type_id, td_tender_ledger_id, td_dr_cr,
        td_amount, td_total_amt, td_session_id, td_device_id, td_user_id, td_created_by
      ) VALUES (
        ${scope.companyId}::uuid, ${scope.branchId}::uuid, ${scope.tenantId ?? null}::uuid,
        ${scope.accYear}::char(9),
        ${srcModuleOf(scope.srcModule)}, ${MONEY_LINE_SRC_DOC_TYPE}, ${scope.voucherId}::uuid,
        ${rowNo}::int, ${scope.voucherDate}::date,
        ${partyFor(n.ledgerId, n.drCr)}::uuid, ${scope.voucherId}::uuid,
        ${pick.tenderId}::uuid, ${pick.typeId}::int, ${n.ledgerId}::uuid, ${n.drCr}::char(2),
        ${short.toFixed(2)}::numeric, ${short.toFixed(2)}::numeric,
        ${scope.sessionId ?? null}::uuid, ${scope.deviceId ?? null}, ${scope.userId}::uuid,
        ${(scope.createdBy ?? 'SYSTEM').slice(0, 50)}
      )`;
    rowNo += 1;
    written += 1;
  }

  if (gaps.length > 0) {
    if ((scope.srcModule ?? '').toUpperCase() === 'SALES') {
      // The counter is never refused (the user's rule): reported instead.
      logger.warn(
        `${scope.docLabel ?? 'Voucher'} ${scope.voucherId}: ${gaps
          .map((g) => `${g.ledgerName} ${g.drCr} ${g.amount.toFixed(2)} (${g.code})`)
          .join('; ')} — no tender`,
      );
    } else {
      throwUnprocessable<VoucherErrorDetail>(
        `${scope.docLabel ?? 'The voucher'} has a cash / bank line with no tender`,
        gaps.map((g) => ({ field: 'tender', code: g.code, message: g.message })),
      );
    }
  }
  return { written, gaps };
}

/**
 * The same, for a voucher already written — by a module that writes its legs
 * itself (receipt, payment, the cheque vouchers, the order advance) or writes
 * its tender rows after them (the register's instruments: `money.deferred`).
 * Header and legs are read back, so the caller only names the voucher.
 */
export async function coverPostedVoucher(
  tx: Tx,
  voucher: { voucherId: string; accYear: string },
  opts: {
    bankTender?: 'BANK' | 'CHEQUE' | null;
    createdBy?: string | null;
    tenders?: MoneyLineScope['tenders'];
  } = {},
): Promise<{ written: number; gaps: MoneyLineGap[] }> {
  const [h] = await tx.$queryRaw<
    {
      company_id: string;
      branch_id: string;
      tenant_id: string | null;
      voucher_date: string;
      src_module: string | null;
      src_doc_type: string | null;
      src_doc_id: string | null;
      party_id: string | null;
      session_id: string | null;
      device_id: string | null;
      user_id: string | null;
      refno: string | null;
      created_by: string | null;
    }[]
  >`
    SELECT avh_company_id::text AS company_id, avh_branch_id::text AS branch_id,
           avh_tenant_id::text AS tenant_id, to_char(avh_voucher_date, 'YYYY-MM-DD') AS voucher_date,
           avh_src_module AS src_module, avh_src_doc_type AS src_doc_type,
           avh_src_doc_id::text AS src_doc_id, avh_party_id::text AS party_id,
           avh_session_id::text AS session_id, avh_device_id::text AS device_id,
           COALESCE(avh_user_id, avh_status_by)::text AS user_id,
           avh_voucher_refno AS refno, avh_created_by AS created_by
      FROM accounts.acc_voucher_header
     WHERE avh_voucher_id = ${voucher.voucherId}::uuid AND avh_acc_year = ${voucher.accYear}::char(9)`;
  if (!h || !h.user_id) {
    return { written: 0, gaps: [] };
  }
  const legs = await tx.$queryRaw<{ ledger_id: string; dr_cr: Side; amount: Prisma.Decimal }[]>`
    SELECT av_ledger_id::text AS ledger_id, trim(av_dr_cr) AS dr_cr, av_amount AS amount
      FROM accounts.acc_vouchers
     WHERE av_voucher_id = ${voucher.voucherId}::uuid AND av_acc_year = ${voucher.accYear}::char(9)
       AND av_is_deleted = false`;
  return coverMoneyLines(
    tx,
    {
      voucherId: voucher.voucherId,
      accYear: voucher.accYear,
      companyId: h.company_id,
      branchId: h.branch_id,
      tenantId: h.tenant_id,
      voucherDate: h.voucher_date,
      srcModule: h.src_module,
      srcDocType: h.src_doc_type,
      srcDocId: h.src_doc_id,
      partyId: h.party_id,
      sessionId: h.session_id,
      deviceId: h.device_id,
      userId: h.user_id,
      createdBy: opts.createdBy ?? h.created_by,
      bankTender: opts.bankTender ?? null,
      tenders: opts.tenders,
      docLabel: h.refno ? `Voucher ${h.refno}` : null,
    },
    legs.map((l) => ({ ledgerId: l.ledger_id, drCr: l.dr_cr, amount: l.amount })),
  );
}

/**
 * On a restated (amended) voucher the rows the server wrote for the old legs go
 * first, so the new legs are judged on their own.
 */
export async function retireMoneyLineRows(tx: Tx, voucherId: string, actor: string): Promise<void> {
  await tx.$executeRaw`
    UPDATE accounts.acc_tender_detail
       SET td_is_deleted = true, td_modified_on = now(), td_modified_by = ${actor.slice(0, 50)}
     WHERE td_voucher_id = ${voucherId}::uuid
       AND td_src_doc_type = ${MONEY_LINE_SRC_DOC_TYPE}
       AND td_is_deleted = false`;
}

/** Σ td_amount of the rows that already cover the voucher, per ledger and side. */
async function coveredAmounts(tx: Tx, scope: MoneyLineScope): Promise<Map<string, Prisma.Decimal>> {
  // A re-tender's contra is sourced on the tender row it voided (bill-retender).
  const replaced = scope.srcDocType === 'SALE_BILL_RETENDER' ? (scope.srcDocId ?? null) : null;
  const ownDoc = replaced ? null : (scope.srcDocId ?? null);
  // A row covers the ledger it names, or its settlement ledger: a payment or
  // an expense by card / UPI leaves the bank (td_settle_ledger_id) while the
  // row names the tender's clearing ledger.
  const rows = await tx.$queryRaw<{ led: string; side: Side; amt: Prisma.Decimal }[]>`
    SELECT l.led::text AS led, trim(t.td_dr_cr) AS side, sum(t.td_amount) AS amt
      FROM accounts.acc_tender_detail t
     CROSS JOIN LATERAL (
           SELECT t.td_tender_ledger_id AS led
           UNION
           SELECT t.td_settle_ledger_id WHERE t.td_settle_ledger_id IS NOT NULL) l
     WHERE t.td_is_deleted = false
       AND (t.td_voucher_id = ${scope.voucherId}::uuid
            OR t.td_src_doc_id = ${scope.voucherId}::uuid
            -- the rows that replaced the voided one: the contra's DEBITS
            OR t.td_replaces_id = ${replaced}::uuid
            -- the document's own rows, not claimed by another voucher (a bill's, a return's)
            OR (t.td_src_doc_id = ${ownDoc}::uuid AND t.td_voucher_id IS NULL))
     GROUP BY 1, 2`;
  const out = new Map<string, Prisma.Decimal>();
  const add = (key: string, amt: Prisma.Decimal | string) =>
    out.set(key, (out.get(key) ?? new Prisma.Decimal(0)).plus(amt));
  for (const r of rows) {
    add(`${r.led}|${r.side}`, r.amt);
  }
  if (replaced) {
    // …and the voided row the contra CREDITS back (it was a debit on the bill).
    const [voided] = await tx.$queryRaw<{ led: string; side: Side; amt: Prisma.Decimal }[]>`
      SELECT td_tender_ledger_id::text AS led, trim(td_dr_cr) AS side, td_amount AS amt
        FROM accounts.acc_tender_detail WHERE td_id = ${replaced}::uuid`;
    if (voided) {
      add(`${voided.led}|${voided.side === 'DR' ? 'CR' : 'DR'}`, voided.amt);
    }
  }
  return out;
}

/** The tender the server may put on a line nothing covers, or why it may not. */
async function tenderFor(
  tx: Tx,
  scope: MoneyLineScope,
  ledger: { led_id: string; led_name: string; kind: 'CASH' | 'BANK' },
): Promise<{ tenderId: string; typeId: number } | { code: string; message: string }> {
  if (ledger.kind === 'BANK' && !scope.bankTender) {
    return {
      code: VCH.MONEY_LINE_NO_TENDER,
      message:
        `${ledger.led_name} is a bank ledger: its line names the tender it moved by (Bank / NEFT or a ` +
        'cheque) — pick the money side from the tender list',
    };
  }
  const typeId =
    ledger.kind === 'CASH'
      ? CASH_TENDER_TYPE_ID
      : scope.bankTender === 'CHEQUE'
        ? CHEQUE_TENDER_TYPE_ID
        : BANK_TENDER_TYPE_ID;
  // CASH: the branch's CASH tender, whatever cash ledger the line is on (till,
  // safe, in transit). BANK: the bank's own BANK tender. CHEQUE: the CHEQUE tender.
  const rows = await tx.$queryRaw<{ tnd_id: string }[]>`
    SELECT tnd_id::text FROM accounts.acc_tender_master
     WHERE tnd_company_id = ${scope.companyId}::uuid
       AND (tnd_branch_id IS NULL OR tnd_branch_id = ${scope.branchId}::uuid)
       AND tnd_type_id = ${typeId}::int
       AND tnd_is_active AND NOT tnd_is_deleted
       AND (${typeId}::int <> ${BANK_TENDER_TYPE_ID}::int OR tnd_ledger_id = ${ledger.led_id}::uuid)
     ORDER BY (tnd_branch_id IS NULL), tnd_is_default DESC, tnd_display_position, tnd_created_on`;
  if (rows.length === 0) {
    const kind = typeId === CASH_TENDER_TYPE_ID ? 'CASH' : typeId === BANK_TENDER_TYPE_ID ? 'BANK' : 'CHEQUE';
    return {
      code: VCH.NO_TENDER_FOR_LEDGER,
      message:
        typeId === BANK_TENDER_TYPE_ID
          ? `${ledger.led_name} has no BANK tender: create its tender in Tender Master (e.g. "${ledger.led_name} – NEFT/IMPS")`
          : `No active ${kind} tender in this branch for ${ledger.led_name}: create it in Tender Master`,
    };
  }
  if (typeId === BANK_TENDER_TYPE_ID && rows.length > 1) {
    return {
      code: VCH.MONEY_LINE_NO_TENDER,
      message: `More than one BANK tender points at ${ledger.led_name}: the line must name which one`,
    };
  }
  return { tenderId: rows[0].tnd_id, typeId };
}

/** A tender the document named: its type, for td_tender_type_id. */
async function namedTender(
  tx: Tx,
  tenderId: string,
): Promise<{ tenderId: string; typeId: number } | { code: string; message: string }> {
  const [row] = await tx.$queryRaw<{ type_id: number }[]>`
    SELECT tnd_type_id AS type_id FROM accounts.acc_tender_master
     WHERE tnd_id = ${tenderId}::uuid AND NOT tnd_is_deleted`;
  return row
    ? { tenderId, typeId: row.type_id }
    : { code: VCH.MONEY_LINE_NO_TENDER, message: `Tender ${tenderId} is not a live tender` };
}

async function nextRowNo(tx: Tx, scope: MoneyLineScope): Promise<number> {
  const [row] = await tx.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(max(td_row_no), 0)::int AS n FROM accounts.acc_tender_detail
     WHERE td_src_doc_id = ${scope.voucherId}::uuid AND td_src_doc_type = ${MONEY_LINE_SRC_DOC_TYPE}`;
  return (row?.n ?? 0) + 1;
}

/**
 * td_party_ledger_id (NOT NULL) — who the money went to / came from: the
 * voucher's party, else the biggest leg on the other side (a TDrp's safe for
 * the till's line, the till for the safe's), else the line's own ledger.
 */
function counterpartOf(
  legs: readonly MoneyLeg[],
  partyId: string | null,
): (ledgerId: string, side: Side) => string {
  return (ledgerId, side) => {
    if (partyId) {
      return partyId;
    }
    let best: { id: string; amount: Prisma.Decimal } | null = null;
    for (const l of legs) {
      if (l.drCr === side || l.ledgerId === ledgerId || !l.ledgerId) {
        continue;
      }
      const amount = new Prisma.Decimal(l.amount);
      if (!best || amount.greaterThan(best.amount)) {
        best = { id: l.ledgerId, amount };
      }
    }
    return best?.id ?? ledgerId;
  };
}

/** ck_td_src_module. */
function srcModuleOf(srcModule: string | null | undefined): string {
  const m = (srcModule ?? '').toUpperCase();
  return m === 'TILL' || m === 'SALES' ? m : 'ACCOUNTS';
}
