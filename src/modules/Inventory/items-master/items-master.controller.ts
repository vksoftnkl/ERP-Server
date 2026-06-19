import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
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
import {
  ItemErrorResponseDto,
  ItemSuccessDeleteDto,
  ItemSuccessSingleDto,
} from './dto/item-response.dto';
import { SaveItemDto } from './dto/save-item.dto';
import { ItemExceptionFilter } from './item-exception.filter';
import { ItemsMasterService } from './items-master.service';
import { BulkLoadItemPayload, ItemPayload, ItemSuccessResponse } from './types/item-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Items')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('items')
@UseFilters(ItemExceptionFilter)
export class ItemsMasterController {
  constructor(private readonly itemsMasterService: ItemsMasterService) { }
  @Post('create')
  @Version(API_VERSION)
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
  @Get('get')
  @Version(API_VERSION)
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
  @Get('bulk-load')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List items with default price for bulk opening-stock load' })
  @ApiQuery({ name: 'item_company_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'item_branch_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'godown_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'item_group_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'item_brand_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'item_section_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'item_category_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'ui_table_id', required: false, description: 'UI table id for column configuration', schema: { type: 'string' } })
  @ApiQuery({ name: 'ui_column_id', required: false, description: 'UI column id for column configuration', schema: { type: 'string' } })
  @ApiOkResponse({ description: 'Bulk load items list' })
  async bulkLoad(
    @Query('item_company_id') itemCompanyId?: string,
    @Query('item_branch_id') itemBranchId?: string,
    @Query('godown_id') godownId?: string,
    @Query('item_group_id') itemGroupId?: string,
    @Query('item_brand_id') itemBrandId?: string,
    @Query('item_section_id') itemSectionId?: string,
    @Query('item_category_id') itemCategoryId?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('ui_table_id') uiTableId?: string,
    @Query('ui_column_id') uiColumnId?: string,
  ): Promise<ItemSuccessResponse<BulkLoadItemPayload[]>> {
    const data = await this.itemsMasterService.listForBulkLoad({
      itemCompanyId,
      itemBranchId,
      godownId,
      itemGroupId,
      itemBrandId,
      itemSectionId,
      itemCategoryId,
      limit,
      uiTableId,
      uiColumnId,
    });
    return { success: true, message: 'Items fetched successfully', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete or restore item by id' })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  async remove(
    @Query('item_id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<ItemSuccessResponse<{ item_id: string; deleted: boolean }>> {
    const { item_id, deleted } = await this.itemsMasterService.toggleDelete(itemId);
    return {
      success: true,
      message: deleted ? 'Item deleted successfully' : 'Item restored successfully',
      data: { item_id, deleted },
    };
  }
}
