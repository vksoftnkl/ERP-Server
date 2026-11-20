"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GODOWN_SHORT_SERIES = exports.ITEM_CATEGORY_SHORT_SERIES = exports.ITEM_SECTION_SHORT_SERIES = exports.ITEM_BRAND_SHORT_SERIES = exports.ITEM_GROUP_SHORT_SERIES = exports.EMPLOYEE_CODE_SERIES = exports.DESIGNATION_CODE_SERIES = exports.DEPARTMENT_CODE_SERIES = exports.COMPANY_CODE_SERIES = void 0;
exports.lockCodeSeries = lockCodeSeries;
exports.COMPANY_CODE_SERIES = { table: 'public.companys', column: 'comp_code' };
exports.DEPARTMENT_CODE_SERIES = {
    table: 'public.employee_departments',
    column: 'edpt_code',
};
exports.DESIGNATION_CODE_SERIES = {
    table: 'public.employee_designations',
    column: 'ed_code',
};
exports.EMPLOYEE_CODE_SERIES = {
    table: 'public.employee_master',
    column: 'emp_code',
};
exports.ITEM_GROUP_SHORT_SERIES = {
    table: 'inventory.item_group_master',
    column: 'itg_short',
};
exports.ITEM_BRAND_SHORT_SERIES = {
    table: 'inventory.item_brand_master',
    column: 'brand_short',
};
exports.ITEM_SECTION_SHORT_SERIES = {
    table: 'inventory.item_section_master',
    column: 'sec_short',
};
exports.ITEM_CATEGORY_SHORT_SERIES = {
    table: 'inventory.item_category_master',
    column: 'category_short',
};
exports.GODOWN_SHORT_SERIES = {
    table: 'inventory.godown_locations',
    column: 'gdl_short',
};
async function lockCodeSeries(tx, series) {
    await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext(${series.table}::text), hashtext(${series.column}::text)))::int AS locked`;
}
//# sourceMappingURL=code-series-lock.js.map