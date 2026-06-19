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
  ItemUnitConversionDeleteResultDto,
  ItemPricePayloadDto,
  ItemUnitConversionPayloadDto,
  ItemPriceSuccessDeleteDto,
  ItemPriceSuccessSaveDto,
  ItemPriceSuccessSingleDto,
} from './dto/item-price-response.dto';
import { GetItemPriceQueryDto } from './dto/get-item-price-query.dto';
import { DeleteItemPriceDto } from './dto/delete-item-price.dto';
import { SaveItemPriceDto } from './dto/save-item-price.dto';
import { DeleteItemUnitConversionDto } from './dto/delete-item-unit-conversion.dto';
import { SaveItemUnitConversionDto } from './dto/save-item-unit-conversion.dto';
import { ItemPriceExceptionFilter } from './item-price-exception.filter';
import { ItemsPriceMasterService } from './items-price-master.service';
import {
  ItemPriceDeleteResult,
  ItemPriceListItem,
  ItemPriceListMeta,
  ItemPricePayload,
  ItemUnitConversionDeleteResult,
  ItemUnitConversionListItem,
  ItemUnitConversionPayload,
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
  SaveItemUnitConversionDto,
  DeleteItemPriceDto,
  DeleteItemUnitConversionDto,
  ItemPricePayloadDto,
  ItemUnitConversionPayloadDto,
  ItemPriceDeleteResultDto,
  ItemUnitConversionDeleteResultDto,
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
        { $ref: getSchemaPath(SaveItemUnitConversionDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(SaveItemUnitConversionDto) },
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
  ): Promise<
    ItemPriceSuccessResponse<
      | ItemPricePayload
      | ItemPricePayload[]
      | ItemUnitConversionPayload
      | ItemUnitConversionPayload[]
    >
  > {
    const isUnitConversionRequest = this.hasUnitConversionKeys(body);
    const saveDto = isUnitConversionRequest
      ? await validateSingleOrArrayDto(body, SaveItemUnitConversionDto)
      : await validateSingleOrArrayDto(body, SaveItemPriceDto);
    const data = isUnitConversionRequest
      ? await this.itemsPriceMasterService.saveItemUnitConversions(
          saveDto as SaveItemUnitConversionDto | SaveItemUnitConversionDto[],
        )
      : await this.itemsPriceMasterService.save(saveDto as SaveItemPriceDto | SaveItemPriceDto[]);
    const isArray = Array.isArray(saveDto);

    return {
      success: true,
      message: this.buildSaveSuccessMessage(
        isUnitConversionRequest ? 'item_unit_conversion' : 'item_price',
        saveDto,
        isArray,
      ),
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get item price/unit-conversion by id, or list with optional filters/pagination. ' +
      'Provide ipm_id for single price, iuc_id for single unit conversion, ' +
      'ipm_item_id/* for price list, iuc_item_id/* for unit conversion list.',
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
    | ItemPriceSuccessResponse<ItemPricePayload | ItemUnitConversionPayload>
    | ItemPriceSuccessResponse<ItemPriceListItem[], ItemPriceListMeta>
    | ItemPriceSuccessResponse<ItemUnitConversionListItem[], ItemPriceListMeta>
  > {
    const queryDto = (await validateDto(query, GetItemPriceQueryDto, {
      type: 'query',
    })) as GetItemPriceQueryDto;

    const hasPriceId = Boolean(queryDto.ipm_id);
    const hasUnitConversionId = Boolean(queryDto.iuc_id);

    if (hasPriceId && hasUnitConversionId) {
      throw new BadRequestException({ message: ['Provide either ipm_id or iuc_id, not both'] });
    }

    if (hasPriceId) {
      const data = await this.itemsPriceMasterService.getById(queryDto.ipm_id!);
      return { success: true, message: 'Item price fetched successfully', data };
    }

    if (hasUnitConversionId) {
      const data = await this.itemsPriceMasterService.getItemUnitConversionById(queryDto.iuc_id!);
      return { success: true, message: 'Item unit conversion fetched successfully', data };
    }

    const isUnitConversionList = Boolean(queryDto.iuc_item_id ?? queryDto.iuc_company_id);

    if (isUnitConversionList) {
      const result = await this.itemsPriceMasterService.listUnitConversions(queryDto);
      return {
        success: true,
        message: 'Item unit conversions fetched successfully',
        data: result.items,
        meta: result.meta,
      };
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
  @ApiOperation({ summary: 'Soft delete or restore item price / unit conversion by id' })
  @ApiQuery({
    name: 'ipm_id',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'iuc_id',
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
        { $ref: getSchemaPath(DeleteItemUnitConversionDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(DeleteItemUnitConversionDto) },
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
  ): Promise<
    ItemPriceSuccessResponse<
      | ItemPriceDeleteResult
      | ItemPriceDeleteResult[]
      | ItemUnitConversionDeleteResult
      | ItemUnitConversionDeleteResult[]
    >
  > {
    const deletePayload = await this.resolveDeletePayload(body, query);
    let data:
      | ItemPriceDeleteResult
      | ItemPriceDeleteResult[]
      | ItemUnitConversionDeleteResult
      | ItemUnitConversionDeleteResult[];

    if (deletePayload.kind === 'item_unit_conversion') {
      const payload = deletePayload.payload;
      data = await this.itemsPriceMasterService.toggleDeleteItemUnitConversions(
        Array.isArray(payload)
          ? payload.map((item: DeleteItemUnitConversionDto) => item.iuc_id)
          : payload.iuc_id,
      );
    } else {
      const payload = deletePayload.payload;
      data = await this.itemsPriceMasterService.toggleDelete(
        Array.isArray(payload)
          ? payload.map((item: DeleteItemPriceDto) => item.ipm_id)
          : payload.ipm_id,
      );
    }

    return {
      success: true,
      message: this.buildToggleDeleteMessage(deletePayload.kind, data),
      data,
    };
  }

  private async resolveDeletePayload(
    body: unknown,
    query: Record<string, unknown>,
  ): Promise<
    | {
        kind: 'item_price';
        payload: DeleteItemPriceDto | DeleteItemPriceDto[];
      }
    | {
        kind: 'item_unit_conversion';
        payload: DeleteItemUnitConversionDto | DeleteItemUnitConversionDto[];
      }
  > {
    if (hasRequestPayload(body)) {
      const isUnitConversionRequest = this.hasUnitConversionKeys(body);
      return isUnitConversionRequest
        ? {
            kind: 'item_unit_conversion',
            payload: (await validateSingleOrArrayDto(body, DeleteItemUnitConversionDto)) as
              | DeleteItemUnitConversionDto
              | DeleteItemUnitConversionDto[],
          }
        : {
            kind: 'item_price',
            payload: (await validateSingleOrArrayDto(body, DeleteItemPriceDto)) as
              | DeleteItemPriceDto
              | DeleteItemPriceDto[],
          };
    }

    const ipmId = typeof query.ipm_id === 'string' ? query.ipm_id : undefined;
    const iucId = typeof query.iuc_id === 'string' ? query.iuc_id : undefined;

    if (ipmId?.trim() && iucId?.trim()) {
      throw new BadRequestException({
        message: ['Provide either ipm_id or iuc_id, not both'],
      });
    }

    if (iucId?.trim()) {
      return {
        kind: 'item_unit_conversion',
        payload: (await validateDto(
          {
            iuc_id: iucId,
          },
          DeleteItemUnitConversionDto,
          {
            type: 'query',
          },
        )) as DeleteItemUnitConversionDto,
      };
    }

    if (!ipmId?.trim()) {
      throw new BadRequestException({
        message: ['ipm_id or iuc_id is required'],
      });
    }

    return {
      kind: 'item_price',
      payload: (await validateDto(
        {
          ipm_id: ipmId,
        },
        DeleteItemPriceDto,
        {
          type: 'query',
        },
      )) as DeleteItemPriceDto,
    };
  }

  private hasUnitConversionKeys(value: unknown): boolean {
    const items = Array.isArray(value) ? value : [value];
    let hasItemPriceKeys = false;
    let hasUnitConversionKeys = false;

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const keys = Object.keys(item as Record<string, unknown>);
      if (keys.some((key) => key.startsWith('ipm_'))) {
        hasItemPriceKeys = true;
      }
      if (keys.some((key) => key.startsWith('iuc_') || key === 'iul_unit_factor')) {
        hasUnitConversionKeys = true;
      }
    }

    if (hasItemPriceKeys && hasUnitConversionKeys) {
      throw new BadRequestException({
        message: ['Mixed item price and item unit conversion payloads are not supported'],
      });
    }

    return hasUnitConversionKeys;
  }

  private buildSaveSuccessMessage(
    kind: 'item_price' | 'item_unit_conversion',
    saveDto:
      | SaveItemPriceDto
      | SaveItemPriceDto[]
      | SaveItemUnitConversionDto
      | SaveItemUnitConversionDto[],
    isArray: boolean,
  ): string {
    if (kind === 'item_unit_conversion') {
      if (isArray) {
        return 'Item unit conversions saved successfully';
      }
      return (saveDto as SaveItemUnitConversionDto).iuc_id
        ? 'Item unit conversion updated successfully'
        : 'Item unit conversion created successfully';
    }

    if (isArray) {
      return 'Item prices saved successfully';
    }

    return (saveDto as SaveItemPriceDto).ipm_id
      ? 'Item price updated successfully'
      : 'Item price created successfully';
  }

  private buildToggleDeleteMessage(
    kind: 'item_price' | 'item_unit_conversion',
    data:
      | ItemPriceDeleteResult
      | ItemPriceDeleteResult[]
      | ItemUnitConversionDeleteResult
      | ItemUnitConversionDeleteResult[],
  ): string {
    const nouns =
      kind === 'item_unit_conversion'
        ? { single: 'Item unit conversion', plural: 'Item unit conversions' }
        : { single: 'Item price', plural: 'Item prices' };

    if (Array.isArray(data)) {
      if (data.every((item) => item.deleted)) {
        return `${nouns.plural} deleted successfully`;
      }
      if (data.every((item) => !item.deleted)) {
        return `${nouns.plural} restored successfully`;
      }
      return `${nouns.plural} updated successfully`;
    }

    return data.deleted
      ? `${nouns.single} deleted successfully`
      : `${nouns.single} restored successfully`;
  }
}
