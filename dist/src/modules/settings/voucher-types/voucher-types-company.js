"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voucherTypeCompanyMismatch = voucherTypeCompanyMismatch;
exports.resolveVoucherTypeCompany = resolveVoucherTypeCompany;
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const voucher_types_error_codes_1 = require("./types/voucher-types-error-codes");
function voucherTypeCompanyMismatch(message) {
    (0, module_shared_utils_1.throwForbidden)('Voucher type belongs to another company', [
        { field: 'companyId', message, code: voucher_types_error_codes_1.VoucherTypeErrorCode.COMPANY_MISMATCH },
    ]);
}
async function resolveVoucherTypeCompany(client, tokenCompanyId, bodyCompanyId) {
    const token = tokenCompanyId?.toLowerCase() || null;
    const body = bodyCompanyId.toLowerCase();
    if (token && token !== body) {
        voucherTypeCompanyMismatch(`companyId ${body} is not the login company ${token}`);
    }
    if (!token) {
        const [c] = await client.$queryRaw `
      SELECT comp_id FROM public.companys
       WHERE comp_id = ${body}::uuid AND coalesce(comp_is_deleted, false) = false`;
        if (!c) {
            voucherTypeCompanyMismatch(`companyId ${body} is not a live company`);
        }
    }
    return body;
}
//# sourceMappingURL=voucher-types-company.js.map