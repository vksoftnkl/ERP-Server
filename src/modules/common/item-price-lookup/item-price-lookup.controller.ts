import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { GetItemPriceLookupQueryDto } from './dto/get-item-price-lookup-query.dto';
import {
  ItemPriceLookupErrorResponseDto,
  ItemPriceLookupPayloadDto,
  ItemPriceLookupQtyWiseRateDto,
  ItemPriceLookupSuccessSingleDto,
} from './dto/item-price-lookup-response.dto';
import { ItemPriceLookupExceptionFilter } from './item-price-lookup-exception.filter';
import { ItemPriceLookupService } from './item-price-lookup.service';
import {
  ItemPriceLookupPayload,
  ItemPriceLookupSuccessResponse,
} from './types/item-price-lookup-api.types';
import { API_VERSION } from 'src/common/constants/api-version';
@ApiTags('Item Price Lookup')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(ItemPriceLookupQtyWiseRateDto, ItemPriceLookupPayloadDto)
@CacheTTL(60)
@Controller('item-price-lookup')
@UseFilters(ItemPriceLookupExceptionFilter)
export class ItemPriceLookupController {
  constructor(private readonly itemPriceLookupService: ItemPriceLookupService) {}
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Resolve an item into a single sale-lookup row: effective price for the requested price level, tax block, stock, reorder and quantity-wise rates. unit_id selects the unit rate, else the unit-slno rule applies; customer_id applies a customer rate; acccyear scopes stock.',
  })
  @ApiQuery({ name: 'item_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'company_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branch_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'unit_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'customer_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'acccyear', required: false, schema: { type: 'string', maxLength: 9 } })
  @ApiQuery({
    name: 'price_level',
    required: false,
    schema: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
  })
  @ApiQuery({ name: 'quantity', required: false, schema: { type: 'number', minimum: 0 } })
  @ApiOkResponse({ type: ItemPriceLookupSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemPriceLookupErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceLookupErrorResponseDto })
  async getByParams(
    @Query() query: Record<string, unknown>,
  ): Promise<ItemPriceLookupSuccessResponse<ItemPriceLookupPayload>> {
    const dto = (await validateDto(query, GetItemPriceLookupQueryDto, {
      type: 'query',
    })) as GetItemPriceLookupQueryDto;
    const data = await this.itemPriceLookupService.getByParams(dto);
    return {
      success: true,
      message: 'Item price lookup fetched successfully',
      data,
    };
  }
}
