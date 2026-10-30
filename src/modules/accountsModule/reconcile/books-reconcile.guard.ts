import { Prisma } from '@prisma/client';
import { throwUnprocessable, type ModuleErrorDetail } from 'src/common/utils/module-service.utils';

/**
 * notes (47) — the trial-mode books check, run at the END of every post.
 *
 *   C1 · a bill-by-bill party (`led_is_bill_by_bill`): its open bills, all
 *        years, add up to its ledger balance (opening + live legs of POSTED and
 *        CANCELLED vouchers) → else 422 ACC_PARTY_OUT_OF_BALANCE
 *   C2 · a Cheques In Hand ledger: its balance equals the HELD + DEPOSITED
 *        ON_RECEIPT cheques in the register → else 422 ACC_CHEQUES_OUT_OF_BALANCE
 *
 * The arithmetic is NOT here. It is `accounts.fn_party_bill_reconcile` and
 * `accounts.fn_cheques_in_hand_reconcile` (migration
 * 20260925100000_books_reconcile_on_post), which the whole-company pass
 * (`accounts.fn_books_reconcile`, scripts/reconcile-books.ts) uses too — one
 * definition of "balanced".
 *
 * Called with the caller's transaction, AFTER its last write, so it sees the
 * post exactly as it would commit; a refusal rolls the whole post back. Reads
 * only — no row is locked, so it cannot contend with another post.
 *
 * Behind `accounts.reconcile_on_post` (COMPANY scope, default ON for the
 * trial). Off → nothing is read beyond the setting.
 */

export const RECONCILE_ON_POST_SETTING = 'accounts.reconcile_on_post';
export const ACC_PARTY_OUT_OF_BALANCE = 'ACC_PARTY_OUT_OF_BALANCE';
export const ACC_CHEQUES_OUT_OF_BALANCE = 'ACC_CHEQUES_OUT_OF_BALANCE';

// A paisa of rounding is not a defect; anything above half of one is.
const TOLERANCE = new Prisma.Decimal('0.005');

export interface BooksReconcileScope {
  companyId: string;
  /** The FY whose opening + legs make the ledger side. */
  accYear: string;
  /** Ledgers the post wrote to or whose bills it moved — parties, Cheques In Hand. Anything else is ignored. */
  ledgerIds?: readonly (string | null | undefined)[];
  /** Vouchers the post wrote or restated; every ledger on their legs is considered. */
  vouchers?: readonly ({ voucherId: string; accYear: string } | null | undefined)[];
  /** Register rows the post moved; the Cheques In Hand ledger behind each is considered. */
  cheques?: readonly ({ apdId: string; apdAccYear: string } | null | undefined)[];
}

export interface PartyOutOfBalanceDetail extends ModuleErrorDetail {
  code: typeof ACC_PARTY_OUT_OF_BALANCE;
  partyId: string;
  partyName: string;
  ledger: number;
  bills: number;
  diff: number;
}

export interface ChequesOutOfBalanceDetail extends ModuleErrorDetail {
  code: typeof ACC_CHEQUES_OUT_OF_BALANCE;
  ledgerId: string;
  ledgerName: string;
  ledger: number;
  register: number;
  diff: number;
}

export async function assertBooksReconcile(
  tx: Prisma.TransactionClient,
  scope: BooksReconcileScope,
): Promise<void> {
  if (!(await reconcileOnPost(tx, scope.companyId))) {
    return;
  }
  const ledgerIds = await collectLedgers(tx, scope);
  if (ledgerIds.length === 0) {
    return;
  }
  const ledgers = await tx.$queryRaw<
    { led_id: string; led_name: string; bill_by_bill: boolean; in_hand: boolean }[]
  >`
    SELECT l.led_id, l.led_name, l.led_is_bill_by_bill AS bill_by_bill,
           accounts.fn_is_cheques_in_hand_ledger(l.led_id) AS in_hand
      FROM accounts.acc_ledger_master l
     WHERE l.led_id = ANY(${ledgerIds}::uuid[])
     ORDER BY l.led_name`;

  const errors: (PartyOutOfBalanceDetail | ChequesOutOfBalanceDetail)[] = [];
  for (const led of ledgers) {
    if (led.bill_by_bill) {
      const [r] = await tx.$queryRaw<
        { ledger_bal: Prisma.Decimal; bills_bal: Prisma.Decimal; diff: Prisma.Decimal }[]
      >`
        SELECT ledger_bal, bills_bal, diff
          FROM accounts.fn_party_bill_reconcile(${scope.companyId}::uuid, ${led.led_id}::uuid,
                                                ${scope.accYear}::char(9))`;
      if (r && new Prisma.Decimal(r.diff).abs().greaterThan(TOLERANCE)) {
        errors.push({
          field: 'partyId',
          code: ACC_PARTY_OUT_OF_BALANCE,
          message:
            `${led.led_name}'s open bills come to ${money(r.bills_bal)} but the ledger says ` +
            `${money(r.ledger_bal)} (difference ${money(r.diff)}). The post has been refused so ` +
            'the mismatch is found now rather than at year end — report it with this bill.',
          partyId: led.led_id,
          partyName: led.led_name,
          ledger: Number(r.ledger_bal),
          bills: Number(r.bills_bal),
          diff: Number(r.diff),
        });
      }
    }
    if (led.in_hand) {
      const [r] = await tx.$queryRaw<
        { ledger_bal: Prisma.Decimal; register_bal: Prisma.Decimal; diff: Prisma.Decimal }[]
      >`
        SELECT ledger_bal, register_bal, diff
          FROM accounts.fn_cheques_in_hand_reconcile(${scope.companyId}::uuid, ${led.led_id}::uuid,
                                                     ${scope.accYear}::char(9))`;
      if (r && new Prisma.Decimal(r.diff).abs().greaterThan(TOLERANCE)) {
        errors.push({
          field: 'ledgerId',
          code: ACC_CHEQUES_OUT_OF_BALANCE,
          message:
            `${led.led_name} stands at ${money(r.ledger_bal)} but the cheques held and deposited ` +
            `in the register come to ${money(r.register_bal)} (difference ${money(r.diff)}). ` +
            'The post has been refused so the mismatch is found now — report it with this document.',
          ledgerId: led.led_id,
          ledgerName: led.led_name,
          ledger: Number(r.ledger_bal),
          register: Number(r.register_bal),
          diff: Number(r.diff),
        });
      }
    }
  }
  if (errors.length > 0) {
    throwUnprocessable<PartyOutOfBalanceDetail | ChequesOutOfBalanceDetail>(
      errors.some((e) => e.code === ACC_PARTY_OUT_OF_BALANCE)
        ? 'Party balance does not match its bills'
        : 'Cheques In Hand does not match the cheque register',
      errors,
    );
  }
}

// Through the resolver (fn_app_settings_effective), never app_setting_value.
// COMPANY is the setting's narrowest scope. No row at all — the migration has
// not run — reads as OFF: a check that is not installed cannot refuse.
async function reconcileOnPost(tx: Prisma.TransactionClient, companyId: string): Promise<boolean> {
  const [row] = await tx.$queryRaw<{ value: string | null }[]>`
    SELECT out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, NULL::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key = ${RECONCILE_ON_POST_SETTING}`;
  const token = row?.value?.trim().toLowerCase();
  return token !== undefined && ['true', '1', 'yes', 'y', 'on'].includes(token);
}

async function collectLedgers(
  tx: Prisma.TransactionClient,
  scope: BooksReconcileScope,
): Promise<string[]> {
  const ids = new Set<string>();
  for (const id of scope.ledgerIds ?? []) {
    if (id) {
      ids.add(id);
    }
  }
  const vouchers = (scope.vouchers ?? []).filter(
    (v): v is { voucherId: string; accYear: string } => !!v?.voucherId && !!v.accYear,
  );
  if (vouchers.length > 0) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT av_ledger_id AS id FROM accounts.acc_vouchers
       WHERE (av_voucher_id, av_acc_year) IN (${Prisma.join(
         vouchers.map((v) => Prisma.sql`(${v.voucherId}::uuid, ${v.accYear}::char(9))`),
       )})`;
    rows.forEach((r) => ids.add(r.id));
  }
  const cheques = (scope.cheques ?? []).filter(
    (c): c is { apdId: string; apdAccYear: string } => !!c?.apdId && !!c.apdAccYear,
  );
  if (cheques.length > 0) {
    // The tender row's ledger (what fn_cheques_in_hand_reconcile attributes
    // the cheque to), plus every ledger on the cheque's own voucher — which
    // is how a replacement, with no tender row, is found, and brings the party
    // along. Only bill-by-bill and Cheques In Hand ledgers survive the filter.
    const rows = await tx.$queryRaw<{ id: string | null }[]>`
      SELECT t.td_tender_ledger_id AS id
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_tender_detail t ON t.td_id = p.apd_tender_id
       WHERE (p.apd_id, p.apd_acc_year) IN (${Prisma.join(
         cheques.map((c) => Prisma.sql`(${c.apdId}::uuid, ${c.apdAccYear}::char(9))`),
       )})
      UNION
      SELECT v.av_ledger_id
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_vouchers v
          ON v.av_voucher_id = p.apd_voucher_id AND v.av_acc_year = p.apd_voucher_acc_year
       WHERE (p.apd_id, p.apd_acc_year) IN (${Prisma.join(
         cheques.map((c) => Prisma.sql`(${c.apdId}::uuid, ${c.apdAccYear}::char(9))`),
       )})
         AND v.av_is_deleted = false`;
    rows.forEach((r) => r.id && ids.add(r.id));
  }
  return [...ids];
}

function money(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toFixed(2);
}
