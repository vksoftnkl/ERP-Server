import {
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
  ApiForbiddenResponse,
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
  ItemQtyPriceErrorDetail,
  ItemQtyPriceListItem,
  ItemQtyPriceListMeta,
  ItemQtyPricePayload,
  ItemQtyPriceSuccessResponse,
} from './types/item-qty-price-api.types';
import { ItemQtyPriceErrorCode } from './types/item-qty-price-error-codes';
import { throwInventoryBadRequest } from 'src/common/utils/module-service.utils';
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
@ApiForbiddenResponse({ type: ItemQtyPriceErrorResponseDto })
// No @CacheTTL since plan 2026-11-05 §4.3: every route checks the caller's
// menu 244 right, and the HTTP cache key ignores the user — a cached /get
// would answer a caller the right would refuse.
@Controller('item-qty-prices')
@UseFilters(ItemQtyPriceExceptionFilter)
export class ItemsQtyPriceMasterController {
  constructor(private readonly itemsQtyPriceMasterService: ItemsQtyPriceMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update item qty prices (array; each row updates when iqp_id is present)',
    description:
      'Menu 244 rights (plan 2026-11-05 §4.3): CREATE for a row without iqp_id, EDIT for a row ' +
      'with one (403 ITEM_QTY_PRICE_RIGHT_CREATE / _EDIT). The price level, after the save, must ' +
      'be blank or an active selling level 1–4 (422 ITEM_QTY_PRICE_LEVEL_NOT_SELLING). A slab ' +
      'for all branches (branch blank) needs a head-office user type (403 ' +
      'ITEM_QTY_PRICE_CHAIN_HQ_ONLY).',
  })
  @ApiBody({
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(SaveItemQtyPriceDto) },
    },
  })
  @ApiCreatedResponse({ type: ItemQtyPriceSuccessSaveDto })
  @ApiBadRequestResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiConflictResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtyPriceErrorResponseDto })
  async save(@Body() body: unknown): Promise<ItemQtyPriceSuccessResponse<ItemQtyPricePayload[]>> {
    const saveItemQtyPriceDtos = await this.resolveSavePayload(body);
    // Plan 2026-11-05 §4.3 (A-13 / A-14 / Q9): menu 244 CREATE for a new row,
    // EDIT for a row with iqp_id; the level blank or an active 1–4; a slab for
    // all branches from head office only.
    await this.itemsQtyPriceMasterService.assertSaveRights(saveItemQtyPriceDtos);
    await this.itemsQtyPriceMasterService.assertSellingLevelsOf(saveItemQtyPriceDtos);
    await this.itemsQtyPriceMasterService.assertChainSlabsAllowedOf(saveItemQtyPriceDtos);
    const data = await this.itemsQtyPriceMasterService.save(saveItemQtyPriceDtos);

    return {
      success: true,
      message: 'Item qty prices saved successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get item qty price by iqp_id, or list with optional filters/pagination',
    description: 'Needs VIEW on menu 244 (403 ITEM_QTY_PRICE_RIGHT_VIEW).',
  })
  @ApiQuery({ name: 'iqp_item_id', required: false, schema: { type: 'string', format: 'uuid' } })
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
    await this.itemsQtyPriceMasterService.assertRight('view', 'open Qty-wise Prices');

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
  @ApiOperation({
    summary: 'Soft delete item qty price slab(s) by id',
    description:
      'Deletes only — it is not a toggle: a slab that is already deleted is a 409 (use POST ' +
      '/item-qty-prices/restore). A batch is all-or-nothing. Needs DELETE on menu 244 (403 ' +
      'ITEM_QTY_PRICE_RIGHT_DELETE).',
  })
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
  @ApiConflictResponse({ type: ItemQtyPriceErrorResponseDto })
  async remove(
    @Body() body: unknown,
    @Query('iqp_id') iqpId?: string,
  ): Promise<ItemQtyPriceSuccessResponse<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]>> {
    const deleteItemQtyPriceDto = await this.resolveDeletePayload(body, iqpId);
    await this.itemsQtyPriceMasterService.assertRight('delete', 'remove qty-wise prices');
    const isArray = Array.isArray(deleteItemQtyPriceDto);
    const data = await this.itemsQtyPriceMasterService.softDelete(
      isArray ? deleteItemQtyPriceDto.map((item) => item.iqp_id) : deleteItemQtyPriceDto.iqp_id,
    );

    return {
      success: true,
      message: this.buildToggleDeleteMessage(data),
      data,
    };
  }

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restore soft-deleted item qty price slab(s) by id',
    description:
      '409 when a slab is not deleted, or when a live slab now holds the same key. A batch is ' +
      'all-or-nothing. Needs DELETE on menu 244 (403 ITEM_QTY_PRICE_RIGHT_DELETE).',
  })
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
  @ApiCreatedResponse({ type: ItemQtyPriceSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemQtyPriceErrorResponseDto })
  @ApiConflictResponse({ type: ItemQtyPriceErrorResponseDto })
  async restore(
    @Body() body: unknown,
    @Query('iqp_id') iqpId?: string,
  ): Promise<ItemQtyPriceSuccessResponse<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]>> {
    const deleteItemQtyPriceDto = await this.resolveDeletePayload(body, iqpId);
    await this.itemsQtyPriceMasterService.assertRight('delete', 'restore qty-wise prices');
    const isArray = Array.isArray(deleteItemQtyPriceDto);
    const data = await this.itemsQtyPriceMasterService.restore(
      isArray ? deleteItemQtyPriceDto.map((item) => item.iqp_id) : deleteItemQtyPriceDto.iqp_id,
    );

    return {
      success: true,
      message: this.buildToggleDeleteMessage(data),
      data,
    };
  }

  private async resolveSavePayload(body: unknown): Promise<SaveItemQtyPriceDto[]> {
    if (!Array.isArray(body)) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: 'request',
          code: ItemQtyPriceErrorCode.PAYLOAD_NOT_ARRAY,
          message: 'Request payload must be an array of item qty prices',
        },
      ]);
    }

    return (await validateSingleOrArrayDto(body, SaveItemQtyPriceDto)) as SaveItemQtyPriceDto[];
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
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        { field: 'iqp_id', code: ItemQtyPriceErrorCode.ID_REQUIRED, message: 'iqp_id is required' },
      ]);
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
