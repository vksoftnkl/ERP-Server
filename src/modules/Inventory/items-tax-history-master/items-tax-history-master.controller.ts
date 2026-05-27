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
  ItemTaxHistorySuccessSingleDto,
} from './dto/item-tax-history-response.dto';
import { SaveItemTaxHistoryDto } from './dto/save-item-tax-history.dto';
import { ItemTaxHistoryExceptionFilter } from './item-tax-history-exception.filter';
import { ItemsTaxHistoryMasterService } from './items-tax-history-master.service';
import {
  ItemTaxHistoryPayload,
  ItemTaxHistorySuccessResponse,
} from './types/item-tax-history-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Item Tax History')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('item-tax-histories')
@UseFilters(ItemTaxHistoryExceptionFilter)
export class ItemsTaxHistoryMasterController {
  constructor(private readonly itemsTaxHistoryMasterService: ItemsTaxHistoryMasterService) {}
  @Post('create')
  @Version(API_VERSION)
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
  @Get('get')
  @Version(API_VERSION)
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
  @Version(API_VERSION)
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
