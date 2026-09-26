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
  ApiServiceUnavailableResponse,
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
 */
@ApiTags('Change Selling Price')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiServiceUnavailableResponse({
  type: SellingPriceErrorResponseDto,
  description:
    'stock.stock_mrp_price is not deployed on this database. It ships out of band from the ' +
    'schema/stock share; every route that reads or writes a bucket answers 503 until it lands. ' +
    'A save of headline rows only (no MRP, no sale price) never touches it and works today.',
})
@Controller('stock')
@UseFilters(SellingPriceBulkExceptionFilter)
export class SellingPriceBulkController {
  constructor(private readonly sellingPriceBulkService: SellingPriceBulkService) {}

  @Get('price-bulk')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The price grid — one row per (item × uom × live bucket) with stock',
    description:
      'Items with no live bucket come back once, as priceSource = MASTER with both dimensions ' +
      'blank. Paged, because a group filter over a 40,000-row item master with four buckets ' +
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
    summary: 'F12 — every live bucket of one item',
    description:
      'A bucket is a live (MRP, sale price) pair, so an item with two MRPs and one sale price ' +
      'shows two buckets and not three. AN EMPTY LIST IS A CORRECT ANSWER: an item whose ' +
      'stock_track_policy tracks neither dimension has no bucket and cannot have one — ' +
      'ck_smp_identity refuses a (NULL, NULL) row on purpose — and its edits route to the ' +
      'headline row instead. Every row carries its own loaded values complete, so picking a ' +
      'bucket resets the client row wholesale rather than merging into what was there.',
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
      message: `${data.length} bucket${data.length === 1 ? '' : 's'} found`,
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
      'than to a cost figure. Rows with neither dimension are headline edits and land in ' +
      'inventory.item_price_master inside the same transaction.',
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
    description: 'ex_smp_overlap (23P01) — another price already covers this bucket and period.',
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
