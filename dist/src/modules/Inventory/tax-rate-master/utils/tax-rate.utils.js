"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEDGER_LINE_LOOKUP = exports.TAX_RATE_LOOKUP = exports.MAX_TAX_RATE_PERC = exports.isSupplyNature = exports.SUPPLY_NATURES = exports.CESS_BASES = exports.ZERO_ONLY_TAXABILITIES = exports.TAX_TAXABILITIES = void 0;
exports.toLedgerLinePayload = toLedgerLinePayload;
exports.toTaxRatePayload = toTaxRatePayload;
exports.throwTaxRateBadRequest = throwTaxRateBadRequest;
exports.throwTaxRateConflict = throwTaxRateConflict;
exports.handleTaxRateWriteError = handleTaxRateWriteError;
exports.pushError = pushError;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
exports.TAX_TAXABILITIES = [
    'TAXABLE',
    'EXEMPT',
    'NIL_RATED',
    'NON_GST',
    'ZERO_RATED',
];
exports.ZERO_ONLY_TAXABILITIES = ['EXEMPT', 'NIL_RATED', 'NON_GST'];
exports.CESS_BASES = ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'];
var ledger_map_helper_1 = require("../../../accountsModule/ledgerRole/ledger-map.helper");
Object.defineProperty(exports, "SUPPLY_NATURES", { enumerable: true, get: function () { return ledger_map_helper_1.SUPPLY_NATURES; } });
Object.defineProperty(exports, "isSupplyNature", { enumerable: true, get: function () { return ledger_map_helper_1.isSupplyNature; } });
exports.MAX_TAX_RATE_PERC = 100;
exports.TAX_RATE_LOOKUP = {
    supersedes: { select: { taxName: true } },
};
exports.LEDGER_LINE_LOOKUP = {
    role: { select: { alrLabel: true } },
    ledger: { select: { ledName: true } },
};
function toLedgerLinePayload(row) {
    return {
        trl_id: row.trlId,
        trl_tax_id: row.trlTaxId,
        trl_role: row.trlRole,
        trl_role_label: row.role?.alrLabel ?? null,
        trl_supply_nature: row.trlSupplyNature,
        trl_ledger_id: row.trlLedgerId,
        trl_ledger_name: row.ledger?.ledName ?? null,
        trl_remarks: row.trlRemarks,
        trl_is_active: row.trlIsActive,
        trl_is_deleted: row.trlIsDeleted,
        trl_sync_date: row.trlSyncDate ? row.trlSyncDate.toISOString() : null,
        trl_created_on: row.trlCreatedOn.toISOString(),
        trl_created_by: row.trlCreatedBy,
        trl_modified_on: row.trlModifiedOn ? row.trlModifiedOn.toISOString() : null,
        trl_modified_by: row.trlModifiedBy,
    };
}
function toTaxRatePayload(row) {
    return {
        tax_id: row.taxId,
        tax_name: row.taxName,
        tax_code: row.taxCode,
        tax_sort_order: row.taxSortOrder,
        tax_taxability: row.taxTaxability,
        tax_is_reverse_charge: row.taxIsReverseCharge,
        tax_rate_perc: (0, module_service_utils_1.toNumber)(row.taxRatePerc),
        tax_cgst_perc: (0, module_service_utils_1.toNullableNumber)(row.taxCgstPerc),
        tax_sgst_perc: (0, module_service_utils_1.toNullableNumber)(row.taxSgstPerc),
        tax_igst_perc: (0, module_service_utils_1.toNullableNumber)(row.taxIgstPerc),
        tax_cess_basis: row.taxCessBasis,
        tax_cess_perc: (0, module_service_utils_1.toNumber)(row.taxCessPerc),
        tax_cess_per_unit: (0, module_service_utils_1.toNumber)(row.taxCessPerUnit),
        tax_acess_basis: row.taxAcessBasis,
        tax_acess_perc: (0, module_service_utils_1.toNumber)(row.taxAcessPerc),
        tax_acess_per_unit: (0, module_service_utils_1.toNumber)(row.taxAcessPerUnit),
        tax_supersedes_id: row.taxSupersedesId,
        tax_supersedes_name: row.supersedes?.taxName ?? null,
        tax_is_active: row.taxIsActive,
        tax_is_deleted: row.taxIsDeleted,
        tax_sync_date: row.taxSyncDate ? row.taxSyncDate.toISOString() : null,
        tax_created_on: row.taxCreatedOn.toISOString(),
        tax_created_by: row.taxCreatedBy,
        tax_modified_on: row.taxModifiedOn ? row.taxModifiedOn.toISOString() : null,
        tax_modified_by: row.taxModifiedBy,
        lines: (row.ledgerOverrides ?? []).map(toLedgerLinePayload),
    };
}
function throwTaxRateBadRequest(message, errors) {
    (0, module_service_utils_1.throwInventoryBadRequest)(message, errors);
}
function throwTaxRateConflict(message, errors) {
    (0, module_service_utils_1.throwInventoryConflict)(message, errors);
}
function handleTaxRateWriteError(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError)) {
        return;
    }
    if (error.code === 'P2002') {
        throwTaxRateConflict('Duplicate tax rate data is not allowed', [
            { field: resolveUniqueField(error), message: 'A record with the same value already exists' },
        ]);
        return;
    }
    if (error.code === 'P2003') {
        throwTaxRateBadRequest('Validation failed', [
            {
                field: resolveForeignKeyField(error),
                message: 'Referenced master record was not found',
            },
        ]);
    }
}
function resolveUniqueField(error) {
    const target = describeTarget(error);
    if (target.includes('tax_code'))
        return 'tax_code';
    if (target.includes('tax_name'))
        return 'tax_name';
    if (target.includes('trl'))
        return 'lines';
    return 'request';
}
function resolveForeignKeyField(error) {
    const target = describeTarget(error);
    if (target.includes('supersedes'))
        return 'tax_supersedes_id';
    if (target.includes('ledger'))
        return 'lines';
    if (target.includes('role'))
        return 'lines';
    return 'request';
}
function describeTarget(error) {
    const target = error.meta?.target;
    if (typeof target === 'string')
        return target;
    if (Array.isArray(target))
        return target.join(',');
    return error.message;
}
function pushError(errors, field, message) {
    errors.push({ field, message });
}
//# sourceMappingURL=tax-rate.utils.js.map