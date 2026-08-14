import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
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
import { BillExceptionFilter } from './bill-exception.filter';
import { BillService } from './bill.service';
import { SaveBillDto } from './dto/save-bill.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';
import {
  BillErrorResponseDto,
  BillSuccessCancelDto,
  BillSuccessSingleDto,
} from './dto/bill-response.dto';
import { BillCancelResult, BillPayload, BillSuccessResponse } from './types/bill-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Bills')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('bills')
@UseFilters(BillExceptionFilter)
export class BillController {
  constructor(private readonly billService: BillService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update a bill (by sbId presence)' })
  @ApiCreatedResponse({ type: BillSuccessSingleDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiConflictResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async save(@Body() saveBillDto: SaveBillDto): Promise<BillSuccessResponse<BillPayload>> {
    const data = await this.billService.save(saveBillDto);
    return {
      success: true,
      message: saveBillDto.sbId ? 'Bill updated successfully' : 'Bill created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get bill by id' })
  @ApiQuery({ name: 'sbId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbAccYear', schema: { type: 'string' } })
  @ApiOkResponse({ type: BillSuccessSingleDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async getById(
    @Query('sbId', new ParseUUIDPipe({ version: '7' })) sbId: string,
    @Query('sbCompanyId', new ParseUUIDPipe({ version: '7' })) sbCompanyId: string,
    @Query('sbBranchId', new ParseUUIDPipe({ version: '7' })) sbBranchId: string,
    @Query('sbAccYear') sbAccYear: string,
  ): Promise<BillSuccessResponse<BillPayload>> {
    const data = await this.billService.getById(sbId, sbCompanyId, sbBranchId, sbAccYear);
    return {
      success: true,
      message: 'Bill fetched successfully',
      data,
    };
  }
  // POST, not DELETE, and it deletes nothing. The route keeps its path so the
  // screens calling it do not have to move, but both the verb and the meaning
  // changed: a cancellation has to carry a reason and an actor, which is a body,
  // and DELETE-with-a-body is not something every client between here and the
  // browser handles. What it now does is cancel the SALE ORDER the bill was
  // raised against — the bill row, its lines, its charges, its tenders and its
  // voucher posting are all left untouched.
  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel the sale order this bill was raised against',
    description:
      'Writes off every OPEN line of the order(s) the bill references: soi_cancelled_qty takes ' +
      'the pending quantity, which drives the GENERATED soi_pending_qty to zero and ' +
      'soi_line_status to CANCELLED, and the header roll-ups follow. Nothing is deleted and no ' +
      'is_deleted flag moves. Idempotent — calling it twice cancels nothing the second time.',
  })
  @ApiOkResponse({ type: BillSuccessCancelDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async remove(
    @Body() cancelBillDto: CancelBillDto,
  ): Promise<BillSuccessResponse<BillCancelResult>> {
    const data = await this.billService.cancelSourceOrders(cancelBillDto);
    return {
      success: true,
      message: 'Sale order cancelled successfully',
      data,
    };
  }
}
