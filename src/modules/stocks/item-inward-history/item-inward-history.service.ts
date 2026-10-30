import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { unreversedLedgerRow } from '../stock-voucher/stock-voucher-posting.helper';
import type { ItemInwardHistoryQueryDto } from './dto/item-inward-history-query.dto';

/**
 * The ledger txn types that bring stock IN AT A COST someone paid: an opening
 * and a purchase. A transfer in, a return, a count overage or a bucket move
 * re-uses a cost that already exists, so it is not "what we paid last time".
 * PURCHASE has no writer yet; its rows appear here the day purchase lands.
 */
export const INWARD_PRICE_TXN_TYPES = ['OPENING', 'PURCHASE'] as const;

const DEFAULT_LIMIT = 10;

/** One inward movement, as the quick rate popup lists it. */
export interface ItemInwardRow {
  /** YYYY-MM-DD */
  date: string;
  txnType: (typeof INWARD_PRICE_TXN_TYPES)[number];
  refno: string | null;
  supplierId: string | null;
  supplierName: string | null;
  /** In the unit the document was keyed in (`unitName`), free quantity apart. */
  qty: number;
  freeQty: number;
  unitName: string | null;
  baseQty: number;
  costWot: number;
  /** cost ÷ cost w/o tax − 1, as a percentage; null when the cost w/o tax is 0. */
  taxPerc: number | null;
  cost: number;
  mrp: number | null;
  batchNo: string | null;
}

/**
 * Plan 2026-10-23 §3.2 — the quick rate popup's "Recent inward": the item's
 * last inward rows at this branch, newest first, from stock.stock_ledger, the
 * one place every inward lands whatever document wrote it.
 *
 * A cancelled document's rows are left out entirely (unreversedLedgerRow — the
 * forward row is still live after a cancel, its mirror is what says so).
 * The supplier is the row's party, else its lot's supplier.
 */
@Injectable()
export class ItemInwardHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ItemInwardHistoryQueryDto): Promise<ItemInwardRow[]> {
    return this.prisma.$queryRaw<ItemInwardRow[]>`
      SELECT to_char(sml.sml_doc_date, 'YYYY-MM-DD')                 AS date,
             sml.sml_txn_type                                         AS "txnType",
             sml.sml_src_refno                                        AS refno,
             sup.sup_id::text                                         AS "supplierId",
             sup.sup_name                                             AS "supplierName",
             sml.sml_qty::float8                                      AS qty,
             sml.sml_free_qty::float8                                 AS "freeQty",
             um.unit_name                                             AS "unitName",
             sml.sml_base_qty::float8                                 AS "baseQty",
             sml.sml_cost_rate_wot::float8                            AS "costWot",
             CASE WHEN sml.sml_cost_rate_wot > 0
                  THEN round((sml.sml_cost_rate / sml.sml_cost_rate_wot - 1) * 100, 2)::float8
             END                                                      AS "taxPerc",
             sml.sml_cost_rate::float8                                AS cost,
             sml.sml_mrp::float8                                      AS mrp,
             sml.sml_batch_no                                         AS "batchNo"
        FROM stock.stock_ledger sml
        LEFT JOIN stock.stock_lot slt                ON slt.slt_id = sml.sml_lot_id
        LEFT JOIN purchase.suppliers sup             ON sup.sup_id = COALESCE(sml.sml_party_id, slt.slt_supplier_id)
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sml.sml_uom_id
        LEFT JOIN inventory.item_unit_master um      ON um.unit_id = iuc.iuc_unit_id
       WHERE sml.sml_company_id = ${q.companyId}::uuid
         AND sml.sml_branch_id  = ${q.branchId}::uuid
         AND sml.sml_item_id    = ${q.itemId}::uuid
         AND sml.sml_direction  = 1
         AND sml.sml_txn_type   IN (${Prisma.join([...INWARD_PRICE_TXN_TYPES])})
         AND ${unreversedLedgerRow()}
       ORDER BY sml.sml_doc_date DESC, sml.sml_doc_datetime DESC NULLS LAST, sml.sml_id DESC
       LIMIT ${q.limit ?? DEFAULT_LIMIT}`;
  }
}
