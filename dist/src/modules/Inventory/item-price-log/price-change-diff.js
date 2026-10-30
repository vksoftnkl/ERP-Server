"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETED_COLUMN = exports.IGNORED_COLUMNS = void 0;
exports.changedColumns = changedColumns;
exports.actionOf = actionOf;
exports.scopeOf = scopeOf;
const price_field_labels_1 = require("./price-field-labels");
exports.IGNORED_COLUMNS = {
    IPM: [
        'ipm_created_on',
        'ipm_created_by',
        'ipm_updated_on',
        'ipm_updated_by',
        'ipm_sync_date',
        'ipm_key_mrp',
        'ipm_key_sp',
    ],
    IQP: ['iqp_created_on', 'iqp_created_by', 'iqp_modified_on', 'iqp_modified_by', 'iqp_sync_date'],
};
exports.DELETED_COLUMN = {
    IPM: 'ipm_is_deleted',
    IQP: 'iqp_is_deleted',
};
function same(left, right) {
    if (left === right) {
        return true;
    }
    if (left === null || left === undefined || right === null || right === undefined) {
        return (left ?? null) === (right ?? null);
    }
    return JSON.stringify(left) === JSON.stringify(right);
}
function changedColumns(table, before, after) {
    const ignored = new Set(exports.IGNORED_COLUMNS[table]);
    const keys = Object.keys(after ?? before ?? {}).filter((key) => !ignored.has(key));
    if (!before) {
        return (0, price_field_labels_1.orderColumns)(keys.filter((key) => (after?.[key] ?? null) !== null));
    }
    if (!after) {
        return (0, price_field_labels_1.orderColumns)(keys.filter((key) => (before[key] ?? null) !== null));
    }
    for (const key of Object.keys(before)) {
        if (!ignored.has(key) && !keys.includes(key)) {
            keys.push(key);
        }
    }
    return (0, price_field_labels_1.orderColumns)(keys.filter((key) => !same(before[key], after[key])));
}
function actionOf(table, before, after) {
    if (!before) {
        return 'CREATE';
    }
    if (!after) {
        return 'DELETE';
    }
    const flag = exports.DELETED_COLUMN[table];
    if (before[flag] !== true && after[flag] === true) {
        return 'DELETE';
    }
    if (before[flag] === true && after[flag] !== true) {
        return 'RESTORE';
    }
    return 'UPDATE';
}
const text = (value) => typeof value === 'string' && value.length > 0 ? value : null;
const amount = (value) => typeof value === 'number'
    ? value
    : typeof value === 'string' && value !== ''
        ? Number(value)
        : null;
function scopeOf(table, row) {
    const r = row ?? {};
    if (table === 'IPM') {
        return {
            companyId: text(r.ipm_company_id),
            branchId: text(r.ipm_branch_id),
            itemId: text(r.ipm_item_id),
            unitId: text(r.ipm_uc_unit_id),
            godownId: text(r.ipm_godown_id),
            partyId: null,
            priceLevel: null,
            bucketMrp: amount(r.ipm_bucket_mrp),
            bucketSp: amount(r.ipm_bucket_sp),
            effectiveFrom: text(r.ipm_effective_from),
            effectiveTo: text(r.ipm_effective_to),
        };
    }
    return {
        companyId: text(r.iqp_company_id),
        branchId: text(r.iqp_branch_id),
        itemId: text(r.iqp_item_id),
        unitId: text(r.iqp_item_unit_id),
        godownId: null,
        partyId: text(r.iqp_party_id),
        priceLevel: amount(r.iqp_price_level),
        bucketMrp: null,
        bucketSp: null,
        effectiveFrom: text(r.iqp_effective_from),
        effectiveTo: text(r.iqp_effective_to),
    };
}
//# sourceMappingURL=price-change-diff.js.map