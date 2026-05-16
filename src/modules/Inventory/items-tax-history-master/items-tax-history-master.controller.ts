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
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import {
  ItemTaxHistoryErrorResponseDto,
  ItemTaxHistorySuccessDeleteDto,
  ItemTaxHistorySuccessListDto,
  ItemTaxHistorySuccessSingleDto,
} from './dto/item-tax-history-response.dto';
import { ListItemTaxHistoryQueryDto } from './dto/list-item-tax-history-query.dto';
import { SaveItemTaxHistoryDto } from './dto/save-item-tax-history.dto';
import { ItemTaxHistoryExceptionFilter } from './item-tax-history-exception.filter';
import { ItemsTaxHistoryMasterService } from './items-tax-history-master.service';
import {
  ItemTaxHistoryListItem,
  ItemTaxHistoryListMeta,
  ItemTaxHistoryPayload,
  ItemTaxHistorySuccessResponse,
} from './types/item-tax-history-api.types';
@ApiTags('Item Tax History')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(3600)
@Controller('item-tax-histories')
@UseFilters(ItemTaxHistoryExceptionFilter)
export class ItemsTaxHistoryMasterController {
  constructor(private readonly itemsTaxHistoryMasterService: ItemsTaxHistoryMasterService) {}
  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update item tax history (by ith_id presence)' })
  @ApiCreatedResponse({ type: ItemTaxHistorySuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemTaxHistoryErrorResponseDto })
  @ApiConflictResponse({ type: ItemTaxHistoryErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemTaxHistoryErrorResponseDto })
  async save(
    @Body() saveItemTaxHistoryDto: SaveItemTaxHistoryDto,
  ): Promise<ItemTaxHistorySuccessResponse<ItemTaxHistoryPayload>> {
    const data = await this.itemsTaxHistoryMasterService.save(saveItemTaxHistoryDto);
    return {
      success: true,
      message: saveItemTaxHistoryDto.ith_id
        ? 'Item tax history updated successfully'
        : 'Item tax history created successfully',
      data,
    };
  }
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item tax histories with filter/search/pagination' })
  @ApiOkResponse({ type: ItemTaxHistorySuccessListDto })
  @ApiBadRequestResponse({ type: ItemTaxHistoryErrorResponseDto })
  async list(
    @Query() queryDto: ListItemTaxHistoryQueryDto,
  ): Promise<ItemTaxHistorySuccessResponse<ItemTaxHistoryListItem[], ItemTaxHistoryListMeta>> {
    const result = await this.itemsTaxHistoryMasterService.list(queryDto);
    return {
      success: true,
      message: 'Item tax histories fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }
  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item tax history by id' })
  @ApiQuery({ name: 'ith_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemTaxHistorySuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemTaxHistoryErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemTaxHistoryErrorResponseDto })
  async getById(
    @Query('ith_id', new ParseUUIDPipe({ version: '7' })) ithId: string,
  ): Promise<ItemTaxHistorySuccessResponse<ItemTaxHistoryPayload>> {
    const data = await this.itemsTaxHistoryMasterService.getById(ithId);
    return {
      success: true,
      message: 'Item tax history fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Delete item tax history by id' })
  @ApiQuery({ name: 'ith_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemTaxHistorySuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemTaxHistoryErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemTaxHistoryErrorResponseDto })
  async remove(
    @Query('ith_id', new ParseUUIDPipe({ version: '7' })) ithId: string,
  ): Promise<ItemTaxHistorySuccessResponse<{ ith_id: string; deleted: true }>> {
    const data = await this.itemsTaxHistoryMasterService.delete(ithId);
    return {
      success: true,
      message: 'Item tax history deleted successfully',
      data,
    };
  }
}
