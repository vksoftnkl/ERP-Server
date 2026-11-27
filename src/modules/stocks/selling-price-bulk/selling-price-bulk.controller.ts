import { Body, Controller, Get, Param, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';
import { SellingPriceBulkExceptionFilter } from './selling-price-bulk-exception.filter';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import { ListSellingPriceQueryDto } from './dto/list-selling-price-query.dto';
import { PriceBucketsQueryDto } from './dto/price-buckets-query.dto';
import { PriceScheduleQueryDto } from './dto/price-schedule-query.dto';
import { CancelPriceScheduleDto } from './dto/cancel-price-schedule.dto';
import { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import { BackToAllBranchesDto } from './dto/back-to-all-branches.dto';
import { PurchaseLinesQueryDto } from './dto/purchase-lines-query.dto';
import { PurchaseViewSuccessDto } from './dto/purchase-lines-response.dto';
import { PurchasePriceStepService } from './purchase-price-step.service';
import {
  SellingPriceBackSuccessDto,
  SellingPriceBucketsSuccessDto,
  SellingPriceErrorResponseDto,
  SellingPriceLinesSuccessDto,
  SellingPriceSaveSuccessDto,
  SellingPriceScheduleCancelSuccessDto,
  SellingPriceScheduleSuccessDto,
} from './dto/selling-price-bulk-response.dto';
import type {
  PurchaseViewResult,
  SellingPriceBackResult,
  SellingPriceLinePageMeta,
  SellingPriceLineRow,
  SellingPriceRow,
  SellingPriceSaveResult,
  SellingPriceScheduleCancelResult,
  SellingPriceScheduleRow,
} from './types/selling-price-bulk.types';

class PriceBucketsParamDto {
  @RequiredUuid()
  itemId!: string;
}

interface SellingPriceSuccessResponse<TData> {
  success: true;
  message: string;
  data: TData;
}

/**
 * Change Selling Price (bulk) — menu 30, `CTRL+G`.
 *
 * NO `@CacheTTL` ANYWHERE IN THIS CONTROLLER, and the omission is deliberate.
 * `item-price-details` caches for 60 seconds and is right to; this screen reads
 * live stock alongside live prices and then writes them back, so a 60-second-old
 * bucket list is a save aimed at a row that has moved.
 *
 * Not a configured grid either: no grid id exists for this screen, so nothing
 * here goes through ConfiguredGridSqlService the way
 * `ItemsPriceMasterService.listPrices` does.
 *
 * ONE PRICE TABLE: every row read or written here is an
 * inventory.item_price_master row — a bucket (this item at THIS MRP) or the
 * headline (plan-nestjs-one-price-table.md §5).
 */
@ApiTags('Change Selling Price')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock')
@UseFilters(SellingPriceBulkExceptionFilter)
export class SellingPriceBulkController {
  constructor(
    private readonly sellingPriceBulkService: SellingPriceBulkService,
    /** Change Selling Price P2 — the purchase view (purchase-lines) and its save (fromPurchase). */
    private readonly purchasePriceStep: PurchasePriceStepService,
  ) {}

  @Get('price-bulk')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The price grid — the price LINES of a page of items, laid out as on the item card',
    description:
      'Change Selling Price P1 (plan 2026-11-23 §4.1 / §7.1). Needs Edit on menu 30 (403 ' +
      "STOCK_PRICE_RIGHT_EDIT: no read-only mode, O8). A branchId other than the login's own " +
      "(device branch, else the user's) is head office only (403 STOCK_PRICE_BRANCH_HQ_ONLY). " +
      'limit / offset count ITEMS: a page never splits an item (meta.count = items, meta.lines = ' +
      'lines). Per live unit: the HEADLINE (the "other MRPs" line of an MRP item) always, every ' +
      'MRP / "sold at" line in force at the branch with or without stock (the branch\'s own ' +
      'line before the All branches one), and NO_PRICE for stock whose key has no line of its ' +
      'own (priced by the headline). Every old key stays with its old meaning (costRate / ' +
      'costWot / costBasis = the stock-first cost, deprecated); new per line: lineKind, ' +
      "lineCost / lineCostWot (the line's own ipm_cost_price), stockCost / stockCostWot / " +
      'stockCostBasis (MRP landing cost or branch average × unitFactor; stockCost WITH GST = ' +
      'stockCostWot × (1 + taxPerc ÷ 100), null = none), ' +
      'otherBranchesStockCost (All branches lines: the other branches reading it, lowest – ' +
      'highest), profitType, companyId / companyName, branchId / branchName (null = All ' +
      "branches), unitFactor / unitSlNo / isDefaultUnit, and the item row's facts " +
      '(itemGroupName, taxName, trackPresetName, trackMrp, trackSalePrice, itemCompanyId, ' +
      'itemStockQty in itemStockUnit). unpricedOnly keeps the items with a NO_PRICE line. The ' +
      'filter popup keys (notes 76) are unchanged.',
  })
  @ApiOkResponse({ type: SellingPriceLinesSuccessDto })
  @ApiBadRequestResponse({ type: SellingPriceErrorResponseDto })
  @ApiForbiddenResponse({
    type: SellingPriceErrorResponseDto,
    description: 'STOCK_PRICE_RIGHT_EDIT (no Edit on menu 30) · STOCK_PRICE_BRANCH_HQ_ONLY.',
  })
  async listPrices(
    @Query() queryDto: ListSellingPriceQueryDto,
  ): Promise<
    SellingPriceSuccessResponse<{ items: SellingPriceLineRow[]; meta: SellingPriceLinePageMeta }>
  > {
    const data = await this.sellingPriceBulkService.listPriceLines(queryDto);
    return {
      success: true,
      message:
        `${data.meta.count} item${data.meta.count === 1 ? '' : 's'}, ` +
        `${data.items.length} line${data.items.length === 1 ? '' : 's'} loaded`,
      data,
    };
  }

  @Get('price-bulk/purchase-lines')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'P2 — menu 30 opened after a purchase: a posted bill\'s price lines and their chain units',
    description:
      'Change Selling Price P2 (plan 2026-11-24 §7.2, addendum 1). Rights in order: Edit on menu 30 ' +
      '(403 STOCK_PRICE_RIGHT_EDIT), View on menu 24 (403 PUR_RIGHT_VIEW), branchId the login\'s own ' +
      'unless head office (403 STOCK_PRICE_BRANCH_HQ_ONLY). 404 STOCK_PRICE_BILL_NOT_FOUND (no such ' +
      'bill at that company / branch / year); 422 STOCK_PRICE_BILL_NOT_POSTED (DRAFT / CANCELLED; ' +
      'params bill, status). Rows = every key of a P1 GET /stock/price-bulk line + fromBill {kind ' +
      'BOUGHT / CHAIN / LATER_BILL / NO_PRICE (an open list), billLines, qty, freeQty, unitName, ' +
      'rate, landedCostWot, landedCost, chainFrom, laterBill, proposed {cost, costWot, levels[{level, ' +
      'price, from BILL / RULE / KEPT}], minPrice, maxPrice}, sameAsNow, words}. Order (decision 24): ' +
      'items in the order of their first bill line; inside an item each bought line, then its chain ' +
      'units in unit order. No paging. bill {…, postedOn, postedBy, afterPurchase, reviewedOn, ' +
      'reviewedBy}; meta {items, lines, bought, chain, laterBill, noPrice, toChange, latestLines}.',
  })
  @ApiOkResponse({ type: PurchaseViewSuccessDto })
  @ApiBadRequestResponse({ type: SellingPriceErrorResponseDto })
  @ApiForbiddenResponse({
    type: SellingPriceErrorResponseDto,
    description: 'STOCK_PRICE_RIGHT_EDIT · PUR_RIGHT_VIEW · STOCK_PRICE_BRANCH_HQ_ONLY.',
  })
  @ApiNotFoundResponse({ type: SellingPriceErrorResponseDto, description: 'STOCK_PRICE_BILL_NOT_FOUND.' })
  @ApiUnprocessableEntityResponse({
    type: SellingPriceErrorResponseDto,
    description: 'STOCK_PRICE_BILL_NOT_POSTED (params bill, status).',
  })
  async purchaseLines(
    @Query() queryDto: PurchaseLinesQueryDto,
  ): Promise<SellingPriceSuccessResponse<PurchaseViewResult>> {
    const data = await this.purchasePriceStep.purchaseLines(queryDto);
    return {
      success: true,
      message:
        `${data.bill.refno}: ${data.meta.items} item${data.meta.items === 1 ? '' : 's'}, ` +
        `${data.meta.lines} line${data.meta.lines === 1 ? '' : 's'}`,
      data,
    };
  }

  @Get('price-buckets/:itemId')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'F12 — every live price row of one item this branch can see, and every unpriced stock bucket',
    description:
      "The chain rows and this branch's own, never another branch's: the headline first, " +
      'then by MRP and sale price, the chain row before the branch override of the same ' +
      'bucket. The grid shows only the row that wins at this branch; this list shows both, so ' +
      'the operator sees what an edit hides. Also every bucket with stock at this branch that ' +
      'has no row of its own (a received MRP nobody has priced yet), per unit, priced exactly as ' +
      "the grid prices it: priceSource MASTER with the headline's prices and cost, bucketId the " +
      "headline's (null when there is none). stockQty is the stock on hand for each row's own " +
      "bucket at this branch, in the row's unit. Every row carries its own values complete, so " +
      'picking one resets the client row wholesale rather than merging into what was there.',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOkResponse({ type: SellingPriceBucketsSuccessDto })
  @ApiNotFoundResponse({ type: SellingPriceErrorResponseDto })
  @ApiForbiddenResponse({
    type: SellingPriceErrorResponseDto,
    description:
      'P1: STOCK_PRICE_RIGHT_EDIT (no Edit on menu 30) · STOCK_PRICE_BRANCH_HQ_ONLY (another ' +
      'branch, not head office).',
  })
  async listBuckets(
    @Param() params: PriceBucketsParamDto,
    @Query() queryDto: PriceBucketsQueryDto,
  ): Promise<SellingPriceSuccessResponse<SellingPriceRow[]>> {
    const data = await this.sellingPriceBulkService.listBuckets(params.itemId, queryDto);
    return {
      success: true,
      message: `${data.length} price row${data.length === 1 ? '' : 's'} found`,
      data,
    };
  }

  @Post('price-bulk')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Save the changed rows — one transaction, one commit',
    description:
      'Send CHANGED rows only. Validation runs before any write; above-MRP and below-min ' +
      'always abort with 422 and the row list, while below-cost consults ' +
      'inventory.below_cost_price (restrict → 422, warning → 200 with needsConfirm, allow → ' +
      'writes and still reports). A confirmed re-post re-runs the validation, because cost ' +
      'moves when a purchase posts and the confirm is the user agreeing to the price rather ' +
      'than to a cost figure. Every row lands in inventory.item_price_master: its MRP / sale ' +
      "price are blanked by the item's stock track policy first, so a row with neither is the " +
      'headline, saved by the same statements. Two rows naming one bucket at one scope are a ' +
      '422. Missing attributes of a new bucket row (godown, cess, loading, freight, loyalty) ' +
      'are copied from the headline.',
  })
  @ApiOkResponse({ type: SellingPriceSaveSuccessDto })
  @ApiBadRequestResponse({ type: SellingPriceErrorResponseDto })
  @ApiForbiddenResponse({
    type: SellingPriceErrorResponseDto,
    description:
      "STOCK_PRICE_RIGHT_EDIT · STOCK_PRICE_BRANCH_HQ_ONLY (branchId not the login's own, not " +
      'head office) · STOCK_PRICE_CHAIN_HQ_ONLY (scope or rows[].scope CHAIN from a caller whose ' +
      'user type is not HQ; never downgraded silently).',
  })
  @ApiUnprocessableEntityResponse({
    type: SellingPriceErrorResponseDto,
    description:
      'STOCK_PRICE_ABOVE_MRP · STOCK_PRICE_BELOW_MIN · STOCK_PRICE_BELOW_COST under restrict ' +
      '(rule LINE_COST / STOCK_COST / BRANCHES, params) · STOCK_PRICE_LINE_EXISTS (isNew on a ' +
      'key already lined; params unit, mrp, branch, n; existingIpmId) · ' +
      'STOCK_PRICE_BUCKET_MRP_ZERO (isNew on an MRP item without an MRP) · ' +
      'STOCK_PRICE_DUPLICATE_BUCKET · STOCK_PRICE_UNIT_NOT_OF_ITEM.',
  })
  @ApiConflictResponse({
    type: SellingPriceErrorResponseDto,
    description:
      'ex_ipm_overlap (23P01) — another price already covers this bucket and period. P2: ' +
      'STOCK_PRICE_LATER_PURCHASE (fromPurchase; a later posted bill bought the row\'s item and key).',
  })
  @ApiNotFoundResponse({ type: SellingPriceErrorResponseDto, description: 'P2: STOCK_PRICE_BILL_NOT_FOUND (fromPurchase).' })
  async saveBulk(
    @Body() dto: SaveSellingPriceBulkDto,
  ): Promise<SellingPriceSuccessResponse<SellingPriceSaveResult>> {
    // P2 §7.3 — a save from the purchase view: P1's save + the bill checks + PRICES_REVIEWED.
    const data = dto.fromPurchase
      ? await this.purchasePriceStep.saveFromPurchase(dto)
      : await this.sellingPriceBulkService.saveBulk(dto);
    return {
      success: true,
      message: this.sellingPriceBulkService.buildSaveMessage(data),
      data,
    };
  }

  @Post('price-bulk/back-to-all-branches')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "P1 — Back to all branches · Alt+X: remove a store's own price line",
    description:
      "Change Selling Price P1 (plan 2026-11-23 §4.9 / §7.3). The branch's own line of the " +
      'key ipmId names, in force today, and its later scheduled own rows of the same key (Q5) ' +
      'are soft-deleted in one transaction — logged DELETE in the price change log with the ' +
      'reason "Back to all branches", one audit row each — so the branch reads the All ' +
      'branches price again. A stale ipmId (the item card rewrote the line) finds the live ' +
      'line by its key. Needs Edit AND Delete on menu 30 (403 STOCK_PRICE_RIGHT_EDIT / ' +
      'STOCK_PRICE_RIGHT_DELETE); a store user for his own branch only (403 ' +
      'STOCK_PRICE_BRANCH_HQ_ONLY). 422 STOCK_PRICE_BACK_NOT_OWN on an All branches line (or ' +
      "another branch's line); 422 STOCK_PRICE_BACK_NOTHING_LEFT when no All branches line " +
      'of the key and no headline would price the unit there (params item, unit, branch); 404 ' +
      'STOCK_ITEM_PRICE_NOT_FOUND for an id with no live line of its key. Answers removed, ' +
      'removedIds and nowPricedBy {lineKind, branchId, ipmId, prices[4]} — what prices the ' +
      'unit at the branch now.',
  })
  @ApiOkResponse({ type: SellingPriceBackSuccessDto })
  @ApiBadRequestResponse({ type: SellingPriceErrorResponseDto })
  @ApiForbiddenResponse({ type: SellingPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: SellingPriceErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: SellingPriceErrorResponseDto })
  async backToAllBranches(
    @Body() dto: BackToAllBranchesDto,
  ): Promise<SellingPriceSuccessResponse<SellingPriceBackResult>> {
    const data = await this.sellingPriceBulkService.backToAllBranches(dto);
    return {
      success: true,
      message: `${data.removed} own price line${data.removed === 1 ? '' : 's'} removed — the branch reads the All branches price again`,
      data,
    };
  }

  @Get('price-schedule')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Notes 140 B — the prices scheduled to start after today',
    description:
      'Every live price row this branch can see (its own and the chain rows) whose ' +
      'effectiveFrom is after today, in the price-bulk row shape plus effectiveFrom, ' +
      'effectiveTo and previous: the prices of the row it replaces — the row of the same ' +
      'key ending the day before, else what priced the bucket at this branch that day — ' +
      'so the screen can show "110 → 118 from 23-10". Levels use the tax in force on the ' +
      "day the row starts; stock and cost are today's. itemId narrows to one item.",
  })
  @ApiOkResponse({ type: SellingPriceScheduleSuccessDto })
  @ApiBadRequestResponse({ type: SellingPriceErrorResponseDto })
  async listSchedule(
    @Query() queryDto: PriceScheduleQueryDto,
  ): Promise<SellingPriceSuccessResponse<SellingPriceScheduleRow[]>> {
    const data = await this.sellingPriceBulkService.listSchedule(queryDto);
    return {
      success: true,
      message: `${data.length} scheduled price${data.length === 1 ? '' : 's'} found`,
      data,
    };
  }

  @Post('price-schedule/cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Notes 140 B — cancel a scheduled price before it starts',
    description:
      'Soft-deletes the row and gives the row before it (same key, ending the day before it ' +
      "started) the cancelled row's end back, so the price in force today simply carries on. " +
      'Both writes are audited like a price save. 409 STOCK_PRICE_SCHEDULE_STARTED when the ' +
      'row is already in force; 404 STOCK_PRICE_SCHEDULE_NOT_FOUND when there is no live row; ' +
      '403 STOCK_PRICE_CHAIN_HQ_ONLY for a chain row from a non-HQ caller.',
  })
  @ApiOkResponse({ type: SellingPriceScheduleCancelSuccessDto })
  @ApiForbiddenResponse({ type: SellingPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: SellingPriceErrorResponseDto })
  @ApiConflictResponse({ type: SellingPriceErrorResponseDto })
  async cancelSchedule(
    @Body() dto: CancelPriceScheduleDto,
  ): Promise<SellingPriceSuccessResponse<SellingPriceScheduleCancelResult>> {
    const data = await this.sellingPriceBulkService.cancelSchedule(dto.ipmId);
    return { success: true, message: 'Scheduled price cancelled', data };
  }
}
