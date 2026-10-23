import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { ItemInwardHistoryQueryDto } from './dto/item-inward-history-query.dto';
import { ItemInwardHistoryService, type ItemInwardRow } from './item-inward-history.service';

@ApiTags('Stock')
@ApiBearerAuth('access-token')
@Controller('stock')
export class ItemInwardHistoryController {
  constructor(private readonly service: ItemInwardHistoryService) {}

  @Get('item-inward-history')
  @Version(API_VERSION)
  // Not cached: the next purchase must show the moment it posts.
  @CacheTTL(0)
  @ApiOperation({
    summary: "An item's last inward rows at a branch, newest first",
    description:
      'Plan 2026-10-23 §3.2 — the quick rate popup\'s "Recent inward". From stock.stock_ledger: ' +
      "inward (direction +1) rows of type OPENING or PURCHASE, a cancelled document's rows left " +
      "out. Each row: date, txn type, refno, supplier (the row's party, else its lot's), qty " +
      'and free qty in the keyed unit, base qty, cost w/o tax, tax % (cost ÷ cost w/o tax − 1), ' +
      'cost, MRP, batch. limit 1–50, default 10.',
  })
  @ApiOkResponse({ description: 'data: ItemInwardRow[]' })
  @ApiBadRequestResponse({ description: 'VALIDATION_*' })
  async list(
    @Query() q: ItemInwardHistoryQueryDto,
  ): Promise<{ success: true; message: string; data: ItemInwardRow[] }> {
    const data = await this.service.list(q);
    return { success: true, message: `${data.length} inward row(s)`, data };
  }
}
