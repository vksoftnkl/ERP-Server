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
  ItemTaxErrorResponseDto,
  ItemTaxSuccessDeleteDto,
  ItemTaxSuccessSingleDto,
} from './dto/item-tax-response.dto';
import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemTaxExceptionFilter } from './item-tax-exception.filter';
import { ItemsTaxMasterService } from './items-tax-master.service';
import { ItemTaxPayload, ItemTaxSuccessResponse } from './types/item-tax-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Item Taxes')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('item-taxes')
@UseFilters(ItemTaxExceptionFilter)
export class ItemsTaxMasterController {
  constructor(private readonly itemsTaxMasterService: ItemsTaxMasterService) { }
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update item tax slab (by tax_id presence)' })
  @ApiCreatedResponse({ type: ItemTaxSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemTaxErrorResponseDto })
  @ApiConflictResponse({ type: ItemTaxErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemTaxErrorResponseDto })
  async save(
    @Body() saveItemTaxDto: SaveItemTaxDto,
  ): Promise<ItemTaxSuccessResponse<ItemTaxPayload>> {
    const data = await this.itemsTaxMasterService.save(saveItemTaxDto);
    return {
      success: true,
      message: saveItemTaxDto.tax_id
        ? 'Item tax updated successfully'
        : 'Item tax created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get item tax by id' })
  @ApiQuery({ name: 'tax_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemTaxSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemTaxErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemTaxErrorResponseDto })
  async getById(
    @Query('tax_id', new ParseUUIDPipe({ version: '7' })) taxId: string,
  ): Promise<ItemTaxSuccessResponse<ItemTaxPayload>> {
    const data = await this.itemsTaxMasterService.getById(taxId);
    return {
      success: true,
      message: 'Item tax fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete item tax by id' })
  @ApiQuery({ name: 'tax_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemTaxSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemTaxErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemTaxErrorResponseDto })
  async remove(
    @Query('tax_id', new ParseUUIDPipe({ version: '7' })) taxId: string,
  ): Promise<ItemTaxSuccessResponse<{ tax_id: string; deleted: true }>> {
    const data = await this.itemsTaxMasterService.softDelete(taxId);
    return {
      success: true,
      message: 'Item tax deleted successfully',
      data,
    };
  }
}
