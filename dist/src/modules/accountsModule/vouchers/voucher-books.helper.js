"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertVoucherBooksReconcile = assertVoucherBooksReconcile;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const books_reconcile_guard_1 = require("../reconcile/books-reconcile.guard");
const TOLERANCE = new client_1.Prisma.Decimal('0.005');
async function assertVoucherBooksReconcile(tx, scope) {
    const ids = [...new Set(scope.ledgerIds.filter((id) => !!id))];
    if (ids.length === 0 || !(await reconcileOnPost(tx, scope.companyId))) {
        return;
    }
    const ledgers = await tx.$queryRaw `
    SELECT l.led_id, l.led_name, l.led_is_bill_by_bill AS bill_by_bill,
           accounts.fn_is_cheques_in_hand_ledger(l.led_id) AS in_hand
      FROM accounts.acc_ledger_master l
     WHERE l.led_id = ANY(${ids}::uuid[])
     ORDER BY l.led_name`;
    const errors = [];
    for (const led of ledgers) {
        if (led.bill_by_bill) {
            const [r] = await tx.$queryRaw `
        SELECT ledger_bal, bills_bal, diff
          FROM accounts.fn_party_bill_reconcile(${scope.companyId}::uuid, ${led.led_id}::uuid,
                                                ${scope.accYear}::char(9))`;
            const [pd] = await tx.$queryRaw `
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
            const expected = new client_1.Prisma.Decimal(pd?.expected ?? 0);
            const diff = new client_1.Prisma.Decimal(r?.diff ?? 0);
            if (r && diff.minus(expected).abs().greaterThan(TOLERANCE)) {
                errors.push({
                    field: 'partyId',
                    code: books_reconcile_guard_1.ACC_PARTY_OUT_OF_BALANCE,
                    message: `${led.led_name}'s open bills come to ${money(r.bills_bal)} but the ledger says ` +
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
            const [r] = await tx.$queryRaw `
        SELECT ledger_bal, register_bal, diff
          FROM accounts.fn_cheques_in_hand_reconcile(${scope.companyId}::uuid, ${led.led_id}::uuid,
                                                     ${scope.accYear}::char(9))`;
            if (r && new client_1.Prisma.Decimal(r.diff).abs().greaterThan(TOLERANCE)) {
                errors.push({
                    field: 'ledgerId',
                    code: books_reconcile_guard_1.ACC_CHEQUES_OUT_OF_BALANCE,
                    message: `${led.led_name} stands at ${money(r.ledger_bal)} but the cheques held and deposited ` +
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
        (0, module_service_utils_1.throwUnprocessable)(errors.some((e) => e.code === books_reconcile_guard_1.ACC_PARTY_OUT_OF_BALANCE)
            ? 'Party balance does not match its bills'
            : 'Cheques In Hand does not match the cheque register', errors);
    }
}
async function reconcileOnPost(tx, companyId) {
    const [row] = await tx.$queryRaw `
    SELECT out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, NULL::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key = ${books_reconcile_guard_1.RECONCILE_ON_POST_SETTING}`;
    const token = row?.value?.trim().toLowerCase();
    return token !== undefined && ['true', '1', 'yes', 'y', 'on'].includes(token);
}
function money(value) {
    return new client_1.Prisma.Decimal(value).toFixed(2);
}
//# sourceMappingURL=voucher-books.helper.js.map