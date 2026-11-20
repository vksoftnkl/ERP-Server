"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMobileLogin = findMobileLogin;
exports.requireMobileLoginRow = requireMobileLoginRow;
const common_1 = require("@nestjs/common");
const auth_error_codes_1 = require("../../modules/auth/types/auth-error-codes");
async function findMobileLogin(client, userId) {
    const [row] = await client.$queryRaw `
    SELECT u.usr_id::text AS "userId", u.usr_login_name AS "loginName",
           e.emp_id::text AS "employeeId", e.emp_name AS "employeeName"
      FROM public.user_master u
      LEFT JOIN public.employee_master e
        ON e.emp_id = u.usr_employee_id AND e.emp_is_deleted = false
     WHERE u.usr_id = ${userId}::uuid
       AND u.usr_is_deleted = false`;
    return row ?? null;
}
async function requireMobileLoginRow(client, userId) {
    const login = await findMobileLogin(client, userId);
    if (!login) {
        throw new common_1.UnauthorizedException((0, auth_error_codes_1.authErrorBody)('This login no longer exists', 'authorization', auth_error_codes_1.AuthErrorCode.USER_INACTIVE));
    }
    return login;
}
//# sourceMappingURL=mobile-login.js.map