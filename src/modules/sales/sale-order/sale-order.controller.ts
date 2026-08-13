import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Put,
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
import { CancelSaleOrderLinesDto } from './dto/cancel-sale-order-lines.dto';
import {
  SaleOrderErrorResponseDto,
  SaleOrderSuccessCancelLinesDto,
  SaleOrderSuccessDeleteDto,
  SaleOrderSuccessSingleDto,
} from './dto/sale-order-response.dto';
import {
  SaleOrderCancelLinesResult,
  SaleOrderPayload,
  SaleOrderSuccessResponse,
} from './types/sale-order-api.types';
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
  @Put('cancel-lines')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel a sales order line, or every open line of the order, by its source tuple',
    description:
      'Called from the sales line, which holds the order only as its source document. Moves the ' +
      "addressed still-open line's pending quantity into cancelled — line status PARTIAL where " +
      'something had already been delivered, CANCELLED where nothing had — then recomputes the ' +
      'header amounts, line counts and both status columns from what ALL the lines then say. ' +
      'srcDocId decides the scope: an order id (so_id) closes out every open line, an order line ' +
      'id (soi_id) closes out that one line and leaves its siblings alone. Idempotent: a second ' +
      'call finds nothing open, writes no status-trail step and answers cancelledLines 0.',
  })
  @ApiQuery({
    name: 'srcModule',
    schema: { type: 'string', enum: ['SALES', 'SALES_ORDER'], example: 'SALES' },
    description:
      'SALES, the only module a sales order is reachable from, or SALES_ORDER — the doc type a ' +
      'downstream document stores beside the id, which is what the calling screen has on hand. ' +
      'Case and separators are free ("sales order" and "Sales-Order" both name SALES_ORDER); ' +
      'any other word is a 400.',
  })
  @ApiQuery({
    name: 'srcDocId',
    schema: { type: 'string', format: 'uuid' },
    description:
      'The order id (so_id) to cancel every open line of, or one order line id (soi_id) to cancel ' +
      'just that line',
  })
  @ApiQuery({
    name: 'srcAccYear',
    schema: { type: 'string', example: '2026-2027' },
    description:
      'The accounting year of the order and its lines (so_acc_year / soi_acc_year) — the partition key',
  })
  @ApiOkResponse({ type: SaleOrderSuccessCancelLinesDto })
  @ApiBadRequestResponse({ type: SaleOrderErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleOrderErrorResponseDto })
  async cancelLines(
    @Query('srcModule') srcModule: string,
    @Query('srcDocId', new ParseUUIDPipe({ version: '7' })) srcDocId: string,
    @Query('srcAccYear') srcAccYear: string,
    @Body() cancelDto: CancelSaleOrderLinesDto,
  ): Promise<SaleOrderSuccessResponse<SaleOrderCancelLinesResult>> {
    const data = await this.orderService.cancelOpenLines(
      srcModule,
      srcDocId,
      srcAccYear,
      cancelDto,
    );
    return {
      success: true,
      message: 'Order lines cancelled successfully',
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