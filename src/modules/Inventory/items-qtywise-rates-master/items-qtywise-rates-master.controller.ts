import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ItemQtywiseRateErrorResponseDto,
  ItemQtywiseRateSuccessDeleteDto,
  ItemQtywiseRateSuccessListDto,
  ItemQtywiseRateSuccessSingleDto,
} from './dto/item-qtywise-rate-response.dto';
import { ListItemQtywiseRateQueryDto } from './dto/list-item-qtywise-rate-query.dto';
import { SaveItemQtywiseRateDto } from './dto/save-item-qtywise-rate.dto';
import { ItemQtywiseRateExceptionFilter } from './item-qtywise-rate-exception.filter';
import { ItemsQtywiseRatesMasterService } from './items-qtywise-rates-master.service';
import {
  ItemQtywiseRateListItem,
  ItemQtywiseRateListMeta,
  ItemQtywiseRatePayload,
  ItemQtywiseRateSuccessResponse,
} from './types/item-qtywise-rate-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';

@ApiTags('Item Qtywise Rates')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('item-qtywise-rates')
@UseFilters(ItemQtywiseRateExceptionFilter)
export class ItemsQtywiseRatesMasterController {
  constructor(private readonly itemsQtywiseRatesMasterService: ItemsQtywiseRatesMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update item qty-wise rate (by iqr_id presence)' })
  @ApiCreatedResponse({ type: ItemQtywiseRateSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemQtywiseRateErrorResponseDto })
  @ApiConflictResponse({ type: ItemQtywiseRateErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtywiseRateErrorResponseDto })
  async save(
    @Body() saveItemQtywiseRateDto: SaveItemQtywiseRateDto,
  ): Promise<ItemQtywiseRateSuccessResponse<ItemQtywiseRatePayload>> {
    const data = await this.itemsQtywiseRatesMasterService.save(saveItemQtywiseRateDto);

    return {
      success: true,
      message: saveItemQtywiseRateDto.iqr_id
        ? 'Item qty-wise rate updated successfully'
        : 'Item qty-wise rate created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item qty-wise rates with filter/search/pagination' })
  @ApiOkResponse({ type: ItemQtywiseRateSuccessListDto })
  @ApiBadRequestResponse({ type: ItemQtywiseRateErrorResponseDto })
  async list(
    @Query() queryDto: ListItemQtywiseRateQueryDto,
  ): Promise<ItemQtywiseRateSuccessResponse<ItemQtywiseRateListItem[], ItemQtywiseRateListMeta>> {
    const result = await this.itemsQtywiseRatesMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item qty-wise rates fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item qty-wise rate by id' })
  @ApiQuery({ name: 'iqr_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemQtywiseRateSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemQtywiseRateErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtywiseRateErrorResponseDto })
  async getById(
    @Query('iqr_id', new ParseUUIDPipe({ version: '7' })) iqrId: string,
  ): Promise<ItemQtywiseRateSuccessResponse<ItemQtywiseRatePayload>> {
    const data = await this.itemsQtywiseRatesMasterService.getById(iqrId);

    return {
      success: true,
      message: 'Item qty-wise rate fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item qty-wise rate by id' })
  @ApiQuery({ name: 'iqr_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemQtywiseRateSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemQtywiseRateErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtywiseRateErrorResponseDto })
  async remove(
    @Query('iqr_id', new ParseUUIDPipe({ version: '7' })) iqrId: string,
  ): Promise<ItemQtywiseRateSuccessResponse<{ iqr_id: string; deleted: true }>> {
    const data = await this.itemsQtywiseRatesMasterService.softDelete(iqrId);

    return {
      success: true,
      message: 'Item qty-wise rate deleted successfully',
      data,
    };
  }
}
