import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetItemBatchStockQueryDto } from './dto/get-item-batch-stock-query.dto';
import {
  ItemBatchStockErrorDetail,
  ItemBatchStockErrorResponse,
  ItemBatchStockPayload,
} from './types/item-batch-stock-api.types';

/** One holding of `stock.stock_balance` with its lot — the row a batch is now. */
interface LotHoldingRow {
  sbl_id: string;
  sbl_company_id: string;
  sbl_branch_id: string;
  sbl_godown_id: string;
  sbl_item_id: string;
  sbl_lot_id: string;
  sbl_bucket: string;
  sbl_in_qty: Prisma.Decimal;
  sbl_out_qty: Prisma.Decimal;
  sbl_free_in_qty: Prisma.Decimal;
  sbl_free_out_qty: Prisma.Decimal;
  sbl_on_hand_qty: Prisma.Decimal | null;
  sbl_reserved_qty: Prisma.Decimal;
  sbl_available_qty: Prisma.Decimal | null;
  sbl_avg_cost_rate: Prisma.Decimal;
  sbl_stock_value: Prisma.Decimal;
  sbl_last_in_date: Date | null;
  sbl_last_out_date: Date | null;
  sbl_is_active: boolean;
  sbl_is_deleted: boolean;
  sbl_row_version: bigint;
  sbl_created_on: Date;
  sbl_created_by: string | null;
  sbl_modified_on: Date | null;
  sbl_modified_by: string | null;
  slt_batch_no: string | null;
  slt_mfg_date: Date | null;
  slt_expiry_date: Date | null;
  slt_mrp: Prisma.Decimal | null;
  slt_serial_no: string | null;
  slt_first_inward_date: Date | null;
  opening_qty: Prisma.Decimal | null;
  opening_free_qty: Prisma.Decimal | null;
  opening_value: Prisma.Decimal | null;
}

/**
 * §1.7 — `GET /item-batch-stock/get`, pointed at the engine's tables: one row
 * per LOT holding (`stock.stock_balance` × `stock.stock_lot`), the response
 * shape unchanged. `ibs_batch_id` is the lot id, which is what a document
 * line's `lotId` names. `inventory.item_batch_stock` has 0 rows and no writer
 * and is on the drop list.
 */
@Injectable()
export class ItemBatchStockService {
  constructor(private readonly prisma: PrismaService) {}

  async getByScope(queryDto: GetItemBatchStockQueryDto): Promise<ItemBatchStockPayload[]> {
    const unitFactorsByUnitId = await this.getItemPriceUnitFactors(
      queryDto.ibs_item_id,
      queryDto.ibs_unit_id,
    );
    const search = queryDto.search?.trim() ? `%${queryDto.search.trim()}%` : null;
    const records = await this.prisma.$queryRaw<LotHoldingRow[]>`
      SELECT b.sbl_id, b.sbl_company_id, b.sbl_branch_id, b.sbl_godown_id, b.sbl_item_id, b.sbl_lot_id,
             b.sbl_bucket, b.sbl_in_qty, b.sbl_out_qty, b.sbl_free_in_qty, b.sbl_free_out_qty,
             b.sbl_on_hand_qty, b.sbl_reserved_qty, b.sbl_available_qty,
             b.sbl_avg_cost_rate, b.sbl_stock_value, b.sbl_last_in_date, b.sbl_last_out_date,
             b.sbl_is_active, b.sbl_is_deleted, b.sbl_row_version,
             b.sbl_created_on, b.sbl_created_by, b.sbl_modified_on, b.sbl_modified_by,
             slt.slt_batch_no, slt.slt_mfg_date, slt.slt_expiry_date, slt.slt_mrp, slt.slt_serial_no,
             slt.slt_first_inward_date,
             op.qty AS opening_qty, op.free_qty AS opening_free_qty, op.value AS opening_value
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        LEFT JOIN LATERAL (
          SELECT SUM(sml.sml_base_qty) AS qty, SUM(sml.sml_free_base_qty) AS free_qty,
                 SUM(sml.sml_cost_value) AS value
            FROM stock.stock_ledger sml
           WHERE sml.sml_company_id = b.sbl_company_id AND sml.sml_branch_id = b.sbl_branch_id
             AND sml.sml_godown_id  = b.sbl_godown_id  AND sml.sml_item_id   = b.sbl_item_id
             AND sml.sml_lot_id     = b.sbl_lot_id     AND sml.sml_bucket    = b.sbl_bucket
             AND sml.sml_acc_year   = ${queryDto.ibs_acc_year}::bpchar
             AND sml.sml_txn_type   = 'OPENING'
             AND sml.sml_is_deleted = false AND sml.sml_is_reversal = false
             AND NOT EXISTS (SELECT 1 FROM stock.stock_ledger rev
                              WHERE rev.sml_reverses_id = sml.sml_id AND rev.sml_acc_year = sml.sml_acc_year
                                AND rev.sml_is_reversal = true AND rev.sml_is_deleted = false)
        ) op ON true
       WHERE b.sbl_company_id = ${queryDto.ibs_company_id}::uuid
         AND b.sbl_branch_id  = ${queryDto.ibs_branch_id}::uuid
         AND b.sbl_godown_id  = ${queryDto.ibs_godown_id}::uuid
         AND b.sbl_item_id    = ${queryDto.ibs_item_id}::uuid
         AND b.sbl_is_active  = ${queryDto.ibs_is_active ?? true}::boolean
         AND b.sbl_is_deleted = ${queryDto.ibs_is_deleted ?? false}::boolean
         AND (${queryDto.ibs_batch_id ?? null}::uuid IS NULL OR b.sbl_lot_id = ${queryDto.ibs_batch_id ?? null}::uuid)
         AND (${queryDto.ibs_stock_bucket ?? null}::text IS NULL OR b.sbl_bucket = ${queryDto.ibs_stock_bucket ?? null}::text)
         AND (${search}::text IS NULL OR slt.slt_batch_no ILIKE ${search}::text OR slt.slt_serial_no ILIKE ${search}::text)
       ORDER BY b.sbl_bucket, slt.slt_expiry_date NULLS LAST, slt.slt_batch_no, b.sbl_lot_id
    `;
    if (records.length === 0) {
      this.throwItemBatchStockNotFound(queryDto);
    }
    if (unitFactorsByUnitId.size === 0) {
      this.throwItemPriceMasterNotFound(queryDto.ibs_item_id, queryDto.ibs_unit_id);
    }
    const unitFactor = unitFactorsByUnitId.get(queryDto.ibs_unit_id);
    if (unitFactor === undefined) {
      this.throwItemPriceMasterNotFound(queryDto.ibs_item_id, queryDto.ibs_unit_id);
    }
    return records.map((record) => this.toPayload(queryDto, record, unitFactor));
  }

  private toPayload(
    query: GetItemBatchStockQueryDto,
    record: LotHoldingRow,
    unitFactor = 1,
  ): ItemBatchStockPayload {
    const closingQty = this.toNumber(record.sbl_on_hand_qty);
    const freeClosingQty = this.toNumber(record.sbl_free_in_qty) - this.toNumber(record.sbl_free_out_qty);
    const reservedQty = this.toNumber(record.sbl_reserved_qty);
    const availableQty = this.toNumber(record.sbl_available_qty);
    const openingQty = this.toNumber(record.opening_qty);
    const openingValue = this.toNumber(record.opening_value);
    return {
      ibs_id: record.sbl_id,
      ibs_acc_year: query.ibs_acc_year,
      ibs_company_id: record.sbl_company_id,
      ibs_branch_id: record.sbl_branch_id,
      ibs_godown_id: record.sbl_godown_id,
      ibs_item_id: record.sbl_item_id,
      ibs_unit_id: query.ibs_unit_id,
      ibs_batch_id: record.sbl_lot_id,
      ibs_batch_no: record.slt_batch_no,
      ibs_mfg_batch_no: null,
      ibs_batch_date: this.toIsoStringOrNull(record.slt_first_inward_date),
      ibs_serial_no: record.slt_serial_no,
      ibs_mfg_date: this.toIsoStringOrNull(record.slt_mfg_date),
      ibs_expiry_date: this.toIsoStringOrNull(record.slt_expiry_date),
      ibs_mrp: this.toNumber(record.slt_mrp),
      ibs_barcode: null,
      ibs_stock_bucket: record.sbl_bucket,
      ibs_opening_qty: openingQty,
      ibs_in_qty: this.toNumber(record.sbl_in_qty),
      ibs_out_qty: this.toNumber(record.sbl_out_qty),
      ibs_closing_qty: closingQty,
      ibs_opening_free_qty: this.toNumber(record.opening_free_qty),
      ibs_free_in_qty: this.toNumber(record.sbl_free_in_qty),
      ibs_free_out_qty: this.toNumber(record.sbl_free_out_qty),
      ibs_free_closing_qty: freeClosingQty,
      ibs_reserved_qty: reservedQty,
      ibs_available_qty: availableQty,
      book_qty: this.calculateBookQty(closingQty, unitFactor),
      book_base_qty: closingQty,
      book_free_qty: this.calculateBookQty(freeClosingQty, unitFactor),
      book_free_base_qty: freeClosingQty,
      book_reserved_qty: this.calculateBookQty(reservedQty, unitFactor),
      book_reserved_base_qty: reservedQty,
      book_available_qty: this.calculateBookQty(availableQty, unitFactor),
      book_available_base_qty: availableQty,
      ibs_opening_avg_rate: openingQty > 0 ? openingValue / openingQty : 0,
      ibs_avg_stock_rate: this.toNumber(record.sbl_avg_cost_rate),
      ibs_opening_value: openingValue,
      ibs_stock_value: this.toNumber(record.sbl_stock_value),
      ibs_last_in_date: this.toIsoStringOrNull(record.sbl_last_in_date),
      ibs_last_out_date: this.toIsoStringOrNull(record.sbl_last_out_date),
      ibs_is_active: record.sbl_is_active,
      ibs_is_deleted: record.sbl_is_deleted,
      ibs_row_version: record.sbl_row_version.toString(),
      ibs_created_on: record.sbl_created_on.toISOString(),
      ibs_created_by: record.sbl_created_by,
      ibs_updated_on: this.toIsoStringOrNull(record.sbl_modified_on),
      ibs_updated_by: record.sbl_modified_by,
    };
  }

  private async getItemPriceUnitFactors(
    itemId: string,
    unitId: string,
  ): Promise<Map<string, number>> {
    const records = await this.prisma.itemPriceMaster.findMany({
      where: {
        ipmItemId: itemId,
        ipmIsDeleted: false,
        // ipm_uc_unit_id holds an iuc_id, so a caller-supplied unit_id matches
        // through the conversion row rather than the column itself.
        OR: [
          { ipmId: unitId },
          { ipmUcUnitId: unitId },
          { itemUnitConversion: { iucUnitId: unitId } },
        ],
      },
      select: {
        ipmId: true,
        ipmUcUnitId: true,
        itemUnitConversion: { select: { iucUnitId: true, iucUnitFactor: true } },
      },
      orderBy: [{ itemUnitConversion: { iucUnitSlno: 'asc' } }, { ipmId: 'asc' }],
    });
    const factorsByUnitId = new Map<string, number>();
    for (const record of records) {
      const unitFactor = this.toNumber(record.itemUnitConversion.iucUnitFactor);
      if (!factorsByUnitId.has(record.ipmId)) {
        factorsByUnitId.set(record.ipmId, unitFactor);
      }
      if (!factorsByUnitId.has(record.ipmUcUnitId)) {
        factorsByUnitId.set(record.ipmUcUnitId, unitFactor);
      }
      if (!factorsByUnitId.has(record.itemUnitConversion.iucUnitId)) {
        factorsByUnitId.set(record.itemUnitConversion.iucUnitId, unitFactor);
      }
    }
    return factorsByUnitId;
  }

  private calculateBookQty(baseQty: number, unitFactor: number): number {
    return unitFactor > 0 ? baseQty / unitFactor : 0;
  }

  private toIsoStringOrNull(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private throwItemBatchStockNotFound(queryDto: GetItemBatchStockQueryDto): never {
    const batchMessage = queryDto.ibs_batch_id ? `, batch ${queryDto.ibs_batch_id}` : '';
    throw new NotFoundException(
      this.buildErrorResponse('Item batch stock not found', [
        {
          field: 'scope',
          message:
            `No item batch stock found for acc year ${queryDto.ibs_acc_year}, ` +
            `company ${queryDto.ibs_company_id}, branch ${queryDto.ibs_branch_id}, ` +
            `godown ${queryDto.ibs_godown_id}, item ${queryDto.ibs_item_id}, ` +
            `unit ${queryDto.ibs_unit_id}${batchMessage}`,
        },
      ]),
    );
  }

  private throwItemPriceMasterNotFound(itemId: string, unitId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item price master not found', [
        {
          field: 'ipm_item_id',
          message: `No item price master found for item ${itemId} and unit ${unitId}`,
        },
      ]),
    );
  }

  private buildErrorResponse(
    message: string,
    errors: ItemBatchStockErrorDetail[] = [],
  ): ItemBatchStockErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}
