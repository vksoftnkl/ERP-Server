"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BATCH_DETAIL_ID_NAMESPACE = void 0;
exports.foldBatchNo = foldBatchNo;
exports.batchDetailId = batchDetailId;
exports.syncBatchDetails = syncBatchDetails;
exports.softDeleteBatchDetailsOf = softDeleteBatchDetailsOf;
exports.unknownSizesAndColours = unknownSizesAndColours;
exports.batchDetailsFor = batchDetailsFor;
exports.batchDetailKey = batchDetailKey;
exports.withBatchDetails = withBatchDetails;
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_error_codes_1 = require("../types/stock-error-codes");
exports.BATCH_DETAIL_ID_NAMESPACE = '8c3d5e21-7a4f-4b90-9e16-2f5a0d7c4b38';
function foldBatchNo(batchNo) {
    return batchNo.trim().toUpperCase();
}
function batchDetailId(companyId, batchNo) {
    const hash = (0, node_crypto_1.createHash)('sha1')
        .update(Buffer.from(exports.BATCH_DETAIL_ID_NAMESPACE.replace(/-/g, ''), 'hex'))
        .update(`${companyId.toLowerCase()}|${foldBatchNo(batchNo)}`, 'utf8')
        .digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function syncBatchDetails(tx, source, lines, numbered) {
    const stored = await tx.$queryRaw `
    SELECT svi_id, svi_line_no, svi_split_no, svi_item_id, svi_batch_no
      FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${source.srcDocId}::uuid
       AND svi_acc_year   = ${source.accYear}::bpchar
       AND svi_is_deleted = false`;
    const storedByKey = new Map(stored.map((row) => [`${row.svi_line_no}|${row.svi_split_no}`, row]));
    const owned = await tx.$queryRaw `
    SELECT sbd_batch_no
      FROM stock.stock_batch_detail
     WHERE sbd_src_doc_id = ${source.srcDocId}::uuid`;
    const ownedBatches = new Set(owned.map((row) => row.sbd_batch_no));
    const errors = [];
    const rows = [];
    lines.forEach((line, index) => {
        const row = storedByKey.get(`${line.lineNo}|${line.splitNo ?? 1}`);
        if (!row)
            return;
        const batchNo = row.svi_batch_no?.trim() ? foldBatchNo(row.svi_batch_no) : null;
        const model = line.model?.trim() || null;
        const auto = batchNo !== null && (numbered.has(index) || ownedBatches.has(batchNo));
        if (auto) {
            rows.push({ sviId: row.svi_id, itemId: row.svi_item_id, batchNo, line, model });
        }
        else if (line.sizeId || line.colourId || model) {
            errors.push({
                field: `lines.${index}`,
                code: stock_error_codes_1.StockErrorCode.BATCH_DETAIL_NEEDS_AUTO_BATCH,
                message: `Line ${line.lineNo}: size, colour and model are kept for a batch number the server gave. Leave the batch blank to have one given.`,
            });
        }
    });
    errors.push(...(await unknownSizesAndColours(tx, source.companyId, rows.map((r) => r.line))));
    if (errors.length > 0) {
        (0, module_service_utils_1.throwStockUnprocessable)('Size, colour or model cannot be kept', errors);
    }
    const keptIds = rows.map((r) => batchDetailId(source.companyId, r.batchNo));
    if (rows.length > 0) {
        await tx.$executeRaw `
      INSERT INTO stock.stock_batch_detail AS d
             (sbd_id, sbd_company_id, sbd_batch_no, sbd_item_id, sbd_size_id, sbd_colour_id, sbd_model,
              sbd_src_doc_type, sbd_src_doc_id, sbd_src_line_id, sbd_created_by)
      VALUES ${client_1.Prisma.join(rows.map((r, i) => client_1.Prisma.sql `(
            ${keptIds[i]}::uuid, ${source.companyId}::uuid, ${r.batchNo}, ${r.itemId}::uuid,
            ${r.line.sizeId ?? null}::uuid, ${r.line.colourId ?? null}::uuid, ${r.model},
            ${source.srcDocType}, ${source.srcDocId}::uuid, ${r.sviId}::uuid, ${source.actor})`))}
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
    await tx.$executeRaw `
    UPDATE stock.stock_batch_detail
       SET sbd_is_deleted = true, sbd_modified_on = now(), sbd_modified_by = ${source.actor}
     WHERE sbd_src_doc_id = ${source.srcDocId}::uuid
       AND sbd_is_deleted = false
       AND sbd_id <> ALL(${keptIds}::uuid[])`;
}
async function softDeleteBatchDetailsOf(tx, srcDocId, actor) {
    await tx.$executeRaw `
    UPDATE stock.stock_batch_detail
       SET sbd_is_deleted = true, sbd_modified_on = now(), sbd_modified_by = ${actor}
     WHERE sbd_src_doc_id = ${srcDocId}::uuid AND sbd_is_deleted = false`;
}
async function unknownSizesAndColours(client, companyId, lines, fieldOf = (index, column) => `lines.${index}.${column}`) {
    const sizeIds = [...new Set(lines.flatMap((l) => (l.sizeId ? [l.sizeId] : [])))];
    const colourIds = [...new Set(lines.flatMap((l) => (l.colourId ? [l.colourId] : [])))];
    if (sizeIds.length === 0 && colourIds.length === 0)
        return [];
    const live = await client.$queryRaw `
    SELECT isz_id::text AS id FROM inventory.item_size_master
     WHERE isz_id = ANY(${sizeIds}::uuid[]) AND isz_is_deleted = false
       AND (isz_company_id IS NULL OR isz_company_id = ${companyId}::uuid)
    UNION ALL
    SELECT icl_id::text FROM inventory.item_colour_master
     WHERE icl_id = ANY(${colourIds}::uuid[]) AND icl_is_deleted = false
       AND (icl_company_id IS NULL OR icl_company_id = ${companyId}::uuid)`;
    const known = new Set(live.map((row) => row.id));
    const errors = [];
    lines.forEach((line, index) => {
        if (line.sizeId && !known.has(line.sizeId)) {
            errors.push({
                field: fieldOf(index, 'sizeId'),
                code: stock_error_codes_1.StockErrorCode.BATCH_SIZE_NOT_FOUND,
                message: `No live size ${line.sizeId} in this company.`,
            });
        }
        if (line.colourId && !known.has(line.colourId)) {
            errors.push({
                field: fieldOf(index, 'colourId'),
                code: stock_error_codes_1.StockErrorCode.BATCH_COLOUR_NOT_FOUND,
                message: `No live colour ${line.colourId} in this company.`,
            });
        }
    });
    return errors;
}
async function batchDetailsFor(client, companyId, lines) {
    const batchNos = [
        ...new Set(lines.flatMap((l) => (l.itemId && l.batchNo?.trim() ? [foldBatchNo(l.batchNo)] : []))),
    ];
    if (batchNos.length === 0)
        return new Map();
    const rows = await client.$queryRaw `
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
    return new Map(rows.map(({ itemId, batchNo, ...view }) => [batchDetailKey(itemId, batchNo), view]));
}
function batchDetailKey(itemId, batchNo) {
    return `${itemId}|${foldBatchNo(batchNo)}`;
}
async function withBatchDetails(client, companyId, prefix, rows) {
    const lineOf = (row) => ({
        itemId: row[`${prefix}ItemId`],
        batchNo: row[`${prefix}BatchNo`],
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
//# sourceMappingURL=batch-detail.helper.js.map