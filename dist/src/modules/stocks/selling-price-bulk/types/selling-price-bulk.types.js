"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_MRP_PRICE_NOT_DEPLOYED = exports.HQ_USER_TYPES = exports.CONFIRMABLE_VERDICTS = exports.PRICE_VERDICTS = exports.BELOW_COST_ACTIONS = exports.DEFAULT_BELOW_COST_POLICY = exports.BELOW_COST_POLICIES = exports.BELOW_COST_PRICE_SETTING_KEY = exports.LEVEL_COLUMN_SUFFIX = exports.PRICE_LEVELS = exports.PRICE_SCOPES = exports.PRICE_SOURCES = void 0;
exports.isHqUserType = isHqUserType;
exports.PRICE_SOURCES = ['BUCKET', 'MASTER'];
exports.PRICE_SCOPES = ['BRANCH', 'CHAIN'];
exports.PRICE_LEVELS = [1, 2, 3, 4];
exports.LEVEL_COLUMN_SUFFIX = {
    1: 'a',
    2: 'b',
    3: 'c',
    4: 'd',
};
exports.BELOW_COST_PRICE_SETTING_KEY = 'inventory.below_cost_price';
exports.BELOW_COST_POLICIES = ['restrict', 'warning', 'allow'];
exports.DEFAULT_BELOW_COST_POLICY = 'warning';
exports.BELOW_COST_ACTIONS = ['ABORT', 'CONFIRM', 'PROCEED'];
exports.PRICE_VERDICTS = ['ABOVE_MRP', 'BELOW_MIN', 'BELOW_COST'];
exports.CONFIRMABLE_VERDICTS = ['BELOW_COST'];
exports.HQ_USER_TYPES = ['HQ', 'ADMIN', 'SUPERADMIN'];
function isHqUserType(userType) {
    if (!userType) {
        return false;
    }
    const normalized = userType.trim().replace(/\s+/g, '').toUpperCase();
    return exports.HQ_USER_TYPES.some((allowed) => allowed.replace(/\s+/g, '').toUpperCase() === normalized);
}
exports.STOCK_MRP_PRICE_NOT_DEPLOYED = 'stock.stock_mrp_price is not deployed on this database. It ships out of band ' +
    'from the schema/stock share, like stock.stock_voucher; the price grid and the ' +
    'bucket save stay unavailable until it lands.';
//# sourceMappingURL=selling-price-bulk.types.js.map