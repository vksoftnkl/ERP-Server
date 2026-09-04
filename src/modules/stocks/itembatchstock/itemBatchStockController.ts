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
import { GetItemBatchStockQueryDto } from './dto/get-item-batch-stock-query.dto';
import {
  ItemBatchStockErrorResponseDto,
  ItemBatchStockSuccessListDto,
} from './dto/item-batch-stock-response.dto';
import { ItemBatchStockExceptionFilter } from './itemBatchStockExceptionFilter';
import { ItemBatchStockService } from './itemBatchStockService';
import {
  ItemBatchStockPayload,
  ItemBatchStockSuccessResponse,
} from './types/item-batch-stock-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Item Batch Stock')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('item-batch-stock')
@UseFilters(ItemBatchStockExceptionFilter)
export class ItemBatchStockController {
  constructor(private readonly itemBatchStockService: ItemBatchStockService) {}

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get item batch stock by exact acc year, company, branch, godown, item, and unit scope',
  })
  @ApiOkResponse({ type: ItemBatchStockSuccessListDto })
  @ApiBadRequestResponse({ type: ItemBatchStockErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemBatchStockErrorResponseDto })
  async getByScope(
    @Query() queryDto: GetItemBatchStockQueryDto,
  ): Promise<ItemBatchStockSuccessResponse<ItemBatchStockPayload[]>> {
    const data = await this.itemBatchStockService.getByScope(queryDto);
    return {
      success: true,
      message: 'Item batch stock fetched successfully',
      data,
    };
  }
}
