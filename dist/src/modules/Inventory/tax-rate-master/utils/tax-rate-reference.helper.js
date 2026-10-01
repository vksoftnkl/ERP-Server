"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTaxRateRefs = assertTaxRateRefs;
exports.collectTaxRateRefErrors = collectTaxRateRefErrors;
exports.collectTaxRateRefs = collectTaxRateRefs;
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
async function assertTaxRateRefs(client, refs, message = 'Validation failed') {
    const errors = await collectTaxRateRefErrors(client, refs);
    if (errors.length > 0) {
        (0, module_service_utils_1.throwBadRequest)(message, errors);
    }
}
async function collectTaxRateRefErrors(client, refs) {
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
            errors.push({ field: ref.field, message: `No tax rate found with id ${ref.taxId}` });
            continue;
        }
        if (!rate.taxIsActive) {
            errors.push({
                field: ref.field,
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