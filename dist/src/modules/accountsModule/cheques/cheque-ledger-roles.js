"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireChequeRoleLedgers = requireChequeRoleLedgers;
exports.ledgerForRole = ledgerForRole;
const ledger_map_helper_1 = require("../ledgerRole/ledger-map.helper");
const cheque_enum_1 = require("./types/cheque-enum");
const acc_error_codes_1 = require("../receipt/types/acc-error-codes");
function requireChequeRoleLedgers(client, roles, scope) {
    return (0, ledger_map_helper_1.requireRoleLedgers)(client, [...new Set(roles)].map((role) => ({ role, field: roleFieldName(role) })), {
        companyId: scope.companyId,
        branchId: scope.branchId,
        where: 'cheque',
        message: 'Posting ledgers are not configured',
        code: acc_error_codes_1.ACC.ROLE_UNMAPPED,
    });
}
function ledgerForRole(resolved, role) {
    return resolved.get((0, ledger_map_helper_1.roleLedgerKey)({ role })) ?? null;
}
function roleFieldName(role) {
    switch (role) {
        case cheque_enum_1.ChequeLedgerRole.BANK_CHARGES:
            return 'bankCharge';
        case cheque_enum_1.ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED:
            return 'partyCharge';
        default:
            return 'apdId';
    }
}
//# sourceMappingURL=cheque-ledger-roles.js.map