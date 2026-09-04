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
  ItemReorderDeleteResultDto,
  ItemReorderErrorResponseDto,
  ItemReorderPayloadDto,
  ItemReorderSuccessDeleteDto,
  ItemReorderSuccessListDto,
  ItemReorderSuccessSaveDto,
  ItemReorderSuccessSingleDto,
} from './dto/item-reorder-response.dto';
import { GetItemReorderQueryDto } from './dto/get-item-reorder-query.dto';
import { DeleteItemReorderDto } from './dto/delete-item-reorder.dto';
import { SaveItemReorderDto } from './dto/save-item-reorder.dto';
import { ItemReorderExceptionFilter } from './item-reorder-exception.filter';
import { ItemsReorderMasterService } from './items-reorder-master.service';
import {
  ItemReorderDeleteResult,
  ItemReorderListItem,
  ItemReorderListMeta,
  ItemReorderPayload,
  ItemReorderSuccessResponse,
} from './types/item-reorder-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import {
  hasRequestPayload,
  validateDto,
  validateSingleOrArrayDto,
} from 'src/common/utils/request-payload-validation.util';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Item Reorders')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(
  SaveItemReorderDto,
  DeleteItemReorderDto,
  ItemReorderPayloadDto,
  ItemReorderDeleteResultDto,
  ItemReorderSuccessSingleDto,
  ItemReorderSuccessListDto,
)
@CacheTTL(60)
@Controller('item-reorders')
@UseFilters(ItemReorderExceptionFilter)
export class ItemsReorderMasterController {
  constructor(private readonly itemsReorderMasterService: ItemsReorderMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update item reorder (by ir_id presence)' })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SaveItemReorderDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(SaveItemReorderDto) },
        },
      ],
    },
  })
  @ApiCreatedResponse({ type: ItemReorderSuccessSaveDto })
  @ApiBadRequestResponse({ type: ItemReorderErrorResponseDto })
  @ApiConflictResponse({ type: ItemReorderErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemReorderErrorResponseDto })
  async save(
    @Body() body: unknown,
  ): Promise<ItemReorderSuccessResponse<ItemReorderPayload | ItemReorderPayload[]>> {
    const saveItemReorderDto = await validateSingleOrArrayDto(body, SaveItemReorderDto);
    const data = await this.itemsReorderMasterService.save(saveItemReorderDto);
    const isArray = Array.isArray(saveItemReorderDto);

    return {
      success: true,
      message: isArray
        ? 'Item reorders saved successfully'
        : saveItemReorderDto.ir_id
          ? 'Item reorder updated successfully'
          : 'Item reorder created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get item reorder by ir_id, or list with optional filters/pagination',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ItemReorderSuccessSingleDto) },
        { $ref: getSchemaPath(ItemReorderSuccessListDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ItemReorderErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemReorderErrorResponseDto })
  async getById(
    @Query() query: Record<string, unknown>,
  ): Promise<
    | ItemReorderSuccessResponse<ItemReorderPayload>
    | ItemReorderSuccessResponse<ItemReorderListItem[], ItemReorderListMeta>
  > {
    const queryDto = (await validateDto(query, GetItemReorderQueryDto, {
      type: 'query',
    })) as GetItemReorderQueryDto;

    if (queryDto.ir_id) {
      const data = await this.itemsReorderMasterService.getById(queryDto.ir_id);
      return { success: true, message: 'Item reorder fetched successfully', data };
    }

    const result = await this.itemsReorderMasterService.list(queryDto);
    return {
      success: true,
      message: 'Item reorders fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete or restore item reorder by id' })
  @ApiQuery({ name: 'ir_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({
    required: false,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DeleteItemReorderDto) },
        {
          type: 'array',
          items: { $ref: getSchemaPath(DeleteItemReorderDto) },
        },
      ],
    },
  })
  @ApiOkResponse({ type: ItemReorderSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemReorderErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemReorderErrorResponseDto })
  async remove(
    @Body() body: unknown,
    @Query('ir_id') irId?: string,
  ): Promise<ItemReorderSuccessResponse<ItemReorderDeleteResult | ItemReorderDeleteResult[]>> {
    const deleteItemReorderDto = await this.resolveDeletePayload(body, irId);
    const isArray = Array.isArray(deleteItemReorderDto);
    const data = await this.itemsReorderMasterService.toggleDelete(
      isArray ? deleteItemReorderDto.map((item) => item.ir_id) : deleteItemReorderDto.ir_id,
    );

    return {
      success: true,
      message: this.buildToggleDeleteMessage(data),
      data,
    };
  }

  private buildToggleDeleteMessage(
    data: ItemReorderDeleteResult | ItemReorderDeleteResult[],
  ): string {
    if (Array.isArray(data)) {
      if (data.every((item) => item.deleted)) {
        return 'Item reorders deleted successfully';
      }
      if (data.every((item) => !item.deleted)) {
        return 'Item reorders restored successfully';
      }
      return 'Item reorders updated successfully';
    }
    return data.deleted
      ? 'Item reorder deleted successfully'
      : 'Item reorder restored successfully';
  }

  private async resolveDeletePayload(
    body: unknown,
    irId?: string,
  ): Promise<DeleteItemReorderDto | DeleteItemReorderDto[]> {
    if (hasRequestPayload(body)) {
      return (await validateSingleOrArrayDto(body, DeleteItemReorderDto)) as
        | DeleteItemReorderDto
        | DeleteItemReorderDto[];
    }

    if (!irId?.trim()) {
      throw new BadRequestException({
        message: ['ir_id is required'],
      });
    }

    return (await validateDto(
      {
        ir_id: irId,
      },
      DeleteItemReorderDto,
      {
        type: 'query',
      },
    )) as DeleteItemReorderDto;
  }
}
