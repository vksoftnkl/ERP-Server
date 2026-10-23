import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { throwStockUnprocessable } from 'src/common/utils/module-service.utils';
import { StockErrorCode } from '../types/stock-error-codes';
import type {
  StockErrorDetail,
  StockErrorResponse,
} from '../stock-voucher/types/stock-voucher.types';

/**
 * TEXTILE AUTO BATCH, ADDENDUM 2 E2 — a batch's size, colour and model,
 * `stock.stock_batch_detail`, keyed by (company, batch no).
 *
 * The key is the batch number, not the lot: an auto batch number is unique in
 * the company by construction (plan D1), a Re-lot keeps it, and a draft holds
 * it before any lot exists. Nothing is added to stock_lot, stock_voucher_item
 * or sale_bill_item; a reader joins on the folded batch.
 */

/** Namespace of `sbd_id` — uuid v5, like the lot's (STOCK_LOT_ID_NAMESPACE), never reused. */
export const BATCH_DETAIL_ID_NAMESPACE = '8c3d5e21-7a4f-4b90-9e16-2f5a0d7c4b38';

/** The batch as the lot key folds it: trimmed, upper-cased. */
export function foldBatchNo(batchNo: string): string {
  return batchNo.trim().toUpperCase();
}

/**
 * `sbd_id` = uuid v5 over `company|BATCH` — the same id on every install that
 * writes the batch, so an offline branch and the cloud never mint two rows.
 */
export function batchDetailId(companyId: string, batchNo: string): string {
  const hash = createHash('sha1')
    .update(Buffer.from(BATCH_DETAIL_ID_NAMESPACE.replace(/-/g, ''), 'hex'))
    .update(`${companyId.toLowerCase()}|${foldBatchNo(batchNo)}`, 'utf8')
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A payload line, as the inward save hands it over. */
export interface BatchDetailLine {
  lineNo: number;
  splitNo?: number;
  sizeId?: string | null;
  colourId?: string | null;
  model?: string | null;
}

export interface BatchDetailSource {
  companyId: string;
  accYear: string;
  /** The stock voucher type: OPENING now, PURCHASE later. */
  srcDocType: string;
  srcDocId: string;
  actor: string | null;
}

/**
 * E2's write rule, inside the save's transaction, after its lines are written.
 *
 * A line that HAS an auto batch — numbered by this save, or already owning a
 * detail row under the batch it still carries — gets its row written (or
 * revived) with the size, colour and model it sent. Rows of this document
 * whose line is gone, or whose line now carries a typed batch, are
 * soft-deleted. Size, colour or model on a line without an auto batch is
 * refused: the row is keyed by a batch number only the server makes unique.
 *
 * `numbered` holds the indexes of `lines` that assignAutoBatchNumbers numbered.
 */
export async function syncBatchDetails(
  tx: Prisma.TransactionClient,
  source: BatchDetailSource,
  lines: readonly BatchDetailLine[],
  numbered: ReadonlySet<number>,
): Promise<void> {
  const stored = await tx.$queryRaw<
    {
      svi_id: string;
      svi_line_no: number;
      svi_split_no: number;
      svi_item_id: string;
      svi_batch_no: string | null;
    }[]
  >`
    SELECT svi_id, svi_line_no, svi_split_no, svi_item_id, svi_batch_no
      FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${source.srcDocId}::uuid
       AND svi_acc_year   = ${source.accYear}::bpchar
       AND svi_is_deleted = false`;
  const storedByKey = new Map(stored.map((row) => [`${row.svi_line_no}|${row.svi_split_no}`, row]));
  const owned = await tx.$queryRaw<{ sbd_src_line_id: string; sbd_batch_no: string }[]>`
    SELECT sbd_src_line_id, sbd_batch_no
      FROM stock.stock_batch_detail
     WHERE sbd_src_doc_id = ${source.srcDocId}::uuid AND sbd_is_deleted = false`;
  const ownedBatchByLine = new Map(owned.map((row) => [row.sbd_src_line_id, row.sbd_batch_no]));

  const errors: StockErrorDetail[] = [];
  const rows: {
    sviId: string;
    itemId: string;
    batchNo: string;
    line: BatchDetailLine;
    model: string | null;
  }[] = [];
  lines.forEach((line, index) => {
    const row = storedByKey.get(`${line.lineNo}|${line.splitNo ?? 1}`);
    if (!row) return;
    const batchNo = row.svi_batch_no?.trim() ? foldBatchNo(row.svi_batch_no) : null;
    const model = line.model?.trim() || null;
    const auto =
      batchNo !== null && (numbered.has(index) || ownedBatchByLine.get(row.svi_id) === batchNo);
    if (auto) {
      rows.push({ sviId: row.svi_id, itemId: row.svi_item_id, batchNo, line, model });
    } else if (line.sizeId || line.colourId || model) {
      errors.push({
        field: `lines.${index}`,
        code: StockErrorCode.BATCH_DETAIL_NEEDS_AUTO_BATCH,
        message: `Line ${line.lineNo}: size, colour and model are kept for a batch number the server gave. Leave the batch blank to have one given.`,
      });
    }
  });
  errors.push(
    ...(await unknownSizesAndColours(
      tx,
      source.companyId,
      rows.map((r) => r.line),
    )),
  );
  if (errors.length > 0) {
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      'Size, colour or model cannot be kept',
      errors,
    );
  }

  const keptIds = rows.map((r) => batchDetailId(source.companyId, r.batchNo));
  if (rows.length > 0) {
    await tx.$executeRaw`
      INSERT INTO stock.stock_batch_detail AS d
             (sbd_id, sbd_company_id, sbd_batch_no, sbd_item_id, sbd_size_id, sbd_colour_id, sbd_model,
              sbd_src_doc_type, sbd_src_doc_id, sbd_src_line_id, sbd_created_by)
      VALUES ${Prisma.join(
        rows.map(
          (r, i) => Prisma.sql`(
            ${keptIds[i]}::uuid, ${source.companyId}::uuid, ${r.batchNo}, ${r.itemId}::uuid,
            ${r.line.sizeId ?? null}::uuid, ${r.line.colourId ?? null}::uuid, ${r.model},
            ${source.srcDocType}, ${source.srcDocId}::uuid, ${r.sviId}::uuid, ${source.actor})`,
        ),
      )}
      ON CONFLICT (sbd_id) DO UPDATE
         SET sbd_item_id      = EXCLUDED.sbd_item_id,
             sbd_size_id      = EXCLUDED.sbd_size_id,
             sbd_colour_id    = EXCLUDED.sbd_colour_id,
             sbd_model        = EXCLUDED.sbd_model,
             sbd_src_doc_type = EXCLUDED.sbd_src_doc_type,
             sbd_src_doc_id   = EXCLUDED.sbd_src_doc_id,
             sbd_src_line_id  = EXCLUDED.sbd_src_line_id,
             sbd_is_deleted   = false,
             sbd_modified_on  = now(),
             sbd_modified_by  = EXCLUDED.sbd_created_by
       -- An unchanged row is not rewritten: no stamp, no sync traffic.
       WHERE d.sbd_is_deleted
          OR (d.sbd_item_id, d.sbd_size_id, d.sbd_colour_id, d.sbd_model, d.sbd_src_line_id)
             IS DISTINCT FROM
             (EXCLUDED.sbd_item_id, EXCLUDED.sbd_size_id, EXCLUDED.sbd_colour_id,
              EXCLUDED.sbd_model, EXCLUDED.sbd_src_line_id)`;
  }
  await tx.$executeRaw`
    UPDATE stock.stock_batch_detail
       SET sbd_is_deleted = true, sbd_modified_on = now(), sbd_modified_by = ${source.actor}
     WHERE sbd_src_doc_id = ${source.srcDocId}::uuid
       AND sbd_is_deleted = false
       AND sbd_id <> ALL(${keptIds}::uuid[])`;
}

/** A deleted draft takes its batch details with it. */
export async function softDeleteBatchDetailsOf(
  tx: Prisma.TransactionClient,
  srcDocId: string,
  actor: string | null,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE stock.stock_batch_detail
       SET sbd_is_deleted = true, sbd_modified_on = now(), sbd_modified_by = ${actor}
     WHERE sbd_src_doc_id = ${srcDocId}::uuid AND sbd_is_deleted = false`;
}

/**
 * Sizes and colours a line names that are not live rows of this company or
 * shared ones. Inactive rows pass: a line saved with a size later deactivated
 * must stay editable.
 */
export async function unknownSizesAndColours(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  companyId: string,
  lines: readonly Pick<BatchDetailLine, 'sizeId' | 'colourId'>[],
  fieldOf: (index: number, column: 'sizeId' | 'colourId') => string = (index, column) =>
    `lines.${index}.${column}`,
): Promise<StockErrorDetail[]> {
  const sizeIds = [...new Set(lines.flatMap((l) => (l.sizeId ? [l.sizeId] : [])))];
  const colourIds = [...new Set(lines.flatMap((l) => (l.colourId ? [l.colourId] : [])))];
  if (sizeIds.length === 0 && colourIds.length === 0) return [];
  const live = await client.$queryRaw<{ id: string }[]>`
    SELECT isz_id::text AS id FROM inventory.item_size_master
     WHERE isz_id = ANY(${sizeIds}::uuid[]) AND isz_is_deleted = false
       AND (isz_company_id IS NULL OR isz_company_id = ${companyId}::uuid)
    UNION ALL
    SELECT icl_id::text FROM inventory.item_colour_master
     WHERE icl_id = ANY(${colourIds}::uuid[]) AND icl_is_deleted = false
       AND (icl_company_id IS NULL OR icl_company_id = ${companyId}::uuid)`;
  const known = new Set(live.map((row) => row.id));
  const errors: StockErrorDetail[] = [];
  lines.forEach((line, index) => {
    if (line.sizeId && !known.has(line.sizeId)) {
      errors.push({
        field: fieldOf(index, 'sizeId'),
        code: StockErrorCode.BATCH_SIZE_NOT_FOUND,
        message: `No live size ${line.sizeId} in this company.`,
      });
    }
    if (line.colourId && !known.has(line.colourId)) {
      errors.push({
        field: fieldOf(index, 'colourId'),
        code: StockErrorCode.BATCH_COLOUR_NOT_FOUND,
        message: `No live colour ${line.colourId} in this company.`,
      });
    }
  });
  return errors;
}

/** What a sale line, a print row or the scan shows of a batch. */
export interface BatchDetailView {
  sizeId: string | null;
  sizeName: string | null;
  colourId: string | null;
  colourName: string | null;
  model: string | null;
}

/**
 * E3.3 — the details of the batches some lines carry, keyed `item|BATCH`
 * (folded). The item is matched too, so a typed batch that happens to equal
 * another item's auto number shows nothing rather than the wrong shirt.
 */
export async function batchDetailsFor(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  companyId: string,
  lines: readonly { itemId: string | null | undefined; batchNo: string | null | undefined }[],
): Promise<Map<string, BatchDetailView>> {
  const batchNos = [
    ...new Set(
      lines.flatMap((l) => (l.itemId && l.batchNo?.trim() ? [foldBatchNo(l.batchNo)] : [])),
    ),
  ];
  if (batchNos.length === 0) return new Map();
  const rows = await client.$queryRaw<(BatchDetailView & { itemId: string; batchNo: string })[]>`
    SELECT sbd.sbd_item_id::text   AS "itemId",
           sbd.sbd_batch_no        AS "batchNo",
           sbd.sbd_size_id::text   AS "sizeId",
           isz.isz_name            AS "sizeName",
           sbd.sbd_colour_id::text AS "colourId",
           icl.icl_name            AS "colourName",
           sbd.sbd_model           AS model
      FROM stock.stock_batch_detail sbd
      LEFT JOIN inventory.item_size_master   isz ON isz.isz_id = sbd.sbd_size_id
      LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
     WHERE sbd.sbd_company_id = ${companyId}::uuid
       AND sbd.sbd_batch_no = ANY(${batchNos}::text[])
       AND sbd.sbd_is_deleted = false`;
  return new Map(
    rows.map(({ itemId, batchNo, ...view }) => [batchDetailKey(itemId, batchNo), view]),
  );
}

export function batchDetailKey(itemId: string, batchNo: string): string {
  return `${itemId}|${foldBatchNo(batchNo)}`;
}

/**
 * E3.3 for a sales document's plain line rows (`sdi*`, `sri*`, `sdri*`):
 * each gets `<p>SizeName`, `<p>ColourName` and `<p>Model`, null when its batch
 * has no detail. Read-only: nothing is stored on the sale line.
 */
export async function withBatchDetails<T extends Record<string, unknown>>(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  companyId: string,
  prefix: string,
  rows: readonly T[],
): Promise<(T & Record<string, string | null>)[]> {
  const lineOf = (row: T) => ({
    itemId: row[`${prefix}ItemId`] as string | null,
    batchNo: row[`${prefix}BatchNo`] as string | null,
  });
  const details = await batchDetailsFor(client, companyId, rows.map(lineOf));
  return rows.map((row) => {
    const { itemId, batchNo } = lineOf(row);
    const view = itemId && batchNo ? details.get(batchDetailKey(itemId, batchNo)) : undefined;
    return {
      ...row,
      [`${prefix}SizeName`]: view?.sizeName ?? null,
      [`${prefix}ColourName`]: view?.colourName ?? null,
      [`${prefix}Model`]: view?.model ?? null,
    };
  });
}
