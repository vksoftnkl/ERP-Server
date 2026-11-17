import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthErrorCode, authErrorBody } from '../../modules/auth/types/auth-error-codes';
import {
  isUniqueConstraintError,
  throwForbidden,
  throwNotFound,
  throwUnprocessable,
  violatedConstraintOf,
  type ModuleErrorDetail,
} from '../../common/utils/module-shared.utils';
import { MobileErrorCode } from './mobile-error-codes';

/** Raw reads only, so a transaction and the PrismaService both serve. */
export type MobileReadClient = Pick<Prisma.TransactionClient, '$queryRaw'>;
/** The advisory lock is a raw read too (count over the void call). */
export type MobileLockClient = MobileReadClient;

/** The registered phone an upload names. */
export interface MobileDevice {
  devId: string;
  devCode: string | null;
  devCompanyId: string | null;
  devBranchId: string | null;
}

interface DeviceRow extends MobileDevice {
  devIsActive: boolean;
  devIsBlocked: boolean;
  devBlockReason: string | null;
}

/** The company the phone works for: active and not deleted, else 404 MOBILE_COMPANY_NOT_FOUND. */
export async function assertMobileCompany(
  client: MobileReadClient,
  companyId: string,
  field = 'companyId',
): Promise<{ compId: string; compGstApplicable: boolean }> {
  const [row] = await client.$queryRaw<{ compId: string; compGstApplicable: boolean }[]>`
    SELECT c.comp_id AS "compId", c.comp_gst_applicable AS "compGstApplicable"
      FROM public.companys c
     WHERE c.comp_id = ${companyId}::uuid
       AND c.comp_is_deleted = false
       AND c.comp_is_active = true`;
  if (!row) {
    throwNotFound<ModuleErrorDetail>(
      'Company not found',
      field,
      `No active company ${companyId}`,
      MobileErrorCode.COMPANY_NOT_FOUND,
    );
  }
  return row;
}

/**
 * The phone, by the uid it registered with (fixed.device_master.dev_device_uid,
 * the id the phone also sends at login). Phones are registered on the Device
 * List screen like any counter (user's call, 2026-11-16): an unknown, blocked
 * or switched-off phone is refused with a 403, since retrying will not help
 * until an admin acts.
 */
export async function resolveMobileDevice(
  client: MobileReadClient,
  deviceUid: string,
  field = 'deviceUid',
): Promise<MobileDevice> {
  const rows = await client.$queryRaw<DeviceRow[]>`
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
    throwForbidden<ModuleErrorDetail>('Phone not registered', [
      {
        field,
        message: `No registered device has the uid ${deviceUid}. Add the phone on the Device List screen.`,
        code: MobileErrorCode.DEVICE_NOT_REGISTERED,
      },
    ]);
  }
  if (device.devIsBlocked) {
    throwForbidden<ModuleErrorDetail>('Phone blocked', [
      {
        field,
        message: device.devBlockReason
          ? `This phone is blocked: ${device.devBlockReason}`
          : 'This phone is blocked.',
        code: MobileErrorCode.DEVICE_BLOCKED,
      },
    ]);
  }
  if (!device.devIsActive) {
    throwForbidden<ModuleErrorDetail>('Phone switched off', [
      {
        field,
        message: 'This phone is registered but not active.',
        code: MobileErrorCode.DEVICE_INACTIVE,
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

/**
 * The branch a phone document of `companyId` is saved in:
 *  1. the phone's own branch, when it belongs to that company;
 *  2. else the company's default branch (br_is_default);
 *  3. else the company's only active branch;
 *  4. else null (several branches and no default, or none).
 * A salesman may take orders for several companies (users post cross-company
 * here), so a phone registered to one company still saves for another, in
 * that company's default branch.
 */
export async function findMobileBranch(
  client: MobileReadClient,
  companyId: string,
  preferredBranchId: string | null,
): Promise<string | null> {
  const rows = await client.$queryRaw<{ brId: string; preferred: boolean; isDefault: boolean }[]>`
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

/** findMobileBranch, refusing (422 MOBILE_BRANCH_NOT_RESOLVED) when there is none. */
export async function requireMobileBranch(
  client: MobileReadClient,
  companyId: string,
  preferredBranchId: string | null,
): Promise<string> {
  const branchId = await findMobileBranch(client, companyId, preferredBranchId);
  if (!branchId) {
    throwUnprocessable<ModuleErrorDetail>('No branch to save in', [
      {
        field: 'deviceUid',
        message:
          "The phone's branch is not one of this company's, and the company has no default " +
          "branch to fall back on. Set the phone's branch on the Device List screen, or mark " +
          "one of the company's branches as default.",
        code: MobileErrorCode.BRANCH_NOT_RESOLVED,
      },
    ]);
  }
  return branchId;
}

/** The database's today (IST, the session time zone) as YYYY-MM-DD. */
export async function databaseToday(client: MobileReadClient): Promise<string> {
  const [row] = await client.$queryRaw<{ today: string }[]>`SELECT CURRENT_DATE::text AS today`;
  return row.today;
}

/**
 * The company's financial year holding `onDate` (YYYY-MM-DD, bound as a DATE
 * so no time zone shifts it), as the 9-character acc year ('2026-2027'). None
 * = 422 MOBILE_NO_FISCAL_YEAR on `field`.
 */
export async function requireMobileAccYear(
  client: MobileReadClient,
  companyId: string,
  onDate: string,
  field: string,
): Promise<string> {
  const [fy] = await client.$queryRaw<{ name: string }[]>`
    SELECT btrim(f.fy_year_name) AS name
      FROM public.fiscal_years f
     WHERE f.comp_id = ${companyId}::uuid
       AND f.is_deleted = false
       AND ${onDate}::date BETWEEN f.fy_begin_date AND f.fy_end_date
     ORDER BY f.fy_begin_date DESC
     LIMIT 1`;
  if (!fy) {
    throwUnprocessable<ModuleErrorDetail>('No financial year', [
      {
        field,
        message: `No financial year of company ${companyId} holds ${onDate}.`,
        code: MobileErrorCode.NO_FISCAL_YEAR,
      },
    ]);
  }
  return fy.name;
}

/** The phone documents that carry a client uuid, each its own lock space. */
export type MobileUploadKind = 'order' | 'visit' | 'bill' | 'receipt';

/**
 * Serialises every upload of one (kind, company, client uuid) for the rest of
 * the caller's transaction, so two copies of one resend cannot both miss the
 * duplicate check and both write. count() over the void lock call, as
 * lockDeviceCodes does: $queryRaw cannot read a void column back.
 */
export async function lockMobileClientUuid(
  client: MobileLockClient,
  kind: MobileUploadKind,
  companyId: string,
  clientUuid: string,
): Promise<void> {
  const key = `mobile-${kind}:${companyId}:${clientUuid.toLowerCase()}`;
  await client.$queryRaw<{ locked: number }[]>`
    SELECT count(pg_advisory_xact_lock(hashtextextended(${key}, 0)))::int AS locked`;
}

/**
 * The unique-violation backstop of an upload: a clash on the client-uuid index
 * (ux_sb_client_uuid / ux_avh_client_uuid, reported under the PARTITION's index
 * name, e.g. sale_bill_2026_2027_sb_company_id_sb_client_uuid_sb_acc_yea_idx,
 * or as its columns by a raw write's 23505), or one that names nothing. Any
 * other unique index (a document number, a cheque number) is not a resend and
 * keeps its own answer.
 */
export function isClientUuidClash(error: unknown): boolean {
  if (!isUniqueConstraintError(error)) {
    return false;
  }
  const violated = violatedConstraintOf(error);
  return violated === null || violated.includes('client_uuid');
}

/**
 * The login of an upload that posts (bills, receipts): the AccessTokenGuard
 * already refused a call without a token, so a null here means the route lost
 * its guard. Refused the way the guard refuses, never posted as nobody.
 */
export function requireMobileLogin(userId: string | null | undefined): string {
  if (!userId) {
    throw new UnauthorizedException(
      authErrorBody('Log in to upload this', 'authorization', AuthErrorCode.AUTHORIZATION_MISSING),
    );
  }
  return userId;
}
