"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireReceiptRoleLedgers = requireReceiptRoleLedgers;
exports.describeReceiptRoleLedgers = describeReceiptRoleLedgers;
exports.ledgerForRole = ledgerForRole;
const ledger_map_helper_1 = require("../ledgerRole/ledger-map.helper");
const receipt_enum_1 = require("./types/receipt-enum");
function requireReceiptRoleLedgers(client, roles, scope) {
    return (0, ledger_map_helper_1.requireRoleLedgers)(client, [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })), {
        companyId: scope.companyId,
        branchId: scope.branchId,
        where: 'receipt',
        message: 'Posting ledgers are not configured',
    });
}
function describeReceiptRoleLedgers(client, roles, scope) {
    return (0, ledger_map_helper_1.resolveRoleLedgers)(client, [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })), { companyId: scope.companyId, branchId: scope.branchId, where: 'receipt' });
}
function ledgerForRole(resolved, role) {
    return resolved.get((0, ledger_map_helper_1.roleLedgerKey)({ role })) ?? null;
}
function roleFieldName(role) {
    switch (role) {
        case receipt_enum_1.ReceiptLedgerRole.DISCOUNT_ALLOWED:
            return 'allocations.discount';
        case receipt_enum_1.ReceiptLedgerRole.WRITE_OFF:
            return 'allocations.writeoff';
        case receipt_enum_1.ReceiptLedgerRole.ROUND_OFF:
            return 'allocations.roundoff';
        case receipt_enum_1.ReceiptLedgerRole.BANK_CHARGES:
            return 'tenders.tdMdrAmt';
        case receipt_enum_1.ReceiptLedgerRole.SURCHARGE_RECOVERED:
            return 'tenders.tdSurchargeAmt';
        default:
            return 'otherLines';
    }
}
//# sourceMappingURL=receipt-ledger-roles.js.map