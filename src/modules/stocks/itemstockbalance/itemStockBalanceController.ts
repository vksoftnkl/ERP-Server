import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import {
  ItemStockBalanceErrorResponseDto,
  ItemStockBalanceSuccessListDto,
} from './dto/item-stock-balance-response.dto';
import { ItemStockBalanceExceptionFilter } from './itemStockBalanceExceptionFilter';
import { ItemStockBalanceService } from './itemstockBalanceService';
import {
  ItemStockBalancePayload,
  ItemStockBalanceSuccessResponse,
} from './types/item-stock-balance-api.types';
@ApiTags('Item Stock Balance')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('item-stock-balance')
@UseFilters(ItemStockBalanceExceptionFilter)
export class ItemStockBalanceController {
  constructor(private readonly itemStockBalanceService: ItemStockBalanceService) {}
  @Get('get')
  @Version('1')
  @ApiOperation({
    summary:
      'Get item stock balance by exact acc year, company, branch, godown, item, and unit scope',
  })
  @ApiOkResponse({ type: ItemStockBalanceSuccessListDto })
  @ApiBadRequestResponse({ type: ItemStockBalanceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemStockBalanceErrorResponseDto })
  async getByScope(
    @Query() queryDto: GetItemStockBalanceQueryDto,
  ): Promise<ItemStockBalanceSuccessResponse<ItemStockBalancePayload[]>> {
    const data = await this.itemStockBalanceService.getByScope(queryDto);
    return {
      success: true,
      message: 'Item stock balance fetched successfully',
      data,
    };
  }
}