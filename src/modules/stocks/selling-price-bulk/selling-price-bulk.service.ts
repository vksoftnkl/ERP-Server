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
import { exclusiveOfTax, markupReproduces, recomputeLevel } from './selling-price-math.helper';
import { resolveTargetScope, type ScopeResolution } from './selling-price-scope.helper';
import {
  PriceBucketGateway,
  type BucketPriceCandidate,
  type PriceGridRecord,
  type PriceLineRecord,
  type RowCost,
} from './price-bucket.gateway';
import type { BackToAllBranchesDto } from './dto/back-to-all-branches.dto';
import {
  CONFIRMABLE_VERDICTS,
  PRICE_LEVELS,
  isHqUserType,
  type BelowCostPolicy,
  type ItemTaxRate,
  type OtherBranchesStockCost,
  type PagedResult,
  type PriceLevel,
  type PriceLineKind,
  type PriceScope,
  type PriceVerdict,
  type SellingPriceBackResult,
  type SellingPriceLinePageMeta,
  type SellingPriceLineRow,
  type SellingPriceProblem,
  type SellingPriceRow,
  type SellingPriceSaveResult,
  type SellingPriceSavedRow,
  type SellingPriceScheduleCancelResult,
  type SellingPriceScheduleRow,
  type StockErrorDetail,
} from './types/selling-price-bulk.types';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  PriceMasterWriter,
  type PriceCandidateWrite,
} from '../../Inventory/item-price-log/price-master-writer.service';
import {
  PRICE_MENU_ID,
  PRICE_ORIGIN,
  type PriceWriteOrigin,
} from '../../Inventory/item-price-log/types/price-change-log.types';
import { assertMenuRight } from '../../../common/posting/rights';
import { wordingFor } from '../../../common/error-wording/error-wording';

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

/**
 * A save checked and not yet written (prepareBulk → writeBulkInTx), so a caller
 * with checks of its own — Qty-wise Prices, menu 244 — can run them between the
 * two, in the same transaction. `belowCost` is what Q26 found below cost and the
 * policy has not refused: the caller asks, or writes.
 */
export interface PreparedBulkSave {
  dto: SaveSellingPriceBulkDto;
  actor: string;
  /** `YYYY-MM-DD` — the day the prices start. */
  from: string;
  scheduledFrom: string | undefined;
  /** Per row, in dto.rows order. */
  costs: RowCost[];
  candidates: PriceCandidateWrite[];
  resolutions: ScopeResolution[];
  /** Everything Q26 said (below cost included). */
  problems: SellingPriceProblem[];
  belowCost: SellingPriceProblem[];
}

/**
 * What prepareBulk is told besides the save. `actor` and `policy` always;
 * the two options only by Qty-wise Prices (menu 244, review fixes C-a / C-c,
 * 2026-11-06) — absent, the save is checked and costed exactly as before
 * (menu 30, Quick Rate).
 */
export interface PrepareBulkContext {
  actor: string;
  policy: BelowCostPolicy;
  /** C-a: judge a level only when it is one of these active levels and priced above 0. */
  activeLevels?: readonly number[];
  /**
   * C-c: asked once per row that carries a costPrice, with the row's index and
   * its bucket key after the item's policy blanked it. An answer replaces the
   * keyed cost and its w/o-tax half — the stored figures, written back as they
   * are — so a cost sent back as loaded is not re-derived. Null keeps the
   * keyed cost (a real change).
   */
  keepCost?: (
    index: number,
    row: SaveSellingPriceRowDto,
    key: { mrp: number | null; salePrice: number | null },
  ) => { costRate: number; costWot: number } | null;
  /**
   * Change Selling Price P1, decision A1 — menu 30 and the Ctrl+R popup (saveBulk) only: a
   * row that sends no costPrice keeps the LINE's own cost (ipm_cost_price of the line of its
   * key) instead of being overwritten with the stock-first cost. A key with no line yet, or a
   * line with no cost, takes the stock-first cost as before. Purchases (applyPurchasePrices)
   * and menu 244 do not set it: their rows are costed and stored exactly as before (P2 moves
   * the purchase write).
   */
  keepLineCost?: boolean;
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
   * Change Selling Price P1 (plan 2026-11-23 §4.1 / §7.1) — GET /stock/price-bulk: the grid's
   * LINES for a page of ITEMS. Edit on menu 30 first (O8: no read-only mode), then the branch
   * (another branch's prices are head office only). Every old row key is kept; each line adds
   * what it is (lineKind), its own cost apart from the stock cost, its company / branch,
   * Profit Type, unit facts and the item row's facts; an All branches line adds the other
   * branches' stock-cost spread (C5). Menu 244 keeps `listPrices` (one row per bucket).
   */
  async listPriceLines(
    queryDto: ListSellingPriceQueryDto,
  ): Promise<{ items: SellingPriceLineRow[]; meta: SellingPriceLinePageMeta }> {
    await this.assertCanEditPrices();
    await this.assertBranchAllowed(queryDto.branchId);
    const limit = Math.min(queryDto.limit ?? DEFAULT_PRICE_GRID_LIMIT, MAX_PRICE_GRID_LIMIT);
    const offset = Math.max(queryDto.offset ?? 0, 0);
    const page = await this.gateway.listPriceLines({
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
      unpricedOnly: queryDto.unpricedOnly === true,
      limit,
      offset,
    });
    const records = page.items;
    const taxRates = await this.resolveItemTaxRates(this.prisma, [
      ...new Set(records.map((record) => record.itemId)),
    ]);
    const taxNames = await this.gateway.taxNames(this.prisma, [
      ...new Set([...taxRates.values()].map((tax) => tax.taxId).filter((id): id is string => !!id)),
    ]);
    // C5 — the other branches that read each All branches line, and their stock cost.
    const chainAt = records
      .map((record, index) => ({ record, index }))
      .filter(
        ({ record }) =>
          record.lineKind !== 'NO_PRICE' &&
          record.bucketId !== null &&
          record.priceScope === 'CHAIN' &&
          // S7 — an MRP item's main line ("other MRPs") has no stock cost anywhere.
          !(record.trackMrp && record.mrp === null),
      );
    const spread = chainAt.length
      ? await this.gateway.otherBranchStockCosts(this.prisma, {
          companyId: queryDto.companyId,
          excludeBranchId: queryDto.branchId,
          probes: chainAt.map(({ record }) => ({
            itemId: record.itemId,
            uomId: record.uomId,
            mrp: record.mrp,
            salePrice: record.salePrice,
          })),
        })
      : [];
    const spreadAt = new Map(chainAt.map(({ index }, at) => [index, spread[at] ?? []]));
    const items = records.map((record, index) => {
      const tax = taxRates.get(record.itemId);
      return this.toLineRow(
        record,
        index + 1,
        tax,
        tax?.taxId ? (taxNames.get(tax.taxId.toLowerCase()) ?? null) : null,
        spreadOf(spreadAt.get(index) ?? []),
      );
    });
    return { items, meta: page.meta };
  }

  /**
   * §4 — Q24, F12: every live price row this branch can see, plus every stock
   * bucket at the branch with no row of its own (notes 74), headline first.
   * P1 §7.1 — the same two checks as the grid: Edit on menu 30, and the branch.
   */
  async listBuckets(itemId: string, queryDto: PriceBucketsQueryDto): Promise<SellingPriceRow[]> {
    await this.assertCanEditPrices();
    await this.assertBranchAllowed(queryDto.branchId);
    const records = await this.gateway.listBuckets(itemId, queryDto.companyId, queryDto.branchId);
    return this.toGridRows(records, 0);
  }

  /**
   * §5 — one POST, one transaction, one commit: rights + scope + via + policy,
   * then prepare → verdict → write in the one transaction. Qty-wise Prices
   * (menu 244, plan 2026-11-05 §4.6 item 1) runs the same prepareBulk and
   * writeBulkInTx inside ITS transaction, around its own slab checks.
   */
  async saveBulk(dto: SaveSellingPriceBulkDto): Promise<SellingPriceSaveResult> {
    // BEFORE anything reads or writes: the right to change prices at all, then
    // the scope. A downgraded scope would be a save that silently did something
    // other than what the header radio said.
    await this.assertCanEditPrices();
    // P1 §4.6 — another branch is head office only; then the body's scope and each line's.
    await this.assertBranchAllowed(dto.branchId);
    this.assertScopeAllowed(dto.scope ?? 'BRANCH');
    this.assertRowScopesAllowed(dto.rows);
    // The quick rate popup names the screen it was opened from (§3.3).
    const via = dto.originMenuId ? await this.describeOriginMenu(dto.originMenuId) : null;

    const confirmed = dto.confirmed === true;
    const policy = await this.resolveBelowCostPolicy(dto);
    const actor = resolveActor(dto.userId, this.requestContext.getUserId());

    return this.prisma.$transaction(async (tx) => {
      // P1 A1 — a line that sends no cost keeps its own (menu 30 / Ctrl+R only).
      const prepared = await this.prepareBulk(tx, dto, { actor, policy, keepLineCost: true });
      if (
        prepared.belowCost.length &&
        resolveBelowCostAction(policy, confirmed) === 'CONFIRM'
      ) {
        // 200, not an error: nothing is wrong yet, the user is being asked.
        // Nothing has been written, so returning out of the transaction
        // commits an empty unit of work.
        return this.confirmResult(prepared, policy);
      }
      return this.writeBulkInTx(tx, prepared, { confirmed, via, policy });
    });
  }

  /**
   * The checks of a save, in the caller's transaction, WRITING NOTHING: the
   * start day, tax, each row's cost (loadRowCosts), the candidates, the unit
   * and one-row-per-bucket refusals, then Q26 (§5.2). Above MRP and below min
   * are thrown here (always refusals); below cost is thrown under `restrict`
   * and otherwise handed back in `belowCost` for the caller's verdict.
   */
  async prepareBulk(
    tx: Prisma.TransactionClient,
    dto: SaveSellingPriceBulkDto,
    ctx: PrepareBulkContext,
  ): Promise<PreparedBulkSave> {
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
      this.toCandidate(row, index, dto.companyId, ctx.actor, taxRates, costs[index], ctx),
    );
    // P1 §4.6 — each line's own scope (rows[].scope), else the body's, else BRANCH.
    const resolutions = dto.rows.map((row) =>
      resolveTargetScope(row.scope ?? dto.scope ?? 'BRANCH', this.rowScopeOf(row), dto.branchId),
    );
    this.assertOneRowPerBucket(candidates, resolutions);
    // P1 §4.8 — + Line rows: an MRP item's new line needs its MRP; a key already lined is refused.
    await this.assertNewLines(tx, dto, candidates, resolutions, costs, scheduledFrom);

    // ── Step 1 — Q26. §5.2 ─────────────────────────────────────────────────
    const levels = await this.gateway.priceLevels(tx);
    const levelNames = new Map(levels.map((level) => [level.level, level.name]));
    // Review S4 — only the ACTIVE levels priced above 0 are judged, on every writer: a hidden
    // (inactive) level the user cannot see neither asks nor refuses (menu 244 already sent its own).
    const activeLevels =
      ctx.activeLevels ?? levels.filter((level) => level.active).map((level) => level.level);
    const problems = this.gateway.validateRows(
      candidates,
      costs.map((cost) => cost.minPrice),
      { activeLevels, levelNames },
    );
    // P1 §4.7 (C6, O10) — an All branches line is judged at every other branch reading it.
    // S7 — an MRP item's main line ("other MRPs") has no stock cost anywhere: not probed.
    const chainAt = resolutions
      .map((resolution, index) => ({ resolution, index }))
      .filter(
        ({ resolution, index }) =>
          resolution.targetScope === 'CHAIN' &&
          !(costs[index].trackMrp && candidates[index].mrp === null),
      )
      .map(({ index }) => index);
    if (chainAt.length) {
      const branches = await this.gateway.otherBranchStockCosts(tx, {
        companyId: dto.companyId,
        excludeBranchId: dto.branchId,
        onDate: from,
        probes: chainAt.map((index) => ({
          itemId: candidates[index].itemId,
          uomId: candidates[index].uomId,
          mrp: candidates[index].mrp,
          salePrice: candidates[index].salePrice,
        })),
      });
      problems.push(
        ...this.gateway.branchProblems(
          chainAt.map((index) => candidates[index]),
          branches,
          { activeLevels, levelNames },
        ),
      );
    }

    const blocking = problems.filter((problem) => !CONFIRMABLE_VERDICTS.includes(problem.verdict));
    if (blocking.length) {
      // Above MRP and below min abort ALWAYS — `confirmed` never reaches
      // here. `ck_ipm_not_above_mrp` would refuse the first anyway; the
      // second has NO constraint behind it, so this is its only enforcement.
      this.throwProblems(blocking, 'These prices cannot be saved');
    }

    const belowCost = problems.filter((problem) => problem.verdict === 'BELOW_COST');
    if (belowCost.length && resolveBelowCostAction(ctx.policy, false) === 'ABORT') {
      this.throwProblems(
        belowCost,
        'Prices below cost are not allowed (inventory.below_cost_price = restrict)',
      );
    }
    return {
      dto,
      actor: ctx.actor,
      from,
      scheduledFrom,
      costs,
      candidates,
      resolutions,
      problems,
      belowCost,
    };
  }

  /** The `needsConfirm` answer of a prepared save: nothing written, the below-cost rows asked about. */
  confirmResult(prepared: PreparedBulkSave, policy: BelowCostPolicy): SellingPriceSaveResult {
    return {
      saved: 0,
      effectiveFrom: prepared.from,
      rows: [],
      masterRowsSaved: 0,
      noStock: [],
      needsConfirm: true,
      problems: worded(prepared.belowCost),
      belowCostPolicy: policy,
    };
  }

  /**
   * §5.4 — write a prepared save in the caller's transaction: S1 → S2/S3 per
   * row (the Price Change Log reason names a confirmed below-cost verdict and
   * `via`), the costs read back, Q27, one audit row per row written, and the
   * answer. The caller has decided the verdict: a below-cost row reaching here
   * is allowed, or confirmed.
   */
  async writeBulkInTx(
    tx: Prisma.TransactionClient,
    prepared: PreparedBulkSave,
    opts: { confirmed: boolean; via: string | null; policy: BelowCostPolicy },
  ): Promise<SellingPriceSaveResult> {
    const { dto, candidates, resolutions, scheduledFrom, belowCost, actor } = prepared;
    const { confirmed, via, policy } = opts;
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

    const after = await this.auditWrites(tx, applied, {
      actor,
      confirmedBelowCost: confirmed ? belowCost : [],
      scheduledFrom,
      scopes: resolutions.map((resolution) => resolution.targetScope),
    });

    return {
      saved: ipmIds.length,
      effectiveFrom: prepared.from,
      rows: applied.map((row, index) =>
        this.toSavedRow(row, after.get(row.ipmId), scheduledFrom, shown[index]),
      ),
      masterRowsSaved: 0,
      noStock,
      needsConfirm: false,
      problems: worded(prepared.problems),
      belowCostPolicy: policy,
    };
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
   *
   * 2026-11-02 — the line's MSP (`minPrice`, purchase entry P9) rides in the
   * same row write, MSP FIRST: when it differs from the row's stored minimum
   * it is the minimum the bill's prices are checked against (validateRows
   * takes the candidate's) and S2 / S3 store it with them. One write or none:
   * a price below the bill's own MSP (or above MRP / below cost) keeps the
   * whole row — prices and MSP — as it is, and says so. A line that changes
   * only the MSP rewrites the prices in force unchanged (a new branch / bucket
   * row keeps them); with no price row at all for the unit there is nothing to
   * hang an MSP on, and it says so. An MSP equal to the stored one is no change.
   */
  async applyPurchasePrices(
    tx: Prisma.TransactionClient,
    args: {
      companyId: string;
      branchId: string;
      actor: string;
      billRef: string;
      businessTime: Date;
      rows: { key: string; itemId: string; uomId: string; mrp: number | null; levels: { level: number; price: number }[]; minPrice?: number | null }[];
    },
  ): Promise<Map<string, { result: 'UPDATED' | 'KEPT_NEWER' | 'NONE'; note: string | null }>> {
    const out = new Map<string, { result: 'UPDATED' | 'KEPT_NEWER' | 'NONE'; note: string | null }>();
    const hasMsp = (r: { minPrice?: number | null }) => r.minPrice !== null && r.minPrice !== undefined && r.minPrice >= 0;
    const live = args.rows.filter((r) => r.levels.some((l) => l.price > 0) || hasMsp(r));
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
    const costs = await this.gateway.loadRowCosts(
      tx, writable.map((r) => ({ itemId: r.itemId, uomId: r.uomId, mrp: r.mrp ?? null, salePrice: null })), args.companyId, args.branchId, undefined,
    );
    // the MSP only when it changes the stored one; a line with no price of its own re-states the prices in force
    const plans = writable.map((r, i) => {
      const msp = hasMsp(r) && !new Prisma.Decimal(r.minPrice!).equals(new Prisma.Decimal(costs[i].minPrice)) ? r.minPrice! : null;
      const own = r.levels.filter((l) => l.price > 0).map((l) => ({ level: l.level, price: l.price }));
      if (own.length) return { r, cost: costs[i], msp, levels: own, skip: null as string | null };
      if (msp === null) return { r, cost: costs[i], msp, levels: own, skip: '' };
      const inForce = costs[i].prices;
      if (!inForce) return { r, cost: costs[i], msp, levels: own, skip: `MSP ${msp} not written — the item has no selling price for this unit here; set its prices first.` };
      return { r, cost: costs[i], msp, levels: inForce.map((price, k) => ({ level: k + 1, price })).filter((l) => l.price > 0), skip: null };
    });
    for (const x of plans) if (x.skip !== null) out.set(x.r.key, { result: 'NONE', note: x.skip || null });
    const todo = plans.filter((x) => x.skip === null);
    if (!todo.length) return out;
    const rows = todo.map((x, i) => ({
      lineNo: i + 1, itemId: x.r.itemId, uomId: x.r.uomId, mrp: x.r.mrp, salePrice: null, minPrice: x.msp, levels: x.levels,
    })) as unknown as SaveSellingPriceRowDto[];
    const taxRates = await this.resolveItemTaxRates(tx, rows.map((r) => r.itemId));
    const candidates = rows.map((row, i) => this.toCandidate(row, i, args.companyId, args.actor, taxRates, todo[i].cost));
    const problems = this.gateway.validateRows(candidates, todo.map((x) => x.cost.minPrice));
    const origin = { source: 'PURCHASE' as const, menuId: PRICE_MENU_ID.PURCHASE_ENTRY, reason: `Purchase ${args.billRef}` };
    for (let i = 0; i < candidates.length; i += 1) {
      const mine = problems.filter((p) => p.lineNo === candidates[i].lineNo);
      if (mine.length) {
        const msp = todo[i].msp !== null ? ` The MSP ${todo[i].msp} is not written either.` : '';
        out.set(todo[i].r.key, { result: 'NONE', note: `Price not updated — ${mine.map((p) => p.message).join('; ')}${msp}` });
        continue;
      }
      await this.applyBucketPrice(tx, candidates[i], resolveTargetScope('BRANCH', null, args.branchId), undefined, origin);
      out.set(todo[i].r.key, { result: 'UPDATED', note: null });
    }
    return out;
  }

  /**
   * Purchase entry P9 — the MSP each purchase line starts from: the minimum on
   * the price row in force at this branch today for the line's unit and MRP
   * bucket (the row applyPurchasePrices would write). Null when no row prices
   * the unit or its minimum is 0 (no MSP).
   */
  async currentMinPrices(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string,
    rows: ReadonlyArray<{ itemId: string; uomId: string; mrp: number | null }>,
  ): Promise<(Prisma.Decimal | null)[]> {
    if (!rows.length) return [];
    const costs = await this.gateway.loadRowCosts(tx, rows.map((r) => ({ itemId: r.itemId, uomId: r.uomId, mrp: r.mrp, salePrice: null })), companyId, branchId);
    return costs.map((c) => (c.minPrice > 0 ? new Prisma.Decimal(c.minPrice) : null));
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
    // Review S5 — the same rights as the grid: Edit on menu 30, and another branch is head office only.
    await this.assertCanEditPrices();
    await this.assertBranchAllowed(queryDto.branchId);
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
      } else {
        // Review S5 — a store user cancels only his own branch's schedule.
        await this.assertBranchAllowed(row.branchId, 'ipmId');
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
    applied: readonly AppliedBucketPrice[],
    context: {
      actor: string;
      confirmedBelowCost: readonly SellingPriceProblem[];
      scheduledFrom?: string;
      /** P1 §4.6 — the scope each row was written at, in `applied` order. */
      scopes: readonly PriceScope[];
    },
  ): Promise<Map<string, Prisma.JsonObject>> {
    const after = await this.gateway.snapshotRows(tx, [
      ...applied.map((row) => row.ipmId),
      ...applied.flatMap((row) => (row.closed ? [row.closed.ipmId] : [])),
    ]);
    // Notes 140 A — a scheduled save names its day on every row it wrote.
    const fromLabel = context.scheduledFrom ? `, from ${displayDay(context.scheduledFrom)}` : '';
    for (const [index, row] of applied.entries()) {
      const scopeLabel = context.scopes[index] === 'CHAIN' ? 'all branches' : 'this branch';
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
   * P1 §4.6 — a line's own scope (rows[].scope) of CHAIN is head office's, as the body's is:
   * 403 STOCK_PRICE_CHAIN_HQ_ONLY naming the line, before anything is read or written.
   */
  private assertRowScopesAllowed(rows: readonly SaveSellingPriceRowDto[]): void {
    if (isHqUserType(this.requestContext.getUserType())) {
      return;
    }
    const wrong = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.scope === 'CHAIN');
    if (!wrong.length) {
      return;
    }
    throwStockForbidden<StockErrorDetail>(
      'These prices cannot be saved',
      wrong.map(({ row, index }) => ({
        field: `rows.${row.lineNo ?? index + 1}.scope`,
        code: StockErrorCode.PRICE_CHAIN_HQ_ONLY,
        message:
          `Line ${row.lineNo ?? index + 1}: only an HQ user may save prices for all branches. ` +
          "Save it as this branch's own line instead.",
      })),
    );
  }

  /**
   * P1 §4.6 — another branch's prices (GET, POST, Back to all branches) are head office's.
   * A store user's own branch is the login's (the device branch on the token), else the
   * user's branch (user_master.usr_branch_id) — Qty-wise Prices' rule (D16 C-d). A store
   * login with neither has no branch of its own and is refused. 403
   * STOCK_PRICE_BRANCH_HQ_ONLY, field `branchId`.
   */
  async assertBranchAllowed(branchId: string, field = 'branchId'): Promise<void> {
    if (isHqUserType(this.requestContext.getUserType())) {
      return;
    }
    const own = await this.ownBranchId();
    if (own !== null && own === branchId.toLowerCase()) {
      return;
    }
    throwStockForbidden<StockErrorDetail>("Another branch's prices need head office", [
      {
        field,
        code: StockErrorCode.PRICE_BRANCH_HQ_ONLY,
        message: own
          ? `Only head office may see or change another branch's prices (branch ${branchId}). Work on your own branch.`
          : 'This login has no branch of its own (no device branch, no branch on the user), so only head office may work on prices.',
      },
    ]);
  }

  /** The caller's own branch: the token's (device) branch, else the user's. Lower-cased. */
  private async ownBranchId(): Promise<string | null> {
    const loggedIn = this.requestContext.getBranchId();
    if (loggedIn) {
      return loggedIn.toLowerCase();
    }
    const userId = this.requestContext.getUserId();
    const own = userId ? await this.gateway.userBranchId(this.prisma, userId) : null;
    return own ? own.toLowerCase() : null;
  }

  /**
   * P1 §4.8 — + Line (`isNew`) rows, before Q26: an MRP-tracked item's new line names an MRP
   * above 0 (422 STOCK_PRICE_BUCKET_MRP_ZERO — blanked, it would land on the headline), and
   * a key that already has a live line at the target scope on the day is refused (422
   * STOCK_PRICE_LINE_EXISTS, params unit / mrp / branch / n, `existingIpmId` the line there).
   */
  private async assertNewLines(
    tx: Prisma.TransactionClient,
    dto: SaveSellingPriceBulkDto,
    candidates: readonly PriceCandidateWrite[],
    resolutions: readonly ScopeResolution[],
    costs: readonly RowCost[],
    scheduledFrom: string | undefined,
  ): Promise<void> {
    const fresh = dto.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.isNew === true);
    if (!fresh.length) {
      return;
    }
    const noMrp = fresh.filter(
      ({ row, index }) =>
        costs[index].trackMrp && !(row.mrp !== undefined && row.mrp !== null && row.mrp > 0),
    );
    if (noMrp.length) {
      throwStockUnprocessable<StockErrorDetail>(
        'These prices cannot be saved',
        noMrp.map(({ index }) => ({
          field: `rows.${candidates[index].lineNo}.mrp`,
          code: StockErrorCode.PRICE_BUCKET_MRP_ZERO,
          message:
            `Line ${candidates[index].lineNo}: ${candidates[index].itemName} is tracked by MRP, so a ` +
            'new line needs the MRP printed on its stock (above 0).',
        })),
      );
    }
    const labels = await this.gateway.branchLabels(tx, [dto.branchId]);
    const errors: StockErrorDetail[] = [];
    for (const { index } of fresh) {
      const candidate = candidates[index];
      const found = await this.gateway.findBucketRowForUpdate(
        tx,
        candidate,
        resolutions[index],
        scheduledFrom,
      );
      if (!found) {
        continue;
      }
      const branch =
        resolutions[index].targetBranchId === null
          ? 'All branches'
          : (labels.get(dto.branchId.toLowerCase()) ?? 'this branch');
      const mrp =
        candidate.mrp !== null
          ? `MRP ${candidate.mrp.toFixed(2)}`
          : candidate.salePrice !== null
            ? `sold at ${candidate.salePrice.toFixed(2)}`
            : '';
      const unit = candidate.unitName ?? '';
      errors.push({
        field: `rows.${candidate.lineNo}`,
        code: StockErrorCode.PRICE_LINE_EXISTS,
        message: (
          `Line ${candidate.lineNo}: ${candidate.itemName} ${unit} ${mrp} already has a price line ` +
          `for ${branch} (${found.ipmId}). Type the prices on that line.`
        ).replace(/\s+/g, ' '),
        params: { unit, mrp, branch, n: candidate.lineNo, item: candidate.itemName },
        existingIpmId: found.ipmId,
      } as StockErrorDetail);
    }
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail>('These prices cannot be saved', errors);
    }
  }

  /**
   * P1 §4.9 / §7.3 — Back to all branches · Alt+X: a store's own line, and its own scheduled
   * rows of the same key (Q5), are soft-deleted through the price writer (logged DELETE,
   * reason "Back to all branches"; one audit row each, action cancel), so the store reads the
   * All branches price again. Edit AND Delete on menu 30 (Q1); a store user for his own
   * branch only (O6). One transaction. Refused: not an own line (BACK_NOT_OWN), nothing would
   * price the unit there afterwards (BACK_NOTHING_LEFT).
   */
  async backToAllBranches(dto: BackToAllBranchesDto): Promise<SellingPriceBackResult> {
    await this.assertCanEditPrices();
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: PRICE_MENU_ID.CHANGE_SELLING_PRICE,
      right: 'delete',
      codePrefix: 'STOCK_PRICE',
      action: "remove a branch's own price (Back to all branches)",
    });
    await this.assertBranchAllowed(dto.branchId);
    const actor = resolveActor(undefined, this.requestContext.getUserId());
    return this.prisma.$transaction(async (tx) => {
      const named = await this.gateway.lockPriceRow(tx, dto.ipmId);
      if (
        !named ||
        (named.companyId !== null && named.companyId.toLowerCase() !== dto.companyId.toLowerCase())
      ) {
        throwStockNotFound<StockErrorDetail>(
          'Price line not found',
          'ipmId',
          `No price line ${dto.ipmId} of this company. Load the item again.`,
          StockErrorCode.ITEM_PRICE_NOT_FOUND,
        );
      }
      if (named.branchId === null) {
        throwStockUnprocessable<StockErrorDetail>('This line is the price for all branches', [
          {
            field: 'ipmId',
            code: StockErrorCode.PRICE_BACK_NOT_OWN,
            message:
              'This line is the price for all branches, so there is nothing to go back to. Pick a ' +
              "branch's own line.",
          },
        ]);
      }
      // The line's branch is the one acted on: a store user's own only.
      await this.assertBranchAllowed(named.branchId, 'ipmId');
      if (named.branchId.toLowerCase() !== dto.branchId.toLowerCase()) {
        // rule=OTHER_BRANCH: its own wording (review NIT 11); the plain row is the All branches line's.
        throwStockUnprocessable<StockErrorDetail & { rule: 'OTHER_BRANCH' }>("This line is another branch's own price", [
          {
            field: 'ipmId',
            code: StockErrorCode.PRICE_BACK_NOT_OWN,
            rule: 'OTHER_BRANCH',
            message: `Line ${dto.ipmId} is the own price of branch ${named.branchId}, not of branch ${dto.branchId}.`,
          },
        ]);
      }
      // The line in force and its later scheduled rows, by KEY: the item card rewrites lines
      // (new ids on every save), so a stale id still finds the live line of its key.
      const rows = await this.gateway.liveOwnRowsOfKey(tx, named);
      if (!rows.length) {
        throwStockNotFound<StockErrorDetail>(
          'Price line not found',
          'ipmId',
          `Branch ${dto.branchId} has no live own line of that key any more. Load the item again.`,
          StockErrorCode.ITEM_PRICE_NOT_FOUND,
        );
      }
      const ids = rows.map((row) => row.ipmId);
      const after = await this.gateway.priceAfterRemoval(tx, {
        companyId: dto.companyId,
        branchId: named.branchId,
        itemId: named.itemId,
        uomId: named.uomId,
        keyMrp: named.keyMrp,
        keySp: named.keySp,
        excludeIds: ids,
      });
      const labels = await this.gateway.branchLabels(tx, [named.branchId]);
      const branch = labels.get(named.branchId.toLowerCase()) ?? named.branchId;
      if (!after) {
        throwStockUnprocessable<StockErrorDetail>('No price would be left', [
          {
            field: 'ipmId',
            code: StockErrorCode.PRICE_BACK_NOTHING_LEFT,
            message:
              `Without this line, ${named.itemName} ${named.unitName ?? ''} would have no price at ` +
              `${branch}. Set an All branches price first, or keep this line.`,
            params: { item: named.itemName, unit: named.unitName ?? '', branch },
          } as StockErrorDetail,
        ]);
      }
      const before = await this.gateway.snapshotRows(tx, ids);
      const origin: PriceWriteOrigin = {
        ...PRICE_ORIGIN.CHANGE_SELLING_PRICE,
        reason: 'Back to all branches',
      };
      for (const id of ids) {
        await this.writer.softDeletePriceRow(tx, id, actor, origin);
      }
      const snapshot = await this.gateway.snapshotRows(tx, ids);
      for (const id of ids) {
        const stored = snapshot.get(id) ?? null;
        await this.auditLogService.logEntityChange(
          {
            action: 'cancel',
            tableName: ITEM_PRICE_TABLE_NAME,
            screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: id,
            displayName: `${named.itemName} · ${this.describeBucket(stored)}`,
            originalRecord: before.get(id) ?? null,
            modifiedRecord: stored,
            userId: actor,
            notes:
              `${AUDIT_SCREEN_NAME} (menu 30) — back to all branches: ${branch} reads the ` +
              'All branches price again',
          },
          tx,
        );
      }
      return {
        removed: ids.length,
        removedIds: ids,
        nowPricedBy: {
          lineKind: lineKindOfKey(after.keyMrp, after.keySp),
          branchId: after.branchId,
          ipmId: after.ipmId,
          prices: after.prices,
        },
      };
    });
  }

  /**
   * Edit on menu 30, Change Selling Price — the right a price save needs
   * wherever it is made from: this screen, or the quick rate popup opened from
   * a bill line or the item list (plan 2026-10-23), which goes read-only
   * without it. Until then the route checked no right at all, so any login
   * could change any price. No user in the request has no rights. Public:
   * Qty-wise Prices (menu 244) asks it for a save that carries card rows.
   */
  async assertCanEditPrices(): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: PRICE_MENU_ID.CHANGE_SELLING_PRICE,
      right: 'edit',
      codePrefix: 'STOCK_PRICE',
      action: 'change selling prices',
    });
  }

  /** "via Sales Entry (menu 12)" — the price log's note of the screen a popup save came from. */
  async describeOriginMenu(menuId: number): Promise<string> {
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
    ctx?: Pick<PrepareBulkContext, 'keepCost' | 'keepLineCost'>,
  ): PriceCandidateWrite {
    const taxPerc = taxRates.get(row.itemId)?.taxPerc ?? 0;
    const key = bucketKeyFor(cost, { mrp: row.mrp ?? null, salePrice: row.salePrice ?? null });
    // Notes 147 B — a keyed costPrice is the price row's own cost for this save:
    // stored with its w/o-tax half, and the markups are against it.
    // Menu 244 (C-c): a keyed cost the caller calls unchanged is the stored
    // cost and w/o-tax half, kept as they are.
    const kept =
      ctx?.keepCost && row.costPrice !== undefined && row.costPrice !== null
        ? ctx.keepCost(index, row, key)
        : null;
    const keyedCost = kept ? kept.costRate : (row.costPrice ?? null);
    // P1 A1 — menu 30 / Ctrl+R: no cost sent keeps the line's own cost (when it has one);
    // otherwise (purchase, menu 244, a key with no line yet) the cost the grid showed, as before.
    const lineCost =
      keyedCost === null &&
      ctx?.keepLineCost &&
      cost.lineCost !== undefined &&
      cost.lineCost !== null &&
      cost.lineCost > 0
        ? cost.lineCost
        : null;
    // P1, A3 option C — below cost is judged on the HIGHER of the line's own cost and the stock
    // cost (this MRP's landing cost, else the branch average; none for an MRP with no lot — U2 —
    // and none on an MRP item's "other MRPs" line — S7).
    const stockCost =
      cost.stockCost !== undefined && cost.stockCost !== null && cost.stockCost > 0
        ? cost.stockCost
        : null;
    // Review S1 / S8 (user 2026-11-24) — menu 30 / Ctrl+R: no cost sent and no cost of its own →
    // the stock cost above, else NOTHING (0). Never the old stock-first figure, which fell back to
    // the branch average for an MRP with no lot and to another line's cost. Menu 244 and purchases
    // store what they stored before (P2 / P4 move those writes).
    const fromStock = keyedCost === null && lineCost === null && ctx?.keepLineCost === true;
    const costRate = keyedCost ?? lineCost ?? (fromStock ? (stockCost ?? 0) : cost.costRate);
    const costWot = kept
      ? kept.costWot
      : keyedCost !== null
        ? exclusiveOfTax(keyedCost, taxPerc)
        : lineCost !== null
          ? cost.lineCostWot !== undefined && cost.lineCostWot !== null && cost.lineCostWot > 0
            ? cost.lineCostWot
            : exclusiveOfTax(lineCost, taxPerc)
          : fromStock
            ? stockCost === null
              ? 0
              : cost.stockCostWot !== undefined && cost.stockCostWot !== null && cost.stockCostWot > 0
                ? cost.stockCostWot
                : exclusiveOfTax(stockCost, taxPerc)
            : cost.costWot;
    // Review S2 — the line's OWN cost: what was typed / sent, else (menu 30 / Ctrl+R / menu 244 —
    // a ctx; menu 244 sends no cost on an MRP row) the line's stored cost. A purchase (no ctx)
    // sends no cost yet: its "last purchase cost" is THIS bill (user 2026-11-24), already in the
    // stock cost it is judged on — never the line's cost from before the bill. P2 sends the
    // bill's landing cost. With neither cost the stored figure is judged, except on an
    // MRP-tracked item, where it can be the branch average over every MRP (U2 / S7).
    const ownCost =
      keyedCost !== null
        ? keyedCost
        : ctx !== undefined && cost.lineCost !== undefined && cost.lineCost !== null && cost.lineCost > 0
          ? cost.lineCost
          : null;
    const judgeCost =
      ownCost !== null || stockCost !== null
        ? Math.max(ownCost ?? 0, stockCost ?? 0)
        : cost.trackMrp
          ? 0
          : costRate;
    // Decision 20 — a sent markup % is kept when it reproduces the price (the card's
    // typed-figure rule): cost × (1 + % ÷ 100), rounded to the row's R.Off, within 0.005.
    const step = row.roundOff ?? cost.lineRoundOff ?? 0;
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
      judgeCost,
      ownCost,
      stockCost,
      unitName: cost.unitName ?? null,
      // Plan 2026-11-05 §4.6 item 2 — the unit's Rule and a typed MRP ride only
      // when sent (Qty-wise Prices, menu 30 since P1); absent, the candidate is
      // exactly what it was.
      ...(row.profitType !== undefined && row.profitType !== null
        ? { profitType: row.profitType }
        : {}),
      ...(row.maxPrice !== undefined && row.maxPrice !== null ? { maxPrice: row.maxPrice } : {}),
      levels: row.levels.map((level) => {
        const value = recomputeLevel(level.level as PriceLevel, level.price, taxPerc, costRate);
        const sent = level.markupPerc;
        const keep =
          sent !== undefined &&
          sent !== null &&
          markupReproduces(costRate, sent, step, value.price);
        return {
          level: value.level,
          price: value.price,
          priceWot: value.priceWot,
          markupPerc: keep ? Math.round(sent * 1e6) / 1e6 : value.markupPerc,
        };
      }),
    };
  }

  /**
   * P1 §7.1 — one LINE of GET /stock/price-bulk: the old row (prices recomputed against the
   * old costRate, as the old screen reads them) plus the line's own keys.
   */
  private toLineRow(
    record: PriceLineRecord,
    lineNo: number,
    tax: ItemTaxRate | undefined,
    taxName: string | null,
    otherBranchesStockCost: OtherBranchesStockCost | null,
  ): SellingPriceLineRow {
    const row = this.toGridRow(record, lineNo, tax);
    return {
      ...row,
      levels: row.levels.map((level, index) => ({
        ...level,
        storedMarkupPerc: record.storedMarkups[index] ?? null,
      })),
      lineKind: record.lineKind,
      lineCost: record.lineCost,
      lineCostWot: record.lineCostWot,
      stockCost: record.stockCost,
      stockCostWot: record.stockCostWot,
      stockCostBasis: record.stockCostBasis,
      otherBranchesStockCost,
      profitType: record.profitType,
      companyId: record.companyId,
      companyName: record.companyName,
      branchId: record.branchId,
      branchName: record.branchName,
      unitFactor: record.unitFactor,
      unitSlNo: record.unitSlNo,
      isDefaultUnit: record.isDefaultUnit,
      itemGroupName: record.itemGroupName,
      taxName,
      trackPresetName: record.trackPresetName,
      trackMrp: record.trackMrp,
      trackSalePrice: record.trackSalePrice,
      itemCompanyId: record.itemCompanyId,
      itemStockQty: record.itemStockQty,
      itemStockUnit: record.itemStockUnit,
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
        // P1 — the wording variant (rule=LINE_COST / STOCK_COST / BRANCHES) and its values.
        ...(problem.rule ? { rule: problem.rule } : {}),
        ...(problem.params ? { params: problem.params } : {}),
        ...(problem.branchId ? { branchId: problem.branchId, branchName: problem.branchName } : {}),
        ...(problem.level !== null ? { level: problem.level } : {}),
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

/**
 * Notes 120 — a problem's plain words (code + rule + params), for the problems a 200 answer
 * carries (needsConfirm, or saved under `allow`): the filters word only `errors[]`.
 */
function worded(problems: readonly SellingPriceProblem[]): SellingPriceProblem[] {
  return problems.map((problem) => {
    if (!problem.code || problem.user) {
      return problem;
    }
    const user = wordingFor(problem as unknown as Record<string, unknown>);
    return user ? { ...problem, user } : problem;
  });
}

/** P1 C5 — the other branches' stock cost of an All branches line, lowest – highest. */
function spreadOf(
  branches: ReadonlyArray<{ branchName: string; stockCost: number }>,
): OtherBranchesStockCost | null {
  if (!branches.length) {
    return null;
  }
  const sorted = [...branches].sort((a, b) => a.stockCost - b.stockCost);
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return {
    low: round(sorted[0].stockCost),
    high: round(sorted[sorted.length - 1].stockCost),
    lowBranch: sorted[0].branchName,
    highBranch: sorted[sorted.length - 1].branchName,
    branches: sorted.length,
  };
}

/** A price row's kind by its key (a headline is -1 / -1). */
function lineKindOfKey(keyMrp: number, keySp: number): PriceLineKind {
  if (keyMrp === -1 && keySp === -1) {
    return 'HEADLINE';
  }
  return keySp !== -1 ? 'SOLD_AT' : 'MRP';
}
