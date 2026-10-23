import { Injectable } from '@nestjs/common';
import { ItemPriceMaster, Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import {
  daySql,
  type BucketPriceCandidate,
} from 'src/modules/stocks/selling-price-bulk/price-bucket.gateway';
import type { ScopeResolution } from 'src/modules/stocks/selling-price-bulk/selling-price-scope.helper';
import {
  PRICE_LEVELS,
  type PriceLevel,
} from 'src/modules/stocks/selling-price-bulk/types/selling-price-bulk.types';
import { PriceChangeLogService } from './price-change-log.service';
import {
  PRICE_ORIGIN,
  type PriceRowSnapshot,
  type PriceTable,
  type PriceWriteOrigin,
} from './types/price-change-log.types';

/**
 * The profit type every Change Selling Price write stores. `ipm_profit_type`
 * is NOT NULL and SaveItemPriceDto pins it to three values; "By User" is the
 * only honest one — the operator typed the price, nothing derived it.
 */
const PROFIT_TYPE = 'By User';

/** A bucket key as the re-key writes it. */
export interface PriceBucketWrite {
  mrp: number | null;
  salePrice: number | null;
}

/**
 * Notes 144 — `PriceMasterWriter`: THE ONLY CODE THAT WRITES
 * inventory.item_price_master OR inventory.item_qty_price. The item card, the
 * Change Selling Price screen, the bucket re-key and the qty slab screen all
 * call it; `price-master-writer.guard.spec.ts` fails the build on a write
 * anywhere else.
 *
 * Every method does the same three things around its one statement, in the
 * caller's transaction: snapshot the row before, write, snapshot it after —
 * then PriceChangeLog.record() files one log row per changed row (none for a
 * no-op). The statements themselves are the ones the screens always ran,
 * moved here unchanged; what they validate, and the audit.audit_log rows
 * they write, stay with the screens.
 */
@Injectable()
export class PriceMasterWriter {
  constructor(private readonly changeLog: PriceChangeLogService) {}

  // ── item_price_master — the item card (ItemsPriceMasterService) ──────────

  async createPrice(
    tx: Prisma.TransactionClient,
    origin: PriceWriteOrigin,
    data: Prisma.ItemPriceMasterUncheckedCreateInput,
  ): Promise<ItemPriceMaster> {
    const created = await tx.itemPriceMaster.create({ data });
    await this.logAfter(tx, 'IPM', origin, [created.ipmId], new Map());
    return created;
  }

  /** An update, a soft delete (ipm_is_deleted set) or a restore (cleared) — the log tells them apart. */
  async updatePrice(
    tx: Prisma.TransactionClient,
    origin: PriceWriteOrigin,
    ipmId: string,
    data: Prisma.ItemPriceMasterUncheckedUpdateInput,
  ): Promise<ItemPriceMaster> {
    const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
    const updated = await tx.itemPriceMaster.update({ where: { ipmId }, data });
    await this.logAfter(tx, 'IPM', origin, [ipmId], before);
    return updated;
  }

  // ── item_price_master — the bucket re-key (PriceBucketService.rekeyItem) ─

  /** One row's bucket, re-derived under the policy now in force. Logged as REKEY. */
  async rekeyPrice(
    tx: Prisma.TransactionClient,
    ipmId: string,
    key: PriceBucketWrite,
    updatedOn: Date,
  ): Promise<void> {
    const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
    await tx.itemPriceMaster.update({
      where: { ipmId },
      data: { ipmBucketMrp: key.mrp, ipmBucketSp: key.salePrice, ipmUpdatedOn: updatedOn },
    });
    await this.logAfter(tx, 'IPM', PRICE_ORIGIN.BUCKET_REKEY, [ipmId], before, 'REKEY');
  }

  // ── item_price_master — Change Selling Price (SellingPriceBulkService) ───
  // S2 / S3 and the notes 140 period writes, moved from PriceBucketGateway.

  /** S2 — update the row S1 found. Min price and round-off keep their stored value when not sent. */
  async updateBucketPrice(
    tx: Prisma.TransactionClient,
    ipmId: string,
    candidate: BucketPriceCandidate,
    origin: PriceWriteOrigin = PRICE_ORIGIN.CHANGE_SELLING_PRICE,
  ): Promise<string> {
    const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
    const l = levelColumns(candidate);
    await tx.$executeRaw`
      UPDATE inventory.item_price_master
         SET ipm_sales_price_a = COALESCE(${l.a.price}::numeric, ipm_sales_price_a),
             ipm_sales_price_b = COALESCE(${l.b.price}::numeric, ipm_sales_price_b),
             ipm_sales_price_c = COALESCE(${l.c.price}::numeric, ipm_sales_price_c),
             ipm_sales_price_d = COALESCE(${l.d.price}::numeric, ipm_sales_price_d),
             ipm_price_a_wot = COALESCE(${l.a.priceWot}::numeric, ipm_price_a_wot),
             ipm_price_b_wot = COALESCE(${l.b.priceWot}::numeric, ipm_price_b_wot),
             ipm_price_c_wot = COALESCE(${l.c.priceWot}::numeric, ipm_price_c_wot),
             ipm_price_d_wot = COALESCE(${l.d.priceWot}::numeric, ipm_price_d_wot),
             ipm_price_a_markup_perc = COALESCE(${l.a.markupPerc}::numeric, ipm_price_a_markup_perc),
             ipm_price_b_markup_perc = COALESCE(${l.b.markupPerc}::numeric, ipm_price_b_markup_perc),
             ipm_price_c_markup_perc = COALESCE(${l.c.markupPerc}::numeric, ipm_price_c_markup_perc),
             ipm_price_d_markup_perc = COALESCE(${l.d.markupPerc}::numeric, ipm_price_d_markup_perc),
             ipm_min_price   = COALESCE(${candidate.minPrice}::numeric, ipm_min_price),
             ipm_cost_price  = ${candidate.costRate},
             ipm_cost_wot    = ${candidate.costWot},
             ipm_profit_type = ${PROFIT_TYPE},
             ipm_round_off   = COALESCE(${candidate.roundOff}::numeric, ipm_round_off),
             ipm_updated_on  = now(),
             ipm_updated_by  = ${actorColumn(candidate.actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
    await this.logAfter(tx, 'IPM', origin, [ipmId], before);
    return ipmId;
  }

  /**
   * S3 — insert a row at the target scope, returning its `ipm_id`.
   *
   * The ATTRIBUTES come from the headline row of the same unit at the target
   * scope or wider — godown, cess, discount, loading, freight, loyalty points,
   * the unit remark. Without the copy a bucket-priced line would lose its cess
   * and loading charge at the till, which is exactly the fault the two-table
   * design had. `ipm_max_price` is the bucket's MRP (ck_ipm_bucket_mrp_is_max),
   * else the headline's.
   *
   * THE PERIOD (notes 140 A) fills the gap the key has around the day: from
   * `onDate` itself when one is given (a scheduled price), else from the day
   * after the key's last closed row (1900-01-01 when it has none — the column
   * default, so a key with no history is priced exactly as before); to the day
   * before the key's next scheduled row, else 9999-12-31. A key's history and
   * scheduled rows therefore never overlap a new one: `ex_ipm_overlap` still
   * refuses two rows claiming one bucket, scope and day.
   */
  async insertBucketPrice(
    tx: Prisma.TransactionClient,
    candidate: BucketPriceCandidate,
    scope: ScopeResolution,
    onDate?: string,
    origin: PriceWriteOrigin = PRICE_ORIGIN.CHANGE_SELLING_PRICE,
  ): Promise<string> {
    const l = levelColumns(candidate);
    const actor = actorColumn(candidate.actor);
    const day = daySql(onDate);
    const sameKey = Prisma.sql`
             k.ipm_company_id IS NOT DISTINCT FROM ${candidate.companyId}::uuid
         AND k.ipm_branch_id  IS NOT DISTINCT FROM ${scope.targetBranchId}::uuid
         AND k.ipm_item_id    = ${candidate.itemId}::uuid
         AND k.ipm_uc_unit_id = ${candidate.uomId}::uuid
         AND k.ipm_key_mrp    = COALESCE(${candidate.mrp}::numeric, -1)
         AND k.ipm_key_sp     = COALESCE(${candidate.salePrice}::numeric, -1)
         AND k.ipm_is_deleted = false`;
    const from = onDate
      ? day
      : Prisma.sql`COALESCE((SELECT MAX(k.ipm_effective_to) + 1
                                FROM inventory.item_price_master k
                               WHERE ${sameKey} AND k.ipm_effective_to < ${day}),
                              DATE '1900-01-01')`;
    const [row] = await tx.$queryRaw<Array<{ ipmId: string }>>`
      INSERT INTO inventory.item_price_master (
        ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id, ipm_godown_id, ipm_sl_no,
        ipm_cost_price, ipm_cost_wot,
        ipm_sales_price_a, ipm_sales_price_b, ipm_sales_price_c, ipm_sales_price_d,
        ipm_price_a_wot, ipm_price_b_wot, ipm_price_c_wot, ipm_price_d_wot,
        ipm_price_a_markup_perc, ipm_price_b_markup_perc, ipm_price_c_markup_perc, ipm_price_d_markup_perc,
        ipm_max_price, ipm_min_price, ipm_disc_perc, ipm_disc_qty, ipm_addl_cess,
        ipm_profit_type, ipm_round_off, ipm_loading_charge, ipm_freight_charge, ipm_loyalty_points,
        ipm_uom_remarks, ipm_bucket_mrp, ipm_bucket_sp,
        ipm_effective_from, ipm_effective_to,
        ipm_created_on, ipm_created_by, ipm_updated_on, ipm_updated_by
      )
      SELECT ${candidate.companyId}::uuid, ${scope.targetBranchId}::uuid,
             ${candidate.itemId}::uuid, ${candidate.uomId}::uuid,
             h.ipm_godown_id, COALESCE(h.ipm_sl_no, 0),
             ${candidate.costRate}, ${candidate.costWot},
             COALESCE(${l.a.price}::numeric, 0), COALESCE(${l.b.price}::numeric, 0),
             COALESCE(${l.c.price}::numeric, 0), COALESCE(${l.d.price}::numeric, 0),
             COALESCE(${l.a.priceWot}::numeric, 0), COALESCE(${l.b.priceWot}::numeric, 0),
             COALESCE(${l.c.priceWot}::numeric, 0), COALESCE(${l.d.priceWot}::numeric, 0),
             COALESCE(${l.a.markupPerc}::numeric, 0), COALESCE(${l.b.markupPerc}::numeric, 0),
             COALESCE(${l.c.markupPerc}::numeric, 0), COALESCE(${l.d.markupPerc}::numeric, 0),
             COALESCE(${candidate.mrp}::numeric, h.ipm_max_price, 0),
             COALESCE(${candidate.minPrice}::numeric, h.ipm_min_price, 0),
             COALESCE(h.ipm_disc_perc, 0), COALESCE(h.ipm_disc_qty, 0), COALESCE(h.ipm_addl_cess, 0),
             ${PROFIT_TYPE}, COALESCE(${candidate.roundOff}::numeric, h.ipm_round_off, 0),
             COALESCE(h.ipm_loading_charge, 0), COALESCE(h.ipm_freight_charge, 0),
             COALESCE(h.ipm_loyalty_points, 0), h.ipm_uom_remarks,
             ${candidate.mrp}::numeric, ${candidate.salePrice}::numeric,
             ${from},
             COALESCE((SELECT MIN(k.ipm_effective_from) - 1
                         FROM inventory.item_price_master k
                        WHERE ${sameKey} AND k.ipm_effective_from > ${day}),
                      DATE '9999-12-31'),
             now(), ${actor}::uuid, now(), ${actor}::uuid
        FROM (SELECT 1) one
        LEFT JOIN LATERAL (
          SELECT hp.*
            FROM inventory.item_price_master hp
           WHERE hp.ipm_item_id    = ${candidate.itemId}::uuid
             AND hp.ipm_uc_unit_id = ${candidate.uomId}::uuid
             AND hp.ipm_key_mrp = -1 AND hp.ipm_key_sp = -1
             AND hp.ipm_is_deleted = false
             AND ${day} BETWEEN hp.ipm_effective_from AND hp.ipm_effective_to
             AND (hp.ipm_company_id IS NULL OR hp.ipm_company_id = ${candidate.companyId}::uuid)
             AND (hp.ipm_branch_id  IS NULL OR hp.ipm_branch_id  = ${scope.targetBranchId}::uuid)
           ORDER BY (hp.ipm_branch_id IS NULL), (hp.ipm_company_id IS NULL), hp.ipm_id
           LIMIT 1
        ) h ON true
      RETURNING ipm_id AS "ipmId"
    `;
    await this.logAfter(tx, 'IPM', origin, [row.ipmId], new Map());
    return row.ipmId;
  }

  /**
   * Notes 140 A — the split's first half: the row S1 found on the scheduled day
   * now ends the day before it. Run BEFORE the new row is inserted, so the two
   * never overlap and `ex_ipm_overlap` needs no deferral.
   */
  async closePriceRowBefore(
    tx: Prisma.TransactionClient,
    ipmId: string,
    onDate: string,
    actor: string,
    origin: PriceWriteOrigin = PRICE_ORIGIN.CHANGE_SELLING_PRICE,
  ): Promise<void> {
    const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
    await tx.$executeRaw`
      UPDATE inventory.item_price_master
         SET ipm_effective_to = ${onDate}::date - 1,
             ipm_updated_on   = now(),
             ipm_updated_by   = ${actorColumn(actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
    await this.logAfter(tx, 'IPM', origin, [ipmId], before);
  }

  /**
   * Notes 140 A — the split's second half: a new row from `onDate` to the old
   * row's end (`effectiveTo`, read before the old row was closed), a copy of
   * the old row — godown, cess, discount, charges, points, remarks, the bucket,
   * the levels this save did not send — with the new prices written over it
   * exactly as S2 writes them, cost included.
   */
  async insertSplitPrice(
    tx: Prisma.TransactionClient,
    sourceId: string,
    candidate: BucketPriceCandidate,
    period: { from: string; to: string },
    origin: PriceWriteOrigin = PRICE_ORIGIN.CHANGE_SELLING_PRICE,
  ): Promise<string> {
    const l = levelColumns(candidate);
    const actor = actorColumn(candidate.actor);
    const [row] = await tx.$queryRaw<Array<{ ipmId: string }>>`
      INSERT INTO inventory.item_price_master (
        ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id, ipm_godown_id, ipm_sl_no,
        ipm_cost_price, ipm_cost_wot,
        ipm_sales_price_a, ipm_sales_price_b, ipm_sales_price_c, ipm_sales_price_d,
        ipm_price_a_wot, ipm_price_b_wot, ipm_price_c_wot, ipm_price_d_wot,
        ipm_price_a_markup_perc, ipm_price_b_markup_perc, ipm_price_c_markup_perc, ipm_price_d_markup_perc,
        ipm_max_price, ipm_min_price, ipm_disc_perc, ipm_disc_qty, ipm_addl_cess,
        ipm_profit_type, ipm_round_off, ipm_loading_charge, ipm_freight_charge, ipm_loyalty_points,
        ipm_uom_remarks, ipm_cost_remarks, ipm_is_active, ipm_bucket_mrp, ipm_bucket_sp,
        ipm_effective_from, ipm_effective_to,
        ipm_created_on, ipm_created_by, ipm_updated_on, ipm_updated_by
      )
      SELECT o.ipm_company_id, o.ipm_branch_id, o.ipm_item_id, o.ipm_uc_unit_id, o.ipm_godown_id, o.ipm_sl_no,
             ${candidate.costRate}, ${candidate.costWot},
             COALESCE(${l.a.price}::numeric, o.ipm_sales_price_a),
             COALESCE(${l.b.price}::numeric, o.ipm_sales_price_b),
             COALESCE(${l.c.price}::numeric, o.ipm_sales_price_c),
             COALESCE(${l.d.price}::numeric, o.ipm_sales_price_d),
             COALESCE(${l.a.priceWot}::numeric, o.ipm_price_a_wot),
             COALESCE(${l.b.priceWot}::numeric, o.ipm_price_b_wot),
             COALESCE(${l.c.priceWot}::numeric, o.ipm_price_c_wot),
             COALESCE(${l.d.priceWot}::numeric, o.ipm_price_d_wot),
             COALESCE(${l.a.markupPerc}::numeric, o.ipm_price_a_markup_perc),
             COALESCE(${l.b.markupPerc}::numeric, o.ipm_price_b_markup_perc),
             COALESCE(${l.c.markupPerc}::numeric, o.ipm_price_c_markup_perc),
             COALESCE(${l.d.markupPerc}::numeric, o.ipm_price_d_markup_perc),
             o.ipm_max_price, COALESCE(${candidate.minPrice}::numeric, o.ipm_min_price),
             o.ipm_disc_perc, o.ipm_disc_qty, o.ipm_addl_cess,
             ${PROFIT_TYPE}, COALESCE(${candidate.roundOff}::numeric, o.ipm_round_off),
             o.ipm_loading_charge, o.ipm_freight_charge, o.ipm_loyalty_points,
             o.ipm_uom_remarks, o.ipm_cost_remarks, o.ipm_is_active, o.ipm_bucket_mrp, o.ipm_bucket_sp,
             ${period.from}::date, ${period.to}::date,
             now(), ${actor}::uuid, now(), ${actor}::uuid
        FROM inventory.item_price_master o
       WHERE o.ipm_id = ${sourceId}::uuid
      RETURNING ipm_id AS "ipmId"
    `;
    await this.logAfter(tx, 'IPM', origin, [row.ipmId], new Map());
    return row.ipmId;
  }

  /** Notes 140 B — the cancelled row leaves the table's live set. Logged as DELETE. */
  async softDeletePriceRow(
    tx: Prisma.TransactionClient,
    ipmId: string,
    actor: string,
    origin: PriceWriteOrigin = PRICE_ORIGIN.CHANGE_SELLING_PRICE,
  ): Promise<void> {
    const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
    await tx.$executeRaw`
      UPDATE inventory.item_price_master
         SET ipm_is_deleted = true,
             ipm_updated_on = now(),
             ipm_updated_by = ${actorColumn(actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
    await this.logAfter(tx, 'IPM', origin, [ipmId], before);
  }

  /** Notes 140 B — the row before a cancelled one runs on to the cancelled row's end. */
  async extendPriceRowTo(
    tx: Prisma.TransactionClient,
    ipmId: string,
    effectiveTo: string,
    actor: string,
    origin: PriceWriteOrigin = PRICE_ORIGIN.CHANGE_SELLING_PRICE,
  ): Promise<void> {
    const before = await this.changeLog.snapshot(tx, 'IPM', [ipmId]);
    await tx.$executeRaw`
      UPDATE inventory.item_price_master
         SET ipm_effective_to = ${effectiveTo}::date,
             ipm_updated_on   = now(),
             ipm_updated_by   = ${actorColumn(actor)}::uuid
       WHERE ipm_id = ${ipmId}::uuid
    `;
    await this.logAfter(tx, 'IPM', origin, [ipmId], before);
  }

  // ── item_qty_price — the qty slab screen (ItemsQtyPriceMasterService) ────

  async createQtyPrice<I extends Prisma.ItemQtyPriceInclude>(
    tx: Prisma.TransactionClient,
    origin: PriceWriteOrigin,
    data: Prisma.ItemQtyPriceUncheckedCreateInput,
    include: I,
  ): Promise<Prisma.ItemQtyPriceGetPayload<{ include: I }>> {
    const created = await tx.itemQtyPrice.create({ data, include });
    await this.logAfter(tx, 'IQP', origin, [created.iqpId], new Map());
    return created;
  }

  async updateQtyPrice<I extends Prisma.ItemQtyPriceInclude>(
    tx: Prisma.TransactionClient,
    origin: PriceWriteOrigin,
    iqpId: string,
    data: Prisma.ItemQtyPriceUncheckedUpdateInput,
    include: I,
  ): Promise<Prisma.ItemQtyPriceGetPayload<{ include: I }>> {
    const before = await this.changeLog.snapshot(tx, 'IQP', [iqpId]);
    const updated = await tx.itemQtyPrice.update({ where: { iqpId }, data, include });
    await this.logAfter(tx, 'IQP', origin, [iqpId], before);
    return updated;
  }

  /**
   * Delete or restore one slab, GUARDED: it flips only while the row is still
   * in the state the caller read (`wasDeleted`). Answers how many rows moved —
   * 0 when another request got there first, and then nothing is logged.
   */
  async setQtyPriceDeleted(
    tx: Prisma.TransactionClient,
    origin: PriceWriteOrigin,
    iqpId: string,
    wasDeleted: boolean,
    data: Prisma.ItemQtyPriceUncheckedUpdateManyInput,
  ): Promise<number> {
    const before = await this.changeLog.snapshot(tx, 'IQP', [iqpId]);
    const result = await tx.itemQtyPrice.updateMany({
      where: { iqpId, iqpIsDeleted: wasDeleted },
      data,
    });
    if (result.count > 0) {
      await this.logAfter(tx, 'IQP', origin, [iqpId], before);
    }
    return result.count;
  }

  /** The rows after the statement, one log row each against `before`. */
  private async logAfter(
    tx: Prisma.TransactionClient,
    table: PriceTable,
    origin: PriceWriteOrigin,
    ids: readonly string[],
    before: Map<string, PriceRowSnapshot>,
    action?: 'REKEY',
  ): Promise<void> {
    const after = await this.changeLog.snapshot(tx, table, ids);
    for (const rowId of ids) {
      await this.changeLog.record(tx, {
        table,
        rowId,
        origin,
        before: before.get(rowId) ?? null,
        after: after.get(rowId) ?? null,
        ...(action ? { action } : {}),
      });
    }
  }
}

/**
 * The candidate's four levels by column suffix — the ONE place the ordinal
 * 1–4 meets the a–d columns. A level the payload did not send is null: S2
 * keeps the stored figure, S3 stores 0.
 */
function levelColumns(
  candidate: BucketPriceCandidate,
): Record<
  'a' | 'b' | 'c' | 'd',
  { price: number | null; priceWot: number | null; markupPerc: number | null }
> {
  const at = (level: PriceLevel) =>
    candidate.levels.find((entry) => entry.level === level) ?? {
      price: null,
      priceWot: null,
      markupPerc: null,
    };
  const [a, b, c, d] = PRICE_LEVELS.map(at);
  return { a, b, c, d };
}

/** ipm_created_by / ipm_updated_by are uuids: the nil-uuid sentinel is stored as NULL. */
function actorColumn(actor: string): string | null {
  return actor && actor !== DEFAULT_ACTOR ? actor : null;
}
