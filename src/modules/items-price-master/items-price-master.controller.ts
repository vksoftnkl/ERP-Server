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
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  ItemPriceErrorResponseDto,
  ItemPriceSuccessDeleteDto,
  ItemPriceSuccessListDto,
  ItemPriceSuccessSingleDto,
} from './dto/item-price-response.dto';
import { ListItemPriceQueryDto } from './dto/list-item-price-query.dto';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import { ItemPriceExceptionFilter } from './item-price-exception.filter';
import { ItemsPriceMasterService } from './items-price-master.service';
import {
  ItemPriceListItem,
  ItemPriceListMeta,
  ItemPricePayload,
  ItemPriceSuccessResponse,
} from './types/item-price-api.types';

@ApiTags('Item Prices')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('item-prices')
@UseFilters(ItemPriceExceptionFilter)
export class ItemsPriceMasterController {
  constructor(private readonly itemsPriceMasterService: ItemsPriceMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update item price (by ipm_unit_rate_id presence)' })
  @ApiCreatedResponse({ type: ItemPriceSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemPriceErrorResponseDto })
  @ApiConflictResponse({ type: ItemPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceErrorResponseDto })
  async save(
    @Body() saveItemPriceDto: SaveItemPriceDto,
  ): Promise<ItemPriceSuccessResponse<ItemPricePayload>> {
    const data = await this.itemsPriceMasterService.save(saveItemPriceDto);

    return {
      success: true,
      message: saveItemPriceDto.ipm_unit_rate_id
        ? 'Item price updated successfully'
        : 'Item price created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item prices with filter/search/pagination' })
  @ApiOkResponse({ type: ItemPriceSuccessListDto })
  @ApiBadRequestResponse({ type: ItemPriceErrorResponseDto })
  async list(
    @Query() queryDto: ListItemPriceQueryDto,
  ): Promise<ItemPriceSuccessResponse<ItemPriceListItem[], ItemPriceListMeta>> {
    const result = await this.itemsPriceMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item prices fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item price by id' })
  @ApiQuery({ name: 'ipm_unit_rate_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemPriceSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceErrorResponseDto })
  async getById(
    @Query('ipm_unit_rate_id', new ParseUUIDPipe({ version: '7' })) ipmUnitRateId: string,
  ): Promise<ItemPriceSuccessResponse<ItemPricePayload>> {
    const data = await this.itemsPriceMasterService.getById(ipmUnitRateId);

    return {
      success: true,
      message: 'Item price fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Delete item price by id' })
  @ApiQuery({ name: 'ipm_unit_rate_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemPriceSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceErrorResponseDto })
  async remove(
    @Query('ipm_unit_rate_id', new ParseUUIDPipe({ version: '7' })) ipmUnitRateId: string,
  ): Promise<ItemPriceSuccessResponse<{ ipm_unit_rate_id: string; deleted: true }>> {
    const data = await this.itemsPriceMasterService.delete(ipmUnitRateId);

    return {
      success: true,
      message: 'Item price deleted successfully',
      data,
    };
  }
}
