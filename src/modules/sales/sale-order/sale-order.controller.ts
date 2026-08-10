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
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { SaleOrderExceptionFilter } from './sale-order-exception.filter';
import { SaleOrderService } from './sale-order.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import {
  SaleOrderErrorResponseDto,
  SaleOrderSuccessDeleteDto,
  SaleOrderSuccessSingleDto,
} from './dto/sale-order-response.dto';
import { SaleOrderPayload, SaleOrderSuccessResponse } from './types/sale-order-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Sale Orders')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('sale-orders')
@UseFilters(SaleOrderExceptionFilter)
export class SaleOrderController {
  constructor(private readonly orderService: SaleOrderService) { }
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update a sales order (by soId presence)' })
  @ApiCreatedResponse({ type: SaleOrderSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleOrderErrorResponseDto })
  @ApiConflictResponse({ type: SaleOrderErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  async save(@Body() saveOrderDto: SaveSaleOrderDto): Promise<SaleOrderSuccessResponse<SaleOrderPayload>> {
    const data = await this.orderService.save(saveOrderDto);
    return {
      success: true,
      message: saveOrderDto.soId ? 'Order updated successfully' : 'Order created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get sales order by id' })
  @ApiQuery({ name: 'soId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'soCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'soBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'soAccYear', schema: { type: 'string' } })
  @ApiOkResponse({ type: SaleOrderSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleOrderErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  async getById(
    @Query('soId', new ParseUUIDPipe({ version: '7' })) soId: string,
    @Query('soCompanyId', new ParseUUIDPipe({ version: '7' })) soCompanyId: string,
    @Query('soBranchId', new ParseUUIDPipe({ version: '7' })) soBranchId: string,
    @Query('soAccYear') soAccYear: string,
  ): Promise<SaleOrderSuccessResponse<SaleOrderPayload>> {
    const data = await this.orderService.getById(soId, soCompanyId, soBranchId, soAccYear);
    return {
      success: true,
      message: 'Order fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete sales order by id' })
  @ApiQuery({ name: 'soId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'soCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'soBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'soAccYear', schema: { type: 'string' } })
  @ApiOkResponse({ type: SaleOrderSuccessDeleteDto })
  @ApiBadRequestResponse({ type: SaleOrderErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  async remove(
    @Query('soId', new ParseUUIDPipe({ version: '7' })) soId: string,
    @Query('soCompanyId', new ParseUUIDPipe({ version: '7' })) soCompanyId: string,
    @Query('soBranchId', new ParseUUIDPipe({ version: '7' })) soBranchId: string,
    @Query('soAccYear') soAccYear: string,
  ): Promise<SaleOrderSuccessResponse<{ soId: string; deleted: true }>> {
    const data = await this.orderService.softDelete(soId, soCompanyId, soBranchId, soAccYear);
    return {
      success: true,
      message: 'Order deleted successfully',
      data,
    };
  }
}