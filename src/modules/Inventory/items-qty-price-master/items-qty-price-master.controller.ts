import { CacheTTL } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
  ItemQtyPriceDeleteResultDto,
  ItemQtyPriceErrorResponseDto,
  ItemQtyPricePayloadDto,
  ItemQtyPriceSuccessDeleteDto,
  ItemQtyPriceSuccessListDto,
  ItemQtyPriceSuccessSaveDto,
  ItemQtyPriceSuccessSingleDto,
} from './dto/item-qty-price-response.dto';
import { GetItemQtyPriceQueryDto } from './dto/get-item-qty-price-query.dto';
import { DeleteItemQtyPriceDto } from './dto/delete-item-qty-price.dto';
import { SaveItemQtyPriceDto } from './dto/save-item-qty-price.dto';
import { ItemQtyPriceExceptionFilter } from './item-qty-price-exception.filter';
import { ItemsQtyPriceMasterService } from './items-qty-price-master.service';
import {
  ItemQtyPriceDeleteResult,
  ItemQtyPriceListItem,
  ItemQtyPriceListMeta,
  ItemQtyPricePayload,
  ItemQtyPriceSuccessResponse,
} from './types/item-qty-price-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import {
  hasRequestPayload,
  validateDto,
  validateSingleOrArrayDto,
} from 'src/common/utils/request-payload-validation.util';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Item Qty Prices')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(
  SaveItemQtyPriceDto,
  DeleteItemQtyPriceDto,
  ItemQtyPricePayloadDto,
  ItemQtyPriceDeleteResultDto,
  ItemQtyPriceSuccessSingleDto,
  ItemQtyPriceSuccessListDto,
)
@CacheTTL(60)
@Controller('item-qty-prices')
@UseFilters(ItemQtyPriceExceptionFilter)
export class ItemsQtyPriceMasterController {
  constructor(private readonly itemsQtyPriceMasterService: ItemsQtyPriceMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update item qty price (by iqp_id presence)' })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SaveItemQtyPriceDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(SaveItemQtyPriceDto) },
        },
      ],
    },
  })
  @ApiCreatedResponse({ type: ItemQtyPriceSuccessSaveDto })
  @ApiBadRequestResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiConflictResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtyPriceErrorResponseDto })
  async save(
    @Body() body: unknown,
  ): Promise<ItemQtyPriceSuccessResponse<ItemQtyPricePayload | ItemQtyPricePayload[]>> {
    const saveItemQtyPriceDto = await validateSingleOrArrayDto(body, SaveItemQtyPriceDto);
    const data = await this.itemsQtyPriceMasterService.save(saveItemQtyPriceDto);
    const isArray = Array.isArray(saveItemQtyPriceDto);

    return {
      success: true,
      message: isArray
        ? 'Item qty prices saved successfully'
        : saveItemQtyPriceDto.iqp_id
          ? 'Item qty price updated successfully'
          : 'Item qty price created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get item qty price by iqp_id, or list with optional filters/pagination',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ItemQtyPriceSuccessSingleDto) },
        { $ref: getSchemaPath(ItemQtyPriceSuccessListDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtyPriceErrorResponseDto })
  async getById(
    @Query() query: Record<string, unknown>,
  ): Promise<
    | ItemQtyPriceSuccessResponse<ItemQtyPricePayload>
    | ItemQtyPriceSuccessResponse<ItemQtyPriceListItem[], ItemQtyPriceListMeta>
  > {
    const queryDto = await validateDto(query, GetItemQtyPriceQueryDto, {
      type: 'query',
    });

    if (queryDto.iqp_id) {
      const data = await this.itemsQtyPriceMasterService.getById(queryDto.iqp_id);
      return { success: true, message: 'Item qty price fetched successfully', data };
    }

    const result = await this.itemsQtyPriceMasterService.list(queryDto);
    return {
      success: true,
      message: 'Item qty prices fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete or restore item qty price by id' })
  @ApiQuery({ name: 'iqp_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({
    required: false,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeleteItemQtyPriceDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(DeleteItemQtyPriceDto) },
        },
      ],
    },
  })
  @ApiOkResponse({ type: ItemQtyPriceSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtyPriceErrorResponseDto })
  async remove(
    @Body() body: unknown,
    @Query('iqp_id') iqpId?: string,
  ): Promise<ItemQtyPriceSuccessResponse<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]>> {
    const deleteItemQtyPriceDto = await this.resolveDeletePayload(body, iqpId);
    const isArray = Array.isArray(deleteItemQtyPriceDto);
    const data = await this.itemsQtyPriceMasterService.toggleDelete(
      isArray ? deleteItemQtyPriceDto.map((item) => item.iqp_id) : deleteItemQtyPriceDto.iqp_id,
    );

    return {
      success: true,
      message: this.buildToggleDeleteMessage(data),
      data,
    };
  }

  private buildToggleDeleteMessage(
    data: ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[],
  ): string {
    if (Array.isArray(data)) {
      if (data.every((item) => item.deleted)) {
        return 'Item qty prices deleted successfully';
      }
      if (data.every((item) => !item.deleted)) {
        return 'Item qty prices restored successfully';
      }
      return 'Item qty prices updated successfully';
    }
    return data.deleted
      ? 'Item qty price deleted successfully'
      : 'Item qty price restored successfully';
  }

  private async resolveDeletePayload(
    body: unknown,
    iqpId?: string,
  ): Promise<DeleteItemQtyPriceDto | DeleteItemQtyPriceDto[]> {
    if (hasRequestPayload(body)) {
      return await validateSingleOrArrayDto(body, DeleteItemQtyPriceDto);
    }

    if (!iqpId?.trim()) {
      throw new BadRequestException({
        message: ['iqp_id is required'],
      });
    }

    return await validateDto(
      {
        iqp_id: iqpId,
      },
      DeleteItemQtyPriceDto,
      {
        type: 'query',
      },
    );
  }
}
