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
import { loadPurchaseSettings } from '../common/purchase-settings';
import {
  allocateDocNumber, assertBillsUnsettled, assertShortagesUntouched, cancelShadowStock, D, dateOf, isoDate, jsonSafe, num2, postShadowStock, r2, raiseBillRow, statusLog,
  stockRules, TxnStatusDocType, TxnStatusEvent, unitNames, voucherTypeId, withdrawBillRows, ZERO,
} from '../common/purchase-doc.helpers';

/**
 * Purchase Return / Claim / Replace (menu 25) — plan-purchase-backend.md B8, §4.
 *
 * A return is ALWAYS against a source document: a posted purchase bill
 * (AGAINST_INVOICE) or a posted GRN (AGAINST_GRN). Each row names the source
 * line and, through it, the LOT the goods came in as — the stock leaves from
 * that exact lot, at that lot's cost (the engine prices an issue that names
 * its lot). The money is the BILL's: per billed unit, the line's taxable and
 * its GST heads, so a debit note matches the bill to the paisa.
 *
 * Row outcomes (pri_outcome):
 *   RETURN           goods back to the supplier: Dr Supplier (bill-wise PURCHASE_RETURN) / Cr Stock at lot cost, Cr input GST
 *   CLAIM_SENT       goods sent with a claim:     Dr Claim receivable (value + GST) / Cr Stock, Cr input GST
 *   CLAIM_DESTROYED  goods destroyed, claimed:    Dr Claim receivable (value) / Cr Stock; Dr ITC reversal / Cr input GST
 *   REPLACE          goods back, same goods due:  Dr Shortage receivable (value) / Cr Stock; a REPLACE shortage row opens
 * The difference between the bill value and the lot cost goes to PURCHASE_PRICE_VARIANCE.
 * AGAINST_GRN rows (no bill yet) are RETURN only: Dr GRNI / Cr Stock.
 *
 * Claims are settled one row at a time (/purchase/claims/settle): CREDIT (the
 * supplier / claim party gives a credit note — bill-wise against them),
 * SHORT_SETTLED (the rest written off), REJECTED (written off, the GST of a
 * claim on goods sent re-availed). An undo writes a reversing row; nothing is deleted.
 */
export const RETURN_MENU_ID = 25;
const DOC = 'PURCHASE_RETURN';
const SETTLE_DOC = 'CLAIM_SETTLEMENT';
const OUTCOMES = ['RETURN', 'CLAIM_SENT', 'CLAIM_DESTROYED', 'REPLACE'] as const;

export class ReturnLineDto {
  @ApiProperty() @IsInt() @Min(1) lineNo!: number;
  @ApiProperty({ description: 'The source line: pur_invoice_item.pii_id or pur_grn_item.gri_id.' }) @IsUUID() srcItemId!: string;
  @ApiProperty({ enum: OUTCOMES }) @IsIn(OUTCOMES as unknown as string[]) outcome!: string;
  @ApiProperty({ description: 'In the source line\'s unit.' }) @IsNumber() @Min(0) qty!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) freeQty?: number;
  @ApiPropertyOptional({ enum: ['SALEABLE', 'DAMAGED'], description: 'Which holding the goods leave from (default SALEABLE).' })
  @IsOptional() @IsIn(['SALEABLE', 'DAMAGED']) bucket?: string;
  @ApiPropertyOptional({ description: 'The exact lot (default: the source line\'s lot in that bucket).' }) @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() reasonId?: string;
  @ApiPropertyOptional({ enum: ['SUPPLIER', 'TRANSPORTER', 'INSURER'] }) @IsOptional() @IsIn(['SUPPLIER', 'TRANSPORTER', 'INSURER']) claimAgainst?: string;
  @ApiPropertyOptional({ description: 'The transporter / insurer ledger (a SUPPLIER claim is on the supplier).' }) @IsOptional() @IsUUID() claimPartyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remarks?: string;
}
export class ReturnHeaderDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() prId?: string;
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty({ enum: ['AGAINST_INVOICE', 'AGAINST_GRN'] }) @IsIn(['AGAINST_INVOICE', 'AGAINST_GRN']) kind!: string;
  @ApiProperty() @IsUUID() srcDocId!: string;
  @ApiProperty() @IsString() @MaxLength(9) srcAccYear!: string;
  @ApiProperty() @IsDateString() docDate!: string;
  @ApiPropertyOptional({ enum: ['ADJUST', 'ADVANCE'], description: 'ADJUST (default): set off against the supplier\'s bills; ADVANCE: kept as an advance.' })
  @IsOptional() @IsIn(['ADJUST', 'ADVANCE']) settlement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) supplierCnNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() supplierCnDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) vehicleNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) driverName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15) ewbNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() post?: boolean;
}
export class SaveReturnDto {
  @ApiProperty({ type: ReturnHeaderDto }) @ValidateNested() @Type(() => ReturnHeaderDto) header!: ReturnHeaderDto;
  @ApiProperty({ type: [ReturnLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) lines!: ReturnLineDto[];
}
export class ReturnRefDto {
  @ApiProperty() @IsUUID() prId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}
export class ReturnCancelDto extends ReturnRefDto {
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
}
export class SourceLinesQueryDto {
  @ApiProperty({ enum: ['AGAINST_INVOICE', 'AGAINST_GRN'] }) @IsIn(['AGAINST_INVOICE', 'AGAINST_GRN']) kind!: string;
  @ApiProperty() @IsUUID() srcDocId!: string;
  @ApiProperty() @IsString() @MaxLength(9) srcAccYear!: string;
  @ApiPropertyOptional({ description: 'The return being edited — its own rows do not count as already returned.' }) @IsOptional() @IsUUID() exceptPrId?: string;
}
export class SourcesQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiProperty({ enum: ['AGAINST_INVOICE', 'AGAINST_GRN'] }) @IsIn(['AGAINST_INVOICE', 'AGAINST_GRN']) kind!: string;
}
export class OpenClaimsQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supplierId?: string;
}
export class SettleClaimDto {
  @ApiProperty() @IsUUID() returnItemId!: string;
  @ApiProperty({ description: 'The return row\'s year.' }) @IsString() @MaxLength(9) accYear!: string;
  @ApiPropertyOptional({ description: 'The settlement\'s own year (default: the row\'s).' }) @IsOptional() @IsString() @MaxLength(9) settleAccYear?: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty({ enum: ['CREDIT', 'SHORT_SETTLED', 'REJECTED'] }) @IsIn(['CREDIT', 'SHORT_SETTLED', 'REJECTED']) action!: string;
  @ApiPropertyOptional({ description: 'CREDIT: what the party allowed (default the whole open amount). SHORT_SETTLED / REJECTED: always the open amount.' })
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @ApiPropertyOptional({ enum: ['CN', 'ADJUST'] }) @IsOptional() @IsIn(['CN', 'ADJUST']) receivedAs?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) cnNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() cnDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() docDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) reason?: string;
}
export class SettleUndoDto {
  @ApiProperty() @IsUUID() settlementId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
}

type Tx = Prisma.TransactionClient;
interface SourceLine {
  srcItemId: string; lineNo: number; itemId: string; uomId: string; baseUomId: string; factor: Prisma.Decimal; hsn: string | null;
  inQty: Prisma.Decimal;              // received + damaged + free, line unit
  basisQty: Prisma.Decimal;           // the qty the money is per (billed / received + damaged)
  taxable: Prisma.Decimal; cgst: Prisma.Decimal; sgst: Prisma.Decimal; igst: Prisma.Decimal; cess: Prisma.Decimal;
  taxId: string | null; gstPct: Prisma.Decimal; rate: Prisma.Decimal;
}
interface SourceDoc { id: string; accYear: string; refno: string; supplierId: string; supplierInvNo: string | null; status: string; docType: 'PURCHASE_BILL' | 'GRN' }

@Injectable()
export class PurchaseReturnService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService,
              private readonly vouchers: VoucherPostingService, private readonly stockPosting: StockPostingService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }
  private rules() { return stockRules('OUT', DOC, 'Purchase Return', 'PURCHASE_RETURN', TxnStatusDocType.PURCHASE_RETURN); }

  // ── the source document ───────────────────────────────────────────────
  private async sourceDoc(db: Tx | PrismaService, kind: string, id: string, accYear: string): Promise<SourceDoc> {
    if (kind === 'AGAINST_INVOICE') {
      const pi = await db.purInvoice.findFirst({ where: { piId: id, piAccYear: accYear, piIsDeleted: false } });
      if (!pi) purNotFound(`Purchase bill ${id} not found`);
      return { id, accYear, refno: pi.piRefno, supplierId: pi.piSupplierId, supplierInvNo: pi.piSupplierInvNo, status: pi.piStatus, docType: 'PURCHASE_BILL' };
    }
    const g = await db.purGrn.findFirst({ where: { grnId: id, grnAccYear: accYear, grnIsDeleted: false } });
    if (!g) purNotFound(`GRN ${id} not found`);
    return { id, accYear, refno: g.grnRefno, supplierId: g.grnSupplierId, supplierInvNo: g.grnChallanNo, status: g.grnStatus, docType: 'GRN' };
  }

  private async sourceLines(db: Tx | PrismaService, src: SourceDoc): Promise<Map<string, SourceLine>> {
    const out = new Map<string, SourceLine>();
    if (src.docType === 'PURCHASE_BILL') {
      const ls = await db.purInvoiceItem.findMany({ where: { piiPiId: src.id, piiAccYear: src.accYear, piiIsDeleted: false }, orderBy: { piiLineNo: 'asc' } });
      for (const l of ls) out.set(l.piiId, {
        srcItemId: l.piiId, lineNo: l.piiLineNo, itemId: l.piiItemId, uomId: l.piiUomId, baseUomId: l.piiBaseUomId, factor: l.piiToBaseFactor, hsn: l.piiHsnCode,
        inQty: l.piiReceivedQty.plus(l.piiDamagedQty).plus(l.piiFreeQty), basisQty: l.piiBilledQty,
        taxable: l.piiTaxableAmt, cgst: l.piiCgstAmt, sgst: l.piiSgstAmt, igst: l.piiIgstAmt, cess: l.piiCessAmt,
        taxId: l.piiTaxId, gstPct: l.piiGstPct, rate: l.piiRate,
      });
    } else {
      const ls = await db.purGrnItem.findMany({ where: { griGrnId: src.id, griAccYear: src.accYear, griIsDeleted: false }, orderBy: { griLineNo: 'asc' } });
      for (const l of ls) out.set(l.griId, {
        srcItemId: l.griId, lineNo: l.griLineNo, itemId: l.griItemId, uomId: l.griUomId, baseUomId: l.griBaseUomId, factor: l.griToBaseFactor, hsn: l.griHsnCode,
        inQty: l.griReceivedQty.plus(l.griDamagedQty).plus(l.griFreeQty), basisQty: l.griReceivedQty.plus(l.griDamagedQty),
        taxable: l.griValue, cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO, taxId: null, gstPct: ZERO, rate: l.griProvisionalRate,
      });
    }
    return out;
  }

  /** qty already returned per source line (line unit), by every live return except `exceptPrId`. */
  private async returnedQty(db: Tx | PrismaService, srcId: string, exceptPrId?: string | null) {
    const rows = await db.$queryRaw<{ id: string; q: Prisma.Decimal }[]>`
      SELECT pri.pri_src_item_id AS id, SUM(pri.pri_qty + pri.pri_free_qty) AS q
        FROM purchase.pur_return_item pri JOIN purchase.pur_return pr ON pr.pr_id = pri.pri_pr_id AND pr.pr_acc_year = pri.pri_acc_year
       WHERE pri.pri_src_doc_id = ${srcId}::uuid AND NOT pri.pri_is_deleted AND NOT pr.pr_is_deleted AND pr.pr_status <> 'CANCELLED'
         AND (${exceptPrId ?? null}::uuid IS NULL OR pr.pr_id <> ${exceptPrId ?? null}::uuid)
       GROUP BY 1`;
    return new Map(rows.map((r) => [r.id, D(r.q)]));
  }

  /** The source lines' lots: what the bill / GRN brought in, per allocation row. A bill line billed off a GRN line has
   *  no rows of its own — the goods came in on the GRN, so its lots are the GRN line's (keyed to the bill line). */
  private async sourceLots(db: Tx | PrismaService, src: SourceDoc) {
    return db.$queryRaw<{ line_id: string; lot_id: string; bucket: string; godown_id: string; batch_no: string | null; expiry: Date | null; mrp: Prisma.Decimal | null; qty: Prisma.Decimal }[]>`
      SELECT line_id, lot_id, bucket, godown_id, batch_no, expiry, mrp, qty FROM (
        SELECT pia_line_id AS line_id, pia_lot_id AS lot_id, pia_bucket AS bucket, pia_godown_id AS godown_id, pia_batch_no AS batch_no,
               pia_expiry_date AS expiry, pia_mrp AS mrp, pia_qty + pia_free_qty AS qty, 0 AS line_no, pia_row_no AS row_no
          FROM purchase.pur_item_alloc
         WHERE pia_doc_type = ${src.docType} AND pia_doc_id = ${src.id}::uuid AND pia_acc_year = ${src.accYear}::bpchar
           AND NOT pia_is_deleted AND pia_lot_id IS NOT NULL
        UNION ALL
        SELECT pii.pii_id, a.pia_lot_id, a.pia_bucket, a.pia_godown_id, a.pia_batch_no, a.pia_expiry_date, a.pia_mrp, a.pia_qty + a.pia_free_qty,
               pii.pii_line_no, a.pia_row_no
          FROM purchase.pur_invoice_item pii
          JOIN purchase.pur_item_alloc a ON a.pia_doc_type = 'GRN' AND a.pia_line_id = pii.pii_src_item_id AND a.pia_acc_year = pii.pii_src_doc_year
         WHERE ${src.docType} = 'PURCHASE_BILL' AND pii.pii_pi_id = ${src.id}::uuid AND pii.pii_acc_year = ${src.accYear}::bpchar
           AND pii.pii_src_doc_type = 'GRN' AND NOT pii.pii_is_deleted AND NOT a.pia_is_deleted AND a.pia_lot_id IS NOT NULL
      ) x
       ORDER BY line_no, row_no`;
  }

  /** GRN lines already billed (line id → the bill's number): their goods go back against the bill, not the GRN. */
  private async billedGrnLines(db: Tx | PrismaService, grnId: string) {
    const rows = await db.$queryRaw<{ id: string; refno: string }[]>`
      SELECT x.pii_src_item_id AS id, p.pi_refno AS refno FROM purchase.pur_invoice_item x
        JOIN purchase.pur_invoice p ON p.pi_id = x.pii_pi_id AND p.pi_acc_year = x.pii_acc_year
       WHERE x.pii_src_doc_type = 'GRN' AND x.pii_src_doc_id = ${grnId}::uuid AND NOT x.pii_is_deleted
         AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED'`;
    return new Map(rows.map((r) => [r.id, r.refno]));
  }

  /** Per-unit money of a source line × qty → the row's figures (rounded per head, total = Σ). */
  private money(s: SourceLine, qty: Prisma.Decimal) {
    const per = (v: Prisma.Decimal) => (s.basisQty.isZero() ? ZERO : r2(v.times(qty).dividedBy(s.basisQty)));
    const taxable = per(s.taxable), cgst = per(s.cgst), sgst = per(s.sgst), igst = per(s.igst), cess = per(s.cess);
    return { taxable, cgst, sgst, igst, cess, tax: cgst.plus(sgst).plus(igst).plus(cess), total: taxable.plus(cgst).plus(sgst).plus(igst).plus(cess) };
  }

  // ── the pickers ───────────────────────────────────────────────────────
  /** A supplier's posted bills / GRNs with something still returnable (newest first, 60). */
  async sources(q: SourcesQueryDto) {
    if (q.kind === 'AGAINST_INVOICE') {
      return jsonSafe(await this.prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT pi.pi_id AS "srcDocId", pi.pi_acc_year AS "srcAccYear", pi.pi_refno AS "refno", pi.pi_supplier_inv_no AS "supplierRef",
               pi.pi_doc_date AS "docDate", pi.pi_net_payable AS "amount"
          FROM purchase.pur_invoice pi
         WHERE pi.pi_company_id = ${q.companyId}::uuid AND pi.pi_branch_id = ${q.branchId}::uuid AND pi.pi_supplier_id = ${q.supplierId}::uuid
           AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted
         ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC LIMIT 60`);
    }
    return jsonSafe(await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT g.grn_id AS "srcDocId", g.grn_acc_year AS "srcAccYear", g.grn_refno AS "refno", g.grn_challan_no AS "supplierRef",
             g.grn_doc_date AS "docDate", g.grn_provisional_value AS "amount"
        FROM purchase.pur_grn g
       WHERE g.grn_company_id = ${q.companyId}::uuid AND g.grn_branch_id = ${q.branchId}::uuid AND g.grn_supplier_id = ${q.supplierId}::uuid
         AND g.grn_status = 'POSTED' AND NOT g.grn_is_deleted
       ORDER BY g.grn_doc_date DESC, g.grn_created_on DESC LIMIT 60`);
  }

  /** The source document's lines: what came in, what is already returned, what can still go, per-unit money, the lots. */
  async sourceLinesView(q: SourceLinesQueryDto) {
    const src = await this.sourceDoc(this.prisma, q.kind, q.srcDocId, q.srcAccYear);
    const [lines, returned, lots] = await Promise.all([
      this.sourceLines(this.prisma, src), this.returnedQty(this.prisma, src.id, q.exceptPrId), this.sourceLots(this.prisma, src),
    ]);
    const names = await unitNames(this.prisma, [...lines.values()].map((l) => l.uomId));
    const [sup] = await this.prisma.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${src.supplierId}::uuid`;
    return jsonSafe({
      source: { ...src, supplierName: sup?.sup_name ?? null },
      lines: [...lines.values()].map((l) => {
        const done = returned.get(l.srcItemId) ?? ZERO;
        const one = this.money(l, D(1));
        return {
          srcItemId: l.srcItemId, lineNo: l.lineNo, itemId: l.itemId, uomId: l.uomId, ...names.get(l.uomId),
          inQty: l.inQty, returnedQty: done, returnableQty: l.inQty.minus(done).isNegative() ? ZERO : l.inQty.minus(done),
          rate: l.rate, gstPct: l.gstPct, unitTaxable: l.basisQty.isZero() ? ZERO : l.taxable.dividedBy(l.basisQty).toDecimalPlaces(4),
          unitTotal: one.total,
          lots: lots.filter((x) => x.line_id === l.srcItemId).map((x) => ({ lotId: x.lot_id, bucket: x.bucket, godownId: x.godown_id, batchNo: x.batch_no, expiryDate: x.expiry, mrp: x.mrp, qty: x.qty })),
        };
      }),
    });
  }

  // ── save / post ───────────────────────────────────────────────────────
  /** purchase.return_settlement_default: ADJUST / ADVANCE; CASH is settled by a Receipt, so the return itself stays ADJUST. */
  private async defaultSettlement(tx: Prisma.TransactionClient, companyId: string, branchId: string) {
    const st = await loadPurchaseSettings(tx, companyId, branchId);
    return st.returnSettlementDefault === 'ADVANCE' ? 'ADVANCE' : 'ADJUST';
  }

  async save(dto: SaveReturnDto) {
    const actor = this.actor();
    const h = dto.header;
    const id = await this.prisma.$transaction(async (tx) => {
      const src = await this.sourceDoc(tx, h.kind, h.srcDocId, h.srcAccYear);
      if (src.status !== 'POSTED') purConflict(`${src.refno} is ${src.status} — only a posted ${h.kind === 'AGAINST_GRN' ? 'GRN' : 'bill'} takes a return.`, PUR.NOT_POSTED, 'header.srcDocId');
      const lines = await this.sourceLines(tx, src);
      const lots = await this.sourceLots(tx, src);
      const returned = await this.returnedQty(tx, src.id, h.prId);
      const billed = src.docType === 'GRN' ? await this.billedGrnLines(tx, src.id) : new Map<string, string>();

      const problems: { field: string; code: string; message: string }[] = [];
      const want = new Map<string, Prisma.Decimal>();
      const resolved = dto.lines.map((l, i) => {
        const s = lines.get(l.srcItemId);
        if (!s) { problems.push({ field: `lines.${i}.srcItemId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: that line is not on ${src.refno}` }); return null; }
        if (billed.has(l.srcItemId)) problems.push({ field: `lines.${i}.srcItemId`, code: PUR.GRN_LINE_BILLED, message: `Line ${l.lineNo}: ${src.refno} line ${s.lineNo} is billed in ${billed.get(l.srcItemId)} — return it against that bill` });
        const q = D(l.qty).plus(D(l.freeQty));
        if (!q.greaterThan(0)) problems.push({ field: `lines.${i}.qty`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: nothing to return` });
        want.set(l.srcItemId, (want.get(l.srcItemId) ?? ZERO).plus(q));
        if (h.kind === 'AGAINST_GRN' && l.outcome !== 'RETURN') problems.push({ field: `lines.${i}.outcome`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: goods not yet billed can only be RETURNED — claim after the bill` });
        const claim = l.outcome === 'CLAIM_SENT' || l.outcome === 'CLAIM_DESTROYED';
        const against = claim ? (l.claimAgainst ?? 'SUPPLIER') : null;
        if (claim && against !== 'SUPPLIER' && !l.claimPartyId) problems.push({ field: `lines.${i}.claimPartyId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: name the ${against?.toLowerCase()} the claim is on` });
        const bucket = l.bucket ?? 'SALEABLE';
        // one lot can sit in two holdings (saleable + damaged): the row's bucket always decides which
        const mine = lots.filter((x) => x.line_id === l.srcItemId && x.bucket === bucket);
        const lot = l.lotId ? mine.find((x) => x.lot_id === l.lotId) : mine[0];
        if (!lot) problems.push({ field: `lines.${i}.lotId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: ${src.refno} line ${s.lineNo} brought nothing into ${bucket.toLowerCase()} to return from` });
        return { l, s, bucket, lot, against, claimParty: claim ? (against === 'SUPPLIER' ? src.supplierId : l.claimPartyId!) : null };
      });
      for (const [srcItemId, q] of want) {
        const s = lines.get(srcItemId);
        if (!s) continue;
        const left = s.inQty.minus(returned.get(srcItemId) ?? ZERO);
        if (q.greaterThan(left)) problems.push({ field: 'lines', code: 'PUR_RETURN_QTY_EXCEEDS', message: `${src.refno} line ${s.lineNo}: ${q} to return, only ${left.isNegative() ? 0 : left} left of what came in` });
      }
      if (problems.length) purRefuseMany(problems[0].message, problems);

      let prId = h.prId ?? null;
      let slno: bigint, refno: string, isNew = false;
      if (prId) {
        const cur = await tx.purReturn.findFirst({ where: { prId, prAccYear: h.accYear, prIsDeleted: false } });
        if (!cur) purNotFound(`Return ${prId} not found`);
        if (cur.prStatus !== 'DRAFT') purConflict(`${cur.prRefno} is ${cur.prStatus} — only a draft can be edited.`, PUR.NOT_DRAFT, 'prId');
        slno = cur.prSlno; refno = cur.prRefno;
        await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC, piaDocId: prId, piaAccYear: h.accYear } });
        await tx.purReturnItem.deleteMany({ where: { priPrId: prId, priAccYear: h.accYear } });
      } else {
        ({ slno, refno } = await allocateDocNumber(tx, 'PRN', h.companyId, h.branchId, h.accYear, h.deviceId));
        isNew = true;
      }

      let returnValue = ZERO, claimValue = ZERO, itcReversed = ZERO, replaceBase = ZERO;
      const rows = resolved.map((r) => {
        const m = this.money(r!.s, D(r!.l.qty));    // free goods carry no money
        const o = r!.l.outcome;
        if (o === 'RETURN') returnValue = returnValue.plus(m.total);
        if (o === 'CLAIM_SENT') claimValue = claimValue.plus(m.total);
        if (o === 'CLAIM_DESTROYED') { claimValue = claimValue.plus(m.taxable); itcReversed = itcReversed.plus(m.tax); }
        if (o === 'REPLACE') replaceBase = replaceBase.plus(D(r!.l.qty).plus(D(r!.l.freeQty)).times(r!.s.factor));
        return { ...r!, m };
      });
      const data = {
        prCompanyId: h.companyId, prBranchId: h.branchId, prAccYear: h.accYear, prDeviceId: h.deviceId, prSlno: slno, prRefno: refno,
        prDocDate: dateOf(h.docDate)!, prKind: h.kind, prSrcDocId: src.id, prSrcAccYear: src.accYear, prSupplierId: src.supplierId,
        prGodownId: rows[0]?.lot?.godown_id ?? null, prSettlement: h.settlement ?? await this.defaultSettlement(tx, h.companyId, h.branchId),
        prSupplierCnNo: h.supplierCnNo ?? null, prSupplierCnDate: dateOf(h.supplierCnDate), prEwbNo: h.ewbNo ?? null,
        prVehicleNo: h.vehicleNo ?? null, prDriverName: h.driverName ?? null, prOurRef: src.refno,
        prReturnValue: returnValue, prClaimValue: claimValue, prItcReversed: itcReversed, prReplaceQtyBase: replaceBase,
        prRemarks: h.remarks ?? null, prStatus: 'DRAFT',
      };
      if (isNew) prId = (await tx.purReturn.create({ data: { ...data, prCreatedBy: actor }, select: { prId: true } })).prId;
      else await tx.purReturn.update({ where: { prId_prAccYear: { prId: prId!, prAccYear: h.accYear } }, data: { ...data, prModifiedBy: actor, prModifiedOn: new Date(), prRevisionNo: { increment: 1 } } });

      for (const r of rows) {
        const { l, s, m } = r;
        const row = await tx.purReturnItem.create({ data: {
          priPrId: prId!, priCompanyId: h.companyId, priBranchId: h.branchId, priAccYear: h.accYear, priLineNo: l.lineNo,
          priItemId: s.itemId, priUomId: s.uomId, priBaseUomId: s.baseUomId, priToBaseFactor: s.factor, priHsnCode: s.hsn,
          priSrcDocType: src.docType, priSrcDocId: src.id, priSrcDocYear: src.accYear, priSrcItemId: s.srcItemId, priSrcDocLineNo: s.lineNo, priSrcDocRefno: src.refno,
          priOutcome: l.outcome, priReasonId: l.reasonId ?? null, priQty: D(l.qty), priFreeQty: D(l.freeQty), priRate: s.rate,
          priGrossAmt: m.taxable, priTaxableAmt: m.taxable, priTaxId: s.taxId, priGstPct: s.gstPct,
          priCgstAmt: m.cgst, priSgstAmt: m.sgst, priIgstAmt: m.igst, priCessAmt: m.cess, priTotalAmt: m.total,
          priItcReversedInBooks: l.outcome !== 'REPLACE' && h.kind === 'AGAINST_INVOICE',
          priSupplierCnStatus: l.outcome === 'RETURN' && h.kind === 'AGAINST_INVOICE' ? 'PENDING' : 'NONE',
          priClaimAgainst: r.against, priClaimPartyId: r.claimParty, priRemarks: l.remarks ?? null, priCreatedBy: actor,
        }, select: { priId: true } });
        await tx.purItemAlloc.create({ data: {
          piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC, piaDocId: prId!, piaLineId: row.priId, piaRowNo: 1,
          piaGodownId: r.lot!.godown_id, piaBucket: r.lot!.bucket, piaLotId: r.lot!.lot_id, piaBatchNo: r.lot!.batch_no, piaExpiryDate: r.lot!.expiry, piaMrp: r.lot!.mrp,
          piaQty: D(l.qty), piaFreeQty: D(l.freeQty), piaCreatedBy: actor,
        } });
      }
      if (isNew) await statusLog(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: TxnStatusDocType.PURCHASE_RETURN, docId: prId!, refno, event: TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
      if (h.post) await this.postInTx(tx, prId!, h.accYear, actor);
      return prId!;
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(id, h.accYear);
  }

  async post(prId: string, accYear: string) {
    const actor = this.actor();
    await this.prisma.$transaction((tx) => this.postInTx(tx, prId, accYear, actor), { timeout: 60000, maxWait: 10000 });
    return this.get(prId, accYear);
  }

  private async postInTx(tx: Tx, prId: string, accYear: string, actor: string) {
    const pr = await tx.purReturn.findFirst({ where: { prId, prAccYear: accYear, prIsDeleted: false } });
    if (!pr) purNotFound(`Return ${prId} not found`);
    if (pr.prStatus !== 'DRAFT') purConflict(`${pr.prRefno} is ${pr.prStatus} — only a draft can be posted.`, PUR.NOT_DRAFT, 'prId');
    const lines = await tx.purReturnItem.findMany({ where: { priPrId: prId, priAccYear: accYear, priIsDeleted: false }, orderBy: { priLineNo: 'asc' } });
    // WS6: a GRN line billed after this draft was saved — its goods now go back against the bill (a bill no longer waits for a draft return)
    if (pr.prKind === 'AGAINST_GRN') {
      const billed = await this.billedGrnLines(tx, pr.prSrcDocId);
      const hit = lines.find((l) => l.priSrcItemId && billed.has(l.priSrcItemId));
      if (hit) purConflict(`${pr.prRefno} line ${hit.priLineNo}: that GRN line is now billed in ${billed.get(hit.priSrcItemId!)} — cancel this draft and return the goods against the bill.`, PUR.GRN_LINE_BILLED, 'prId');
    }
    const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: prId, piaAccYear: accYear, piaIsDeleted: false } });
    const allocOf = new Map(allocs.map((a) => [a.piaLineId, a]));
    const postedOn = new Date();
    const docDate = isoDate(pr.prDocDate);

    // ── 1 · stock: out of the exact lot, priced by the engine at that lot's cost
    const { perRow } = await postShadowStock(tx, this.stockPosting,
      { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, deviceId: pr.prDeviceId, sessionId: pr.prSessionId, docType: DOC, docId: prId,
        refno: pr.prRefno, revision: pr.prRevisionNo, usrRefno: pr.prSupplierCnNo, docDate, supplierId: pr.prSupplierId, remarks: `Return ${pr.prRefno} (${pr.prOurRef})` },
      this.rules(),
      lines.map((l) => {
        const a = allocOf.get(l.priId)!;
        return { itemId: l.priItemId, uomId: l.priUomId, baseUomId: l.priBaseUomId, factor: l.priToBaseFactor, godownId: a.piaGodownId, bucket: a.piaBucket,
          lotId: a.piaLotId, batchNo: a.piaBatchNo, expiryDate: a.piaExpiryDate, mrp: a.piaMrp, supplierId: pr.prSupplierId,
          qty: l.priQty, freeQty: l.priFreeQty, costRate: ZERO };
      }),
      actor, postedOn);
    for (let i = 0; i < lines.length; i++) {
      const a = allocOf.get(lines[i].priId)!;
      await tx.purReturnItem.update({ where: { priId_priAccYear: { priId: lines[i].priId, priAccYear: accYear } }, data: { priLotCostValue: perRow[i].cost } });
      if (perRow[i].sviId) await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: a.piaId, piaAccYear: accYear } }, data: { piaSviId: perRow[i].sviId, piaSviAccYear: accYear } });
    }

    // ── 2 · books
    const vt = await voucherTypeId(tx, 'PRN');
    const nature = lines.some((l) => l.priIgstAmt.greaterThan(0)) ? 'INTER' : 'INTRA';
    const legs: VoucherLeg[] = [];
    const add = (leg: VoucherLeg) => { if (leg.amount >= 0.005) legs.push(leg); };
    const claimByParty = new Map<string, Prisma.Decimal>();
    let supplierDr = ZERO, grniDr = ZERO, replaceDr = ZERO, itcRev = ZERO, stockCr = ZERO;
    const inputCr = new Map<string, { role: string; taxId: string | null; amt: Prisma.Decimal }>();
    const creditInput = (l: (typeof lines)[number]) => {
      for (const [role, v] of [['INPUT_CGST', l.priCgstAmt], ['INPUT_SGST', l.priSgstAmt], ['INPUT_IGST', l.priIgstAmt], ['INPUT_CESS', l.priCessAmt]] as const) {
        if (v.isZero()) continue;
        const k = `${role}|${l.priTaxId ?? ''}`;
        const cur = inputCr.get(k) ?? { role, taxId: l.priTaxId, amt: ZERO };
        cur.amt = cur.amt.plus(v);
        inputCr.set(k, cur);
      }
    };
    lines.forEach((l, i) => {
      stockCr = stockCr.plus(perRow[i].cost);
      const tax = l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt);
      if (pr.prKind === 'AGAINST_GRN') { grniDr = grniDr.plus(l.priTaxableAmt); return; }
      switch (l.priOutcome) {
        case 'RETURN': supplierDr = supplierDr.plus(l.priTotalAmt); creditInput(l); break;
        case 'CLAIM_SENT': claimByParty.set(l.priClaimPartyId!, (claimByParty.get(l.priClaimPartyId!) ?? ZERO).plus(l.priTotalAmt)); creditInput(l); break;
        case 'CLAIM_DESTROYED': claimByParty.set(l.priClaimPartyId!, (claimByParty.get(l.priClaimPartyId!) ?? ZERO).plus(l.priTaxableAmt)); itcRev = itcRev.plus(tax); creditInput(l); break;
        case 'REPLACE': replaceDr = replaceDr.plus(l.priTaxableAmt); break;
      }
    });
    add({ ledgerId: pr.prSupplierId, drCr: 'DR', amount: num2(supplierDr), remarks: `Return ${pr.prRefno} against ${pr.prOurRef}`, docRefno: pr.prRefno });
    add({ role: 'GRNI', drCr: 'DR', amount: num2(grniDr), roleTag: 'GRNI', remarks: `Return ${pr.prRefno} against ${pr.prOurRef}` });
    for (const [, amt] of claimByParty) add({ role: 'CLAIM_RECEIVABLE', drCr: 'DR', amount: num2(amt), roleTag: 'CLAIM_RECEIVABLE', remarks: `Claim · ${pr.prRefno}` });
    add({ role: 'SHORTAGE_RECEIVABLE', drCr: 'DR', amount: num2(replaceDr), roleTag: 'SHORTAGE_RECEIVABLE', remarks: `Replacement due · ${pr.prRefno}` });
    add({ role: 'ITC_REVERSAL', drCr: 'DR', amount: num2(itcRev), roleTag: 'ITC_REVERSAL', remarks: `GST on destroyed goods · ${pr.prRefno}` });
    for (const v of inputCr.values()) add({ role: v.role, drCr: 'CR', amount: num2(v.amt), taxId: v.taxId, supplyNature: nature as never, roleTag: v.role });
    add({ role: 'INVENTORY', drCr: 'CR', amount: num2(stockCr), roleTag: 'INVENTORY', remarks: `Return ${pr.prRefno}` });
    // the bill value vs the lot cost: the balancing leg, exact to the paisa
    const cents = (x: number) => Math.round(x * 100);
    const dr = legs.filter((g) => g.drCr === 'DR').reduce((s, g) => s + cents(g.amount), 0);
    const cr = legs.filter((g) => g.drCr === 'CR').reduce((s, g) => s + cents(g.amount), 0);
    if (dr !== cr) add({ role: 'PURCHASE_PRICE_VARIANCE', drCr: dr > cr ? 'CR' : 'DR', amount: Math.abs(dr - cr) / 100, roleTag: 'PURCHASE_PRICE_VARIANCE', remarks: `Bill value vs lot cost · ${pr.prRefno}` });

    const docAmount = supplierDr.plus(grniDr).plus([...claimByParty.values()].reduce((s, v) => s.plus(v), ZERO)).plus(replaceDr);
    const posted = await this.vouchers.postLegs(tx, {
      header: { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: DOC, srcDocId: prId,
        docLabel: 'Purchase Return', docRefno: pr.prRefno, docDate, usrRefno: pr.prSupplierCnNo, docAmount: num2(docAmount), partyId: pr.prSupplierId,
        userId: actor, sessionId: pr.prSessionId, deviceId: pr.prDeviceId, remarks: pr.prRemarks ?? `Return against ${pr.prOurRef}`, createdBy: actor,
        presetRefno: pr.prRefno, presetNo: pr.prSlno },
      legs,
    });
    // bill-wise: the supplier owes us the RETURN value (set off on the next payment, or kept as advance)
    await raiseBillRow(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, partyId: pr.prSupplierId, billType: 'PURCHASE_RETURN', drCr: 'DR',
      amount: supplierDr, docType: DOC, docId: prId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: pr.prSlno, voucherDate: docDate,
      refno: pr.prRefno, docDate: pr.prDocDate, narration: `Return ${pr.prRefno} against ${pr.prOurRef}${pr.prSettlement === 'ADVANCE' ? ' (advance)' : ''}`, actor });
    // REPLACE rows open a qty shortage the Shortage Receipt (menu 195) closes
    for (const l of lines.filter((x) => x.priOutcome === 'REPLACE')) {
      const base = l.priQty.plus(l.priFreeQty).times(l.priToBaseFactor);
      await tx.purShortage.create({ data: {
        pshCompanyId: pr.prCompanyId, pshBranchId: pr.prBranchId, pshAccYear: accYear, pshSupplierId: pr.prSupplierId, pshItemId: l.priItemId,
        pshSrcDocType: DOC, pshSrcDocId: prId, pshSrcDocYear: accYear, pshSrcItemId: l.priId, pshSrcDocRefno: pr.prRefno,
        pshReason: 'REPLACE', pshQtyBase: base, pshValue: l.priTaxableAmt, pshGstPending: ZERO,
        pshOriginCostRate: base.isZero() ? ZERO : l.priTaxableAmt.dividedBy(base).toDecimalPlaces(6), pshCreatedBy: actor,
      } });
    }
    await tx.purReturn.update({ where: { prId_prAccYear: { prId, prAccYear: accYear } }, data: { prStatus: 'POSTED', prPostedVoucherId: posted.voucherId, prModifiedBy: actor, prModifiedOn: postedOn } });
    await statusLog(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, docType: TxnStatusDocType.PURCHASE_RETURN, docId: prId, refno: pr.prRefno, event: TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: pr.prDeviceId });
  }

  async get(prId: string, accYear: string) {
    const header = await this.prisma.purReturn.findFirst({ where: { prId, prAccYear: accYear, prIsDeleted: false } });
    if (!header) purNotFound(`Return ${prId} not found`);
    const [lines, allocs, sup] = await Promise.all([
      this.prisma.purReturnItem.findMany({ where: { priPrId: prId, priAccYear: accYear, priIsDeleted: false }, orderBy: { priLineNo: 'asc' } }),
      this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: prId, piaAccYear: accYear, piaIsDeleted: false } }),
      this.prisma.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.prSupplierId}::uuid`,
    ]);
    const names = await unitNames(this.prisma, lines.map((l) => l.priUomId));
    const settled = await this.settledByItem(this.prisma, lines.map((l) => l.priId));
    return jsonSafe({
      header: { ...header, supplierName: sup[0]?.sup_name ?? null },
      lines: lines.map((l) => {
        const a = allocs.find((x) => x.piaLineId === l.priId);
        const claimValue = this.claimValueOf(l);
        const done = settled.get(l.priId) ?? ZERO;
        return { ...l, ...names.get(l.priUomId), bucket: a?.piaBucket ?? null, lotId: a?.piaLotId ?? null, batchNo: a?.piaBatchNo ?? null, expiryDate: a?.piaExpiryDate ?? null,
          claimValue, claimSettled: done, claimOpen: claimValue.minus(done) };
      }),
    });
  }

  async cancel(dto: ReturnCancelDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const pr = await tx.purReturn.findFirst({ where: { prId: dto.prId, prAccYear: dto.accYear, prIsDeleted: false } });
      if (!pr) purNotFound(`Return ${dto.prId} not found`);
      if (pr.prStatus === 'CANCELLED') purConflict(`${pr.prRefno} is already cancelled.`, PUR.NOT_POSTED, 'prId');
      // R18: a bill's debit note for goods rejected at the GRN (rows with no allocation) lives and dies with that bill
      const [own] = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM purchase.pur_return_item ri
         WHERE ri.pri_pr_id = ${dto.prId}::uuid AND ri.pri_acc_year = ${dto.accYear}::bpchar AND NOT ri.pri_is_deleted
           AND NOT EXISTS (SELECT 1 FROM purchase.pur_item_alloc a WHERE a.pia_doc_type = ${DOC} AND a.pia_line_id = ri.pri_id AND a.pia_acc_year = ri.pri_acc_year AND NOT a.pia_is_deleted)`;
      if (Number(own.n) > 0) purConflict(`${pr.prRefno} is the debit note of bill ${pr.prOurRef ?? ''} for goods rejected at the GRN — it is cancelled with that bill.`, PUR.EDIT_LOCKED_PAID, 'prId');
      if (pr.prKind === 'AGAINST_GRN' && pr.prStatus === 'POSTED') {
        const billed = await this.billedGrnLines(tx, pr.prSrcDocId);
        const [hit] = await tx.$queryRaw<{ id: string }[]>`
          SELECT pri_src_item_id AS id FROM purchase.pur_return_item WHERE pri_pr_id = ${dto.prId}::uuid AND pri_acc_year = ${dto.accYear}::bpchar
             AND NOT pri_is_deleted AND pri_src_item_id = ANY(${[...billed.keys()]}::uuid[]) LIMIT 1`;
        if (hit) purConflict(`${pr.prRefno}: its GRN line is billed in ${billed.get(hit.id)} — cancel that bill first.`, PUR.GRN_LINE_BILLED, 'prId');
      }
      if (pr.prStatus === 'POSTED') {
        await assertBillsUnsettled(tx, DOC, dto.prId, pr.prRefno);
        await assertShortagesUntouched(tx, dto.prId, pr.prRefno);
        const items = await tx.purReturnItem.findMany({ where: { priPrId: dto.prId, priAccYear: dto.accYear, priIsDeleted: false }, select: { priId: true } });
        const settled = await this.settledByItem(tx, items.map((i) => i.priId));
        if ([...settled.values()].some((v) => !v.isZero())) purConflict(`${pr.prRefno}: a claim on it is already settled — undo the settlement first.`, PUR.EDIT_LOCKED_PAID, 'prId');
        await cancelShadowStock(tx, this.stockPosting, DOC, dto.prId, dto.accYear, pr.prCompanyId, pr.prBranchId, this.rules(), actor, dto.reason);
        if (pr.prPostedVoucherId) await this.vouchers.reverseLegs(tx, pr.prPostedVoucherId, dto.accYear, `Return ${pr.prRefno} cancelled: ${dto.reason}`, actor);
        await withdrawBillRows(tx, DOC, dto.prId, actor);
        await tx.purShortage.updateMany({ where: { pshSrcDocType: DOC, pshSrcDocId: dto.prId, pshIsDeleted: false }, data: { pshIsDeleted: true, pshModifiedBy: actor, pshModifiedOn: new Date() } });
      }
      await tx.purReturn.update({ where: { prId_prAccYear: { prId: dto.prId, prAccYear: dto.accYear } }, data: { prStatus: 'CANCELLED', prModifiedBy: actor, prModifiedOn: new Date() } });
      await statusLog(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear: dto.accYear, docType: TxnStatusDocType.PURCHASE_RETURN, docId: dto.prId, refno: pr.prRefno, event: TxnStatusEvent.CANCELLED, from: pr.prStatus, to: 'CANCELLED', actor, remarks: dto.reason });
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(dto.prId, dto.accYear);
  }

  // ── claims ────────────────────────────────────────────────────────────
  /** What a claim row is worth: goods sent = value + GST; destroyed = value (its GST was reversed as a cost). */
  private claimValueOf(l: { priOutcome: string; priTotalAmt: Prisma.Decimal; priTaxableAmt: Prisma.Decimal }) {
    return l.priOutcome === 'CLAIM_SENT' ? l.priTotalAmt : l.priOutcome === 'CLAIM_DESTROYED' ? l.priTaxableAmt : ZERO;
  }

  /** Σ settlement amounts per return row (reversals are negative, so an undone settlement nets to 0). */
  private async settledByItem(db: Tx | PrismaService, priIds: string[]) {
    if (!priIds.length) return new Map<string, Prisma.Decimal>();
    const rows = await db.$queryRaw<{ id: string; s: Prisma.Decimal }[]>`
      SELECT pcs_return_item_id AS id, SUM(pcs_amount) AS s FROM purchase.pur_claim_settlement
       WHERE pcs_return_item_id = ANY(${priIds}::uuid[]) AND NOT pcs_is_deleted GROUP BY 1`;
    return new Map(rows.map((r) => [r.id, D(r.s)]));
  }

  async openClaims(q: OpenClaimsQueryDto) {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT pri.pri_id AS "returnItemId", pri.pri_acc_year AS "accYear", pr.pr_id AS "prId", pr.pr_refno AS "refno", pr.pr_doc_date AS "docDate",
             pri.pri_line_no AS "lineNo", im.item_name_en AS "itemName", pri.pri_outcome AS "outcome", pri.pri_claim_against AS "claimAgainst",
             pri.pri_claim_party_id AS "claimPartyId", lm.led_name AS "partyName", pr.pr_supplier_id AS "supplierId",
             CASE pri.pri_outcome WHEN 'CLAIM_SENT' THEN pri.pri_total_amt ELSE pri.pri_taxable_amt END AS "claimValue",
             COALESCE((SELECT SUM(pcs_amount) FROM purchase.pur_claim_settlement s WHERE s.pcs_return_item_id = pri.pri_id AND NOT s.pcs_is_deleted), 0) AS "settled",
             (SELECT s.pcs_id FROM purchase.pur_claim_settlement s WHERE s.pcs_return_item_id = pri.pri_id AND NOT s.pcs_is_deleted AND s.pcs_reversal_of_id IS NULL
                 AND NOT EXISTS (SELECT 1 FROM purchase.pur_claim_settlement u WHERE u.pcs_reversal_of_id = s.pcs_id AND NOT u.pcs_is_deleted)
               ORDER BY s.pcs_created_on DESC LIMIT 1) AS "lastSettlementId"
        FROM purchase.pur_return_item pri
        JOIN purchase.pur_return pr ON pr.pr_id = pri.pri_pr_id AND pr.pr_acc_year = pri.pri_acc_year
        JOIN inventory.item_master im ON im.item_id = pri.pri_item_id
        LEFT JOIN accounts.acc_ledger_master lm ON lm.led_id = pri.pri_claim_party_id
       WHERE pr.pr_company_id = ${q.companyId}::uuid AND pr.pr_branch_id = ${q.branchId}::uuid AND pr.pr_status = 'POSTED' AND NOT pr.pr_is_deleted
         AND NOT pri.pri_is_deleted AND pri.pri_outcome IN ('CLAIM_SENT', 'CLAIM_DESTROYED')
         AND (${q.supplierId ?? null}::uuid IS NULL OR pr.pr_supplier_id = ${q.supplierId ?? null}::uuid)
       ORDER BY pr.pr_doc_date, pr.pr_refno, pri.pri_line_no`;
    return jsonSafe(rows.map((r) => ({ ...r, open: D(r.claimValue as Prisma.Decimal).minus(D(r.settled as Prisma.Decimal)) })));
  }

  async settle(dto: SettleClaimDto) {
    const actor = this.actor();
    const out = await this.prisma.$transaction(async (tx) => {
      const l = await tx.purReturnItem.findFirst({ where: { priId: dto.returnItemId, priAccYear: dto.accYear, priIsDeleted: false } });
      if (!l) purNotFound(`Return row ${dto.returnItemId} not found`);
      const pr = await tx.purReturn.findFirst({ where: { prId: l.priPrId, prAccYear: dto.accYear, prIsDeleted: false } });
      if (!pr || pr.prStatus !== 'POSTED') purConflict('Only a claim on a posted return is settled.', PUR.NOT_POSTED, 'returnItemId');
      if (l.priOutcome !== 'CLAIM_SENT' && l.priOutcome !== 'CLAIM_DESTROYED') purConflict(`Line ${l.priLineNo} of ${pr.prRefno} is a ${l.priOutcome}, not a claim.`, PUR.QTY_INVALID, 'returnItemId');
      // one settlement at a time per claim row
      await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('purchase_claim'), hashtext(${dto.returnItemId})))::int AS locked`;
      const value = this.claimValueOf(l);
      const open = value.minus((await this.settledByItem(tx, [l.priId])).get(l.priId) ?? ZERO);
      if (!open.greaterThan(0)) purConflict(`The claim on ${pr.prRefno} line ${l.priLineNo} is fully settled.`, PUR.EDIT_LOCKED_PAID, 'returnItemId');
      const amount = dto.action === 'CREDIT' ? r2(D(dto.amount ?? open)) : open;
      if (!amount.greaterThan(0) || amount.greaterThan(open)) purRefuse(`Amount must be more than 0 and at most the open ${open.toFixed(2)}.`, PUR.QTY_INVALID, 'amount');

      const accYear = dto.settleAccYear ?? dto.accYear;
      const docDate = dto.docDate ?? isoDate(new Date());
      const party = l.priClaimPartyId!;
      const tax = l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt);
      const reavail = dto.action === 'REJECTED' && l.priOutcome === 'CLAIM_SENT' && !l.priTotalAmt.isZero() ? r2(tax.times(amount).dividedBy(l.priTotalAmt)) : ZERO;
      // each settlement row of a claim gets its own reference (the voucher header is unique on it)
      const [{ n: seq }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) + 1 AS n FROM purchase.pur_claim_settlement WHERE pcs_return_item_id = ${l.priId}::uuid`;
      const ref = `${pr.prRefno}/L${l.priLineNo}/S${seq}`;
      const s = await tx.purClaimSettlement.create({ data: {
        pcsCompanyId: pr.prCompanyId, pcsBranchId: pr.prBranchId, pcsAccYear: accYear, pcsDeviceId: dto.deviceId,
        pcsReturnItemId: l.priId, pcsReturnItemAccYear: dto.accYear, pcsAction: dto.action, pcsReceivedAs: dto.action === 'CREDIT' ? (dto.receivedAs ?? 'CN') : null,
        pcsAmount: amount, pcsGstReavailed: reavail, pcsCnNo: dto.cnNo ?? null, pcsCnDate: dateOf(dto.cnDate), pcsReason: dto.reason ?? null,
        pcsDocDate: dateOf(docDate)!, pcsCreatedBy: actor,
      }, select: { pcsId: true } });

      const label = `Claim ${pr.prRefno}/L${l.priLineNo}`;
      const legs: VoucherLeg[] = [{ role: 'CLAIM_RECEIVABLE', drCr: 'CR', amount: num2(amount), roleTag: 'CLAIM_RECEIVABLE', remarks: label }];
      if (dto.action === 'CREDIT') legs.push({ ledgerId: party, drCr: 'DR', amount: num2(amount), remarks: `${label} — credit${dto.cnNo ? ` CN ${dto.cnNo}` : ''}`, docRefno: pr.prRefno });
      else {
        if (reavail.greaterThan(0)) {
          // re-avail in the same heads the return reversed, in proportion
          const heads: [string, Prisma.Decimal][] = [['INPUT_CGST', l.priCgstAmt], ['INPUT_SGST', l.priSgstAmt], ['INPUT_IGST', l.priIgstAmt], ['INPUT_CESS', l.priCessAmt]];
          let given = ZERO;
          const live = heads.filter(([, v]) => !v.isZero());
          live.forEach(([role, v], k) => {
            const part = k === live.length - 1 ? reavail.minus(given) : r2(reavail.times(v).dividedBy(tax));
            given = given.plus(part);
            legs.push({ role, drCr: 'DR', amount: num2(part), taxId: l.priTaxId, supplyNature: (l.priIgstAmt.greaterThan(0) ? 'INTER' : 'INTRA') as never, roleTag: role, remarks: `${label} — GST re-availed` });
          });
        }
        legs.push({ role: 'WRITE_OFF', drCr: 'DR', amount: num2(amount.minus(reavail)), roleTag: 'WRITE_OFF', remarks: `${label} — ${dto.action === 'REJECTED' ? 'rejected' : 'short-settled'}` });
      }
      const vt = await voucherTypeId(tx, 'PCL');
      const posted = await this.vouchers.postLegs(tx, {
        header: { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: SETTLE_DOC, srcDocId: s.pcsId,
          docLabel: 'Claim settlement', docRefno: ref, docDate, usrRefno: dto.cnNo ?? null, docAmount: num2(amount), partyId: party,
          userId: actor, deviceId: dto.deviceId, remarks: dto.reason ?? `${label} ${dto.action.toLowerCase()}`, createdBy: actor },
        legs: legs.filter((g) => g.amount >= 0.005),
      });
      await tx.purClaimSettlement.update({ where: { pcsId_pcsAccYear: { pcsId: s.pcsId, pcsAccYear: accYear } }, data: { pcsVoucherId: posted.voucherId } });
      if (dto.action === 'CREDIT') {
        await raiseBillRow(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, partyId: party, billType: 'PURCHASE_RETURN', drCr: 'DR', amount,
          docType: SETTLE_DOC, docId: s.pcsId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: posted.voucherSlno, voucherDate: docDate,
          refno: posted.voucherRefno ?? ref, docDate: dateOf(docDate)!, narration: `${label} — credit${dto.cnNo ? ` CN ${dto.cnNo}` : ''}`, actor });
      }
      await statusLog(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, docType: TxnStatusDocType.CLAIM_SETTLEMENT, docId: s.pcsId, refno: ref,
        event: TxnStatusEvent.POSTED, from: null, to: dto.action, actor, deviceId: dto.deviceId, remarks: dto.reason ?? null });
      return { settlementId: s.pcsId, accYear, amount, open: open.minus(amount), voucherRefno: posted.voucherRefno };
    }, { timeout: 60000, maxWait: 10000 });
    return jsonSafe(out);
  }

  async settleUndo(dto: SettleUndoDto) {
    const actor = this.actor();
    const out = await this.prisma.$transaction(async (tx) => {
      const s = await tx.purClaimSettlement.findFirst({ where: { pcsId: dto.settlementId, pcsAccYear: dto.accYear, pcsIsDeleted: false } });
      if (!s) purNotFound(`Settlement ${dto.settlementId} not found`);
      if (s.pcsReversalOfId) purConflict('That row is itself an undo.', PUR.NOT_POSTED, 'settlementId');
      const [undone] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM purchase.pur_claim_settlement WHERE pcs_reversal_of_id = ${dto.settlementId}::uuid AND NOT pcs_is_deleted`;
      if (Number(undone.n) > 0) purConflict('That settlement is already undone.', PUR.NOT_POSTED, 'settlementId');
      await assertBillsUnsettled(tx, SETTLE_DOC, dto.settlementId, 'The credit');
      const rev = await tx.purClaimSettlement.create({ data: {
        pcsCompanyId: s.pcsCompanyId, pcsBranchId: s.pcsBranchId, pcsAccYear: s.pcsAccYear, pcsDeviceId: s.pcsDeviceId,
        pcsReturnItemId: s.pcsReturnItemId, pcsReturnItemAccYear: s.pcsReturnItemAccYear, pcsAction: s.pcsAction, pcsReceivedAs: s.pcsReceivedAs,
        pcsAmount: s.pcsAmount.negated(), pcsGstReavailed: s.pcsGstReavailed.negated(), pcsCnNo: s.pcsCnNo, pcsCnDate: s.pcsCnDate,
        pcsReason: dto.reason, pcsDocDate: new Date(), pcsReversalOfId: s.pcsId, pcsCreatedBy: actor,
      }, select: { pcsId: true } });
      if (s.pcsVoucherId) await this.vouchers.reverseLegs(tx, s.pcsVoucherId, s.pcsAccYear, `Claim settlement undone: ${dto.reason}`, actor);
      await withdrawBillRows(tx, SETTLE_DOC, s.pcsId, actor);
      return { reversalId: rev.pcsId, returnItemId: s.pcsReturnItemId };
    }, { timeout: 60000, maxWait: 10000 });
    return jsonSafe(out);
  }
}

@ApiTags('Purchase — Return / Claim')
@ApiBearerAuth()
@Controller('purchase')
export class PurchaseReturnController {
  constructor(private readonly service: PurchaseReturnService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: RETURN_MENU_ID, right, codePrefix: 'PRN', action });
  }
  @Post('returns/save') @Version(API_VERSION) @ApiOperation({ summary: 'Save a return draft (rows against a posted bill / GRN); header.post = true saves and posts.' })
  async save(@Body() dto: SaveReturnDto) {
    await this.right(dto.header.prId ? 'edit' : 'create', 'save a purchase return');
    if (dto.header.post) await this.right('post', 'post a purchase return');
    const data = await this.service.save(dto);
    return { success: true, message: `Return ${data.header.prRefno} ${dto.header.post ? 'posted' : 'saved as draft'}`, data };
  }
  @Post('returns/post') @Version(API_VERSION) @ApiOperation({ summary: 'Post a saved return draft: stock out of the exact lots, debit note / claim / replacement.' })
  async post(@Body() dto: ReturnRefDto) {
    await this.right('post', 'post a purchase return');
    const data = await this.service.post(dto.prId, dto.accYear);
    return { success: true, message: `Return ${data.header.prRefno} posted`, data };
  }
  @Get('returns/get') @Version(API_VERSION) @ApiOperation({ summary: 'A return with its rows, lots and each claim row\'s open amount.' })
  async get(@Query() q: ReturnRefDto) {
    await this.right('view', 'open a purchase return');
    return { success: true, message: 'Return fetched', data: await this.service.get(q.prId, q.accYear) };
  }
  @Post('returns/cancel') @Version(API_VERSION) @ApiOperation({ summary: 'Cancel a return: a posted one only while its debit is unadjusted and no claim settled.' })
  async cancel(@Body() dto: ReturnCancelDto) {
    await this.right('cancel', 'cancel a purchase return');
    const data = await this.service.cancel(dto);
    return { success: true, message: `Return ${data.header.prRefno} cancelled`, data };
  }
  @Get('returns/sources') @Version(API_VERSION) @ApiOperation({ summary: 'A supplier\'s posted bills (or GRNs) a return can be made against.' })
  async sources(@Query() q: SourcesQueryDto) {
    await this.right('view', 'pick a bill to return against');
    return { success: true, message: 'Sources fetched', data: await this.service.sources(q) };
  }
  @Get('returns/source-lines') @Version(API_VERSION) @ApiOperation({ summary: 'The lines of a bill / GRN: came in, already returned, returnable, per-unit money, lots.' })
  async sourceLines(@Query() q: SourceLinesQueryDto) {
    await this.right('view', 'read a bill to return against');
    return { success: true, message: 'Source lines fetched', data: await this.service.sourceLinesView(q) };
  }
  @Get('claims/open') @Version(API_VERSION) @ApiOperation({ summary: 'Claim rows of posted returns with value, settled and open.' })
  async openClaims(@Query() q: OpenClaimsQueryDto) {
    await this.right('view', 'see open claims');
    return { success: true, message: 'Claims fetched', data: await this.service.openClaims(q) };
  }
  @Post('claims/settle') @Version(API_VERSION) @ApiOperation({ summary: 'Settle a claim row: CREDIT (credit note from the party), SHORT_SETTLED (rest written off) or REJECTED.' })
  async settle(@Body() dto: SettleClaimDto) {
    await this.right('post', 'settle a claim');
    const data = await this.service.settle(dto);
    return { success: true, message: `Claim settled — ${data.voucherRefno ?? ''}`.trim(), data };
  }
  @Post('claims/settle-undo') @Version(API_VERSION) @ApiOperation({ summary: 'Undo a claim settlement: a reversing row, the voucher reversed.' })
  async settleUndo(@Body() dto: SettleUndoDto) {
    await this.right('cancel', 'undo a claim settlement');
    return { success: true, message: 'Settlement undone', data: await this.service.settleUndo(dto) };
  }
}
