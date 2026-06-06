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
import { GetItemBatchStockOptionsQueryDto } from './dto/get-item-batch-stock-options-query.dto';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import { GetBulkItemStockListQueryDto } from './dto/get-bulk-item-stock-list-query.dto';
import {
  ItemBatchStockOptionSuccessListDto,
  ItemStockBalanceErrorResponseDto,
  ItemStockBalanceSuccessListDto,
} from './dto/item-stock-balance-response.dto';
import { ItemStockBalanceExceptionFilter } from './itemStockBalanceExceptionFilter';
import { ItemStockBalanceService } from './itemstockBalanceService';
import {
  BulkItemStockPayload,
  ItemBatchStockOptionPayload,
  ItemStockBalancePayload,
  ItemStockBalanceSuccessResponse,
} from './types/item-stock-balance-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Item Stock Balance')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('item-stock-balance')
@UseFilters(ItemStockBalanceExceptionFilter)
export class ItemStockBalanceController {
  constructor(private readonly itemStockBalanceService: ItemStockBalanceService) {}
  @Get('get')
  @Version(API_VERSION)
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

  @Get('bulk-list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Bulk list item stock balances with optional filters for group, brand, section, category, godown, and stock type',
  })
  @ApiOkResponse({ description: 'Bulk item stock list fetched successfully' })
  @ApiBadRequestResponse({ type: ItemStockBalanceErrorResponseDto })
  async getBulkList(
    @Query() queryDto: GetBulkItemStockListQueryDto,
  ): Promise<ItemStockBalanceSuccessResponse<BulkItemStockPayload[]>> {
    const data = await this.itemStockBalanceService.getBulkList(queryDto);
    return {
      success: true,
      message: 'Bulk item stock list fetched successfully',
      data,
    };
  }

  @Get('batch-options')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Search item batch stock options by exact acc year, company, branch, godown, item, and unit scope',
  })
  @ApiOkResponse({ type: ItemBatchStockOptionSuccessListDto })
  @ApiBadRequestResponse({ type: ItemStockBalanceErrorResponseDto })
  async getBatchOptionsByScope(
    @Query() queryDto: GetItemBatchStockOptionsQueryDto,
  ): Promise<ItemStockBalanceSuccessResponse<ItemBatchStockOptionPayload[]>> {
    const data = await this.itemStockBalanceService.getBatchOptionsByScope(queryDto);
    return {
      success: true,
      message: 'Item batch stock options fetched successfully',
      data,
    };
  }
}
