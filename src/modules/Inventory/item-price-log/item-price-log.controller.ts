import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import {
  GetItemPriceLogQueryDto,
  ItemPriceHistoryQueryDto,
  ItemPriceLogFilterDto,
  ItemPriceLogGapsQueryDto,
  ListItemPriceLogQueryDto,
} from './dto/item-price-log-query.dto';
import {
  ItemPriceLogService,
  type PriceLogDay,
  type PriceLogDetail,
  type PriceLogGaps,
  type PriceLogRow,
} from './item-price-log.service';

type Envelope<T> = { success: true; message: string; data: T };

const RIGHT = 'Needs um_can_view on menu 290 (Price Change Log); 403 IPCL_RIGHT_VIEW otherwise.';

/**
 * Notes 144 / plan §3 — the Price Change Log report's routes. Read-only, and
 * never cached: the log grows all day, and the HTTP cache key carries no user.
 */
@ApiTags('Item Price Log')
@ApiBearerAuth('access-token')
@Controller('item-price-log')
export class ItemPriceLogController {
  constructor(private readonly service: ItemPriceLogService) {}

  @Get('list')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Every price change in a range, newest first, paged',
    description:
      'One row per changed price row (IPM item_price_master) or qty slab (IQP item_qty_price): ' +
      'who, when, where from, the source screen, the scope, the old / new headline figures, and ' +
      '(notes 145) fields[]: every changed column with its label and value before → after, ' +
      'price first then its w/o-tax and markup companions. Optional deviceId, and field (a ' +
      'column name, e.g. ipm_sales_price_b: only the changes that touched it). ' +
      'A company sees its shared prices too, a branch the all-branches ones. ' +
      `fromDate / toDate are IST days, at most 366 apart. ${RIGHT}`,
  })
  @ApiOkResponse({ description: 'items and meta { page, limit, total }.' })
  @ApiBadRequestResponse({ description: 'VALIDATION_* or IPCL_BAD_RANGE.' })
  @ApiForbiddenResponse({ description: 'IPCL_RIGHT_VIEW.' })
  async list(
    @Query() q: ListItemPriceLogQueryDto,
  ): Promise<
    Envelope<{ items: PriceLogRow[]; meta: { page: number; limit: number; total: number } }>
  > {
    const data = await this.service.list(q);
    return { success: true, message: `${data.meta.total} price change(s)`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One price change, with the row before and after and a labelled diff',
    description: `fields[] names each changed column with its report label. ${RIGHT}`,
  })
  @ApiNotFoundResponse({ description: 'IPCL_NOT_FOUND.' })
  @ApiForbiddenResponse({ description: 'IPCL_RIGHT_VIEW.' })
  async get(@Query() q: GetItemPriceLogQueryDto): Promise<Envelope<PriceLogDetail>> {
    const data = await this.service.get(q);
    return { success: true, message: `${data.itemName ?? data.itemId}: ${data.action}`, data };
  }

  @Get('days')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Price changes per day in a range',
    description: `The same filters as /list. Per day: changes, price rows, slabs, items, users, saves. ${RIGHT}`,
  })
  @ApiForbiddenResponse({ description: 'IPCL_RIGHT_VIEW.' })
  async days(@Query() q: ItemPriceLogFilterDto): Promise<Envelope<PriceLogDay[]>> {
    const data = await this.service.days(q);
    return { success: true, message: `${data.length} day(s) with price changes`, data };
  }

  @Get('item-history')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One item’s price changes, newest first',
    description: `Across every scope unless companyId / branchId / priceTable narrow it. ${RIGHT}`,
  })
  @ApiForbiddenResponse({ description: 'IPCL_RIGHT_VIEW.' })
  async itemHistory(@Query() q: ItemPriceHistoryQueryDto): Promise<Envelope<PriceLogRow[]>> {
    const data = await this.service.itemHistory(q);
    return { success: true, message: `${data.length} price change(s)`, data };
  }

  @Get('gaps')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The gap count: price rows changed without a log row',
    description:
      'Plan §2.6. Every price row touched since the log began is compared with its latest log ' +
      'row: NOT_LOGGED (no log row) or DIFFERS (the row is not what its last log row says). ' +
      `0 is the healthy answer. ${RIGHT}`,
  })
  @ApiForbiddenResponse({ description: 'IPCL_RIGHT_VIEW.' })
  async gaps(@Query() q: ItemPriceLogGapsQueryDto): Promise<Envelope<PriceLogGaps>> {
    const data = await this.service.gaps(q);
    return {
      success: true,
      message: data.total ? `${data.total} price row(s) changed without a log row` : 'No gaps',
      data,
    };
  }
}
