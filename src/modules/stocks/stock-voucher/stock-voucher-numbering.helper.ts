import { Prisma } from '@prisma/client';
import { throwStockNotFound } from 'src/common/utils/module-service.utils';
import type { StockErrorDetail, StockErrorResponse, StockVoucherType } from './types/stock-voucher.types';
/**
 * NUMBERING IS SELF-CONTAINED, AND DELIBERATELY SO.
 *
 * It does NOT use SequenceService / accounts.acc_voucher_seq, and it does NOT
 * create an accounts.acc_voucher_header row. That table is keyed by
 * seq_vchr_type_id, a foreign key into accounts.acc_voucher_type — and a stock
 * voucher type is not an accounting voucher type. Inventing rows in the
 * accounting voucher-type master to satisfy that foreign key is exactly how the
 * two masters start disagreeing about what documents exist.
 *
 * A stock voucher moves quantity and cost. It posts no debit and no credit, and
 * stock_voucher has no column pointing at an accounting document.
 *
 * THE DEVICE IS THE COUNTER. svh_slno is unique per
 * (company, branch, acc_year, voucher_type, DEVICE) — ux_svh_slno — because a
 * warehouse tablet must be able to number its own document while offline and
 * sync it later. That is also why a client-supplied slno/refno is ACCEPTED
 * rather than overwritten: the device's copy is already printed.
 */
/** Namespace half of the advisory lock key. */
const SLNO_LOCK_NAMESPACE = 'stock.stock_voucher.slno';
/** svh_refno is varchar(100). */
const REFNO_MAX_LENGTH = 100;
export interface StockVoucherNumberScope {
  companyId: string;
  branchId: string;
  accYear: string;
  voucherType: StockVoucherType;
  deviceId: string;
}
export interface AllocatedStockVoucherNumber {
  slno: bigint;
  refno: string;
}
/**
 * Reads the device's printable code. `device_master` has no `dev_code`: the
 * uid is what the tills are labelled with (`TILL-01`), and the name is the
 * fallback for a device registered without one.
 *
 * Also the point at which a blocked or deleted device is refused. svh_device_id
 * is NOT NULL and the FK is RESTRICT, so a bad id would otherwise surface as a
 * foreign-key violation with no indication of which of the six uuids on the
 * header was wrong.
 */
export async function resolveDeviceCode(
  tx: Prisma.TransactionClient,
  deviceId: string,
): Promise<string> {
  const device = await tx.deviceMaster.findFirst({
    where: { devId: deviceId, devIsDeleted: false },
    select: {
      devDeviceUid: true,
      devDeviceName: true,
      devIsActive: true,
      devIsBlocked: true,
      devBlockReason: true,
    },
  });
  if (!device) {
    throwStockNotFound<StockErrorDetail, StockErrorResponse>(
      'Device not found',
      'deviceId',
      `No device master row ${deviceId}. svh_device_id is NOT NULL and the device is the number series — register the device before raising documents on it.`,
    );
  }
  if (device.devIsBlocked || !device.devIsActive) {
    throwStockNotFound<StockErrorDetail, StockErrorResponse>(
      'Device unavailable',
      'deviceId',
      device.devBlockReason?.trim()
        ? `Device ${deviceId} is blocked: ${device.devBlockReason.trim()}`
        : `Device ${deviceId} is blocked or inactive.`,
    );
  }
  const code = device.devDeviceUid?.trim() || device.devDeviceName?.trim();
  return code || deviceId;
}
/**
 * Takes the transaction-scoped advisory lock that serialises two devices — or
 * two tabs on one device — racing for the same next serial.
 *
 * pg_advisory_xact_lock, never pg_advisory_lock: it is released when the
 * caller's transaction ends, whether that is a commit or a rollback, so a
 * failed save cannot leave the counter wedged.
 */
async function lockSlnoScope(
  tx: Prisma.TransactionClient,
  scope: StockVoucherNumberScope,
): Promise<void> {
  const lockKey = [
    scope.companyId,
    scope.branchId,
    scope.accYear,
    scope.voucherType,
    scope.deviceId,
  ].join('|');
  await tx.$queryRaw<Array<{ locked: number }>>`
    WITH advisory_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtext(${SLNO_LOCK_NAMESPACE}),
        hashtext(${lockKey})
      )
    )
    SELECT 1::int AS locked
  `;
}
/**
 * MAX(svh_slno) + 1 within the ux_svh_slno scope, under the lock above.
 *
 * MAX rather than a counter table because ux_svh_slno already is the counter:
 * a device that numbered 1..40 offline and syncs them later leaves MAX at 40,
 * and the next server-side allocation continues from 41 without anybody
 * reconciling anything. A separate counter row would have to be taught about
 * every one of those forty inserts.
 */
export async function nextStockVoucherSlno(
  tx: Prisma.TransactionClient,
  scope: StockVoucherNumberScope,
): Promise<bigint> {
  await lockSlnoScope(tx, scope);
  const rows = await tx.$queryRaw<Array<{ next_slno: bigint }>>`
    SELECT COALESCE(MAX(svh_slno), 0) + 1 AS next_slno
    FROM stock.stock_voucher
    WHERE svh_company_id  = ${scope.companyId}::uuid
      AND svh_branch_id   = ${scope.branchId}::uuid
      AND svh_acc_year    = ${scope.accYear}::bpchar
      AND svh_voucher_type = ${scope.voucherType}
      AND svh_device_id   = ${scope.deviceId}::uuid
  `;
  return rows[0]?.next_slno ?? BigInt(1);
}
/**
 * `{typeCode}/{accYear}/{deviceCode}/{slno}` — `OPN/2026-2027/TILL-01/1`.
 *
 * The device code is in the printed number on purpose: svh_refno is unique per
 * (company, branch, acc_year) on its own — ux_svh_refno — while the serial is
 * per device, so without the device segment two tills that both reached 41
 * would collide on the refno while their serials were perfectly legal.
 */
export function buildStockVoucherRefno(
  typeCode: string,
  accYear: string,
  deviceCode: string,
  slno: bigint,
): string {
  const refno = [typeCode, accYear.trim(), deviceCode, slno.toString()].join('/');
  if (refno.length > REFNO_MAX_LENGTH) {
    // Truncating would produce a number that has already been issued to some
    // other device, so this fails loudly instead.
    throw new Error(
      `Generated stock voucher reference "${refno}" exceeds ${REFNO_MAX_LENGTH} characters. Shorten the device code on device_master.`,
    );
  }
  return refno;
}
/**
 * Allocates the pair, honouring anything the client already decided.
 *
 * A device that numbered its document offline sends both, and both are used
 * verbatim — a collision then surfaces as 23505 on ux_svh_slno / ux_svh_refno
 * and is answered with a 409 naming the refno. It is NOT "fixed" by silently
 * renumbering: the device's copy of that document is already printed, and a
 * server that quietly hands it a different number has created a second
 * document rather than accepted the one it was sent.
 *
 * A client that sends only one of the two gets the other generated around it,
 * which is what a screen that lets a user type their own reference does.
 */
export async function allocateStockVoucherNumber(
  tx: Prisma.TransactionClient,
  scope: StockVoucherNumberScope,
  typeCode: string,
  supplied: { slno?: string | number | bigint | null; refno?: string | null } = {},
): Promise<AllocatedStockVoucherNumber> {
  const suppliedRefno = supplied.refno?.trim() || null;
  const suppliedSlno =
    supplied.slno === undefined || supplied.slno === null || supplied.slno === ''
      ? null
      : BigInt(supplied.slno);
  if (suppliedSlno !== null && suppliedRefno !== null) {
    return { slno: suppliedSlno, refno: suppliedRefno };
  }
  const slno = suppliedSlno ?? (await nextStockVoucherSlno(tx, scope));
  if (suppliedRefno !== null) {
    return { slno, refno: suppliedRefno };
  }
  const deviceCode = await resolveDeviceCode(tx, scope.deviceId);
  return { slno, refno: buildStockVoucherRefno(typeCode, scope.accYear, deviceCode, slno) };
}