import { Body, Controller, Get, Injectable, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { resolveRoleLedgers, roleLedgerKey } from 'src/modules/accountsModule/ledgerRole/ledger-map.helper';
import { purNotFound, purRefuse } from '../common/purchase.errors';
import { claimLockOrder, lockClaims } from '../common/purchase-claim-locks';
import { D, jsonSafe, ZERO } from '../common/purchase-doc.helpers';
import { PurchaseReturnService, type SettleResult } from '../return/purchase-return';
import { PurchaseShortageService, type ShortageClaimSettleResult } from '../shortage/purchase-shortage';

/**
 * Supplier dues (user 2026-10-29: claims + shortages on one page, its own menu under Purchase; the Return screen
 * keeps a shortcut that opens it filtered). purchase_claims_shortage_ui_mockup.png, plan §3.4 / §3.5 (DOC-07).
 *
 *  GET  /purchase/supplier-dues/open    A. claim rows (money expected: return claims AND shortages closed as a transporter /
 *                                       insurer claim, `source` RETURN / SHORTAGE) + B. shortage rows (goods expected), one call
 *  POST /purchase/supplier-dues/settle  settle one or several claim rows (returnItemId or shortageCloseId): CREDIT (credit note /
 *                                       adjust in the next bill) with "write off the rest" in the same call, SHORT_SETTLED, REJECTED;
 *                                       dryRun = the "What Settle writes" preview (voucher legs, nothing written).
 *  POST /purchase/supplier-dues/settle-undo  undo one settlement of either kind (a reversing voucher; nothing deleted).
 *
 * Settle = credit note or adjust ONLY (user 2026-10-29): cash / bank come through a Receipt — the answer says so.
 * Rights: the page's own menu 297 (Supplier Dues) — View reads (and the dryRun preview), Post settles, Cancel undoes;
 * refusals SDU_RIGHT_<RIGHT>. Shortage rows close through /purchase/shortages/close (menu 195).
 */
export const SUPPLIER_DUES_MENU_ID = 297;

export class SupplierDuesQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supplierId?: string;
  @ApiPropertyOptional({ description: 'true: also settled claims / closed shortages (history).' }) @IsOptional() @IsIn(['true', 'false']) all?: string;
}
export class DuesSettleRowDto {
  @ApiPropertyOptional({ description: 'A return claim row: pur_return_item.pri_id (claims[].returnItemId). Give this OR shortageCloseId.' })
  @ValidateIf((o: DuesSettleRowDto) => !o.shortageCloseId) @IsUUID() returnItemId?: string;
  @ApiPropertyOptional({ description: 'A shortage claim: the CLAIM close row pur_shortage_close.psc_id (claims[].shortageCloseId, source SHORTAGE).' })
  @IsOptional() @IsUUID() shortageCloseId?: string;
  @ApiProperty({ description: 'The row\'s year (the return row\'s, or the claim close row\'s).' }) @IsString() @MaxLength(9) accYear!: string;
  @ApiPropertyOptional({ description: 'CREDIT: what the party allowed on this row (default its whole open amount).' }) @IsOptional() @IsNumber() @Min(0) amount?: number;
}
export class DuesSettleDto {
  @ApiProperty({ type: [DuesSettleRowDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => DuesSettleRowDto) rows!: DuesSettleRowDto[];
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty({ enum: ['CREDIT', 'SHORT_SETTLED', 'REJECTED'] }) @IsIn(['CREDIT', 'SHORT_SETTLED', 'REJECTED']) action!: string;
  @ApiPropertyOptional({ enum: ['CN', 'ADJUST'], description: 'CREDIT: a credit note, or adjust in the next bill. Cash / bank come through a Receipt.' }) @IsOptional() @IsIn(['CN', 'ADJUST']) receivedAs?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) cnNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() cnDate?: string;
  @ApiPropertyOptional({ description: 'The settlement date (default today).' }) @IsOptional() @IsDateString() docDate?: string;
  @ApiPropertyOptional({ description: 'The settlement\'s own year (default the row\'s).' }) @IsOptional() @IsString() @MaxLength(9) settleAccYear?: string;
  @ApiPropertyOptional({ description: 'CREDIT: write off what the credit leaves open on each row (a SHORT_SETTLED row, same call).' }) @IsOptional() @IsBoolean() writeOffRest?: boolean;
  @ApiPropertyOptional({ description: 'Why the rest is written off (default "short-settled").' }) @IsOptional() @IsString() @MaxLength(250) writeOffReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) reason?: string;
  @ApiPropertyOptional({ description: 'true: check and work out the voucher legs ("What Settle writes"), write nothing.' }) @IsOptional() @IsBoolean() dryRun?: boolean;
}

export class DuesSettleUndoDto {
  @ApiProperty({ description: 'claims[].lastAction.settlementId (a return claim settlement or a shortage claim settlement).' }) @IsUUID() settlementId!: string;
  @ApiProperty({ description: 'claims[].lastAction.accYear.' }) @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
}

type Tx = Prisma.TransactionClient;
type Step = (SettleResult & { shortageCloseId?: undefined }) | (ShortageClaimSettleResult & { returnItemId?: undefined; lineNo?: undefined; gstReavailed?: undefined });

@Injectable()
export class PurchaseSupplierDuesService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: RequestContextService,
              private readonly returns: PurchaseReturnService, private readonly shortages: PurchaseShortageService) {}

  async open(q: SupplierDuesQueryDto, sections: { claims: boolean; shortages: boolean }) {
    const all = q.all === 'true';
    const ret = sections.claims ? (await this.returns.duesClaims({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId ?? null, all }))
      .map((c) => ({ source: 'RETURN', shortageCloseId: null, ...c })) : [];
    // shortages closed as a transporter / insurer claim: money expected, settled here like a return claim (user 2026-10-29)
    const shc = sections.shortages ? await this.shortages.duesClaims({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId ?? null, all }) : [];
    const claims = [...ret, ...shc] as Record<string, unknown>[];
    const shortages = sections.shortages ? (await this.shortages.open({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId, all: all ? 'true' : undefined })) as Record<string, unknown>[] : [];
    const sum = (rows: Record<string, unknown>[], k: string) => rows.reduce((s, r) => s.plus(D(r[k] as Prisma.Decimal.Value)), ZERO);
    const openClaims = claims.filter((c) => c.status === 'OPEN' || c.status === 'PART');
    const openShort = shortages.filter((s) => s.status !== 'CLOSED');
    return jsonSafe({
      claims, shortages,
      // the chip "3 OPEN" and the two strips
      totals: {
        openCount: openClaims.length + openShort.length,
        claims: { rows: openClaims.length, value: sum(openClaims, 'claimValue').toFixed(2), credited: sum(openClaims, 'credited').toFixed(2),
                  writtenOff: sum(openClaims, 'writtenOff').toFixed(2), open: sum(openClaims, 'open').toFixed(2) },
        // GST held = parked as pending only; an old REPLACE (before 2026-10-29) still has its GST claimed, so it holds none
        shortages: { rows: openShort.length, openQtyBase: sum(openShort, 'openQty').toString(), openValue: sum(openShort, 'openValue').toFixed(2),
                     gstHeld: sum(openShort.filter((s) => s.gstPending === true), 'openGst').toFixed(2) },
      },
      sections,
      cashNote: 'Cash or bank from the party comes through a Receipt against it — Settle records a credit note or an adjustment only.',
    });
  }

  /** One or several claim rows in ONE transaction; dryRun = the legs only. */
  async settle(dto: DuesSettleDto) {
    const actor = this.ctx.getUserId();
    if (!actor) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    if (dto.writeOffRest && dto.action !== 'CREDIT') purRefuse('"Write off the rest" goes with a credit only.', 'PUR_QTY_INVALID', 'writeOffRest');
    const run = async (tx: Tx) => {
      // every row's claim lock first, in one canonical order (sorted keys), so two settles that list the same
      // claims in opposite orders queue instead of deadlocking; the steps (and the response) keep the request order
      await lockClaims(tx, claimLockOrder(dto.rows));
      const out: Step[] = [];
      for (const r of dto.rows) {
        const common = { accYear: r.accYear, settleAccYear: dto.settleAccYear, deviceId: dto.deviceId, cnNo: dto.cnNo, cnDate: dto.cnDate, docDate: dto.docDate };
        const one = (action: string, extra: { amount?: number; receivedAs?: string; reason?: string }, opts: { dryRun: boolean; takenAlready?: Prisma.Decimal }): Promise<Step> =>
          r.shortageCloseId
            ? this.shortages.settleClaimIn(tx, { ...common, shortageCloseId: r.shortageCloseId, action, ...extra }, actor, opts)
            : this.returns.settleIn(tx, { ...common, returnItemId: r.returnItemId!, action, ...extra }, actor, opts);
        const first = await one(dto.action, { amount: dto.action === 'CREDIT' ? r.amount : undefined, receivedAs: dto.receivedAs, reason: dto.reason }, { dryRun: !!dto.dryRun });
        out.push(first);
        if (dto.writeOffRest && first.open.greaterThan(0)) {
          out.push(await one('SHORT_SETTLED', { reason: dto.writeOffReason ?? dto.reason ?? 'Short-settled — the rest written off' },
                             { dryRun: !!dto.dryRun, takenAlready: dto.dryRun ? first.amount : ZERO }));
        }
      }
      return out;
    };
    const steps = await this.prisma.$transaction(run, { timeout: 60000, maxWait: 10000 });
    const names = await this.legNames(steps);
    let credit = ZERO, off = ZERO, gst = ZERO;
    for (const s of steps) {
      const re = s.gstReavailed ?? ZERO;
      if (s.action === 'CREDIT') credit = credit.plus(s.amount); else off = off.plus(s.amount.minus(re));
      gst = gst.plus(re);
    }
    return jsonSafe({
      dryRun: !!dto.dryRun,
      steps: steps.map((s) => ({
        source: s.shortageCloseId ? 'SHORTAGE' : 'RETURN', returnItemId: s.returnItemId ?? null, shortageCloseId: s.shortageCloseId ?? null,
        refno: s.refno, lineNo: s.lineNo ?? null, action: s.action, receivedAs: s.receivedAs, amount: s.amount.toFixed(2),
        gstReavailed: (s.gstReavailed ?? ZERO).toFixed(2), openAfter: s.open.toFixed(2), settlementId: s.settlementId, accYear: s.accYear, voucherRefno: s.voucherRefno,
        legs: s.legs.map((g) => {
          const n = names.get(g.ledgerId ?? roleLedgerKey({ role: g.role!, taxId: g.taxId ?? null, supplyNature: (g.supplyNature as string | undefined) ?? null }));
          return { drCr: g.drCr, role: g.role ?? null, ledgerId: g.ledgerId ?? n?.id ?? null, ledgerName: n?.name ?? null, amount: Number(g.amount).toFixed(2), remarks: g.remarks ?? null };
        }),
      })),
      totals: { credited: credit.toFixed(2), writtenOff: off.toFixed(2), gstReavailed: gst.toFixed(2) },
      cashNote: 'Cash or bank from the party comes through a Receipt against it.',
    });
  }

  /** Undo one settlement: a return claim's (pur_claim_settlement) or a shortage claim's (its voucher). */
  async settleUndo(dto: DuesSettleUndoDto) {
    const actor = this.ctx.getUserId();
    if (!actor) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    const kind = await this.settlementKind(dto.settlementId, dto.accYear);
    if (kind === 'RETURN') {
      const r = await this.returns.settleUndo({ settlementId: dto.settlementId, accYear: dto.accYear, reason: dto.reason });
      return { source: 'RETURN', shortageCloseId: null, ...r };
    }
    const out = await this.prisma.$transaction((tx) => this.shortages.settleClaimUndoIn(tx, dto.settlementId, dto.accYear, dto.reason, actor), { timeout: 60000, maxWait: 10000 });
    return jsonSafe({ source: 'SHORTAGE', returnItemId: null, ...out! });
  }

  /** Which kind of settlement an id is (RETURN / SHORTAGE); refuses an unknown one. */
  async settlementKind(settlementId: string, accYear: string): Promise<'RETURN' | 'SHORTAGE'> {
    const [r] = await this.prisma.$queryRaw<{ k: string }[]>`
      SELECT CASE WHEN pcs_shortage_close_id IS NOT NULL THEN 'SHORTAGE' ELSE 'RETURN' END AS k
        FROM purchase.pur_claim_settlement WHERE pcs_id = ${settlementId}::uuid AND pcs_acc_year = ${accYear}::bpchar AND NOT pcs_is_deleted
       LIMIT 1`;
    if (!r) purNotFound(`Settlement ${settlementId} not found`);
    return r.k as 'RETURN' | 'SHORTAGE';
  }

  /** Ledger names for the legs: a party leg names its ledger; a role leg resolves through the ledger map (preview only). */
  private async legNames(steps: Step[]) {
    const out = new Map<string, { id: string; name: string }>();
    const ids = [...new Set(steps.flatMap((s) => s.legs.map((g) => g.ledgerId).filter((x): x is string => !!x)))];
    if (ids.length) {
      const rows = await this.prisma.$queryRaw<{ id: string; name: string }[]>`SELECT led_id AS id, led_name AS name FROM accounts.acc_ledger_master WHERE led_id = ANY(${ids}::uuid[])`;
      for (const r of rows) out.set(r.id, r);
    }
    const first = steps[0];
    const reqs = steps.flatMap((s) => s.legs.filter((g) => g.role && !g.ledgerId).map((g) => ({ role: g.role!, taxId: g.taxId ?? null, supplyNature: (g.supplyNature as string | undefined) ?? null })));
    if (reqs.length && first) {
      const got = await resolveRoleLedgers(this.prisma, reqs, { companyId: first.companyId, branchId: first.branchId, where: 'supplier dues preview' });
      for (const [k, v] of got) if (v) out.set(k, { id: v.ledgerId, name: v.ledgerName });
    }
    return out;
  }
}

@ApiTags('Purchase — Supplier dues')
@ApiBearerAuth()
@Controller('purchase/supplier-dues')
export class PurchaseSupplierDuesController {
  constructor(private readonly service: PurchaseSupplierDuesService, private readonly prisma: PrismaService, private readonly ctx: RequestContextService) {}
  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.ctx.getUserId(), menuId: SUPPLIER_DUES_MENU_ID, right, codePrefix: 'SDU', action });
  }

  @Get('open') @Version(API_VERSION)
  @ApiOperation({ summary: 'The Supplier dues page: claims (money expected — return claims, source RETURN, and shortages closed as a transporter / insurer claim, source SHORTAGE, keyed by shortageCloseId: value, credited, written off, open, status, age, party, reason, last action, source bill) and shortages (goods expected — source date, age, open qty / value / GST held, last close). View on menu 297.' })
  async open(@Query() q: SupplierDuesQueryDto) {
    await this.right('view', 'see supplier dues');
    return { success: true, message: 'Supplier dues fetched', data: await this.service.open(q, { claims: true, shortages: true }) };
  }

  @Post('settle') @Version(API_VERSION)
  @ApiOperation({ summary: 'Settle one or several claim rows in one call — return claims (rows[].returnItemId) and shortage claims on a transporter / insurer (rows[].shortageCloseId): CREDIT (CN / ADJUST, + writeOffRest), SHORT_SETTLED or REJECTED. Cash comes through a Receipt. dryRun = "What Settle writes" (voucher legs), nothing written. Post on menu 297 (View for dryRun).' })
  async settle(@Body() dto: DuesSettleDto) {
    if (dto.dryRun) await this.right('view', 'preview a claim settlement');
    else await this.right('post', 'settle a claim');
    const data = await this.service.settle(dto);
    return { success: true, message: dto.dryRun ? 'What Settle writes' : `${data.steps.length} settlement${data.steps.length === 1 ? '' : 's'} posted`, data };
  }

  @Post('settle-undo') @Version(API_VERSION)
  @ApiOperation({ summary: 'Undo one settlement (claims[].lastAction.settlementId) of a return claim or a shortage claim: a reversal row, a reversing voucher, the bill-wise credit withdrawn, the claim open again. Cancel on menu 297.' })
  async settleUndo(@Body() dto: DuesSettleUndoDto) {
    await this.right('cancel', 'undo a claim settlement');
    return { success: true, message: 'Settlement undone', data: await this.service.settleUndo(dto) };
  }
}
