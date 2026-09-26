import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { StockVoucherExceptionFilter } from '../stock-voucher/stock-voucher-exception.filter';
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type {
  StockVoucherDeleteResult,
  StockVoucherPayload,
  StockVoucherSuccessResponse,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import { StockTransferService } from './stock-transfer.service';
import { SaveStockTransferReceiveDto } from './dto/save-stock-transfer-receive.dto';
import {
  StockTransferInboundQueryDto,
  StockTransferPrefillQueryDto,
  StockTransferRefQueryDto,
} from './dto/list-stock-transfer-query.dto';
import { StockTransferRefDto } from './dto/post-stock-transfer.dto';
import type {
  StockTransferPrefill,
  StockTransferReceiveResult,
} from './types/stock-transfer.types';
import {
  StockTransferDeleteSuccessDto,
  StockTransferDocumentSuccessDto,
  StockTransferErrorResponseDto,
  StockTransferInboundSuccessDto,
  StockTransferPrefillSuccessDto,
  StockTransferReceiveSuccessDto,
} from './dto/stock-transfer-response.dto';

/**
 * The receipt half — a TRANSFER_IN raised at the DESTINATION branch.
 *
 * A SEPARATE CONTROLLER, NOT A SEPARATE MODULE. It shares the transfer's
 * service and the shared voucher service; what it does not share is the rule
 * record, because a receipt is a different document with the opposite meaning
 * for two of its fields:
 *
 *   postFunction   fn_svh_receive_transfer — it settles the transit rows, which
 *                  fn_svh_post_transfer knows nothing about.
 *   isInward       true. The stock arrives. Its COST does not come with the
 *                  payload though: it is read from stt_cost_rate, the figure
 *                  stamped on the OUT row weeks earlier, so the receiving
 *                  branch cannot revalue stock by receiving it. zeroesLineCost
 *                  is what keeps the "inward needs a rate" check off this path.
 *   allowsToBranch false. A receipt does not leave the branch; it ends there.
 *
 * The LINE's godownId means the DESTINATION here and the SOURCE on the
 * despatch. Same column, two meanings, one screen apart — the DTO says so and
 * the two screens must not share a field label.
 */
const TRANSFER_IN_RULES: StockVoucherTypeRules = {
  voucherType: 'TRANSFER_IN',
  typeCode: 'TRI',
  displayName: 'Transfer receipt',
  // ck_svh_transfer_godowns applies to a TRANSFER_IN too, even though only the
  // line godown is used by the matcher. Both are copied from the OUT by the
  // service rather than picked, so this pair can be demanded honestly.
  requiresToGodown: true,
  requiresFromGodown: true,
  isInward: true,
  ledgerTxnTypes: ['TRANSFER_IN'],
  quantityMode: 'QTY',
  requiresLot: true,
  zeroesLineCost: true,
  allowsCount: false,
  allowsToBranch: false,
  postFunction: 'stock.fn_svh_receive_transfer',
  auditScreenName: 'Stock Transfer Receipt',
  statusDocType: TxnStatusDocType.STOCK_TRANSFER,
  refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

@ApiTags('Stock Transfer')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock/transfer/receive')
@UseFilters(StockVoucherExceptionFilter)
export class StockTransferReceiveController {
  constructor(
    private readonly stockTransferService: StockTransferService,
    private readonly stockVoucherService: StockVoucherService,
  ) {}

  @Get('inbound')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The inbound worklist — what is on its way to me',
    description:
      'Transit rows still IN_TRANSIT or PARTIAL, oldest first, with days in flight. Takes NO accYear on purpose: a transfer despatched on 29 March is received in April, and stock_transit is unpartitioned so that both halves of one fact stay in one place.',
  })
  @ApiOkResponse({ type: StockTransferInboundSuccessDto })
  async inbound(@Query() query: StockTransferInboundQueryDto) {
    const data = await this.stockTransferService.inbound(
      query.companyId,
      query.branchId,
      query.limit ?? 100,
      query.offset ?? 0,
    );
    return {
      success: true as const,
      message: `${data.meta.count} consignments in transit to this branch`,
      data,
    };
  }

  @Get('prefill')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Open a receipt against a despatch, at the REMAINDER',
    description:
      "Read from stock_transit, not from the despatch's lines. A second partial receipt opens with what is still owed — prefilling from the lines is what lets a clerk receive the same 30 twice.",
  })
  @ApiOkResponse({ type: StockTransferPrefillSuccessDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async prefill(
    @Query() query: StockTransferPrefillQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockTransferPrefill>> {
    const data = await this.stockTransferService.prefill(
      query.companyId,
      query.branchId,
      query.outVoucherId,
      query.accYear,
    );
    return {
      success: true,
      message: `${data.rows.length} lines still to receive against ${data.outVoucher.refno}`,
      data,
    };
  }

  @Post()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a transfer receipt draft',
    description:
      'Requires the despatch it is against. godownId on a line is the DESTINATION godown, taken from the prefill. Bucket is SALEABLE for what arrived good and DAMAGED for what arrived broken — damaged units still post in, because they exist, broken. What never arrived gets no line.',
  })
  @ApiCreatedResponse({ type: StockTransferDocumentSuccessDto })
  @ApiBadRequestResponse({ type: StockTransferErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: StockTransferErrorResponseDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async save(
    @Body() dto: SaveStockTransferReceiveDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPayload>> {
    const data = await this.stockTransferService.saveReceive(TRANSFER_IN_RULES, dto);
    return {
      success: true,
      message: dto.header.svhId
        ? 'Transfer receipt updated successfully'
        : 'Transfer receipt created successfully',
      data,
    };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post the receipt — stock.fn_svh_receive_transfer',
    description:
      'Returns BOTH documents. The receipt closing does not mean the transfer closed: the despatch flips to RECEIVED only when no transit row of it has anything left, and a short keeps it open on purpose — that is the loss report. The write-off is a separate decision and is deliberately not automated.',
  })
  @ApiOkResponse({ type: StockTransferReceiveSuccessDto })
  @ApiUnprocessableEntityResponse({ type: StockTransferErrorResponseDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async post(
    @Body() dto: StockTransferRefDto,
  ): Promise<StockVoucherSuccessResponse<StockTransferReceiveResult>> {
    const data = await this.stockTransferService.receive(
      TRANSFER_IN_RULES,
      dto.svhId,
      dto.accYear,
      dto.companyId,
      dto.branchId,
      dto.userId,
    );
    return {
      success: true,
      message: data.outVoucher.closed
        ? `Receipt posted — ${data.inVoucher.ledgerRows} ledger rows, transfer ${data.outVoucher.refno} closed`
        : `Receipt posted — ${data.inVoucher.ledgerRows} ledger rows, transfer ${data.outVoucher.refno} still open with stock outstanding`,
      data,
    };
  }

  @Delete()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a DRAFT receipt',
    description:
      'DELETE, NEVER CANCEL. tr_svh_transfer_cancel_guard refuses cancelling any linked TRANSFER_IN — a draft one included — and the link is mandatory on every one of them, so Cancel must not be offered on a draft receipt at all.',
  })
  @ApiOkResponse({ type: StockTransferDeleteSuccessDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async remove(
    @Query() query: StockTransferRefQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>> {
    const data = await this.stockVoucherService.softDelete(
      TRANSFER_IN_RULES,
      query.svhId,
      query.accYear,
      query.companyId,
      query.branchId,
    );
    return { success: true, message: 'Transfer receipt deleted successfully', data };
  }
}

export { TRANSFER_IN_RULES };
