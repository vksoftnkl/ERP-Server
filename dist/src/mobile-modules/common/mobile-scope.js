"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertMobileCompany = assertMobileCompany;
exports.resolveMobileDevice = resolveMobileDevice;
exports.findMobileBranch = findMobileBranch;
exports.requireMobileBranch = requireMobileBranch;
exports.requireMobileBranchOfCompany = requireMobileBranchOfCompany;
exports.databaseToday = databaseToday;
exports.requireMobileAccYear = requireMobileAccYear;
exports.lockMobileClientUuid = lockMobileClientUuid;
exports.isClientUuidClash = isClientUuidClash;
exports.requireMobileLogin = requireMobileLogin;
const common_1 = require("@nestjs/common");
const auth_error_codes_1 = require("../../modules/auth/types/auth-error-codes");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const mobile_error_codes_1 = require("./mobile-error-codes");
async function assertMobileCompany(client, companyId, field = 'companyId') {
    const [row] = await client.$queryRaw `
    SELECT c.comp_id AS "compId", c.comp_gst_applicable AS "compGstApplicable"
      FROM public.companys c
     WHERE c.comp_id = ${companyId}::uuid
       AND c.comp_is_deleted = false
       AND c.comp_is_active = true`;
    if (!row) {
        (0, module_shared_utils_1.throwNotFound)('Company not found', field, `No active company ${companyId}`, mobile_error_codes_1.MobileErrorCode.COMPANY_NOT_FOUND);
    }
    return row;
}
async function resolveMobileDevice(client, deviceUid, field = 'deviceUid') {
    const rows = await client.$queryRaw `
    SELECT d.dev_id AS "devId", d.dev_code AS "devCode",
           d.dev_company_id AS "devCompanyId", d.dev_branch_id AS "devBranchId",
           d.dev_is_active AS "devIsActive", d.dev_is_blocked AS "devIsBlocked",
           d.dev_block_reason AS "devBlockReason"
      FROM fixed.device_master d
     WHERE d.dev_device_uid = ${deviceUid}
       AND d.dev_is_deleted = false
     ORDER BY d.dev_is_active DESC, d.dev_is_blocked ASC, d.dev_created_on DESC
     LIMIT 1`;
    const device = rows[0];
    if (!device) {
        (0, module_shared_utils_1.throwForbidden)('Phone not registered', [
            {
                field,
                message: `No registered device has the uid ${deviceUid}. Add the phone on the Device List screen.`,
                code: mobile_error_codes_1.MobileErrorCode.DEVICE_NOT_REGISTERED,
            },
        ]);
    }
    if (device.devIsBlocked) {
        (0, module_shared_utils_1.throwForbidden)('Phone blocked', [
            {
                field,
                message: device.devBlockReason
                    ? `This phone is blocked: ${device.devBlockReason}`
                    : 'This phone is blocked.',
                code: mobile_error_codes_1.MobileErrorCode.DEVICE_BLOCKED,
            },
        ]);
    }
    if (!device.devIsActive) {
        (0, module_shared_utils_1.throwForbidden)('Phone switched off', [
            {
                field,
                message: 'This phone is registered but not active.',
                code: mobile_error_codes_1.MobileErrorCode.DEVICE_INACTIVE,
            },
        ]);
    }
    return {
        devId: device.devId,
        devCode: device.devCode,
        devCompanyId: device.devCompanyId,
        devBranchId: device.devBranchId,
    };
}
async function findMobileBranch(client, companyId, preferredBranchId) {
    const rows = await client.$queryRaw `
    SELECT b.br_id AS "brId",
           (b.br_id = ${preferredBranchId}::uuid) IS TRUE AS "preferred",
           b.br_is_default IS TRUE AS "isDefault"
      FROM public.branch_master b
     WHERE b.br_comp_id = ${companyId}::uuid
       AND b.br_is_deleted = false
       AND b.br_is_active = true
     ORDER BY 2 DESC, 3 DESC, b.br_code NULLS LAST, b.br_id`;
    const preferred = rows.find((row) => row.preferred) ?? rows.find((row) => row.isDefault);
    if (preferred) {
        return preferred.brId;
    }
    return rows.length === 1 ? rows[0].brId : null;
}
async function requireMobileBranch(client, companyId, preferredBranchId) {
    const branchId = await findMobileBranch(client, companyId, preferredBranchId);
    if (!branchId) {
        (0, module_shared_utils_1.throwUnprocessable)('No branch to save in', [
            {
                field: 'deviceUid',
                message: "The phone's branch is not one of this company's, and the company has no default " +
                    "branch to fall back on. Set the phone's branch on the Device List screen, or mark " +
                    "one of the company's branches as default.",
                code: mobile_error_codes_1.MobileErrorCode.BRANCH_NOT_RESOLVED,
            },
        ]);
    }
    return branchId;
}
async function requireMobileBranchOfCompany(client, companyId, branchId, field) {
    const [row] = await client.$queryRaw `
    SELECT b.br_id AS "brId"
      FROM public.branch_master b
     WHERE b.br_id = ${branchId}::uuid
       AND b.br_comp_id = ${companyId}::uuid
       AND b.br_is_deleted = false
       AND b.br_is_active = true`;
    if (!row) {
        (0, module_shared_utils_1.throwUnprocessable)('Branch not of this company', [
            {
                field,
                message: `Branch ${branchId} is not an active branch of company ${companyId}. Pick one of ` +
                    "the company's branches and send it again.",
                code: mobile_error_codes_1.MobileErrorCode.BRANCH_NOT_OF_COMPANY,
            },
        ]);
    }
    return row.brId;
}
async function databaseToday(client) {
    const [row] = await client.$queryRaw `SELECT CURRENT_DATE::text AS today`;
    return row.today;
}
async function requireMobileAccYear(client, companyId, onDate, field) {
    const [fy] = await client.$queryRaw `
    SELECT btrim(f.fy_year_name) AS name
      FROM public.fiscal_years f
     WHERE f.comp_id = ${companyId}::uuid
       AND f.is_deleted = false
       AND ${onDate}::date BETWEEN f.fy_begin_date AND f.fy_end_date
     ORDER BY f.fy_begin_date DESC
     LIMIT 1`;
    if (!fy) {
        (0, module_shared_utils_1.throwUnprocessable)('No financial year', [
            {
                field,
                message: `No financial year of company ${companyId} holds ${onDate}.`,
                code: mobile_error_codes_1.MobileErrorCode.NO_FISCAL_YEAR,
            },
        ]);
    }
    return fy.name;
}
async function lockMobileClientUuid(client, kind, companyId, clientUuid) {
    const key = `mobile-${kind}:${companyId}:${clientUuid.toLowerCase()}`;
    await client.$queryRaw `
    SELECT count(pg_advisory_xact_lock(hashtextextended(${key}, 0)))::int AS locked`;
}
function isClientUuidClash(error) {
    if (!(0, module_shared_utils_1.isUniqueConstraintError)(error)) {
        return false;
    }
    const violated = (0, module_shared_utils_1.violatedConstraintOf)(error);
    return violated === null || violated.includes('client_uuid');
}
function requireMobileLogin(userId) {
    if (!userId) {
        throw new common_1.UnauthorizedException((0, auth_error_codes_1.authErrorBody)('Log in to upload this', 'authorization', auth_error_codes_1.AuthErrorCode.AUTHORIZATION_MISSING));
    }
    return userId;
}
//# sourceMappingURL=mobile-scope.js.map