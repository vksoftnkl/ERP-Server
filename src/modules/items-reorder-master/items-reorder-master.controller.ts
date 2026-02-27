import {
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  ItemReorderErrorResponseDto,
  ItemReorderSuccessDeleteDto,
  ItemReorderSuccessListDto,
  ItemReorderSuccessSingleDto,
} from './dto/item-reorder-response.dto';
import { ListItemReorderQueryDto } from './dto/list-item-reorder-query.dto';
import { SaveItemReorderDto } from './dto/save-item-reorder.dto';
import { ItemReorderExceptionFilter } from './item-reorder-exception.filter';
import { ItemsReorderMasterService } from './items-reorder-master.service';
import {
  ItemReorderListItem,
  ItemReorderListMeta,
  ItemReorderPayload,
  ItemReorderSuccessResponse,
} from './types/item-reorder-api.types';

@ApiTags('Item Reorders')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('item-reorders')
@UseFilters(ItemReorderExceptionFilter)
export class ItemsReorderMasterController {
  constructor(private readonly itemsReorderMasterService: ItemsReorderMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update item reorder (by ir_id presence)' })
  @ApiCreatedResponse({ type: ItemReorderSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemReorderErrorResponseDto })
  @ApiConflictResponse({ type: ItemReorderErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemReorderErrorResponseDto })
  async save(
    @Body() saveItemReorderDto: SaveItemReorderDto,
  ): Promise<ItemReorderSuccessResponse<ItemReorderPayload>> {
    const data = await this.itemsReorderMasterService.save(saveItemReorderDto);

    return {
      success: true,
      message: saveItemReorderDto.ir_id
        ? 'Item reorder updated successfully'
        : 'Item reorder created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item reorders with filter/search/pagination' })
  @ApiOkResponse({ type: ItemReorderSuccessListDto })
  @ApiBadRequestResponse({ type: ItemReorderErrorResponseDto })
  async list(
    @Query() queryDto: ListItemReorderQueryDto,
  ): Promise<ItemReorderSuccessResponse<ItemReorderListItem[], ItemReorderListMeta>> {
    const result = await this.itemsReorderMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item reorders fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item reorder by id' })
  @ApiQuery({ name: 'ir_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemReorderSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemReorderErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemReorderErrorResponseDto })
  async getById(
    @Query('ir_id', new ParseUUIDPipe({ version: '7' })) irId: string,
  ): Promise<ItemReorderSuccessResponse<ItemReorderPayload>> {
    const data = await this.itemsReorderMasterService.getById(irId);

    return {
      success: true,
      message: 'Item reorder fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item reorder by id' })
  @ApiQuery({ name: 'ir_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemReorderSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemReorderErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemReorderErrorResponseDto })
  async remove(
    @Query('ir_id', new ParseUUIDPipe({ version: '7' })) irId: string,
  ): Promise<ItemReorderSuccessResponse<{ ir_id: string; deleted: true }>> {
    const data = await this.itemsReorderMasterService.softDelete(irId);

    return {
      success: true,
      message: 'Item reorder deleted successfully',
      data,
    };
  }
}
