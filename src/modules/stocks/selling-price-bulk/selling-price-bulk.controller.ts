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
import {
  SellingPriceBucketsSuccessDto,
  SellingPriceErrorResponseDto,
  SellingPriceListSuccessDto,
  SellingPriceSaveSuccessDto,
  SellingPriceScheduleCancelSuccessDto,
  SellingPriceScheduleSuccessDto,
} from './dto/selling-price-bulk-response.dto';
import type {
  PagedResult,
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
  constructor(private readonly sellingPriceBulkService: SellingPriceBulkService) {}

  @Get('price-bulk')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The price grid — one row per (item × uom × live bucket) with stock',
    description:
      'Buckets are the (MRP, sale price) pairs of the stock on hand at the branch, blanked by ' +
      "the item's stock track policy — an item that tracks neither has one bucket, its " +
      'headline. Items with no live bucket come back once per unit as the headline, both ' +
      'dimensions blank. priceSource / priceScope / bucketId are what the price resolver ' +
      'answers: the exact bucket row before the headline, a branch row before the chain row. ' +
      "stockQty is in the row's own unit. Paged, because a group filter over a 40,000-row item master with four buckets " +
      'each is not a grid; F8 exists so the operator narrows before loading. taxPerc is ' +
      'resolved server-side as of today through item_tax_history, so the client never has to ' +
      'ask which tax row applied. itemId narrows the grid to one item (the Add item search). ' +
      'The filter popup (notes 76): search (contains, on code / name / alias / barcode), ' +
      "itemCategoryId, trackPresetId (the effective preset — own, else the group's), taxId, and " +
      'activeOnly (default true). Every row carries barcode and costWot.',
  })
  @ApiOkResponse({ type: SellingPriceListSuccessDto })
  @ApiBadRequestResponse({ type: SellingPriceErrorResponseDto })
  async listPrices(
    @Query() queryDto: ListSellingPriceQueryDto,
  ): Promise<SellingPriceSuccessResponse<PagedResult<SellingPriceRow>>> {
    const data = await this.sellingPriceBulkService.listPrices(queryDto);
    return {
      success: true,
      message: `${data.items.length} row${data.items.length === 1 ? '' : 's'} loaded`,
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
    description: 'scope: CHAIN from a caller whose user type is not HQ. Never downgraded silently.',
  })
  @ApiUnprocessableEntityResponse({ type: SellingPriceErrorResponseDto })
  @ApiConflictResponse({
    type: SellingPriceErrorResponseDto,
    description: 'ex_ipm_overlap (23P01) — another price already covers this bucket and period.',
  })
  async saveBulk(
    @Body() dto: SaveSellingPriceBulkDto,
  ): Promise<SellingPriceSuccessResponse<SellingPriceSaveResult>> {
    const data = await this.sellingPriceBulkService.saveBulk(dto);
    return {
      success: true,
      message: this.sellingPriceBulkService.buildSaveMessage(data),
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
