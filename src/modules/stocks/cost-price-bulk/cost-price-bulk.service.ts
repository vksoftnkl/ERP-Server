import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  resolveActor,
  throwStockBadRequest,
  throwStockNotFound,
  throwStockUnprocessable,
  type StockErrorDetail,
} from 'src/common/utils/module-service.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import { assertMenuRight, type MenuRight } from '../../../common/posting/rights';
import { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import { PRICE_ORIGIN } from '../../Inventory/item-price-log/types/price-change-log.types';
import { resolveItemTaxRates, type ItemTaxRate } from '../../Inventory/utils/item-tax-rate.helper';
import { resolveBelowCostPolicy } from '../selling-price-bulk/below-cost-policy.helper';
import {
  isHqUserType,
  type BelowCostPolicy,
} from '../selling-price-bulk/types/selling-price-bulk.types';
import {
  CostPriceBulkGateway,
  type CostBulkFilter,
  type CostBulkLevelInfo,
  type CostBulkLockedRecord,
  type CostBulkUnitRecord,
} from './cost-price-bulk.gateway';
import {
  blockingNotes,
  countsOf,
  dec,
  isOverridden,
  leftOutReasonOf,
  leftOutReasonText,
  money,
  planRow,
  tickedReason,
  trackedAsOf,
  unitLink,
  type RowContext,
  type RowPlan,
  type StoredPriceRow,
} from './cost-price-bulk.rules';
import { ListCostPriceBulkQueryDto } from './dto/list-cost-price-bulk-query.dto';
import { SaveCostPriceBulkDto } from './dto/save-cost-price-bulk.dto';
import {
  COST_BULK,
  COST_BULK_ITEM_NOT_FOUND,
  COST_BULK_MENU_ID,
  COST_BULK_RIGHT_PREFIX,
  DEFAULT_COST_BULK_PAGE,
  LEFT_OUT_CODE,
  MAX_COST_BULK_ROWS,
  MAX_LEFT_OUT,
  type CostBulkLeftOut,
  type CostBulkListResult,
  type CostBulkNote,
  type CostBulkRights,
  type CostBulkRow,
  type CostBulkSaveResult,
  type CostBulkSavedRow,
  type CostBulkValidateResult,
  type LeftOutReason,
} from './types/cost-price-bulk.types';

/** The audit trail's table and screen — the ones menu 30 and the item card file under. */
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
/** Named in every audit row's notes. */
const AUDIT_SCREEN_NAME = 'Cost Price – Bulk Change';

/** A save of 1,000 rows logs and audits each; the default 5 s would cut it off. */
const TX = { timeout: 120_000, maxWait: 10_000 } as const;
const READ_TX = { timeout: 60_000, maxWait: 10_000 } as const;

const num = (value: Prisma.Decimal | null | undefined): number => (value ? value.toNumber() : 0);
const ZERO = new Prisma.Decimal(0);

/** `YYYY-MM-DD` as the UTC midnight resolveItemTaxRates reads its day from. */
function dayDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * Cost Price – Bulk Change, menu 298 (plan 2026-11-05). A wholesale shop types
 * the new cost; the CLIENT reprices each unit by its own rule and sends the
 * prices; this service checks and writes them — today's headline row of each
 * unit, IN PLACE, through PriceMasterWriter (Price Change Log source
 * BULK_COST_CHANGE, one change set per save), one audit row per written row
 * under "Item Price Master", all in one transaction. Never stock, never
 * item_qty_price, never a new dated row.
 */
@Injectable()
export class CostPriceBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContext: RequestContextService,
    private readonly appSettingValueService: AppSettingValueService,
    private readonly gateway: CostPriceBulkGateway,
    private readonly writer: PriceMasterWriter,
  ) {}

  // ── GET /stock/cost-bulk ───────────────────────────────────────────────────

  async list(query: ListCostPriceBulkQueryDto): Promise<CostBulkListResult> {
    const rights = await this.assertRight('view', 'open Cost Price – Bulk Change');
    const policy = await this.belowCostPolicy(query.companyId, query.branchId);
    const limit = query.limit ?? DEFAULT_COST_BULK_PAGE;
    const page = query.page ?? 1;
    const offset = (page - 1) * limit;
    const filter: CostBulkFilter = {
      companyId: query.companyId,
      branchId: query.branchId,
      groupId: query.groupId,
      itemCategoryId: query.itemCategoryId,
      brandId: query.brandId,
      sectionId: query.sectionId,
      supplierId: query.supplierId,
      profitType: query.profitType,
      priceListOnly: query.priceListOnly,
      itemId: query.itemId,
    };

    return this.prisma.$transaction(async (tx) => {
      // `$x IS NULL OR …` filters: a generic plan after five runs is seconds, not ms.
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      const today = await this.gateway.today(tx);
      if (query.itemId) {
        await this.assertItemMayLoad(tx, query.companyId, query.branchId, query.itemId);
      }
      const grid = await this.gateway.listGrid(tx, filter, { limit, offset });
      const left =
        page === 1
          ? await this.gateway.listLeftOut(tx, filter, MAX_LEFT_OUT)
          : {
              rows: [],
              total: 0,
              counts: { NOT_PLAIN_STOCK: 0, OLD_BATCH_TICK: 0, NO_PRICE_ROW: 0, INACTIVE: 0 },
            };
      if (query.itemId && grid.total === 0 && left.counts.NO_PRICE_ROW > 0) {
        // The blank-row add of an item none of whose units is priced here.
        const unit = left.rows.find((row) => row.reason === 'NO_PRICE_ROW');
        this.refuseItem(
          COST_BULK.NO_PRICE_ROW,
          'NO_PRICE_ROW',
          `${[unit?.itemCode, unit?.itemName].filter(Boolean).join(' ')} has no price in force today at this branch. Set its prices on the item card first.`,
          trackedAsOf(unit?.presetName),
        );
      }
      const taxes = await resolveItemTaxRates(
        tx,
        grid.rows.map((row) => row.itemId),
        dayDate(today),
      );
      const levels = await this.gateway.levels(tx);
      return {
        items: grid.rows.map((row, index) =>
          this.toRow(row, offset + index + 1, taxes.get(row.itemId), levels),
        ),
        total: grid.total,
        totalItems: grid.totalItems,
        page,
        limit,
        leftOut: left.rows.map((row): CostBulkLeftOut => {
          const trackedAs = trackedAsOf(row.presetName);
          return {
            itemId: row.itemId,
            itemCode: row.itemCode,
            itemName: row.itemName,
            unitName: row.unitName,
            uomId: row.uomId,
            trackedAs,
            reasonCode: row.reason,
            reason: leftOutReasonText(row.reason, trackedAs),
          };
        }),
        leftOutTotal: left.total,
        leftOutCounts: left.counts,
        today,
        belowCostPolicy: policy,
        rights,
      };
    }, READ_TX);
  }

  /** The blank-row add: the item is there, active and Plain stock — else 404 / 422 with the reason. */
  private async assertItemMayLoad(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.gateway.findItem(tx, companyId, branchId, itemId);
    if (!item) {
      throwStockNotFound<StockErrorDetail>(
        'Item not found',
        'itemId',
        `No live item ${itemId} at this company and branch.`,
        COST_BULK_ITEM_NOT_FOUND,
      );
    }
    const reason = leftOutReasonOf({
      isActive: item.isActive,
      isBatchBased: item.isBatchBased,
      presetTracks: item.presetTracks,
    });
    if (!reason) {
      return;
    }
    const trackedAs = trackedAsOf(item.presetName);
    const name = [item.itemCode, item.itemName].filter(Boolean).join(' ');
    const message =
      reason === 'INACTIVE'
        ? `${name} is inactive.`
        : reason === 'OLD_BATCH_TICK'
          ? `${name} has the old "batch" tick on, so it is treated as batch. Cost Price – Bulk Change changes Plain stock items only. Change this item on Change Selling Price (menu 30).`
          : `${name} is tracked as ${trackedAs}. Cost Price – Bulk Change changes Plain stock items only. Change this item on Change Selling Price (menu 30).`;
    this.refuseItem(LEFT_OUT_CODE[reason], reason, message, trackedAs);
  }

  private refuseItem(
    code: string,
    reasonCode: LeftOutReason,
    message: string,
    trackedAs: string,
  ): never {
    throwStockUnprocessable<StockErrorDetail & { reasonCode: LeftOutReason; trackedAs: string }>(
      message,
      [{ field: 'itemId', code, message, reasonCode, trackedAs }],
    );
  }

  // ── POST /stock/cost-bulk/validate ─────────────────────────────────────────

  async validate(dto: SaveCostPriceBulkDto): Promise<CostBulkValidateResult> {
    const rights = await this.assertRight('edit', 'change costs in Cost Price – Bulk Change');
    this.assertShape(dto);
    const ctx = await this.contextOf(dto);
    const plans = await this.prisma.$transaction(
      (tx) => this.evaluate(tx, dto, ctx, false),
      READ_TX,
    );
    const overrides = dto.overrides ?? [];
    const refusals = plans.flatMap((plan) => plan.refusals);
    const warnings = plans.flatMap((plan) => plan.warnings);
    return {
      ok: blockingNotes(plans, overrides).length === 0,
      refusals,
      warnings,
      rights,
      counts: countsOf(plans),
      belowCostPolicy: ctx.belowCostPolicy,
    };
  }

  // ── POST /stock/cost-bulk ──────────────────────────────────────────────────

  async save(dto: SaveCostPriceBulkDto): Promise<CostBulkSaveResult> {
    const rights = await this.assertRight('edit', 'change costs in Cost Price – Bulk Change');
    this.assertShape(dto);
    const ctx = await this.contextOf(dto);
    const overrides = dto.overrides ?? [];

    return this.prisma.$transaction(async (tx) => {
      const plans = await this.evaluate(tx, dto, ctx, true);
      const blocking = blockingNotes(plans, overrides);
      const refusals = plans.flatMap((plan) => plan.refusals);
      const warnings = plans.flatMap((plan) => plan.warnings);
      if (blocking.length) {
        // Nothing has been written: the throw rolls back the locks only.
        throw new HttpException(
          {
            success: false,
            message: refusals.length
              ? 'These prices cannot be saved'
              : 'Tick the warnings to save these prices',
            errors: blocking.map((n) => ({
              field: n.field,
              code: n.code,
              message: n.message,
              line: n.line,
              level: n.level,
            })),
            refusals,
            warnings,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const written = plans.filter(
        (plan): plan is RowPlan & { write: NonNullable<RowPlan['write']> } =>
          plan.changed && plan.write !== null,
      );
      const inPlace = written.filter((plan) => !plan.companyCopy);
      const copies = written.filter((plan) => plan.companyCopy);
      // This company's own rows: rewritten in place.
      const { before, after } = await this.writer.rewritePriceRows(
        tx,
        PRICE_ORIGIN.BULK_COST_CHANGE,
        inPlace.map((plan) => ({ ...plan.write, reason: tickedReason(plan) })),
        ctx.actor,
      );
      // Rows shared by every company: a company-scoped copy each, the shared row untouched.
      const copied = await this.writer.insertCompanyPriceRows(
        tx,
        PRICE_ORIGIN.BULK_COST_CHANGE,
        dto.companyId,
        copies.map((plan) => ({ ...plan.write, reason: tickedReason(plan) })),
        ctx.actor,
      );
      const stored = ctx.stored;
      for (const plan of written) {
        const row = stored.get(plan.ipmId)!;
        const ticked = plan.warnings.filter((w) => isOverridden(w, overrides));
        const copy = plan.companyCopy ? copied.get(plan.ipmId) : undefined;
        await this.auditLogService.logEntityChange(
          {
            action: copy ? 'New' : 'update',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: copy ? copy.ipmId : plan.ipmId,
            entityId: row.itemId,
            displayName:
              `${[row.itemCode, row.itemName].filter(Boolean).join(' ')} · ${row.unitName ?? ''}`.trim(),
            originalRecord: copy ? null : (before.get(plan.ipmId) ?? null),
            modifiedRecord: copy ? copy.after : (after.get(plan.ipmId) ?? null),
            userId: ctx.actor,
            branchId: dto.branchId,
            notes:
              `${AUDIT_SCREEN_NAME} (menu ${COST_BULK_MENU_ID}), ${row.isChain ? 'all branches' : 'this branch'}` +
              (copy ? ` — this company's own row, copied from the shared row ${plan.ipmId}` : '') +
              ` — cost ${money(row.costPrice)} → ${money(plan.write.costPrice)}` +
              (ticked.length
                ? ` — warnings ticked: ${ticked.map((w) => `${w.code} (${w.message})`).join('; ')}`
                : ''),
          },
          tx,
        );
      }

      // The rows read back as the grid shows them, lineNo as sent.
      const itemIds = [...new Set([...stored.values()].map((row) => row.itemId))];
      const readBack = await this.gateway.listGrid(
        tx,
        { companyId: dto.companyId, branchId: dto.branchId, itemIds },
        { limit: 100_000, offset: 0 },
      );
      const today = await this.gateway.today(tx);
      const taxes = await resolveItemTaxRates(tx, itemIds, dayDate(today));
      const levels = await this.gateway.levels(tx);
      const byId = new Map(readBack.rows.map((row) => [row.ipmId, row]));
      const writtenIds = new Set(written.map((plan) => plan.ipmId));
      const rows: CostBulkSavedRow[] = [];
      for (const input of dto.rows) {
        // A shared row saved as a company copy reads back as the copy.
        const copy = copied.get(input.ipmId);
        const record = byId.get(copy ? copy.ipmId : input.ipmId);
        if (record) {
          rows.push({
            ...this.toRow(record, input.lineNo, taxes.get(record.itemId), levels),
            written: writtenIds.has(input.ipmId),
            sourceIpmId: input.ipmId,
            companyCopy: copy !== undefined,
          });
        }
      }
      const counts = countsOf(plans);
      return {
        saved: written.length,
        unchanged: counts.unchanged,
        rows,
        warnings,
        refusals: [],
        rights,
        counts,
        belowCostPolicy: ctx.belowCostPolicy,
      };
    }, TX);
  }

  buildSaveMessage(result: CostBulkSaveResult): string {
    const parts = [`${result.saved} price row${result.saved === 1 ? '' : 's'} saved`];
    if (result.unchanged) {
      parts.push(`${result.unchanged} unchanged`);
    }
    const slabItems = new Set(
      result.rows.filter((row) => row.hasQtySlabs).map((row) => row.itemId),
    );
    if (slabItems.size) {
      parts.push(
        `${slabItems.size} item${slabItems.size === 1 ? ' has' : 's have'} qty-wise prices, left as they are`,
      );
    }
    return `${parts.join(' · ')}.`;
  }

  // ── the shared checks ──────────────────────────────────────────────────────

  /** Plan §3 — the part limit, and one line number once (overrides match on it). */
  private assertShape(dto: SaveCostPriceBulkDto): void {
    if (dto.rows.length > MAX_COST_BULK_ROWS) {
      throwStockUnprocessable<StockErrorDetail>(
        `One save takes up to ${MAX_COST_BULK_ROWS} rows; this one has ${dto.rows.length}.`,
        [
          {
            field: 'rows',
            code: COST_BULK.TOO_MANY_ROWS,
            message: `One save takes up to ${MAX_COST_BULK_ROWS} rows (${dto.rows.length} sent). Save in parts of ${MAX_COST_BULK_ROWS}.`,
          },
        ],
      );
    }
    const seen = new Set<number>();
    for (const row of dto.rows) {
      if (seen.has(row.lineNo)) {
        throwStockBadRequest<StockErrorDetail>('Validation failed', [
          {
            field: 'rows',
            code: 'VALIDATION_ARRAY_UNIQUE',
            message: `Line ${row.lineNo} is sent twice; every row needs its own lineNo.`,
          },
        ]);
      }
      seen.add(row.lineNo);
    }
  }

  /** Who saves, with what policy — read once per request, outside the transaction. */
  private async contextOf(dto: SaveCostPriceBulkDto): Promise<
    Omit<RowContext, 'taxPerc' | 'levelNames' | 'levelActive'> & {
      stored: Map<string, CostBulkLockedRecord>;
    }
  > {
    return {
      isHq: isHqUserType(this.requestContext.getUserType()),
      belowCostPolicy: await this.belowCostPolicy(dto.companyId, dto.branchId),
      actor: resolveActor(undefined, this.requestContext.getUserId()),
      stored: new Map(),
    };
  }

  /**
   * Every row through planRow against the row as it stands — locked first on
   * the save (`lock`), only read on validate. Fills `ctx.stored` for the audit.
   */
  private async evaluate(
    tx: Prisma.TransactionClient,
    dto: SaveCostPriceBulkDto,
    ctx: Awaited<ReturnType<CostPriceBulkService['contextOf']>>,
    lock: boolean,
  ): Promise<RowPlan[]> {
    const stored = await this.gateway.readRowsForSave(
      tx,
      dto.companyId,
      dto.branchId,
      dto.rows.map((row) => row.ipmId),
      lock,
    );
    ctx.stored = stored;
    const today = await this.gateway.today(tx);
    const taxes = await resolveItemTaxRates(
      tx,
      [...new Set([...stored.values()].map((row) => row.itemId))],
      dayDate(today),
    );
    const levels = await this.gateway.levels(tx);
    const levelNames = levels.map((level) => level.name) as [string, string, string, string];
    const levelActive = levels.map((level) => level.active) as [boolean, boolean, boolean, boolean];
    return dto.rows.map((row, index) => {
      const record = stored.get(row.ipmId) ?? null;
      return planRow(
        {
          index,
          lineNo: row.lineNo,
          ipmId: row.ipmId,
          rowToken: row.rowToken,
          costPrice: dec(row.costPrice),
          mrp: row.mrp === undefined || row.mrp === null ? null : dec(row.mrp),
          minPrice: row.minPrice === undefined || row.minPrice === null ? null : dec(row.minPrice),
          profitType: row.profitType ?? null,
          levels: row.levels?.map((level) => ({ level: level.level, price: dec(level.price) })),
        },
        record ? toStored(record) : null,
        {
          taxPerc: dec(record ? (taxes.get(record.itemId)?.taxPerc ?? 0) : 0),
          isHq: ctx.isHq,
          belowCostPolicy: ctx.belowCostPolicy,
          levelNames,
          levelActive,
          actor: ctx.actor,
        },
      );
    });
  }

  /** Menu 298's VIEW (the grid) or EDIT (validate, save; ticking a warning too). */
  private async assertRight(right: MenuRight, action: string): Promise<CostBulkRights> {
    const rights = await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: COST_BULK_MENU_ID,
      right,
      codePrefix: COST_BULK_RIGHT_PREFIX,
      action,
    });
    return { view: rights.view, edit: rights.edit, override: rights.edit };
  }

  /** inventory.below_cost_price through the resolver (restrict / warning / allow), as menu 30 reads it. */
  private async belowCostPolicy(companyId: string, branchId: string): Promise<BelowCostPolicy> {
    const effective = await this.appSettingValueService.resolveEffective({
      companyId,
      branchId,
      deviceId: this.requestContext.getDeviceId() ?? undefined,
      userId: this.requestContext.getUserId() ?? undefined,
    });
    return resolveBelowCostPolicy(effective);
  }

  /** One grid row from the gateway's record (it has a price row: the grid statement says so). */
  private toRow(
    record: CostBulkUnitRecord,
    lineNo: number,
    tax: ItemTaxRate | undefined,
    levels: readonly CostBulkLevelInfo[],
  ): CostBulkRow {
    const link = unitLink({
      parentToBase: record.parentToBase,
      toBase: record.toBase,
      unitFactor: record.unitFactor,
    });
    const level = (
      n: 1 | 2 | 3 | 4,
      price: Prisma.Decimal | null,
      wot: Prisma.Decimal | null,
      markup: Prisma.Decimal | null,
    ) => ({
      level: n,
      price: num(price),
      priceWot: num(wot),
      markupPerc: num(markup),
      active: levels[n - 1]?.active ?? false,
    });
    return {
      lineNo,
      ipmId: record.ipmId!,
      itemId: record.itemId,
      itemCode: record.itemCode,
      itemName: record.itemName,
      barcode: record.barcode,
      uomId: record.uomId,
      unitName: record.unitName,
      unitSlno: record.unitSlno,
      parentUomId: record.parentUomId,
      parentUnitName: record.parentUnitName,
      unitsPerParent: link.unitsPerParent ? link.unitsPerParent.toNumber() : null,
      toBaseFactor: record.toBase.toNumber(),
      unitFactor: record.unitFactor.toNumber(),
      factorsAgree: link.factorsAgree,
      priceScope: record.priceBranchId ? 'BRANCH' : 'CHAIN',
      companyShared: record.companyShared,
      profitType: record.profitType ?? 'By User',
      roundOff: num(record.roundOff),
      taxPerc: tax?.taxPerc ?? 0,
      costPrice: num(record.costPrice),
      costWot: num(record.costWot),
      mrp: num(record.maxPrice),
      minPrice: num(record.minPrice),
      levels: [
        level(1, record.priceA, record.wotA, record.markupA),
        level(2, record.priceB, record.wotB, record.markupB),
        level(3, record.priceC, record.wotC, record.markupC),
        level(4, record.priceD, record.wotD, record.markupD),
      ],
      scheduledFrom: record.scheduledFrom,
      hasQtySlabs: record.hasQtySlabs,
      updatedOn: record.updatedOn,
      rowToken: record.rowToken ?? '',
    };
  }
}

/** The locked record as planRow reads it. */
function toStored(record: CostBulkLockedRecord): StoredPriceRow {
  return {
    ipmId: record.ipmId,
    itemId: record.itemId,
    itemCode: record.itemCode,
    itemName: record.itemName,
    unitName: record.unitName,
    usable: record.usable,
    current: record.current,
    eligibility: {
      isActive: record.itemIsActive,
      isBatchBased: record.itemIsBatchBased,
      presetTracks: record.presetTracks,
    },
    isChain: record.isChain,
    companyShared: record.companyShared,
    rowToken: record.rowToken,
    costPrice: record.costPrice ?? ZERO,
    maxPrice: record.maxPrice ?? ZERO,
    minPrice: record.minPrice ?? ZERO,
    profitType: record.profitType,
    prices: [
      record.priceA ?? ZERO,
      record.priceB ?? ZERO,
      record.priceC ?? ZERO,
      record.priceD ?? ZERO,
    ],
  };
}
