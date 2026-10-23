import { CacheTTL } from '@nestjs/cache-manager';
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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { API_VERSION } from 'src/common/constants/api-version';
import type { InventorySuccessResponse } from 'src/common/types/module-api.types';
import { SaveItemSizeDto } from './dto/save-item-size.dto';
import { ItemAttributeExceptionFilter } from './item-attribute-exception.filter';
import { ItemSizeMasterService } from './item-size-master.service';
import type { ItemAttributePayload } from './types/item-attribute-master.types';

/**
 * Textile auto batch, addendum 2 E1 — the size master. No /list: the list is a
 * registered grid (house rule).
 */
@ApiTags('Item Sizes')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('item-sizes')
@UseFilters(ItemAttributeExceptionFilter)
export class ItemSizesController {
  constructor(private readonly service: ItemSizeMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a size (by isz_id presence)',
    description:
      'A body with only isz_name (and isz_company_id) is the quick-add. A name already live in ' +
      'the company or shared is a 409 ITEM_SIZE_NAME_TAKEN whose errors[0].existingId is that row: ' +
      'the client uses it.',
  })
  @ApiCreatedResponse({ description: 'data: the row, in column names (isz_*)' })
  @ApiBadRequestResponse({ description: 'VALIDATION_*, ITEM_SIZE_COMPANY_NOT_FOUND' })
  @ApiConflictResponse({ description: 'ITEM_SIZE_NAME_TAKEN (with existingId)' })
  @ApiNotFoundResponse({ description: 'ITEM_SIZE_NOT_FOUND' })
  async save(
    @Body() dto: SaveItemSizeDto,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    const data = await this.service.save(dto);
    return {
      success: true,
      message: dto.isz_id ? 'Size updated successfully' : 'Size created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get a live size by id' })
  @ApiQuery({ name: 'isz_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'data: the row, in column names (isz_*)' })
  @ApiNotFoundResponse({ description: 'ITEM_SIZE_NOT_FOUND' })
  async getById(
    @Query('isz_id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    return {
      success: true,
      message: 'Size fetched successfully',
      data: await this.service.getById(id),
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a size',
    description:
      'Deletes only (POST /item-sizes/restore brings it back). Refused with 409 ITEM_SIZE_IN_USE ' +
      'while a batch names it — set isz_is_active false instead.',
  })
  @ApiQuery({ name: 'isz_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'data: { isz_id, deleted: true }' })
  @ApiNotFoundResponse({ description: 'ITEM_SIZE_NOT_FOUND' })
  @ApiConflictResponse({ description: 'ITEM_SIZE_IN_USE, ITEM_SIZE_ALREADY_DELETED' })
  async remove(
    @Query('isz_id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    return {
      success: true,
      message: 'Size deleted successfully',
      data: await this.service.softDelete(id),
    };
  }

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Restore a soft-deleted size' })
  @ApiQuery({ name: 'isz_id', schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'data: { isz_id, deleted: false }' })
  @ApiNotFoundResponse({ description: 'ITEM_SIZE_NOT_FOUND' })
  @ApiConflictResponse({ description: 'ITEM_SIZE_NOT_DELETED, ITEM_SIZE_NAME_TAKEN' })
  async restore(
    @Query('isz_id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    return {
      success: true,
      message: 'Size restored successfully',
      data: await this.service.restore(id),
    };
  }
}
