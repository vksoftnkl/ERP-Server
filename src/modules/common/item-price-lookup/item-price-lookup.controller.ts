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
import { ItemPayloadDto } from '../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../items-price-master/dto/item-price-response.dto';
import { GetItemPriceLookupQueryDto } from './dto/get-item-price-lookup-query.dto';
import {
  ItemPriceLookupErrorResponseDto,
  ItemPriceLookupPayloadDto,
  ItemPriceLookupSuccessSingleDto,
} from './dto/item-price-lookup-response.dto';
import { ItemPriceLookupExceptionFilter } from './item-price-lookup-exception.filter';
import { ItemPriceLookupService } from './item-price-lookup.service';
import {
  ItemPriceLookupPayload,
  ItemPriceLookupSuccessResponse,
} from './types/item-price-lookup-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Item Price Lookup')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(ItemPayloadDto, ItemPricePayloadDto, ItemPriceLookupPayloadDto)
@CacheTTL(60)
@Controller('item-price-lookup')
@UseFilters(ItemPriceLookupExceptionFilter)
export class ItemPriceLookupController {
  constructor(private readonly itemPriceLookupService: ItemPriceLookupService) {}
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get item with its price rows filtered by item, unit, branch and company',
  })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'unit_id', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branch_id', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'company_id', schema: { type: 'string', format: 'uuid' } })
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
