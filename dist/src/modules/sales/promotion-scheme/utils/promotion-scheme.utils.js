"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRI_DEFAULT_MATCH_PRIORITY = exports.PRP_DEFAULT_MATCH_PRIORITY = exports.PRM_WEEKDAYS_PATTERN = exports.PRM_CODE_PATTERN = exports.PRI_KINDS = exports.PRP_KINDS = exports.PRM_SCOPES = exports.PRM_BILL_TYPES = exports.PRM_CALC_ON = exports.PRM_STACK_MODES = exports.PRM_BENEFITS = exports.PRM_APPLY_ON = exports.PRM_STATUSES = exports.UUID_PATTERN = void 0;
exports.throwBadRequest = throwBadRequest;
exports.throwConflict = throwConflict;
exports.fieldError = fieldError;
exports.toIsoDate = toIsoDate;
exports.toIsoTime = toIsoTime;
exports.normalizeNullableString = normalizeNullableString;
exports.resolveActor = resolveActor;
exports.resolveActorUuid = resolveActorUuid;
exports.requireString = requireString;
exports.requireUuid = requireUuid;
exports.requireEnum = requireEnum;
exports.requireNumber = requireNumber;
exports.requireInteger = requireInteger;
exports.parseDateOnly = parseDateOnly;
exports.parseTimeToUtcDate = parseTimeToUtcDate;
exports.toBranchPayload = toBranchPayload;
exports.toPartyPayload = toPartyPayload;
exports.toItemPayload = toItemPayload;
exports.toSlabPayload = toSlabPayload;
exports.toSchemeSummaryPayload = toSchemeSummaryPayload;
exports.toSchemePayload = toSchemePayload;
exports.handlePromotionWriteError = handlePromotionWriteError;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
exports.UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
exports.PRM_STATUSES = ['DRAFT', 'APPROVED', 'SUSPENDED', 'CLOSED'];
exports.PRM_APPLY_ON = ['BILL_AMOUNT', 'BILL_QTY', 'ITEM_AMOUNT', 'ITEM_QTY'];
exports.PRM_BENEFITS = ['FREE_ITEM', 'DISC_PERC', 'DISC_AMT', 'FIXED_PRICE'];
exports.PRM_STACK_MODES = ['EXCLUSIVE', 'STACKABLE'];
exports.PRM_CALC_ON = ['GROSS_AMOUNT', 'NET_AMOUNT', 'TAXABLE_AMOUNT'];
exports.PRM_BILL_TYPES = ['ALL', 'CASH', 'CREDIT'];
exports.PRM_SCOPES = ['ALL', 'LIST'];
exports.PRP_KINDS = ['CUSTOMER', 'CUSTOMER_GROUP', 'AREA', 'CITY'];
exports.PRI_KINDS = [
    'ITEM',
    'ITEM_GROUP',
    'ITEM_CATEGORY',
    'ITEM_BRAND',
    'ITEM_SECTION',
];
exports.PRM_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
exports.PRM_WEEKDAYS_PATTERN = /^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/;
exports.PRP_DEFAULT_MATCH_PRIORITY = {
    CUSTOMER: 4,
    AREA: 3,
    CITY: 2,
    CUSTOMER_GROUP: 1,
};
exports.PRI_DEFAULT_MATCH_PRIORITY = {
    ITEM: 4,
    ITEM_BRAND: 3,
    ITEM_CATEGORY: 2,
    ITEM_SECTION: 1,
    ITEM_GROUP: 0,
};
function throwBadRequest(message, errors) {
    (0, module_service_utils_1.throwSalesBadRequest)(message, errors);
}
function throwConflict(message, errors) {
    (0, module_service_utils_1.throwSalesConflict)(message, errors);
}
function fieldError(field, message) {
    throwBadRequest('Validation failed', [{ field, message }]);
}
function toIsoDate(value) {
    return value.toISOString().slice(0, 10);
}
function toIsoTime(value) {
    if (!value) {
        return null;
    }
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    const seconds = String(value.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}
function normalizeNullableString(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function resolveActor(...candidates) {
    for (const candidate of candidates) {
        if (candidate && candidate.trim()) {
            return candidate.trim();
        }
    }
    return null;
}
function resolveActorUuid(...candidates) {
    for (const candidate of candidates) {
        if (candidate && exports.UUID_PATTERN.test(candidate)) {
            return candidate;
        }
    }
    return null;
}
function requireString(value, field) {
    if (typeof value !== 'string' || !value.trim()) {
        fieldError(field, `${field} is required`);
    }
    return value.trim();
}
function requireUuid(value, field) {
    if (typeof value !== 'string' || !exports.UUID_PATTERN.test(value)) {
        fieldError(field, `${field} must be a valid uuid`);
    }
    return value;
}
function requireEnum(value, field, allowed) {
    const candidate = requireString(value, field).toUpperCase();
    if (!allowed.includes(candidate)) {
        fieldError(field, `${field} must be one of ${allowed.join(', ')}`);
    }
    return candidate;
}
function requireNumber(value, field, minValue, maxValue) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minValue) {
        fieldError(field, `${field} must be a number greater than or equal to ${minValue}`);
    }
    if (maxValue !== undefined && value > maxValue) {
        fieldError(field, `${field} must be less than or equal to ${maxValue}`);
    }
    return value;
}
function requireInteger(value, field, minValue, maxValue) {
    if (!Number.isInteger(value)) {
        fieldError(field, `${field} must be an integer`);
    }
    return requireNumber(value, field, minValue, maxValue);
}
function parseDateOnly(value, field) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
        fieldError(field, `${field} is required`);
    }
    const parsed = new Date(`${trimmed.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        fieldError(field, `${field} must be a valid date (YYYY-MM-DD)`);
    }
    return parsed;
}
function parseTimeToUtcDate(value, field) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
    if (!match) {
        fieldError(field, `${field} must be a valid time (HH:mm or HH:mm:ss)`);
    }
    const [, hours, minutes, seconds] = match;
    return new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes), Number(seconds ?? 0)));
}
function toBranchPayload(row) {
    return {
        prb_id: row.prbId,
        prb_prm_id: row.prbPrmId,
        prb_slno: row.prbSlno,
        prb_branch_id: row.prbBranchId,
        prb_is_exclude: row.prbIsExclude,
        prb_notes: row.prbNotes,
        prb_is_active: row.prbIsActive,
        prb_is_deleted: row.prbIsDeleted,
        prb_sync_date: row.prbSyncDate?.toISOString() ?? null,
        prb_created_on: row.prbCreatedOn.toISOString(),
        prb_created_by: row.prbCreatedBy,
        prb_modified_on: row.prbModifiedOn?.toISOString() ?? null,
        prb_modified_by: row.prbModifiedBy,
    };
}
function toPartyPayload(row) {
    return {
        prp_id: row.prpId,
        prp_prm_id: row.prpPrmId,
        prp_slno: row.prpSlno,
        prp_kind: row.prpKind,
        prp_scope_id: row.prpScopeId,
        prp_cust_id: row.prpCustId,
        prp_cust_group_id: row.prpCustGroupId,
        prp_area_id: row.prpAreaId,
        prp_city_id: row.prpCityId,
        prp_is_exclude: row.prpIsExclude,
        prp_match_priority: row.prpMatchPriority,
        prp_notes: row.prpNotes,
        prp_is_active: row.prpIsActive,
        prp_is_deleted: row.prpIsDeleted,
        prp_sync_date: row.prpSyncDate?.toISOString() ?? null,
        prp_created_on: row.prpCreatedOn.toISOString(),
        prp_created_by: row.prpCreatedBy,
        prp_modified_on: row.prpModifiedOn?.toISOString() ?? null,
        prp_modified_by: row.prpModifiedBy,
    };
}
function toItemPayload(row) {
    return {
        pri_id: row.priId,
        pri_prm_id: row.priPrmId,
        pri_slno: row.priSlno,
        pri_kind: row.priKind,
        pri_scope_id: row.priScopeId,
        pri_item_id: row.priItemId,
        pri_group_id: row.priGroupId,
        pri_category_id: row.priCategoryId,
        pri_brand_id: row.priBrandId,
        pri_section_id: row.priSectionId,
        pri_unit_id: row.priUnitId,
        pri_is_exclude: row.priIsExclude,
        pri_disc_perc: (0, module_service_utils_1.toNumber)(row.priDiscPerc),
        pri_disc_qty: (0, module_service_utils_1.toNumber)(row.priDiscQty),
        pri_disc_amt: (0, module_service_utils_1.toNumber)(row.priDiscAmt),
        pri_min_qty: (0, module_service_utils_1.toNumber)(row.priMinQty),
        pri_factor: (0, module_service_utils_1.toNumber)(row.priFactor),
        pri_max_benefit: (0, module_service_utils_1.toNumber)(row.priMaxBenefit),
        pri_match_priority: row.priMatchPriority,
        pri_notes: row.priNotes,
        pri_is_active: row.priIsActive,
        pri_is_deleted: row.priIsDeleted,
        pri_sync_date: row.priSyncDate?.toISOString() ?? null,
        pri_created_on: row.priCreatedOn.toISOString(),
        pri_created_by: row.priCreatedBy,
        pri_modified_on: row.priModifiedOn?.toISOString() ?? null,
        pri_modified_by: row.priModifiedBy,
    };
}
function toSlabPayload(row) {
    return {
        prs_id: row.prsId,
        prs_prm_id: row.prsPrmId,
        prs_slno: row.prsSlno,
        prs_benefit: row.prsBenefit,
        prs_exceeds: (0, module_service_utils_1.toNumber)(row.prsExceeds),
        prs_upto: (0, module_service_utils_1.toNullableNumber)(row.prsUpto),
        prs_each: (0, module_service_utils_1.toNumber)(row.prsEach),
        prs_is_repeat: row.prsIsRepeat,
        prs_max_repeats: row.prsMaxRepeats,
        prs_free_item_id: row.prsFreeItemId,
        prs_free_unit_id: row.prsFreeUnitId,
        prs_free_qty: (0, module_service_utils_1.toNumber)(row.prsFreeQty),
        prs_free_stock_check: row.prsFreeStockCheck,
        prs_disc_perc: (0, module_service_utils_1.toNumber)(row.prsDiscPerc),
        prs_disc_qty: (0, module_service_utils_1.toNumber)(row.prsDiscQty),
        prs_disc_amt: (0, module_service_utils_1.toNumber)(row.prsDiscAmt),
        prs_fixed_price: (0, module_service_utils_1.toNullableNumber)(row.prsFixedPrice),
        prs_max_benefit_amt: (0, module_service_utils_1.toNumber)(row.prsMaxBenefitAmt),
        prs_notes: row.prsNotes,
        prs_is_active: row.prsIsActive,
        prs_is_deleted: row.prsIsDeleted,
        prs_sync_date: row.prsSyncDate?.toISOString() ?? null,
        prs_created_on: row.prsCreatedOn.toISOString(),
        prs_created_by: row.prsCreatedBy,
        prs_modified_on: row.prsModifiedOn?.toISOString() ?? null,
        prs_modified_by: row.prsModifiedBy,
    };
}
function toSchemeSummaryPayload(scheme) {
    return {
        prm_id: scheme.prmId,
        prm_comp_id: scheme.prmCompId,
        prm_branch_id: scheme.prmBranchId,
        prm_tenant_id: scheme.prmTenantId,
        prm_code: scheme.prmCode,
        prm_name: scheme.prmName,
        prm_status: scheme.prmStatus,
        prm_apply_on: scheme.prmApplyOn,
        prm_benefit: scheme.prmBenefit,
        prm_priority: scheme.prmPriority,
        prm_stack_mode: scheme.prmStackMode,
        prm_auto_apply: scheme.prmAutoApply,
        prm_allow_with_manual_disc: scheme.prmAllowWithManualDisc,
        prm_calc_on_amount_type: scheme.prmCalcOnAmountType,
        prm_include_tax: scheme.prmIncludeTax,
        prm_bill_type: scheme.prmBillType,
        prm_min_bill_amount: (0, module_service_utils_1.toNumber)(scheme.prmMinBillAmount),
        prm_min_qty: (0, module_service_utils_1.toNumber)(scheme.prmMinQty),
        prm_branch_scope: scheme.prmBranchScope,
        prm_cust_scope: scheme.prmCustScope,
        prm_item_scope: scheme.prmItemScope,
        prm_price_level_id: scheme.prmPriceLevelId,
        prm_max_benefit_per_bill: (0, module_service_utils_1.toNumber)(scheme.prmMaxBenefitPerBill),
        prm_max_uses_total: scheme.prmMaxUsesTotal,
        prm_max_uses_per_cust: scheme.prmMaxUsesPerCust,
        prm_budget_amount: (0, module_service_utils_1.toNumber)(scheme.prmBudgetAmount),
        prm_coupon_batch_id: scheme.prmCouponBatchId,
        prm_start_date: toIsoDate(scheme.prmStartDate),
        prm_end_date: toIsoDate(scheme.prmEndDate),
        prm_valid_from_time: toIsoTime(scheme.prmValidFromTime),
        prm_valid_to_time: toIsoTime(scheme.prmValidToTime),
        prm_valid_weekdays: scheme.prmValidWeekdays,
        prm_remarks: scheme.prmRemarks,
        prm_is_active: scheme.prmIsActive,
        prm_is_deleted: scheme.prmIsDeleted,
        prm_sync_date: scheme.prmSyncDate?.toISOString() ?? null,
        prm_created_on: scheme.prmCreatedOn.toISOString(),
        prm_created_by: scheme.prmCreatedBy,
        prm_modified_on: scheme.prmModifiedOn?.toISOString() ?? null,
        prm_modified_by: scheme.prmModifiedBy,
        prm_approved_on: scheme.prmApprovedOn?.toISOString() ?? null,
        prm_approved_by: scheme.prmApprovedBy,
    };
}
function toSchemePayload(scheme) {
    return {
        ...toSchemeSummaryPayload(scheme),
        branches: scheme.branches.map(toBranchPayload),
        parties: scheme.parties.map(toPartyPayload),
        items: scheme.items.map(toItemPayload),
        slabs: scheme.slabs.map(toSlabPayload),
    };
}
function resolveForeignKeyField(error) {
    const meta = typeof error.meta?.field_name === 'string'
        ? error.meta.field_name
        : typeof error.meta?.target === 'string'
            ? error.meta.target
            : '';
    const normalized = meta.toLowerCase();
    if (normalized.includes('prm_company'))
        return 'prm_comp_id';
    if (normalized.includes('prm_branch'))
        return 'prm_branch_id';
    if (normalized.includes('prm_price_level'))
        return 'prm_price_level_id';
    if (normalized.includes('prm_coupon_batch'))
        return 'prm_coupon_batch_id';
    if (normalized.includes('prm_approved_by'))
        return 'prm_approved_by';
    if (normalized.includes('prb_branch'))
        return 'prb_branch_id';
    if (normalized.includes('prp_'))
        return 'prp_scope_id';
    if (normalized.includes('pri_unit'))
        return 'pri_unit_id';
    if (normalized.includes('pri_'))
        return 'pri_scope_id';
    if (normalized.includes('prs_free_item'))
        return 'prs_free_item_id';
    if (normalized.includes('prs_free_unit'))
        return 'prs_free_unit_id';
    if (normalized.includes('prs_scheme_benefit'))
        return 'prs_benefit';
    return 'request';
}
function handlePromotionWriteError(error) {
    if ((0, module_service_utils_1.isExclusionConstraintError)(error)) {
        throwConflict('Conflicting promotion scheme', [
            {
                field: 'prm_priority',
                message: 'Another approved exclusive scheme already runs on this branch and trigger at this ' +
                    'priority over an overlapping date range. Change the priority, the dates, or use ' +
                    'STACKABLE.',
            },
        ]);
    }
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError)) {
        return;
    }
    if (error.code === 'P2002') {
        throwConflict('Duplicate promotion data is not allowed', [
            {
                field: 'request',
                message: 'A record with the same unique values already exists',
            },
        ]);
        return;
    }
    if (error.code === 'P2003') {
        throwBadRequest('Validation failed', [
            {
                field: resolveForeignKeyField(error),
                message: 'Referenced master record was not found or is inactive',
            },
        ]);
    }
}
//# sourceMappingURL=promotion-scheme.utils.js.map