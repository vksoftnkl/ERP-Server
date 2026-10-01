import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import {
  resolveActor,
  throwStockForbidden,
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
import { SaveSellingPriceBulkDto, SaveSellingPriceRowDto } from './dto/save-selling-price-bulk.dto';
import { resolveBelowCostAction, resolveBelowCostPolicy } from './below-cost-policy.helper';
import { recomputeLevel } from './selling-price-math.helper';
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
  type SellingPriceProblem,
  type SellingPriceRow,
  type SellingPriceSaveResult,
  type StockErrorDetail,
} from './types/selling-price-bulk.types';

/** The audit trail's table and screen — the ones ItemsPriceMasterService files under. */
const ITEM_PRICE_TABLE_NAME = 'item price master';
const ITEM_PRICE_AUDIT_SCREEN_NAME = 'Item Price Master';
/** Named in each audit row's notes, so the trail says which screen made the change. */
const AUDIT_SCREEN_NAME = 'Change Selling Price';

/** What one S1 → S2/S3 did: the row written, and the row as it stood before an update. */
export interface AppliedBucketPrice {
  ipmId: string;
  /** to_jsonb of the row before an S2; null after an S3. */
  before: Prisma.JsonObject | null;
  lineNo: number;
  itemName: string;
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
    // BEFORE anything reads or writes. A downgraded scope would be a save that
    // silently did something other than what the header radio said.
    this.assertScopeAllowed(dto.scope);

    const confirmed = dto.confirmed === true;
    const policy = await this.resolveBelowCostPolicy(dto);
    const actor = resolveActor(dto.userId, this.requestContext.getUserId());

    return this.prisma.$transaction(async (tx) => {
      const taxRates = await this.resolveItemTaxRates(
        tx,
        dto.rows.map((row) => row.itemId),
      );
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
        applied.push(await this.applyBucketPrice(tx, candidates[index], resolutions[index]));
      }
      const ipmIds = applied.map((row) => row.ipmId);

      const noStock = await this.gateway.listNoStock(tx, ipmIds, dto.companyId, dto.branchId);

      await this.auditWrites(tx, dto, applied, {
        actor,
        confirmedBelowCost: confirmed ? belowCost : [],
      });

      return {
        saved: ipmIds.length,
        masterRowsSaved: 0,
        noStock,
        needsConfirm: false,
        problems,
        belowCostPolicy: policy,
      };
    });
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
      parts.push(`${result.saved} price${result.saved === 1 ? '' : 's'} saved`);
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
   */
  async applyBucketPrice(
    tx: Prisma.TransactionClient,
    candidate: BucketPriceCandidate,
    scope: ScopeResolution,
  ): Promise<AppliedBucketPrice> {
    // S1 searches AT THE TARGET SCOPE, so a *This branch* save over a
    // CHAIN-sourced row finds nothing and falls through to S3 — that fall-through
    // IS the branch override of §5.5 row 2, and the chain row is never read for
    // update, so it cannot be edited by accident.
    const existing = await this.gateway.findBucketRowForUpdate(tx, candidate, scope);
    if (!existing) {
      return {
        ipmId: await this.gateway.insertBucketPrice(tx, candidate, scope),
        before: null,
        lineNo: candidate.lineNo,
        itemName: candidate.itemName,
      };
    }
    // The row as it stood, locked by S1 — the audit trail's "before".
    const [before] = (await this.gateway.snapshotRows(tx, [existing.ipmId])).values();
    return {
      ipmId: await this.gateway.updateBucketPrice(tx, existing.ipmId, candidate),
      before: before ?? null,
      lineNo: candidate.lineNo,
      itemName: candidate.itemName,
    };
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
    context: { actor: string; confirmedBelowCost: readonly SellingPriceProblem[] },
  ): Promise<void> {
    const after = await this.gateway.snapshotRows(
      tx,
      applied.map((row) => row.ipmId),
    );
    const scopeLabel = dto.scope === 'CHAIN' ? 'all branches' : 'this branch';
    for (const row of applied) {
      const modified = after.get(row.ipmId) ?? null;
      const confirmed = context.confirmedBelowCost.filter((p) => p.lineNo === row.lineNo);
      // to_jsonb renders numeric as a JSON number; anything else is no bucket.
      const amount = (value: unknown) => (typeof value === 'number' ? value : null);
      const mrp = amount(modified?.ipm_bucket_mrp);
      const salePrice = amount(modified?.ipm_bucket_sp);
      const bucket = [
        mrp !== null ? `MRP ${mrp}` : null,
        salePrice !== null ? `sale price ${salePrice}` : null,
      ].filter(Boolean);
      await this.auditLogService.logEntityChange(
        {
          action: row.before ? 'update' : 'New',
          tableName: ITEM_PRICE_TABLE_NAME,
          screenName: ITEM_PRICE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: row.ipmId,
          displayName: `${row.itemName} · ${bucket.length ? bucket.join(', ') : 'headline'}`,
          originalRecord: row.before,
          modifiedRecord: modified,
          userId: context.actor,
          notes:
            `${AUDIT_SCREEN_NAME} (menu 30), ${scopeLabel}` +
            (confirmed.length
              ? ` — confirmed below cost: ${confirmed.map((p) => p.message).join('; ')}`
              : ''),
        },
        tx,
      );
    }
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
        message:
          'Only an HQ user may save prices for all branches. Save at This branch scope instead.',
      },
    ]);
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
      costRate: cost.costRate,
      costWot: cost.costWot,
      actor,
      levels: row.levels.map((level) => {
        const value = recomputeLevel(
          level.level as PriceLevel,
          level.price,
          taxPerc,
          cost.costRate,
        );
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
    return records.map((record, index) => {
      const tax = taxRates.get(record.itemId);
      const taxPerc = tax?.taxPerc ?? 0;
      return {
        lineNo: offset + index + 1,
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
    });
  }

  private throwProblems(problems: SellingPriceProblem[], message: string): never {
    throwStockUnprocessable<StockErrorDetail>(
      message,
      problems.map((problem) => ({
        field: `rows.${problem.lineNo}`,
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
