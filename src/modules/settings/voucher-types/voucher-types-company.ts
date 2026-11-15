import type { Prisma } from '@prisma/client';
import {
  throwForbidden,
  type ModuleErrorDetail,
} from 'src/common/utils/module-shared.utils';
import { VoucherTypeErrorCode } from './types/voucher-types-error-codes';

type RawClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** 403 VT_COMPANY_MISMATCH — the one refusal of {@link resolveVoucherTypeCompany}. */
export function voucherTypeCompanyMismatch(message: string): never {
  throwForbidden<ModuleErrorDetail>('Voucher type belongs to another company', [
    { field: 'companyId', message, code: VoucherTypeErrorCode.COMPANY_MISMATCH },
  ]);
}

/**
 * Which company a voucher-types call may name (plan decision 66, as the Vehicle
 * Master): a user bound to a company (the login token carries it) may name only
 * that one; a user bound to none (VKPOS) may name any LIVE company. Anything
 * else is 403 VT_COMPANY_MISMATCH. Answers the company id in lower case.
 *
 * Used by /voucher-types/* and by /reports/day-summary/voucher-types?companyId=
 * (review N8), so both lists of a company's child types are guarded alike.
 */
export async function resolveVoucherTypeCompany(
  client: RawClient,
  tokenCompanyId: string | null | undefined,
  bodyCompanyId: string,
): Promise<string> {
  const token = tokenCompanyId?.toLowerCase() || null;
  const body = bodyCompanyId.toLowerCase();
  if (token && token !== body) {
    voucherTypeCompanyMismatch(`companyId ${body} is not the login company ${token}`);
  }
  if (!token) {
    const [c] = await client.$queryRaw<{ comp_id: string }[]>`
      SELECT comp_id FROM public.companys
       WHERE comp_id = ${body}::uuid AND coalesce(comp_is_deleted, false) = false`;
    if (!c) {
      voucherTypeCompanyMismatch(`companyId ${body} is not a live company`);
    }
  }
  return body;
}
