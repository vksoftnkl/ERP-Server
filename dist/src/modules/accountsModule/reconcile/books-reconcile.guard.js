"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACC_CHEQUES_OUT_OF_BALANCE = exports.ACC_PARTY_OUT_OF_BALANCE = exports.RECONCILE_ON_POST_SETTING = void 0;
exports.assertBooksReconcile = assertBooksReconcile;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
exports.RECONCILE_ON_POST_SETTING = 'accounts.reconcile_on_post';
exports.ACC_PARTY_OUT_OF_BALANCE = 'ACC_PARTY_OUT_OF_BALANCE';
exports.ACC_CHEQUES_OUT_OF_BALANCE = 'ACC_CHEQUES_OUT_OF_BALANCE';
const TOLERANCE = new client_1.Prisma.Decimal('0.005');
async function assertBooksReconcile(tx, scope) {
    if (!(await reconcileOnPost(tx, scope.companyId))) {
        return;
    }
    const ledgerIds = await collectLedgers(tx, scope);
    if (ledgerIds.length === 0) {
        return;
    }
    const ledgers = await tx.$queryRaw `
    SELECT l.led_id, l.led_name, l.led_is_bill_by_bill AS bill_by_bill,
           accounts.fn_is_cheques_in_hand_ledger(l.led_id) AS in_hand
      FROM accounts.acc_ledger_master l
     WHERE l.led_id = ANY(${ledgerIds}::uuid[])
     ORDER BY l.led_name`;
    const errors = [];
    for (const led of ledgers) {
        if (led.bill_by_bill) {
            const [r] = await tx.$queryRaw `
        SELECT ledger_bal, bills_bal, diff
          FROM accounts.fn_party_bill_reconcile(${scope.companyId}::uuid, ${led.led_id}::uuid,
                                                ${scope.accYear}::char(9))`;
            if (r && new client_1.Prisma.Decimal(r.diff).abs().greaterThan(TOLERANCE)) {
                errors.push({
                    field: 'partyId',
                    code: exports.ACC_PARTY_OUT_OF_BALANCE,
                    message: `${led.led_name}'s open bills come to ${money(r.bills_bal)} but the ledger says ` +
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
            const [r] = await tx.$queryRaw `
        SELECT ledger_bal, register_bal, diff
          FROM accounts.fn_cheques_in_hand_reconcile(${scope.companyId}::uuid, ${led.led_id}::uuid,
                                                     ${scope.accYear}::char(9))`;
            if (r && new client_1.Prisma.Decimal(r.diff).abs().greaterThan(TOLERANCE)) {
                errors.push({
                    field: 'ledgerId',
                    code: exports.ACC_CHEQUES_OUT_OF_BALANCE,
                    message: `${led.led_name} stands at ${money(r.ledger_bal)} but the cheques held and deposited ` +
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
        (0, module_service_utils_1.throwUnprocessable)(errors.some((e) => e.code === exports.ACC_PARTY_OUT_OF_BALANCE)
            ? 'Party balance does not match its bills'
            : 'Cheques In Hand does not match the cheque register', errors);
    }
}
async function reconcileOnPost(tx, companyId) {
    const [row] = await tx.$queryRaw `
    SELECT out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, NULL::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key = ${exports.RECONCILE_ON_POST_SETTING}`;
    const token = row?.value?.trim().toLowerCase();
    return token !== undefined && ['true', '1', 'yes', 'y', 'on'].includes(token);
}
async function collectLedgers(tx, scope) {
    const ids = new Set();
    for (const id of scope.ledgerIds ?? []) {
        if (id) {
            ids.add(id);
        }
    }
    const vouchers = (scope.vouchers ?? []).filter((v) => !!v?.voucherId && !!v.accYear);
    if (vouchers.length > 0) {
        const rows = await tx.$queryRaw `
      SELECT DISTINCT av_ledger_id AS id FROM accounts.acc_vouchers
       WHERE (av_voucher_id, av_acc_year) IN (${client_1.Prisma.join(vouchers.map((v) => client_1.Prisma.sql `(${v.voucherId}::uuid, ${v.accYear}::char(9))`))})`;
        rows.forEach((r) => ids.add(r.id));
    }
    const cheques = (scope.cheques ?? []).filter((c) => !!c?.apdId && !!c.apdAccYear);
    if (cheques.length > 0) {
        const rows = await tx.$queryRaw `
      SELECT t.td_tender_ledger_id AS id
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_tender_detail t ON t.td_id = p.apd_tender_id
       WHERE (p.apd_id, p.apd_acc_year) IN (${client_1.Prisma.join(cheques.map((c) => client_1.Prisma.sql `(${c.apdId}::uuid, ${c.apdAccYear}::char(9))`))})
      UNION
      SELECT v.av_ledger_id
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_vouchers v
          ON v.av_voucher_id = p.apd_voucher_id AND v.av_acc_year = p.apd_voucher_acc_year
       WHERE (p.apd_id, p.apd_acc_year) IN (${client_1.Prisma.join(cheques.map((c) => client_1.Prisma.sql `(${c.apdId}::uuid, ${c.apdAccYear}::char(9))`))})
         AND v.av_is_deleted = false`;
        rows.forEach((r) => r.id && ids.add(r.id));
    }
    return [...ids];
}
function money(value) {
    return new client_1.Prisma.Decimal(value).toFixed(2);
}
//# sourceMappingURL=books-reconcile.guard.js.map