import { UnauthorizedException } from '@nestjs/common';
import { AuthErrorCode, authErrorBody } from '../../modules/auth/types/auth-error-codes';
import type { MobileReadClient } from './mobile-scope';

/** The signed-in login as the phone needs it, and the employee it names. */
export interface MobileLogin {
  userId: string;
  loginName: string;
  /**
   * user_master.usr_employee_id when it names a live employee (emp_is_deleted
   * false), else null. A phone receipt's collector (avh_employee_id).
   */
  employeeId: string | null;
  employeeName: string | null;
}

/** The live login (usr_is_deleted false) and its live employee; null when there is no such login. */
export async function findMobileLogin(
  client: MobileReadClient,
  userId: string,
): Promise<MobileLogin | null> {
  const [row] = await client.$queryRaw<MobileLogin[]>`
    SELECT u.usr_id::text AS "userId", u.usr_login_name AS "loginName",
           e.emp_id::text AS "employeeId", e.emp_name AS "employeeName"
      FROM public.user_master u
      LEFT JOIN public.employee_master e
        ON e.emp_id = u.usr_employee_id AND e.emp_is_deleted = false
     WHERE u.usr_id = ${userId}::uuid
       AND u.usr_is_deleted = false`;
  return row ?? null;
}

/**
 * findMobileLogin for a route that needs the login: a token whose user has
 * since been deleted is refused the way the refresh refuses it (401
 * AUTH_USER_INACTIVE), never answered as nobody.
 */
export async function requireMobileLoginRow(
  client: MobileReadClient,
  userId: string,
): Promise<MobileLogin> {
  const login = await findMobileLogin(client, userId);
  if (!login) {
    throw new UnauthorizedException(
      authErrorBody('This login no longer exists', 'authorization', AuthErrorCode.USER_INACTIVE),
    );
  }
  return login;
}
