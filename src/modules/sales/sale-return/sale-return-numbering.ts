import { Prisma } from '@prisma/client';
import { resolveDeviceCode } from '../../stocks/stock-voucher/stock-voucher-numbering.helper';

/**
 * Plan v5 D16 / D43 — a sale return is numbered per DEVICE, at its first
 * save: `SRT/2026-2027/D8/00003`. Offline-safe: two devices never draw from
 * one series, so a branch that posts offline and syncs later cannot collide
 * (ux_sr_device_slno = company, branch, year, device, slno; ux_sr_refno keeps
 * the device code in the refno). A deleted draft leaves a gap (D43).
 *
 * The same shape as the purchase documents (purchase-doc.helpers.ts
 * allocateDocNumber): MAX + 1 under a transaction-scoped advisory lock keyed
 * by the series, so two saves on one device serialise. The number is never
 * handed to the voucher as `presetNo` — `ux_avh_voucher_no` has no device in
 * it (erp-per-device-numbers-vs-voucher-no).
 */
export const SALE_RETURN_NUMBER_PREFIX = 'SRT';

export async function allocateSaleReturnNumber(
  tx: Prisma.TransactionClient,
  q: { companyId: string; branchId: string; accYear: string; deviceId: string },
): Promise<{ lastNo: bigint; refno: string }> {
  const devCode = await resolveDeviceCode(tx, q.deviceId);
  const lockKey = [SALE_RETURN_NUMBER_PREFIX, q.companyId, q.branchId, q.accYear, q.deviceId].join(
    '|',
  );
  await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('sale_return_no'), hashtext(${lockKey})))::int AS locked`;
  const [r] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COALESCE(MAX(sr_return_slno), 0) + 1 AS n FROM sales.sale_return
     WHERE sr_company_id = ${q.companyId}::uuid AND sr_branch_id = ${q.branchId}::uuid
       AND sr_acc_year = ${q.accYear}::char(9) AND sr_device_id = ${q.deviceId}`;
  const lastNo = BigInt(r?.n ?? 1);
  return {
    lastNo,
    refno: [
      SALE_RETURN_NUMBER_PREFIX,
      q.accYear.trim(),
      devCode,
      lastNo.toString().padStart(5, '0'),
    ].join('/'),
  };
}
