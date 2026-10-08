import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { StockVoucherExceptionFilter } from '../stock-voucher/stock-voucher-exception.filter';
import type { StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import {
  DeactivateStockReasonDto,
  SaveStockReasonDto,
  StockReasonListQueryDto,
  StockReasonPickerQueryDto,
  StockReasonRefQueryDto,
} from './dto/stock-reason.dto';
import {
  StockReasonsService,
  type StockReasonListRow,
  type StockReasonRow,
  type StockReasonUsage,
} from './stock-reasons.service';

/** `stock.stock_reason_master`: the picker (Q17) and its maintenance (Q18–Q20, plan §6). */
@ApiTags('Stock Reasons')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock/reasons')
@UseFilters(StockVoucherExceptionFilter)
export class StockReasonsController {
  constructor(private readonly service: StockReasonsService) {}

  @Get()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The reason picker for one document kind',
    description:
      'Shared and company rows merged — a company row hides the shared one with the same code — filtered by the txn types the kind posts and, optionally, by direction (BOTH always qualifies).',
  })
  @ApiOkResponse({ description: 'The reasons.' })
  async pick(@Query() query: StockReasonPickerQueryDto): Promise<StockVoucherSuccessResponse<StockReasonRow[]>> {
    const data = await this.service.pick(query);
    return { success: true, message: `${data.length} reasons`, data };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Every reason the company can see, with isOverridden, usageCount and canDelete' })
  @ApiOkResponse({ description: 'The rows.' })
  async list(@Query() query: StockReasonListQueryDto): Promise<StockVoucherSuccessResponse<StockReasonListRow[]>> {
    const data = await this.service.list(query.companyId, query.includeInactive ?? false);
    return { success: true, message: `${data.length} reasons`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'One reason' })
  @ApiOkResponse({ description: 'The row.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async getOne(@Query() query: StockReasonRefQueryDto): Promise<StockVoucherSuccessResponse<StockReasonListRow>> {
    const data = await this.service.getOne(query.companyId, query.srmId);
    return { success: true, message: 'Stock reason fetched successfully', data };
  }

  @Get('usage')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Where a reason is cited: ledger rows, voucher headers, voucher lines, last used' })
  @ApiOkResponse({ description: 'The counts.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async usage(@Query() query: StockReasonRefQueryDto): Promise<StockVoucherSuccessResponse<StockReasonUsage>> {
    const data = await this.service.usage(query.companyId, query.srmId);
    return { success: true, message: 'Stock reason usage fetched successfully', data };
  }

  @Post()
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Create or update the company's own reason",
    description:
      'A shared row is read-only: create a company row with the same code to override it. The code is immutable once any ledger row cites the reason. srm_gl_ledger_id is the ledger the reason posts to under PERPETUAL.',
  })
  @ApiCreatedResponse({ description: 'The saved row.' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async save(@Body() dto: SaveStockReasonDto): Promise<StockVoucherSuccessResponse<StockReasonListRow>> {
    const data = await this.service.save(dto);
    return { success: true, message: dto.srmId ? 'Stock reason updated successfully' : 'Stock reason created successfully', data };
  }

  @Post('deactivate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Deactivate (or reactivate) a company reason; one never cited is deleted outright',
  })
  @ApiOkResponse({ description: 'The row, or { srmId, deleted: true }.' })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async deactivate(
    @Body() dto: DeactivateStockReasonDto,
  ): Promise<StockVoucherSuccessResponse<StockReasonListRow | { srmId: string; deleted: true }>> {
    const data = await this.service.deactivate(dto);
    return {
      success: true,
      message: 'deleted' in data ? 'Stock reason deleted' : data.isActive ? 'Stock reason reactivated' : 'Stock reason deactivated',
      data,
    };
  }
}
