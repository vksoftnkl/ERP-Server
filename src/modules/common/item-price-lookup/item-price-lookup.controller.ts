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
      'Resolve an item into a single sale-lookup row: effective price for the requested price level, tax block, stock, reorder and quantity-wise rates. unit_id selects the unit rate, else the unit-slno rule applies (retail item → highest unit, else base unit); customer_id applies a customer rate to price levels 1–4; godown_id overrides the sale godown; enable_loading sums stock across all godowns; regional returns the local-language name; acccyear scopes stock.',
  })
  @ApiQuery({ name: 'item_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'company_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branch_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'unit_id',
    required: false,
    description:
      'Selects the unit rate. When omitted, the unit-slno rule applies: retail item → highest unit, else base unit (slno 0).',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'customer_id',
    required: false,
    description: 'Applies the customer rate discount to price levels 1–4 only (A/B/C/D).',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'godown_id',
    required: false,
    description: "Sale godown override. Resolves the godown row and scopes stock to this godown instead of the rate's own godown.",
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'acccyear', required: false, schema: { type: 'string', maxLength: 9 } })
  @ApiQuery({
    name: 'enable_loading',
    required: false,
    description: 'Loading mode. When true, stock is summed across ALL godowns; when false/absent it is scoped to the resolved godown.',
    schema: { type: 'boolean' },
  })
  @ApiQuery({
    name: 'regional',
    required: false,
    description: 'When true, item_name is the regional name (item_name_ta), else the English name.',
    schema: { type: 'boolean' },
  })
  @ApiQuery({
    name: 'price_level',
    required: false,
    description: '1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost (defaults to 1)',
    schema: { type: 'integer', minimum: 1, maximum: 7, default: 1 },
  })
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
