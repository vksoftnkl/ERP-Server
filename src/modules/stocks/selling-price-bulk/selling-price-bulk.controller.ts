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
import { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import {
  SellingPriceBucketsSuccessDto,
  SellingPriceErrorResponseDto,
  SellingPriceListSuccessDto,
  SellingPriceSaveSuccessDto,
} from './dto/selling-price-bulk-response.dto';
import type {
  PagedResult,
  SellingPriceRow,
  SellingPriceSaveResult,
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
      'ask which tax row applied.',
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
    summary: 'F12 — every live price row of one item this branch can see',
    description:
      "The chain rows and this branch's own, never another branch's: the headline first, " +
      'then by MRP and sale price, the chain row before the branch override of the same ' +
      'bucket. The grid shows only the row that wins at this branch; this list shows both, so ' +
      "the operator sees what an edit hides. stockQty is the stock on hand for each row's own " +
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
}
