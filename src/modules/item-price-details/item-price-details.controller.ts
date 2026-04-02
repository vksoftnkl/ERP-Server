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
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { validateDto } from '../../common/utils/request-payload-validation.util';
import { ItemPayloadDto } from '../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../items-price-master/dto/item-price-response.dto';
import { ItemTaxPayloadDto } from '../items-tax-master/dto/item-tax-response.dto';
import { GetItemPriceDetailQueryDto } from './dto/get-item-price-detail-query.dto';
import {
  ItemPriceDetailErrorResponseDto,
  ItemPriceDetailPayloadDto,
  ItemPriceDetailSuccessSingleDto,
} from './dto/item-price-detail-response.dto';
import { ItemPriceDetailExceptionFilter } from './item-price-detail-exception.filter';
import { ItemPriceDetailsService } from './item-price-details.service';
import {
  ItemPriceDetailPayload,
  ItemPriceDetailSuccessResponse,
} from './types/item-price-detail-api.types';

@ApiTags('Item Price Details')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(ItemPayloadDto, ItemPricePayloadDto, ItemTaxPayloadDto, ItemPriceDetailPayloadDto)
@Controller('item-price-details')
@UseFilters(ItemPriceDetailExceptionFilter)
export class ItemPriceDetailsController {
  constructor(private readonly itemPriceDetailsService: ItemPriceDetailsService) {}

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item with joined item price and item tax details' })
  @ApiQuery({
    name: 'item_id',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ type: ItemPriceDetailSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemPriceDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceDetailErrorResponseDto })
  async getByItemId(
    @Query() query: Record<string, unknown>,
  ): Promise<ItemPriceDetailSuccessResponse<ItemPriceDetailPayload>> {
    const dto = (await validateDto(query, GetItemPriceDetailQueryDto, {
      type: 'query',
    })) as GetItemPriceDetailQueryDto;
    const data = await this.itemPriceDetailsService.getByItemId(dto.item_id);

    return {
      success: true,
      message: 'Item price details fetched successfully',
      data,
    };
  }
}
