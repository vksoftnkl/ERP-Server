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
import { ItemErrorResponseDto } from './dto/item-response.dto';
import {
  ItemCompositeSuccessDeleteDto,
  ItemCompositeSuccessSingleDto,
} from './dto/item-composite-response.dto';
import { SaveItemCompositeDto } from './dto/save-item-composite.dto';
import { ItemExceptionFilter } from './item-exception.filter';
import { ItemsMasterService } from './items-master.service';
import { BulkLoadItemPayload, ItemSuccessResponse } from './types/item-api.types';
import { ItemCompositeDeleteResult, ItemCompositePayload } from './types/item-composite-api.types';
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
  @ApiOperation({
    summary:
      'Create or update an item, optionally with its unit conversions, prices, EAN codes and reorders',
    description:
      'Item fields are sent at the top level (create vs update by item_id presence). Optionally include ' +
      'unit_conversions[], prices[], ean_codes[] and/or reorders[] to save them in the same call. ' +
      'Saving is NON-ATOMIC: the item is saved first, then each child collection in dependency order ' +
      '(unit-conversions, prices, EAN codes, reorders); the parent item_id is injected into every child ' +
      'row. Rows absent from the payload are not deleted.',
  })
  @ApiCreatedResponse({ type: ItemCompositeSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiConflictResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  async save(
    @Body() saveItemDto: SaveItemCompositeDto,
  ): Promise<ItemSuccessResponse<ItemCompositePayload>> {
    const data = await this.itemsMasterService.saveComposite(saveItemDto);
    return {
      success: true,
      message: saveItemDto.item_id ? 'Item updated successfully' : 'Item created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get an item by id with its unit conversions, prices, EAN codes and reorders',
  })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemCompositeSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  async getById(
    @Query('item_id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<ItemSuccessResponse<ItemCompositePayload>> {
    const data = await this.itemsMasterService.getComposite(itemId);
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
  @ApiOperation({
    summary:
      'Soft delete or restore an item by id, cascading to its unit conversions, prices, EAN codes and reorders',
    description:
      'Toggles the item (delete if active, restore if deleted), then cascades the same target state to ' +
      'all of its child rows: children currently in the item\'s old state are flipped, children already ' +
      'in the target state are left untouched. NON-ATOMIC: the item is toggled first, then each child ' +
      'collection in its own transaction.',
  })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemCompositeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  async remove(
    @Query('item_id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<ItemSuccessResponse<ItemCompositeDeleteResult>> {
    const data = await this.itemsMasterService.toggleDeleteComposite(itemId);
    return {
      success: true,
      message: data.item.deleted ? 'Item deleted successfully' : 'Item restored successfully',
      data,
    };
  }
}