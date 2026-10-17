import { Prisma } from '@prisma/client';
import { throwUnprocessable, type ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import {
  ACC_CHEQUES_OUT_OF_BALANCE,
  ACC_PARTY_OUT_OF_BALANCE,
  RECONCILE_ON_POST_SETTING,
} from '../reconcile/books-reconcile.guard';

/**
 * notes (47)'s trial-mode books check, as the register runs it after a post
 * or a cancel — the same two rules `assertBooksReconcile` applies (a
 * bill-by-bill party's bills = its ledger; Cheques In Hand = the register),
 * with ONE allowance the shared guard cannot make:
 *
 * notes (54): a POST-DATED cheque's voucher is POSTED today with the cheque's
 * date. `fn_ledger_book_balance` counts every POSTED leg whatever its date, so
 * the party's ledger already carries the credit — while its bill-wise row
 * (`abj_is_post_dated`, dated the cheque) does not count until the cheque
 * matures, exactly as the Receipt's rule says. Until that day the two sides
 * differ by precisely the un-matured post-dated settlements, and that
 * difference is not a defect. So a party is in balance when
 *
 *     ledger − bills = Σ (signed) live post-dated rows dated after today
 *
 * where a row settling a DR bill counts −amount and one on a CR bill
 * +amount, and a reversal counter-row (negative amount) nets its original.
 * With no such rows the expected difference is zero and this IS the guard's
 * check.
 */

const TOLERANCE = new Prisma.Decimal('0.005');

export interface VoucherBooksScope {
  companyId: string;
  accYear: string;
  /** Every ledger the post touched: the parties, the instrument ledgers. Others are ignored. */
  ledgerIds: readonly (string | null | undefined)[];
}

interface PartyDetail extends ModuleErrorDetail {
  code: typeof ACC_PARTY_OUT_OF_BALANCE;
  partyId: string;
  partyName: string;
  ledger: number;
  bills: number;
  postDated: number;
  diff: number;
}

interface ChequesDetail extends ModuleErrorDetail {
  code: typeof ACC_CHEQUES_OUT_OF_BALANCE;
  ledgerId: string;
  ledgerName: string;
  ledger: number;
  register: number;
  diff: number;
}

export async function assertVoucherBooksReconcile(
  tx: Prisma.TransactionClient,
  scope: VoucherBooksScope,
): Promise<void> {
  const ids = [...new Set(scope.ledgerIds.filter((id): id is string => !!id))];
  if (ids.length === 0 || !(await reconcileOnPost(tx, scope.companyId))) {
    return;
  }
  const ledgers = await tx.$queryRaw<
    { led_id: string; led_name: string; bill_by_bill: boolean; in_hand: boolean }[]
  >`
    SELECT l.led_id, l.led_name, l.led_is_bill_by_bill AS bill_by_bill,
           accounts.fn_is_cheques_in_hand_ledger(l.led_id) AS in_hand
      FROM accounts.acc_ledger_master l
     WHERE l.led_id = ANY(${ids}::uuid[])
     ORDER BY l.led_name`;

  const errors: (PartyDetail | ChequesDetail)[] = [];
  for (const led of ledgers) {
    if (led.bill_by_bill) {
      const [r] = await tx.$queryRaw<
        { ledger_bal: Prisma.Decimal; bills_bal: Prisma.Decimal; diff: Prisma.Decimal }[]
      >`
        SELECT ledger_bal, bills_bal, diff
          FROM accounts.fn_party_bill_reconcile(${scope.companyId}::uuid, ${led.led_id}::uuid,
                                                ${scope.accYear}::char(9))`;
      const [pd] = await tx.$queryRaw<{ expected: Prisma.Decimal }[]>`
        SELECT COALESCE(SUM(CASE WHEN b.abl_dr_cr = 'DR' THEN -j.abj_amount ELSE j.abj_amount END), 0) AS expected
          FROM accounts.acc_bill_adjustment j
          JOIN accounts.acc_bill_balance b
            ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
          JOIN accounts.acc_voucher_header h
            ON h.avh_voucher_id = j.abj_voucher_id AND h.avh_acc_year = j.abj_voucher_acc_year
         WHERE j.abj_company_id = ${scope.companyId}::uuid
           AND j.abj_party_id   = ${led.led_id}::uuid
           AND j.abj_is_deleted = false
           AND j.abj_is_post_dated = true
           AND j.abj_adj_date > current_date
           AND j.abj_adj_type IN ('ALLOCATION', 'ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER')
           AND b.abl_is_deleted = false
           AND h.avh_is_deleted = false
           AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')`;
      const expected = new Prisma.Decimal(pd?.expected ?? 0);
      const diff = new Prisma.Decimal(r?.diff ?? 0);
      if (r && diff.minus(expected).abs().greaterThan(TOLERANCE)) {
        errors.push({
          field: 'partyId',
          code: ACC_PARTY_OUT_OF_BALANCE,
          message:
            `${led.led_name}'s open bills come to ${money(r.bills_bal)} but the ledger says ` +
            `${money(r.ledger_bal)} (difference ${money(r.diff)}` +
            (expected.isZero() ? '' : `, of which ${money(expected)} is post-dated and expected`) +
            '). The post has been refused so the mismatch is found now rather than at year end — report it with this voucher.',
          partyId: led.led_id,
          partyName: led.led_name,
          ledger: Number(r.ledger_bal),
          bills: Number(r.bills_bal),
          postDated: Number(expected),
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
            'The post has been refused so the mismatch is found now — report it with this voucher.',
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
    throwUnprocessable<PartyDetail | ChequesDetail>(
      errors.some((e) => e.code === ACC_PARTY_OUT_OF_BALANCE)
        ? 'Party balance does not match its bills'
        : 'Cheques In Hand does not match the cheque register',
      errors,
    );
  }
}

/** Through the resolver, never app_setting_value; no row reads as OFF (the guard's own rule). */
async function reconcileOnPost(tx: Prisma.TransactionClient, companyId: string): Promise<boolean> {
  const [row] = await tx.$queryRaw<{ value: string | null }[]>`
    SELECT out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, NULL::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key = ${RECONCILE_ON_POST_SETTING}`;
  const token = row?.value?.trim().toLowerCase();
  return token !== undefined && ['true', '1', 'yes', 'y', 'on'].includes(token);
}

function money(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toFixed(2);
}
