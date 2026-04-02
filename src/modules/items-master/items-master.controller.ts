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
  ItemErrorResponseDto,
  ItemSuccessDeleteDto,
  ItemSuccessListDto,
  ItemSuccessSingleDto,
} from './dto/item-response.dto';
import { ListItemQueryDto } from './dto/list-item-query.dto';
import { SaveItemDto } from './dto/save-item.dto';
import { ItemExceptionFilter } from './item-exception.filter';
import { ItemsMasterService } from './items-master.service';
import {
  ItemListItem,
  ItemListMeta,
  ItemPayload,
  ItemSuccessResponse,
} from './types/item-api.types';
@ApiTags('Items')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('items')
@UseFilters(ItemExceptionFilter)
export class ItemsMasterController {
  constructor(private readonly itemsMasterService: ItemsMasterService) {}
  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update item (by item_id presence)' })
  @ApiCreatedResponse({ type: ItemSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiConflictResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  async save(@Body() saveItemDto: SaveItemDto): Promise<ItemSuccessResponse<ItemPayload>> {
    const data = await this.itemsMasterService.save(saveItemDto);
    return {
      success: true,
      message: saveItemDto.item_id ? 'Item updated successfully' : 'Item created successfully',
      data,
    };
  }
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List items with filter/search/pagination' })
  @ApiOkResponse({ type: ItemSuccessListDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  async list(
    @Query() queryDto: ListItemQueryDto,
  ): Promise<ItemSuccessResponse<ItemListItem[], ItemListMeta>> {
    const result = await this.itemsMasterService.list(queryDto);
    return {
      success: true,
      message: 'Items fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }
  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item by id' })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  async getById(
    @Query('item_id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<ItemSuccessResponse<ItemPayload>> {
    const data = await this.itemsMasterService.getById(itemId);
    return {
      success: true,
      message: 'Item fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item by id' })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  async remove(
    @Query('item_id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<ItemSuccessResponse<{ item_id: string; deleted: true }>> {
    const data = await this.itemsMasterService.softDelete(itemId);
    return {
      success: true,
      message: 'Item deleted successfully',
      data,
    };
  }
}
