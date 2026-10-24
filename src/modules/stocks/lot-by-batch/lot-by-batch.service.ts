import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { throwStockNotFound } from 'src/common/utils/module-service.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockErrorCode } from '../types/stock-error-codes';
import type {
  StockErrorDetail,
  StockErrorResponse,
} from '../stock-voucher/types/stock-voucher.types';
import type { LotByBatchQueryDto } from './dto/lot-by-batch-query.dto';

/** One godown's holding of the lot at the branch, in the bucket asked for. */
export interface LotByBatchGodown {
  godownId: string;
  godownName: string | null;
  /** Notes 150 #10 — which bucket this holding is in (one row per godown × bucket under bucket=ALL). */
  bucket: string;
  onHandQty: number;
  /** On hand less what is reserved. */
  availableQty: number;
  /** Notes 151 #10 — this holding's average cost (`sbl_avg_cost_rate`): what an adjustment line relieves or carries. */
  avgCostRate: number;
}

/** One lot carrying the scanned batch, as the sale line is filled from it. */
export interface LotByBatchRow {
  lotId: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  /** The base unit's item_unit_conversion id, the line's unit. */
  baseUomId: string;
  baseUnitName: string | null;
  /** As stored on the lot (the scan matches it folded). */
  batchNo: string;
  mrp: number | null;
  salePrice: number | null;
  /** ACTIVE / CLOSED / BLOCKED / EXPIRED. */
  status: string;
  /** Addendum 2 E3.1 — the batch's detail (stock.stock_batch_detail); null when it has none. */
  sizeId: string | null;
  sizeName: string | null;
  colourId: string | null;
  colourName: string | null;
  model: string | null;
  /** On hand at the branch in the bucket(s) asked for, every godown. */
  onHandQty: number;
  /**
   * Notes 151 #10 — the lot's cost at the branch: the holdings' value ÷ their
   * quantity over the godowns listed, else the lot's own `slt_cost_rate`.
   */
  avgCostRate: number;
  godowns: LotByBatchGodown[];
}

/**
 * Textile plan D5 — the batch scan. The lots of the company whose batch is the
 * label, matched the way the lot key folds it (`slt_key_batch`, upper(btrim()))
 * on ix_slt_key_batch, each with its stock per godown at the branch in the
 * bucket asked for — SALEABLE by default, the bucket a sale takes from; the
 * count screen asks for ALL and may narrow to one godown (notes 150 #10). A lot
 * with nothing there is left out unless `includeEmpty` — a re-lot's old lot
 * (D7) leaves the list that way.
 */
@Injectable()
export class LotByBatchService {
  constructor(private readonly prisma: PrismaService) {}

  async find(q: LotByBatchQueryDto): Promise<LotByBatchRow[]> {
    const bucket = q.bucket ?? 'SALEABLE';
    const rows = await this.prisma.$queryRaw<LotByBatchRow[]>`
      SELECT slt.slt_id::text                      AS "lotId",
             slt.slt_item_id::text                 AS "itemId",
             itm.item_code                         AS "itemCode",
             itm.item_name_en                      AS "itemName",
             slt.slt_base_uom_id::text             AS "baseUomId",
             um.unit_name                          AS "baseUnitName",
             slt.slt_batch_no                      AS "batchNo",
             slt.slt_mrp::float8                   AS mrp,
             slt.slt_sale_price::float8            AS "salePrice",
             slt.slt_status                        AS status,
             sbd.sbd_size_id::text                 AS "sizeId",
             isz.isz_name                          AS "sizeName",
             sbd.sbd_colour_id::text               AS "colourId",
             icl.icl_name                          AS "colourName",
             sbd.sbd_model                         AS model,
             COALESCE(held.on_hand, 0)::float8     AS "onHandQty",
             -- Notes 151 #10: the branch's cost of the lot — value over quantity
             -- of the holdings listed, else the lot's own rate.
             COALESCE(CASE WHEN held.on_hand > 0 THEN held.stock_value / held.on_hand END,
                      slt.slt_cost_rate, 0)::float8 AS "avgCostRate",
             COALESCE(held.godowns, '[]'::jsonb)   AS godowns
        FROM stock.stock_lot slt
        JOIN inventory.item_master itm
          ON itm.item_id = slt.slt_item_id AND itm.item_is_deleted = false
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = slt.slt_base_uom_id
        LEFT JOIN inventory.item_unit_master um      ON um.unit_id = iuc.iuc_unit_id
        -- Addendum 2 E3.1: keyed by the batch (stored folded, as slt_key_batch).
        LEFT JOIN stock.stock_batch_detail sbd
               ON sbd.sbd_company_id = slt.slt_company_id
              AND sbd.sbd_batch_no   = slt.slt_key_batch
              AND sbd.sbd_item_id    = slt.slt_item_id
              AND sbd.sbd_is_deleted = false
        LEFT JOIN inventory.item_size_master   isz ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
        LEFT JOIN LATERAL (
          SELECT sum(sbl.sbl_on_hand_qty) AS on_hand,
                 sum(sbl.sbl_stock_value)  AS stock_value,
                 jsonb_agg(jsonb_build_object(
                   'godownId',     sbl.sbl_godown_id,
                   'godownName',   gdl.gdl_name,
                   'bucket',       sbl.sbl_bucket,
                   'onHandQty',    sbl.sbl_on_hand_qty,
                   'availableQty', sbl.sbl_available_qty,
                   'avgCostRate',  sbl.sbl_avg_cost_rate) ORDER BY gdl.gdl_name, sbl.sbl_bucket) AS godowns
            FROM stock.stock_balance sbl
            LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = sbl.sbl_godown_id
           WHERE sbl.sbl_company_id = slt.slt_company_id
             AND sbl.sbl_branch_id  = ${q.branchId}::uuid
             AND sbl.sbl_lot_id     = slt.slt_id
             -- Notes 150 #10: one bucket (SALEABLE unless asked), or every bucket.
             AND (${bucket}::text = 'ALL' OR sbl.sbl_bucket = ${bucket}::text)
             AND (${q.godownId ?? null}::uuid IS NULL OR sbl.sbl_godown_id = ${q.godownId ?? null}::uuid)
             AND sbl.sbl_is_deleted = false
             AND sbl.sbl_on_hand_qty <> 0
        ) held ON true
       WHERE slt.slt_company_id = ${q.companyId}::uuid
         AND slt.slt_key_batch  = upper(btrim(${q.batchNo}))
         AND slt.slt_is_deleted = false
         ${q.includeEmpty ? Prisma.empty : Prisma.sql`AND COALESCE(held.on_hand, 0) > 0`}
       ORDER BY itm.item_name_en, slt.slt_mrp NULLS FIRST, slt.slt_sale_price NULLS FIRST,
                slt.slt_first_inward_date, slt.slt_id
    `;
    if (rows.length === 0) {
      const message = `No stock with batch ${q.batchNo.trim().toUpperCase()}`;
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        message,
        'batchNo',
        message,
        StockErrorCode.BATCH_NOT_FOUND,
      );
    }
    return rows;
  }
}
