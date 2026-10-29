"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBelowCostPolicy = resolveBelowCostPolicy;
exports.resolveBelowCostAction = resolveBelowCostAction;
const selling_price_bulk_types_1 = require("./types/selling-price-bulk.types");
function resolveBelowCostPolicy(effective) {
    const item = effective.find((entry) => entry.asdKey === selling_price_bulk_types_1.BELOW_COST_PRICE_SETTING_KEY);
    const value = item?.value?.trim().toLowerCase();
    return selling_price_bulk_types_1.BELOW_COST_POLICIES.includes(value ?? '')
        ? value
        : selling_price_bulk_types_1.DEFAULT_BELOW_COST_POLICY;
}
function resolveBelowCostAction(policy, confirmed) {
    switch (policy) {
        case 'restrict':
            return 'ABORT';
        case 'allow':
            return 'PROCEED';
        case 'warning':
        default:
            return confirmed ? 'PROCEED' : 'CONFIRM';
    }
}
//# sourceMappingURL=below-cost-policy.helper.js.map