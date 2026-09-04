"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_LOOKUP = exports.SLAB_LOOKUP = exports.ITEM_LOOKUP = exports.PARTY_LOOKUP = exports.BRANCH_LOOKUP = exports.SCHEME_LOOKUP = exports.LSI_DEFAULT_MATCH_PRIORITY = exports.LSP_DEFAULT_MATCH_PRIORITY = exports.LSC_WEEKDAYS_PATTERN = exports.LSC_CODE_PATTERN = exports.LSI_KINDS = exports.LSP_KINDS = exports.LSC_EXPIRY_BASES = exports.LSC_RETURN_MODES = exports.LSC_POOL_MODES = exports.LSC_SCOPES = exports.LSC_ROUNDING = exports.LSC_BILL_TYPES = exports.LSC_CALC_ON = exports.LSC_APPLY_ON = exports.LSC_STATUSES = exports.LSC_TYPES = exports.UUID_PATTERN = void 0;
exports.throwBadRequest = throwBadRequest;
exports.throwConflict = throwConflict;
exports.fieldError = fieldError;
exports.toIsoDate = toIsoDate;
exports.toNullableIsoDate = toNullableIsoDate;
exports.toIsoTime = toIsoTime;
exports.normalizeNullableString = normalizeNullableString;
exports.resolveActor = resolveActor;
exports.resolveActorUuid = resolveActorUuid;
exports.requireString = requireString;
exports.requireUuid = requireUuid;
exports.normalizeEnum = normalizeEnum;
exports.requireNumber = requireNumber;
exports.requireInteger = requireInteger;
exports.parseDateOnly = parseDateOnly;
exports.parseNullableDateOnly = parseNullableDateOnly;
exports.parseTimeToUtcDate = parseTimeToUtcDate;
exports.toBranchPayload = toBranchPayload;
exports.toPartyPayload = toPartyPayload;
exports.toItemPayload = toItemPayload;
exports.toSlabPayload = toSlabPayload;
exports.toGiftPayload = toGiftPayload;
exports.toSchemeSummaryPayload = toSchemeSummaryPayload;
exports.toSchemePayload = toSchemePayload;
exports.handleLoyaltyWriteError = handleLoyaltyWriteError;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
exports.UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
exports.LSC_TYPES = ['EARN', 'REDEEM', 'BOTH'];
exports.LSC_STATUSES = ['DRAFT', 'APPROVED', 'SUSPENDED', 'CLOSED'];
exports.LSC_APPLY_ON = ['BILL_AMOUNT', 'BILL_QTY', 'ITEM_AMOUNT', 'ITEM_QTY'];
exports.LSC_CALC_ON = ['GROSS_AMOUNT', 'NET_AMOUNT', 'TAXABLE_AMOUNT'];
exports.LSC_BILL_TYPES = ['ALL', 'CASH', 'CREDIT'];
exports.LSC_ROUNDING = ['FLOOR', 'ROUND', 'CEIL', 'NONE'];
exports.LSC_SCOPES = ['ALL', 'LIST'];
exports.LSC_POOL_MODES = ['COMPANY', 'BRANCH'];
exports.LSC_RETURN_MODES = ['REVERSE', 'IGNORE'];
exports.LSC_EXPIRY_BASES = [
    'NONE',
    'EARN_DATE',
    'MONTH_END',
    'YEAR_END',
    'SCHEME_END_DATE',
];
exports.LSP_KINDS = ['CUSTOMER', 'CUSTOMER_GROUP'];
exports.LSI_KINDS = [
    'ITEM',
    'ITEM_GROUP',
    'ITEM_CATEGORY',
    'ITEM_BRAND',
    'ITEM_SECTION',
];
exports.LSC_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
exports.LSC_WEEKDAYS_PATTERN = /^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/;
exports.LSP_DEFAULT_MATCH_PRIORITY = {
    CUSTOMER: 2,
    CUSTOMER_GROUP: 1,
};
exports.LSI_DEFAULT_MATCH_PRIORITY = {
    ITEM: 4,
    ITEM_BRAND: 3,
    ITEM_CATEGORY: 2,
    ITEM_SECTION: 1,
    ITEM_GROUP: 0,
};
exports.SCHEME_LOOKUP = {
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
};
exports.BRANCH_LOOKUP = {
    branch: { select: { brName: true, brCode: true, brShort: true } },
};
exports.PARTY_LOOKUP = {
    customer: { select: { cusName: true, cusCode: true } },
    customerGroup: { select: { cgrName: true, cgrShort: true } },
};
exports.ITEM_LOOKUP = {
    item: { select: { itemNameEn: true } },
    itemGroup: { select: { itgName: true } },
    itemCategory: { select: { categoryName: true } },
    itemBrand: { select: { brand_name: true } },
    itemSection: { select: { secName: true } },
};
exports.SLAB_LOOKUP = {
    item: { select: { itemNameEn: true } },
    unit: { select: { unit: { select: { unit_name: true } } } },
};
exports.GIFT_LOOKUP = {
    item: { select: { itemNameEn: true } },
    unit: { select: { unit: { select: { unit_name: true } } } },
};
function firstName(...candidates) {
    return candidates.find((value) => value !== null && value !== undefined) ?? null;
}
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
function toNullableIsoDate(value) {
    return value ? toIsoDate(value) : null;
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
function normalizeEnum(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
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
function parseNullableDateOnly(value, field) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed ? parseDateOnly(trimmed, field) : null;
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
        lsb_id: row.lsbId,
        lsb_lsc_id: row.lsbLscId,
        lsb_slno: row.lsbSlno,
        lsb_branch_id: row.lsbBranchId,
        lsb_branch_name: row.branch?.brName ?? null,
        lsb_branch_code: firstName(row.branch?.brCode, row.branch?.brShort),
        lsb_is_exclude: row.lsbIsExclude,
        lsb_notes: row.lsbNotes,
        lsb_is_active: row.lsbIsActive,
        lsb_is_deleted: row.lsbIsDeleted,
        lsb_sync_date: row.lsbSyncDate?.toISOString() ?? null,
        lsb_created_on: row.lsbCreatedOn.toISOString(),
        lsb_created_by: row.lsbCreatedBy,
        lsb_modified_on: row.lsbModifiedOn?.toISOString() ?? null,
        lsb_modified_by: row.lsbModifiedBy,
    };
}
function toPartyPayload(row) {
    return {
        lsp_id: row.lspId,
        lsp_lsc_id: row.lspLscId,
        lsp_slno: row.lspSlno,
        lsp_kind: row.lspKind,
        lsp_scope_id: row.lspScopeId,
        lsp_cust_id: row.lspCustId,
        lsp_cust_group_id: row.lspCustGroupId,
        lsp_scope_name: firstName(row.customer?.cusName, row.customerGroup?.cgrName),
        lsp_scope_code: firstName(row.customer?.cusCode, row.customerGroup?.cgrShort),
        lsp_is_exclude: row.lspIsExclude,
        lsp_match_priority: row.lspMatchPriority,
        lsp_notes: row.lspNotes,
        lsp_is_active: row.lspIsActive,
        lsp_is_deleted: row.lspIsDeleted,
        lsp_sync_date: row.lspSyncDate?.toISOString() ?? null,
        lsp_created_on: row.lspCreatedOn.toISOString(),
        lsp_created_by: row.lspCreatedBy,
        lsp_modified_on: row.lspModifiedOn?.toISOString() ?? null,
        lsp_modified_by: row.lspModifiedBy,
    };
}
function toItemPayload(row) {
    return {
        lsi_id: row.lsiId,
        lsi_lsc_id: row.lsiLscId,
        lsi_slno: row.lsiSlno,
        lsi_kind: row.lsiKind,
        lsi_scope_id: row.lsiScopeId,
        lsi_item_id: row.lsiItemId,
        lsi_group_id: row.lsiGroupId,
        lsi_category_id: row.lsiCategoryId,
        lsi_brand_id: row.lsiBrandId,
        lsi_section_id: row.lsiSectionId,
        lsi_scope_name: firstName(row.item?.itemNameEn, row.itemGroup?.itgName, row.itemCategory?.categoryName, row.itemBrand?.brand_name, row.itemSection?.secName),
        lsi_is_exclude: row.lsiIsExclude,
        lsi_factor: (0, module_service_utils_1.toNumber)(row.lsiFactor),
        lsi_points: (0, module_service_utils_1.toNumber)(row.lsiPoints),
        lsi_max_points: (0, module_service_utils_1.toNumber)(row.lsiMaxPoints),
        lsi_match_priority: row.lsiMatchPriority,
        lsi_notes: row.lsiNotes,
        lsi_is_active: row.lsiIsActive,
        lsi_is_deleted: row.lsiIsDeleted,
        lsi_sync_date: row.lsiSyncDate?.toISOString() ?? null,
        lsi_created_on: row.lsiCreatedOn.toISOString(),
        lsi_created_by: row.lsiCreatedBy,
        lsi_modified_on: row.lsiModifiedOn?.toISOString() ?? null,
        lsi_modified_by: row.lsiModifiedBy,
    };
}
function toSlabPayload(row) {
    return {
        lss_id: row.lssId,
        lss_lsc_id: row.lssLscId,
        lss_slno: row.lssSlno,
        lss_item_id: row.lssItemId,
        lss_unit_id: row.lssUnitId,
        lss_item_name: row.item?.itemNameEn ?? null,
        lss_unit_name: row.unit?.unit.unit_name ?? null,
        lss_exceeds: (0, module_service_utils_1.toNumber)(row.lssExceeds),
        lss_upto: (0, module_service_utils_1.toNullableNumber)(row.lssUpto),
        lss_each: (0, module_service_utils_1.toNumber)(row.lssEach),
        lss_points: (0, module_service_utils_1.toNumber)(row.lssPoints),
        lss_factor: (0, module_service_utils_1.toNumber)(row.lssFactor),
        lss_max_points: (0, module_service_utils_1.toNumber)(row.lssMaxPoints),
        lss_notes: row.lssNotes,
        lss_is_active: row.lssIsActive,
        lss_is_deleted: row.lssIsDeleted,
        lss_sync_date: row.lssSyncDate?.toISOString() ?? null,
        lss_created_on: row.lssCreatedOn.toISOString(),
        lss_created_by: row.lssCreatedBy,
        lss_modified_on: row.lssModifiedOn?.toISOString() ?? null,
        lss_modified_by: row.lssModifiedBy,
    };
}
function toGiftPayload(row) {
    return {
        lsg_id: row.lsgId,
        lsg_lsc_id: row.lsgLscId,
        lsg_slno: row.lsgSlno,
        lsg_item_id: row.lsgItemId,
        lsg_unit_id: row.lsgUnitId,
        lsg_item_name: row.item?.itemNameEn ?? null,
        lsg_unit_name: row.unit?.unit.unit_name ?? null,
        lsg_item_qty: (0, module_service_utils_1.toNumber)(row.lsgItemQty),
        lsg_redeem_points: (0, module_service_utils_1.toNumber)(row.lsgRedeemPoints),
        lsg_repeat: row.lsgRepeat,
        lsg_max_qty_per_bill: (0, module_service_utils_1.toNumber)(row.lsgMaxQtyPerBill),
        lsg_stock_check: row.lsgStockCheck,
        lsg_valid_from: toNullableIsoDate(row.lsgValidFrom),
        lsg_valid_upto: toNullableIsoDate(row.lsgValidUpto),
        lsg_notes: row.lsgNotes,
        lsg_is_active: row.lsgIsActive,
        lsg_is_deleted: row.lsgIsDeleted,
        lsg_sync_date: row.lsgSyncDate?.toISOString() ?? null,
        lsg_created_on: row.lsgCreatedOn.toISOString(),
        lsg_created_by: row.lsgCreatedBy,
        lsg_modified_on: row.lsgModifiedOn?.toISOString() ?? null,
        lsg_modified_by: row.lsgModifiedBy,
    };
}
function toSchemeSummaryPayload(scheme) {
    return {
        lsc_id: scheme.lscId,
        lsc_comp_id: scheme.lscCompId,
        lsc_branch_id: scheme.lscBranchId,
        lsc_comp_name: scheme.company?.compName ?? null,
        lsc_branch_name: scheme.branch?.brName ?? null,
        lsc_tenant_id: scheme.lscTenantId,
        lsc_code: scheme.lscCode,
        lsc_name: scheme.lscName,
        lsc_type: scheme.lscType,
        lsc_status: scheme.lscStatus,
        lsc_priority: scheme.lscPriority,
        lsc_auto_apply: scheme.lscAutoApply,
        lsc_apply_on: scheme.lscApplyOn,
        lsc_calc_on_amount_type: scheme.lscCalcOnAmountType,
        lsc_include_tax: scheme.lscIncludeTax,
        lsc_bill_type: scheme.lscBillType,
        lsc_min_bill_amount: (0, module_service_utils_1.toNumber)(scheme.lscMinBillAmount),
        lsc_max_earn_points: (0, module_service_utils_1.toNumber)(scheme.lscMaxEarnPoints),
        lsc_earn_on_discounted: scheme.lscEarnOnDiscounted,
        lsc_earn_on_charges: scheme.lscEarnOnCharges,
        lsc_earn_with_redeem: scheme.lscEarnWithRedeem,
        lsc_rounding_method: scheme.lscRoundingMethod,
        lsc_points_decimals: scheme.lscPointsDecimals,
        lsc_branch_scope: scheme.lscBranchScope,
        lsc_cust_scope: scheme.lscCustScope,
        lsc_item_scope: scheme.lscItemScope,
        lsc_price_level_id: scheme.lscPriceLevelId,
        lsc_pool_mode: scheme.lscPoolMode,
        lsc_allow_cross_branch_redeem: scheme.lscAllowCrossBranchRedeem,
        lsc_allow_point_redeem: scheme.lscAllowPointRedeem,
        lsc_allow_gift_redeem: scheme.lscAllowGiftRedeem,
        lsc_redeem_tender_id: scheme.lscRedeemTenderId,
        lsc_redeem_value_per_point: (0, module_service_utils_1.toNumber)(scheme.lscRedeemValuePerPoint),
        lsc_min_redeem_points: (0, module_service_utils_1.toNumber)(scheme.lscMinRedeemPoints),
        lsc_max_redeem_points: (0, module_service_utils_1.toNumber)(scheme.lscMaxRedeemPoints),
        lsc_max_redeem_perc: (0, module_service_utils_1.toNumber)(scheme.lscMaxRedeemPerc),
        lsc_redeem_min_bill_amount: (0, module_service_utils_1.toNumber)(scheme.lscRedeemMinBillAmount),
        lsc_redeem_multiple: (0, module_service_utils_1.toNumber)(scheme.lscRedeemMultiple),
        lsc_expiry_basis: scheme.lscExpiryBasis,
        lsc_points_valid_days: scheme.lscPointsValidDays,
        lsc_activation_days: scheme.lscActivationDays,
        lsc_return_mode: scheme.lscReturnMode,
        lsc_start_date: toIsoDate(scheme.lscStartDate),
        lsc_end_date: toIsoDate(scheme.lscEndDate),
        lsc_valid_from_time: toIsoTime(scheme.lscValidFromTime),
        lsc_valid_to_time: toIsoTime(scheme.lscValidToTime),
        lsc_valid_weekdays: scheme.lscValidWeekdays,
        lsc_remarks: scheme.lscRemarks,
        lsc_is_active: scheme.lscIsActive,
        lsc_is_deleted: scheme.lscIsDeleted,
        lsc_sync_date: scheme.lscSyncDate?.toISOString() ?? null,
        lsc_created_on: scheme.lscCreatedOn.toISOString(),
        lsc_created_by: scheme.lscCreatedBy,
        lsc_modified_on: scheme.lscModifiedOn?.toISOString() ?? null,
        lsc_modified_by: scheme.lscModifiedBy,
        lsc_approved_on: scheme.lscApprovedOn?.toISOString() ?? null,
        lsc_approved_by: scheme.lscApprovedBy,
    };
}
function toSchemePayload(scheme) {
    return {
        ...toSchemeSummaryPayload(scheme),
        branches: scheme.branches.map(toBranchPayload),
        parties: scheme.parties.map(toPartyPayload),
        items: scheme.items.map(toItemPayload),
        slabs: scheme.slabs.map(toSlabPayload),
        gifts: scheme.gifts.map(toGiftPayload),
    };
}
function resolveForeignKeyField(error) {
    const meta = typeof error.meta?.field_name === 'string'
        ? error.meta.field_name
        : typeof error.meta?.target === 'string'
            ? error.meta.target
            : '';
    const normalized = meta.toLowerCase();
    if (normalized.includes('lsc_company'))
        return 'lsc_comp_id';
    if (normalized.includes('lsc_branch'))
        return 'lsc_branch_id';
    if (normalized.includes('lsc_price_level'))
        return 'lsc_price_level_id';
    if (normalized.includes('lsc_redeem_tender'))
        return 'lsc_redeem_tender_id';
    if (normalized.includes('lsc_approved_by'))
        return 'lsc_approved_by';
    if (normalized.includes('lsb_branch'))
        return 'lsb_branch_id';
    if (normalized.includes('lsp_'))
        return 'lsp_scope_id';
    if (normalized.includes('lsi_'))
        return 'lsi_scope_id';
    if (normalized.includes('lss_item'))
        return 'lss_item_id';
    if (normalized.includes('lss_unit'))
        return 'lss_unit_id';
    if (normalized.includes('lsg_item'))
        return 'lsg_item_id';
    if (normalized.includes('lsg_unit'))
        return 'lsg_unit_id';
    return 'request';
}
function handleLoyaltyWriteError(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError)) {
        return;
    }
    if (error.code === 'P2002') {
        throwConflict('Duplicate loyalty data is not allowed', [
            { field: 'request', message: 'A record with the same unique values already exists' },
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
        return;
    }
    const constraint = typeof error.meta?.constraint === 'string' ? error.meta.constraint : undefined;
    if (constraint?.startsWith('ck_ls')) {
        throwBadRequest('Validation failed', [
            { field: 'request', message: `Database constraint ${constraint} rejected this row` },
        ]);
    }
}
//# sourceMappingURL=loyalty.utils.js.map