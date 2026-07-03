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
  ItemPriceDeleteResultDto,
  ItemPriceErrorResponseDto,
  ItemPriceSuccessListDto,
  ItemPricePayloadDto,
  ItemPriceSuccessDeleteDto,
  ItemPriceSuccessSaveDto,
  ItemPriceSuccessSingleDto,
} from './dto/item-price-response.dto';
import { GetItemPriceQueryDto } from './dto/get-item-price-query.dto';
import { DeleteItemPriceDto } from './dto/delete-item-price.dto';
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
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import {
  hasRequestPayload,
  validateDto,
  validateSingleOrArrayDto,
} from 'src/common/utils/request-payload-validation.util';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Item Prices')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(
  SaveItemPriceDto,
  DeleteItemPriceDto,
  ItemPricePayloadDto,
  ItemPriceDeleteResultDto,
  ItemPriceSuccessSingleDto,
  ItemPriceSuccessListDto,
)
@CacheTTL(60)
@Controller('item-prices')
@UseFilters(ItemPriceExceptionFilter)
export class ItemsPriceMasterController {
  constructor(private readonly itemsPriceMasterService: ItemsPriceMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update item price (by ipm_id presence)' })
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
    const saveDto = await validateSingleOrArrayDto(body, SaveItemPriceDto);
    const data = await this.itemsPriceMasterService.save(saveDto);

    return {
      success: true,
      message: this.buildSaveSuccessMessage(saveDto),
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get item price by ipm_id, or list with optional filters/pagination ' +
      '(ipm_item_id, ipm_company_id, ipm_branch_id, ipm_is_active).',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ItemPriceSuccessSingleDto) },
        { $ref: getSchemaPath(ItemPriceSuccessListDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ItemPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemPriceErrorResponseDto })
  async getById(
    @Query() query: Record<string, unknown>,
  ): Promise<
    | ItemPriceSuccessResponse<ItemPricePayload>
    | ItemPriceSuccessResponse<ItemPriceListItem[], ItemPriceListMeta>
  > {
    const queryDto = await validateDto(query, GetItemPriceQueryDto, {
      type: 'query',
    });

    if (queryDto.ipm_id) {
      const data = await this.itemsPriceMasterService.getById(queryDto.ipm_id);
      return { success: true, message: 'Item price fetched successfully', data };
    }

    const result = await this.itemsPriceMasterService.listPrices(queryDto);
    return {
      success: true,
      message: 'Item prices fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete or restore item price by id' })
  @ApiQuery({
    name: 'ipm_id',
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
    @Query() query: Record<string, unknown>,
  ): Promise<ItemPriceSuccessResponse<ItemPriceDeleteResult | ItemPriceDeleteResult[]>> {
    const deletePayload = await this.resolveDeletePayload(body, query);
    const data = await this.itemsPriceMasterService.toggleDelete(
      Array.isArray(deletePayload)
        ? deletePayload.map((item: DeleteItemPriceDto) => item.ipm_id)
        : deletePayload.ipm_id,
    );

    return {
      success: true,
      message: this.buildToggleDeleteMessage(data),
      data,
    };
  }

  private async resolveDeletePayload(
    body: unknown,
    query: Record<string, unknown>,
  ): Promise<DeleteItemPriceDto | DeleteItemPriceDto[]> {
    if (hasRequestPayload(body)) {
      return await validateSingleOrArrayDto(body, DeleteItemPriceDto);
    }

    const ipmId = typeof query.ipm_id === 'string' ? query.ipm_id : undefined;
    if (!ipmId?.trim()) {
      throw new BadRequestException({
        message: ['ipm_id is required'],
      });
    }

    return await validateDto(
      {
        ipm_id: ipmId,
      },
      DeleteItemPriceDto,
      {
        type: 'query',
      },
    );
  }

  private buildSaveSuccessMessage(saveDto: SaveItemPriceDto | SaveItemPriceDto[]): string {
    if (Array.isArray(saveDto)) {
      return 'Item prices saved successfully';
    }

    return saveDto.ipm_id ? 'Item price updated successfully' : 'Item price created successfully';
  }

  private buildToggleDeleteMessage(data: ItemPriceDeleteResult | ItemPriceDeleteResult[]): string {
    if (Array.isArray(data)) {
      if (data.every((item) => item.deleted)) {
        return 'Item prices deleted successfully';
      }
      if (data.every((item) => !item.deleted)) {
        return 'Item prices restored successfully';
      }
      return 'Item prices updated successfully';
    }

    return data.deleted ? 'Item price deleted successfully' : 'Item price restored successfully';
  }
}
