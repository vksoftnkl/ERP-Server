import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { GetStockAdjReasonsQueryDto } from './dto/get-stock-adj-reasons-query.dto';
import {
  StockAdjReasonsErrorResponseDto,
  StockAdjReasonsSuccessGetDto,
} from './dto/stock-adj-reasons-response.dto';
import { StockAdjReasonsService } from './stock-adj-reasons.service';
import {
  StockAdjReasonsGetMeta,
  StockAdjReasonsPayload,
  StockAdjReasonsSuccessResponse,
} from './types/stock-adj-reasons-api.types';

@ApiTags('Stock Adj Reasons')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('stock-adj-reasons')
export class StockAdjReasonsController {
  constructor(private readonly stockAdjReasonsService: StockAdjReasonsService) {}

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get stock adjustment reasons from fixed.stock_adj_reasons by sarId, sarCode, sarReasonKind or filters. Defaults to active and non-deleted.',
  })
  @ApiOkResponse({ type: StockAdjReasonsSuccessGetDto })
  @ApiBadRequestResponse({ type: StockAdjReasonsErrorResponseDto })
  @ApiNotFoundResponse({ type: StockAdjReasonsErrorResponseDto })
  async get(
    @Query() queryDto: GetStockAdjReasonsQueryDto,
  ): Promise<StockAdjReasonsSuccessResponse<StockAdjReasonsPayload[], StockAdjReasonsGetMeta>> {
    const result = await this.stockAdjReasonsService.get(queryDto);

    return {
      success: true,
      message:
        queryDto.sarId !== undefined
          ? 'Stock adjustment reason fetched successfully'
          : 'Stock adjustment reasons fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
}
