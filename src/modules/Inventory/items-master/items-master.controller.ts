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
  constructor(private readonly itemsMasterService: ItemsMasterService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Create or update an item, optionally with its unit conversions, prices, EAN codes and reorders',
    description:
      'Item fields are sent at the top level (create vs update by item_id presence). Optionally include ' +
      'unit_conversions[], prices[], ean_codes[] and/or reorders[] to save them in the same call. ' +
      "Each provided child collection is DIFF-SYNCED against the item's existing rows by ids or by natural " +
      'key (EAN: ean_code; conversions: iuc_unit_id; prices: ipm_company_id+ipm_branch_id+ipm_uc_unit_id, ' +
      "the price table's unique scope — ipm_godown_id is an attribute of the row, not part of its key; " +
      'reorders: ir_branch_id+ir_unit_id+ir_godown_id). A price or reorder row without its id must state ' +
      'its company/branch: an omitted one is read as null, the same as a create would store. New rows are ' +
      'created, matched rows are updated when a field differs, and existing rows absent from the payload ' +
      'are SOFT-DELETED; two payload rows with the same key are refused. On an item update an omitted top-level key ' +
      'keeps its stored value and only an explicit null clears it. Omitting a child array leaves that ' +
      'table untouched; an empty array soft-deletes all of its rows. ONE transaction: the item, then each ' +
      'child collection in dependency order (unit-conversions, prices, EAN codes, reorders); the parent ' +
      'item_id is injected into every child row.',
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
  @ApiQuery({
    name: 'item_company_id',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'item_branch_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'godown_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'item_group_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'item_brand_id', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'item_section_id',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'item_category_id',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer' } })
  @ApiQuery({
    name: 'ui_table_id',
    required: false,
    description: 'UI table id for column configuration',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'ui_column_id',
    required: false,
    description: 'UI column id for column configuration',
    schema: { type: 'string' },
  })
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
      'Soft delete an item by id, cascading to its unit conversions, prices, EAN codes, reorders and derived track policy',
    description:
      'Deletes only — it is no longer a toggle: an item that is already deleted answers 409 (use ' +
      'POST /items/restore). The item and every live child row are soft-deleted in ONE transaction, and ' +
      "the item's derived stock track policy is retired with them.",
  })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemCompositeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  @ApiConflictResponse({ type: ItemErrorResponseDto, description: 'The item is already deleted.' })
  async remove(
    @Query('item_id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<ItemSuccessResponse<ItemCompositeDeleteResult>> {
    const data = await this.itemsMasterService.softDeleteComposite(itemId);
    return { success: true, message: 'Item deleted successfully', data };
  }
  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restore a soft-deleted item and the child rows deleted with it',
    description:
      'Restores the item and ONLY the unit conversions, prices, EAN codes and reorders that were ' +
      'soft-deleted together with it (at or after its deletion instant) — rows an earlier save had ' +
      "removed stay deleted. The item's stock track policy is re-derived. One transaction. 409 when the " +
      'item is not deleted, or when its name or one of its EAN codes now belongs to another live item.',
  })
  @ApiQuery({ name: 'item_id', schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ type: ItemCompositeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemErrorResponseDto })
  @ApiConflictResponse({ type: ItemErrorResponseDto })
  async restore(
    @Query('item_id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<ItemSuccessResponse<ItemCompositeDeleteResult>> {
    const data = await this.itemsMasterService.restoreComposite(itemId);
    return { success: true, message: 'Item restored successfully', data };
  }
}
