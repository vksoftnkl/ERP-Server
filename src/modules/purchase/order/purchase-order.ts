import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { calcPurchase } from '../common/purchase-calc';
import { loadPurchaseSettings } from '../common/purchase-settings';
import { PUR, purConflict, purNotFound, purRefuse, purRefuseMany } from '../common/purchase.errors';
import {
  allocateDocNumber, D, isInterState, jsonSafe, unitNames, loadTaxRates, loadUnits, statusLog, supplierRow, TxnStatusDocType, TxnStatusEvent, ZERO,
} from '../common/purchase-doc.helpers';

/**
 * Purchase Order — menu 23 (plan §3.1). Posts nothing. "Post" CONFIRMS it (open
 * for GRNs / bills). Received / pending per line are DERIVED from the GRN and
 * bill lines whose src_* name it — never a counter (3.0 re-added qty on every save).
 *
 * DOC-01 (2026-10-28):
 *  - Amend: a confirmed PO is saved again in place — its line ids stay (GRN / bill
 *    lines point at them), po_revision_no + 1, the trail says AMENDED. A line may not
 *    drop below what has come in (received + short-closed), nor change its item / unit
 *    once anything came; a line that something came against cannot be removed.
 *  - Every save keeps the whole PO before and after (audit.audit_log, notes 89) —
 *    that is the revision history (GET /revisions).
 *  - Clone: a new draft with the lines of any PO. Merge: the PENDING of several
 *    confirmed POs of one supplier into one new draft; the sources are short-closed
 *    ("Merged into …") in the same transaction.
 *  - Approval (purchase.po_approval_above > 0): a PO confirmed above it waits
 *    (po_approval_status AWAITING) and feeds no GRN / bill until approved (OVERRIDE on
 *    menu 23); an amendment that raises the value above it asks again.
 *  - purchase.close_po_on_first_bill: closePosOnFirstBill(), called by the bill's post.
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
  @ApiPropertyOptional({ description: 'The line being changed (pur_order_item.poi_id) — an amendment keeps it; blank = a new line.' })
  @IsOptional() @IsUUID() lineId?: string;
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
  @ApiPropertyOptional({ description: 'Why a confirmed PO is amended (kept on the trail).' }) @IsOptional() @IsString() @MaxLength(250) amendReason?: string;
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
export class PurchaseOrderApproveDto extends PurchaseOrderRefDto {
  @ApiPropertyOptional({ description: 'false = reject (reason required). Default approve.' }) @IsOptional() @IsBoolean() approve?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) reason?: string;
}
export class ClonePurchaseOrderDto extends PurchaseOrderRefDto {
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiPropertyOptional({ description: 'The new PO\'s year (default the source\'s).' }) @IsOptional() @IsString() @MaxLength(9) toAccYear?: string;
  @ApiPropertyOptional({ description: 'Default today.' }) @IsOptional() @IsDateString() docDate?: string;
}
export class MergeSourceDto {
  @ApiProperty() @IsUUID() poId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}
export class MergePurchaseOrdersDto {
  @ApiProperty({ type: [MergeSourceDto] }) @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => MergeSourceDto) sources!: MergeSourceDto[];
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiPropertyOptional({ description: 'Default today.' }) @IsOptional() @IsDateString() docDate?: string;
}
export class PendingPoLinesQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
}

type Db = Prisma.TransactionClient | PrismaService;
const today = () => new Date().toISOString().slice(0, 10);
const PO_AUDIT = { screenName: 'purchase order', tableName: 'pur_order' } as const;

/** qty already received / billed per PO line (base units), from the lines whose src_* name it. */
export async function poUsedQty(tx: Db, poId: string) {
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

/** A PO waiting for approval (or refused) feeds no GRN / bill — called where a PO line is taken in. */
export async function assertPoApproved(tx: Db, poId: string) {
  const [po] = await tx.$queryRaw<{ po_refno: string; po_approval_status: string }[]>`
    SELECT po_refno, po_approval_status FROM purchase.pur_order WHERE po_id = ${poId}::uuid AND NOT po_is_deleted LIMIT 1`;
  if (po && (po.po_approval_status === 'AWAITING' || po.po_approval_status === 'REJECTED'))
    purConflict(`${po.po_refno} is ${po.po_approval_status === 'AWAITING' ? 'waiting for approval' : 'not approved'} — it cannot feed a GRN or a bill yet.`,
                'PUR_PO_NOT_APPROVED', 'lines.poItemId');
}

/** Short-close every pending line of a PO in this transaction; returns how many lines it closed. */
async function shortCloseIn(tx: Prisma.TransactionClient, poId: string, accYear: string, reason: string, actor: string, lineIds?: string[]) {
  const used = await poUsedQty(tx, poId);
  const lines = await tx.purOrderItem.findMany({ where: { poiPoId: poId, poiAccYear: accYear, poiIsDeleted: false } });
  let closed = 0;
  for (const l of lines) {
    if (lineIds?.length && !lineIds.includes(l.poiId)) continue;
    const f = l.poiToBaseFactor.isZero() ? D(1) : l.poiToBaseFactor;
    const pending = l.poiQty.minus((used.get(l.poiId) ?? ZERO).dividedBy(f)).minus(l.poiShortClosedQty);
    if (!pending.greaterThan(0)) continue;
    await tx.purOrderItem.update({ where: { poiId_poiAccYear: { poiId: l.poiId, poiAccYear: accYear } },
      data: { poiShortClosedQty: l.poiShortClosedQty.plus(pending), poiShortCloseReason: reason.slice(0, 250), poiModifiedBy: actor, poiModifiedOn: new Date() } });
    closed++;
  }
  return closed;
}

/**
 * purchase.close_po_on_first_bill — called by the purchase bill's post, in its transaction.
 * Each PO the bill draws on (its own PO lines, or the PO behind a GRN line it bills) that no
 * other posted bill has drawn on yet gets its unbilled rest short-closed. Returns notes for
 * the bill's answer.
 */
export async function closePosOnFirstBill(tx: Prisma.TransactionClient, a: { piId: string; accYear: string; companyId: string; branchId: string; refno: string; actor: string }) {
  const settings = await loadPurchaseSettings(tx, a.companyId, a.branchId);
  if (!settings.closePoOnFirstBill) return [] as { code: string; message: string; field: string }[];
  const pos = await tx.$queryRaw<{ po_id: string; po_acc_year: string; po_refno: string; po_company_id: string; po_branch_id: string; po_status: string }[]>`
    WITH mine AS (
      SELECT pii.pii_src_doc_id AS po_id FROM purchase.pur_invoice_item pii
       WHERE pii.pii_pi_id = ${a.piId}::uuid AND pii.pii_acc_year = ${a.accYear} AND pii.pii_src_doc_type = 'PURCHASE_ORDER' AND NOT pii.pii_is_deleted
      UNION
      SELECT gri.gri_src_doc_id FROM purchase.pur_invoice_item pii
        JOIN purchase.pur_grn_item gri ON gri.gri_id = pii.pii_src_item_id
       WHERE pii.pii_pi_id = ${a.piId}::uuid AND pii.pii_acc_year = ${a.accYear} AND pii.pii_src_doc_type = 'GRN' AND NOT pii.pii_is_deleted
         AND gri.gri_src_doc_type = 'PURCHASE_ORDER')
    SELECT po.po_id, po.po_acc_year, po.po_refno, po.po_company_id, po.po_branch_id, po.po_status
      FROM purchase.pur_order po JOIN mine ON mine.po_id = po.po_id
     WHERE po.po_status = 'POSTED' AND NOT po.po_is_deleted
       AND NOT EXISTS (
         SELECT 1 FROM purchase.pur_invoice p JOIN purchase.pur_invoice_item x ON x.pii_pi_id = p.pi_id AND x.pii_acc_year = p.pi_acc_year AND NOT x.pii_is_deleted
           LEFT JOIN purchase.pur_grn_item g2 ON x.pii_src_doc_type = 'GRN' AND g2.gri_id = x.pii_src_item_id
          WHERE p.pi_status = 'POSTED' AND NOT p.pi_is_deleted AND p.pi_id <> ${a.piId}::uuid
            AND ((x.pii_src_doc_type = 'PURCHASE_ORDER' AND x.pii_src_doc_id = po.po_id)
                 OR (g2.gri_src_doc_type = 'PURCHASE_ORDER' AND g2.gri_src_doc_id = po.po_id)))`;
  const notes: { code: string; message: string; field: string }[] = [];
  for (const po of pos) {
    const reason = `Closed on its first bill ${a.refno} (purchase.close_po_on_first_bill)`;
    const n = await shortCloseIn(tx, po.po_id, po.po_acc_year, reason, a.actor);
    if (!n) continue;
    await tx.purOrder.update({ where: { poId_poAccYear: { poId: po.po_id, poAccYear: po.po_acc_year } },
      data: { poIsShortClosed: true, poShortCloseReason: reason.slice(0, 250), poModifiedBy: a.actor, poModifiedOn: new Date() } });
    await statusLog(tx, { companyId: po.po_company_id, branchId: po.po_branch_id, accYear: po.po_acc_year, docType: TxnStatusDocType.PURCHASE_ORDER, docId: po.po_id,
      refno: po.po_refno, event: TxnStatusEvent.CLOSED, from: 'POSTED', to: 'POSTED', actor: a.actor, remarks: reason });
    notes.push({ code: 'PUR_PO_CLOSED_ON_FIRST_BILL', field: 'header', message: `${po.po_refno}: the rest (${n} line${n === 1 ? '' : 's'}) is short-closed — first bill of the PO.` });
  }
  return notes;
}

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService, private readonly audit: AuditLogService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }

  /** The money of a PO as the server figures it — the same calc save uses, nothing written. */
  private async compute(tx: Prisma.TransactionClient | PrismaService, dto: SavePurchaseOrderDto) {
    const h = dto.header;
    const sup = await supplierRow(tx as Prisma.TransactionClient, h.supplierId);
    const inter = await isInterState(tx as Prisma.TransactionClient, h.branchId, sup);
    const units = await loadUnits(tx as Prisma.TransactionClient, dto.lines.map((l) => l.uomId));
    const problems = dto.lines.flatMap((l, i) => {
      const u = units.get(l.uomId);
      return !u || u.iuc_item_id !== l.itemId ? [{ field: `lines.${i}.uomId`, code: PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: unit not found for the item` }] : [];
    });
    if (problems.length) purRefuseMany(problems[0].message, problems);
    for (const l of dto.lines) if (!l.taxId) l.taxId = units.get(l.uomId)?.item_default_tax_id ?? undefined;
    const taxes = await loadTaxRates(tx as Prisma.TransactionClient, dto.lines.map((l) => l.taxId));
    const calc = calcPurchase({
      interState: inter, roundOffStep: 0,
      lines: dto.lines.map((l) => ({ key: String(l.lineNo), billedQty: l.qty, freeQty: l.freeQty ?? 0, rate: l.rate, discPct: l.discPct, schPct: l.schPct,
        gstPct: l.taxId ? taxes.get(l.taxId)?.tax_rate_perc ?? 0 : 0, toBaseFactor: units.get(l.uomId)!.iuc_to_base_factor, weight: l.weight ?? 0 })),
    });
    return { sup, units, calc };
  }

  async preview(dto: SavePurchaseOrderDto) {
    const { calc } = await this.compute(this.prisma, dto);
    const tax = calc.cgst.plus(calc.sgst).plus(calc.igst).plus(calc.cess);
    return jsonSafe({
      lines: calc.lines.map((o) => ({ key: o.key, gross: o.gross, discAmt: o.discAmt, taxable: o.taxable, gstPct: o.gstPct, tax: o.cgst.plus(o.sgst).plus(o.igst).plus(o.cess), total: o.total })),
      totals: { gross: calc.gross, taxable: calc.taxable, tax, net: calc.taxable.plus(tax) },
    });
  }

  async save(dto: SavePurchaseOrderDto) {
    const actor = this.actor();
    const id = await this.prisma.$transaction(async (tx) => this.saveIn(tx, dto, actor), { timeout: 60000, maxWait: 10000 });
    return this.get(id, dto.header.accYear);
  }

  /** The save, inside a transaction — create / edit a draft, confirm, or amend a confirmed PO. */
  async saveIn(tx: Prisma.TransactionClient, dto: SavePurchaseOrderDto, actor: string, opts: { auditNote?: string } = {}) {
    const h = dto.header;
    const { sup, units, calc } = await this.compute(tx, dto);
    let poId = h.poId ?? null;
    let slno: bigint, refno: string, isNew = false;
    let cur: Awaited<ReturnType<typeof tx.purOrder.findFirst>> = null;
    let before: unknown = null;
    if (poId) {
      cur = await tx.purOrder.findFirst({ where: { poId, poAccYear: h.accYear, poIsDeleted: false } });
      if (!cur) purNotFound(`Purchase order ${poId} not found`);
      if (cur.poStatus === 'CANCELLED') purConflict(`${cur.poRefno} is cancelled.`, PUR.NOT_DRAFT, 'poId');
      // lock the PO row: two saves of one PO queue up
      await tx.$executeRaw`SELECT 1 FROM purchase.pur_order WHERE po_id = ${poId}::uuid AND po_acc_year = ${h.accYear} FOR UPDATE`;
      before = await this.getDoc(tx, poId, h.accYear);
      slno = cur.poSlno; refno = cur.poRefno;
    } else {
      ({ slno, refno } = await allocateDocNumber(tx, 'PO', h.companyId, h.branchId, h.accYear, h.deviceId));
      isNew = true;
    }
    const amending = cur?.poStatus === 'POSTED';
    const tax = calc.cgst.plus(calc.sgst).plus(calc.igst).plus(calc.cess);
    const net = calc.taxable.plus(tax);
    const confirming = !amending && !!h.post;
    // approval: purchase.po_approval_above (0 = off)
    const settings = await loadPurchaseSettings(tx, h.companyId, h.branchId);
    const limit = D(settings.poApprovalAbove ?? 0);
    let approval = cur?.poApprovalStatus ?? 'NOT_REQUIRED';
    if (confirming) approval = limit.greaterThan(0) && net.greaterThan(limit) ? 'AWAITING' : 'NOT_REQUIRED';
    if (amending) {
      const above = limit.greaterThan(0) && net.greaterThan(limit);
      if (!above) approval = 'NOT_REQUIRED';
      else if (approval !== 'APPROVED' || net.greaterThan(cur!.poNetAmt)) approval = 'AWAITING';   // a rise asks again
    }
    const data = {
      poCompanyId: h.companyId, poBranchId: h.branchId, poAccYear: h.accYear, poDeviceId: h.deviceId, poSlno: slno, poRefno: refno,
      poDocDate: new Date(`${h.docDate}T00:00:00Z`), poSupplierId: h.supplierId, poExpectedDate: h.expectedDate ? new Date(`${h.expectedDate}T00:00:00Z`) : null,
      poDeliverGodownId: h.godownId ?? null, poContact: h.contact ?? null, poCreditDays: h.creditDays ?? sup.sup_credit_days ?? null,
      poTermsText: h.termsText ?? null, poGrossAmt: calc.gross, poTaxableAmt: calc.taxable, poTaxAmt: tax, poNetAmt: net,
      poRemarks: h.remarks ?? null, poStatus: amending ? 'POSTED' : h.post ? 'POSTED' : 'DRAFT', poApprovalStatus: approval,
    };
    if (amending && cur!.poSupplierId !== h.supplierId) {
      const used0 = await poUsedQty(tx, poId!);
      if ([...used0.values()].some((q) => q.greaterThan(0))) purConflict(`${refno}: goods came from this supplier — the supplier cannot change now.`, PUR.NOT_DRAFT, 'header.supplierId');
    }
    if (isNew) poId = (await tx.purOrder.create({ data: { ...data, poCreatedBy: actor }, select: { poId: true } })).poId;
    else await tx.purOrder.update({ where: { poId_poAccYear: { poId: poId!, poAccYear: h.accYear } },
      data: { ...data, poModifiedBy: actor, poModifiedOn: new Date(), ...(amending ? { poRevisionNo: { increment: 1 } } : {}) } });

    const lineData = (i: number) => {
      const l = dto.lines[i], o = calc.lines[i], u = units.get(l.uomId)!;
      return {
        poiLineNo: l.lineNo, poiItemId: l.itemId, poiUomId: l.uomId, poiBaseUomId: u.base_iuc_id, poiToBaseFactor: u.iuc_to_base_factor, poiHsnCode: u.item_hsn_code,
        poiWeight: l.weight ?? null, poiQty: D(l.qty), poiFreeQty: D(l.freeQty), poiRate: D(l.rate), poiDiscPct: D(l.discPct), poiDiscAmt: o.discAmt,
        poiSchPct: D(l.schPct), poiSchAmt: o.schAmt, poiGrossAmt: o.gross, poiTaxableAmt: o.taxable, poiTaxId: l.taxId ?? null, poiGstPct: o.gstPct,
        poiCgstAmt: o.cgst, poiSgstAmt: o.sgst, poiIgstAmt: o.igst, poiCessAmt: o.cess, poiTotalAmt: o.total, poiMrp: l.mrp ?? null,
        poiRemarks: l.remarks ?? null,
      };
    };
    if (!amending) {
      if (!isNew) await tx.purOrderItem.deleteMany({ where: { poiPoId: poId!, poiAccYear: h.accYear } });
      for (let i = 0; i < dto.lines.length; i++)
        await tx.purOrderItem.create({ data: { ...lineData(i), poiPoId: poId!, poiCompanyId: h.companyId, poiBranchId: h.branchId, poiAccYear: h.accYear, poiCreatedBy: actor } });
    } else {
      // DOC-01 amendment: lines kept by id — GRN / bill lines point at them
      const used = await poUsedQty(tx, poId!);
      const existing = await tx.purOrderItem.findMany({ where: { poiPoId: poId!, poiAccYear: h.accYear, poiIsDeleted: false } });
      const byId = new Map(existing.map((e) => [e.poiId, e]));
      const kept = new Set<string>();
      const problems: { field: string; code: string; message: string }[] = [];
      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i];
        const e = l.lineId ? byId.get(l.lineId) : undefined;
        if (l.lineId && !e) { problems.push({ field: `lines.${i}.lineId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: not a line of ${refno}` }); continue; }
        if (!e) continue;
        kept.add(e.poiId);
        const f = e.poiToBaseFactor.isZero() ? D(1) : e.poiToBaseFactor;
        const came = (used.get(e.poiId) ?? ZERO).dividedBy(f);
        if (came.greaterThan(0) && (e.poiItemId !== l.itemId || e.poiUomId !== l.uomId))
          problems.push({ field: `lines.${i}.itemId`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: goods came against it — its item and unit cannot change` });
        const floor = came.plus(e.poiShortClosedQty);
        if (D(l.qty).lessThan(floor))
          problems.push({ field: `lines.${i}.qty`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: ${floor.toDecimalPlaces(3)} already received / closed — the qty cannot go below it` });
      }
      for (const e of existing) {
        if (kept.has(e.poiId)) continue;
        if ((used.get(e.poiId) ?? ZERO).greaterThan(0))
          problems.push({ field: 'lines', code: PUR.QTY_INVALID, message: `Line ${e.poiLineNo}: goods came against it — it cannot be removed (short-close it instead)` });
      }
      if (problems.length) purRefuseMany(problems[0].message, problems);
      for (const e of existing) if (!kept.has(e.poiId)) await tx.purOrderItem.delete({ where: { poiId_poiAccYear: { poiId: e.poiId, poiAccYear: h.accYear } } });
      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i];
        if (l.lineId) await tx.purOrderItem.update({ where: { poiId_poiAccYear: { poiId: l.lineId, poiAccYear: h.accYear } }, data: { ...lineData(i), poiModifiedBy: actor, poiModifiedOn: new Date() } });
        else await tx.purOrderItem.create({ data: { ...lineData(i), poiPoId: poId!, poiCompanyId: h.companyId, poiBranchId: h.branchId, poiAccYear: h.accYear, poiCreatedBy: actor } });
      }
    }
    const log = (event: TxnStatusEvent, from: string | null, to: string, remarks?: string) =>
      statusLog(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: poId!, refno, event, from, to, actor, deviceId: h.deviceId, remarks });
    if (isNew) await log(TxnStatusEvent.CREATED, null, 'DRAFT', opts.auditNote);
    if (confirming) await log(TxnStatusEvent.POSTED, 'DRAFT', 'POSTED');
    if (amending) await log(TxnStatusEvent.AMENDED, 'POSTED', 'POSTED', `Revision ${(cur!.poRevisionNo ?? 1) + 1}${h.amendReason ? `: ${h.amendReason}` : ''}`.slice(0, 250));
    if ((confirming || amending) && approval === 'AWAITING' && cur?.poApprovalStatus !== 'AWAITING')
      await log(TxnStatusEvent.SUBMITTED, 'POSTED', 'POSTED', `Waiting for approval — PO value ${net.toFixed(2)} is above ${limit.toFixed(2)}`);
    // notes 89: the whole PO before / after this save — the revision history
    const after = await this.getDoc(tx, poId!, h.accYear);
    await this.audit.logDocumentRevision({ ...PO_AUDIT, docId: poId!, displayName: refno, before, after, userId: actor, branchId: h.branchId, deviceId: h.deviceId,
      notes: opts.auditNote ?? (amending ? `Amended (revision ${(cur!.poRevisionNo ?? 1) + 1})${h.amendReason ? ` — ${h.amendReason}` : ''}` : isNew ? 'Created' : 'Saved') + (confirming ? ' and confirmed' : '') }, tx);
    return poId!;
  }

  async get(poId: string, accYear: string) {
    return this.getDoc(this.prisma, poId, accYear);
  }

  /** A PO in the /get shape, from any client (a save reads it inside its transaction for the audit snapshot). */
  private async getDoc(db: Db, poId: string, accYear: string) {
    const header = await db.purOrder.findFirst({ where: { poId, poAccYear: accYear, poIsDeleted: false } });
    if (!header) purNotFound(`Purchase order ${poId} not found`);
    const lines = await db.purOrderItem.findMany({ where: { poiPoId: poId, poiAccYear: accYear, poiIsDeleted: false }, orderBy: { poiLineNo: 'asc' } });
    const used = await poUsedQty(db, poId);
    const [sup] = await db.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.poSupplierId}::uuid`;
    const names = await unitNames(db as never, lines.map((l) => l.poiUomId));
    // approval: who / when, from the trail (no columns of its own)
    const [appr] = header.poApprovalStatus === 'APPROVED' || header.poApprovalStatus === 'REJECTED' ? await db.$queryRaw<{ by: string | null; on: Date; remarks: string | null }[]>`
      SELECT COALESCE(u.usr_login_name, t.tsl_changed_by::text) AS by, t.tsl_changed_on AS on, t.tsl_remarks AS remarks
        FROM public.txn_status_log t LEFT JOIN public.user_master u ON u.usr_id = t.tsl_changed_by
       WHERE t.tsl_src_doc_id = ${poId}::uuid AND t.tsl_event IN ('APPROVED', 'REJECTED') AND NOT t.tsl_is_deleted
       ORDER BY t.tsl_seq_no DESC LIMIT 1` : [];
    return jsonSafe({
      header: { ...header, supplierName: sup?.sup_name ?? null, approvedBy: appr?.by ?? null, approvedOn: appr?.on ?? null, approvalRemarks: appr?.remarks ?? null },
      lines: lines.map((l) => {
        const f = l.poiToBaseFactor.isZero() ? D(1) : l.poiToBaseFactor;
        const received = (used.get(l.poiId) ?? ZERO).dividedBy(f).toDecimalPlaces(6);
        const pending = l.poiQty.minus(received).minus(l.poiShortClosedQty);
        return { ...l, ...names.get(l.poiUomId), receivedQty: received.toString(), pendingQty: (pending.isNegative() ? ZERO : pending).toString() };
      }),
    });
  }

  async cancel(dto: PurchaseOrderReasonDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
      if (!cur) purNotFound(`Purchase order ${dto.poId} not found`);
      const used = await poUsedQty(tx, dto.poId);
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
      const closed = await shortCloseIn(tx, dto.poId, dto.accYear, dto.reason, actor, dto.lineIds);
      if (!closed) purConflict('Nothing is pending on this PO.', PUR.QTY_INVALID, 'poId');
      if (!dto.lineIds?.length) await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } }, data: { poIsShortClosed: true, poShortCloseReason: dto.reason, poModifiedBy: actor, poModifiedOn: new Date() } });
      await statusLog(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId, refno: cur.poRefno, event: TxnStatusEvent.CLOSED, from: cur.poStatus, to: cur.poStatus, actor, remarks: `Short-closed: ${dto.reason}` });
    });
    return this.get(dto.poId, dto.accYear);
  }

  /** Approve (or reject) a PO waiting for approval — OVERRIDE on menu 23. Who / when stay on the trail. */
  async approve(dto: PurchaseOrderApproveDto) {
    const actor = this.actor();
    const approve = dto.approve !== false;
    if (!approve && !dto.reason?.trim()) purRefuse('Say why the PO is not approved.', PUR.QTY_INVALID, 'reason');
    await this.prisma.$transaction(async (tx) => {
      const cur = await tx.purOrder.findFirst({ where: { poId: dto.poId, poAccYear: dto.accYear, poIsDeleted: false } });
      if (!cur) purNotFound(`Purchase order ${dto.poId} not found`);
      if (cur.poStatus !== 'POSTED' || cur.poApprovalStatus !== 'AWAITING')
        purConflict(`${cur.poRefno} is not waiting for approval.`, 'PUR_PO_NOT_AWAITING', 'poId');
      await tx.purOrder.update({ where: { poId_poAccYear: { poId: dto.poId, poAccYear: dto.accYear } },
        data: { poApprovalStatus: approve ? 'APPROVED' : 'REJECTED', poModifiedBy: actor, poModifiedOn: new Date() } });
      await statusLog(tx, { companyId: cur.poCompanyId, branchId: cur.poBranchId, accYear: dto.accYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: dto.poId,
        refno: cur.poRefno, event: approve ? TxnStatusEvent.APPROVED : TxnStatusEvent.REJECTED, from: 'POSTED', to: 'POSTED', actor,
        remarks: (dto.reason?.trim() || (approve ? `Approved at ${cur.poNetAmt.toFixed(2)}` : '')).slice(0, 250) });
    });
    return this.get(dto.poId, dto.accYear);
  }

  /** A new draft with the lines of any PO (qty as ordered), today's date. */
  async clone(dto: ClonePurchaseOrderDto) {
    const actor = this.actor();
    const src = await this.getDoc(this.prisma, dto.poId, dto.accYear) as unknown as { header: Record<string, unknown>; lines: Record<string, unknown>[] };
    const h = src.header;
    const save: SavePurchaseOrderDto = {
      header: { companyId: String(h.poCompanyId), branchId: String(h.poBranchId), accYear: dto.toAccYear ?? dto.accYear, deviceId: dto.deviceId,
                supplierId: String(h.poSupplierId), docDate: dto.docDate ?? today(), godownId: (h.poDeliverGodownId as string | null) ?? undefined,
                creditDays: (h.poCreditDays as number | null) ?? undefined, contact: (h.poContact as string | null) ?? undefined,
                termsText: (h.poTermsText as string | null) ?? undefined, remarks: `Copy of ${h.poRefno}`.slice(0, 500) },
      lines: src.lines.map((l, i) => ({ lineNo: i + 1, itemId: String(l.poiItemId), uomId: String(l.poiUomId), qty: Number(l.poiQty), freeQty: Number(l.poiFreeQty ?? 0),
        rate: Number(l.poiRate), discPct: Number(l.poiDiscPct ?? 0), schPct: Number(l.poiSchPct ?? 0), taxId: (l.poiTaxId as string | null) ?? undefined,
        mrp: l.poiMrp != null ? Number(l.poiMrp) : undefined, weight: l.poiWeight != null ? Number(l.poiWeight) : undefined, remarks: (l.poiRemarks as string | null) ?? undefined })),
    };
    const id = await this.prisma.$transaction(async (tx) => this.saveIn(tx, save, actor, { auditNote: `Cloned from ${h.poRefno}` }), { timeout: 60000, maxWait: 10000 });
    return this.get(id, save.header.accYear);
  }

  /**
   * The PENDING of several confirmed POs of one supplier → one new draft. Lines of the same item,
   * unit, rate, discounts and tax are added together. The sources' pending is short-closed
   * "Merged into …" in the same transaction, so nothing is ordered twice.
   */
  async merge(dto: MergePurchaseOrdersDto) {
    const actor = this.actor();
    const keys = new Set(dto.sources.map((x) => `${x.poId}|${x.accYear}`));
    if (keys.size < 2) purRefuse('Pick at least two different purchase orders to merge.', PUR.QTY_INVALID, 'sources');
    const id = await this.prisma.$transaction(async (tx) => {
      const srcs = [];
      for (const x of dto.sources) {
        const po = await tx.purOrder.findFirst({ where: { poId: x.poId, poAccYear: x.accYear, poIsDeleted: false } });
        if (!po) purNotFound(`Purchase order ${x.poId} not found`);
        if (po.poStatus !== 'POSTED') purConflict(`${po.poRefno} is ${po.poStatus} — only confirmed orders are merged.`, PUR.NOT_POSTED, 'sources');
        srcs.push(po);
      }
      const first = srcs[0];
      for (const po of srcs) {
        if (po.poSupplierId !== first.poSupplierId) purConflict(`${po.poRefno} is from another supplier — merge one supplier's orders only.`, 'PUR_SUPPLIER_MISMATCH', 'sources');
        if (po.poCompanyId !== first.poCompanyId || po.poBranchId !== first.poBranchId) purConflict(`${po.poRefno} is from another branch.`, 'PUR_BRANCH_MISMATCH', 'sources');
      }
      type Acc = { itemId: string; uomId: string; qty: Prisma.Decimal; rate: Prisma.Decimal; discPct: Prisma.Decimal; schPct: Prisma.Decimal; taxId: string | null; mrp: Prisma.Decimal | null; weight: Prisma.Decimal | null };
      const merged = new Map<string, Acc>();
      for (const po of srcs) {
        const used = await poUsedQty(tx, po.poId);
        const lines = await tx.purOrderItem.findMany({ where: { poiPoId: po.poId, poiAccYear: po.poAccYear, poiIsDeleted: false }, orderBy: { poiLineNo: 'asc' } });
        for (const l of lines) {
          const f = l.poiToBaseFactor.isZero() ? D(1) : l.poiToBaseFactor;
          const pending = l.poiQty.minus((used.get(l.poiId) ?? ZERO).dividedBy(f)).minus(l.poiShortClosedQty);
          if (!pending.greaterThan(0)) continue;
          const k = [l.poiItemId, l.poiUomId, l.poiRate.toString(), l.poiDiscPct.toString(), l.poiSchPct.toString(), l.poiTaxId ?? ''].join('|');
          const a = merged.get(k);
          if (a) a.qty = a.qty.plus(pending);
          else merged.set(k, { itemId: l.poiItemId, uomId: l.poiUomId, qty: pending, rate: l.poiRate, discPct: l.poiDiscPct, schPct: l.poiSchPct, taxId: l.poiTaxId, mrp: l.poiMrp, weight: l.poiWeight });
        }
      }
      if (!merged.size) purConflict('Nothing is pending on these orders.', PUR.QTY_INVALID, 'sources');
      const refs = srcs.map((p) => p.poRefno);
      const save: SavePurchaseOrderDto = {
        header: { companyId: first.poCompanyId, branchId: first.poBranchId, accYear: dto.accYear, deviceId: dto.deviceId, supplierId: first.poSupplierId,
                  docDate: dto.docDate ?? today(), godownId: first.poDeliverGodownId ?? undefined, creditDays: first.poCreditDays ?? undefined,
                  remarks: `Merged from ${refs.join(', ')}`.slice(0, 500) },
        lines: [...merged.values()].map((a, i) => ({ lineNo: i + 1, itemId: a.itemId, uomId: a.uomId, qty: Number(a.qty.toDecimalPlaces(6)), rate: Number(a.rate),
          discPct: Number(a.discPct), schPct: Number(a.schPct), taxId: a.taxId ?? undefined, mrp: a.mrp != null ? Number(a.mrp) : undefined, weight: a.weight != null ? Number(a.weight) : undefined })),
      };
      const newId = await this.saveIn(tx, save, actor, { auditNote: `Merged from ${refs.join(', ')}` });
      const [nw] = await tx.$queryRaw<{ po_refno: string }[]>`SELECT po_refno FROM purchase.pur_order WHERE po_id = ${newId}::uuid`;
      for (const po of srcs) {
        const reason = `Merged into ${nw.po_refno}`;
        await shortCloseIn(tx, po.poId, po.poAccYear, reason, actor);
        await tx.purOrder.update({ where: { poId_poAccYear: { poId: po.poId, poAccYear: po.poAccYear } }, data: { poIsShortClosed: true, poShortCloseReason: reason, poModifiedBy: actor, poModifiedOn: new Date() } });
        await statusLog(tx, { companyId: po.poCompanyId, branchId: po.poBranchId, accYear: po.poAccYear, docType: TxnStatusDocType.PURCHASE_ORDER, docId: po.poId, refno: po.poRefno,
          event: TxnStatusEvent.CLOSED, from: 'POSTED', to: 'POSTED', actor, deviceId: dto.deviceId, remarks: reason });
      }
      return newId;
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(id, dto.accYear);
  }

  /** The PO's saved versions, newest first (audit.audit_log, one row per save — notes 89). */
  async revisions(poId: string) {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT l.log_rev_no AS "revNo", l.log_date AS "savedOn", l.log_action::text AS "action", l.log_notes AS "notes",
             COALESCE(u.usr_login_name, l.log_user_id::text) AS "savedBy", l.log_original_record AS "before", l.log_modified_record AS "after"
        FROM audit.audit_log l LEFT JOIN public.user_master u ON u.usr_id = l.log_user_id
       WHERE l.log_table_name = 'pur_order' AND l.log_pk = ${poId} AND l.log_rev_no IS NOT NULL
       ORDER BY l.log_rev_no DESC`;
    return jsonSafe(rows);
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
         AND po.po_status = 'POSTED' AND NOT po.po_is_deleted AND po.po_approval_status NOT IN ('AWAITING', 'REJECTED')
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
    if (dto.header.poId) {
      const [cur] = await this.prisma.$queryRaw<{ po_status: string }[]>`SELECT po_status FROM purchase.pur_order WHERE po_id = ${dto.header.poId}::uuid AND po_acc_year = ${dto.header.accYear}`;
      if (cur?.po_status === 'POSTED') await this.right('amend', 'amend a confirmed purchase order');
    }
    const data = await this.service.save(dto);
    return { success: true, message: `Purchase order ${data.header.poRefno} ${dto.header.post ? 'confirmed' : 'saved'}`, data };
  }

  @Post('validate') @Version(API_VERSION) @ApiOperation({ summary: 'The server\'s figures for a PO being keyed — line taxable / tax / total and the totals. Writes nothing.' })
  async validate(@Body() dto: SavePurchaseOrderDto) {
    await this.right('view', 'check a purchase order');
    return { success: true, message: 'Purchase order calculated', data: await this.service.preview(dto) };
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

  @Post('approve') @Version(API_VERSION) @ApiOperation({ summary: 'Approve (approve:false = reject, with a reason) a PO waiting for approval — purchase.po_approval_above.' })
  async approve(@Body() dto: PurchaseOrderApproveDto) {
    await this.right('override', 'approve a purchase order');
    const data = await this.service.approve(dto);
    return { success: true, message: `Purchase order ${data.header.poRefno} ${dto.approve === false ? 'not approved' : 'approved'}`, data };
  }

  @Post('clone') @Version(API_VERSION) @ApiOperation({ summary: 'A new draft PO with the lines of this one (DOC-01).' })
  async clone(@Body() dto: ClonePurchaseOrderDto) {
    await this.right('create', 'copy a purchase order');
    const data = await this.service.clone(dto);
    return { success: true, message: `Purchase order ${data.header.poRefno} made from the copy`, data };
  }

  @Post('merge') @Version(API_VERSION) @ApiOperation({ summary: 'The pending of several confirmed POs of one supplier → one new draft; the sources are short-closed (DOC-01).' })
  async merge(@Body() dto: MergePurchaseOrdersDto) {
    await this.right('create', 'merge purchase orders');
    await this.right('edit', 'short-close the merged purchase orders');
    const data = await this.service.merge(dto);
    return { success: true, message: `Purchase order ${data.header.poRefno} made from ${dto.sources.length} orders`, data };
  }

  @Get('revisions') @Version(API_VERSION) @ApiOperation({ summary: 'Every saved version of a PO, newest first, before / after (audit log).' })
  async revisions(@Query() q: PurchaseOrderRefDto) {
    await this.right('view', 'read the history of a purchase order');
    return { success: true, message: 'Purchase order revisions', data: await this.service.revisions(q.poId) };
  }
}
