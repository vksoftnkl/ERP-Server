import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import {
  resolveActor,
  throwStockBadRequest,
  throwStockConflict,
  throwStockForbidden,
  throwStockNotFound,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import { bucketKeyFor } from '../stock-voucher/stock-voucher-posting.helper';
import { resolveItemTaxRates } from '../../Inventory/utils/item-tax-rate.helper';
import {
  DEFAULT_PRICE_GRID_LIMIT,
  MAX_PRICE_GRID_LIMIT,
  ListSellingPriceQueryDto,
} from './dto/list-selling-price-query.dto';
import { PriceBucketsQueryDto } from './dto/price-buckets-query.dto';
import { PriceScheduleQueryDto } from './dto/price-schedule-query.dto';
import { SaveSellingPriceBulkDto, SaveSellingPriceRowDto } from './dto/save-selling-price-bulk.dto';
import { resolveBelowCostAction, resolveBelowCostPolicy } from './below-cost-policy.helper';
import { exclusiveOfTax, recomputeLevel } from './selling-price-math.helper';
import { resolveTargetScope, type ScopeResolution } from './selling-price-scope.helper';
import {
  PriceBucketGateway,
  type BucketPriceCandidate,
  type PriceGridRecord,
  type RowCost,
} from './price-bucket.gateway';
import {
  CONFIRMABLE_VERDICTS,
  PRICE_LEVELS,
  isHqUserType,
  type BelowCostPolicy,
  type ItemTaxRate,
  type PagedResult,
  type PriceLevel,
  type PriceScope,
  type PriceVerdict,
  type SellingPriceProblem,
  type SellingPriceRow,
  type SellingPriceSaveResult,
  type SellingPriceSavedRow,
  type SellingPriceScheduleCancelResult,
  type SellingPriceScheduleRow,
  type StockErrorDetail,
} from './types/selling-price-bulk.types';
import { StockErrorCode } from '../types/stock-error-codes';
import { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import {
  PRICE_MENU_ID,
  PRICE_ORIGIN,
  type PriceWriteOrigin,
} from '../../Inventory/item-price-log/types/price-change-log.types';
import { assertMenuRight } from '../../../common/posting/rights';

/** Notes 119 — the code each Q26 verdict is refused with. */
const PRICE_VERDICT_CODES: Readonly<Record<PriceVerdict, StockErrorCode>> = {
  ABOVE_MRP: StockErrorCode.PRICE_ABOVE_MRP,
  BELOW_MIN: StockErrorCode.PRICE_BELOW_MIN,
  BELOW_COST: StockErrorCode.PRICE_BELOW_COST,
};

/** The audit trail's table and screen — the ones ItemsPriceMasterService files under. */
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
/** Named in each audit row's notes, so the trail says which screen made the change. */
const AUDIT_SCREEN_NAME = 'Change Selling Price';

/** What one S1 → S2/S3 did: the row written, and the row as it stood before an update. */
export interface AppliedBucketPrice {
  ipmId: string;
  /** to_jsonb of the row before an S2; null after an S3 or a split. */
  before: Prisma.JsonObject | null;
  lineNo: number;
  itemName: string;
  /**
   * Notes 140 A — a split's old row, which now ends the day before the new
   * one starts, with its to_jsonb from before the split.
   */
  closed?: { ipmId: string; before: Prisma.JsonObject | null };
}

/** `YYYY-MM-DD` as the screen says it: `DD-MM-YYYY`. */
function displayDay(day: string): string {
  return day.split('-').reverse().join('-');
}

/** A `YYYY-MM-DD` as the UTC midnight resolveItemTaxRates reads its day from. */
function dayDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * Change Selling Price (bulk), menu 30.
 *
 * ONE PRICE TABLE (plan-nestjs-one-price-table.md §5). Every row this screen
 * shows or saves is an `inventory.item_price_master` row: a bucket row for
 * "stock at THIS MRP", or the headline (both bucket columns NULL). There is no
 * second table and therefore no fan-out — a row with neither dimension is
 * S1–S3 at key (-1, -1), like any other.
 *
 * This service is a TRANSACTION BOUNDARY and an ERROR TRANSLATOR around the
 * statements in PriceBucketGateway. What IS owned here, and what the client
 * must never duplicate:
 *   §5.5  which row an edit targets — see selling-price-scope.helper.ts
 *   §0.3  whether a below-cost price is allowed — see below-cost-policy.helper.ts
 *   §2    which dimensions a row's bucket has — `bucketKeyFor`, the rule the
 *         lot uses, applied to whatever MRP / sale price the grid echoed back
 */
@Injectable()
export class SellingPriceBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContext: RequestContextService,
    private readonly appSettingValueService: AppSettingValueService,
    private readonly gateway: PriceBucketGateway,
    /** Notes 144 — every price write goes through it, and is logged by it. */
    private readonly writer: PriceMasterWriter,
  ) {}

  /** §3 — Q25, paged. */
  async listPrices(queryDto: ListSellingPriceQueryDto): Promise<PagedResult<SellingPriceRow>> {
    const limit = Math.min(queryDto.limit ?? DEFAULT_PRICE_GRID_LIMIT, MAX_PRICE_GRID_LIMIT);
    const offset = Math.max(queryDto.offset ?? 0, 0);
    const page = await this.gateway.listPrices({
      companyId: queryDto.companyId,
      branchId: queryDto.branchId,
      itemGroupId: queryDto.itemGroupId,
      itemBrandId: queryDto.itemBrandId,
      itemSectionId: queryDto.itemSectionId,
      supplierId: queryDto.supplierId,
      itemId: queryDto.itemId,
      search: queryDto.search,
      itemCategoryId: queryDto.itemCategoryId,
      trackPresetId: queryDto.trackPresetId,
      taxId: queryDto.taxId,
      activeOnly: queryDto.activeOnly ?? true,
      limit,
      offset,
    });
    return { items: await this.toGridRows(page.items, offset), meta: page.meta };
  }

  /**
   * §4 — Q24, F12: every live price row this branch can see, plus every stock
   * bucket at the branch with no row of its own (notes 74), headline first.
   */
  async listBuckets(itemId: string, queryDto: PriceBucketsQueryDto): Promise<SellingPriceRow[]> {
    const records = await this.gateway.listBuckets(itemId, queryDto.companyId, queryDto.branchId);
    return this.toGridRows(records, 0);
  }

  /** §5 — one POST, one transaction, one commit. */
  async saveBulk(dto: SaveSellingPriceBulkDto): Promise<SellingPriceSaveResult> {
    // BEFORE anything reads or writes: the right to change prices at all, then
    // the scope. A downgraded scope would be a save that silently did something
    // other than what the header radio said.
    await this.assertCanEditPrices();
    this.assertScopeAllowed(dto.scope);
    // The quick rate popup names the screen it was opened from (§3.3).
    const via = dto.originMenuId ? await this.describeOriginMenu(dto.originMenuId) : null;

    const confirmed = dto.confirmed === true;
    const policy = await this.resolveBelowCostPolicy(dto);
    const actor = resolveActor(dto.userId, this.requestContext.getUserId());

    return this.prisma.$transaction(async (tx) => {
      // Notes 140 A — undefined for a save that starts today, which then runs
      // exactly as it always has; the day itself for a scheduled one, whose
      // tax, policy, minimum and target row are all read as of that day.
      const { from, scheduledFrom } = await this.resolveStartDay(tx, dto.effectiveFrom);
      const itemIds = dto.rows.map((row) => row.itemId);
      const taxRates = scheduledFrom
        ? await this.resolveItemTaxRates(tx, itemIds, dayDate(scheduledFrom))
        : await this.resolveItemTaxRates(tx, itemIds);
      const costs = await this.gateway.loadRowCosts(
        tx,
        dto.rows.map((row) => ({
          itemId: row.itemId,
          uomId: row.uomId,
          mrp: row.mrp ?? null,
          salePrice: row.salePrice ?? null,
        })),
        dto.companyId,
        dto.branchId,
        scheduledFrom,
      );
      this.assertUnitsBelong(dto.rows, costs);

      const candidates = dto.rows.map((row, index) =>
        this.toCandidate(row, index, dto.companyId, actor, taxRates, costs[index]),
      );
      const resolutions = dto.rows.map((row) =>
        resolveTargetScope(dto.scope, this.rowScopeOf(row), dto.branchId),
      );
      this.assertOneRowPerBucket(candidates, resolutions);

      // ── Step 1 — Q26. §5.2 ─────────────────────────────────────────────────
      const problems = this.gateway.validateRows(
        candidates,
        costs.map((cost) => cost.minPrice),
      );

      const blocking = problems.filter(
        (problem) => !CONFIRMABLE_VERDICTS.includes(problem.verdict),
      );
      if (blocking.length) {
        // Above MRP and below min abort ALWAYS — `confirmed` never reaches
        // here. `ck_ipm_not_above_mrp` would refuse the first anyway; the
        // second has NO constraint behind it, so this is its only enforcement.
        this.throwProblems(blocking, 'These prices cannot be saved');
      }

      const belowCost = problems.filter((problem) => problem.verdict === 'BELOW_COST');
      if (belowCost.length) {
        const action = resolveBelowCostAction(policy, confirmed);
        if (action === 'ABORT') {
          this.throwProblems(
            belowCost,
            'Prices below cost are not allowed (inventory.below_cost_price = restrict)',
          );
        }
        if (action === 'CONFIRM') {
          // 200, not an error: nothing is wrong yet, the user is being asked.
          // Nothing has been written, so returning out of the transaction
          // commits an empty unit of work.
          return {
            saved: 0,
            effectiveFrom: from,
            rows: [],
            masterRowsSaved: 0,
            noStock: [],
            needsConfirm: true,
            problems: belowCost,
            belowCostPolicy: policy,
          };
        }
      }

      // ── Steps 2–4 — write, report, commit. §5.4 ───────────────────────────
      const applied: AppliedBucketPrice[] = [];
      for (let index = 0; index < candidates.length; index += 1) {
        // Notes 144 — a price saved below cost on the user's confirmation says
        // so on its log row, as it does on its audit row.
        const confirmedHere = confirmed
          ? belowCost.filter((problem) => problem.lineNo === candidates[index].lineNo)
          : [];
        const reason = [
          confirmedHere.length
            ? `Confirmed below cost: ${confirmedHere.map((p) => p.message).join('; ')}`
            : null,
          via,
        ]
          .filter(Boolean)
          .join(' · ');
        applied.push(
          await this.applyBucketPrice(
            tx,
            candidates[index],
            resolutions[index],
            scheduledFrom,
            reason
              ? { ...PRICE_ORIGIN.CHANGE_SELLING_PRICE, reason }
              : PRICE_ORIGIN.CHANGE_SELLING_PRICE,
          ),
        );
      }
      const ipmIds = applied.map((row) => row.ipmId);
      // Notes 147 B — what each row's cost reads as now, by the grid's rule,
      // so the popup shows it without a reload.
      const shown = await this.gateway.loadRowCosts(
        tx,
        dto.rows.map((row) => ({
          itemId: row.itemId,
          uomId: row.uomId,
          mrp: row.mrp ?? null,
          salePrice: row.salePrice ?? null,
        })),
        dto.companyId,
        dto.branchId,
        scheduledFrom,
      );

      const noStock = await this.gateway.listNoStock(tx, ipmIds, dto.companyId, dto.branchId);

      const after = await this.auditWrites(tx, dto, applied, {
        actor,
        confirmedBelowCost: confirmed ? belowCost : [],
        scheduledFrom,
      });

      return {
        saved: ipmIds.length,
        effectiveFrom: from,
        rows: applied.map((row, index) =>
          this.toSavedRow(row, after.get(row.ipmId), scheduledFrom, shown[index]),
        ),
        masterRowsSaved: 0,
        noStock,
        needsConfirm: false,
        problems,
        belowCostPolicy: policy,
      };
    });
  }

  /**
   * Purchase B3 / D16 — a posted bill's selling prices, written in THE BILL'S
   * transaction (purchase.allow_price_update on, purchase.price_update =
   * UPDATE_PRICES; the caller decides that). Per row, this branch's price row
   * for the bill line's unit and MRP bucket, by the same S1 → S2/S3 as the
   * screen (applyBucketPrice), logged with source PURCHASE.
   *
   * D16: a row someone changed LATER than the bill in business time (the
   * price log's changed_on against the bill's time) is KEPT — the bill keeps
   * its prices as history. A row the screen would refuse (above MRP, below
   * the minimum) or that would go below cost is not written either: a bill is
   * never stopped by its prices. Neither needs the price-change right: the
   * company opted into purchase writing prices.
   */
  async applyPurchasePrices(
    tx: Prisma.TransactionClient,
    args: {
      companyId: string;
      branchId: string;
      actor: string;
      billRef: string;
      businessTime: Date;
      rows: { key: string; itemId: string; uomId: string; mrp: number | null; levels: { level: number; price: number }[] }[];
    },
  ): Promise<Map<string, { result: 'UPDATED' | 'KEPT_NEWER' | 'NONE'; note: string | null }>> {
    const out = new Map<string, { result: 'UPDATED' | 'KEPT_NEWER' | 'NONE'; note: string | null }>();
    const live = args.rows.filter((r) => r.levels.some((l) => l.price > 0));
    for (const r of args.rows) if (!live.includes(r)) out.set(r.key, { result: 'NONE', note: null });
    if (!live.length) return out;
    // D16 — a logged change of the row newer than the bill, in business time
    const newer = await tx.$queryRaw<{ item_id: string; unit_id: string; at: Date; who: string | null; source: string }[]>`
      SELECT DISTINCT ON (l.ipcl_item_id, l.ipcl_unit_id) l.ipcl_item_id AS item_id, l.ipcl_unit_id AS unit_id, l.ipcl_changed_on AS at,
             l.ipcl_user_name AS who, l.ipcl_source AS source
        FROM inventory.item_price_change_log l
       WHERE l.ipcl_company_id = ${args.companyId}::uuid
         AND (l.ipcl_branch_id IS NULL OR l.ipcl_branch_id = ${args.branchId}::uuid)
         AND l.ipcl_price_table = 'IPM'
         AND l.ipcl_item_id = ANY(${live.map((r) => r.itemId)}::uuid[])
         AND l.ipcl_changed_on > ${args.businessTime}
       ORDER BY l.ipcl_item_id, l.ipcl_unit_id, l.ipcl_changed_on DESC`;
    const newerOf = new Map(newer.map((n) => [`${n.item_id}|${n.unit_id}`, n]));
    const writable = live.filter((r) => {
      const n = newerOf.get(`${r.itemId}|${r.uomId}`);
      if (!n) return true;
      // shown as the screens show times: dd-MM-yyyy hh:mm AM/PM, India time
      const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
        .format(n.at).replace(/\//g, '-').replace(',', '').toUpperCase();
      out.set(r.key, { result: 'KEPT_NEWER', note: `Price not updated — changed later on ${when} (${n.source}${n.who ? `, ${n.who}` : ''}); the bill keeps its own price as history.` });
      return false;
    });
    if (!writable.length) return out;
    const rows = writable.map((r, i) => ({
      lineNo: i + 1, itemId: r.itemId, uomId: r.uomId, mrp: r.mrp, salePrice: null,
      levels: r.levels.filter((l) => l.price > 0).map((l) => ({ level: l.level, price: l.price })),
    })) as unknown as SaveSellingPriceRowDto[];
    const taxRates = await this.resolveItemTaxRates(tx, rows.map((r) => r.itemId));
    const costs = await this.gateway.loadRowCosts(
      tx, rows.map((r) => ({ itemId: r.itemId, uomId: r.uomId, mrp: r.mrp ?? null, salePrice: null })), args.companyId, args.branchId, undefined,
    );
    const candidates = rows.map((row, i) => this.toCandidate(row, i, args.companyId, args.actor, taxRates, costs[i]));
    const problems = this.gateway.validateRows(candidates, costs.map((c) => c.minPrice));
    const origin = { source: 'PURCHASE' as const, menuId: PRICE_MENU_ID.PURCHASE_ENTRY, reason: `Purchase ${args.billRef}` };
    for (let i = 0; i < candidates.length; i += 1) {
      const mine = problems.filter((p) => p.lineNo === candidates[i].lineNo);
      if (mine.length) {
        out.set(writable[i].key, { result: 'NONE', note: `Price not updated — ${mine.map((p) => p.message).join('; ')}` });
        continue;
      }
      await this.applyBucketPrice(tx, candidates[i], resolveTargetScope('BRANCH', null, args.branchId), undefined, origin);
      out.set(writable[i].key, { result: 'UPDATED', note: null });
    }
    return out;
  }

  /**
   * §5.4's toast, built from the same numbers the client can already see.
   *
   * NEVER a plain "Saved" when `noStock` is non-empty — legacy fault #2 was a
   * screen that reported a successful save of prices for stock that was not
   * there, and left the operator to discover it at the till.
   */
  buildSaveMessage(result: SellingPriceSaveResult): string {
    if (result.needsConfirm) {
      return `${result.problems.length} price(s) are below cost. Confirm to save them.`;
    }
    const parts: string[] = [];
    if (result.saved) {
      // Notes 140 A — a scheduled save says so: the shelf price has NOT moved yet.
      const scheduled = result.rows.length > 0 && result.rows.every((row) => row.scheduled);
      parts.push(
        `${result.saved} price${result.saved === 1 ? '' : 's'} ` +
          (scheduled ? `scheduled from ${displayDay(result.effectiveFrom)}` : 'saved'),
      );
    }
    if (!parts.length) {
      parts.push('Nothing to save');
    }
    if (result.noStock.length) {
      parts.push(
        `${result.noStock.length} ${
          result.noStock.length === 1 ? 'has' : 'have'
        } no stock on hand — the price applies when stock arrives`,
      );
    }
    return `${parts.join(' · ')}.`;
  }

  /**
   * §12 — S1 → S2/S3 for one row, and NOTHING screen-shaped.
   *
   * Extracted from the outset so form 6 (menu 31, Change Selling (Purchase))
   * imports it rather than copying the three statements. Everything it needs
   * arrives in its arguments: no DTO, no request context, no scope switch —
   * the resolution was already made by resolveTargetScope, which is the part
   * the two screens must agree on.
   *
   * Notes 140 A — `scheduledFrom` (`YYYY-MM-DD`, after today) makes the price
   * start that day instead of today. S1 then finds the row in force ON that
   * day; one that already starts that day (a second edit of one scheduled
   * change) is updated in place, any other is SPLIT — it ends the day before,
   * and a copy of it carrying the new prices runs from that day to its old
   * end. With no row that day S3 inserts one from it. Today's price is never
   * touched, and a bill dated before the day never sees the new one.
   */
  async applyBucketPrice(
    tx: Prisma.TransactionClient,
    candidate: BucketPriceCandidate,
    scope: ScopeResolution,
    scheduledFrom?: string,
    /** Notes 144 — the screen the price log files the writes under. */
    origin: PriceWriteOrigin = PRICE_ORIGIN.CHANGE_SELLING_PRICE,
  ): Promise<AppliedBucketPrice> {
    // S1 searches AT THE TARGET SCOPE, so a *This branch* save over a
    // CHAIN-sourced row finds nothing and falls through to S3 — that fall-through
    // IS the branch override of §5.5 row 2, and the chain row is never read for
    // update, so it cannot be edited by accident.
    const existing = await this.gateway.findBucketRowForUpdate(tx, candidate, scope, scheduledFrom);
    if (!existing) {
      return {
        ipmId: await this.writer.insertBucketPrice(tx, candidate, scope, scheduledFrom, origin),
        before: null,
        lineNo: candidate.lineNo,
        itemName: candidate.itemName,
      };
    }
    // The row as it stood, locked by S1 — the audit trail's "before".
    const [before] = (await this.gateway.snapshotRows(tx, [existing.ipmId])).values();
    if (!scheduledFrom || existing.effectiveFrom === scheduledFrom) {
      return {
        ipmId: await this.writer.updateBucketPrice(tx, existing.ipmId, candidate, origin),
        before: before ?? null,
        lineNo: candidate.lineNo,
        itemName: candidate.itemName,
      };
    }
    // Shortened first, so the two rows never overlap and ex_ipm_overlap needs
    // no deferral; the new row takes the end the old one had.
    await this.writer.closePriceRowBefore(
      tx,
      existing.ipmId,
      scheduledFrom,
      candidate.actor,
      origin,
    );
    return {
      ipmId: await this.writer.insertSplitPrice(
        tx,
        existing.ipmId,
        candidate,
        { from: scheduledFrom, to: existing.effectiveTo },
        origin,
      ),
      before: null,
      lineNo: candidate.lineNo,
      itemName: candidate.itemName,
      closed: { ipmId: existing.ipmId, before: before ?? null },
    };
  }

  /**
   * Notes 140 B — the scheduled prices this branch can see, each with the
   * prices it replaces. Levels are recomputed with the tax in force on the
   * day each row starts; stock and cost are today's, as on the grid.
   */
  async listSchedule(queryDto: PriceScheduleQueryDto): Promise<SellingPriceScheduleRow[]> {
    const records = await this.gateway.listScheduled(
      queryDto.companyId,
      queryDto.branchId,
      queryDto.itemId,
    );
    const taxByDay = new Map<string, Map<string, ItemTaxRate>>();
    for (const day of new Set(records.map((record) => record.effectiveFrom))) {
      taxByDay.set(
        day,
        await this.resolveItemTaxRates(
          this.prisma,
          records.filter((record) => record.effectiveFrom === day).map((record) => record.itemId),
          dayDate(day),
        ),
      );
    }
    return records.map((record, index) => {
      const tax = taxByDay.get(record.effectiveFrom)?.get(record.itemId);
      const row = this.toGridRow(record, index + 1, tax);
      return {
        ...row,
        effectiveFrom: record.effectiveFrom,
        effectiveTo: record.effectiveTo,
        previous: record.previous && {
          bucketId: record.previous.bucketId,
          priceScope: record.previous.priceScope,
          levels: PRICE_LEVELS.map((level) =>
            recomputeLevel(level, record.previous!.prices[level - 1], row.taxPerc, record.costRate),
          ),
        },
      };
    });
  }

  /**
   * Notes 140 B — take back a scheduled price before it starts: the row is
   * soft-deleted and the row before it (same key, ending the day before it
   * started) runs on to the cancelled row's end, as if the save had never
   * been made. A row already in force is refused — cancelling it would change
   * what bills already made were priced at. A chain row is an HQ action, as
   * saving one is. Both writes are audited like a price save.
   */
  async cancelSchedule(ipmId: string): Promise<SellingPriceScheduleCancelResult> {
    await this.assertCanEditPrices();
    const actor = resolveActor(undefined, this.requestContext.getUserId());
    return this.prisma.$transaction(async (tx) => {
      const row = await this.gateway.lockScheduledRow(tx, ipmId);
      if (!row || row.isDeleted) {
        throwStockNotFound<StockErrorDetail>(
          'Scheduled price not found',
          'ipmId',
          `No live price row ${ipmId}.`,
          StockErrorCode.PRICE_SCHEDULE_NOT_FOUND,
        );
      }
      if (row.started) {
        throwStockConflict<StockErrorDetail>('This price is already in force', [
          {
            field: 'ipmId',
            code: StockErrorCode.PRICE_SCHEDULE_STARTED,
            message:
              `The price started on ${displayDay(row.effectiveFrom)}; bills may already carry ` +
              'it. Save a new price instead.',
          },
        ]);
      }
      if (row.branchId === null) {
        this.assertScopeAllowed('CHAIN');
      }
      const previous = await this.gateway.findRowBeforeForUpdate(tx, ipmId);
      const ids = previous ? [ipmId, previous.ipmId] : [ipmId];
      const before = await this.gateway.snapshotRows(tx, ids);
      const origin: PriceWriteOrigin = {
        ...PRICE_ORIGIN.CHANGE_SELLING_PRICE,
        reason: `The price scheduled from ${displayDay(row.effectiveFrom)} was cancelled`,
      };
      await this.writer.softDeletePriceRow(tx, ipmId, actor, origin);
      if (previous) {
        await this.writer.extendPriceRowTo(tx, previous.ipmId, row.effectiveTo, actor, origin);
      }
      const after = await this.gateway.snapshotRows(tx, ids);
      const from = displayDay(row.effectiveFrom);
      const displayName = await this.describeRow(tx, after.get(ipmId) ?? null);
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_PRICE_TABLE_NAME,
          screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ipmId,
          displayName,
          originalRecord: before.get(ipmId) ?? null,
          modifiedRecord: after.get(ipmId) ?? null,
          userId: actor,
          notes: `${AUDIT_SCREEN_NAME} (menu 30) — the price scheduled from ${from} cancelled`,
        },
        tx,
      );
      if (previous) {
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: previous.ipmId,
            displayName,
            originalRecord: before.get(previous.ipmId) ?? null,
            modifiedRecord: after.get(previous.ipmId) ?? null,
            userId: actor,
            notes:
              `${AUDIT_SCREEN_NAME} (menu 30) — runs to ${displayDay(row.effectiveTo)} again: ` +
              `the price scheduled from ${from} was cancelled`,
          },
          tx,
        );
      }
      return {
        bucketId: ipmId,
        restoredId: previous?.ipmId ?? null,
        restoredTo: previous ? row.effectiveTo : null,
      };
    });
  }

  /**
   * One audit row per price row written, filed under the table's own "Item
   * Price Master" screen — so a price's history reads the same whichever
   * screen changed it: an update carries the row before and after, an insert
   * the row after.
   *
   * (notes 71 B1: the save used to log ONE summary row as an `update` with no
   * original record, which the audit service refuses — every valid save was a
   * 400 and nothing was written.)
   *
   * §5.3 — a confirmed below-cost save SAYS SO on each row it confirmed: a
   * confirmation nobody can find afterwards is a rule that was never enforced.
   */
  private async auditWrites(
    tx: Prisma.TransactionClient,
    dto: SaveSellingPriceBulkDto,
    applied: readonly AppliedBucketPrice[],
    context: {
      actor: string;
      confirmedBelowCost: readonly SellingPriceProblem[];
      scheduledFrom?: string;
    },
  ): Promise<Map<string, Prisma.JsonObject>> {
    const after = await this.gateway.snapshotRows(tx, [
      ...applied.map((row) => row.ipmId),
      ...applied.flatMap((row) => (row.closed ? [row.closed.ipmId] : [])),
    ]);
    const scopeLabel = dto.scope === 'CHAIN' ? 'all branches' : 'this branch';
    // Notes 140 A — a scheduled save names its day on every row it wrote.
    const fromLabel = context.scheduledFrom ? `, from ${displayDay(context.scheduledFrom)}` : '';
    for (const row of applied) {
      const modified = after.get(row.ipmId) ?? null;
      const confirmed = context.confirmedBelowCost.filter((p) => p.lineNo === row.lineNo);
      const displayName = `${row.itemName} · ${this.describeBucket(modified)}`;
      if (row.closed) {
        // The split's old row: its prices are untouched, its period now ends.
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: row.closed.ipmId,
            displayName,
            originalRecord: row.closed.before,
            modifiedRecord: after.get(row.closed.ipmId) ?? null,
            userId: context.actor,
            notes: `${AUDIT_SCREEN_NAME} (menu 30), ${scopeLabel} — ends the day before the new price${fromLabel}`,
          },
          tx,
        );
      }
      await this.auditLogService.logEntityChange(
        {
          action: row.before ? 'update' : 'New',
          tableName: ITEM_PRICE_TABLE_NAME,
          screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: row.ipmId,
          displayName,
          originalRecord: row.before,
          modifiedRecord: modified,
          userId: context.actor,
          notes:
            `${AUDIT_SCREEN_NAME} (menu 30), ${scopeLabel}${fromLabel}` +
            (confirmed.length
              ? ` — confirmed below cost: ${confirmed.map((p) => p.message).join('; ')}`
              : ''),
        },
        tx,
      );
    }
    return after;
  }

  /** The audit's name for a row's bucket, off its to_jsonb. */
  private describeBucket(row: Prisma.JsonObject | null): string {
    // to_jsonb renders numeric as a JSON number; anything else is no bucket.
    const amount = (value: unknown) => (typeof value === 'number' ? value : null);
    const mrp = amount(row?.ipm_bucket_mrp);
    const salePrice = amount(row?.ipm_bucket_sp);
    const bucket = [
      mrp !== null ? `MRP ${mrp}` : null,
      salePrice !== null ? `sale price ${salePrice}` : null,
    ].filter(Boolean);
    return bucket.length ? bucket.join(', ') : 'headline';
  }

  /** "Item · bucket" for a row known only by its to_jsonb (the cancel route). */
  private async describeRow(
    tx: Prisma.TransactionClient,
    row: Prisma.JsonObject | null,
  ): Promise<string> {
    const itemId = typeof row?.ipm_item_id === 'string' ? row.ipm_item_id : null;
    const item = itemId
      ? await tx.itemMaster.findUnique({ where: { itemId }, select: { itemNameEn: true } })
      : null;
    return `${item?.itemNameEn ?? itemId ?? ''} · ${this.describeBucket(row)}`;
  }

  /**
   * Notes 140 A — the day a save's prices start, checked against the
   * database's calendar: the body's `effectiveFrom`, else today. Before today
   * is refused — a past bill would change meaning — and so is more than a year
   * ahead, almost always a typo in the year. `scheduledFrom` is set only for a
   * day after today; a save from today keeps today's behaviour exactly.
   */
  private async resolveStartDay(
    tx: Prisma.TransactionClient,
    sent: string | undefined,
  ): Promise<{ from: string; scheduledFrom: string | undefined }> {
    const { today, latest } = await this.gateway.calendar(tx);
    const from = sent ?? today;
    if (from < today) {
      throwStockBadRequest<StockErrorDetail>('These prices cannot be saved', [
        {
          field: 'effectiveFrom',
          code: StockErrorCode.PRICE_FROM_IN_PAST,
          message:
            `${displayDay(from)} is in the past. A price can start today ` +
            `(${displayDay(today)}) or later; bills already made keep their prices.`,
        },
      ]);
    }
    if (from > latest) {
      throwStockBadRequest<StockErrorDetail>('These prices cannot be saved', [
        {
          field: 'effectiveFrom',
          code: StockErrorCode.PRICE_FROM_TOO_FAR,
          message: `${displayDay(from)} is more than a year ahead (latest ${displayDay(latest)}). Check the year.`,
        },
      ]);
    }
    return { from, scheduledFrom: from > today ? from : undefined };
  }

  /**
   * Notes 140 A — one written row, as the save answers it. Every row of a
   * scheduled save starts on its day (split, updated in place or inserted),
   * so `scheduled` is the save's; the period is the stored row's.
   */
  private toSavedRow(
    row: AppliedBucketPrice,
    stored: Prisma.JsonObject | undefined,
    scheduledFrom: string | undefined,
    shown: RowCost | undefined,
  ): SellingPriceSavedRow {
    // to_jsonb renders a date as 'YYYY-MM-DD'.
    const day = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10) : '');
    return {
      lineNo: row.lineNo,
      bucketId: row.ipmId,
      scheduled: scheduledFrom !== undefined,
      effectiveFrom: day(stored?.ipm_effective_from),
      effectiveTo: day(stored?.ipm_effective_to),
      costRate: shown?.costRate ?? 0,
      costWot: shown?.costWot ?? 0,
      costBasis: shown?.costBasis ?? null,
    };
  }

  /**
   * §5.5 — All branches is an HQ action, refused SERVER-SIDE.
   *
   * There is no roles guard in this repo (`src/common/guards` does not exist),
   * so the check is an explicit one here or it does not exist at all. A non-HQ
   * caller sending CHAIN gets 403 rather than a save quietly downgraded to
   * BRANCH: a downgrade looks like success and produces a different row.
   */
  private assertScopeAllowed(scope: PriceScope): void {
    if (scope !== 'CHAIN' || isHqUserType(this.requestContext.getUserType())) {
      return;
    }
    throwStockForbidden<StockErrorDetail>('These prices cannot be saved', [
      {
        field: 'scope',
        code: StockErrorCode.PRICE_CHAIN_HQ_ONLY,
        message:
          'Only an HQ user may save prices for all branches. Save at This branch scope instead.',
      },
    ]);
  }

  /**
   * Edit on menu 30, Change Selling Price — the right a price save needs
   * wherever it is made from: this screen, or the quick rate popup opened from
   * a bill line or the item list (plan 2026-10-23), which goes read-only
   * without it. Until then the route checked no right at all, so any login
   * could change any price. No user in the request has no rights.
   */
  private async assertCanEditPrices(): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: PRICE_MENU_ID.CHANGE_SELLING_PRICE,
      right: 'edit',
      codePrefix: 'STOCK_PRICE',
      action: 'change selling prices',
    });
  }

  /** "via Sales Entry (menu 12)" — the price log's note of the screen a popup save came from. */
  private async describeOriginMenu(menuId: number): Promise<string> {
    const [menu] = await this.prisma.$queryRaw<Array<{ menu_name: string }>>`
      SELECT menu_name FROM fixed.menu_master WHERE menu_id = ${menuId}::int`;
    const name = menu?.menu_name.replace(/&/g, '').trim();
    return name ? `via ${name} (menu ${menuId})` : `via menu ${menuId}`;
  }

  /** §0.3 — through the resolver, never by querying app_setting_value. */
  private async resolveBelowCostPolicy(dto: SaveSellingPriceBulkDto): Promise<BelowCostPolicy> {
    const effective = await this.appSettingValueService.resolveEffective({
      companyId: dto.companyId,
      branchId: dto.branchId,
      deviceId: this.requestContext.getDeviceId() ?? undefined,
      userId: dto.userId ?? this.requestContext.getUserId() ?? undefined,
    });
    return resolveBelowCostPolicy(effective);
  }

  /**
   * The loaded row's own scope — the second axis of §5.5's table.
   *
   * It comes from the PAYLOAD, echoed back from what §3 sent, and there is
   * nowhere else it could come from: the resolution is "what was this row, and
   * what does the radio say", and re-deriving "what was this row" server-side
   * would read the table again at a moment the operator has already left
   * behind. A row that arrives without one carries no price yet, and the header
   * scope decides alone.
   */
  private rowScopeOf(row: SaveSellingPriceRowDto): PriceScope | null {
    return (row.priceScope as PriceScope | undefined) ?? null;
  }

  /**
   * A uomId is an item_unit_conversion.iuc_id OF THIS ITEM. The foreign key
   * alone would let a price point at another item's unit; refused with the
   * lines named, before anything is written.
   */
  private assertUnitsBelong(
    rows: readonly SaveSellingPriceRowDto[],
    costs: readonly RowCost[],
  ): void {
    const wrong = rows
      .map((row, index) => ({ row, index }))
      .filter(({ index }) => !costs[index].uomBelongs);
    if (!wrong.length) {
      return;
    }
    throwStockUnprocessable<StockErrorDetail>(
      'These prices cannot be saved',
      wrong.map(({ row, index }) => ({
        field: `rows.${row.lineNo ?? index + 1}`,
        code: StockErrorCode.PRICE_UNIT_NOT_OF_ITEM,
        message: `Line ${row.lineNo ?? index + 1}: unit ${row.uomId} is not one of item ${row.itemId}'s units.`,
      })),
    );
  }

  /**
   * Two rows of one save landing on one bucket at one scope. After policy
   * blanking two MRPs of an untracked item ARE one price, and the second write
   * would silently replace the first — refused, naming both lines, the same
   * refusal the item card gives.
   */
  private assertOneRowPerBucket(
    candidates: readonly BucketPriceCandidate[],
    resolutions: readonly ScopeResolution[],
  ): void {
    const firstAt = new Map<string, number>();
    candidates.forEach((candidate, index) => {
      const key = [
        candidate.itemId,
        candidate.uomId,
        resolutions[index].targetBranchId ?? '',
        candidate.mrp ?? '',
        candidate.salePrice ?? '',
      ].join('|');
      const first = firstAt.get(key);
      if (first !== undefined) {
        throwStockUnprocessable<StockErrorDetail>('These prices cannot be saved', [
          {
            field: `rows.${candidate.lineNo}`,
            code: StockErrorCode.PRICE_DUPLICATE_BUCKET,
            message:
              `Lines ${candidates[first].lineNo} and ${candidate.lineNo} price the same bucket of ` +
              `${candidate.itemName || candidate.itemId} at the same scope. Keep one of them.`,
          },
        ]);
      }
      firstAt.set(key, index);
    });
  }

  /**
   * §5.1 — `price` wins; priceWot and markupPerc are recomputed, never trusted.
   * The bucket is BLANKED here by the item's policy (`bucketKeyFor`): the grid
   * echoes what it loaded, but an MRP the policy does not track is not a
   * dimension, and the row is the headline.
   */
  private toCandidate(
    row: SaveSellingPriceRowDto,
    index: number,
    companyId: string,
    actor: string,
    taxRates: ReadonlyMap<string, ItemTaxRate>,
    cost: RowCost,
  ): BucketPriceCandidate {
    const taxPerc = taxRates.get(row.itemId)?.taxPerc ?? 0;
    const key = bucketKeyFor(cost, { mrp: row.mrp ?? null, salePrice: row.salePrice ?? null });
    // Notes 147 B — a keyed costPrice is the price row's own cost for this save:
    // stored with its w/o-tax half, and the markups and the below-cost check
    // are against it. Absent, the cost the grid showed, as before.
    const keyedCost = row.costPrice ?? null;
    const costRate = keyedCost ?? cost.costRate;
    const costWot = keyedCost !== null ? exclusiveOfTax(keyedCost, taxPerc) : cost.costWot;
    return {
      lineNo: row.lineNo ?? index + 1,
      companyId,
      itemId: row.itemId,
      uomId: row.uomId,
      itemCode: cost.itemCode,
      itemName: cost.itemName,
      bucketId: row.bucketId ?? null,
      mrp: key.mrp,
      salePrice: key.salePrice,
      minPrice: row.minPrice ?? null,
      roundOff: row.roundOff ?? null,
      costRate,
      costWot,
      actor,
      levels: row.levels.map((level) => {
        const value = recomputeLevel(level.level as PriceLevel, level.price, taxPerc, costRate);
        return {
          level: value.level,
          price: value.price,
          priceWot: value.priceWot,
          markupPerc: value.markupPerc,
        };
      }),
    };
  }

  /** The grid rows the client sees: the gateway's records plus tax and the four-number levels. */
  private async toGridRows(
    records: readonly PriceGridRecord[],
    offset: number,
  ): Promise<SellingPriceRow[]> {
    const taxRates = await this.resolveItemTaxRates(
      this.prisma,
      records.map((record) => record.itemId),
    );
    return records.map((record, index) =>
      this.toGridRow(record, offset + index + 1, taxRates.get(record.itemId)),
    );
  }

  /** One grid row: the gateway's record plus tax and the four-number levels. */
  private toGridRow(
    record: PriceGridRecord,
    lineNo: number,
    tax: ItemTaxRate | undefined,
  ): SellingPriceRow {
    const taxPerc = tax?.taxPerc ?? 0;
    return {
      lineNo,
      itemId: record.itemId,
      itemCode: record.itemCode,
      barcode: record.barcode,
      itemName: record.itemName,
      uomId: record.uomId,
      unitName: record.unitName,
      stockQty: record.stockQty,
      mrp: record.mrp,
      salePrice: record.salePrice,
      maxPrice: record.maxPrice,
      priceSource: record.priceSource,
      priceScope: record.priceScope,
      bucketId: record.bucketId,
      costRate: record.costRate,
      costWot: record.costWot,
      costBasis: record.costBasis,
      minPrice: record.minPrice,
      roundOff: record.roundOff,
      taxPerc,
      inclTax: tax?.inclTax ?? false,
      hasCess: tax?.hasCess ?? false,
      levels: PRICE_LEVELS.map((level) =>
        recomputeLevel(level, record.prices[level - 1], taxPerc, record.costRate),
      ),
    };
  }

  private throwProblems(problems: SellingPriceProblem[], message: string): never {
    throwStockUnprocessable<StockErrorDetail>(
      message,
      problems.map((problem) => ({
        field: `rows.${problem.lineNo}`,
        code: PRICE_VERDICT_CODES[problem.verdict],
        message: `Line ${problem.lineNo}: ${problem.message}`,
      })),
    );
  }

  /**
   * §4.3 — the tax percentage per item, AS OF a date (today by default),
   * through item_tax_history. The rule lives in the shared helper
   * `Inventory/utils/item-tax-rate.helper.ts`, which the item card's price
   * save uses too (notes 71 B4), so the two derive a level the same way.
   */
  async resolveItemTaxRates(
    tx: Pick<Prisma.TransactionClient, 'itemMaster' | 'itemTaxHistory' | 'taxRateMaster'>,
    itemIds: readonly string[],
    asOf: Date = new Date(),
  ): Promise<Map<string, ItemTaxRate>> {
    return resolveItemTaxRates(tx, itemIds, asOf);
  }
}
