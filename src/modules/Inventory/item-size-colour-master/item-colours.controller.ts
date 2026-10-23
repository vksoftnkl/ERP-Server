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
import { SaveItemColourDto } from './dto/save-item-colour.dto';
import { ItemAttributeExceptionFilter } from './item-attribute-exception.filter';
import { ItemColourMasterService } from './item-colour-master.service';
import type { ItemAttributePayload } from './types/item-attribute-master.types';

/**
 * Textile auto batch, addendum 2 E1 — the colour master. No /list: the list is a
 * registered grid (house rule).
 */
@ApiTags('Item Colours')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('item-colours')
@UseFilters(ItemAttributeExceptionFilter)
export class ItemColoursController {
  constructor(private readonly service: ItemColourMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a colour (by icl_id presence)',
    description:
      'A body with only icl_name (and icl_company_id) is the quick-add. A name already live in ' +
      'the company or shared is a 409 ITEM_COLOUR_NAME_TAKEN whose errors[0].existingId is that row: ' +
      'the client uses it.',
  })
  @ApiCreatedResponse({ description: 'data: the row, in column names (icl_*)' })
  @ApiBadRequestResponse({ description: 'VALIDATION_*, ITEM_COLOUR_COMPANY_NOT_FOUND' })
  @ApiConflictResponse({ description: 'ITEM_COLOUR_NAME_TAKEN (with existingId)' })
  @ApiNotFoundResponse({ description: 'ITEM_COLOUR_NOT_FOUND' })
  async save(
    @Body() dto: SaveItemColourDto,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    const data = await this.service.save(dto);
    return {
      success: true,
      message: dto.icl_id ? 'Colour updated successfully' : 'Colour created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get a live colour by id' })
  @ApiQuery({ name: 'icl_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'data: the row, in column names (icl_*)' })
  @ApiNotFoundResponse({ description: 'ITEM_COLOUR_NOT_FOUND' })
  async getById(
    @Query('icl_id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    return {
      success: true,
      message: 'Colour fetched successfully',
      data: await this.service.getById(id),
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a colour',
    description:
      'Deletes only (POST /item-colours/restore brings it back). Refused with 409 ITEM_COLOUR_IN_USE ' +
      'while a batch names it — set icl_is_active false instead.',
  })
  @ApiQuery({ name: 'icl_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'data: { icl_id, deleted: true }' })
  @ApiNotFoundResponse({ description: 'ITEM_COLOUR_NOT_FOUND' })
  @ApiConflictResponse({ description: 'ITEM_COLOUR_IN_USE, ITEM_COLOUR_ALREADY_DELETED' })
  async remove(
    @Query('icl_id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    return {
      success: true,
      message: 'Colour deleted successfully',
      data: await this.service.softDelete(id),
    };
  }

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Restore a soft-deleted colour' })
  @ApiQuery({ name: 'icl_id', schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'data: { icl_id, deleted: false }' })
  @ApiNotFoundResponse({ description: 'ITEM_COLOUR_NOT_FOUND' })
  @ApiConflictResponse({ description: 'ITEM_COLOUR_NOT_DELETED, ITEM_COLOUR_NAME_TAKEN' })
  async restore(
    @Query('icl_id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<InventorySuccessResponse<ItemAttributePayload>> {
    return {
      success: true,
      message: 'Colour restored successfully',
      data: await this.service.restore(id),
    };
  }
}
