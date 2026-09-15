"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOpeningDifferenceLedger = resolveOpeningDifferenceLedger;
exports.resolveRetainedEarningsLedger = resolveRetainedEarningsLedger;
const ledger_map_helper_1 = require("../ledgerRole/ledger-map.helper");
const opening_balance_enum_1 = require("./types/opening-balance-enum");
function resolveOpeningDifferenceLedger(client, companyId, branchId) {
    return (0, ledger_map_helper_1.resolveRoleLedger)(client, { role: opening_balance_enum_1.OpeningLedgerRole.OPENING_DIFFERENCE, field: 'differenceLedgerId' }, { companyId, branchId, where: 'opening_balance' });
}
function resolveRetainedEarningsLedger(client, companyId, branchId) {
    return (0, ledger_map_helper_1.resolveRoleLedger)(client, { role: opening_balance_enum_1.OpeningLedgerRole.RETAINED_EARNINGS, field: 'retainedEarningsLedgerId' }, { companyId, branchId, where: 'opening_balance_carry_forward' });
}
//# sourceMappingURL=ledger-roles.js.map