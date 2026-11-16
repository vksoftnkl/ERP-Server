import { Prisma } from '@prisma/client';
import { resolveDeviceCode } from '../../stocks/stock-voucher/stock-voucher-numbering.helper';
import { DELIVERY_NOTE_NUMBER_PREFIX } from './core/delivery.constants';

/**
 * Q19 — a Delivery Note is numbered per DEVICE at its first save:
 * `DN/2026-2027/D3/00042`, the Sale Return's shape (sale-return-numbering.ts).
 *
 * Offline-safe: two devices never draw from one series (ux_sdn_device_slno =
 * company, branch, year, device, slno; ux_sdn_refno carries the device code in
 * the refno). MAX + 1 under a transaction-scoped advisory lock keyed by the
 * series, so two saves on one device serialise. A deleted draft leaves a gap.
 * The note posts no accounts voucher, so the per-device number can never meet
 * ux_avh_voucher_no (erp-per-device-numbers-vs-voucher-no).
 */
export async function allocateDeliveryNoteNumber(
  tx: Prisma.TransactionClient,
  q: { companyId: string; branchId: string; accYear: string; deviceId: string },
): Promise<{ lastNo: bigint; refno: string; deviceCode: string }> {
  const devCode = await resolveDeviceCode(tx, q.deviceId);
  const lockKey = [DELIVERY_NOTE_NUMBER_PREFIX, q.companyId, q.branchId, q.accYear, q.deviceId].join(
    '|',
  );
  await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('delivery_note_no'), hashtext(${lockKey})))::int AS locked`;
  const [r] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COALESCE(MAX(sdn_slno), 0) + 1 AS n FROM sales.sale_delivery_note
     WHERE sdn_company_id = ${q.companyId}::uuid AND sdn_branch_id = ${q.branchId}::uuid
       AND sdn_acc_year = ${q.accYear}::char(9) AND sdn_device_id = ${q.deviceId}`;
  const lastNo = BigInt(r?.n ?? 1);
  return {
    lastNo,
    refno: deliveryNoteRefno(q.accYear, devCode, lastNo),
    deviceCode: devCode,
  };
}

/** DN/<year>/<device code>/<00000>. */
export function deliveryNoteRefno(accYear: string, deviceCode: string, slno: bigint | number): string {
  return [
    DELIVERY_NOTE_NUMBER_PREFIX,
    accYear.trim(),
    deviceCode,
    slno.toString().padStart(5, '0'),
  ].join('/');
}
