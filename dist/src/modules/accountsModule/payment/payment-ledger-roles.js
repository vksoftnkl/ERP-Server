"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePaymentRoleLedgers = requirePaymentRoleLedgers;
exports.describePaymentRoleLedgers = describePaymentRoleLedgers;
exports.ledgerForRole = ledgerForRole;
const ledger_map_helper_1 = require("../ledgerRole/ledger-map.helper");
const payment_enum_1 = require("./types/payment-enum");
function requirePaymentRoleLedgers(client, roles, scope) {
    return (0, ledger_map_helper_1.requireRoleLedgers)(client, [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })), {
        companyId: scope.companyId,
        branchId: scope.branchId,
        where: 'payment',
        message: 'Posting ledgers are not configured',
    });
}
function describePaymentRoleLedgers(client, roles, scope) {
    return (0, ledger_map_helper_1.resolveRoleLedgers)(client, [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })), { companyId: scope.companyId, branchId: scope.branchId, where: 'payment' });
}
function ledgerForRole(resolved, role) {
    return resolved.get((0, ledger_map_helper_1.roleLedgerKey)({ role })) ?? null;
}
function roleFieldName(role) {
    switch (role) {
        case payment_enum_1.PaymentLedgerRole.DISCOUNT_RECEIVED:
            return 'allocations.discount';
        case payment_enum_1.PaymentLedgerRole.BALANCES_WRITTEN_BACK:
            return 'allocations.writeoff';
        case payment_enum_1.PaymentLedgerRole.ROUND_OFF:
            return 'allocations.roundoff';
        case payment_enum_1.PaymentLedgerRole.BANK_CHARGES:
            return 'tenders.tdMdrAmt';
        case payment_enum_1.PaymentLedgerRole.TDS_PAYABLE:
            return 'avhPartyId';
        default:
            return 'otherLines';
    }
}
//# sourceMappingURL=payment-ledger-roles.js.map