import {
  BadRequestException,
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
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  hasRequestPayload,
  validateDto,
  validateSingleOrArrayDto,
} from '../../common/utils/request-payload-validation.util';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  ItemPriceDeleteResultDto,
  ItemPriceErrorResponseDto,
  ItemPricePayloadDto,
  ItemPriceSuccessDeleteDto,
  ItemPriceSuccessListDto,
  ItemPriceSuccessSaveDto,
  ItemPriceSuccessSingleDto,
} from './dto/item-price-response.dto';
import { DeleteItemPriceDto } from './dto/delete-item-price.dto';
import { ListItemPriceQueryDto } from './dto/list-item-price-query.dto';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import { ItemPriceExceptionFilter } from './item-price-exception.filter';
import { ItemsPriceMasterService } from './items-price-master.service';
import {
  ItemPriceDeleteResult,
  ItemPriceListItem,
  ItemPriceListMeta,
  ItemPricePayload,
  ItemPriceSuccessResponse,
} from './types/item-price-api.types';

@ApiTags('Item Prices')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(SaveItemPriceDto, DeleteItemPriceDto, ItemPricePayloadDto, ItemPriceDeleteResultDto)
@Controller('item-prices')
@UseFilters(ItemPriceExceptionFilter)
export class ItemsPriceMasterController {
  constructor(private readonly itemsPriceMasterService: ItemsPriceMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update item price (by ipm_unit_rate_id presence)' })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SaveItemPriceDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(SaveItemPriceDto) },
        },
      ],
    },
  })
  @ApiCreatedResponse({ type: ItemPriceSuccessSaveDto })
  @ApiBadRequestResponse({ type: ItemPriceErrorResponseDto })
  @ApiConflictResponse({ type: ItemPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceErrorResponseDto })
  async save(
    @Body() body: unknown,
  ): Promise<ItemPriceSuccessResponse<ItemPricePayload | ItemPricePayload[]>> {
    const saveItemPriceDto = await validateSingleOrArrayDto(body, SaveItemPriceDto);
    const data = await this.itemsPriceMasterService.save(saveItemPriceDto);
    const isArray = Array.isArray(saveItemPriceDto);

    return {
      success: true,
      message: isArray
        ? 'Item prices saved successfully'
        : saveItemPriceDto.ipm_unit_rate_id
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
  @ApiQuery({
    name: 'ipm_unit_rate_id',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBody({
    required: false,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeleteItemPriceDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(DeleteItemPriceDto) },
        },
      ],
    },
  })
  @ApiOkResponse({ type: ItemPriceSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceErrorResponseDto })
  async remove(
    @Body() body: unknown,
    @Query('ipm_unit_rate_id') ipmUnitRateId?: string,
  ): Promise<ItemPriceSuccessResponse<ItemPriceDeleteResult | ItemPriceDeleteResult[]>> {
    const deleteItemPriceDto = await this.resolveDeletePayload(body, ipmUnitRateId);
    const isArray = Array.isArray(deleteItemPriceDto);
    const data = await this.itemsPriceMasterService.delete(
      isArray
        ? deleteItemPriceDto.map((item) => item.ipm_unit_rate_id)
        : deleteItemPriceDto.ipm_unit_rate_id,
    );

    return {
      success: true,
      message: isArray ? 'Item prices deleted successfully' : 'Item price deleted successfully',
      data,
    };
  }

  private async resolveDeletePayload(
    body: unknown,
    ipmUnitRateId?: string,
  ): Promise<DeleteItemPriceDto | DeleteItemPriceDto[]> {
    if (hasRequestPayload(body)) {
      return (await validateSingleOrArrayDto(body, DeleteItemPriceDto)) as
        | DeleteItemPriceDto
        | DeleteItemPriceDto[];
    }

    if (!ipmUnitRateId?.trim()) {
      throw new BadRequestException({
        message: ['ipm_unit_rate_id is required'],
      });
    }

    return (await validateDto(
      {
        ipm_unit_rate_id: ipmUnitRateId,
      },
      DeleteItemPriceDto,
      {
        type: 'query',
      },
    )) as DeleteItemPriceDto;
  }
}
