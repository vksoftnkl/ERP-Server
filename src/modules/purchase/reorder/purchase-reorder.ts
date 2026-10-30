import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { purRefuse } from '../common/purchase.errors';
import { D, jsonSafe } from '../common/purchase-doc.helpers';
import { PURCHASE_ORDER_MENU_ID, PurchaseOrderService, type SavePurchaseOrderDto } from '../order/purchase-order';

/**
 * Reorder → PO (DOC-02, menu 296). Reads the item reorder rows of the branch
 * (inventory.item_reorders — kept on the item card: reorder level / qty, min / max,
 * in a unit of the item, optionally per godown; type "production" rows are not bought),
 * the stock here and what is already on order, and suggests what to buy from whom:
 *   cover = on hand (SALEABLE) + pending on confirmed POs, in base units;
 *   below when cover ≤ reorder level (or ≤ min when no level is set);
 *   qty = the reorder qty, else up to max, else back up to the level — rounded up to
 *   the supplier's MOQ when the supplier buys in that unit;
 *   supplier = the preferred one on the supplier–item map, else the last bill's.
 * "Create POs" makes one DRAFT PO per supplier from the ticked rows. The routes use the
 * Purchase Order rights (menu 23); the menu 296 row only puts the screen on the menu.
 */
export const REORDER_MENU_ID = 296;

export class ReorderQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiPropertyOptional({ description: 'Only the items this supplier is the suggested one for.' }) @IsOptional() @IsUUID() supplierId?: string;
  @ApiPropertyOptional({ description: 'true (default): only items at / below their level. false: every reorder row.' })
  @IsOptional() @Type(() => Boolean) @IsBoolean() belowOnly?: boolean;
}
export class ReorderRowDto {
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiProperty() @IsUUID() uomId!: string;
  @ApiProperty() @IsNumber() @Min(0.000001) qty!: number;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) rate?: number;
}
export class CreateReorderPosDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() docDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() godownId?: string;
  @ApiProperty({ type: [ReorderRowDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReorderRowDto) rows!: ReorderRowDto[];
}

@Injectable()
export class PurchaseReorderService {
  constructor(private readonly prisma: PrismaService, private readonly orders: PurchaseOrderService) {}

  async suggestions(q: ReorderQueryDto) {
    const belowOnly = q.belowOnly !== false && String(q.belowOnly) !== 'false';
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH used AS (
        SELECT gri.gri_src_item_id AS id, SUM((gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor) AS q
          FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
         WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED' GROUP BY 1
        UNION ALL
        SELECT pii.pii_src_item_id, SUM(pii.pii_billed_qty * pii.pii_to_base_factor)
          FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
         WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND NOT pii.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED' GROUP BY 1),
      on_order AS (
        SELECT poi.poi_item_id AS item_id,
               SUM(GREATEST(poi.poi_qty * poi.poi_to_base_factor - COALESCE((SELECT SUM(q) FROM used WHERE used.id = poi.poi_id), 0)
                            - poi.poi_short_closed_qty * poi.poi_to_base_factor, 0)) AS base_qty
          FROM purchase.pur_order po
          JOIN purchase.pur_order_item poi ON poi.poi_po_id = po.po_id AND poi.poi_acc_year = po.po_acc_year AND NOT poi.poi_is_deleted
         WHERE po.po_company_id = ${q.companyId}::uuid AND po.po_branch_id = ${q.branchId}::uuid AND po.po_status = 'POSTED' AND NOT po.po_is_deleted
           AND po.po_approval_status <> 'REJECTED'
         GROUP BY 1),
      ro AS (
        SELECT DISTINCT ON (ir.ir_item_id, COALESCE(ir.ir_godown_id::text, ''))
               ir.ir_id, ir.ir_item_id, ir.ir_uc_unit_id, ir.ir_godown_id, ir.ir_reorder_type,
               COALESCE(ir.ir_min_level, 0) AS min_level, COALESCE(ir.ir_max_level, 0) AS max_level,
               COALESCE(ir.ir_reorder_level, 0) AS reorder_level, COALESCE(ir.ir_reorder_qty, 0) AS reorder_qty,
               COALESCE(ir.ir_lead_time_days, 0) AS lead_days
          FROM inventory.item_reorders ir
         WHERE ir.ir_branch_id = ${q.branchId}::uuid AND ir.ir_is_active AND NOT ir.ir_is_deleted
           AND lower(COALESCE(ir.ir_reorder_type, '')) <> 'production'
         ORDER BY ir.ir_item_id, COALESCE(ir.ir_godown_id::text, ''), ir.ir_modified_on DESC NULLS LAST),
      base AS (
        SELECT ro.*, im.item_name_en AS item_name, im.item_code, iuc.iuc_to_base_factor AS factor, um.unit_name,
               COALESCE((SELECT SUM(sbl.sbl_on_hand_qty) FROM stock.stock_balance sbl
                          WHERE sbl.sbl_company_id = ${q.companyId}::uuid AND sbl.sbl_branch_id = ${q.branchId}::uuid AND sbl.sbl_item_id = ro.ir_item_id
                            AND sbl.sbl_bucket = 'SALEABLE' AND NOT sbl.sbl_is_deleted
                            AND (ro.ir_godown_id IS NULL OR sbl.sbl_godown_id = ro.ir_godown_id)), 0) AS on_hand_base,
               COALESCE((SELECT base_qty FROM on_order WHERE on_order.item_id = ro.ir_item_id), 0) AS on_order_base,
               pref.psi_supplier_id AS pref_supplier_id, pref.psi_moq AS moq, pref.psi_buy_uom_id AS moq_uom_id, pref.psi_supplier_item_code AS supplier_code,
               lastb.supplier_id AS last_supplier_id, lastb.rate AS last_rate, lastb.uom_id AS last_uom_id, lastb.doc_date AS last_date
          FROM ro
          JOIN inventory.item_master im ON im.item_id = ro.ir_item_id
          JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = ro.ir_uc_unit_id
          JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
          LEFT JOIN LATERAL (
            SELECT psi.psi_supplier_id, psi.psi_moq, psi.psi_buy_uom_id, psi.psi_supplier_item_code
              FROM purchase.pur_supplier_item psi
             WHERE psi.psi_item_id = ro.ir_item_id AND psi.psi_is_active AND NOT psi.psi_is_deleted AND psi.psi_is_preferred
               AND (psi.psi_company_id IS NULL OR psi.psi_company_id = ${q.companyId}::uuid)
             ORDER BY psi.psi_company_id NULLS LAST LIMIT 1) pref ON true
          LEFT JOIN LATERAL (
            SELECT pi.pi_supplier_id AS supplier_id, pii.pii_rate AS rate, pii.pii_uom_id AS uom_id, pi.pi_doc_date AS doc_date
              FROM purchase.pur_invoice_item pii
              JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
             WHERE pi.pi_company_id = ${q.companyId}::uuid AND pii.pii_item_id = ro.ir_item_id AND pi.pi_status = 'POSTED'
               AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
             ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC LIMIT 1) lastb ON true)
      SELECT b.*, COALESCE(b.pref_supplier_id, b.last_supplier_id) AS supplier_id,
             CASE WHEN b.pref_supplier_id IS NOT NULL THEN 'PREFERRED' WHEN b.last_supplier_id IS NOT NULL THEN 'LAST_BILL' END AS supplier_source,
             s.sup_name AS supplier_name, g.gdl_name AS godown_name,
             (SELECT pii.pii_rate FROM purchase.pur_invoice_item pii
                JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
               WHERE pi.pi_company_id = ${q.companyId}::uuid AND pii.pii_item_id = b.ir_item_id AND pii.pii_uom_id = b.ir_uc_unit_id
                 AND pi.pi_supplier_id = COALESCE(b.pref_supplier_id, b.last_supplier_id) AND pi.pi_status = 'POSTED'
                 AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
               ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC LIMIT 1) AS supplier_rate
        FROM base b
        LEFT JOIN purchase.suppliers s ON s.sup_id = COALESCE(b.pref_supplier_id, b.last_supplier_id)
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = b.ir_godown_id
       ORDER BY s.sup_name NULLS LAST, b.item_name`;

    const out = [];
    for (const r of rows) {
      const factor = D(r.factor as Prisma.Decimal);
      const f = factor.isZero() ? D(1) : factor;
      const onHand = D(r.on_hand_base as Prisma.Decimal).div(f), onOrder = D(r.on_order_base as Prisma.Decimal).div(f);
      const cover = onHand.plus(onOrder);
      const level = D(r.reorder_level as Prisma.Decimal), min = D(r.min_level as Prisma.Decimal), max = D(r.max_level as Prisma.Decimal);
      const trigger = level.greaterThan(0) ? level : min;
      const below = trigger.greaterThan(0) && cover.lessThanOrEqualTo(trigger);
      if (belowOnly && !below) continue;
      let qty = D(r.reorder_qty as Prisma.Decimal);
      if (!qty.greaterThan(0)) qty = max.greaterThan(cover) ? max.minus(cover) : trigger.minus(cover);
      if (qty.isNegative()) qty = D(0);
      qty = qty.toDecimalPlaces(0, Prisma.Decimal.ROUND_UP);
      const moq = D((r.moq as Prisma.Decimal | null) ?? 0);
      if (moq.greaterThan(0) && r.moq_uom_id === r.ir_uc_unit_id && qty.greaterThan(0) && qty.lessThan(moq)) qty = moq;
      const supplierId = (r.supplier_id as string | null) ?? null;
      if (q.supplierId && supplierId !== q.supplierId) continue;
      const rate = r.supplier_rate ?? (r.last_uom_id === r.ir_uc_unit_id ? r.last_rate : null);
      out.push({
        reorderId: r.ir_id, itemId: r.ir_item_id, itemName: r.item_name, itemCode: r.item_code, uomId: r.ir_uc_unit_id, unitName: r.unit_name,
        godownId: r.ir_godown_id ?? null, godownName: r.godown_name ?? null, reorderType: r.ir_reorder_type,
        onHand: onHand.toDecimalPlaces(3), onOrder: onOrder.toDecimalPlaces(3), cover: cover.toDecimalPlaces(3),
        reorderLevel: level, minLevel: min, maxLevel: max, reorderQty: D(r.reorder_qty as Prisma.Decimal), leadDays: r.lead_days,
        below, suggestedQty: qty, supplierId, supplierName: r.supplier_name ?? null, supplierSource: r.supplier_source ?? null,
        supplierCode: r.pref_supplier_id ? (r.supplier_code ?? null) : null, rate: rate ?? null, lastPurchaseDate: r.last_date ?? null,
      });
    }
    return jsonSafe(out);
  }

  /** One DRAFT PO per supplier from the ticked rows (lines of the same item + unit are added together). */
  async createPos(dto: CreateReorderPosDto) {
    const bySupplier = new Map<string, ReorderRowDto[]>();
    for (const r of dto.rows) bySupplier.set(r.supplierId, [...(bySupplier.get(r.supplierId) ?? []), r]);
    const made = [];
    for (const [supplierId, rows] of bySupplier) {
      const lines = new Map<string, { itemId: string; uomId: string; qty: number; rate: number }>();
      for (const r of rows) {
        const k = `${r.itemId}|${r.uomId}`;
        const cur = lines.get(k);
        if (cur) cur.qty += r.qty;
        else lines.set(k, { itemId: r.itemId, uomId: r.uomId, qty: r.qty, rate: r.rate ?? 0 });
      }
      const save: SavePurchaseOrderDto = {
        header: { companyId: dto.companyId, branchId: dto.branchId, accYear: dto.accYear, deviceId: dto.deviceId, supplierId,
                  docDate: dto.docDate ?? new Date().toISOString().slice(0, 10), godownId: dto.godownId, remarks: 'From Reorder' },
        lines: [...lines.values()].map((l, i) => ({ lineNo: i + 1, itemId: l.itemId, uomId: l.uomId, qty: l.qty, rate: l.rate })),
      };
      const po = await this.orders.save(save) as unknown as { header: Record<string, unknown>; lines: unknown[] };
      made.push({ poId: po.header.poId, accYear: po.header.poAccYear, refno: po.header.poRefno, supplierId, supplierName: po.header.supplierName,
                  lines: po.lines.length, value: po.header.poNetAmt });
    }
    return jsonSafe(made);
  }
}

@ApiTags('Purchase — Reorder')
@ApiBearerAuth()
@Controller('purchase/reorder')
export class PurchaseReorderController {
  constructor(private readonly service: PurchaseReorderService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}

  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: PURCHASE_ORDER_MENU_ID, right, codePrefix: 'PO', action });
  }

  @Get('suggestions') @Version(API_VERSION)
  @ApiOperation({ summary: 'Items at / below their reorder level here, with stock, on order, the suggested qty and supplier (DOC-02).' })
  async suggestions(@Query() q: ReorderQueryDto) {
    await this.right('view', 'read the reorder list');
    return { success: true, message: 'Reorder suggestions', data: await this.service.suggestions(q) };
  }

  @Post('create-pos') @Version(API_VERSION)
  @ApiOperation({ summary: 'Ticked reorder rows → one draft PO per supplier.' })
  async createPos(@Body() dto: CreateReorderPosDto) {
    await this.right('create', 'make purchase orders from the reorder list');
    if (dto.rows.some((r) => !r.supplierId)) purRefuse('Every ticked row needs a supplier.', 'PUR_SUPPLIER_REQUIRED', 'rows');
    const data = await this.service.createPos(dto);
    return { success: true, message: `${data.length} purchase order${data.length === 1 ? '' : 's'} made as drafts`, data };
  }
}
