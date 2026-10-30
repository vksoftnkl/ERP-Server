import { Prisma } from '@prisma/client';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
import { throwStockUnprocessable } from 'src/common/utils/module-service.utils';
import { StockErrorCode } from '../types/stock-error-codes';
import type { SaveStockVoucherItemDto } from './dto/save-stock-voucher-item.dto';
import { effectivePolicyLateral } from './stock-voucher-posting.helper';
import type { StockErrorDetail, StockErrorResponse } from './types/stock-voucher.types';

/**
 * TEXTILE PLAN D1–D3 (2026-10-23) — the batch number a save gives a line.
 *
 * `<branch code><YY>-<NNNNN>`, e.g. `CBE26-00001`: the branch's bill prefix
 * (else its code), the accounting year's first two digits, and a running
 * number drawn from accounts.acc_voucher_seq under the counter-only voucher
 * type `BATCH` (migration 20261023140000). The counter runs per branch per
 * accounting year, and both are in the text, so a number never repeats across
 * branches or years — offline tills included. allocateVoucherNumber holds the
 * advisory lock, so two saves at once never draw the same number.
 *
 * NOT `common/utils/batch-number.util.ts` (MAX + 1): it races, and it cannot
 * be unique offline.
 */
export const AUTO_BATCH_NO_SETTING = 'stock.auto_batch_no';
export const BATCH_VOUCHER_TYPE_CODE = 'BATCH';
/** One counter per branch and year: the device does not split it. */
const BATCH_DEVICE_CODE = 'MAIN';
const BATCH_PREFIX_MISSING_MESSAGE = 'Set a bill prefix on this branch to number batches.';

export interface AutoBatchNoScope {
  companyId: string;
  branchId: string;
  accYear: string;
  /** yyyy-MM-dd — the policy that decides "tracks batch" is the one in force on it. */
  docDate: string;
  /** The document being edited; absent on a create. */
  svhId?: string | null;
}

type AutoBatchLine = Pick<SaveStockVoucherItemDto, 'sviId' | 'itemId' | 'batchNo'>;

/**
 * The lines with every due batch number filled in; the input is not changed.
 *
 * Due: the batch is blank, the item's effective policy tracks batch, and
 * `stock.auto_batch_no` is on. A typed batch is kept as typed (the pharma
 * case), and a line that already holds a number keeps it when an edit sends
 * the batch back blank. Two lines of the same item, MRP and price get two
 * numbers — each line is its own label run.
 *
 * Inside the save's transaction: a save that fails rolls its numbers back
 * with it, and a deleted draft just leaves a gap.
 *
 * `numbered` holds the indexes this call gave a number to (addendum 2: those
 * lines get their size / colour / model row).
 */
export async function assignAutoBatchNumbers<T extends AutoBatchLine>(
  tx: Prisma.TransactionClient,
  scope: AutoBatchNoScope,
  lines: readonly T[],
): Promise<{ lines: T[]; numbered: Set<number> }> {
  const result = [...lines];
  const numbered = new Set<number>();
  const done = () => ({ lines: result, numbered });
  const blank = lines.flatMap((line, index) => (line.batchNo?.trim() ? [] : [index]));
  if (blank.length === 0 || !(await autoBatchNoIsOn(tx, scope.companyId, scope.branchId))) {
    return done();
  }
  const tracked = await batchTrackedItems(tx, scope, [
    ...new Set(blank.map((i) => lines[i].itemId)),
  ]);
  let due = blank.filter((i) => tracked.has(lines[i].itemId));
  if (due.length === 0) {
    return done();
  }
  const stored = await storedBatchNumbers(
    tx,
    scope,
    due.flatMap((i) => lines[i].sviId ?? []),
  );
  for (const i of due) {
    const kept = lines[i].sviId ? stored.get(lines[i].sviId) : undefined;
    if (kept) {
      result[i] = { ...lines[i], batchNo: kept };
    }
  }
  due = due.filter((i) => !stored.has(lines[i].sviId ?? ''));
  if (due.length === 0) {
    return done();
  }
  const prefix = `${await branchBatchCode(tx, scope.branchId)}${scope.accYear.slice(2, 4)}-`;
  const vchrTypeId = await batchVoucherTypeId(tx);
  for (const i of due) {
    const { refno } = await allocateVoucherNumber(tx, {
      vchrTypeId,
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      deviceCode: BATCH_DEVICE_CODE,
    });
    result[i] = { ...lines[i], batchNo: `${prefix}${refno}` };
    numbered.add(i);
  }
  return done();
}

/** Through the resolver, never app_setting_value; no row reads as OFF. */
export async function autoBatchNoIsOn(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId: string,
): Promise<boolean> {
  const [row] = await tx.$queryRaw<{ value: string | null }[]>`
    SELECT out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, ${branchId}::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key = ${AUTO_BATCH_NO_SETTING}`;
  const token = row?.value?.trim().toLowerCase();
  return token !== undefined && ['true', '1', 'yes', 'y', 'on'].includes(token);
}

/** The items whose policy on the document date tracks batch — the post's own resolver. */
async function batchTrackedItems(
  tx: Prisma.TransactionClient,
  scope: AutoBatchNoScope,
  itemIds: string[],
): Promise<Set<string>> {
  const rows = await tx.$queryRaw<{ item_id: string }[]>`
    SELECT itm.item_id
      FROM inventory.item_master itm
      ${effectivePolicyLateral({
        companyId: Prisma.sql`${scope.companyId}::uuid`,
        branchId: Prisma.sql`${scope.branchId}::uuid`,
        itemId: Prisma.raw('itm.item_id'),
        itemGroupId: Prisma.raw('itm.item_group_id'),
        onDate: Prisma.sql`${scope.docDate}::date`,
      })}
     WHERE itm.item_id = ANY(${itemIds}::uuid[])
       AND COALESCE(stp.stp_track_batch, false)`;
  return new Set(rows.map((row) => row.item_id));
}

/** The numbers an edited document's lines already hold, by line id. */
async function storedBatchNumbers(
  tx: Prisma.TransactionClient,
  scope: AutoBatchNoScope,
  sviIds: string[],
): Promise<Map<string, string>> {
  if (!scope.svhId || sviIds.length === 0) {
    return new Map();
  }
  const rows = await tx.$queryRaw<{ svi_id: string; svi_batch_no: string }[]>`
    SELECT svi_id, svi_batch_no
      FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${scope.svhId}::uuid
       AND svi_acc_year   = ${scope.accYear}::bpchar
       AND svi_id = ANY(${sviIds}::uuid[])
       AND svi_is_deleted = false
       AND NULLIF(btrim(svi_batch_no), '') IS NOT NULL`;
  return new Map(rows.map((row) => [row.svi_id, row.svi_batch_no]));
}

/** D1 — the bill prefix, else the code, upper-cased as the lot key folds it. */
async function branchBatchCode(tx: Prisma.TransactionClient, branchId: string): Promise<string> {
  const [row] = await tx.$queryRaw<{ code: string | null }[]>`
    SELECT upper(COALESCE(NULLIF(btrim(br_bill_prefix), ''), NULLIF(btrim(br_code), ''))) AS code
      FROM public.branch_master
     WHERE br_id = ${branchId}::uuid`;
  if (!row?.code) {
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(BATCH_PREFIX_MISSING_MESSAGE, [
      {
        field: 'branchId',
        code: StockErrorCode.BATCH_PREFIX_MISSING,
        message: BATCH_PREFIX_MISSING_MESSAGE,
      },
    ]);
  }
  return row.code;
}

/** accounts.acc_voucher_types by code — the id is a sequence value and differs between databases. */
async function batchVoucherTypeId(tx: Prisma.TransactionClient): Promise<number> {
  const [row] = await tx.$queryRaw<{ vchr_type_id: number }[]>`
    SELECT vchr_type_id FROM accounts.acc_voucher_types
     WHERE vchr_type_code = ${BATCH_VOUCHER_TYPE_CODE} AND vchr_is_active = true LIMIT 1`;
  if (!row) {
    throw new Error(
      `Voucher type '${BATCH_VOUCHER_TYPE_CODE}' is missing — apply the migration that seeds it`,
    );
  }
  return row.vchr_type_id;
}
