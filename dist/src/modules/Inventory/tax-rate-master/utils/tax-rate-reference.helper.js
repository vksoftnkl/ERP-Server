"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTaxRateRefs = assertTaxRateRefs;
exports.collectTaxRateRefErrors = collectTaxRateRefErrors;
exports.collectTaxRateRefs = collectTaxRateRefs;
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
const tax_rate_error_codes_1 = require("../types/tax-rate-error-codes");
const DEFAULT_TAX_RATE_REF_CODES = {
    notFound: tax_rate_error_codes_1.TaxRateErrorCode.REF_NOT_FOUND,
    inactive: tax_rate_error_codes_1.TaxRateErrorCode.REF_INACTIVE,
};
async function assertTaxRateRefs(client, refs, message = 'Validation failed', codes = DEFAULT_TAX_RATE_REF_CODES) {
    const errors = await collectTaxRateRefErrors(client, refs, codes);
    if (errors.length > 0) {
        (0, module_service_utils_1.throwBadRequest)(message, errors);
    }
}
async function collectTaxRateRefErrors(client, refs, codes = DEFAULT_TAX_RATE_REF_CODES) {
    if (refs.length === 0) {
        return [];
    }
    const taxIds = [...new Set(refs.map((ref) => ref.taxId))];
    const rates = await client.taxRateMaster.findMany({
        where: { taxId: { in: taxIds } },
        select: { taxId: true, taxName: true, taxIsActive: true, taxIsDeleted: true },
    });
    const rateById = new Map(rates.map((rate) => [rate.taxId, rate]));
    const errors = [];
    for (const ref of refs) {
        const rate = rateById.get(ref.taxId);
        if (!rate || rate.taxIsDeleted) {
            errors.push({
                field: ref.field,
                code: codes.notFound,
                message: `No tax rate found with id ${ref.taxId}`,
            });
            continue;
        }
        if (!rate.taxIsActive) {
            errors.push({
                field: ref.field,
                code: codes.inactive,
                message: `Tax rate "${rate.taxName}" is inactive and cannot be quoted on a new document`,
            });
        }
    }
    return errors;
}
function collectTaxRateRefs(lines, taxIdOf, fieldOf) {
    const refs = [];
    lines.forEach((line, index) => {
        const taxId = taxIdOf(line);
        if (typeof taxId === 'string' && taxId.length > 0) {
            refs.push({ taxId, field: fieldOf(index) });
        }
    });
    return refs;
}
//# sourceMappingURL=tax-rate-reference.helper.js.map