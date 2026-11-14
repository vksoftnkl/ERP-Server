import type { Prisma } from '@prisma/client';

/**
 * The code a branch prints in its numbers (branch serial plan §5.5,
 * Shared/Prathap/purchase/plan-branch-serial-numbering.md, approved 2026-11-04):
 * the Bill Prefix, else the branch code, trimmed and upper-cased in SQL as the
 * lot key folds it. ONE rule for both of its users:
 *   - batch numbers, `<code><YY>-<NNNNN>` (stock-voucher-batch-numbering.helper.ts, textile D1);
 *   - the `{BR}` token of a voucher-type prefix / suffix (voucher-sequence.helper.ts).
 *
 * Null when both are blank. The shape check is the caller's: `{BR}` must match
 * BRANCH_NUMBER_CODE_PATTERN, while batch numbers take the code as it is.
 */
export const BRANCH_NUMBER_CODE_PATTERN = /^[A-Z0-9-]{1,10}$/;

export async function branchNumberCode(
  tx: Prisma.TransactionClient,
  branchId: string,
): Promise<string | null> {
  const [row] = await tx.$queryRaw<{ code: string | null }[]>`
    SELECT upper(COALESCE(NULLIF(btrim(br_bill_prefix), ''), NULLIF(btrim(br_code), ''))) AS code
      FROM public.branch_master
     WHERE br_id = ${branchId}::uuid`;
  return row?.code || null;
}
