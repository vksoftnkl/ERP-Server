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
import { ItemPayload, ItemSuccessResponse } from './types/item-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Items')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('items')
@UseFilters(ItemExceptionFilter)
export class ItemsMasterController {
  constructor(private readonly itemsMasterService: ItemsMasterService) {}
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
  @Delete('delete')
  @Version(API_VERSION)
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
