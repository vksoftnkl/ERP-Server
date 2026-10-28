import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { VoucherPostingService } from 'src/common/posting/voucher-posting.service';
import type { VoucherLeg } from 'src/common/posting/voucher-leg.types';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockPostingService } from 'src/modules/stocks/posting/stock-posting.service';
import { PUR, purConflict, purNotFound, purRefuse, purRefuseMany } from '../common/purchase.errors';
import {
  allocateDocNumber, assertBillsUnsettled, cancelShadowStock, D, dateOf, isoDate, jsonSafe, num2, postShadowStock, r2, raiseBillRow, statusLog,
  stockRules, TxnStatusDocType, TxnStatusEvent, unitNames, voucherTypeId, withdrawBillRows, ZERO,
} from '../common/purchase-doc.helpers';

/**
 * Shortages (menu 195) — plan-purchase-backend.md B7.
 *
 * A shortage row (pur_shortage) is opened by a bill (SHORT_BILL: billed, not
 * received — value + GST parked), a GRN (SHORT_CHALLAN: the challan said more —
 * qty only, nothing booked) or a return (REPLACE: goods sent back, the same due —
 * value parked, its GST still claimed). Its OPEN qty is derived: qty − received
 * (Shortage Receipt lines) − closed (pur_shortage_close, reversals negative).
 *
 * Shortage Receipt — the goods arrive: stock in at the shortage's own cost, and
 *   SHORT_BILL      Dr Stock / Cr Shortage receivable; Dr Input GST / Cr Input GST pending
 *   REPLACE         Dr Stock / Cr Shortage receivable
 *   SHORT_CHALLAN   Dr Stock / Cr GRNI (the bill will clear it, like the rest of the GRN)
 * Close without goods:
 *   SUPPLIER_CN     the supplier's credit note: Dr Supplier (bill-wise) / Cr Shortage receivable (+ the GST)
 *   WRITE_OFF       Dr Write-off / Cr Shortage receivable (+ the GST, which is lost)
 *   (a SHORT_CHALLAN close is qty only — nothing was booked for it)
 * Money moves in proportion to qty; the piece that empties a shortage takes the remainder,
 * so a shortage always clears to the paisa.
 */
export const SHORTAGE_MENU_ID = 195;
const DOC = 'SHORTAGE_RECEIPT';
const CLOSE_DOC = 'SHORTAGE_CLOSE';

export class ShortageReceiptLineDto {
  @ApiProperty() @IsInt() @Min(1) lineNo!: number;
  @ApiProperty() @IsUUID() shortageId!: string;
  @ApiProperty() @IsString() @MaxLength(9) shortageAccYear!: string;
  @ApiProperty({ description: 'In the item\'s BASE unit (a shortage is kept in base units).' }) @IsNumber() @Min(0) qty!: number;
  @ApiPropertyOptional({ description: 'Default: the batch the shortage\'s source line came in.' }) @IsOptional() @IsString() @MaxLength(40) batchNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() mrp?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remarks?: string;
}
export class ShortageReceiptHeaderDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() psrId?: string;
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiProperty() @IsUUID() godownId!: string;
  @ApiProperty() @IsDateString() docDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) challanNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('all', { each: true }) receivedBy?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() post?: boolean;
}
export class SaveShortageReceiptDto {
  @ApiProperty({ type: ShortageReceiptHeaderDto }) @ValidateNested() @Type(() => ShortageReceiptHeaderDto) header!: ShortageReceiptHeaderDto;
  @ApiProperty({ type: [ShortageReceiptLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ShortageReceiptLineDto) lines!: ShortageReceiptLineDto[];
}
export class ShortageReceiptRefDto {
  @ApiProperty() @IsUUID() psrId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}
export class ShortageReceiptCancelDto extends ShortageReceiptRefDto {
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
}
export class OpenShortagesQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supplierId?: string;
  @ApiPropertyOptional({ description: 'Also rows with nothing open (history).' }) @IsOptional() @IsIn(['true', 'false']) all?: string;
}
export class CloseShortageDto {
  @ApiProperty() @IsUUID() shortageId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiPropertyOptional({ description: 'The close row\'s own year (default: the shortage\'s).' }) @IsOptional() @IsString() @MaxLength(9) closeAccYear?: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty({ enum: ['SUPPLIER_CN', 'WRITE_OFF'] }) @IsIn(['SUPPLIER_CN', 'WRITE_OFF']) kind!: string;
  @ApiPropertyOptional({ description: 'Base units; default the whole open qty.' }) @IsOptional() @IsNumber() @Min(0) qty?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) cnNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() cnDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() docDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) reason?: string;
}
export class CloseUndoDto {
  @ApiProperty() @IsUUID() closeId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
}

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;
interface TaxHead { role: string; amt: Prisma.Decimal; taxId: string | null }
/** What one shortage row is: its qty, money, GST heads, cost and the lot identity it came in as. */
interface ShortageFacts {
  id: string; accYear: string; companyId: string; branchId: string; supplierId: string; itemId: string; reason: string; srcRefno: string | null;
  qtyBase: Prisma.Decimal; value: Prisma.Decimal; gst: Prisma.Decimal; heads: TaxHead[]; inter: boolean;
  costRate: Prisma.Decimal; baseUomId: string; hsn: string | null;
  received: Prisma.Decimal; closed: Prisma.Decimal; open: Prisma.Decimal;
  valueUsed: Prisma.Decimal; gstUsed: Prisma.Decimal;
  batchNo: string | null; expiry: Date | null; mrp: Prisma.Decimal | null;
}

@Injectable()
export class PurchaseShortageService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService,
              private readonly vouchers: VoucherPostingService, private readonly stockPosting: StockPostingService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }
  private rules() { return stockRules('IN', DOC, 'Shortage Receipt', 'PURCHASE', TxnStatusDocType.SHORTAGE_RECEIPT); }

  // ── one shortage's facts ──────────────────────────────────────────────
  /** `postedOnly`: received = posted receipts only (the money view, at post); else drafts reserve their qty too (the save check). */
  private async facts(db: Db, ids: string[], exceptPsrId?: string | null, postedOnly = false): Promise<Map<string, ShortageFacts>> {
    if (!ids.length) return new Map();
    const live = postedOnly ? Prisma.sql`r.psr_status = 'POSTED'` : Prisma.sql`r.psr_status <> 'CANCELLED'`;
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT s.psh_id, s.psh_acc_year, s.psh_company_id, s.psh_branch_id, s.psh_supplier_id, s.psh_item_id, s.psh_reason, s.psh_src_doc_refno,
             s.psh_src_doc_type, s.psh_src_item_id, s.psh_qty_base, COALESCE(s.psh_value, 0) AS value, COALESCE(s.psh_gst_pending, 0) AS gst,
             COALESCE(s.psh_origin_cost_rate, 0) AS origin_rate,
             COALESCE(pii.pii_cgst_amt, pri.pri_cgst_amt, 0) AS cgst, COALESCE(pii.pii_sgst_amt, pri.pri_sgst_amt, 0) AS sgst,
             COALESCE(pii.pii_igst_amt, pri.pri_igst_amt, 0) AS igst, COALESCE(pii.pii_cess_amt, pri.pri_cess_amt, 0) AS cess,
             COALESCE(pii.pii_tax_id, pri.pri_tax_id) AS tax_id,
             COALESCE(pii.pii_billed_qty * pii.pii_to_base_factor, pri.pri_qty * pri.pri_to_base_factor) AS src_base_qty,
             COALESCE(pii.pii_base_uom_id, gri.gri_base_uom_id, pri.pri_base_uom_id) AS base_uom, COALESCE(pii.pii_hsn_code, gri.gri_hsn_code, pri.pri_hsn_code) AS hsn,
             COALESCE((SELECT SUM(i.psri_qty * i.psri_to_base_factor) FROM purchase.pur_shortage_receipt_item i JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                        WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND ${live}
                          AND (${exceptPsrId ?? null}::uuid IS NULL OR r.psr_id <> ${exceptPsrId ?? null}::uuid)), 0) AS received,
             COALESCE((SELECT SUM(i.psri_value) FROM purchase.pur_shortage_receipt_item i JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                        WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND r.psr_status = 'POSTED'), 0) AS rcv_value,
             COALESCE((SELECT SUM(i.psri_gst_released) FROM purchase.pur_shortage_receipt_item i JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                        WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND r.psr_status = 'POSTED'), 0) AS rcv_gst,
             COALESCE((SELECT SUM(c.psc_qty_base) FROM purchase.pur_shortage_close c WHERE c.psc_shortage_id = s.psh_id AND NOT c.psc_is_deleted), 0) AS closed,
             COALESCE((SELECT SUM(c.psc_amount) FROM purchase.pur_shortage_close c WHERE c.psc_shortage_id = s.psh_id AND NOT c.psc_is_deleted), 0) AS cls_amount,
             a.pia_batch_no AS batch_no, a.pia_expiry_date AS expiry, a.pia_mrp AS mrp
        FROM purchase.pur_shortage s
        -- the bill line whose GST is pending: the line that opened it, or the bill that adopted a GRN challan short (R3)
        LEFT JOIN purchase.pur_invoice_item pii ON pii.pii_id = COALESCE(s.psh_bill_item_id, CASE WHEN s.psh_src_doc_type = 'PURCHASE_BILL' THEN s.psh_src_item_id END)
              AND pii.pii_acc_year = COALESCE(s.psh_bill_doc_year, s.psh_src_doc_year)
        LEFT JOIN purchase.pur_grn_item gri ON s.psh_src_doc_type = 'GRN' AND gri.gri_id = s.psh_src_item_id AND gri.gri_acc_year = s.psh_src_doc_year
        LEFT JOIN purchase.pur_return_item pri ON s.psh_src_doc_type = 'PURCHASE_RETURN' AND pri.pri_id = s.psh_src_item_id AND pri.pri_acc_year = s.psh_src_doc_year
        LEFT JOIN LATERAL (SELECT x.pia_batch_no, x.pia_expiry_date, x.pia_mrp FROM purchase.pur_item_alloc x
                            WHERE x.pia_line_id = s.psh_src_item_id AND NOT x.pia_is_deleted ORDER BY x.pia_row_no LIMIT 1) a ON true
       WHERE s.psh_id = ANY(${ids}::uuid[]) AND NOT s.psh_is_deleted`;
    const out = new Map<string, ShortageFacts>();
    for (const r of rows) {
      const qtyBase = D(r.psh_qty_base as Prisma.Decimal), value = D(r.value as Prisma.Decimal);
      const reason = r.psh_reason as string;
      // the GST in play: SHORT_BILL = what is pending; REPLACE = the claimed GST of the replaced qty (only a CN / write-off touches it)
      const srcBase = D(r.src_base_qty as Prisma.Decimal);
      const share = (v: unknown) => (srcBase.isZero() ? ZERO : D(v as Prisma.Decimal).times(qtyBase).dividedBy(srcBase));
      const raw: TaxHead[] = [['INPUT_CGST', r.cgst], ['INPUT_SGST', r.sgst], ['INPUT_IGST', r.igst], ['INPUT_CESS', r.cess]]
        .map(([role, v]) => ({ role: role as string, amt: share(v), taxId: (r.tax_id as string | null) ?? null }))
        .filter((h) => h.amt.greaterThan(0));
      const gst = reason === 'SHORT_BILL' ? D(r.gst as Prisma.Decimal) : reason === 'REPLACE' ? r2(raw.reduce((s, h) => s.plus(h.amt), ZERO)) : ZERO;
      // spread `gst` over the source line's heads (to the paisa, last head the remainder)
      const rawTotal = raw.reduce((s, h) => s.plus(h.amt), ZERO);
      let given = ZERO;
      const heads = raw.map((h, k) => {
        const amt = k === raw.length - 1 ? gst.minus(given) : r2(rawTotal.isZero() ? ZERO : gst.times(h.amt).dividedBy(rawTotal));
        given = given.plus(amt);
        return { ...h, amt };
      }).filter((h) => !h.amt.isZero());
      const received = D(r.received as Prisma.Decimal), closed = D(r.closed as Prisma.Decimal);
      // value of a closed piece is psc_amount minus its GST share; recomputed the same way it was booked
      const clsAmount = D(r.cls_amount as Prisma.Decimal);
      const clsGst = qtyBase.isZero() ? ZERO : r2(gst.times(closed).dividedBy(qtyBase));
      out.set(r.psh_id as string, {
        id: r.psh_id as string, accYear: r.psh_acc_year as string, companyId: r.psh_company_id as string, branchId: r.psh_branch_id as string,
        supplierId: r.psh_supplier_id as string, itemId: r.psh_item_id as string, reason, srcRefno: (r.psh_src_doc_refno as string) ?? null,
        qtyBase, value, gst, heads, inter: heads.some((h) => h.role === 'INPUT_IGST'),
        costRate: value.greaterThan(0) && qtyBase.greaterThan(0) ? value.dividedBy(qtyBase).toDecimalPlaces(6) : D(r.origin_rate as Prisma.Decimal),
        baseUomId: r.base_uom as string, hsn: (r.hsn as string) ?? null,
        received, closed, open: qtyBase.minus(received).minus(closed),
        valueUsed: D(r.rcv_value as Prisma.Decimal).plus(clsAmount.minus(clsGst)), gstUsed: D(r.rcv_gst as Prisma.Decimal).plus(clsGst),
        batchNo: (r.batch_no as string) ?? null, expiry: (r.expiry as Date) ?? null, mrp: (r.mrp as Prisma.Decimal) ?? null,
      });
    }
    return out;
  }

  /** The money of `q` base units of a shortage; the piece that empties it takes the remainder. */
  private piece(f: ShortageFacts, q: Prisma.Decimal) {
    const last = q.equals(f.open);
    const value = last ? f.value.minus(f.valueUsed) : r2(f.value.times(q).dividedBy(f.qtyBase));
    const gst = last ? f.gst.minus(f.gstUsed) : r2(f.gst.times(q).dividedBy(f.qtyBase));
    let given = ZERO;
    const total = f.heads.reduce((s, h) => s.plus(h.amt), ZERO);
    const heads = f.heads.map((h, k) => {
      const amt = k === f.heads.length - 1 ? gst.minus(given) : r2(total.isZero() ? ZERO : gst.times(h.amt).dividedBy(total));
      given = given.plus(amt);
      return { ...h, amt };
    }).filter((h) => !h.amt.isZero());
    return { value: value.isNegative() ? ZERO : value, gst: gst.isNegative() ? ZERO : gst, heads };
  }

  // ── open shortages ────────────────────────────────────────────────────
  async open(q: OpenShortagesQueryDto) {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT s.psh_id AS id FROM purchase.pur_shortage s
       WHERE s.psh_company_id = ${q.companyId}::uuid AND s.psh_branch_id = ${q.branchId}::uuid AND NOT s.psh_is_deleted
         AND (${q.supplierId ?? null}::uuid IS NULL OR s.psh_supplier_id = ${q.supplierId ?? null}::uuid)
       ORDER BY s.psh_created_on`;
    const facts = await this.facts(this.prisma, ids.map((i) => i.id));
    const live = [...facts.values()].filter((f) => q.all === 'true' || f.open.greaterThan(0));
    const names = await unitNames(this.prisma, live.map((f) => f.baseUomId));
    const sups = await this.prisma.$queryRaw<{ sup_id: string; sup_name: string }[]>`
      SELECT sup_id, sup_name FROM purchase.suppliers WHERE sup_id = ANY(${[...new Set(live.map((f) => f.supplierId))]}::uuid[])`;
    const supName = new Map(sups.map((s) => [s.sup_id, s.sup_name]));
    return jsonSafe(live.map((f) => ({
      shortageId: f.id, accYear: f.accYear, supplierId: f.supplierId, supplierName: supName.get(f.supplierId) ?? null, itemId: f.itemId,
      ...names.get(f.baseUomId), uomId: f.baseUomId, reason: f.reason, srcRefno: f.srcRefno, qtyBase: f.qtyBase, received: f.received, closed: f.closed,
      openQty: f.open, value: f.value, gst: f.gst, openValue: f.value.minus(f.valueUsed), openGst: f.gst.minus(f.gstUsed), costRate: f.costRate,
      batchNo: f.batchNo, expiryDate: f.expiry, mrp: f.mrp,
    })));
  }

  // ── Shortage Receipt ──────────────────────────────────────────────────
  async save(dto: SaveShortageReceiptDto) {
    const actor = this.actor();
    const h = dto.header;
    const id = await this.prisma.$transaction(async (tx) => {
      const facts = await this.facts(tx, dto.lines.map((l) => l.shortageId), h.psrId);
      const want = new Map<string, Prisma.Decimal>();
      const problems: { field: string; code: string; message: string }[] = [];
      dto.lines.forEach((l, i) => {
        const f = facts.get(l.shortageId);
        if (!f) { problems.push({ field: `lines.${i}.shortageId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: that shortage is not open` }); return; }
        if (f.supplierId !== h.supplierId) problems.push({ field: `lines.${i}.shortageId`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: that shortage is another supplier's` });
        if (f.branchId !== h.branchId) problems.push({ field: `lines.${i}.shortageId`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: that shortage is another branch's` });
        if (!D(l.qty).greaterThan(0)) problems.push({ field: `lines.${i}.qty`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: nothing received` });
        want.set(l.shortageId, (want.get(l.shortageId) ?? ZERO).plus(D(l.qty)));
      });
      for (const [sid, q] of want) {
        const f = facts.get(sid);
        if (f && q.greaterThan(f.open)) problems.push({ field: 'lines', code: 'PUR_SHORTAGE_QTY_EXCEEDS', message: `${f.srcRefno ?? 'Shortage'}: ${q} received, only ${f.open} is short` });
      }
      if (problems.length) purRefuseMany(problems[0].message, problems);

      let psrId = h.psrId ?? null;
      let slno: bigint, refno: string, isNew = false;
      if (psrId) {
        const cur = await tx.purShortageReceipt.findFirst({ where: { psrId, psrAccYear: h.accYear, psrIsDeleted: false } });
        if (!cur) purNotFound(`Shortage receipt ${psrId} not found`);
        if (cur.psrStatus !== 'DRAFT') purConflict(`${cur.psrRefno} is ${cur.psrStatus} — only a draft can be edited.`, PUR.NOT_DRAFT, 'psrId');
        slno = cur.psrSlno; refno = cur.psrRefno;
        await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC, piaDocId: psrId, piaAccYear: h.accYear } });
        await tx.purShortageReceiptItem.deleteMany({ where: { psriPsrId: psrId, psriAccYear: h.accYear } });
      } else {
        ({ slno, refno } = await allocateDocNumber(tx, 'SHR', h.companyId, h.branchId, h.accYear, h.deviceId));
        isNew = true;
      }
      // the value a draft shows: qty × cost (the remainder rule applies at post)
      const total = dto.lines.reduce((s, l) => s.plus(r2(D(l.qty).times(facts.get(l.shortageId)!.costRate))), ZERO);
      const data = {
        psrCompanyId: h.companyId, psrBranchId: h.branchId, psrAccYear: h.accYear, psrDeviceId: h.deviceId, psrSlno: slno, psrRefno: refno,
        psrDocDate: dateOf(h.docDate)!, psrSupplierId: h.supplierId, psrGodownId: h.godownId, psrReceivedAt: new Date(), psrChallanNo: h.challanNo ?? null,
        psrReceivedBy: h.receivedBy ?? [], psrValue: total, psrRemarks: h.remarks ?? null, psrStatus: 'DRAFT',
      };
      if (isNew) psrId = (await tx.purShortageReceipt.create({ data: { ...data, psrCreatedBy: actor }, select: { psrId: true } })).psrId;
      else await tx.purShortageReceipt.update({ where: { psrId_psrAccYear: { psrId: psrId!, psrAccYear: h.accYear } }, data: { ...data, psrModifiedBy: actor, psrModifiedOn: new Date(), psrRevisionNo: { increment: 1 } } });
      for (const l of dto.lines) {
        const f = facts.get(l.shortageId)!;
        const row = await tx.purShortageReceiptItem.create({ data: {
          psriPsrId: psrId!, psriCompanyId: h.companyId, psriBranchId: h.branchId, psriAccYear: h.accYear, psriLineNo: l.lineNo,
          psriShortageId: f.id, psriShortageAccYear: f.accYear, psriItemId: f.itemId, psriUomId: f.baseUomId, psriBaseUomId: f.baseUomId, psriToBaseFactor: D(1),
          psriHsnCode: f.hsn, psriQty: D(l.qty), psriCostRate: f.costRate, psriValue: r2(D(l.qty).times(f.costRate)), psriGstReleased: ZERO,
          psriRemarks: l.remarks ?? null, psriCreatedBy: actor,
        }, select: { psriId: true } });
        await tx.purItemAlloc.create({ data: {
          piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC, piaDocId: psrId!, piaLineId: row.psriId, piaRowNo: 1,
          piaGodownId: h.godownId, piaBucket: 'SALEABLE', piaBatchNo: (l.batchNo ?? f.batchNo)?.trim() || null,
          piaExpiryDate: l.expiryDate ? dateOf(l.expiryDate) : f.expiry, piaMrp: l.mrp ?? f.mrp, piaQty: D(l.qty), piaFreeQty: ZERO, piaCreatedBy: actor,
        } });
      }
      if (isNew) await statusLog(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: TxnStatusDocType.SHORTAGE_RECEIPT, docId: psrId!, refno, event: TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
      if (h.post) await this.postInTx(tx, psrId!, h.accYear, actor);
      return psrId!;
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(id, h.accYear);
  }

  async post(psrId: string, accYear: string) {
    const actor = this.actor();
    await this.prisma.$transaction((tx) => this.postInTx(tx, psrId, accYear, actor), { timeout: 60000, maxWait: 10000 });
    return this.get(psrId, accYear);
  }

  private async postInTx(tx: Tx, psrId: string, accYear: string, actor: string) {
    const r = await tx.purShortageReceipt.findFirst({ where: { psrId, psrAccYear: accYear, psrIsDeleted: false } });
    if (!r) purNotFound(`Shortage receipt ${psrId} not found`);
    if (r.psrStatus !== 'DRAFT') purConflict(`${r.psrRefno} is ${r.psrStatus} — only a draft can be posted.`, PUR.NOT_DRAFT, 'psrId');
    const lines = await tx.purShortageReceiptItem.findMany({ where: { psriPsrId: psrId, psriAccYear: accYear, psriIsDeleted: false }, orderBy: { psriLineNo: 'asc' } });
    const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: psrId, piaAccYear: accYear, piaIsDeleted: false } });
    const allocOf = new Map(allocs.map((a) => [a.piaLineId, a]));
    // one at a time per shortage: the open qty is checked again here, under the lock
    for (const l of lines) await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('purchase_shortage'), hashtext(${l.psriShortageId})))::int AS locked`;
    const facts = await this.facts(tx, lines.map((l) => l.psriShortageId), psrId, true);
    const pieces = lines.map((l) => {
      const f = facts.get(l.psriShortageId);
      if (!f) purConflict(`Line ${l.psriLineNo}: its shortage is gone (its bill / GRN was cancelled).`, PUR.NOT_FOUND, 'lines');
      const q = l.psriQty.times(l.psriToBaseFactor);
      if (q.greaterThan(f.open)) purConflict(`Line ${l.psriLineNo}: ${q} received, only ${f.open} is still short.`, 'PUR_SHORTAGE_QTY_EXCEEDS', 'lines');
      // a shortage with no money (challan short) comes in at its origin cost
      const p = f.value.greaterThan(0) ? this.piece(f, q) : { value: r2(q.times(f.costRate)), gst: ZERO, heads: [] as TaxHead[] };
      f.open = f.open.minus(q); f.valueUsed = f.valueUsed.plus(p.value); f.gstUsed = f.gstUsed.plus(p.gst);   // two lines on one shortage
      return { l, f, q, p };
    });
    const postedOn = new Date();
    const docDate = isoDate(r.psrDocDate);
    const { perRow } = await postShadowStock(tx, this.stockPosting,
      { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear, deviceId: r.psrDeviceId, sessionId: r.psrSessionId, docType: DOC, docId: psrId,
        refno: r.psrRefno, revision: r.psrRevisionNo, usrRefno: r.psrChallanNo, docDate, supplierId: r.psrSupplierId, remarks: `Shortage receipt ${r.psrRefno}` },
      this.rules(),
      pieces.map(({ l, q, p }) => {
        const a = allocOf.get(l.psriId)!;
        return { itemId: l.psriItemId, uomId: l.psriUomId, baseUomId: l.psriBaseUomId, factor: l.psriToBaseFactor, godownId: a.piaGodownId, bucket: a.piaBucket,
          batchNo: a.piaBatchNo, expiryDate: a.piaExpiryDate, mrp: a.piaMrp, supplierId: r.psrSupplierId, qty: l.psriQty, freeQty: ZERO,
          costRate: q.isZero() ? ZERO : p.value.dividedBy(q).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP) };
      }),
      actor, postedOn);
    for (let i = 0; i < pieces.length; i++) {
      const { l, p } = pieces[i];
      const a = allocOf.get(l.psriId)!;
      await tx.purShortageReceiptItem.update({ where: { psriId_psriAccYear: { psriId: l.psriId, psriAccYear: accYear } }, data: { psriValue: p.value, psriGstReleased: p.gst } });
      if (perRow[i]?.sviId) await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: a.piaId, piaAccYear: accYear } }, data: { piaLotId: perRow[i].lotId, piaSviId: perRow[i].sviId, piaSviAccYear: accYear } });
    }
    const legs: VoucherLeg[] = [];
    const add = (leg: VoucherLeg) => { if (leg.amount >= 0.005) legs.push(leg); };
    let stockDr = ZERO, srCr = ZERO, grniCr = ZERO, pendingCr = ZERO;
    const inputDr = new Map<string, TaxHead>();
    for (const { f, p } of pieces) {
      stockDr = stockDr.plus(p.value);
      if (f.reason === 'SHORT_CHALLAN') grniCr = grniCr.plus(p.value); else srCr = srCr.plus(p.value);
      if (f.reason === 'SHORT_BILL') {
        pendingCr = pendingCr.plus(p.gst);
        for (const hd of p.heads) {
          const k = `${hd.role}|${hd.taxId ?? ''}`;
          const cur = inputDr.get(k) ?? { ...hd, amt: ZERO };
          cur.amt = cur.amt.plus(hd.amt);
          inputDr.set(k, cur);
        }
      }
    }
    const inter = pieces.some(({ f }) => f.inter);
    add({ role: 'INVENTORY', drCr: 'DR', amount: num2(stockDr), roleTag: 'INVENTORY', remarks: `Shortage received · ${r.psrRefno}` });
    add({ role: 'SHORTAGE_RECEIVABLE', drCr: 'CR', amount: num2(srCr), roleTag: 'SHORTAGE_RECEIVABLE', remarks: `Shortage received · ${r.psrRefno}` });
    add({ role: 'GRNI', drCr: 'CR', amount: num2(grniCr), roleTag: 'GRNI', remarks: `Challan short received — bill pending · ${r.psrRefno}` });
    for (const hd of inputDr.values()) add({ role: hd.role, drCr: 'DR', amount: num2(hd.amt), taxId: hd.taxId, supplyNature: (inter ? 'INTER' : 'INTRA') as never, roleTag: hd.role });
    add({ role: 'INPUT_TAX_PENDING', drCr: 'CR', amount: num2(pendingCr), roleTag: 'INPUT_TAX_PENDING', remarks: `GST released · ${r.psrRefno}` });
    let voucherId: string | null = null;
    if (legs.length) {
      const vt = await voucherTypeId(tx, 'SHR');
      const posted = await this.vouchers.postLegs(tx, {
        header: { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: DOC, srcDocId: psrId,
          docLabel: 'Shortage Receipt', docRefno: r.psrRefno, docDate, usrRefno: r.psrChallanNo, docAmount: num2(stockDr), partyId: r.psrSupplierId,
          userId: actor, sessionId: r.psrSessionId, deviceId: r.psrDeviceId, remarks: r.psrRemarks ?? `Shortage receipt ${r.psrRefno}`, createdBy: actor,
          presetRefno: r.psrRefno, presetNo: r.psrSlno },
        legs,
      });
      voucherId = posted.voucherId;
    }
    await tx.purShortageReceipt.update({ where: { psrId_psrAccYear: { psrId, psrAccYear: accYear } }, data: { psrStatus: 'POSTED', psrValue: stockDr, psrPostedVoucherId: voucherId, psrModifiedBy: actor, psrModifiedOn: postedOn } });
    await statusLog(tx, { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear, docType: TxnStatusDocType.SHORTAGE_RECEIPT, docId: psrId, refno: r.psrRefno, event: TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: r.psrDeviceId });
  }

  async get(psrId: string, accYear: string) {
    const header = await this.prisma.purShortageReceipt.findFirst({ where: { psrId, psrAccYear: accYear, psrIsDeleted: false } });
    if (!header) purNotFound(`Shortage receipt ${psrId} not found`);
    const [lines, allocs, sup] = await Promise.all([
      this.prisma.purShortageReceiptItem.findMany({ where: { psriPsrId: psrId, psriAccYear: accYear, psriIsDeleted: false }, orderBy: { psriLineNo: 'asc' } }),
      this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: psrId, piaAccYear: accYear, piaIsDeleted: false } }),
      this.prisma.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.psrSupplierId}::uuid`,
    ]);
    const names = await unitNames(this.prisma, lines.map((l) => l.psriUomId));
    const facts = await this.facts(this.prisma, lines.map((l) => l.psriShortageId), header.psrStatus === 'DRAFT' ? psrId : null);
    return jsonSafe({
      header: { ...header, supplierName: sup[0]?.sup_name ?? null },
      lines: lines.map((l) => {
        const a = allocs.find((x) => x.piaLineId === l.psriId);
        const f = facts.get(l.psriShortageId);
        return { ...l, ...names.get(l.psriUomId), reason: f?.reason ?? null, srcRefno: f?.srcRefno ?? null, openQty: f?.open ?? null,
          batchNo: a?.piaBatchNo ?? null, expiryDate: a?.piaExpiryDate ?? null, mrp: a?.piaMrp ?? null };
      }),
    });
  }

  async cancel(dto: ShortageReceiptCancelDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.purShortageReceipt.findFirst({ where: { psrId: dto.psrId, psrAccYear: dto.accYear, psrIsDeleted: false } });
      if (!r) purNotFound(`Shortage receipt ${dto.psrId} not found`);
      if (r.psrStatus === 'CANCELLED') purConflict(`${r.psrRefno} is already cancelled.`, PUR.NOT_POSTED, 'psrId');
      if (r.psrStatus === 'POSTED') {
        await cancelShadowStock(tx, this.stockPosting, DOC, dto.psrId, dto.accYear, r.psrCompanyId, r.psrBranchId, this.rules(), actor, dto.reason);
        if (r.psrPostedVoucherId) await this.vouchers.reverseLegs(tx, r.psrPostedVoucherId, dto.accYear, `Shortage receipt ${r.psrRefno} cancelled: ${dto.reason}`, actor);
      }
      await tx.purShortageReceipt.update({ where: { psrId_psrAccYear: { psrId: dto.psrId, psrAccYear: dto.accYear } }, data: { psrStatus: 'CANCELLED', psrModifiedBy: actor, psrModifiedOn: new Date() } });
      await statusLog(tx, { companyId: r.psrCompanyId, branchId: r.psrBranchId, accYear: dto.accYear, docType: TxnStatusDocType.SHORTAGE_RECEIPT, docId: dto.psrId, refno: r.psrRefno, event: TxnStatusEvent.CANCELLED, from: r.psrStatus, to: 'CANCELLED', actor, remarks: dto.reason });
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(dto.psrId, dto.accYear);
  }

  // ── close without goods ───────────────────────────────────────────────
  async close(dto: CloseShortageDto) {
    const actor = this.actor();
    const out = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('purchase_shortage'), hashtext(${dto.shortageId})))::int AS locked`;
      const f = (await this.facts(tx, [dto.shortageId], null, true)).get(dto.shortageId);
      const reserved = (await this.facts(tx, [dto.shortageId])).get(dto.shortageId);
      if (!f) purNotFound(`Shortage ${dto.shortageId} not found`);
      if (!f.open.greaterThan(0)) purConflict('Nothing of that shortage is open.', PUR.QTY_INVALID, 'shortageId');
      const q = dto.qty == null ? (reserved?.open ?? ZERO) : D(dto.qty);
      if (!q.greaterThan(0) || q.greaterThan(reserved?.open ?? ZERO)) purRefuse(`Qty must be more than 0 and at most the open ${reserved?.open ?? 0} (draft receipts hold the rest).`, PUR.QTY_INVALID, 'qty');
      const p = f.value.greaterThan(0) ? this.piece(f, q) : { value: ZERO, gst: ZERO, heads: [] as TaxHead[] };
      const accYear = dto.closeAccYear ?? dto.accYear;
      const docDate = dto.docDate ?? isoDate(new Date());
      const [{ n: seq }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) + 1 AS n FROM purchase.pur_shortage_close WHERE psc_shortage_id = ${f.id}::uuid`;
      const ref = `${f.srcRefno ?? 'SHORT'}/X${seq}`;
      const c = await tx.purShortageClose.create({ data: {
        pscCompanyId: f.companyId, pscBranchId: f.branchId, pscAccYear: accYear, pscShortageId: f.id, pscShortageAccYear: f.accYear, pscKind: dto.kind,
        pscQtyBase: q, pscAmount: p.value.plus(p.gst), pscPartyId: dto.kind === 'SUPPLIER_CN' ? f.supplierId : null,
        pscCnNo: dto.cnNo ?? null, pscCnDate: dateOf(dto.cnDate), pscReason: dto.reason ?? null, pscCreatedBy: actor,
      }, select: { pscId: true } });
      let voucherRefno: string | null = null;
      if (p.value.plus(p.gst).greaterThan(0)) {
        const total = p.value.plus(p.gst);
        const legs: VoucherLeg[] = [];
        if (dto.kind === 'SUPPLIER_CN') legs.push({ ledgerId: f.supplierId, drCr: 'DR', amount: num2(total), remarks: `Shortage ${ref} — supplier CN${dto.cnNo ? ` ${dto.cnNo}` : ''}`, docRefno: ref });
        else legs.push({ role: 'WRITE_OFF', drCr: 'DR', amount: num2(total), roleTag: 'WRITE_OFF', remarks: `Shortage ${ref} written off` });
        legs.push({ role: 'SHORTAGE_RECEIVABLE', drCr: 'CR', amount: num2(p.value), roleTag: 'SHORTAGE_RECEIVABLE', remarks: `Shortage ${ref}` });
        // SHORT_BILL: the GST was parked as pending; REPLACE: it was claimed — a CN / loss takes it back out of input
        if (f.reason === 'SHORT_BILL') legs.push({ role: 'INPUT_TAX_PENDING', drCr: 'CR', amount: num2(p.gst), roleTag: 'INPUT_TAX_PENDING' });
        else for (const hd of p.heads) legs.push({ role: hd.role, drCr: 'CR', amount: num2(hd.amt), taxId: hd.taxId, supplyNature: (f.inter ? 'INTER' : 'INTRA') as never, roleTag: hd.role });
        const vt = await voucherTypeId(tx, 'PCL');
        const posted = await this.vouchers.postLegs(tx, {
          header: { companyId: f.companyId, branchId: f.branchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: CLOSE_DOC, srcDocId: c.pscId,
            docLabel: 'Shortage close', docRefno: ref, docDate, usrRefno: dto.cnNo ?? null, docAmount: num2(total), partyId: f.supplierId,
            userId: actor, deviceId: dto.deviceId, remarks: dto.reason ?? `Shortage ${ref} ${dto.kind === 'SUPPLIER_CN' ? 'credited by the supplier' : 'written off'}`, createdBy: actor },
          legs: legs.filter((g) => g.amount >= 0.005),
        });
        voucherRefno = posted.voucherRefno;
        await tx.purShortageClose.update({ where: { pscId_pscAccYear: { pscId: c.pscId, pscAccYear: accYear } }, data: { pscVoucherId: posted.voucherId } });
        if (dto.kind === 'SUPPLIER_CN') {
          await raiseBillRow(tx, { companyId: f.companyId, branchId: f.branchId, accYear, partyId: f.supplierId, billType: 'PURCHASE_RETURN', drCr: 'DR', amount: total,
            docType: CLOSE_DOC, docId: c.pscId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: posted.voucherSlno, voucherDate: docDate,
            refno: posted.voucherRefno ?? ref, docDate: dateOf(docDate)!, narration: `Shortage ${ref} — supplier CN${dto.cnNo ? ` ${dto.cnNo}` : ''}`, actor });
        }
      }
      return { closeId: c.pscId, accYear, qty: q, amount: p.value.plus(p.gst), openQty: f.open.minus(q), voucherRefno };
    }, { timeout: 60000, maxWait: 10000 });
    return jsonSafe(out);
  }

  async closeUndo(dto: CloseUndoDto) {
    const actor = this.actor();
    const out = await this.prisma.$transaction(async (tx) => {
      const c = await tx.purShortageClose.findFirst({ where: { pscId: dto.closeId, pscAccYear: dto.accYear, pscIsDeleted: false } });
      if (!c) purNotFound(`Shortage close ${dto.closeId} not found`);
      if (c.pscReversalOfId) purConflict('That row is itself an undo.', PUR.NOT_POSTED, 'closeId');
      const [undone] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM purchase.pur_shortage_close WHERE psc_reversal_of_id = ${dto.closeId}::uuid AND NOT psc_is_deleted`;
      if (Number(undone.n) > 0) purConflict('That close is already undone.', PUR.NOT_POSTED, 'closeId');
      await assertBillsUnsettled(tx, CLOSE_DOC, dto.closeId, 'The supplier credit');
      const rev = await tx.purShortageClose.create({ data: {
        pscCompanyId: c.pscCompanyId, pscBranchId: c.pscBranchId, pscAccYear: c.pscAccYear, pscShortageId: c.pscShortageId, pscShortageAccYear: c.pscShortageAccYear,
        pscKind: c.pscKind, pscQtyBase: c.pscQtyBase.negated(), pscAmount: c.pscAmount.negated(), pscPartyId: c.pscPartyId, pscCnNo: c.pscCnNo, pscCnDate: c.pscCnDate,
        pscReason: dto.reason, pscReversalOfId: c.pscId, pscCreatedBy: actor,
      }, select: { pscId: true } });
      if (c.pscVoucherId) await this.vouchers.reverseLegs(tx, c.pscVoucherId, c.pscAccYear, `Shortage close undone: ${dto.reason}`, actor);
      await withdrawBillRows(tx, CLOSE_DOC, c.pscId, actor);
      return { reversalId: rev.pscId, shortageId: c.pscShortageId };
    }, { timeout: 60000, maxWait: 10000 });
    return jsonSafe(out);
  }

  /** Close rows of a shortage that still stand (not undone) — what Undo offers. */
  async closes(shortageId: string) {
    return jsonSafe(await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT c.psc_id AS "closeId", c.psc_acc_year AS "accYear", c.psc_kind AS "kind", c.psc_qty_base AS "qty", c.psc_amount AS "amount",
             c.psc_cn_no AS "cnNo", c.psc_reason AS "reason", c.psc_created_on AS "createdOn"
        FROM purchase.pur_shortage_close c
       WHERE c.psc_shortage_id = ${shortageId}::uuid AND NOT c.psc_is_deleted AND c.psc_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM purchase.pur_shortage_close u WHERE u.psc_reversal_of_id = c.psc_id AND NOT u.psc_is_deleted)
       ORDER BY c.psc_created_on DESC`);
  }
}

@ApiTags('Purchase — Shortages')
@ApiBearerAuth()
@Controller('purchase/shortages')
export class PurchaseShortageController {
  constructor(private readonly service: PurchaseShortageService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: SHORTAGE_MENU_ID, right, codePrefix: 'SHR', action });
  }
  @Get('open') @Version(API_VERSION) @ApiOperation({ summary: 'Shortages with qty still open (all=true: every shortage), with open value and GST.' })
  async open(@Query() q: OpenShortagesQueryDto) {
    await this.right('view', 'see shortages');
    return { success: true, message: 'Shortages fetched', data: await this.service.open(q) };
  }
  @Post('receipt/save') @Version(API_VERSION) @ApiOperation({ summary: 'Save a Shortage Receipt draft; header.post = true saves and posts (stock in at the shortage\'s cost, receivable / GRNI cleared, GST released).' })
  async save(@Body() dto: SaveShortageReceiptDto) {
    await this.right(dto.header.psrId ? 'edit' : 'create', 'save a shortage receipt');
    if (dto.header.post) await this.right('post', 'post a shortage receipt');
    const data = await this.service.save(dto);
    return { success: true, message: `Shortage receipt ${data.header.psrRefno} ${dto.header.post ? 'posted' : 'saved as draft'}`, data };
  }
  @Post('receipt/post') @Version(API_VERSION) @ApiOperation({ summary: 'Post a saved Shortage Receipt draft.' })
  async post(@Body() dto: ShortageReceiptRefDto) {
    await this.right('post', 'post a shortage receipt');
    const data = await this.service.post(dto.psrId, dto.accYear);
    return { success: true, message: `Shortage receipt ${data.header.psrRefno} posted`, data };
  }
  @Get('receipt/get') @Version(API_VERSION) @ApiOperation({ summary: 'A Shortage Receipt with its lines.' })
  async get(@Query() q: ShortageReceiptRefDto) {
    await this.right('view', 'open a shortage receipt');
    return { success: true, message: 'Shortage receipt fetched', data: await this.service.get(q.psrId, q.accYear) };
  }
  @Post('receipt/cancel') @Version(API_VERSION) @ApiOperation({ summary: 'Cancel a Shortage Receipt: stock out, voucher reversed, the shortage open again.' })
  async cancel(@Body() dto: ShortageReceiptCancelDto) {
    await this.right('cancel', 'cancel a shortage receipt');
    const data = await this.service.cancel(dto);
    return { success: true, message: `Shortage receipt ${data.header.psrRefno} cancelled`, data };
  }
  @Post('close') @Version(API_VERSION) @ApiOperation({ summary: 'Close a shortage without goods: SUPPLIER_CN (bill-wise credit) or WRITE_OFF.' })
  async close(@Body() dto: CloseShortageDto) {
    await this.right('post', 'close a shortage');
    const data = await this.service.close(dto);
    return { success: true, message: `Shortage closed${data.voucherRefno ? ` — ${data.voucherRefno}` : ''}`, data };
  }
  @Post('close-undo') @Version(API_VERSION) @ApiOperation({ summary: 'Undo a shortage close: a reversing row, the voucher reversed.' })
  async closeUndo(@Body() dto: CloseUndoDto) {
    await this.right('cancel', 'undo a shortage close');
    return { success: true, message: 'Close undone', data: await this.service.closeUndo(dto) };
  }
  @Get('closes') @Version(API_VERSION) @ApiOperation({ summary: 'The standing close rows of one shortage.' })
  async closes(@Query('shortageId') shortageId: string) {
    await this.right('view', 'see shortage closes');
    return { success: true, message: 'Closes fetched', data: await this.service.closes(shortageId) };
  }
}
