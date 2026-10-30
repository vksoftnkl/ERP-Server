import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  throwStockConflict,
  throwStockNotFound,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import { StockErrorCode } from '../types/stock-error-codes';
import type {
  StockErrorDetail,
  StockErrorResponse,
} from '../stock-voucher/types/stock-voucher.types';
import { foldBatchNo, unknownSizesAndColours } from './batch-detail.helper';
import type { BatchDetailModelsQueryDto, UpdateBatchDetailDto } from './dto/batch-detail.dto';

const MAX_MODELS = 20;

/** One batch's detail, as /stock/batch-detail/update returns it. */
export interface BatchDetailRecord {
  sbdId: string;
  companyId: string;
  batchNo: string;
  itemId: string;
  itemName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  colourId: string | null;
  colourName: string | null;
  model: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcLineId: string | null;
}

/**
 * Textile addendum 2 — the reads and the one write of stock.stock_batch_detail
 * that are not the inward save's: the model suggestions (E3.2) and the
 * correction of a POSTED batch's size / colour / model (E2). Stock never moves.
 */
@Injectable()
export class BatchDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  /** E3.2 — the distinct models used for the item, most recently used first. */
  async models(q: BatchDetailModelsQueryDto): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ model: string }[]>`
      SELECT model
        FROM (SELECT DISTINCT ON (upper(sbd_model))
                     sbd_model AS model,
                     COALESCE(sbd_modified_on, sbd_created_on) AS used_on
                FROM stock.stock_batch_detail
               WHERE sbd_company_id = ${q.companyId}::uuid
                 AND sbd_item_id    = ${q.itemId}::uuid
                 AND sbd_model IS NOT NULL
                 AND sbd_is_deleted = false
                 ${q.q ? Prisma.sql`AND strpos(upper(sbd_model), upper(${q.q})) > 0` : Prisma.empty}
               ORDER BY upper(sbd_model), COALESCE(sbd_modified_on, sbd_created_on) DESC) used
       ORDER BY used_on DESC, model
       LIMIT ${MAX_MODELS}`;
    return rows.map((row) => row.model);
  }

  /**
   * E2 — a wrong size or colour after posting. A field left out is kept, null
   * clears it; the reason is required and lands on the audit row with the
   * before and after. A draft's batch is changed on the draft instead (409),
   * so its save stays the one writer while it is a draft.
   */
  async update(dto: UpdateBatchDetailDto): Promise<BatchDetailRecord> {
    const actor = this.requestContextService.getUserId() ?? null;
    const batchNo = foldBatchNo(dto.batchNo);
    return this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<
        {
          sbd_id: string;
          sbd_size_id: string | null;
          sbd_colour_id: string | null;
          sbd_model: string | null;
          sbd_src_doc_id: string | null;
        }[]
      >`
        SELECT sbd_id, sbd_size_id, sbd_colour_id, sbd_model, sbd_src_doc_id
          FROM stock.stock_batch_detail
         WHERE sbd_company_id = ${dto.companyId}::uuid
           AND sbd_batch_no   = ${batchNo}
           AND sbd_is_deleted = false
         FOR UPDATE`;
      if (!row) {
        throwStockNotFound<StockErrorDetail, StockErrorResponse>(
          'Batch detail not found',
          'batchNo',
          `Batch ${batchNo} has no size / colour / model on record.`,
          StockErrorCode.BATCH_DETAIL_NOT_FOUND,
        );
      }
      await this.assertSourceNotDraft(tx, row.sbd_src_doc_id, batchNo);
      const errors = await unknownSizesAndColours(
        tx,
        dto.companyId,
        [{ sizeId: dto.sizeId, colourId: dto.colourId }],
        (_index, column) => column,
      );
      if (errors.length > 0) {
        throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
          'Size or colour not found',
          errors,
        );
      }
      const next = {
        sizeId: dto.sizeId !== undefined ? dto.sizeId : row.sbd_size_id,
        colourId: dto.colourId !== undefined ? dto.colourId : row.sbd_colour_id,
        model: dto.model !== undefined ? dto.model?.trim() || null : row.sbd_model,
      };
      const before = await this.record(tx, row.sbd_id);
      if (
        next.sizeId === row.sbd_size_id &&
        next.colourId === row.sbd_colour_id &&
        next.model === row.sbd_model
      ) {
        return before;
      }
      await tx.$executeRaw`
        UPDATE stock.stock_batch_detail
           SET sbd_size_id     = ${next.sizeId}::uuid,
               sbd_colour_id   = ${next.colourId}::uuid,
               sbd_model       = ${next.model},
               sbd_modified_on = now(),
               sbd_modified_by = ${actor}
         WHERE sbd_id = ${row.sbd_id}::uuid`;
      const after = await this.record(tx, row.sbd_id);
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: 'stock_batch_detail',
          screenName: 'Batch Detail',
          screenType: 'transaction',
          pk: row.sbd_id,
          displayName: batchNo,
          originalRecord: before,
          modifiedRecord: after,
          userId: actor ?? undefined,
          notes: dto.reason,
        },
        tx,
      );
      return after;
    });
  }

  /** A batch whose inward document is still a draft is changed by saving the draft. */
  private async assertSourceNotDraft(
    tx: Prisma.TransactionClient,
    srcDocId: string | null,
    batchNo: string,
  ): Promise<void> {
    if (!srcDocId) return;
    const [doc] = await tx.$queryRaw<{ svh_status: string; svh_refno: string }[]>`
      SELECT svh_status, svh_refno FROM stock.stock_voucher
       WHERE svh_id = ${srcDocId}::uuid AND svh_is_deleted = false
       LIMIT 1`;
    if (doc?.svh_status === 'DRAFT') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(`${doc.svh_refno} is a draft`, [
        {
          field: 'batchNo',
          code: StockErrorCode.BATCH_DETAIL_ON_DRAFT,
          message: `Batch ${batchNo} is on draft ${doc.svh_refno}: change it there and save the draft.`,
        },
      ]);
    }
  }

  private async record(tx: Prisma.TransactionClient, sbdId: string): Promise<BatchDetailRecord> {
    const [record] = await tx.$queryRaw<BatchDetailRecord[]>`
      SELECT sbd.sbd_id::text          AS "sbdId",
             sbd.sbd_company_id::text  AS "companyId",
             sbd.sbd_batch_no          AS "batchNo",
             sbd.sbd_item_id::text     AS "itemId",
             itm.item_name_en          AS "itemName",
             sbd.sbd_size_id::text     AS "sizeId",
             isz.isz_name              AS "sizeName",
             sbd.sbd_colour_id::text   AS "colourId",
             icl.icl_name              AS "colourName",
             sbd.sbd_model             AS model,
             sbd.sbd_src_doc_type      AS "srcDocType",
             sbd.sbd_src_doc_id::text  AS "srcDocId",
             sbd.sbd_src_line_id::text AS "srcLineId"
        FROM stock.stock_batch_detail sbd
        JOIN inventory.item_master itm ON itm.item_id = sbd.sbd_item_id
        LEFT JOIN inventory.item_size_master   isz ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
       WHERE sbd.sbd_id = ${sbdId}::uuid`;
    return record;
  }
}
