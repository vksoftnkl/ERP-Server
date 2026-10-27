import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { calcPurchase } from '../common/purchase-calc';
import { PUR, purConflict, purNotFound, purRefuse, purRefuseMany } from '../common/purchase.errors';
import {
  allocateDocNumber, D, isInterState, jsonSafe, loadTaxRates, loadUnits, statusLog, supplierRow, TxnStatusDocType, TxnStatusEvent, ZERO,
} from '../common/purchase-doc.helpers';

/**
 * Purchase Order — menu 23 (plan §3.1). Posts nothing. "Post" CONFIRMS it (open
 * for GRNs / bills). Received / pending per line are DERIVED from the GRN and
 * bill lines whose src_* name it — never a counter (3.0 re-added qty on every save).
 */
export const PURCHASE_ORDER_MENU_ID = 23;

export class PurchaseOrderLineDto {
  @ApiProperty() @IsInt() @Min(1) lineNo!: number;
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiProperty() @IsUUID() uomId!: string;
  @ApiProperty() @IsNumber() @Min(0) qty!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) freeQty?: number;
  @ApiProperty() @IsNumber() @Min(0) rate!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() discPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() schPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() mrp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remarks?: string;
}
export class PurchaseOrderHeaderDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() poId?: string;
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiProperty() @IsDateString() docDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() godownId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) creditDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() termsText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @ApiPropertyOptional({ description: 'Confirm: the PO is open for GRNs and bills.' }) @IsOptional() @IsBoolean() post?: boolean;
}
export class SavePurchaseOrderDto {
  @ApiProperty({ type: PurchaseOrderHeaderDto }) @ValidateNested() @Type(() => PurchaseOrderHeaderDto) header!: PurchaseOrderHeaderDto;
  @ApiProperty({ type: [PurchaseOrderLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseOrderLineDto) lines!: PurchaseOrderLineDto[];
}
export class PurchaseOrderRefDto {
  @ApiProperty() @IsUUID() poId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}
export class PurchaseOrderReasonDto extends PurchaseOrderRefDto {
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
  @ApiPropertyOptional({ description: 'Short-close only these lines (poi_id); default every pending line.' }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) lineIds?: string[];
}
export class PendingPoLinesQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
}

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }

  async save(dto: SavePurchaseOrderDto) {
    const actor = this.actor();
    const h = dto.header;
    const id = await this.prisma.$transaction(async (tx) => {
      const sup = await supplierRow(tx, h.supplierId);
      const inter = await isInterState(tx, h.branchId, sup);
      const units = await loadUnits(tx, dto.lines.map((l) => l.uomId));
      const problems = dto.lines.flatMap((l, i) => {
        const u = units.get(l.uomId);
        return !u || u.iuc_item_id !== l.itemId ? [{ field: `lines.${i}.uomId`, code: PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: unit not found for the item` }] : [];
      });
      if (problems.length) purRefuseMany(problems[0].message, problems);
      for (const l of dto.lines) if (!l.taxId) l.taxId = units.get(l.uomId)?.item_default_tax_id ?? undefined;
      const taxes = await loadTaxRates(tx, dto.lines.map((l) => l.taxId));
      const calc = calcPurchase({
        interState: inter, roundOffStep: 0,
        lines: dto.lines.map((l) => ({ key: String(l.lineNo), billedQty: l.qty, freeQty: l.freeQty ?? 0, rate: l.rate, discPct: l.discPct, schPct: l.schPct,
          gstPct: l.taxId ? taxes.get(l.taxId)?.tax_rate_perc ?? 0 : 0, toBaseFactor: units.get(l.uomId)!.iuc_to_base_factor, weight: l.weight ?? 0 })),
      });
      let poId = h.poId ?? null;
      let slno: bigint, refno: string, isNew = false;
      if (poId) {
        const cur = await tx.purOrder.findFirst({ where: { poId, poAccYear: h.accYear, poIsDeleted: false } });
        if (!cur) purNotFound(`Purchase order ${poId} not found`);
        if (cur.poStatus !== 'DRAFT') {
          // amend after confirm: only while nothing is received (§3.1)
          const used = await this.usedQty(tx, poId);
          if ([...used.values()].some((q) => q.greaterThan(0))) purConflict(`${cur.poRefno} has goods received against it — raise qty or short-close instead.`, PUR.NOT_DRAFT, 'poId');
        }
        slno = cur.poSlno; refno = cur.poRefno;
        await tx.purOrderItem.deleteMany({ where: { poiPoId: poId, poiAccYear: h.accYear } });
      } else {
        ({ slno, refno } = await allocateDocNumber(tx, 'PO', h.companyId, h.branchId, h.accYear, h.deviceId));
        isNew = true;
      }
      const tax = calc.cgst.plus(calc.sgst).plus(calc.igst).plus(calc.cess);
      const data = {
        poCompanyId: h.companyId, poBranchId: h.branchId, poAccYear: h.accYear, poDeviceId: h.deviceId, poSlno: slno, poRefno: refno,
        poDocDate: new Date(`${h.docDate}T00:00:00Z`), poSupplierId: h.supplierId, poExpectedDate: h.expectedDate ? new Date(`${h.expectedDate}T00:00:00Z`) : null,
        poDeliverGodownId: h.godownId ?? null, poContact: h.contact ?? null, poCreditDays: h.creditDays ?? sup.sup_credit_days ?? null,
        poTermsText: h.termsText ?? null, poGrossAmt: calc.gross, poTaxableAmt: calc.taxable, poTaxAmt: tax, poNetAmt: calc.taxable.plus(tax),
        poRemarks: h.remarks ?? null, poStatus: h.post ? 'POSTED' : 'DRAFT',
      };
      if (isNew) poId = (await tx.purOrder.create({ data: { ...data, poCreatedBy: actor }, select: { poId: true } })).poId;
      else await tx.purOrder.update({ where: { poId_poAccYear: { poId: poId!, poAccYear: h.accYear } }, data: { ...data, poModifiedBy: actor, poModifiedOn: new Date(), poRevisionNo: { increment: 1 } } });
      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i], o = calc.lines[i], u = units.get(l.uomId)!;
        await tx.purOrderItem.create({ data: {
          poiPoId: poId!, poiCompanyId: h.companyId, poiBranchId: h.branchId, poiAccYear: h.accYear, poiLineNo: l.lineNo,
          poiItemId: l.itemId, poiUomId: l.uomId, poiBaseUomId: u.base_iuc_id, poiToBaseFactor: u.iuc_to_base_factor, poiHsnCode: u.item_hsn_code,
          poiWeight: l.weight ?? null, poiQty: D(l.qty), poiFreeQty: D(l.freeQty), poiRate: D(l.rate), poiDiscPct: D(l.discPct), poiDiscAmt: o.discAmt,
          poiSchPct: D(l.schPct), poiSchAmt: o.schAmt, poiGrossAmt: o.gross, poiTaxableAmt: o.taxable, poiTaxId: l.taxId ?? null, poiGstPct: o.gstPct,
          poiCgstAmt: o.cgst, poiSgstAmt: o.sgst, poiIgstAmt: o.igst, poiCessAmt: o.cess, poiTotalAmt: o.total, poiMrp: l.mrp ?? null,
          poiRemarks: l.remarks ?? null, poiCreatedBy: actor,
        } });
      }
      if (isNew) await statusLog(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: poId!, refno, event: TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
      if (h.post) await statusLog(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: poId!, refno, event: TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: h.deviceId });
      return poId!;
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(id, h.accYear);
  }

  /** qty already received / billed per PO line (base units), from the lines whose src_* name it. */
  private async usedQty(tx: Prisma.TransactionClient | PrismaService, poId: string) {
    const rows = await tx.$queryRaw<{ id: string; q: Prisma.Decimal }[]>`
      SELECT src_item_id AS id, SUM(q) AS q FROM (
        SELECT gri.gri_src_item_id AS src_item_id, (gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor AS q
          FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
         WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND gri.gri_src_doc_id = ${poId}::uuid AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED'
        UNION ALL
        SELECT pii.pii_src_item_id, pii.pii_billed_qty * pii.pii_to_base_factor
          FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
         WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND pii.pii_src_doc_id = ${poId}::uuid AND NOT pii.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED'
      ) x GROUP BY src_item_id`;
    return new Map(rows.map((r) => [r.id, D(r.q)]));
  }

  async get(poId: string, accYear: string) {
    const header = await this.prisma.purOrder.findFirst({ where: { poId, poAccYear: accYear, poIsDeleted: false } });
    if (!header) purNotFound(`Purchase order ${poId} not found`);
    const lines = await this.prisma.purOrderItem.findMany({ where: { poiPoId: poId, poiAccYear: accYear, poiIsDeleted: false }, orderBy: { poiLineNo: 'asc' } });
    const used = await this.usedQty(this.prisma, poId);
    const [sup] = await this.prisma.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.poSupplierId}::uuid`;
    return jsonSafe({
      header: { ...header, supplierName: sup?.sup_name ?? null },
      lines: lines.map((l) => {
        const f = l.poiToBaseFactor.isZero() ? D(1) : l.poiToBaseFactor;
        const received = (used.get(l.poiId) ?? ZERO).dividedBy(f).toDecimalPlaces(6);
        const pending = l.poiQty.minus(received).minus(l.poiShortClosedQty);
        return { ...l, receivedQty: received.toString(), pendingQty: (pending.isNegative() ? ZERO : pending).toString() };
      }),
    });
  }

  async cancel(dto: PurchaseOrderReasonDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
      if (!cur) purNotFound(`Purchase order ${dto.poId} not found`);
      const used = await this.usedQty(tx, dto.poId);
      if ([...used.values()].some((q) => q.greaterThan(0))) purConflict(`${cur.poRefno} has goods received against it — short-close the rest instead.`, PUR.NOT_DRAFT, 'poId');
      await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } }, data: { poStatus: 'CANCELLED', poModifiedBy: actor, poModifiedOn: new Date() } });
      await statusLog(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId, refno: cur.poRefno, event: TxnStatusEvent.CANCELLED, from: cur.poStatus, to: 'CANCELLED', actor, remarks: dto.reason });
    });
    return this.get(dto.poId, dto.accYear);
  }

  async shortClose(dto: PurchaseOrderReasonDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
      if (!cur) purNotFound(`Purchase order ${dto.poId} not found`);
      if (cur.poStatus !== 'POSTED') purConflict(`${cur.poRefno} is ${cur.poStatus} — only a confirmed PO is short-closed.`, PUR.NOT_POSTED, 'poId');
      const used = await this.usedQty(tx, dto.poId);
      const lines = await tx.purOrderItem.findMany({ where: { poiPoId: dto.poId, poiAccYear: dto.accYear, poiIsDeleted: false } });
      let closed = 0;
      for (const l of lines) {
        if (dto.lineIds?.length && !dto.lineIds.includes(l.poiId)) continue;
        const f = l.poiToBaseFactor.isZero() ? D(1) : l.poiToBaseFactor;
        const pending = l.poiQty.minus((used.get(l.poiId) ?? ZERO).dividedBy(f)).minus(l.poiShortClosedQty);
        if (!pending.greaterThan(0)) continue;
        await tx.purOrderItem.update({ where: { poiId_poiAccYear: { poiId: l.poiId, poiAccYear: dto.accYear } },
          data: { poiShortClosedQty: l.poiShortClosedQty.plus(pending), poiShortCloseReason: dto.reason, poiModifiedBy: actor, poiModifiedOn: new Date() } });
        closed++;
      }
      if (!closed) purConflict('Nothing is pending on this PO.', PUR.QTY_INVALID, 'poId');
      if (!dto.lineIds?.length) await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } }, data: { poIsShortClosed: true, poShortCloseReason: dto.reason, poModifiedBy: actor, poModifiedOn: new Date() } });
      await statusLog(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId, refno: cur.poRefno, event: TxnStatusEvent.CLOSED, from: cur.poStatus, to: cur.poStatus, actor, remarks: `Short-closed: ${dto.reason}` });
    });
    return this.get(dto.poId, dto.accYear);
  }

  /** A supplier's confirmed PO lines with qty still pending — offered on a GRN / bill. */
  async pendingLines(q: PendingPoLinesQueryDto) {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH used AS (
        SELECT gri.gri_src_item_id AS id, SUM((gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor) AS q
          FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
         WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED' GROUP BY 1
        UNION ALL
        SELECT pii.pii_src_item_id, SUM(pii.pii_billed_qty * pii.pii_to_base_factor)
          FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
         WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND NOT pii.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED' GROUP BY 1)
      SELECT po.po_id AS "poId", po.po_acc_year AS "accYear", po.po_refno AS "refno", po.po_doc_date AS "docDate",
             poi.poi_id AS "poiId", poi.poi_line_no AS "lineNo", poi.poi_item_id AS "itemId", im.item_name_en AS "itemName",
             poi.poi_uom_id AS "uomId", u.unit_name AS "unitName", poi.poi_rate AS "rate", poi.poi_disc_pct AS "discPct", poi.poi_sch_pct AS "schPct",
             poi.poi_tax_id AS "taxId", poi.poi_mrp AS "mrp", poi.poi_qty AS "orderedQty",
             poi.poi_qty - COALESCE((SELECT SUM(q) FROM used WHERE used.id = poi.poi_id), 0) / NULLIF(poi.poi_to_base_factor, 0) - poi.poi_short_closed_qty AS "pendingQty"
        FROM purchase.pur_order po
        JOIN purchase.pur_order_item poi ON poi.poi_po_id = po.po_id AND poi.poi_acc_year = po.po_acc_year AND NOT poi.poi_is_deleted
        JOIN inventory.item_master im ON im.item_id = poi.poi_item_id
        JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = poi.poi_uom_id
        JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE po.po_company_id = ${q.companyId}::uuid AND po.po_branch_id = ${q.branchId}::uuid AND po.po_supplier_id = ${q.supplierId}::uuid
         AND po.po_status = 'POSTED' AND NOT po.po_is_deleted
       ORDER BY po.po_doc_date, po.po_refno, poi.poi_line_no`;
    return jsonSafe(rows.filter((r) => D(r.pendingQty as Prisma.Decimal).greaterThan(0)));
  }
}

@ApiTags('Purchase — Order')
@ApiBearerAuth()
@Controller('purchase/orders')
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}

  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: PURCHASE_ORDER_MENU_ID, right, codePrefix: 'PO', action });
  }

  @Post('save') @Version(API_VERSION) @ApiOperation({ summary: 'Save a PO draft; header.post = true confirms it (open for GRNs / bills).' })
  async save(@Body() dto: SavePurchaseOrderDto) {
    await this.right(dto.header.poId ? 'edit' : 'create', 'save a purchase order');
    if (dto.header.post) await this.right('post', 'confirm a purchase order');
    const data = await this.service.save(dto);
    return { success: true, message: `Purchase order ${data.header.poRefno} ${dto.header.post ? 'confirmed' : 'saved'}`, data };
  }

  @Get('get') @Version(API_VERSION) @ApiOperation({ summary: 'A PO with received / pending per line (derived).' })
  async get(@Query() q: PurchaseOrderRefDto) {
    await this.right('view', 'open a purchase order');
    return { success: true, message: 'Purchase order fetched', data: await this.service.get(q.poId, q.accYear) };
  }

  @Get('pending-lines') @Version(API_VERSION) @ApiOperation({ summary: 'A supplier\'s confirmed PO lines with qty still pending.' })
  async pending(@Query() q: PendingPoLinesQueryDto) {
    await this.right('view', 'read pending purchase orders');
    return { success: true, message: 'Pending PO lines', data: await this.service.pendingLines(q) };
  }

  @Post('cancel') @Version(API_VERSION) @ApiOperation({ summary: 'Cancel a PO nothing has been received against.' })
  async cancel(@Body() dto: PurchaseOrderReasonDto) {
    await this.right('cancel', 'cancel a purchase order');
    const data = await this.service.cancel(dto);
    return { success: true, message: `Purchase order ${data.header.poRefno} cancelled`, data };
  }

  @Post('short-close') @Version(API_VERSION) @ApiOperation({ summary: 'Close what is still pending (all lines, or lineIds), with a reason.' })
  async shortClose(@Body() dto: PurchaseOrderReasonDto) {
    await this.right('edit', 'short-close a purchase order');
    const data = await this.service.shortClose(dto);
    return { success: true, message: `Purchase order ${data.header.poRefno} short-closed`, data };
  }
}
