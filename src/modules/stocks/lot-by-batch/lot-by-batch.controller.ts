import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { LotByBatchQueryDto } from './dto/lot-by-batch-query.dto';
import { LotByBatchService, type LotByBatchRow } from './lot-by-batch.service';

@ApiTags('Stock')
@ApiBearerAuth('access-token')
@Controller('stock/lots')
export class LotByBatchController {
  constructor(private readonly service: LotByBatchService) {}

  @Get('by-batch')
  @Version(API_VERSION)
  // Not cached: the scan must see the stock the last bill left.
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The lots carrying a batch number, with their stock at a branch',
    description:
      'Textile plan D5 (2026-10-23) — the sale bill scans a batch label. The company’s lots whose ' +
      'batch, trimmed and upper-cased as the lot key folds it, is batchNo. Per lot: lotId, item ' +
      'id / code / name, base unit, batchNo, mrp, salePrice, status, the batch’s sizeId / ' +
      'sizeName, colourId / colourName and model (addendum 2), and the SALEABLE stock at ' +
      'branchId, in total and per godown (onHandQty, availableQty). A lot with none is left out ' +
      'unless includeEmpty=true. One row: fill the line from it; several: pick.',
  })
  @ApiOkResponse({ description: 'data: LotByBatchRow[]' })
  @ApiBadRequestResponse({ description: 'VALIDATION_*' })
  @ApiNotFoundResponse({ description: 'STOCK_BATCH_NOT_FOUND — "No stock with batch CBE26-00001"' })
  async find(
    @Query() q: LotByBatchQueryDto,
  ): Promise<{ success: true; message: string; data: LotByBatchRow[] }> {
    const data = await this.service.find(q);
    return { success: true, message: `${data.length} lot(s)`, data };
  }
}
