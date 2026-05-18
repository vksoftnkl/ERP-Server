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
import { ListItemTaxQueryDto } from './dto/list-item-tax-query.dto';
import {
  ItemTaxErrorResponseDto,
  ItemTaxSuccessDeleteDto,
  ItemTaxSuccessListDto,
  ItemTaxSuccessSingleDto,
} from './dto/item-tax-response.dto';
import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemTaxExceptionFilter } from './item-tax-exception.filter';
import { ItemsTaxMasterService } from './items-tax-master.service';
import {
  ItemTaxListItem,
  ItemTaxListMeta,
  ItemTaxPayload,
  ItemTaxSuccessResponse,
} from './types/item-tax-api.types';
@ApiTags('Item Taxes')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('item-taxes')
@UseFilters(ItemTaxExceptionFilter)
export class ItemsTaxMasterController {
  constructor(private readonly itemsTaxMasterService: ItemsTaxMasterService) {}
  @Post('create')
  @Version('1')
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
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item taxes with filter/search/pagination' })
  @ApiOkResponse({ type: ItemTaxSuccessListDto })
  @ApiBadRequestResponse({ type: ItemTaxErrorResponseDto })
  async list(
    @Query() queryDto: ListItemTaxQueryDto,
  ): Promise<ItemTaxSuccessResponse<ItemTaxListItem[], ItemTaxListMeta>> {
    const result = await this.itemsTaxMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item taxes fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }
  @Get('get')
  @Version('1')
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
  @Version('1')
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
