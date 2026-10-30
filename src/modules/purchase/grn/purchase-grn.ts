import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { assertPoApproved } from '../order/purchase-order';
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
import { SellingPriceBulkService } from 'src/modules/stocks/selling-price-bulk/selling-price-bulk.service';
import { loadPurchaseSettings } from '../common/purchase-settings';
import { calcPurchase, type CalcChargeIn } from '../common/purchase-calc';
import { PUR, purConflict, purNotFound, purRefuse, purRefuseMany } from '../common/purchase.errors';
import {
  allocateDocNumber, assertNoLiveReturns, payeeLedgers, assertShortagesUntouched, cancelShadowStock, D, dateOf, isoDate, jsonSafe, loadUnits, unitNames, num2, postShadowStock, raiseBillRow, statusLog, stockRules,
  supplierRow, TxnStatusDocType, TxnStatusEvent, voucherTypeId, withdrawBillRows, ZERO, shelfLifeIssues,
} from '../common/purchase-doc.helpers';
import { PurchaseAllocDto, PurchaseChargeDto, PurchaseTransportDto } from '../invoice/dto/save-purchase-invoice.dto';
import { serialFacts, type LineFact, type PurIssue } from '../invoice/purchase-invoice-checks';
import { TransportBandService, type TransportBandInput } from 'src/modules/sales/posting/transport-band.service';
import { grnShelfLife, judgeGrnLines, type GrnLineCheck, type GrnLineFact } from './purchase-grn-checks';

/**
 * GRN — goods received before the bill (plan §3.2, D5). Menu 196 ("Purchase Note"
 * in 3.0 was exactly this). POST: stock in at the PROVISIONAL rate (the PO's net
 * rate, else typed), Dr Stock-in-Hand / Cr GRNI; our own labour (off-bill
 * charges) Dr Stock / Cr each payee; a challan short opens a qty-only shortage
 * row the bill adopts later (R3). The bill clears GRNI (invoice-from-GRN: next step).
 */
export const GRN_MENU_ID = 196;
const DOC = 'GRN';
/** "lines.3.allocs" → the line's own number (the strip names lines by number). */
const lineNoOf = (dto: SaveGrnDto, field: string) => {
  const m = /^lines\.(\d+)/.exec(field);
  return m ? dto.lines[Number(m[1])]?.lineNo ?? null : null;
};

export class GrnLineDto {
  @ApiProperty() @IsInt() @Min(1) lineNo!: number;
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiProperty() @IsUUID() uomId!: string;
  @ApiPropertyOptional({ description: 'The PO line it receives (pur_order_item.poi_id).' }) @IsOptional() @IsUUID() poItemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(9) poItemAccYear?: string;
  @ApiPropertyOptional({ description: 'What the challan / bill says came.' }) @IsOptional() @IsNumber() @Min(0) challanQty?: number;
  @ApiProperty() @IsNumber() @Min(0) receivedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) damagedQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() damageReasonId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) freeQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) excessQty?: number;
  @ApiPropertyOptional({ enum: ['HOLD_FOR_BILL', 'RETURN', 'KEEP_FREE'] }) @IsOptional() @IsIn(['HOLD_FOR_BILL', 'RETURN', 'KEEP_FREE']) excessAction?: string;
  @ApiProperty({ description: 'Provisional net rate per unit, without tax (default: the PO line\'s).' }) @IsNumber() @Min(0) rate!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() mrp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sellA?: number;
  @ApiPropertyOptional({ description: 'price_set_at = GRN: price level B written at post.' }) @IsOptional() @IsNumber() sellB?: number;
  @ApiPropertyOptional({ description: 'price_set_at = GRN: price level C written at post.' }) @IsOptional() @IsNumber() sellC?: number;
  @ApiPropertyOptional({ description: 'price_set_at = GRN: price level D written at post.' }) @IsOptional() @IsNumber() sellD?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remarks?: string;
  @ApiPropertyOptional({ type: [PurchaseAllocDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseAllocDto) allocs?: PurchaseAllocDto[];
}
export class GrnHeaderDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() grnId?: string;
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiProperty() @IsUUID() godownId!: string;
  @ApiProperty() @IsDateString() docDate!: string;
  @ApiPropertyOptional({ description: 'When the goods came in (date-time, ISO 8601 with offset, e.g. 2026-10-24T16:35:00+05:30). Default: now on the first save, then kept.' })
  @IsOptional() @IsDateString() receivedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) challanNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() challanDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) supplierInvNo?: string;
  @ApiPropertyOptional({ description: 'Employees who received / unloaded (the coolie payees).' }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) receivedBy?: string[];
  @ApiPropertyOptional({ description: 'Pay the unloading coolie to receivedBy (default true when no charges are sent): the company\'s off-bill UNLOADING charge, split per loadman, owed to each one\'s staff ledger.' })
  @IsOptional() @IsBoolean() payCoolie?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supervisorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) vehicleNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) driverName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15) ewbNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() ewbDate?: string;
  @ApiPropertyOptional({ type: PurchaseTransportDto, nullable: true, description: 'The shared transport band (txn_transport_detail, INWARD: FROM the supplier, TO this godown) — LR no / date, transporter. Omit = keep the saved band; null = remove it.' })
  @IsOptional() @ValidateNested() @Type(() => PurchaseTransportDto) transport?: PurchaseTransportDto | null;
  @ApiPropertyOptional({ description: 'With post: go past the strip entries that need a right (needsRight = OVERRIDE: PUR_SHELF_LIFE when purchase.shelf_life_mode = REFUSE). Needs the Override right on menu 196; every WARN gone past is logged (WARN_OVERRIDE).' })
  @IsOptional() @IsBoolean() overrideWarnings?: boolean;
  @ApiPropertyOptional({ description: 'Why — kept in the trail.' }) @IsOptional() @IsString() @MaxLength(250) overrideReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) packagesSent?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) packagesReceived?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() post?: boolean;
}
export class SaveGrnDto {
  @ApiProperty({ type: GrnHeaderDto }) @ValidateNested() @Type(() => GrnHeaderDto) header!: GrnHeaderDto;
  @ApiProperty({ type: [GrnLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => GrnLineDto) lines!: GrnLineDto[];
  @ApiPropertyOptional({ type: [PurchaseChargeDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseChargeDto) charges?: PurchaseChargeDto[];
}
export class GrnRefDto {
  @ApiProperty() @IsUUID() grnId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}
export class GrnPostDto extends GrnRefDto {
  @ApiPropertyOptional({ description: 'Go past PUR_SHELF_LIFE (REFUSE mode) — Override right on menu 196; logged.' }) @IsOptional() @IsBoolean() overrideWarnings?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) overrideReason?: string;
}
export class LabelsFromDocDto {
  @ApiProperty({ enum: ['GRN', 'PURCHASE_BILL'] }) @IsIn(['GRN', 'PURCHASE_BILL']) docType!: string;
  @ApiProperty() @IsUUID() docId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}
export class GrnCancelDto extends GrnRefDto {
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
}

@Injectable()
export class PurchaseGrnService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService,
              private readonly vouchers: VoucherPostingService, private readonly stockPosting: StockPostingService,
              private readonly prices: SellingPriceBulkService, private readonly transportBand: TransportBandService) {}

  private actor() {
    const u = this.ctx.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }
  private rules() { return stockRules('IN', DOC, 'GRN', 'PURCHASE', TxnStatusDocType.GRN); }

  /**
   * Everything a save works out before it writes, shared with /validate: units, the F4 excess (KEEP_FREE moves it into
   * free on the dto), charges (the coolie default), the calc, and the strip / Check column. `problems` are the refusals
   * a save throws; /validate returns them as refusals[].
   */
  private async prepare(tx: Prisma.TransactionClient | PrismaService, dto: SaveGrnDto) {
    const h = dto.header;
    const db = tx as Prisma.TransactionClient;
    const sup = await supplierRow(db, h.supplierId);
    const units = await loadUnits(db, dto.lines.map((l) => l.uomId));
    const problems: { field: string; code: string; message: string }[] = [];
    const warnings: { field: string; code: string; message: string }[] = [];
    dto.lines.forEach((l, i) => {
      const u = units.get(l.uomId);
      if (!u || u.iuc_item_id !== l.itemId) problems.push({ field: `lines.${i}.uomId`, code: PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: unit not found for the item` });
      if (D(l.receivedQty).plus(D(l.damagedQty)).plus(D(l.freeQty)).isZero()) problems.push({ field: `lines.${i}.receivedQty`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: nothing received` });
    });
    if (problems.length) return { problems, warnings, sup, units, excessOf: [], settings: null, priceAtGrn: false, calc: null, issues: [] as PurIssue[], checks: new Map<number, GrnLineCheck>() };
    // the supervisor is an employee (grn_supervisor_id → employee_master): an unknown id is a refusal, not a 500
    if (h.supervisorId) {
      const [e] = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM public.employee_master WHERE emp_id = ${h.supervisorId}::uuid`;
      if (!Number(e?.n)) problems.push({ field: 'header.supervisorId', code: 'PUR_SUPERVISOR_NOT_FOUND', message: 'That supervisor is not an employee' });
    }
    // damage reasons are Stock Reasons (menu 293)
    const reasonIds = [...new Set(dto.lines.map((l) => l.damageReasonId).filter((x): x is string => !!x))];
    if (reasonIds.length) {
      const found = await db.$queryRaw<{ srm_id: string }[]>`SELECT srm_id FROM stock.stock_reason_master WHERE srm_id = ANY(${reasonIds}::uuid[]) AND NOT srm_is_deleted`;
      const ok = new Set(found.map((r) => r.srm_id));
      dto.lines.forEach((l, i) => { if (l.damageReasonId && !ok.has(l.damageReasonId)) problems.push({ field: `lines.${i}.damageReasonId`, code: 'PUR_REASON_NOT_FOUND', message: `Line ${l.lineNo}: that damage reason is not in Stock Reasons` }); });
    }
    const settings = await loadPurchaseSettings(db, h.companyId, h.branchId);
    const priceAtGrn = settings.allowPriceUpdate && settings.priceUpdate === 'UPDATE_PRICES' && settings.priceSetAt === 'GRN';

    // F4 excess: what came beyond the PO line's pending qty. HOLD_FOR_BILL (default) keeps it at the
    // provisional rate for the bill; KEEP_FREE takes it as free goods (no value); RETURN = sent back at
    // the gate — it is not in Received, only recorded.
    const excessOf: Prisma.Decimal[] = [];
    for (let i = 0; i < dto.lines.length; i++) {
      const l = dto.lines[i];
      let excess = ZERO;
      if (l.poItemId) {
        const pendingBase = await this.poPendingBase(db, l.poItemId, h.grnId ?? null);
        const f = units.get(l.uomId)!.iuc_to_base_factor;
        const inBase = D(l.receivedQty).plus(D(l.damagedQty)).times(f);
        if (pendingBase != null && inBase.greaterThan(pendingBase)) excess = inBase.minus(Prisma.Decimal.max(pendingBase, 0)).dividedBy(f).toDecimalPlaces(4);
      }
      const action = l.excessAction ?? (excess.greaterThan(0) ? 'HOLD_FOR_BILL' : null);
      if (action === 'RETURN') {
        if (excess.greaterThan(0)) problems.push({ field: `lines.${i}.receivedQty`, code: 'PUR_EXCESS_IN_RECEIVED',
          message: `Line ${l.lineNo}: ${excess.toString()} over the PO is still in Received — what goes back at the gate is not received (key it as Excess).` });
        excessOf.push(D(l.excessQty));
      } else if (excess.greaterThan(0) && action === 'KEEP_FREE') {
        // the excess becomes free goods: out of received, into free — on the line and its rows
        const take = Prisma.Decimal.min(excess, D(l.receivedQty));
        l.receivedQty = Number(D(l.receivedQty).minus(take));
        l.freeQty = Number(D(l.freeQty).plus(take));
        let left = take;
        for (const a of l.allocs ?? []) {
          if ((a.bucket ?? 'SALEABLE') !== 'SALEABLE' || !left.greaterThan(0)) continue;
          const m = Prisma.Decimal.min(left, D(a.qty));
          a.qty = Number(D(a.qty).minus(m)); a.freeQty = Number(D(a.freeQty).plus(m)); left = left.minus(m);
        }
        warnings.push({ field: `lines.${i}.receivedQty`, code: 'PUR_EXCESS_KEPT_FREE', message: `Line ${l.lineNo}: ${take.toString()} over the PO taken as free goods (no value).` });
        excessOf.push(take);
      } else {
        if (excess.greaterThan(0)) warnings.push({ field: `lines.${i}.receivedQty`, code: 'PUR_EXCESS_HELD',
          message: `Line ${l.lineNo}: ${excess.toString()} over the PO — received at the provisional rate; the bill must cover it.` });
        excessOf.push(excess);
      }
      l.excessAction = excessOf[i].greaterThan(0) ? (action ?? undefined) : undefined;
    }

    // charges: off-bill only on a GRN (our own labour / freight) — D13
    if (!dto.charges?.length && h.receivedBy?.length && h.payCoolie !== false) dto.charges = await this.coolieFor(db, h.receivedBy);
    for (const c of dto.charges ?? []) if (c.payees?.length) c.payees = await payeeLedgers(db, c.payees, 'header.receivedBy');
    const chg = await this.loadCharges(db, dto.charges ?? []);
    const calc = calcPurchase({
      interState: false, roundOffStep: 0, charges: chg,
      lines: dto.lines.map((l) => ({ key: String(l.lineNo), billedQty: D(l.receivedQty).plus(D(l.damagedQty)), damagedQty: l.damagedQty ?? 0,
        receivedQty: l.receivedQty, freeQty: l.freeQty ?? 0, rate: l.rate, gstPct: 0, toBaseFactor: units.get(l.uomId)!.iuc_to_base_factor, weight: l.weight ?? 0 })),
    });

    // the strip + Check column (ENT-15 shelf life, short vs challan, damage reason, serials, labels)
    const facts: GrnLineFact[] = dto.lines.map((l, i) => {
      const rows = l.allocs?.length
        ? l.allocs.map((a) => ({ bucket: a.bucket ?? 'SALEABLE', qty: D(a.qty).plus(D(a.freeQty)), mfgDate: dateOf(a.mfgDate), expiryDate: dateOf(a.expiryDate), serialNo: a.serialNo ?? null }))
        : [{ bucket: 'SALEABLE', qty: D(l.receivedQty).plus(D(l.freeQty)), mfgDate: null, expiryDate: null, serialNo: null },
           { bucket: 'DAMAGED', qty: D(l.damagedQty), mfgDate: null, expiryDate: null, serialNo: null }].filter((r) => r.qty.greaterThan(0));
      return { index: i, lineNo: l.lineNo, itemId: l.itemId, itemName: units.get(l.uomId)?.item_name ?? null,
        challan: D(l.challanQty ?? D(l.receivedQty).plus(D(l.damagedQty))), received: D(l.receivedQty), damaged: D(l.damagedQty), free: D(l.freeQty),
        damageReasonId: l.damageReasonId ?? null, excess: excessOf[i], excessAction: l.excessAction ?? null, rows };
    });
    const { issues, checks } = await this.judge(db, h.companyId, h.branchId, h.docDate, settings, facts);
    return { problems, warnings, sup, units, excessOf, settings, priceAtGrn, calc, issues, checks };
  }

  /** The strip + Check column for a set of line facts (validate / save / get / post). */
  private async judge(db: Prisma.TransactionClient | PrismaService, companyId: string, branchId: string, docDate: string,
                      settings: { shelfLifeMode: 'OFF' | 'WARN' | 'REFUSE'; minShelfLifePct: number }, facts: GrnLineFact[]) {
    const tx = db as Prisma.TransactionClient;
    const [shelf, serial] = await Promise.all([
      grnShelfLife(tx, settings.minShelfLifePct, docDate, facts),
      serialFacts(tx, companyId, branchId, docDate, facts.map((f) => ({ itemId: f.itemId, serials: [] })) as unknown as LineFact[]),
    ]);
    return judgeGrnLines(facts, shelf, settings.shelfLifeMode, serial.tracked);
  }

  /** POST /grns/validate — the server's figures for a GRN being keyed, the strip and the Check column. Writes nothing. */
  async validate(dto: SaveGrnDto) {
    const p = await this.prepare(this.prisma, dto);
    const issues: PurIssue[] = [
      ...p.problems.map((x) => ({ ...x, level: 'REFUSE' as const, lineNo: lineNoOf(dto, x.field), needsRight: null })),
      ...p.warnings.map((x) => ({ ...x, level: 'WARN' as const, lineNo: lineNoOf(dto, x.field), needsRight: null })),
      ...p.issues,
    ];
    const poRefs = await this.poRefsOf(this.prisma, dto.lines.map((l) => l.poItemId).filter((x): x is string => !!x), 'poi');
    const godown = await this.prisma.$queryRaw<{ gdl_name: string }[]>`SELECT gdl_name FROM inventory.godown_locations WHERE gdl_id = ${dto.header.godownId}::uuid`;
    const c = p.calc;
    const lines = dto.lines.map((l, i) => ({
      lineNo: l.lineNo, receivedQty: String(l.receivedQty), freeQty: String(l.freeQty ?? 0), excessQty: (p.excessOf[i] ?? ZERO).toString(), excessAction: l.excessAction ?? null,
      value: c ? c.lines[i].netGross.toFixed(2) : null, offbillShare: c ? c.lines[i].offbillShare.toFixed(2) : null, check: p.checks.get(l.lineNo) ?? null,
    }));
    const charges = c ? c.charges.map((ch, i) => ({ chgId: dto.charges![i].chgId, amount: ch.amount.abs().toFixed(2), payees: ch.payees.map((x) => ({ partyId: x.partyId, amount: x.amount.abs().toFixed(2) })) })) : [];
    return jsonSafe({
      header: { supplierName: p.sup.sup_name, godownName: godown[0]?.gdl_name ?? null, poRefs, transport: dto.header.transport ? this.bandInput(dto.header.transport, dto.header, p.sup.sup_name) : null },
      lines, charges,
      totals: c ? this.totalsOf(dto.lines.map((l, i) => ({ factor: p.units.get(l.uomId)?.iuc_to_base_factor ?? D(1), challan: D(l.challanQty ?? D(l.receivedQty).plus(D(l.damagedQty))),
                    received: D(l.receivedQty), damaged: D(l.damagedQty), free: D(l.freeQty), value: c.lines[i].netGross })), c.offbillCharges) : null,
      warnings: issues.filter((x) => x.level === 'WARN'), refusals: issues.filter((x) => x.level === 'REFUSE'),
    });
  }

  /** The six cells of the totals strip. */
  private totalsOf(rows: { factor: Prisma.Decimal; challan: Prisma.Decimal; received: Prisma.Decimal; damaged: Prisma.Decimal; free: Prisma.Decimal; value: Prisma.Decimal }[], offbill: Prisma.Decimal) {
    let rec = ZERO, dmg = ZERO, free = ZERO, short = ZERO, val = ZERO, shortLines = 0;
    for (const r of rows) {
      rec = rec.plus(r.received.times(r.factor)); dmg = dmg.plus(r.damaged.times(r.factor)); free = free.plus(r.free.times(r.factor)); val = val.plus(r.value);
      const s = r.challan.minus(r.received).minus(r.damaged);
      if (s.greaterThan(0)) { short = short.plus(s.times(r.factor)); shortLines++; }
    }
    return { lines: rows.length, receivedBase: rec.toString(), damagedBase: dmg.toString(), freeBase: free.toString(), shortBase: short.toString(), shortLines,
             offbillCharges: offbill.abs().toFixed(2), provisionalValue: val.toFixed(2), total: val.plus(offbill.abs()).toFixed(2) };
  }

  /** The POs the lines draw on (multi-PO GRN): from PO line ids ('poi') or PO ids ('po'). */
  private async poRefsOf(db: Prisma.TransactionClient | PrismaService, ids: string[], kind: 'poi' | 'po') {
    if (!ids.length) return [] as { poId: string; accYear: string; refno: string }[];
    return kind === 'poi'
      ? db.$queryRaw<{ poId: string; accYear: string; refno: string }[]>`
          SELECT DISTINCT po.po_id AS "poId", po.po_acc_year AS "accYear", po.po_refno AS "refno" FROM purchase.pur_order_item poi
            JOIN purchase.pur_order po ON po.po_id = poi.poi_po_id AND po.po_acc_year = poi.poi_acc_year WHERE poi.poi_id = ANY(${[...new Set(ids)]}::uuid[]) ORDER BY 3`
      : db.$queryRaw<{ poId: string; accYear: string; refno: string }[]>`
          SELECT po_id AS "poId", po_acc_year AS "accYear", po_refno AS "refno" FROM purchase.pur_order WHERE po_id = ANY(${[...new Set(ids)]}::uuid[]) ORDER BY 3`;
  }

  private bandInput(t: PurchaseTransportDto, h: GrnHeaderDto, supplierName: string): TransportBandInput {
    return {
      direction: 'INWARD', from: { name: supplierName }, to: { godownId: h.godownId, branchId: h.branchId },
      mode: t.mode ?? null, transporterId: t.transporterId ?? null, transporterName: t.transporterName?.trim() || null,
      transporterGstin: t.transporterGstin?.trim() || null, lrNo: t.lrNo?.trim() || null, lrDate: t.lrDate?.slice(0, 10) ?? null,
      distanceKm: t.distanceKm ?? null, remarks: t.remarks?.trim() || null,
    };
  }

  /** The transport band: omitted = kept, null / all blank = removed. */
  private async writeTransport(tx: Prisma.TransactionClient, h: GrnHeaderDto, supplierName: string, grnId: string, refno: string, actor: string) {
    if (h.transport === undefined) return;
    const ref = { docType: 'GRN' as const, docId: grnId, accYear: h.accYear, companyId: h.companyId, branchId: h.branchId, docRefno: refno };
    const t = h.transport;
    const carriage = t && (t.mode || t.transporterId || t.transporterName?.trim() || t.transporterGstin?.trim() || t.lrNo?.trim() || t.lrDate || t.distanceKm != null || t.remarks?.trim());
    if (!t || !carriage) { await this.transportBand.remove(tx, ref, actor); return; }
    const input = this.bandInput(t, h, supplierName);
    if (input.transporterId) {
      const [m] = await tx.$queryRaw<{ trn_name: string; trn_gstin: string | null }[]>`SELECT trn_name, trn_gstin FROM public.transporter_master WHERE trn_id = ${input.transporterId}::uuid AND NOT trn_is_deleted`;
      if (!m) purNotFound(`Transporter ${input.transporterId} not found`, 'PUR_TRANSPORTER_NOT_FOUND', 'header.transport.transporterId');
      input.transporterName = input.transporterName ?? m.trn_name;
      input.transporterGstin = input.transporterGstin ?? m.trn_gstin ?? null;
    }
    await this.transportBand.write(tx, ref, input, actor, { gdrId: null });
  }

  async save(dto: SaveGrnDto) {
    const actor = this.actor();
    const h = dto.header;
    const warnings: PurIssue[] = [];
    const id = await this.prisma.$transaction(async (tx) => {
      const p = await this.prepare(tx, dto);
      if (p.problems.length) purRefuseMany(p.problems[0].message, p.problems);
      const { units, excessOf, priceAtGrn } = p;
      const calc = p.calc!;
      // the strip: REFUSE entries stop a post (a draft still saves) unless overridden (needsRight OVERRIDE)
      const refusals = p.issues.filter((x) => x.level === 'REFUSE' && !(h.overrideWarnings && x.needsRight === 'OVERRIDE'));
      if (h.post && refusals.length) purRefuseMany(refusals[0].message, refusals.map((x) => ({ field: x.field, code: x.code, message: x.message })));
      warnings.push(...p.warnings.map((x) => ({ ...x, level: 'WARN' as const, lineNo: lineNoOf(dto, x.field), needsRight: null })), ...p.issues);

      let grnId = h.grnId ?? null;
      let slno: bigint, refno: string, isNew = false;
      let receivedAt: Date = h.receivedAt ? new Date(h.receivedAt) : new Date();
      if (grnId) {
        const cur = await tx.purGrn.findFirst({ where: { grnId, grnAccYear: h.accYear, grnIsDeleted: false } });
        if (!cur) purNotFound(`GRN ${grnId} not found`);
        if (cur.grnStatus !== 'DRAFT') purConflict(`${cur.grnRefno} is ${cur.grnStatus} — only a draft can be edited.`, PUR.NOT_DRAFT, 'grnId');
        slno = cur.grnSlno; refno = cur.grnRefno;
        if (!h.receivedAt && cur.grnReceivedAt) receivedAt = cur.grnReceivedAt;   // kept unless typed again
        await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC, piaDocId: grnId, piaAccYear: h.accYear } });
        await tx.purGrnItem.deleteMany({ where: { griGrnId: grnId, griAccYear: h.accYear } });
        await tx.$executeRaw`DELETE FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC} AND cd_doc_id = ${grnId}::uuid AND cd_acc_year = ${h.accYear}::bpchar`;
      } else {
        ({ slno, refno } = await allocateDocNumber(tx, 'GRN', h.companyId, h.branchId, h.accYear, h.deviceId));
        isNew = true;
      }
      const provisional = calc.lines.reduce((s, l) => s.plus(l.netGross), ZERO);
      const data = {
        grnCompanyId: h.companyId, grnBranchId: h.branchId, grnAccYear: h.accYear, grnDeviceId: h.deviceId, grnSlno: slno, grnRefno: refno,
        grnDocDate: dateOf(h.docDate)!, grnSupplierId: h.supplierId, grnGodownId: h.godownId, grnChallanNo: h.challanNo ?? null,
        grnChallanDate: dateOf(h.challanDate), grnSupplierInvNo: h.supplierInvNo ?? null,
        grnReceivedAt: receivedAt, grnReceivedBy: h.receivedBy ?? [], grnSupervisorId: h.supervisorId ?? null,
        grnVehicleNo: h.vehicleNo ?? null, grnDriverName: h.driverName ?? null, grnEwbNo: h.ewbNo ?? null, grnEwbDate: dateOf(h.ewbDate),
        grnPackagesSent: h.packagesSent ?? null, grnPackagesReceived: h.packagesReceived ?? null,
        grnProvisionalValue: provisional, grnOffbillCharges: calc.offbillCharges, grnRemarks: h.remarks ?? null, grnStatus: 'DRAFT',
      };
      if (isNew) grnId = (await tx.purGrn.create({ data: { ...data, grnCreatedBy: actor }, select: { grnId: true } })).grnId;
      else await tx.purGrn.update({ where: { grnId_grnAccYear: { grnId: grnId!, grnAccYear: h.accYear } }, data: { ...data, grnModifiedBy: actor, grnModifiedOn: new Date(), grnRevisionNo: { increment: 1 } } });

      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i], o = calc.lines[i], u = units.get(l.uomId)!;
        const row = await tx.purGrnItem.create({ data: {
          griGrnId: grnId!, griCompanyId: h.companyId, griBranchId: h.branchId, griAccYear: h.accYear, griLineNo: l.lineNo,
          griItemId: l.itemId, griUomId: l.uomId, griBaseUomId: u.base_iuc_id, griToBaseFactor: u.iuc_to_base_factor, griHsnCode: u.item_hsn_code, griWeight: l.weight ?? null,
          griSrcDocType: l.poItemId ? 'PURCHASE_ORDER' : null, griSrcDocId: l.poItemId ? await this.poIdOf(tx, l.poItemId) : null,
          griSrcDocYear: l.poItemId ? (l.poItemAccYear ?? h.accYear) : null, griSrcItemId: l.poItemId ?? null,
          griChallanQty: D(l.challanQty ?? D(l.receivedQty).plus(D(l.damagedQty))), griReceivedQty: D(l.receivedQty), griDamagedQty: D(l.damagedQty),
          griDamageReasonId: l.damageReasonId ?? null, griFreeQty: D(l.freeQty), griExcessQty: excessOf[i], griExcessAction: l.excessAction ?? null,
          griProvisionalRate: D(l.rate), griOffbillShare: o.offbillShare, griValue: o.netGross, griMrp: l.mrp ?? null, griSellA: l.sellA ?? null,
          griSellB: l.sellB ?? null, griSellC: l.sellC ?? null, griSellD: l.sellD ?? null,
          griPriceUpdateResult: priceAtGrn ? 'NONE' : 'OFF',
          griRemarks: l.remarks ?? null, griCreatedBy: actor,
        }, select: { griId: true } });
        const allocs = l.allocs?.length ? l.allocs : [
          ...(D(l.receivedQty).plus(D(l.freeQty)).greaterThan(0) ? [{ bucket: 'SALEABLE', qty: l.receivedQty, freeQty: l.freeQty ?? 0 }] : []),
          ...(D(l.damagedQty).greaterThan(0) ? [{ bucket: 'DAMAGED', qty: l.damagedQty!, freeQty: 0 }] : []),
        ] as PurchaseAllocDto[];
        const sum = allocs.reduce((s, a) => s.plus(D(a.qty)).plus(D(a.freeQty)), ZERO);
        const want = D(l.receivedQty).plus(D(l.damagedQty)).plus(D(l.freeQty));
        if (!sum.equals(want)) purRefuse(`Line ${l.lineNo}: the batch split adds up to ${sum}, it must be ${want} (received + damaged + free)`, PUR.ALLOC_SUM_MISMATCH, `lines.${i}.allocs`);
        let k = 0;
        for (const a of allocs) {
          await tx.purItemAlloc.create({ data: {
            piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC, piaDocId: grnId!, piaLineId: row.griId, piaRowNo: ++k,
            piaGodownId: a.godownId ?? h.godownId, piaBucket: a.bucket ?? 'SALEABLE', piaBatchNo: a.batchNo?.trim() || null,
            piaMfgDate: dateOf(a.mfgDate), piaExpiryDate: dateOf(a.expiryDate), piaMrp: a.mrp ?? l.mrp ?? null, piaSalePrice: a.salePrice ?? l.sellA ?? null,
            piaSerialNo: a.serialNo?.trim() || null, piaSizeId: a.sizeId ?? null, piaColourId: a.colourId ?? null, piaModel: a.model ?? null,
            piaQty: D(a.qty), piaFreeQty: D(a.freeQty), piaCreatedBy: actor,
          } });
        }
      }
      await this.writeCharges(tx, dto, calc.charges, grnId!, slno, h, actor);
      await this.writeTransport(tx, h, p.sup.sup_name, grnId!, refno, actor);
      if (isNew) await statusLog(tx, { companyId: h.companyId, branchId: h.branchId, accYear: h.accYear, docType: TxnStatusDocType.GRN, docId: grnId!, refno, event: TxnStatusEvent.CREATED, from: null, to: 'DRAFT', actor, deviceId: h.deviceId });
      if (h.post) {
        const notes = await this.postInTx(tx, grnId!, h.accYear, actor, { override: !!h.overrideWarnings, reason: h.overrideReason ?? null });
        warnings.push(...notes.filter((n) => n.code !== 'PUR_SHELF_LIFE').map((n) => ({ ...n, level: 'WARN' as const, lineNo: lineNoOf(dto, n.field), needsRight: null })));
      }
      return grnId!;
    }, { timeout: 60000, maxWait: 10000 });
    return { ...(await this.get(id, h.accYear)), warnings: warnings.filter((w) => w.level === 'WARN'), refusals: h.post ? [] : warnings.filter((w) => w.level === 'REFUSE') };
  }

  /** The PO line's qty still to come, in BASE units, leaving out this GRN (a draft being saved again). */
  private async poPendingBase(tx: Prisma.TransactionClient, poiId: string, exceptGrnId: string | null): Promise<Prisma.Decimal | null> {
    const [r] = await tx.$queryRaw<{ pending: Prisma.Decimal | null }[]>`
      SELECT (poi.poi_qty - poi.poi_short_closed_qty) * poi.poi_to_base_factor
             - COALESCE((SELECT SUM((gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor)
                           FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
                          WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND gri.gri_src_item_id = poi.poi_id AND NOT gri.gri_is_deleted
                            AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED' AND g.grn_id IS DISTINCT FROM ${exceptGrnId}::uuid), 0)
             - COALESCE((SELECT SUM(pii.pii_billed_qty * pii.pii_to_base_factor)
                           FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
                          WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND pii.pii_src_item_id = poi.poi_id AND NOT pii.pii_is_deleted
                            AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED'), 0) AS pending
        FROM purchase.pur_order_item poi WHERE poi.poi_id = ${poiId}::uuid AND NOT poi.poi_is_deleted`;
    return r ? D(r.pending) : null;
  }

  /** The company's off-bill unloading charge, one payee per loadman. None set up → no coolie. */
  private async coolieFor(tx: Prisma.TransactionClient, employees: string[]): Promise<PurchaseChargeDto[]> {
    const [c] = await tx.$queryRaw<{ chg_id: string }[]>`
      SELECT chg_id FROM public.charge_master
       WHERE chg_role = 'UNLOADING' AND chg_module IN ('P','B') AND NOT chg_on_bill AND chg_is_active AND NOT chg_is_deleted
       ORDER BY chg_module, chg_code LIMIT 1`;
    return c ? [{ chgId: c.chg_id, payees: employees.map((partyId) => ({ partyId })) } as PurchaseChargeDto] : [];
  }

  private async poIdOf(tx: Prisma.TransactionClient, poiId: string) {
    const [r] = await tx.$queryRaw<{ id: string }[]>`SELECT poi_po_id AS id FROM purchase.pur_order_item WHERE poi_id = ${poiId}::uuid LIMIT 1`;
    if (!r) purRefuse(`PO line ${poiId} not found`, PUR.NOT_FOUND, 'lines.poItemId', 404);
    await assertPoApproved(tx, r.id);   // purchase.po_approval_above (WS3)
    return r.id;
  }

  private async loadCharges(tx: Prisma.TransactionClient, charges: PurchaseChargeDto[]): Promise<CalcChargeIn[]> {
    if (!charges.length) return [];
    const ids = charges.map((c) => c.chgId);
    const rows = await tx.$queryRaw<{ chg_id: string; chg_type: string; chg_method: string; chg_default_rate: Prisma.Decimal | null; chg_cost_alloc: string | null; chg_on_bill: boolean; chg_name: string }[]>`
      SELECT chg_id, chg_type, chg_method, chg_default_rate, chg_cost_alloc, chg_on_bill, chg_name FROM public.charge_master
       WHERE chg_id = ANY(${ids}::uuid[]) AND NOT chg_is_deleted AND chg_module IN ('P','B')`;
    const by = new Map(rows.map((r) => [r.chg_id, r]));
    return charges.map((c, i) => {
      const m = by.get(c.chgId);
      if (!m) purRefuse(`Charge ${c.chgId} is not a purchase charge`, PUR.CHARGE_NOT_FOUND, `charges.${i}.chgId`);
      if (m.chg_on_bill) purRefuse(`${m.chg_name} is a supplier's-bill charge — it belongs on the purchase invoice, not the GRN.`, PUR.CHARGE_NOT_FOUND, `charges.${i}.chgId`);
      return { key: String(i), type: m.chg_type === 'DEDUCT' ? 'DEDUCT' : 'ADD', method: m.chg_method as CalcChargeIn['method'], rate: c.rate ?? m.chg_default_rate ?? 0,
        amount: c.amount ?? null, alloc: ((m.chg_cost_alloc && m.chg_cost_alloc !== 'NONE' ? m.chg_cost_alloc : 'VALUE') as CalcChargeIn['alloc']),
        beforeTax: false, onBill: false, landingCost: true, taxPct: 0, payees: (c.payees ?? []).map((p) => ({ partyId: p.partyId, amount: p.amount ?? null })) };
    });
  }

  private async writeCharges(tx: Prisma.TransactionClient, dto: SaveGrnDto, out: { amount: Prisma.Decimal; payees: { partyId: string; amount: Prisma.Decimal }[] }[],
                             grnId: string, slno: bigint, h: GrnHeaderDto, actor: string) {
    let n = 0;
    for (let i = 0; i < (dto.charges ?? []).length; i++) {
      const c = dto.charges![i];
      const [m] = await tx.$queryRaw<{ chg_name: string; chg_role: string | null; chg_method: string; chg_type: string; chg_cost_alloc: string | null; chg_ledger_code: string; chg_default_rate: Prisma.Decimal | null }[]>`
        SELECT chg_name, chg_role, chg_method, chg_type, chg_cost_alloc, chg_ledger_code, chg_default_rate FROM public.charge_master WHERE chg_id = ${c.chgId}::uuid`;
      const rows = out[i].payees.length ? out[i].payees : [{ partyId: null as unknown as string, amount: out[i].amount }];
      for (const r of rows) {
        await tx.$executeRaw`
          INSERT INTO public.txn_charge_detail (cd_doc_type, cd_doc_id, cd_slno, cd_comp_id, cd_branch_id, cd_acc_year, cd_voucher_no,
            cd_chg_id, cd_chg_name, cd_role, cd_method, cd_type, cd_apply_on, cd_ledger_code, cd_landing_cost, cd_cost_alloc, cd_before_tax, cd_tax_apl, cd_sep_post,
            cd_rate, cd_amount, cd_net_amt, cd_on_bill, cd_party_id, cd_created_by)
          VALUES (${DOC}, ${grnId}::uuid, ${++n}::int, ${h.companyId}::uuid, ${h.branchId}::uuid, ${h.accYear}::bpchar, ${slno}::bigint,
            ${c.chgId}::uuid, ${m.chg_name}, ${m.chg_role}, ${m.chg_method}, ${m.chg_type}, ${m.chg_cost_alloc ?? 'VALUE'}, ${m.chg_ledger_code}::uuid, true,
            ${m.chg_cost_alloc}, false, false, false, ${c.rate ?? m.chg_default_rate ?? 0}::numeric, ${r.amount.abs()}::numeric, ${r.amount.abs()}::numeric,
            false, ${r.partyId}::uuid, ${actor})`;
      }
    }
  }

  async post(grnId: string, accYear: string, ov: { override: boolean; reason: string | null } = { override: false, reason: null }) {
    const actor = this.actor();
    const warnings = await this.prisma.$transaction((tx) => this.postInTx(tx, grnId, accYear, actor, ov), { timeout: 60000, maxWait: 10000 });
    return { ...(await this.get(grnId, accYear)), warnings };
  }

  /** Posts the draft; returns what the screen should be told (shelf life, prices kept / not written, an override logged). */
  private async postInTx(tx: Prisma.TransactionClient, grnId: string, accYear: string, actor: string, ov: { override: boolean; reason: string | null } = { override: false, reason: null }) {
    const notes: { field: string; code: string; message: string }[] = [];
    const g = await tx.purGrn.findFirst({ where: { grnId, grnAccYear: accYear, grnIsDeleted: false } });
    if (!g) purNotFound(`GRN ${grnId} not found`);
    if (g.grnStatus !== 'DRAFT') purConflict(`${g.grnRefno} is ${g.grnStatus} — only a draft can be posted.`, PUR.NOT_DRAFT, 'grnId');
    const lines = await tx.purGrnItem.findMany({ where: { griGrnId: grnId, griAccYear: accYear, griIsDeleted: false }, orderBy: { griLineNo: 'asc' } });
    const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: grnId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: { piaRowNo: 'asc' } });
    const byLine = new Map(lines.map((l) => [l.griId, l]));
    const postedOn = new Date();
    const docDate = isoDate(g.grnDocDate);
    // ENT-15 under the post too (a draft saved before the setting changed)
    const settings = await loadPurchaseSettings(tx, g.grnCompanyId, g.grnBranchId);
    const shelf = await shelfLifeIssues(tx, settings.shelfLifeMode, settings.minShelfLifePct, docDate,
      allocs.map((a) => { const l = byLine.get(a.piaLineId)!; return { lineNo: l.griLineNo, index: l.griLineNo - 1, itemId: l.griItemId, bucket: a.piaBucket, mfgDate: a.piaMfgDate, expiryDate: a.piaExpiryDate }; }));
    if (shelf.length && settings.shelfLifeMode === 'REFUSE' && !ov.override) purRefuseMany(shelf[0].message, shelf);
    const facts = await this.factsOfSaved(tx, g.grnCompanyId, g.grnBranchId, lines, allocs);
    const { issues } = await this.judge(tx, g.grnCompanyId, g.grnBranchId, docDate, settings, facts);
    // user 2026-10-29: serials short of the pieces stop the post (no override) — a draft saved before the rule, or posted by /grns/post
    const serialShort = issues.filter((x) => x.code === 'PUR_SERIAL_COUNT');
    if (serialShort.length) purRefuseMany(serialShort[0].message, serialShort.map((x) => ({ field: x.field, code: x.code, message: x.message })));
    // "override (logged)": what the post went past goes on the trail — the REFUSE shelf life and the strip's warnings
    if (ov.override) {
      if (issues.length) {
        const what = [...new Set(issues.map((x) => x.code))].join(', ');
        await statusLog(tx, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, docType: TxnStatusDocType.GRN, docId: grnId, refno: g.grnRefno,
          event: TxnStatusEvent.WARN_OVERRIDE, from: 'DRAFT', to: 'POSTED', actor, deviceId: g.grnDeviceId, remarks: `${what}${ov.reason ? ` — ${ov.reason}` : ''}`.slice(0, 250) });
        notes.push({ field: 'header.overrideWarnings', code: 'PUR_WARN_OVERRIDDEN', message: `Posted past ${what} (override logged).` });
      }
    }
    const cost = (l: (typeof lines)[number]) => {
      const inBase = l.griReceivedQty.plus(l.griDamagedQty).plus(l.griFreeQty).times(l.griToBaseFactor);
      return inBase.isZero() ? ZERO : l.griValue.plus(l.griOffbillShare).dividedBy(inBase).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
    };
    const { perRow } = await postShadowStock(tx, this.stockPosting,
      { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, deviceId: g.grnDeviceId, sessionId: g.grnSessionId, docType: DOC, docId: grnId,
        refno: g.grnRefno, revision: g.grnRevisionNo, usrRefno: g.grnChallanNo, docDate, supplierId: g.grnSupplierId, remarks: `GRN ${g.grnRefno}` },
      this.rules(),
      allocs.map((a) => {
        const l = byLine.get(a.piaLineId)!;
        return { itemId: l.griItemId, uomId: l.griUomId, baseUomId: l.griBaseUomId, factor: l.griToBaseFactor, godownId: a.piaGodownId, bucket: a.piaBucket,
          batchNo: a.piaBatchNo, mfgDate: a.piaMfgDate, expiryDate: a.piaExpiryDate, mrp: a.piaMrp, salePrice: a.piaSalePrice, serialNo: a.piaSerialNo,
          sizeId: a.piaSizeId, colourId: a.piaColourId, model: a.piaModel,
          supplierId: g.grnSupplierId, qty: a.piaQty, freeQty: a.piaFreeQty, costRate: cost(l) };
      }),
      actor, postedOn);
    for (let i = 0; i < allocs.length; i++) {
      if (perRow[i]?.sviId) await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: allocs[i].piaId, piaAccYear: accYear } }, data: { piaLotId: perRow[i].lotId, piaSviId: perRow[i].sviId, piaSviAccYear: accYear, piaBatchNo: perRow[i].batchNo } });
    }

    // books: Dr Stock (provisional + own labour) / Cr GRNI / Cr payees
    const vt = await voucherTypeId(tx, 'GRN');
    const charges = await tx.$queryRaw<{ cd_amount: Prisma.Decimal; cd_party_id: string | null; cd_ledger_code: string; cd_chg_name: string }[]>`
      SELECT cd_amount, cd_party_id, cd_ledger_code, cd_chg_name FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC} AND cd_doc_id = ${grnId}::uuid AND cd_acc_year = ${accYear}::bpchar AND NOT cd_is_deleted`;
    const legs: VoucherLeg[] = [];
    const offbill = charges.reduce((s, c) => s.plus(c.cd_amount), ZERO);
    legs.push({ role: 'INVENTORY', drCr: 'DR', amount: num2(g.grnProvisionalValue.plus(offbill)), roleTag: 'INVENTORY', remarks: `GRN ${g.grnRefno}` });
    legs.push({ role: 'GRNI', drCr: 'CR', amount: num2(g.grnProvisionalValue), roleTag: 'GRNI', remarks: `GRN ${g.grnRefno} — bill pending` });
    for (const c of charges) legs.push({ ledgerId: c.cd_party_id ?? c.cd_ledger_code, drCr: 'CR', amount: num2(c.cd_amount), remarks: `${c.cd_chg_name} · ${g.grnRefno}` });
    const posted = await this.vouchers.postLegs(tx, {
      header: { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: 'PURCHASE', srcDocType: DOC, srcDocId: grnId,
        docLabel: 'GRN', docRefno: g.grnRefno, docDate, usrRefno: g.grnChallanNo, docAmount: num2(g.grnProvisionalValue), partyId: g.grnSupplierId,
        userId: actor, sessionId: g.grnSessionId, deviceId: g.grnDeviceId, remarks: g.grnRemarks ?? `GRN ${g.grnRefno}`, createdBy: actor,
        presetRefno: g.grnRefno, presetNo: g.grnSlno },
      legs: legs.filter((l) => l.amount >= 0.005),
    });
    let k = 0;
    for (const c of charges) {
      await raiseBillRow(tx, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, partyId: c.cd_party_id ?? c.cd_ledger_code, billType: 'PURCHASE', drCr: 'CR',
        amount: c.cd_amount, docType: DOC, docId: grnId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: g.grnSlno, voucherDate: docDate,
        refno: g.grnRefno, refSuffix: `C${++k}`, docDate: g.grnDocDate, narration: `${c.cd_chg_name} — ${g.grnRefno}`, actor });
    }
    // challan short → a qty-only shortage row the bill adopts (R3)
    for (const l of lines) {
      const short = l.griChallanQty.minus(l.griReceivedQty).minus(l.griDamagedQty);
      if (!short.greaterThan(0)) continue;
      await tx.purShortage.create({ data: {
        pshCompanyId: g.grnCompanyId, pshBranchId: g.grnBranchId, pshAccYear: accYear, pshSupplierId: g.grnSupplierId, pshItemId: l.griItemId,
        pshSrcDocType: DOC, pshSrcDocId: grnId, pshSrcDocYear: accYear, pshSrcItemId: l.griId, pshSrcDocRefno: g.grnRefno,
        pshReason: 'SHORT_CHALLAN', pshQtyBase: short.times(l.griToBaseFactor), pshOriginCostRate: cost(l), pshCreatedBy: actor,
      } });
    }
    // purchase.price_set_at = GRN: the GRN's Sell A–D / MRP go through the purchase price writer (D16: a newer change wins)
    if (settings.allowPriceUpdate && settings.priceUpdate === 'UPDATE_PRICES' && settings.priceSetAt === 'GRN') {
      const lv = (v: Prisma.Decimal | null) => (v ? Number(v) : 0);
      const businessTime = docDate === isoDate(postedOn) ? postedOn : new Date(`${docDate}T23:59:59.999+05:30`);
      const result = await this.prices.applyPurchasePrices(tx, {
        companyId: g.grnCompanyId, branchId: g.grnBranchId, actor, billRef: g.grnRefno, businessTime,
        rows: lines.map((l) => ({ key: l.griId, itemId: l.griItemId, uomId: l.griUomId, mrp: l.griMrp ? Number(l.griMrp) : null,
                                  levels: [{ level: 1, price: lv(l.griSellA) }, { level: 2, price: lv(l.griSellB) }, { level: 3, price: lv(l.griSellC) }, { level: 4, price: lv(l.griSellD) }] })),
      });
      for (const l of lines) {
        const r = result.get(l.griId);
        if (!r) continue;
        await tx.purGrnItem.update({ where: { griId_griAccYear: { griId: l.griId, griAccYear: accYear } }, data: { griPriceUpdateResult: r.result } });
        if (r.note) notes.push({ field: `lines.${l.griLineNo - 1}`, code: r.result === 'KEPT_NEWER' ? 'PUR_PRICE_KEPT_NEWER' : 'PUR_PRICE_NOT_WRITTEN', message: `Line ${l.griLineNo}: ${r.note}` });
      }
    }
    await tx.purGrn.update({ where: { grnId_grnAccYear: { grnId, grnAccYear: accYear } }, data: { grnStatus: 'POSTED', grnPostedVoucherId: posted.voucherId, grnModifiedBy: actor, grnModifiedOn: postedOn } });
    await statusLog(tx, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear, docType: TxnStatusDocType.GRN, docId: grnId, refno: g.grnRefno, event: TxnStatusEvent.POSTED, from: 'DRAFT', to: 'POSTED', actor, deviceId: g.grnDeviceId });
    return [...shelf, ...notes];
  }

  /**
   * ENT-21 — the labels of a posted GRN or bill: one row per SALEABLE allocation row (damaged
   * pieces get none), copies = received + free. Barcode = the batch (textile: the piece label scans
   * on the sale bill), else the item's EAN for the line's unit. Price = the row's sale price, else
   * the line's Sell A, else the current price row. A bill from a GRN prints its GRN's rows.
   */
  async labels(q: LabelsFromDocDto) {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH r AS (
        SELECT a.pia_id, a.pia_row_no, a.pia_doc_type, a.pia_line_id, a.pia_company_id, a.pia_batch_no, a.pia_mrp, a.pia_sale_price,
               a.pia_size_id, a.pia_colour_id, a.pia_model, a.pia_expiry_date, a.pia_qty + a.pia_free_qty AS pieces
          FROM purchase.pur_item_alloc a
         WHERE NOT a.pia_is_deleted AND a.pia_bucket = 'SALEABLE' AND a.pia_acc_year = ${q.accYear}::bpchar
           AND ((a.pia_doc_type = ${q.docType} AND a.pia_doc_id = ${q.docId}::uuid)
             OR (${q.docType} = 'PURCHASE_BILL' AND a.pia_doc_type = 'GRN' AND a.pia_line_id IN (
                   SELECT pii_src_item_id FROM purchase.pur_invoice_item
                    WHERE pii_pi_id = ${q.docId}::uuid AND pii_src_doc_type = 'GRN' AND NOT pii_is_deleted))))
      SELECT r.pia_id AS "rowId", COALESCE(gri.gri_line_no, pii.pii_line_no) AS "lineNo", r.pia_row_no AS "rowNo",
             im.item_id AS "itemId", im.item_name_en AS "itemName", u.unit_name AS "unitName",
             COALESCE(NULLIF(r.pia_batch_no, ''), e.ean_code) AS "barcode", r.pia_batch_no AS "batchNo", e.ean_code AS "ean",
             COALESCE(r.pia_mrp, gri.gri_mrp, pii.pii_mrp) AS "mrp",
             COALESCE(r.pia_sale_price, gri.gri_sell_a, pii.pii_sell_a, p.ipm_sales_price_a) AS "price",
             sz.isz_name AS "size", cl.icl_name AS "colour", r.pia_model AS "model", r.pia_expiry_date AS "expiryDate",
             r.pieces AS "qty", c.comp_name AS "companyName"
        FROM r
        LEFT JOIN purchase.pur_grn_item gri ON r.pia_doc_type = 'GRN' AND gri.gri_id = r.pia_line_id
        LEFT JOIN purchase.pur_invoice_item pii ON r.pia_doc_type = 'PURCHASE_BILL' AND pii.pii_id = r.pia_line_id
        JOIN inventory.item_master im ON im.item_id = COALESCE(gri.gri_item_id, pii.pii_item_id)
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = COALESCE(gri.gri_uom_id, pii.pii_uom_id)
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.item_size_master sz ON sz.isz_id = r.pia_size_id
        LEFT JOIN inventory.item_colour_master cl ON cl.icl_id = r.pia_colour_id
        LEFT JOIN public.companys c ON c.comp_id = r.pia_company_id
        LEFT JOIN LATERAL (SELECT ean_code FROM inventory.item_ean_codes
                            WHERE ean_item_id = im.item_id AND ean_uc_unit_id = iuc.iuc_id AND ean_is_active AND NOT ean_is_deleted
                            ORDER BY ean_is_default DESC, ean_sl_no LIMIT 1) e ON true
        LEFT JOIN LATERAL (SELECT ipm_sales_price_a FROM inventory.item_price_master
                            WHERE ipm_item_id = im.item_id AND ipm_uc_unit_id = iuc.iuc_id AND ipm_is_active AND NOT ipm_is_deleted
                            ORDER BY (ipm_branch_id IS NOT NULL) DESC, ipm_effective_from DESC NULLS LAST LIMIT 1) p ON true
       ORDER BY 2, 3`;
    if (!rows.length) {
      const [doc] = q.docType === 'GRN'
        ? await this.prisma.$queryRaw<{ s: string }[]>`SELECT grn_status AS s FROM purchase.pur_grn WHERE grn_id = ${q.docId}::uuid AND grn_acc_year = ${q.accYear}::bpchar`
        : await this.prisma.$queryRaw<{ s: string }[]>`SELECT pi_status AS s FROM purchase.pur_invoice WHERE pi_id = ${q.docId}::uuid AND pi_acc_year = ${q.accYear}::bpchar`;
      if (!doc) purNotFound(`${q.docType} ${q.docId} not found`);
    }
    return jsonSafe(rows.map((r) => ({ ...r, copies: Math.max(1, Math.ceil(Number(r.qty))), textile: !!(r.size || r.colour || r.model) })));
  }

  /** The line facts of a saved GRN (for the strip / Check column on /get and under an override). */
  private async factsOfSaved(db: Prisma.TransactionClient | PrismaService, _companyId: string, _branchId: string,
                             lines: { griId: string; griLineNo: number; griItemId: string; griChallanQty: Prisma.Decimal; griReceivedQty: Prisma.Decimal; griDamagedQty: Prisma.Decimal;
                                      griFreeQty: Prisma.Decimal; griDamageReasonId: string | null; griExcessQty: Prisma.Decimal; griExcessAction: string | null }[],
                             allocs: { piaLineId: string; piaBucket: string; piaQty: Prisma.Decimal; piaFreeQty: Prisma.Decimal; piaMfgDate: Date | null; piaExpiryDate: Date | null; piaSerialNo: string | null }[]): Promise<GrnLineFact[]> {
    const names = lines.length ? await db.$queryRaw<{ item_id: string; name: string | null }[]>`
      SELECT item_id, item_name_en AS name FROM inventory.item_master WHERE item_id = ANY(${[...new Set(lines.map((l) => l.griItemId))]}::uuid[])` : [];
    const nameOf = new Map(names.map((n) => [n.item_id, n.name]));
    return lines.map((l, i) => ({
      index: i, lineNo: l.griLineNo, itemId: l.griItemId, itemName: nameOf.get(l.griItemId) ?? null, challan: l.griChallanQty, received: l.griReceivedQty,
      damaged: l.griDamagedQty, free: l.griFreeQty, damageReasonId: l.griDamageReasonId, excess: l.griExcessQty ?? ZERO, excessAction: l.griExcessAction,
      rows: allocs.filter((a) => a.piaLineId === l.griId).map((a) => ({ bucket: a.piaBucket, qty: a.piaQty.plus(a.piaFreeQty), mfgDate: a.piaMfgDate, expiryDate: a.piaExpiryDate, serialNo: a.piaSerialNo })),
    }));
  }

  async get(grnId: string, accYear: string) {
    const header = await this.prisma.purGrn.findFirst({ where: { grnId, grnAccYear: accYear, grnIsDeleted: false } });
    if (!header) purNotFound(`GRN ${grnId} not found`);
    const [lines, allocs, sup] = await Promise.all([
      this.prisma.purGrnItem.findMany({ where: { griGrnId: grnId, griAccYear: accYear, griIsDeleted: false }, orderBy: { griLineNo: 'asc' } }),
      this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC, piaDocId: grnId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: { piaRowNo: 'asc' } }),
      this.prisma.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.grnSupplierId}::uuid`,
    ]);
    // bill status per line: a bill takes a GRN line WHOLE (grnItemId), so a line is billed or not; the GRN is BILLED / PART / NOT_BILLED
    const billedRows = await this.prisma.$queryRaw<{ id: string; refno: string }[]>`
      SELECT pii.pii_src_item_id AS id, p.pi_refno AS refno FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
       WHERE pii.pii_src_doc_type = 'GRN' AND pii.pii_src_doc_id = ${grnId}::uuid AND NOT pii.pii_is_deleted AND p.pi_status <> 'CANCELLED' AND NOT p.pi_is_deleted`;
    const billedBy = new Map(billedRows.map((r) => [r.id, r.refno]));
    const nBilled = lines.filter((l) => billedBy.has(l.griId)).length;
    const billStatus = !nBilled ? 'NOT_BILLED' : nBilled === lines.length ? 'BILLED' : 'PART';
    const names = await unitNames(this.prisma, lines.map((l) => l.griUomId));
    const poRefs = await this.poRefsOf(this.prisma, lines.map((l) => l.griSrcDocId).filter((x): x is string => !!x), 'po');
    const poRef = new Map(poRefs.map((r) => [r.poId, r.refno]));
    const people = [...header.grnReceivedBy, ...(header.grnSupervisorId ? [header.grnSupervisorId] : [])];
    const men = people.length ? await this.prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT emp_id AS id, emp_name AS name FROM public.employee_master WHERE emp_id = ANY(${people}::uuid[])` : [];
    const manName = new Map(men.map((m) => [m.id, m.name]));
    const [gd] = await this.prisma.$queryRaw<{ gdl_name: string }[]>`SELECT gdl_name FROM inventory.godown_locations WHERE gdl_id = ${header.grnGodownId}::uuid`;
    const reasons = await this.prisma.$queryRaw<{ srm_id: string; srm_name: string }[]>`
      SELECT srm_id, srm_name FROM stock.stock_reason_master WHERE srm_id = ANY(${lines.map((l) => l.griDamageReasonId).filter((x): x is string => !!x)}::uuid[])`;
    const reasonName = new Map(reasons.map((r) => [r.srm_id, r.srm_name]));
    // off-bill charges, one row per charge with its payees (loadmen / lorry owner)
    const cds = await this.prisma.$queryRaw<{ cd_chg_id: string; cd_chg_name: string; cd_role: string | null; cd_method: string; cd_type: string; cd_rate: Prisma.Decimal; cd_amount: Prisma.Decimal; cd_party_id: string | null; led_name: string | null }[]>`
      SELECT cd.cd_chg_id, cd.cd_chg_name, cd.cd_role, cd.cd_method, cd.cd_type, cd.cd_rate, cd.cd_amount, cd.cd_party_id, l.led_name
        FROM public.txn_charge_detail cd LEFT JOIN accounts.acc_ledger_master l ON l.led_id = cd.cd_party_id
       WHERE cd.cd_doc_type = ${DOC} AND cd.cd_doc_id = ${grnId}::uuid AND cd.cd_acc_year = ${accYear}::bpchar AND NOT cd.cd_is_deleted ORDER BY cd.cd_slno`;
    const charges: { chgId: string; chgName: string; role: string | null; method: string; type: string; rate: string; amount: Prisma.Decimal; payees: { partyId: string; partyName: string | null; amount: string }[] }[] = [];
    for (const c of cds) {
      let row = charges.find((x) => x.chgId === c.cd_chg_id);
      if (!row) { row = { chgId: c.cd_chg_id, chgName: c.cd_chg_name, role: c.cd_role, method: c.cd_method, type: c.cd_type, rate: D(c.cd_rate).toString(), amount: ZERO, payees: [] }; charges.push(row); }
      row.amount = row.amount.plus(c.cd_amount);
      if (c.cd_party_id) row.payees.push({ partyId: c.cd_party_id, partyName: c.led_name, amount: D(c.cd_amount).toFixed(2) });
    }
    const band = await this.transportBand.read({ docType: 'GRN', docId: grnId, accYear });
    const settings = await loadPurchaseSettings(this.prisma as unknown as Prisma.TransactionClient, header.grnCompanyId, header.grnBranchId);
    const facts = await this.factsOfSaved(this.prisma, header.grnCompanyId, header.grnBranchId, lines, allocs);
    const { checks } = await this.judge(this.prisma, header.grnCompanyId, header.grnBranchId, isoDate(header.grnDocDate), settings, facts);
    return jsonSafe({
      header: { ...header, supplierName: sup[0]?.sup_name ?? null, godownName: gd?.gdl_name ?? null,
                receivedBy: header.grnReceivedBy.map((id) => ({ id, name: manName.get(id) ?? id })),
                supervisorName: header.grnSupervisorId ? manName.get(header.grnSupervisorId) ?? null : null,
                billStatus, poRefs,
                transport: band ? { mode: band.mode ?? null, transporterId: band.transporterId ?? null, transporterName: band.transporterName ?? null,
                                    transporterGstin: band.transporterGstin ?? null, lrNo: band.lrNo ?? null, lrDate: band.lrDate ? String(band.lrDate).slice(0, 10) : null,
                                    distanceKm: band.distanceKm ?? null, remarks: band.remarks ?? null } : null },
      lines: lines.map((l) => ({ ...l, ...names.get(l.griUomId), poRefno: l.griSrcDocId ? poRef.get(l.griSrcDocId) ?? null : null,
        damageReasonName: l.griDamageReasonId ? reasonName.get(l.griDamageReasonId) ?? null : null,
        billed: billedBy.has(l.griId), billRefno: billedBy.get(l.griId) ?? null, check: checks.get(l.griLineNo) ?? null,
        allocs: allocs.filter((a) => a.piaLineId === l.griId) })),
      charges: charges.map((c) => ({ ...c, amount: c.amount.toFixed(2) })),
      totals: this.totalsOf(lines.map((l) => ({ factor: l.griToBaseFactor, challan: l.griChallanQty, received: l.griReceivedQty, damaged: l.griDamagedQty, free: l.griFreeQty, value: l.griValue })),
                            header.grnOffbillCharges ?? ZERO),
    });
  }

  async cancel(dto: GrnCancelDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const g = await tx.purGrn.findFirst({ where: { grnId: dto.grnId, grnAccYear: dto.accYear, grnIsDeleted: false } });
      if (!g) purNotFound(`GRN ${dto.grnId} not found`);
      if (g.grnStatus !== 'POSTED') purConflict(`${g.grnRefno} is ${g.grnStatus} — only a posted GRN is cancelled.`, PUR.NOT_POSTED, 'grnId');
      const [billed] = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
         WHERE pii.pii_src_doc_type = 'GRN' AND pii.pii_src_doc_id = ${dto.grnId}::uuid AND NOT pii.pii_is_deleted AND p.pi_status <> 'CANCELLED' AND NOT p.pi_is_deleted`;
      if (Number(billed.n) > 0) purConflict(`${g.grnRefno} is already billed — cancel the bill first.`, PUR.EDIT_LOCKED_PAID, 'grnId');
      const [paid] = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM accounts.acc_bill_balance WHERE abl_src_doc_type = ${DOC} AND abl_src_doc_id = ${dto.grnId}::uuid AND NOT abl_is_deleted
           AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <> 0`;
      if (Number(paid.n) > 0) purConflict(`${g.grnRefno}: the loadmen are already paid — undo that payment first.`, PUR.EDIT_LOCKED_PAID, 'grnId');
      await assertNoLiveReturns(tx, dto.grnId, g.grnRefno);
      await assertShortagesUntouched(tx, dto.grnId, g.grnRefno);
      await cancelShadowStock(tx, this.stockPosting, DOC, dto.grnId, dto.accYear, g.grnCompanyId, g.grnBranchId, this.rules(), actor, dto.reason);
      if (g.grnPostedVoucherId) await this.vouchers.reverseLegs(tx, g.grnPostedVoucherId, dto.accYear, `GRN ${g.grnRefno} cancelled: ${dto.reason}`, actor);
      await withdrawBillRows(tx, DOC, dto.grnId, actor);
      await tx.purShortage.updateMany({ where: { pshSrcDocType: DOC, pshSrcDocId: dto.grnId, pshIsDeleted: false }, data: { pshIsDeleted: true, pshModifiedBy: actor, pshModifiedOn: new Date() } });
      await tx.purGrn.update({ where: { grnId_grnAccYear: { grnId: dto.grnId, grnAccYear: dto.accYear } }, data: { grnStatus: 'CANCELLED', grnModifiedBy: actor, grnModifiedOn: new Date() } });
      await statusLog(tx, { companyId: g.grnCompanyId, branchId: g.grnBranchId, accYear: dto.accYear, docType: TxnStatusDocType.GRN, docId: dto.grnId, refno: g.grnRefno, event: TxnStatusEvent.CANCELLED, from: 'POSTED', to: 'CANCELLED', actor, remarks: dto.reason });
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(dto.grnId, dto.accYear);
  }
}

@ApiTags('Purchase — GRN')
@ApiBearerAuth()
@Controller('purchase/grns')
export class PurchaseGrnController {
  constructor(private readonly service: PurchaseGrnService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: GRN_MENU_ID, right, codePrefix: 'GRN', action });
  }
  @Post('save') @Version(API_VERSION) @ApiOperation({ summary: 'Save a GRN draft; header.post = true saves and posts (stock in, Dr Stock / Cr GRNI, coolie per loadman, challan short).' })
  async save(@Body() dto: SaveGrnDto) {
    await this.right(dto.header.grnId ? 'edit' : 'create', 'save a GRN');
    if (dto.header.post) await this.right('post', 'post a GRN');
    if (dto.header.post && dto.header.overrideWarnings) await this.right('override', 'post a GRN past its warnings');
    const data = await this.service.save(dto);
    return { success: true, message: `GRN ${data.header.grnRefno} ${dto.header.post ? 'posted' : 'saved as draft'}`, data };
  }
  @Post('validate') @Version(API_VERSION)
  @ApiOperation({ summary: 'The server\'s figures for a GRN being keyed — line value / off-bill share / excess, the charges, the six totals, the WARN / REFUSE strip (warnings[] / refusals[]: code, level, lineNo, field, message, needsRight) and lines[].check (chips, shelf life %, labels, serials). Writes nothing.' })
  async validate(@Body() dto: SaveGrnDto) {
    await this.right('view', 'check a GRN');
    return { success: true, message: 'GRN checked', data: await this.service.validate(dto) };
  }
  @Post('post') @Version(API_VERSION) @ApiOperation({ summary: 'Post a saved GRN draft. overrideWarnings (Override right on menu 196) posts past PUR_SHELF_LIFE in REFUSE mode; logged (WARN_OVERRIDE).' })
  async post(@Body() dto: GrnPostDto) {
    await this.right('post', 'post a GRN');
    if (dto.overrideWarnings) await this.right('override', 'post a GRN past its warnings');
    const data = await this.service.post(dto.grnId, dto.accYear, { override: !!dto.overrideWarnings, reason: dto.overrideReason ?? null });
    return { success: true, message: `GRN ${data.header.grnRefno} posted`, data };
  }
  @Get('get') @Version(API_VERSION) @ApiOperation({ summary: 'A GRN with its lines, allocation rows and bill status.' })
  async get(@Query() q: GrnRefDto) {
    await this.right('view', 'open a GRN');
    return { success: true, message: 'GRN fetched', data: await this.service.get(q.grnId, q.accYear) };
  }
  @Post('cancel') @Version(API_VERSION) @ApiOperation({ summary: 'Cancel a posted, un-billed GRN: stock out, voucher reversed, coolie rows withdrawn.' })
  async cancel(@Body() dto: GrnCancelDto) {
    await this.right('cancel', 'cancel a GRN');
    const data = await this.service.cancel(dto);
    return { success: true, message: `GRN ${data.header.grnRefno} cancelled`, data };
  }
}

@ApiTags('Purchase — Labels')
@ApiBearerAuth()
@Controller('purchase/labels')
export class PurchaseLabelsController {
  constructor(private readonly service: PurchaseGrnService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  @Get('from-doc') @Version(API_VERSION)
  @ApiOperation({ summary: 'ENT-21: the labels of a GRN or purchase bill — one row per saleable allocation row, copies = received + free (damaged get none).' })
  async fromDoc(@Query() q: LabelsFromDocDto) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: q.docType === 'GRN' ? GRN_MENU_ID : 24, right: 'view', codePrefix: 'LBL', action: 'print purchase labels' });
    return { success: true, message: 'Labels', data: await this.service.labels(q) };
  }
}
