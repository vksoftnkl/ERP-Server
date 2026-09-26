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
  ItemUnitConversionDeleteResultDto,
  ItemUnitConversionErrorResponseDto,
  ItemUnitConversionPayloadDto,
  ItemUnitConversionSuccessDeleteDto,
  ItemUnitConversionSuccessListDto,
  ItemUnitConversionSuccessSaveDto,
  ItemUnitConversionSuccessSingleDto,
} from './dto/item-unit-conversion-response.dto';
import { GetItemUnitConversionQueryDto } from './dto/get-item-unit-conversion-query.dto';
import { DeleteItemUnitConversionDto } from './dto/delete-item-unit-conversion.dto';
import { SaveItemUnitConversionDto } from './dto/save-item-unit-conversion.dto';
import { ItemUnitConversionExceptionFilter } from './item-unit-conversion-exception.filter';
import { ItemUnitConversionService } from './item-unit-conversion.service';
import {
  ItemUnitConversionDeleteResult,
  ItemUnitConversionListItem,
  ItemUnitConversionListMeta,
  ItemUnitConversionPayload,
  ItemUnitConversionSuccessResponse,
} from './types/item-unit-conversion-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import {
  hasRequestPayload,
  validateDto,
  validateSingleOrArrayDto,
} from 'src/common/utils/request-payload-validation.util';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Item Unit Conversions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(
  SaveItemUnitConversionDto,
  DeleteItemUnitConversionDto,
  ItemUnitConversionPayloadDto,
  ItemUnitConversionDeleteResultDto,
  ItemUnitConversionSuccessSingleDto,
  ItemUnitConversionSuccessListDto,
)
@CacheTTL(60)
@Controller('item-unit-conversions')
@UseFilters(ItemUnitConversionExceptionFilter)
export class ItemUnitConversionController {
  constructor(private readonly itemUnitConversionService: ItemUnitConversionService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update item unit conversion (by iuc_id presence)' })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SaveItemUnitConversionDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(SaveItemUnitConversionDto) },
        },
      ],
    },
  })
  @ApiCreatedResponse({ type: ItemUnitConversionSuccessSaveDto })
  @ApiBadRequestResponse({ type: ItemUnitConversionErrorResponseDto })
  @ApiConflictResponse({ type: ItemUnitConversionErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemUnitConversionErrorResponseDto })
  async save(
    @Body() body: unknown,
  ): Promise<
    ItemUnitConversionSuccessResponse<ItemUnitConversionPayload | ItemUnitConversionPayload[]>
  > {
    const saveDto = await validateSingleOrArrayDto(body, SaveItemUnitConversionDto);
    const data = await this.itemUnitConversionService.save(saveDto);

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
      'Get item unit conversion by iuc_id, or list with optional filters/pagination ' +
      '(iuc_item_id, iuc_is_active).',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ItemUnitConversionSuccessSingleDto) },
        { $ref: getSchemaPath(ItemUnitConversionSuccessListDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ItemUnitConversionErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemUnitConversionErrorResponseDto })
  async getById(
    @Query() query: Record<string, unknown>,
  ): Promise<
    | ItemUnitConversionSuccessResponse<ItemUnitConversionPayload>
    | ItemUnitConversionSuccessResponse<ItemUnitConversionListItem[], ItemUnitConversionListMeta>
  > {
    const queryDto = await validateDto(query, GetItemUnitConversionQueryDto, {
      type: 'query',
    });

    if (queryDto.iuc_id) {
      const data = await this.itemUnitConversionService.getById(queryDto.iuc_id);
      return { success: true, message: 'Item unit conversion fetched successfully', data };
    }

    const result = await this.itemUnitConversionService.list(queryDto);
    return {
      success: true,
      message: 'Item unit conversions fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete or restore item unit conversion by id' })
  @ApiQuery({
    name: 'iuc_id',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBody({
    required: false,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeleteItemUnitConversionDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(DeleteItemUnitConversionDto) },
        },
      ],
    },
  })
  @ApiOkResponse({ type: ItemUnitConversionSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemUnitConversionErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemUnitConversionErrorResponseDto })
  async remove(
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
  ): Promise<
    ItemUnitConversionSuccessResponse<
      ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[]
    >
  > {
    const deletePayload = await this.resolveDeletePayload(body, query);
    const data = await this.itemUnitConversionService.toggleDelete(
      Array.isArray(deletePayload)
        ? deletePayload.map((item: DeleteItemUnitConversionDto) => item.iuc_id)
        : deletePayload.iuc_id,
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
  ): Promise<DeleteItemUnitConversionDto | DeleteItemUnitConversionDto[]> {
    if (hasRequestPayload(body)) {
      return await validateSingleOrArrayDto(body, DeleteItemUnitConversionDto);
    }

    const iucId = typeof query.iuc_id === 'string' ? query.iuc_id : undefined;
    if (!iucId?.trim()) {
      throw new BadRequestException({
        message: ['iuc_id is required'],
      });
    }

    return await validateDto(
      {
        iuc_id: iucId,
      },
      DeleteItemUnitConversionDto,
      {
        type: 'query',
      },
    );
  }

  private buildSaveSuccessMessage(
    saveDto: SaveItemUnitConversionDto | SaveItemUnitConversionDto[],
  ): string {
    if (Array.isArray(saveDto)) {
      return 'Item unit conversions saved successfully';
    }

    return saveDto.iuc_id
      ? 'Item unit conversion updated successfully'
      : 'Item unit conversion created successfully';
  }

  private buildToggleDeleteMessage(
    data: ItemUnitConversionDeleteResult | ItemUnitConversionDeleteResult[],
  ): string {
    if (Array.isArray(data)) {
      if (data.every((item) => item.deleted)) {
        return 'Item unit conversions deleted successfully';
      }
      if (data.every((item) => !item.deleted)) {
        return 'Item unit conversions restored successfully';
      }
      return 'Item unit conversions updated successfully';
    }

    return data.deleted
      ? 'Item unit conversion deleted successfully'
      : 'Item unit conversion restored successfully';
  }
}
