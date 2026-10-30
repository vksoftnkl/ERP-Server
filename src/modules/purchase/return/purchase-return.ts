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
import { StatutoryService } from 'src/common/posting/statutory.service';
import { TransportBandService, type TransportBandInput } from 'src/modules/sales/posting/transport-band.service';
import { PurchaseTransportDto } from '../invoice/dto/save-purchase-invoice.dto';
import type { PurIssue } from '../invoice/purchase-invoice-checks';
import { loadPurchaseSettings } from '../common/purchase-settings';
import { RETURN_CLAIM_LOCK } from '../common/purchase-claim-locks';
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
 *   REPLACE          goods back, same goods due:  Dr Shortage receivable (value) / Cr Stock; Dr Input GST pending / Cr input GST
 *                    (plan §3.5 / §5, user 2026-10-29: ITC reversed now, re-claimed by the Shortage Receipt that brings the
 *                    replacement); a REPLACE shortage row opens with that GST as its pending GST
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
  @ApiPropertyOptional() @IsOptional() @IsDateString() ewbDate?: string;
  @ApiPropertyOptional({ description: 'The godown the goods leave from: each row\'s lot is taken in this godown (refused when the source line brought nothing there). Default: the first row\'s lot\'s godown.' })
  @IsOptional() @IsUUID() godownId?: string;
  @ApiPropertyOptional({ type: PurchaseTransportDto, nullable: true, description: 'The shared transport band (txn_transport_detail, OUTWARD: FROM this godown, TO the supplier) — transporter, LR no / date. Omit = keep; null = remove.' })
  @IsOptional() @ValidateNested() @Type(() => PurchaseTransportDto) transport?: PurchaseTransportDto | null;
  @ApiPropertyOptional({ nullable: true, description: 'The free-text "Our ref" typed on the return (pur_return.pr_memo_ref; get: header.prMemoRef). Omit = keep the saved one; null / blank = clear.' })
  @IsOptional() @IsString() @MaxLength(60) ourRef?: string | null;
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
export interface SettleResult {
  returnItemId: string; refno: string; lineNo: number; action: string; receivedAs: string | null; amount: Prisma.Decimal; gstReavailed: Prisma.Decimal;
  open: Prisma.Decimal; companyId: string; branchId: string; legs: VoucherLeg[]; dryRun: boolean; settlementId: string | null; accYear: string; voucherRefno: string | null;
}
interface SourceDoc { id: string; accYear: string; refno: string; supplierId: string; supplierInvNo: string | null; status: string; docType: 'PURCHASE_BILL' | 'GRN'; posStcd: string | null; branchId: string; docDate: Date }
/** "lines.3.qty" → the row's own number. */
const lineNoOf = (dto: SaveReturnDto, field: string) => {
  const m = /^lines\.(\d+)/.exec(field);
  return m ? dto.lines[Number(m[1])]?.lineNo ?? null : null;
};
const OUTCOME_TEXT: Record<string, string> = { RETURN: 'Return (debit note)', CLAIM_SENT: 'Claim — goods sent', CLAIM_DESTROYED: 'Claim — destroyed here', REPLACE: 'Replace' };

@Injectable()
export class PurchaseReturnService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService,
              private readonly vouchers: VoucherPostingService, private readonly stockPosting: StockPostingService,
              private readonly transportBand: TransportBandService, private readonly statutory: StatutoryService) {}

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
      return { id, accYear, refno: pi.piRefno, supplierId: pi.piSupplierId, supplierInvNo: pi.piSupplierInvNo, status: pi.piStatus, docType: 'PURCHASE_BILL',
               posStcd: pi.piPosStcd ?? null, branchId: pi.piBranchId, docDate: pi.piDocDate };
    }
    const g = await db.purGrn.findFirst({ where: { grnId: id, grnAccYear: accYear, grnIsDeleted: false } });
    if (!g) purNotFound(`GRN ${id} not found`);
    // a GRN has no place of supply of its own: our branch's state (no GST moves on a GRN return)
    const [st] = await db.$queryRaw<{ state: string | null }[]>`
      SELECT COALESCE(NULLIF(trim(b.br_state_code), ''), NULLIF(trim(c.comp_state_code), '')) AS state
        FROM public.branch_master b JOIN public.companys c ON c.comp_id = b.br_comp_id WHERE b.br_id = ${g.grnBranchId}::uuid`;
    return { id, accYear, refno: g.grnRefno, supplierId: g.grnSupplierId, supplierInvNo: g.grnChallanNo, status: g.grnStatus, docType: 'GRN',
             posStcd: st?.state?.trim().slice(0, 2) || null, branchId: g.grnBranchId, docDate: g.grnDocDate };
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

  /**
   * What a save works out before it writes, shared with /validate: the source, the rows resolved to their lots, the
   * money per row, the refusals (`problems` — a save throws them, /validate lists them), the place of supply (the bill's),
   * the godown the goods leave from.
   */
  private async prepare(db: Tx | PrismaService, dto: SaveReturnDto) {
    const h = dto.header;
    const src = await this.sourceDoc(db, h.kind, h.srcDocId, h.srcAccYear);
    const problems: { field: string; code: string; message: string }[] = [];
    if (src.status !== 'POSTED') problems.push({ field: 'header.srcDocId', code: PUR.NOT_POSTED, message: `${src.refno} is ${src.status} — only a posted ${h.kind === 'AGAINST_GRN' ? 'GRN' : 'bill'} takes a return.` });
    const lines = await this.sourceLines(db, src);
    const lots = await this.sourceLots(db, src);
    const returned = await this.returnedQty(db, src.id, h.prId);
    const billed = src.docType === 'GRN' ? await this.billedGrnLines(db, src.id) : new Map<string, string>();
    // per-row reasons: Stock Reasons (menu 293) — the purchase-return set
    const reasonIds = [...new Set(dto.lines.map((l) => l.reasonId).filter((x): x is string => !!x))];
    const reasonRows = reasonIds.length ? await db.$queryRaw<{ srm_id: string; srm_name: string }[]>`
      SELECT srm_id, srm_name FROM stock.stock_reason_master WHERE srm_id = ANY(${reasonIds}::uuid[]) AND NOT srm_is_deleted` : [];
    const reasonName = new Map(reasonRows.map((r) => [r.srm_id, r.srm_name]));

    const want = new Map<string, Prisma.Decimal>();
    const resolved = dto.lines.map((l, i) => {
      const s = lines.get(l.srcItemId);
      if (!s) { problems.push({ field: `lines.${i}.srcItemId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: that line is not on ${src.refno}` }); return null; }
      if (billed.has(l.srcItemId)) problems.push({ field: `lines.${i}.srcItemId`, code: PUR.GRN_LINE_BILLED, message: `Line ${l.lineNo}: ${src.refno} line ${s.lineNo} is billed in ${billed.get(l.srcItemId)} — return it against that bill` });
      const q = D(l.qty).plus(D(l.freeQty));
      if (!q.greaterThan(0)) problems.push({ field: `lines.${i}.qty`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: nothing to return` });
      want.set(l.srcItemId, (want.get(l.srcItemId) ?? ZERO).plus(q));
      if (h.kind === 'AGAINST_GRN' && l.outcome !== 'RETURN') problems.push({ field: `lines.${i}.outcome`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: goods not yet billed can only be RETURNED — claim after the bill` });
      if (l.reasonId && !reasonName.has(l.reasonId)) problems.push({ field: `lines.${i}.reasonId`, code: 'PUR_REASON_NOT_FOUND', message: `Line ${l.lineNo}: that reason is not in Stock Reasons` });
      const claim = l.outcome === 'CLAIM_SENT' || l.outcome === 'CLAIM_DESTROYED';
      const against = claim ? (l.claimAgainst ?? 'SUPPLIER') : null;
      if (claim && against !== 'SUPPLIER' && !l.claimPartyId) problems.push({ field: `lines.${i}.claimPartyId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: name the ${against?.toLowerCase()} the claim is on` });
      const bucket = l.bucket ?? 'SALEABLE';
      // one lot can sit in two holdings (saleable + damaged): the row's bucket always decides which; the header godown, where given, decides where
      const mine = lots.filter((x) => x.line_id === l.srcItemId && x.bucket === bucket && (!h.godownId || x.godown_id === h.godownId));
      const lot = l.lotId ? mine.find((x) => x.lot_id === l.lotId) : mine[0];
      if (!lot) {
        const elsewhere = h.godownId && lots.some((x) => x.line_id === l.srcItemId && x.bucket === bucket);
        problems.push(elsewhere
          ? { field: `lines.${i}.lotId`, code: 'PUR_RETURN_LOT_NOT_IN_GODOWN', message: `Line ${l.lineNo}: ${src.refno} line ${s.lineNo} brought nothing into this godown (${bucket.toLowerCase()}) — pick the godown it came into` }
          : { field: `lines.${i}.lotId`, code: PUR.NOT_FOUND, message: `Line ${l.lineNo}: ${src.refno} line ${s.lineNo} brought nothing into ${bucket.toLowerCase()} to return from` });
      }
      return { l, s, bucket, lot, against, claimParty: claim ? (against === 'SUPPLIER' ? src.supplierId : l.claimPartyId!) : null, reasonName: l.reasonId ? reasonName.get(l.reasonId) ?? null : null };
    });
    for (const [srcItemId, q] of want) {
      const s = lines.get(srcItemId);
      if (!s) continue;
      const left = s.inQty.minus(returned.get(srcItemId) ?? ZERO);
      if (q.greaterThan(left)) problems.push({ field: 'lines', code: 'PUR_RETURN_QTY_EXCEEDS', message: `${src.refno} line ${s.lineNo}: ${q} to return, only ${left.isNegative() ? 0 : left} left of what came in` });
    }
    const rows = resolved.filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ ...r, m: this.money(r.s, D(r.l.qty)) }));   // free goods carry no money
    let returnValue = ZERO, claimValue = ZERO, itcDestroyed = ZERO, itcReversed = ZERO, itcOnReplace = ZERO, replaceBase = ZERO, goodsValue = ZERO;
    for (const r of rows) {
      const o = r.l.outcome;
      goodsValue = goodsValue.plus(r.m.total);
      if (h.kind === 'AGAINST_GRN') continue;
      if (o === 'RETURN') { returnValue = returnValue.plus(r.m.total); itcReversed = itcReversed.plus(r.m.tax); }
      if (o === 'CLAIM_SENT') { claimValue = claimValue.plus(r.m.total); itcReversed = itcReversed.plus(r.m.tax); }
      if (o === 'CLAIM_DESTROYED') { claimValue = claimValue.plus(r.m.taxable); itcDestroyed = itcDestroyed.plus(r.m.tax); itcReversed = itcReversed.plus(r.m.tax); }
      if (o === 'REPLACE') { replaceBase = replaceBase.plus(D(r.l.qty).plus(D(r.l.freeQty)).times(r.s.factor)); itcOnReplace = itcOnReplace.plus(r.m.tax); itcReversed = itcReversed.plus(r.m.tax); }
    }
    return { src, lines, returned, rows, problems, returnValue, claimValue, itcDestroyed, itcReversed, itcOnReplace, replaceBase, goodsValue,
             godownId: h.godownId ?? rows[0]?.lot?.godown_id ?? null, posStcd: src.posStcd };
  }

  /** What one row credits and what it writes (the "Credit to" / "Writes" columns), from its outcome and money. */
  private rowWrites(kind: string, outcome: string, m: { taxable: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }, claimAgainst: string | null, partyName: string | null, supplierName: string | null) {
    const f = (v: Prisma.Decimal) => v.toFixed(2);
    if (kind === 'AGAINST_GRN') return { creditTo: { kind: 'GRNI', name: 'GRN clearing (no bill yet)' }, writes: [{ drCr: 'DR', head: 'GRNI', amount: f(m.taxable) }, { drCr: 'CR', head: 'Stock', amount: null }] };
    const stock = { drCr: 'CR', head: 'Stock (lot cost)', amount: null as string | null };
    const gst = { drCr: 'CR', head: 'Input GST', amount: f(m.tax) };
    switch (outcome) {
      case 'RETURN': return { creditTo: { kind: 'SUPPLIER', name: supplierName }, writes: [{ drCr: 'DR', head: 'Supplier (debit note)', amount: f(m.total) }, stock, gst] };
      case 'CLAIM_SENT': return { creditTo: { kind: claimAgainst ?? 'SUPPLIER', name: partyName ?? supplierName }, writes: [{ drCr: 'DR', head: 'Claim receivable', amount: f(m.total) }, stock, gst] };
      case 'CLAIM_DESTROYED': return { creditTo: { kind: claimAgainst ?? 'SUPPLIER', name: partyName ?? supplierName },
        writes: [{ drCr: 'DR', head: 'Claim receivable', amount: f(m.taxable) }, { drCr: 'DR', head: 'ITC reversal', amount: f(m.tax) }, stock, gst] };
      default: return { creditTo: { kind: 'REPLACEMENT', name: 'Replacement due (Shortage Receipt)' },
        writes: [{ drCr: 'DR', head: 'Shortage receivable', amount: f(m.taxable) }, { drCr: 'DR', head: 'Input GST pending (re-claimed on receipt)', amount: f(m.tax) }, stock, gst] };
    }
  }

  /** The supplier's bill-wise balance now (payable − debits pending), as the supplier chips read it. */
  private async supplierBalance(db: Tx | PrismaService, companyId: string, supplierId: string) {
    const [b] = await db.$queryRaw<{ cr: Prisma.Decimal | null; dr: Prisma.Decimal | null }[]>`
      SELECT SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'CR') AS cr, SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'DR') AS dr
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${companyId}::uuid AND abl_party_id = ${supplierId}::uuid AND abl_is_active AND NOT abl_is_deleted AND abl_pending_amount > 0`;
    return D(b?.cr).minus(D(b?.dr));
  }

  /** POST /returns/validate — the rows' money, Credit to / Writes, the six totals and the strip, before anything is saved. */
  async validate(dto: SaveReturnDto) {
    const h = dto.header;
    const p = await this.prepare(this.prisma, dto);
    const parties = await this.partyNames(this.prisma, [p.src.supplierId, ...p.rows.map((r) => r.claimParty).filter((x): x is string => !!x)]);
    const balance = await this.supplierBalance(this.prisma, h.companyId, p.src.supplierId);
    const issues: PurIssue[] = p.problems.map((x) => ({ ...x, level: 'REFUSE' as const, lineNo: lineNoOf(dto, x.field), needsRight: null }));
    issues.push(...await this.ewbIssues(this.prisma, h, p));
    const names = await unitNames(this.prisma, p.rows.map((r) => r.s.uomId));
    return jsonSafe({
      header: { supplierId: p.src.supplierId, supplierName: parties.get(p.src.supplierId) ?? null, srcRefno: p.src.refno, srcDocDate: p.src.docDate,
                godownId: p.godownId, placeOfSupply: p.posStcd },
      lines: p.rows.map((r) => ({
        lineNo: r.l.lineNo, srcItemId: r.s.srcItemId, srcLineNo: r.s.lineNo, itemId: r.s.itemId, ...names.get(r.s.uomId), outcome: r.l.outcome, outcomeText: OUTCOME_TEXT[r.l.outcome],
        reasonId: r.l.reasonId ?? null, reasonName: r.reasonName, billedQty: r.s.basisQty, inQty: r.s.inQty, returnedQty: p.returned.get(r.s.srcItemId) ?? ZERO,
        returnableQty: Prisma.Decimal.max(r.s.inQty.minus(p.returned.get(r.s.srcItemId) ?? ZERO), 0),
        lotId: r.lot?.lot_id ?? null, godownId: r.lot?.godown_id ?? null, batchNo: r.lot?.batch_no ?? null, expiryDate: r.lot?.expiry ?? null, mrp: r.lot?.mrp ?? null,
        rate: r.s.rate, gstPct: r.s.gstPct, taxable: r.m.taxable, tax: r.m.tax, total: r.m.total,
        ...this.rowWrites(h.kind, r.l.outcome, r.m, r.against, r.claimParty ? parties.get(r.claimParty) ?? null : null, parties.get(p.src.supplierId) ?? null),
      })),
      totals: this.totalsOf(p, balance, true),
      warnings: issues.filter((x) => x.level === 'WARN'), refusals: issues.filter((x) => x.level === 'REFUSE'),
    });
  }

  /** The six cells: Rows · Return now (debit note) · Claims raised · Replace qty due · ITC reversed · Supplier balance now. */
  private totalsOf(p: { rows: unknown[]; returnValue: Prisma.Decimal; claimValue: Prisma.Decimal; replaceBase: Prisma.Decimal; itcReversed: Prisma.Decimal; itcDestroyed: Prisma.Decimal; itcOnReplace: Prisma.Decimal; goodsValue: Prisma.Decimal },
                   balance: Prisma.Decimal, beforePost: boolean) {
    return {
      rows: p.rows.length, returnNow: p.returnValue.toFixed(2), claimsRaised: p.claimValue.toFixed(2), replaceQtyBase: p.replaceBase.toString(),
      // every outcome whose GST the post takes out of input now: Return, Claim sent, Claim destroyed AND Replace (user 2026-10-29)
      itcReversed: p.itcReversed.toFixed(2), itcOnDestroyed: p.itcDestroyed.toFixed(2),
      // the Replace part of itcReversed: parked in Input GST pending, re-claimed when the replacement comes (Shortage Receipt)
      itcPendingOnReplace: p.itcOnReplace.toFixed(2),
      goodsValue: p.goodsValue.toFixed(2),
      supplierBalance: balance.toFixed(2),
      // what the supplier balance reads once this return posts (a posted return is already in it)
      supplierBalanceNow: (beforePost ? balance.minus(p.returnValue) : balance).toFixed(2),
    };
  }

  /** LAW: goods going back above the e-way bill value limit (statutory_limits EWAY_VALUE_LIMIT, per company) need an e-way bill no. */
  private async ewbIssues(db: Tx | PrismaService, h: ReturnHeaderDto, p: { goodsValue: Prisma.Decimal; posStcd: string | null; rows: { m: { taxable: Prisma.Decimal; tax: Prisma.Decimal } }[]; src: SourceDoc }): Promise<PurIssue[]> {
    if (h.ewbNo?.trim() || !p.rows.length) return [];
    const inter = p.rows.some((r) => !r.m.tax.isZero()) && (await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM purchase.pur_invoice_item WHERE pii_pi_id = ${p.src.id}::uuid AND pii_igst_amt > 0 AND NOT pii_is_deleted`)[0]?.n > 0n;
    const e = await this.statutory.ewayApplicable(h.companyId, Number(p.goodsValue), h.docDate.slice(0, 10), { interState: !!inter, stateCode: p.posStcd },
                                                   (db as Tx));
    if (!e.applicable) return [];
    return [{ code: 'PUR_RETURN_EWB_NEEDED', level: 'WARN', lineNo: null, field: 'header.ewbNo', needsRight: null,
      message: `Goods worth ${p.goodsValue.toFixed(2)} go back — above the e-way bill limit ${Number(e.limit?.value ?? 0).toFixed(2)}: record the e-way bill no.` }];
  }

  private async partyNames(db: Tx | PrismaService, ids: string[]) {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map<string, string>();
    const rows = await db.$queryRaw<{ id: string; name: string }[]>`SELECT led_id AS id, led_name AS name FROM accounts.acc_ledger_master WHERE led_id = ANY(${u}::uuid[])`;
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private bandInput(t: PurchaseTransportDto, godownId: string | null, branchId: string, supplierName: string | null): TransportBandInput {
    return {
      direction: 'OUTWARD', from: { godownId, branchId }, to: { name: supplierName },
      mode: t.mode ?? null, transporterId: t.transporterId ?? null, transporterName: t.transporterName?.trim() || null,
      transporterGstin: t.transporterGstin?.trim() || null, lrNo: t.lrNo?.trim() || null, lrDate: t.lrDate?.slice(0, 10) ?? null,
      distanceKm: t.distanceKm ?? null, remarks: t.remarks?.trim() || null,
    };
  }

  async save(dto: SaveReturnDto) {
    const actor = this.actor();
    const h = dto.header;
    const id = await this.prisma.$transaction(async (tx) => {
      const p = await this.prepare(tx, dto);
      if (p.problems.length) purRefuseMany(p.problems[0].message, p.problems);
      const { src, rows } = p;

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

      const data = {
        prCompanyId: h.companyId, prBranchId: h.branchId, prAccYear: h.accYear, prDeviceId: h.deviceId, prSlno: slno, prRefno: refno,
        prDocDate: dateOf(h.docDate)!, prKind: h.kind, prSrcDocId: src.id, prSrcAccYear: src.accYear, prSupplierId: src.supplierId,
        prGodownId: p.godownId, prPosStcd: p.posStcd, prSettlement: h.settlement ?? await this.defaultSettlement(tx, h.companyId, h.branchId),
        prSupplierCnNo: h.supplierCnNo ?? null, prSupplierCnDate: dateOf(h.supplierCnDate), prEwbNo: h.ewbNo ?? null, prEwbDate: dateOf(h.ewbDate),
        prVehicleNo: h.vehicleNo ?? null, prDriverName: h.driverName ?? null, prOurRef: src.refno,
        prReturnValue: p.returnValue, prClaimValue: p.claimValue, prItcReversed: p.itcDestroyed, prReplaceQtyBase: p.replaceBase,
        prRemarks: h.remarks ?? null, prStatus: 'DRAFT',
        ...(h.ourRef !== undefined ? { prMemoRef: h.ourRef?.trim() || null } : {}),
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
          priItcReversedInBooks: h.kind === 'AGAINST_INVOICE',   // every outcome, Replace too (user 2026-10-29)
          priSupplierCnStatus: l.outcome === 'RETURN' && h.kind === 'AGAINST_INVOICE' ? 'PENDING' : 'NONE',
          priClaimAgainst: r.against, priClaimPartyId: r.claimParty, priRemarks: l.remarks ?? null, priCreatedBy: actor,
        }, select: { priId: true } });
        await tx.purItemAlloc.create({ data: {
          piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC, piaDocId: prId!, piaLineId: row.priId, piaRowNo: 1,
          piaGodownId: r.lot!.godown_id, piaBucket: r.lot!.bucket, piaLotId: r.lot!.lot_id, piaBatchNo: r.lot!.batch_no, piaExpiryDate: r.lot!.expiry, piaMrp: r.lot!.mrp,
          piaQty: D(l.qty), piaFreeQty: D(l.freeQty), piaCreatedBy: actor,
        } });
      }
      // the transport band (OUTWARD, goods back to the supplier): omitted = kept, null / all blank = removed
      if (h.transport !== undefined) {
        const ref = { docType: 'PURCHASE_RETURN' as const, docId: prId!, accYear: h.accYear, companyId: h.companyId, branchId: h.branchId, docRefno: refno };
        const t = h.transport;
        const carriage = t && (t.mode || t.transporterId || t.transporterName?.trim() || t.transporterGstin?.trim() || t.lrNo?.trim() || t.lrDate || t.distanceKm != null || t.remarks?.trim());
        if (!t || !carriage) await this.transportBand.remove(tx, ref, actor);
        else {
          const [sn] = await tx.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${src.supplierId}::uuid`;
          const input = this.bandInput(t, p.godownId, h.branchId, sn?.sup_name ?? null);
          if (input.transporterId) {
            const [m] = await tx.$queryRaw<{ trn_name: string; trn_gstin: string | null }[]>`SELECT trn_name, trn_gstin FROM public.transporter_master WHERE trn_id = ${input.transporterId}::uuid AND NOT trn_is_deleted`;
            if (!m) purNotFound(`Transporter ${input.transporterId} not found`, 'PUR_TRANSPORTER_NOT_FOUND', 'header.transport.transporterId');
            input.transporterName = input.transporterName ?? m.trn_name;
            input.transporterGstin = input.transporterGstin ?? m.trn_gstin ?? null;
          }
          await this.transportBand.write(tx, ref, input, actor, { gdrId: null });
        }
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
      // a draft saved before 2026-10-29 has Replace rows flagged "not reversed": the post reverses them now
      await tx.purReturnItem.update({ where: { priId_priAccYear: { priId: lines[i].priId, priAccYear: accYear } },
        data: { priLotCostValue: perRow[i].cost, priItcReversedInBooks: pr.prKind === 'AGAINST_INVOICE' } });
      if (perRow[i].sviId) await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: a.piaId, piaAccYear: accYear } }, data: { piaSviId: perRow[i].sviId, piaSviAccYear: accYear } });
    }

    // ── 2 · books
    const vt = await voucherTypeId(tx, 'PRN');
    const nature = lines.some((l) => l.priIgstAmt.greaterThan(0)) ? 'INTER' : 'INTRA';
    const legs: VoucherLeg[] = [];
    const add = (leg: VoucherLeg) => { if (leg.amount >= 0.005) legs.push(leg); };
    const claimByParty = new Map<string, Prisma.Decimal>();
    let supplierDr = ZERO, grniDr = ZERO, replaceDr = ZERO, replaceGst = ZERO, itcRev = ZERO, stockCr = ZERO;
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
        // ITC reversed now into Input GST pending — the Shortage Receipt of the replacement re-claims it (plan §5 "Replace row")
        case 'REPLACE': replaceDr = replaceDr.plus(l.priTaxableAmt); replaceGst = replaceGst.plus(tax); creditInput(l); break;
      }
    });
    add({ ledgerId: pr.prSupplierId, drCr: 'DR', amount: num2(supplierDr), remarks: `Return ${pr.prRefno} against ${pr.prOurRef}`, docRefno: pr.prRefno });
    add({ role: 'GRNI', drCr: 'DR', amount: num2(grniDr), roleTag: 'GRNI', remarks: `Return ${pr.prRefno} against ${pr.prOurRef}` });
    for (const [, amt] of claimByParty) add({ role: 'CLAIM_RECEIVABLE', drCr: 'DR', amount: num2(amt), roleTag: 'CLAIM_RECEIVABLE', remarks: `Claim · ${pr.prRefno}` });
    add({ role: 'SHORTAGE_RECEIVABLE', drCr: 'DR', amount: num2(replaceDr), roleTag: 'SHORTAGE_RECEIVABLE', remarks: `Replacement due · ${pr.prRefno}` });
    add({ role: 'ITC_REVERSAL', drCr: 'DR', amount: num2(itcRev), roleTag: 'ITC_REVERSAL', remarks: `GST on destroyed goods · ${pr.prRefno}` });
    add({ role: 'INPUT_TAX_PENDING', drCr: 'DR', amount: num2(replaceGst), roleTag: 'INPUT_TAX_PENDING', remarks: `GST on goods to be replaced · ${pr.prRefno}` });
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
        pshReason: 'REPLACE', pshQtyBase: base, pshValue: l.priTaxableAmt, pshGstPending: l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt),
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
    // the source line's figures (billed / came in / returned by OTHER returns / returnable), the reasons, the party names, the godown
    const src = await this.sourceDoc(this.prisma, header.prKind, header.prSrcDocId, header.prSrcAccYear);
    const [srcLines, returnedOthers] = await Promise.all([this.sourceLines(this.prisma, src), this.returnedQty(this.prisma, src.id, prId)]);
    const reasons = await this.prisma.$queryRaw<{ srm_id: string; srm_name: string }[]>`
      SELECT srm_id, srm_name FROM stock.stock_reason_master WHERE srm_id = ANY(${lines.map((l) => l.priReasonId).filter((x): x is string => !!x)}::uuid[])`;
    const reasonName = new Map(reasons.map((r) => [r.srm_id, r.srm_name]));
    const parties = await this.partyNames(this.prisma, [header.prSupplierId, ...lines.map((l) => l.priClaimPartyId).filter((x): x is string => !!x)]);
    const [gd] = await this.prisma.$queryRaw<{ gdl_name: string }[]>`SELECT gdl_name FROM inventory.godown_locations WHERE gdl_id = ${header.prGodownId}::uuid`;
    const band = await this.transportBand.read({ docType: 'PURCHASE_RETURN', docId: prId, accYear });
    const balance = await this.supplierBalance(this.prisma, header.prCompanyId, header.prSupplierId);
    let itcAll = ZERO, itcReplace = ZERO, goods = ZERO;
    for (const l of lines) {
      const tax = l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt);
      goods = goods.plus(l.priTotalAmt);
      if (header.prKind === 'AGAINST_GRN') continue;
      // a posted Replace row counts as reversed only when its post did reverse it (rows posted before 2026-10-29 kept the GST claimed)
      if (l.priOutcome === 'REPLACE' && header.prStatus !== 'DRAFT' && !l.priItcReversedInBooks) continue;
      if (l.priOutcome === 'REPLACE') itcReplace = itcReplace.plus(tax);
      itcAll = itcAll.plus(tax);
    }
    const claimParty = lines.find((l) => l.priClaimAgainst && l.priClaimAgainst !== 'SUPPLIER' && l.priClaimPartyId);
    return jsonSafe({
      header: { ...header, supplierName: sup[0]?.sup_name ?? null, godownName: gd?.gdl_name ?? null, placeOfSupply: header.prPosStcd ?? src.posStcd,
                srcRefno: src.refno, srcDocDate: src.docDate,
                // the screen's header "Claim on (other)": the transporter / insurer of the first claim row that is not on the supplier
                claimPartyId: claimParty?.priClaimPartyId ?? null, claimPartyName: claimParty?.priClaimPartyId ? parties.get(claimParty.priClaimPartyId) ?? null : null,
                claimAgainst: claimParty?.priClaimAgainst ?? null,
                transport: band ? { mode: band.mode ?? null, transporterId: band.transporterId ?? null, transporterName: band.transporterName ?? null,
                                    transporterGstin: band.transporterGstin ?? null, lrNo: band.lrNo ?? null, lrDate: band.lrDate ? String(band.lrDate).slice(0, 10) : null,
                                    distanceKm: band.distanceKm ?? null, remarks: band.remarks ?? null } : null },
      lines: lines.map((l) => {
        const a = allocs.find((x) => x.piaLineId === l.priId);
        const claimValue = this.claimValueOf(l);
        const done = settled.get(l.priId) ?? ZERO;
        const sl = l.priSrcItemId ? srcLines.get(l.priSrcItemId) : undefined;
        const others = l.priSrcItemId ? returnedOthers.get(l.priSrcItemId) ?? ZERO : ZERO;
        const tax = l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt);
        return { ...l, ...names.get(l.priUomId), bucket: a?.piaBucket ?? null, lotId: a?.piaLotId ?? null, batchNo: a?.piaBatchNo ?? null, expiryDate: a?.piaExpiryDate ?? null,
          mrp: a?.piaMrp ?? null, godownId: a?.piaGodownId ?? null,
          claimValue, claimSettled: done, claimOpen: claimValue.minus(done),
          outcomeText: OUTCOME_TEXT[l.priOutcome] ?? l.priOutcome, reasonName: l.priReasonId ? reasonName.get(l.priReasonId) ?? null : null,
          claimPartyName: l.priClaimPartyId ? parties.get(l.priClaimPartyId) ?? null : null,
          billedQty: sl?.basisQty ?? null, inQty: sl?.inQty ?? null, returnedQty: others,
          returnableQty: sl ? Prisma.Decimal.max(sl.inQty.minus(others), 0) : null,
          ...this.rowWrites(header.prKind, l.priOutcome, { taxable: l.priTaxableAmt, tax, total: l.priTotalAmt }, l.priClaimAgainst,
                            l.priClaimPartyId ? parties.get(l.priClaimPartyId) ?? null : null, sup[0]?.sup_name ?? null) };
      }),
      totals: this.totalsOf({ rows: lines, returnValue: header.prReturnValue, claimValue: header.prClaimValue, replaceBase: header.prReplaceQtyBase,
                              itcReversed: itcAll, itcDestroyed: header.prItcReversed, itcOnReplace: itcReplace, goodsValue: goods }, balance, header.prStatus === 'DRAFT'),
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
    const out = await this.prisma.$transaction((tx) => this.settleIn(tx, dto, actor), { timeout: 60000, maxWait: 10000 });
    const { legs: _legs, ...rest } = out as SettleResult;
    return jsonSafe(rest);
  }

  /**
   * One settlement row of one claim, in the caller's transaction. `dryRun`: everything is checked and the voucher
   * legs are worked out, nothing is written (the Supplier dues "What Settle writes" preview); `takenAlready` = what an
   * earlier dry-run step of the same call took off this claim (credit, then write off the rest).
   */
  async settleIn(tx: Tx, dto: SettleClaimDto, actor: string, opts: { dryRun?: boolean; takenAlready?: Prisma.Decimal } = {}): Promise<SettleResult> {
    const l = await tx.purReturnItem.findFirst({ where: { priId: dto.returnItemId, priAccYear: dto.accYear, priIsDeleted: false } });
    if (!l) purNotFound(`Return row ${dto.returnItemId} not found`);
    const pr = await tx.purReturn.findFirst({ where: { prId: l.priPrId, prAccYear: dto.accYear, prIsDeleted: false } });
    if (!pr || pr.prStatus !== 'POSTED') purConflict('Only a claim on a posted return is settled.', PUR.NOT_POSTED, 'returnItemId');
    if (l.priOutcome !== 'CLAIM_SENT' && l.priOutcome !== 'CLAIM_DESTROYED') purConflict(`Line ${l.priLineNo} of ${pr.prRefno} is a ${l.priOutcome}, not a claim.`, PUR.QTY_INVALID, 'returnItemId');
    // one settlement at a time per claim row
    // the row's own id (canonical uuid text), so a multi-row settle's up-front lock (claimLockOrder) is the same lock
    await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext(${RETURN_CLAIM_LOCK}), hashtext(${l.priId})))::int AS locked`;
    const value = this.claimValueOf(l);
    const open = value.minus((await this.settledByItem(tx, [l.priId])).get(l.priId) ?? ZERO).minus(opts.takenAlready ?? ZERO);
    if (!open.greaterThan(0)) purConflict(`The claim on ${pr.prRefno} line ${l.priLineNo} is fully settled.`, PUR.EDIT_LOCKED_PAID, 'returnItemId');
    const amount = dto.action === 'CREDIT' ? r2(D(dto.amount ?? open)) : open;
    if (!amount.greaterThan(0) || amount.greaterThan(open)) purRefuse(`Amount must be more than 0 and at most the open ${open.toFixed(2)}.`, PUR.QTY_INVALID, 'amount');

    const accYear = dto.settleAccYear ?? dto.accYear;
    const docDate = dto.docDate ?? isoDate(new Date());
    const party = l.priClaimPartyId!;
    const tax = l.priCgstAmt.plus(l.priSgstAmt).plus(l.priIgstAmt).plus(l.priCessAmt);
    const reavail = dto.action === 'REJECTED' && l.priOutcome === 'CLAIM_SENT' && !l.priTotalAmt.isZero() ? r2(tax.times(amount).dividedBy(l.priTotalAmt)) : ZERO;
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
    const live = legs.filter((g) => g.amount >= 0.005);
    const base = { returnItemId: l.priId, refno: pr.prRefno, lineNo: l.priLineNo, action: dto.action, receivedAs: dto.action === 'CREDIT' ? (dto.receivedAs ?? 'CN') : null,
                   amount, gstReavailed: reavail, open: open.minus(amount), companyId: pr.prCompanyId, branchId: pr.prBranchId, legs: live };
    if (opts.dryRun) return { ...base, dryRun: true, settlementId: null, accYear, voucherRefno: null };

    // each settlement row of a claim gets its own reference (the voucher header is unique on it)
    const [{ n: seq }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) + 1 AS n FROM purchase.pur_claim_settlement WHERE pcs_return_item_id = ${l.priId}::uuid AND pcs_shortage_close_id IS NULL`;
    const ref = `${pr.prRefno}/L${l.priLineNo}/S${seq}`;
    const s = await tx.purClaimSettlement.create({ data: {
      pcsCompanyId: pr.prCompanyId, pcsBranchId: pr.prBranchId, pcsAccYear: accYear, pcsDeviceId: dto.deviceId,
      pcsReturnItemId: l.priId, pcsReturnItemAccYear: dto.accYear, pcsAction: dto.action, pcsReceivedAs: base.receivedAs,
      pcsAmount: amount, pcsGstReavailed: reavail, pcsCnNo: dto.cnNo ?? null, pcsCnDate: dateOf(dto.cnDate), pcsReason: dto.reason ?? null,
      pcsDocDate: dateOf(docDate)!, pcsCreatedBy: actor,
    }, select: { pcsId: true } });
    const vt = await voucherTypeId(tx, 'PCL');
    const posted = await this.vouchers.postLegs(tx, {
      header: { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: SETTLE_DOC, srcDocId: s.pcsId,
        docLabel: 'Claim settlement', docRefno: ref, docDate, usrRefno: dto.cnNo ?? null, docAmount: num2(amount), partyId: party,
        userId: actor, deviceId: dto.deviceId, remarks: dto.reason ?? `${label} ${dto.action.toLowerCase()}`, createdBy: actor },
      legs: live,
    });
    await tx.purClaimSettlement.update({ where: { pcsId_pcsAccYear: { pcsId: s.pcsId, pcsAccYear: accYear } }, data: { pcsVoucherId: posted.voucherId } });
    if (dto.action === 'CREDIT') {
      await raiseBillRow(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, partyId: party, billType: 'PURCHASE_RETURN', drCr: 'DR', amount,
        docType: SETTLE_DOC, docId: s.pcsId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: posted.voucherSlno, voucherDate: docDate,
        refno: posted.voucherRefno ?? ref, docDate: dateOf(docDate)!, narration: `${label} — credit${dto.cnNo ? ` CN ${dto.cnNo}` : ''}`, actor });
    }
    await statusLog(tx, { companyId: pr.prCompanyId, branchId: pr.prBranchId, accYear, docType: TxnStatusDocType.CLAIM_SETTLEMENT, docId: s.pcsId, refno: ref,
      event: TxnStatusEvent.POSTED, from: null, to: dto.action, actor, deviceId: dto.deviceId, remarks: dto.reason ?? null });
    return { ...base, dryRun: false, settlementId: s.pcsId, accYear, voucherRefno: posted.voucherRefno ?? null };
  }

  /**
   * Supplier dues, section A — every claim row of posted returns: value, credited, written off, open, status, age,
   * reason, last action, the source bill. `all` = also the settled ones.
   */
  async duesClaims(q: { companyId: string; branchId: string; supplierId?: string | null; all?: boolean }) {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT pri.pri_id AS "returnItemId", pri.pri_acc_year AS "accYear", pr.pr_id AS "prId", pr.pr_refno AS "refno", pr.pr_doc_date AS "docDate",
             (current_date - pr.pr_doc_date)::int AS "ageDays",
             pri.pri_line_no AS "lineNo", pri.pri_src_doc_type AS "srcDocType", pri.pri_src_doc_id AS "srcDocId", pri.pri_src_doc_refno AS "srcRefno",
             COALESCE(pi.pi_doc_date, g.grn_doc_date) AS "srcDocDate", pi.pi_supplier_inv_no AS "srcSupplierInvNo",
             pri.pri_item_id AS "itemId", im.item_name_en AS "itemName", pri.pri_qty AS "qty", u.unit_name AS "unitName",
             pri.pri_outcome AS "outcome", pri.pri_reason_id AS "reasonId", rs.srm_name AS "reasonName",
             pri.pri_claim_against AS "claimAgainst", pri.pri_claim_party_id AS "claimPartyId", lm.led_name AS "partyName",
             pr.pr_supplier_id AS "supplierId", sp.sup_name AS "supplierName",
             CASE pri.pri_outcome WHEN 'CLAIM_SENT' THEN pri.pri_total_amt ELSE pri.pri_taxable_amt END AS "claimValue",
             COALESCE(st.credited, 0) AS "credited", COALESCE(st.written_off, 0) AS "writtenOff", COALESCE(st.settled, 0) AS "settled",
             la.pcs_id AS "lastSettlementId", la.pcs_acc_year AS "lastSettlementAccYear", la.pcs_action AS "lastAction", la.pcs_received_as AS "lastReceivedAs",
             la.pcs_cn_no AS "lastCnNo", la.pcs_cn_date AS "lastCnDate", la.pcs_amount AS "lastAmount", la.pcs_doc_date AS "lastDate", la.pcs_reason AS "lastReason"
        FROM purchase.pur_return_item pri
        JOIN purchase.pur_return pr ON pr.pr_id = pri.pri_pr_id AND pr.pr_acc_year = pri.pri_acc_year
        JOIN inventory.item_master im ON im.item_id = pri.pri_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = pri.pri_uom_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        LEFT JOIN stock.stock_reason_master rs ON rs.srm_id = pri.pri_reason_id
        LEFT JOIN accounts.acc_ledger_master lm ON lm.led_id = pri.pri_claim_party_id
        LEFT JOIN purchase.suppliers sp ON sp.sup_id = pr.pr_supplier_id
        LEFT JOIN purchase.pur_invoice pi ON pri.pri_src_doc_type = 'PURCHASE_BILL' AND pi.pi_id = pri.pri_src_doc_id AND pi.pi_acc_year = pri.pri_src_doc_year
        LEFT JOIN purchase.pur_grn g ON pri.pri_src_doc_type = 'GRN' AND g.grn_id = pri.pri_src_doc_id AND g.grn_acc_year = pri.pri_src_doc_year
        LEFT JOIN LATERAL (
          SELECT SUM(s.pcs_amount) FILTER (WHERE s.pcs_action = 'CREDIT') AS credited,
                 SUM(s.pcs_amount) FILTER (WHERE s.pcs_action <> 'CREDIT') AS written_off, SUM(s.pcs_amount) AS settled
            FROM purchase.pur_claim_settlement s WHERE s.pcs_return_item_id = pri.pri_id AND NOT s.pcs_is_deleted) st ON true
        LEFT JOIN LATERAL (
          SELECT s.pcs_id, s.pcs_acc_year, s.pcs_action, s.pcs_received_as, s.pcs_cn_no, s.pcs_cn_date, s.pcs_amount, s.pcs_doc_date, s.pcs_reason
            FROM purchase.pur_claim_settlement s
           WHERE s.pcs_return_item_id = pri.pri_id AND NOT s.pcs_is_deleted AND s.pcs_reversal_of_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM purchase.pur_claim_settlement u2 WHERE u2.pcs_reversal_of_id = s.pcs_id AND NOT u2.pcs_is_deleted)
           ORDER BY s.pcs_created_on DESC LIMIT 1) la ON true
       WHERE pr.pr_company_id = ${q.companyId}::uuid AND pr.pr_branch_id = ${q.branchId}::uuid AND pr.pr_status = 'POSTED' AND NOT pr.pr_is_deleted
         AND NOT pri.pri_is_deleted AND pri.pri_outcome IN ('CLAIM_SENT', 'CLAIM_DESTROYED')
         AND (${q.supplierId ?? null}::uuid IS NULL OR pr.pr_supplier_id = ${q.supplierId ?? null}::uuid)
       ORDER BY pr.pr_doc_date, pr.pr_refno, pri.pri_line_no`;
    const out = rows.map((r) => {
      const value = D(r.claimValue as Prisma.Decimal), settled = D(r.settled as Prisma.Decimal), credited = D(r.credited as Prisma.Decimal), off = D(r.writtenOff as Prisma.Decimal);
      const open = value.minus(settled);
      const status = !open.greaterThan(0) ? (credited.isZero() ? 'WRITTEN_OFF' : 'SETTLED') : settled.isZero() ? 'OPEN' : 'PART';
      const last = r.lastSettlementId ? { settlementId: r.lastSettlementId, accYear: r.lastSettlementAccYear, action: r.lastAction, receivedAs: r.lastReceivedAs,
                                          cnNo: r.lastCnNo, cnDate: r.lastCnDate, amount: r.lastAmount, on: r.lastDate, reason: r.lastReason } : null;
      const { lastSettlementAccYear: _a, lastAction: _b, lastReceivedAs: _c, lastCnNo: _d, lastCnDate: _e, lastAmount: _f, lastDate: _g, lastReason: _h, ...keep } = r;
      return { ...keep, claimRef: `${r.refno} · r${r.lineNo}`, kindText: OUTCOME_TEXT[String(r.outcome)] ?? r.outcome,
               credited: credited.toFixed(2), writtenOff: off.toFixed(2), settled: settled.toFixed(2), open: open.toFixed(2), status, lastAction: last };
    });
    return q.all ? out : out.filter((r) => r.status === 'OPEN' || r.status === 'PART');
  }

  async settleUndo(dto: SettleUndoDto) {
    const actor = this.actor();
    const out = await this.prisma.$transaction(async (tx) => {
      const s = await tx.purClaimSettlement.findFirst({ where: { pcsId: dto.settlementId, pcsAccYear: dto.accYear, pcsIsDeleted: false } });
      if (!s) purNotFound(`Settlement ${dto.settlementId} not found`);
      if (s.pcsReversalOfId) purConflict('That row is itself an undo.', PUR.NOT_POSTED, 'settlementId');
      // pur_claim_settlement also holds shortage-claim settlements (pcs_shortage_close_id): those undo on Supplier dues
      if (!s.pcsReturnItemId || !s.pcsReturnItemAccYear) purConflict('That is a shortage-claim settlement — undo it on Supplier dues.', PUR.NOT_POSTED, 'settlementId');
      // settleIn's claim lock before the "already undone?" check: two undos (or an undo and a settle) of one claim row run one at a time
      await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext(${RETURN_CLAIM_LOCK}), hashtext(${s.pcsReturnItemId})))::int AS locked`;
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
  @Post('returns/validate') @Version(API_VERSION)
  @ApiOperation({ summary: 'The server\'s figures for a return being keyed — per row money, Credit to / Writes, billed / returned / returnable; the six totals (ITC reversed over every outcome, supplier balance now) and the strip (warnings[] / refusals[]). Writes nothing.' })
  async validate(@Body() dto: SaveReturnDto) {
    await this.right('view', 'check a purchase return');
    return { success: true, message: 'Return checked', data: await this.service.validate(dto) };
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
