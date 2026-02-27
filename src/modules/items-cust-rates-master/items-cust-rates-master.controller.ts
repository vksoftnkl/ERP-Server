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
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  ItemCustRateErrorResponseDto,
  ItemCustRateSuccessDeleteDto,
  ItemCustRateSuccessListDto,
  ItemCustRateSuccessSingleDto,
} from './dto/item-cust-rate-response.dto';
import { ListItemCustRateQueryDto } from './dto/list-item-cust-rate-query.dto';
import { SaveItemCustRateDto } from './dto/save-item-cust-rate.dto';
import { ItemCustRateExceptionFilter } from './item-cust-rate-exception.filter';
import { ItemsCustRatesMasterService } from './items-cust-rates-master.service';
import {
  ItemCustRateListItem,
  ItemCustRateListMeta,
  ItemCustRatePayload,
  ItemCustRateSuccessResponse,
} from './types/item-cust-rate-api.types';

@ApiTags('Item Customer Rates')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('item-cust-rates')
@UseFilters(ItemCustRateExceptionFilter)
export class ItemsCustRatesMasterController {
  constructor(private readonly itemsCustRatesMasterService: ItemsCustRatesMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update customer item rate (by csr_id presence)' })
  @ApiCreatedResponse({ type: ItemCustRateSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemCustRateErrorResponseDto })
  @ApiConflictResponse({ type: ItemCustRateErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemCustRateErrorResponseDto })
  async save(
    @Body() saveItemCustRateDto: SaveItemCustRateDto,
  ): Promise<ItemCustRateSuccessResponse<ItemCustRatePayload>> {
    const data = await this.itemsCustRatesMasterService.save(saveItemCustRateDto);

    return {
      success: true,
      message: saveItemCustRateDto.csr_id
        ? 'Item customer rate updated successfully'
        : 'Item customer rate created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item customer rates with filter/search/pagination' })
  @ApiOkResponse({ type: ItemCustRateSuccessListDto })
  @ApiBadRequestResponse({ type: ItemCustRateErrorResponseDto })
  async list(
    @Query() queryDto: ListItemCustRateQueryDto,
  ): Promise<ItemCustRateSuccessResponse<ItemCustRateListItem[], ItemCustRateListMeta>> {
    const result = await this.itemsCustRatesMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item customer rates fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item customer rate by id' })
  @ApiQuery({ name: 'csr_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemCustRateSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemCustRateErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemCustRateErrorResponseDto })
  async getById(
    @Query('csr_id', new ParseUUIDPipe({ version: '7' })) csrId: string,
  ): Promise<ItemCustRateSuccessResponse<ItemCustRatePayload>> {
    const data = await this.itemsCustRatesMasterService.getById(csrId);

    return {
      success: true,
      message: 'Item customer rate fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item customer rate by id' })
  @ApiQuery({ name: 'csr_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemCustRateSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemCustRateErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemCustRateErrorResponseDto })
  async remove(
    @Query('csr_id', new ParseUUIDPipe({ version: '7' })) csrId: string,
  ): Promise<ItemCustRateSuccessResponse<{ csr_id: string; deleted: true }>> {
    const data = await this.itemsCustRatesMasterService.softDelete(csrId);

    return {
      success: true,
      message: 'Item customer rate deleted successfully',
      data,
    };
  }
}
