import { Prisma } from '@prisma/client';

/**
 * Notes 160 C — a device's short code, the segment stock voucher numbers carry:
 * `TRF/2026-2027/D1/00016`, never the machine id.
 *
 * ONE SERIES ACROSS EVERY DEVICE, not one per branch. ux_svh_refno is unique per
 * (year, company, branch) of the DOCUMENT, and a device posts wherever it is
 * used — the office PC on .106 has no branch and posts in three — so two
 * devices with the same code would print the same number in one branch and
 * the second save would 409. Unique across the table is also unique per
 * branch.
 *
 * NEVER REUSED. ux_dev_code covers deleted rows too, and the next code counts
 * past them: a new device given an old one's code would print the old one's
 * numbers again.
 *
 * Every assignment and every edit takes one transaction-scoped advisory lock,
 * so two registrations cannot both draw the same next code.
 */
export const DEVICE_CODE_MAX_LENGTH = 10;
/** What a keyed code may hold: it sits between two `/` of a voucher number. */
export const DEVICE_CODE_PATTERN = /^[A-Z0-9_-]{1,10}$/;
const DEVICE_CODE_LOCK = 'fixed.device_master.dev_code';

type CodeClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

/** Trimmed and upper-cased; blank is null (= "assign one"). */
export function normalizeDeviceCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

/** Serialises code assignment and edits for the rest of the caller's transaction. */
export async function lockDeviceCodes(tx: CodeClient): Promise<void> {
  // count() over the void lock call, as lockSlnoScope does: $queryRaw cannot
  // read a void column back, and a CTE nobody references never runs.
  await tx.$queryRaw<Array<{ locked: number }>>`
    SELECT count(pg_advisory_xact_lock(hashtext(${DEVICE_CODE_LOCK})))::int AS locked
  `;
}

/** One past the highest `D<n>` ever given, deleted devices included. Call under the lock. */
export async function nextDeviceCode(tx: CodeClient): Promise<string> {
  const [row] = await tx.$queryRaw<Array<{ n: number }>>`
    SELECT (COALESCE(MAX(substring(upper(dev_code) FROM '^D([0-9]{1,8})$')::int), 0) + 1)::int AS n
      FROM fixed.device_master
  `;
  return `D${row?.n ?? 1}`;
}

/** Whether another device — live or deleted — already holds the code, any case. */
export async function deviceCodeTaken(
  tx: CodeClient,
  code: string,
  excludeDevId?: string,
): Promise<boolean> {
  const [row] = await tx.$queryRaw<Array<{ taken: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM fixed.device_master
       WHERE upper(dev_code) = upper(${code})
         AND (${excludeDevId ?? null}::uuid IS NULL OR dev_id <> ${excludeDevId ?? null}::uuid)
    ) AS taken
  `;
  return row?.taken === true;
}

/**
 * The device's code, giving it the next one first when it has none — a device
 * registered before notes 160, or inserted by something other than the device
 * master. Returns null only when the device row does not exist.
 */
export async function ensureDeviceCode(tx: CodeClient, devId: string): Promise<string | null> {
  await lockDeviceCodes(tx);
  const [device] = await tx.$queryRaw<Array<{ dev_code: string | null }>>`
    SELECT dev_code FROM fixed.device_master WHERE dev_id = ${devId}::uuid FOR UPDATE
  `;
  if (!device) {
    return null;
  }
  if (device.dev_code) {
    return device.dev_code;
  }
  const code = await nextDeviceCode(tx);
  await tx.$executeRaw`
    UPDATE fixed.device_master SET dev_code = ${code} WHERE dev_id = ${devId}::uuid
  `;
  return code;
}
