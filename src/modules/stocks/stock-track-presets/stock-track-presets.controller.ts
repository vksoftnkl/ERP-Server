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
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import {
  StockTrackPresetsErrorResponseDto,
  StockTrackPresetsSuccessGetDto,
} from './dto/stock-track-presets-response.dto';
import { StockTrackPresetsService } from './stock-track-presets.service';
import {
  StockTrackPresetsGetMeta,
  StockTrackPresetsPayload,
  StockTrackPresetsSuccessResponse,
} from './types/stock-track-presets-api.types';
@ApiTags('Stock Track Presets')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('stock-track-presets')
export class StockTrackPresetsController {
  constructor(private readonly stockTrackPresetsService: StockTrackPresetsService) {}
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Stock tracking presets a company may pick from — its own plus the shared ones it has not overridden. Feeds the preset combo on Item Master and Item Group Master; the chosen spt_id is what those screens save.',
  })
  @ApiOkResponse({ type: StockTrackPresetsSuccessGetDto })
  @ApiBadRequestResponse({ type: StockTrackPresetsErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTrackPresetsErrorResponseDto })
  async get(
    @Query() queryDto: GetStockTrackPresetsQueryDto,
  ): Promise<
    StockTrackPresetsSuccessResponse<StockTrackPresetsPayload[], StockTrackPresetsGetMeta>
  > {
    const result = await this.stockTrackPresetsService.get(queryDto);
    return {
      success: true,
      message: queryDto.spt_id
        ? 'Stock track preset fetched successfully'
        : 'Stock track presets fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
}
