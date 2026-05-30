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
  ItemEanCodeDeleteResultDto,
  ItemEanCodeErrorResponseDto,
  ItemEanCodePayloadDto,
  ItemEanCodeSuccessDeleteDto,
  ItemEanCodeSuccessListDto,
  ItemEanCodeSuccessSaveDto,
  ItemEanCodeSuccessSingleDto,
} from './dto/item-ean-code-response.dto';
import { GetItemEanCodeQueryDto } from './dto/get-item-ean-code-query.dto';
import { DeleteItemEanCodeDto } from './dto/delete-item-ean-code.dto';
import { SaveItemEanCodeDto } from './dto/save-item-ean-code.dto';
import { ItemEanCodeExceptionFilter } from './item-ean-code-exception.filter';
import { ItemsEanCodeMasterService } from './items-ean-code-master.service';
import {
  ItemEanCodeDeleteResult,
  ItemEanCodeListItem,
  ItemEanCodeListMeta,
  ItemEanCodePayload,
  ItemEanCodeSuccessResponse,
} from './types/item-ean-code-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import {
  hasRequestPayload,
  validateDto,
  validateSingleOrArrayDto,
} from 'src/common/utils/request-payload-validation.util';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Item EAN Codes')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(
  SaveItemEanCodeDto,
  DeleteItemEanCodeDto,
  ItemEanCodePayloadDto,
  ItemEanCodeDeleteResultDto,
  ItemEanCodeSuccessSingleDto,
  ItemEanCodeSuccessListDto,
)
@CacheTTL(300)
@Controller('item-ean-codes')
@UseFilters(ItemEanCodeExceptionFilter)
export class ItemsEanCodeMasterController {
  constructor(private readonly itemsEanCodeMasterService: ItemsEanCodeMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update item EAN code (by ean_id presence)' })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SaveItemEanCodeDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(SaveItemEanCodeDto) },
        },
      ],
    },
  })
  @ApiCreatedResponse({ type: ItemEanCodeSuccessSaveDto })
  @ApiBadRequestResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiConflictResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemEanCodeErrorResponseDto })
  async save(
    @Body() body: unknown,
  ): Promise<ItemEanCodeSuccessResponse<ItemEanCodePayload | ItemEanCodePayload[]>> {
    const saveItemEanCodeDto = await validateSingleOrArrayDto(body, SaveItemEanCodeDto);
    const data = await this.itemsEanCodeMasterService.save(saveItemEanCodeDto);
    const isArray = Array.isArray(saveItemEanCodeDto);

    return {
      success: true,
      message: isArray
        ? 'Item EAN codes saved successfully'
        : saveItemEanCodeDto.ean_id
          ? 'Item EAN code updated successfully'
          : 'Item EAN code created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get item EAN code by ean_id, or list with optional filters/pagination',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ItemEanCodeSuccessSingleDto) },
        { $ref: getSchemaPath(ItemEanCodeSuccessListDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemEanCodeErrorResponseDto })
  async getById(
    @Query() query: Record<string, unknown>,
  ): Promise<
    | ItemEanCodeSuccessResponse<ItemEanCodePayload>
    | ItemEanCodeSuccessResponse<ItemEanCodeListItem[], ItemEanCodeListMeta>
  > {
    const queryDto = (await validateDto(query, GetItemEanCodeQueryDto, {
      type: 'query',
    })) as GetItemEanCodeQueryDto;

    if (queryDto.ean_id) {
      const data = await this.itemsEanCodeMasterService.getById(queryDto.ean_id);
      return { success: true, message: 'Item EAN code fetched successfully', data };
    }

    const result = await this.itemsEanCodeMasterService.list(queryDto);
    return {
      success: true,
      message: 'Item EAN codes fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete item EAN code by id' })
  @ApiQuery({ name: 'ean_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({
    required: false,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeleteItemEanCodeDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(DeleteItemEanCodeDto) },
        },
      ],
    },
  })
  @ApiOkResponse({ type: ItemEanCodeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemEanCodeErrorResponseDto })
  async remove(
    @Body() body: unknown,
    @Query('ean_id') eanId?: string,
  ): Promise<ItemEanCodeSuccessResponse<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]>> {
    const deleteItemEanCodeDto = await this.resolveDeletePayload(body, eanId);
    const isArray = Array.isArray(deleteItemEanCodeDto);
    const data = await this.itemsEanCodeMasterService.softDelete(
      isArray ? deleteItemEanCodeDto.map((item) => item.ean_id) : deleteItemEanCodeDto.ean_id,
    );

    return {
      success: true,
      message: isArray
        ? 'Item EAN codes deleted successfully'
        : 'Item EAN code deleted successfully',
      data,
    };
  }

  private async resolveDeletePayload(
    body: unknown,
    eanId?: string,
  ): Promise<DeleteItemEanCodeDto | DeleteItemEanCodeDto[]> {
    if (hasRequestPayload(body)) {
      return (await validateSingleOrArrayDto(body, DeleteItemEanCodeDto)) as
        | DeleteItemEanCodeDto
        | DeleteItemEanCodeDto[];
    }

    if (!eanId?.trim()) {
      throw new BadRequestException({
        message: ['ean_id is required'],
      });
    }

    return (await validateDto(
      {
        ean_id: eanId,
      },
      DeleteItemEanCodeDto,
      {
        type: 'query',
      },
    )) as DeleteItemEanCodeDto;
  }
}
