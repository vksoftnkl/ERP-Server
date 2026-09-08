import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import { ItemsPriceMasterService } from 'src/modules/Inventory/items-price-master/items-price-master.service';
import type { SaveItemPriceDto } from 'src/modules/Inventory/items-price-master/dto/save-item-price.dto';
import {
  resolveActor,
  throwStockForbidden,
  throwStockUnprocessable,
  toNumber,
} from 'src/common/utils/module-service.utils';
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
  StockMrpPriceGateway,
  type BucketLevelWrite,
  type BucketPriceCandidate,
} from './stock-mrp-price.gateway';
import {
  CONFIRMABLE_VERDICTS,
  LEVEL_COLUMN_SUFFIX,
  isHqUserType,
  type BelowCostPolicy,
  type ItemTaxRate,
  type PagedResult,
  type PriceLevel,
  type PriceScope,
  type SellingPriceLevelValue,
  type SellingPriceProblem,
  type SellingPriceRow,
  type SellingPriceSaveResult,
  type StockErrorDetail,
} from './types/selling-price-bulk.types';

const SMP_TABLE_NAME = 'stock_mrp_price';
const AUDIT_SCREEN_NAME = 'Change Selling Price';

/**
 * The headline fan-out's profit type. §6.
 *
 * ipm_profit_type is NOT NULL and SaveItemPriceDto pins it to three values.
 * "By User" is the only honest one here: the operator typed the price into the
 * grid, and neither a percentage nor an amount was derived from anything.
 */
const HEADLINE_PROFIT_TYPE = 'By User';

/** What one master row answers for the fan-out and the cost the recompute needs. */
interface MasterPriceRow {
  ipmId: string;
  costRate: number;
  minPrice: number;
}

/** Item code and name, for the problem list only. */
interface ItemIdentity {
  itemCode: string | null;
  itemName: string;
}

/** A row after §5.1's recompute, ready for either destination. */
interface PreparedRow {
  lineNo: number;
  itemId: string;
  uomId: string;
  bucketId: string | null;
  mrp: number | null;
  salePrice: number | null;
  minPrice: number | null;
  roundOff: number | null;
  levels: SellingPriceLevelValue[];
  taxPerc: number;
  costRate: number;
}

/**
 * Change Selling Price (bulk), menu 30.
 *
 * This service is a TRANSACTION BOUNDARY and an ERROR TRANSLATOR around SQL it
 * does not own. `fn_smp_effective` resolves prices, Q26 validates, S1–S3 write;
 * there is deliberately no second implementation of the price-resolution rule
 * in TypeScript, because two answers to "what does this item cost" disagree
 * within a month.
 *
 * What IS owned here, and what the client must never duplicate:
 *   §5.5  which row an edit targets — see selling-price-scope.helper.ts
 *   §0.3  whether a below-cost price is allowed — see below-cost-policy.helper.ts
 *   §6    whether an edit is a bucket edit or a headline edit
 *
 * The three statements this cannot run yet all live behind StockMrpPriceGateway
 * (§0.1). A payload of headline-only rows never touches it and saves end to end
 * today; anything naming a dimension answers 503 until the share is deployed.
 */
@Injectable()
export class SellingPriceBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContext: RequestContextService,
    private readonly appSettingValueService: AppSettingValueService,
    private readonly itemsPriceMasterService: ItemsPriceMasterService,
    private readonly gateway: StockMrpPriceGateway,
  ) {}

  /** §3 — Q25, paged. */
  async listPrices(queryDto: ListSellingPriceQueryDto): Promise<PagedResult<SellingPriceRow>> {
    const limit = Math.min(queryDto.limit ?? DEFAULT_PRICE_GRID_LIMIT, MAX_PRICE_GRID_LIMIT);
    const offset = Math.max(queryDto.offset ?? 0, 0);
    return this.gateway.listPrices({
      companyId: queryDto.companyId,
      branchId: queryDto.branchId,
      itemGroupId: queryDto.itemGroupId,
      itemBrandId: queryDto.itemBrandId,
      itemSectionId: queryDto.itemSectionId,
      supplierId: queryDto.supplierId,
      limit,
      offset,
    });
  }

  /** §4 — Q24. An item whose policy tracks neither dimension answers []. */
  async listBuckets(itemId: string, queryDto: PriceBucketsQueryDto): Promise<SellingPriceRow[]> {
    return this.gateway.listBuckets(itemId, queryDto.companyId, queryDto.branchId);
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
      const masterRows = await this.loadMasterPriceRows(tx, dto);
      const identities = await this.loadItemIdentities(
        tx,
        dto.rows.map((row) => row.itemId),
      );

      const bucketRows: SaveSellingPriceRowDto[] = [];
      const headlineRows: SaveSellingPriceRowDto[] = [];
      for (const row of dto.rows) {
        (this.isHeadlineRow(row) ? headlineRows : bucketRows).push(row);
      }

      const resolutions = bucketRows.map((row) =>
        resolveTargetScope(dto.scope, this.rowScopeOf(row), dto.branchId),
      );
      const candidates = bucketRows.map((row, index) =>
        this.toCandidate(row, index, dto.companyId, actor, taxRates, masterRows),
      );

      // ── Step 1 — Q26, and the headline rows' equivalent. §5.2 ──────────────
      const problems = [
        ...(candidates.length ? await this.gateway.validateRows(tx, candidates, resolutions) : []),
        ...this.validateHeadlineRows(headlineRows, taxRates, masterRows, identities),
      ];

      const blocking = problems.filter(
        (problem) => !CONFIRMABLE_VERDICTS.includes(problem.verdict),
      );
      if (blocking.length) {
        // Above MRP and below min abort ALWAYS — `confirmed` never reaches
        // here. `ck_smp_not_above_mrp` would refuse the first anyway; the
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
      const smpIds: string[] = [];
      for (let index = 0; index < candidates.length; index += 1) {
        smpIds.push(await this.applyBucketPrice(tx, candidates[index], resolutions[index]));
      }

      const masterRowsSaved = await this.fanOutHeadlineRows(
        tx,
        dto,
        headlineRows,
        taxRates,
        masterRows,
        actor,
      );

      const noStock = smpIds.length ? await this.gateway.listNoStock(tx, smpIds, dto.branchId) : [];

      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: SMP_TABLE_NAME,
          screenName: AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: smpIds[0] ?? dto.rows[0].itemId,
          displayName: `${dto.scope === 'CHAIN' ? 'All branches' : 'This branch'} · ${
            smpIds.length + masterRowsSaved
          } rows`,
          originalRecord: null,
          modifiedRecord: {
            scope: dto.scope,
            bucketRows: smpIds.length,
            masterRows: masterRowsSaved,
            belowCostPolicy: policy,
            confirmedBelowCost: confirmed && belowCost.length > 0,
            // §5.3 — the audit row for a confirmed below-cost save SAYS SO,
            // with the rows. A confirmation nobody can find afterwards is a
            // rule that was never enforced.
            belowCostRows: confirmed ? belowCost : [],
          },
          userId: actor,
          notes:
            confirmed && belowCost.length
              ? `Selling prices saved with ${belowCost.length} row(s) confirmed below cost`
              : 'Selling prices saved',
        },
        tx,
      );

      return {
        saved: smpIds.length,
        masterRowsSaved,
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
      parts.push(`${result.saved} bucket${result.saved === 1 ? '' : 's'} saved`);
    }
    if (result.masterRowsSaved) {
      parts.push(
        `${result.masterRowsSaved} headline row${result.masterRowsSaved === 1 ? '' : 's'} saved`,
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
   */
  async applyBucketPrice(
    tx: Prisma.TransactionClient,
    candidate: BucketPriceCandidate,
    scope: ScopeResolution,
  ): Promise<string> {
    // S1 searches AT THE TARGET SCOPE, so a *This branch* save over a
    // CHAIN-sourced row finds nothing and falls through to S3 — that fall-through
    // IS the branch override of §5.5 row 2, and the chain row is never read for
    // update, so it cannot be edited by accident.
    const existing = await this.gateway.findBucketRowForUpdate(tx, candidate, scope);
    return existing
      ? this.gateway.updateBucketPrice(tx, existing.smpId, candidate)
      : this.gateway.insertBucketPrice(tx, candidate, scope);
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
   * §6 — the fan-out rule, and the whole of it.
   *
   * Has this row a dimension? MRP or sale price present → it is a bucket.
   * Neither → `ck_smp_identity` refuses a (NULL, NULL) row on purpose, so the
   * edit is a headline edit and lands in inventory.item_price_master.
   *
   * NOT a user-facing choice, and it must never become one: the same item
   * would then have two prices depending on which radio the operator left set.
   */
  private isHeadlineRow(row: SaveSellingPriceRowDto): boolean {
    return (row.mrp ?? null) === null && (row.salePrice ?? null) === null;
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

  private toCandidate(
    row: SaveSellingPriceRowDto,
    index: number,
    companyId: string,
    actor: string,
    taxRates: ReadonlyMap<string, ItemTaxRate>,
    masterRows: ReadonlyMap<string, MasterPriceRow>,
  ): BucketPriceCandidate {
    const prepared = this.prepareRow(row, index, taxRates, masterRows);
    return {
      lineNo: prepared.lineNo,
      companyId,
      itemId: prepared.itemId,
      uomId: prepared.uomId,
      bucketId: prepared.bucketId,
      mrp: prepared.mrp,
      salePrice: prepared.salePrice,
      minPrice: prepared.minPrice,
      roundOff: prepared.roundOff,
      actor,
      levels: prepared.levels.map(
        (level): BucketLevelWrite => ({
          level: level.level,
          price: level.price,
          priceWot: level.priceWot,
          markupPerc: level.markupPerc,
        }),
      ),
    };
  }

  /** §5.1 — `price` wins; priceWot and markupPerc are recomputed, never trusted. */
  private prepareRow(
    row: SaveSellingPriceRowDto,
    index: number,
    taxRates: ReadonlyMap<string, ItemTaxRate>,
    masterRows: ReadonlyMap<string, MasterPriceRow>,
  ): PreparedRow {
    const tax = taxRates.get(row.itemId);
    const taxPerc = tax?.taxPerc ?? 0;
    const costRate = masterRows.get(this.masterKey(row))?.costRate ?? 0;
    return {
      lineNo: row.lineNo ?? index + 1,
      itemId: row.itemId,
      uomId: row.uomId,
      bucketId: row.bucketId ?? null,
      mrp: row.mrp ?? null,
      salePrice: row.salePrice ?? null,
      minPrice: row.minPrice ?? null,
      roundOff: row.roundOff ?? null,
      taxPerc,
      costRate,
      levels: row.levels.map((level) =>
        recomputeLevel(level.level as PriceLevel, level.price, taxPerc, costRate),
      ),
    };
  }

  /**
   * The headline rows' half of §5.2.
   *
   * Q26 reads `stock.stock_mrp_price` and cannot see a headline row, so the two
   * verdicts that DO apply to one are checked here against the master row's own
   * columns. ABOVE_MRP is absent on purpose: a headline row has no MRP
   * dimension to be above — that is what made it a headline row.
   *
   * Not a second implementation of anything: `ipm_min_price` and
   * `ipm_cost_price` are the only figures involved, and without this the
   * below-cost setting would silently not apply to master rows, which is the
   * same shape of hole as legacy fault #2.
   */
  private validateHeadlineRows(
    rows: readonly SaveSellingPriceRowDto[],
    taxRates: ReadonlyMap<string, ItemTaxRate>,
    masterRows: ReadonlyMap<string, MasterPriceRow>,
    identities: ReadonlyMap<string, ItemIdentity>,
  ): SellingPriceProblem[] {
    const problems: SellingPriceProblem[] = [];
    rows.forEach((row, index) => {
      const master = masterRows.get(this.masterKey(row));
      const prepared = this.prepareRow(row, index, taxRates, masterRows);
      const minPrice = row.minPrice ?? master?.minPrice ?? 0;
      for (const level of prepared.levels) {
        if (minPrice > 0 && level.price < minPrice) {
          problems.push(
            this.problem(
              prepared,
              identities,
              level.level,
              'BELOW_MIN',
              `${level.price} is below the minimum price ${minPrice}.`,
            ),
          );
          continue;
        }
        if (prepared.costRate > 0 && level.price < prepared.costRate) {
          problems.push(
            this.problem(
              prepared,
              identities,
              level.level,
              'BELOW_COST',
              `${level.price} is below the cost ${prepared.costRate}.`,
            ),
          );
        }
      }
    });
    return problems;
  }

  private problem(
    prepared: PreparedRow,
    identities: ReadonlyMap<string, ItemIdentity>,
    level: PriceLevel,
    verdict: SellingPriceProblem['verdict'],
    message: string,
  ): SellingPriceProblem {
    const identity = identities.get(prepared.itemId);
    return {
      lineNo: prepared.lineNo,
      itemId: prepared.itemId,
      itemCode: identity?.itemCode ?? null,
      itemName: identity?.itemName ?? '',
      uomId: prepared.uomId,
      bucketId: prepared.bucketId,
      level,
      verdict,
      // Prefixed with the item, because a problem list rendered against a grid
      // of four hundred rows is only useful if each line names its own row.
      message: identity ? `${identity.itemName}: ${message}` : message,
    };
  }

  /** Item code and name for the problem list. One read, only when it is needed. */
  private async loadItemIdentities(
    tx: Prisma.TransactionClient,
    itemIds: readonly string[],
  ): Promise<Map<string, ItemIdentity>> {
    const ids = [...new Set(itemIds)];
    if (!ids.length) {
      return new Map();
    }
    const records = await tx.itemMaster.findMany({
      where: { itemId: { in: ids } },
      select: { itemId: true, itemCode: true, itemNameEn: true },
    });
    return new Map(
      records.map((record) => [
        record.itemId,
        { itemCode: record.itemCode, itemName: record.itemNameEn },
      ]),
    );
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
   * §6 — the headline write, through the service that already owns the table.
   *
   * `ItemsPriceMasterService.save(rows, tx)` runs inside THIS transaction, so
   * the whole save — buckets and headlines — commits or rolls back together.
   * Nothing here touches `item_price_master` with a write of its own; the only
   * direct read is loadMasterPriceRows, which resolves the id to update.
   */
  private async fanOutHeadlineRows(
    tx: Prisma.TransactionClient,
    dto: SaveSellingPriceBulkDto,
    rows: readonly SaveSellingPriceRowDto[],
    taxRates: ReadonlyMap<string, ItemTaxRate>,
    masterRows: ReadonlyMap<string, MasterPriceRow>,
    actor: string,
  ): Promise<number> {
    if (!rows.length) {
      return 0;
    }
    const payloads = rows.map((row, index) => {
      const prepared = this.prepareRow(row, index, taxRates, masterRows);
      const existing = masterRows.get(this.masterKey(row));
      const payload: SaveItemPriceDto = {
        ...(existing ? { ipm_id: existing.ipmId } : {}),
        ipm_company_id: dto.companyId,
        // The same scope rule the buckets follow: a chain price is the row with
        // no branch, and every branch without an override reads it.
        ipm_branch_id: dto.scope === 'CHAIN' ? null : dto.branchId,
        ipm_item_id: prepared.itemId,
        // uomId IS the iuc_id — see SaveSellingPriceRowDto.uomId.
        ipm_uc_unit_id: prepared.uomId,
        ipm_profit_type: HEADLINE_PROFIT_TYPE,
        ipm_updated_by: actor,
        ...(existing ? {} : { ipm_created_by: actor }),
      };
      if (prepared.minPrice !== null) {
        payload.ipm_min_price = prepared.minPrice;
      }
      if (prepared.roundOff !== null) {
        payload.ipm_round_off = prepared.roundOff;
      }
      for (const level of prepared.levels) {
        this.applyLevelColumns(payload, level);
      }
      return payload;
    });
    const saved = await this.itemsPriceMasterService.save(payloads, tx);
    return saved.length;
  }

  /**
   * The level mapping, in ONE place. §6.
   *
   * item_price_master levels by column and stock_mrp_price does not, so the
   * mapping is not identity and every place that open-codes it is a place that
   * can write level 2's price into level 3's column.
   */
  private applyLevelColumns(payload: SaveItemPriceDto, level: SellingPriceLevelValue): void {
    // Written out rather than built from LEVEL_COLUMN_SUFFIX by string
    // concatenation, so that a renamed column is a compile error here instead
    // of a price silently landing in no column at all.
    switch (LEVEL_COLUMN_SUFFIX[level.level]) {
      case 'a':
        payload.ipm_sales_price_a = level.price;
        payload.ipm_price_a_wot = level.priceWot;
        payload.ipm_price_a_markup_perc = level.markupPerc;
        return;
      case 'b':
        payload.ipm_sales_price_b = level.price;
        payload.ipm_price_b_wot = level.priceWot;
        payload.ipm_price_b_markup_perc = level.markupPerc;
        return;
      case 'c':
        payload.ipm_sales_price_c = level.price;
        payload.ipm_price_c_wot = level.priceWot;
        payload.ipm_price_c_markup_perc = level.markupPerc;
        return;
      case 'd':
        payload.ipm_sales_price_d = level.price;
        payload.ipm_price_d_wot = level.priceWot;
        payload.ipm_price_d_markup_perc = level.markupPerc;
        return;
    }
  }

  /**
   * The existing master row for each (item, uom) in the payload.
   *
   * Two jobs, both necessary. It resolves `ipm_id` — without it the fan-out's
   * every save would CREATE, and a second save of the same screen would leave
   * the item with two headline rows and the till reading whichever sorted
   * first. And it supplies `ipm_cost_price` as the cost the §5.1 recompute
   * needs when the row has no bucket cost of its own.
   */
  private async loadMasterPriceRows(
    tx: Prisma.TransactionClient,
    dto: SaveSellingPriceBulkDto,
  ): Promise<Map<string, MasterPriceRow>> {
    const itemIds = [...new Set(dto.rows.map((row) => row.itemId))];
    const uomIds = [...new Set(dto.rows.map((row) => row.uomId))];
    const records = await tx.itemPriceMaster.findMany({
      where: {
        ipmItemId: { in: itemIds },
        ipmUcUnitId: { in: uomIds },
        ipmCompanyId: dto.companyId,
        ipmBranchId: dto.scope === 'CHAIN' ? null : dto.branchId,
        // NULL = the price applies to every godown, which is the only shape
        // this screen writes; a godown-specific row is a different price.
        ipmGodownId: null,
        ipmIsDeleted: false,
      },
      select: {
        ipmId: true,
        ipmItemId: true,
        ipmUcUnitId: true,
        ipmCostPrice: true,
        ipmMinPrice: true,
      },
    });
    const map = new Map<string, MasterPriceRow>();
    for (const record of records) {
      map.set(`${record.ipmItemId}|${record.ipmUcUnitId}`, {
        ipmId: record.ipmId,
        costRate: toNumber(record.ipmCostPrice),
        minPrice: toNumber(record.ipmMinPrice),
      });
    }
    return map;
  }

  private masterKey(row: SaveSellingPriceRowDto): string {
    return `${row.itemId}|${row.uomId}`;
  }

  /**
   * §4.3 — the tax percentage, AS OF TODAY, through item_tax_history.
   *
   * "Tax % comes from the item's tax master" is under-specified, and the
   * under-specified part is the date. `inventory.item_tax_history` is
   * date-effective, so an item whose rate changed last week has two answers and
   * only one of them is the one a price written today should be derived from.
   *
   * Resolved SERVER-SIDE and sent down (§3) rather than left to the client: a
   * client reading item_tax_master itself would use the current row on a screen
   * that, once §12's dormant effective-date columns wake up, may be writing a
   * future one.
   */
  async resolveItemTaxRates(
    tx: Prisma.TransactionClient,
    itemIds: readonly string[],
    asOf: Date = new Date(),
  ): Promise<Map<string, ItemTaxRate>> {
    const ids = [...new Set(itemIds)];
    if (!ids.length) {
      return new Map();
    }
    const asOfDate = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
    );

    const items = await tx.itemMaster.findMany({
      where: { itemId: { in: ids } },
      select: { itemId: true, itemDefaultTaxId: true, itemInclTax: true },
    });
    const history = await tx.itemTaxHistory.findMany({
      where: {
        ithItemId: { in: ids },
        ithEffectiveFrom: { lte: asOfDate },
        OR: [{ ithEffectiveTo: null }, { ithEffectiveTo: { gte: asOfDate } }],
      },
      // Latest window that covers the date wins; a history row overrides the
      // item's default, which is the whole reason the table exists.
      orderBy: [{ ithItemId: 'asc' }, { ithEffectiveFrom: 'desc' }],
      select: { ithItemId: true, ithTaxId: true },
    });
    const historyTaxId = new Map<string, string>();
    for (const row of history) {
      if (!historyTaxId.has(row.ithItemId)) {
        historyTaxId.set(row.ithItemId, row.ithTaxId);
      }
    }

    const taxIds = [
      ...new Set(
        [
          ...historyTaxId.values(),
          ...items.map((item) => item.itemDefaultTaxId).filter((id): id is string => !!id),
        ].filter(Boolean),
      ),
    ];
    const taxes = taxIds.length
      ? await tx.itemTaxMaster.findMany({
          where: { taxId: { in: taxIds } },
          select: {
            taxId: true,
            taxGstRateTotal: true,
            taxCessType: true,
            taxCessPerc: true,
            taxCessUnit: true,
          },
        })
      : [];
    const taxById = new Map(taxes.map((tax) => [tax.taxId, tax]));

    const result = new Map<string, ItemTaxRate>();
    for (const item of items) {
      const taxId = historyTaxId.get(item.itemId) ?? item.itemDefaultTaxId ?? null;
      const tax = taxId ? taxById.get(taxId) : undefined;
      result.set(item.itemId, {
        itemId: item.itemId,
        taxId,
        taxPerc: tax ? toNumber(tax.taxGstRateTotal) : 0,
        inclTax: item.itemInclTax,
        // §13.5 — cess makes the four-number panel approximate, because
        // tax_cess_unit is an amount per unit and not a percentage of price.
        // The screen is told rather than left to pretend.
        hasCess: tax
          ? tax.taxCessType !== 'NONE' ||
            toNumber(tax.taxCessPerc) > 0 ||
            toNumber(tax.taxCessUnit) > 0
          : false,
      });
    }
    return result;
  }
}
