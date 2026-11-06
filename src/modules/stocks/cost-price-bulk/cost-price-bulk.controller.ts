import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { CostPriceBulkExceptionFilter } from './cost-price-bulk-exception.filter';
import { CostPriceBulkService } from './cost-price-bulk.service';
import {
  CostBulkErrorResponseDto,
  CostBulkListSuccessDto,
  CostBulkSaveSuccessDto,
  CostBulkValidateSuccessDto,
} from './dto/cost-price-bulk-response.dto';
import { ListCostPriceBulkQueryDto } from './dto/list-cost-price-bulk-query.dto';
import { SaveCostPriceBulkDto } from './dto/save-cost-price-bulk.dto';
import type {
  CostBulkListResult,
  CostBulkSaveResult,
  CostBulkValidateResult,
} from './types/cost-price-bulk.types';

interface CostBulkSuccess<TData> {
  success: true;
  message: string;
  data: TData;
}

/**
 * Cost Price – Bulk Change — menu 298 (plan 2026-11-05 §3). Not a configured
 * grid and NOT cached: it reads live prices and writes them back, per user
 * rights and per company (a cached answer would be someone else's).
 *
 * The error filter extends Change Selling Price's (the same table, the same
 * constraints worded the same way) with a 422 for a figure a numeric column
 * cannot hold (22003).
 */
@ApiTags('Cost Price – Bulk Change')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock')
@UseFilters(CostPriceBulkExceptionFilter)
export class CostPriceBulkController {
  constructor(private readonly service: CostPriceBulkService) {}

  @Get('cost-bulk')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "The grid — one row per unit's price row in force today, of active Plain stock items",
    description:
      "Plain stock: the effective track preset (the item's own, else its group's) tracks no batch, MRP, " +
      'sale price or serial (or there is none), and item_is_batch_based is off. One row per active unit ' +
      'with a headline price row in force today at this branch — the branch row, else the all-branches ' +
      'row (priceScope CHAIN). Ordered by item name, item, iuc_unit_slno; paged by rows (limit ≤ 1000). ' +
      'leftOut (page 1 only, at most 1,000; leftOutTotal / leftOutCounts count all) names the items the ' +
      'filter matched that are not Plain stock (NOT_PLAIN_STOCK, OLD_BATCH_TICK) and the units with no price ' +
      'row (NO_PRICE_ROW); the rule filter (profitType) is not applied to it. itemId = the blank-row add: ' +
      'an item that may not load answers 422 COST_BULK_INACTIVE / COST_BULK_NOT_PLAIN_STOCK / ' +
      'COST_BULK_NO_PRICE_ROW with reasonCode and trackedAs on the error; one not there, 404 ' +
      'LOOKUP_ITEM_NOT_FOUND. Needs VIEW on menu 298 (403 COST_BULK_RIGHT_VIEW).',
  })
  @ApiOkResponse({ type: CostBulkListSuccessDto })
  @ApiBadRequestResponse({ type: CostBulkErrorResponseDto })
  @ApiForbiddenResponse({ type: CostBulkErrorResponseDto })
  @ApiNotFoundResponse({ type: CostBulkErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: CostBulkErrorResponseDto })
  async list(
    @Query() query: ListCostPriceBulkQueryDto,
  ): Promise<CostBulkSuccess<CostBulkListResult>> {
    const data = await this.service.list(query);
    return {
      success: true,
      message: `${data.total} row${data.total === 1 ? '' : 's'} · ${data.leftOutTotal} left out`,
      data,
    };
  }

  @Post('cost-bulk/validate')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'The dry run — every refusal and warning of the rows, nothing written',
    description:
      'The same checks as the save (plan §3), with no lock and no write: refusals (COST_BULK_ROW_NOT_CURRENT, ' +
      '_INACTIVE, _NOT_PLAIN_STOCK, _ROW_CHANGED, _CHAIN_NEEDS_HQ, _ABOVE_MRP, _BELOW_MIN, and _BELOW_COST ' +
      'under inventory.below_cost_price = restrict) and warnings (_BELOW_COST under warning, ' +
      '_BY_USER_PRICES_KEPT), each {code, level, message, field, line, ipmId, overridable}. ok = a save with ' +
      'these overrides would go through. Needs EDIT on menu 298 (403 COST_BULK_RIGHT_EDIT).',
  })
  @ApiOkResponse({ type: CostBulkValidateSuccessDto })
  @ApiBadRequestResponse({ type: CostBulkErrorResponseDto })
  @ApiForbiddenResponse({ type: CostBulkErrorResponseDto })
  @ApiUnprocessableEntityResponse({
    type: CostBulkErrorResponseDto,
    description: 'COST_BULK_TOO_MANY_ROWS',
  })
  async validate(
    @Body() dto: SaveCostPriceBulkDto,
  ): Promise<CostBulkSuccess<CostBulkValidateResult>> {
    const data = await this.service.validate(dto);
    return {
      success: true,
      message: data.ok
        ? 'Ready to save'
        : `${data.refusals.length} refused · ${data.warnings.length} warning${data.warnings.length === 1 ? '' : 's'}`,
      data,
    };
  }

  @Post('cost-bulk')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Save — today's rows updated in place, one transaction",
    description:
      'Locks every row (FOR UPDATE), re-runs every check of /validate, and refuses with 422 while any ' +
      'refusal, or any warning not in overrides[], remains: errors[] then lists them, and refusals[] / ' +
      'warnings[] carry the notes for NexWarningStrip. Otherwise rewrites each changed row IN PLACE through ' +
      'PriceMasterWriter: cost, cost w/o tax, MRP, Min, the rule, and the four levels (w/o tax and markup ' +
      'recomputed from the price and the new cost — price wins); round-off, period, bucket and every other ' +
      'column untouched; no stock or qty-slab table is read or written. One Price Change Log row per written ' +
      'row (source BULK_COST_CHANGE, menu 298, one change set) and one audit row under "Item Price Master", ' +
      'in the same transaction. A row equal to what is stored is not written (unchanged). At most 1,000 rows ' +
      '(422 COST_BULK_TOO_MANY_ROWS). Needs EDIT on menu 298 (403 COST_BULK_RIGHT_EDIT).',
  })
  @ApiOkResponse({ type: CostBulkSaveSuccessDto })
  @ApiBadRequestResponse({ type: CostBulkErrorResponseDto })
  @ApiForbiddenResponse({ type: CostBulkErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: CostBulkErrorResponseDto })
  async save(@Body() dto: SaveCostPriceBulkDto): Promise<CostBulkSuccess<CostBulkSaveResult>> {
    const data = await this.service.save(dto);
    return { success: true, message: this.service.buildSaveMessage(data), data };
  }
}
