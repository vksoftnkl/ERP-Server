import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
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
  StockVoucherCancelResult,
  StockVoucherDeleteResult,
  StockVoucherLineProblem,
  StockVoucherListResult,
  StockVoucherPayload,
  StockVoucherSuccessResponse,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import { StockTransferService } from './stock-transfer.service';
import { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import {
  GetStockTransferQueryDto,
  StockTransferRefQueryDto,
} from './dto/list-stock-transfer-query.dto';
import { CancelStockTransferDto, DespatchStockTransferDto } from './dto/post-stock-transfer.dto';
import type { StockTransferDespatchResult, StockTransitRow } from './types/stock-transfer.types';
import {
  StockTransferCancelSuccessDto,
  StockTransferDeleteSuccessDto,
  StockTransferDespatchSuccessDto,
  StockTransferDocumentSuccessDto,
  StockTransferErrorResponseDto,
  StockTransferListSuccessDto,
  StockTransferLoadSuccessDto,
  StockTransferValidateSuccessDto,
} from './dto/stock-transfer-response.dto';

/**
 * THE ROUTE PINS THE VOUCHER TYPE, as on every other screen over this engine.
 *
 * ONE RECORD SERVES BOTH FORMS. Form 3 (godown → godown) and form 4 (branch →
 * branch) are the same document with and without a `toBranchId`, and the ENGINE
 * chooses the shape. A second rule record for "branch transfer" would be a
 * second definition of the same thing, and the two would drift.
 *
 * The fields that say something the other screens do not:
 *
 *   postFunction        fn_svh_post_transfer, NOT fn_svh_post. 19 refuses to
 *                       post a transfer by name, so a mis-wired record fails
 *                       loudly at the first despatch rather than half-posting a
 *                       document that should have written stock_transit.
 *   requiresLot         a transfer MOVES existing stock. fn_slt_resolve is
 *                       never called here — the destination keeps the same
 *                       slt_id, so ageing does not reset. That is the point of
 *                       the rule, not a side effect.
 *   zeroesLineCost      the cost is stamped by the engine and TRAVELS. See
 *                       MUST-FIX 5: a typed rate lands in the ledger at that
 *                       rate with value 0.
 *   allowsToBranch      the only type that may leave the branch.
 *   requiresFromGodown  both godowns, both mandatory (ck_svh_transfer_godowns).
 *   + requiresToGodown  svi_godown_id on the LINE is the source; the header's
 *                       to-godown is the destination.
 */
const TRANSFER_OUT_RULES: StockVoucherTypeRules = {
  voucherType: 'TRANSFER_OUT',
  typeCode: 'TRF',
  displayName: 'Stock transfer',
  requiresToGodown: true,
  requiresFromGodown: true,
  isInward: false,
  ledgerTxnTypes: ['TRANSFER_OUT'],
  quantityMode: 'QTY',
  requiresLot: true,
  zeroesLineCost: true,
  allowsCount: false,
  allowsToBranch: true,
  postFunction: 'stock.fn_svh_post_transfer',
  auditScreenName: 'Stock Transfer',
  statusDocType: TxnStatusDocType.STOCK_TRANSFER,
  refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_IN', 'REPACK_IN', 'REPACK_OUT'],
};

/**
 * NO @CacheTTL ANYWHERE. Every read here is a live balance, a live transit row
 * or a live document status. A cached inbound worklist tells a branch stock is
 * coming that it has already received.
 */
@ApiTags('Stock Transfer')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock/transfer')
@UseFilters(StockVoucherExceptionFilter)
export class StockTransferController {
  constructor(
    private readonly stockTransferService: StockTransferService,
    private readonly stockVoucherService: StockVoucherService,
  ) {}

  @Post()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a stock transfer draft (godown → godown or branch → branch)',
    description:
      'One endpoint for both forms — omit toBranchId, or send this branch, for a godown-to-godown move. Every line names the lot it moves and the SOURCE godown; the destination is on the header. Never send a cost: the engine stamps it and it travels with the stock.',
  })
  @ApiCreatedResponse({ type: StockTransferDocumentSuccessDto })
  @ApiBadRequestResponse({ type: StockTransferErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: StockTransferErrorResponseDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async save(
    @Body() dto: SaveStockTransferDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPayload>> {
    const data = await this.stockTransferService.save(TRANSFER_OUT_RULES, dto);
    return {
      success: true,
      message: dto.header.svhId
        ? 'Stock transfer updated successfully'
        : 'Stock transfer created successfully',
      data,
    };
  }

  @Get()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List stock transfers, or load one with its transit rows when svhId is given',
    description:
      'The status filter offers all five: an inter-branch despatch is IN_TRANSIT, never POSTED, so filtering to POSTED hides every transfer on a lorry. Loading one returns its transit rows so the sender can see what has been received against each line.',
  })
  // Two shapes on one route, as the Qt screen sends the same query object
  // either way. The list is the default; svhId switches it to the document.
  @ApiOkResponse({ type: StockTransferListSuccessDto })
  @ApiExtraModels(StockTransferLoadSuccessDto)
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async listOrLoad(
    @Query() query: GetStockTransferQueryDto,
  ): Promise<
    StockVoucherSuccessResponse<
      (StockVoucherPayload & { transit: StockTransitRow[] }) | StockVoucherListResult
    >
  > {
    if (query.svhId) {
      const data = await this.stockTransferService.getOne(
        TRANSFER_OUT_RULES,
        query.svhId,
        query.accYear,
        query.companyId,
        query.branchId,
      );
      return { success: true, message: 'Stock transfer fetched successfully', data };
    }
    const data = await this.stockVoucherService.list(TRANSFER_OUT_RULES, query);
    return { success: true, message: 'Stock transfer list fetched successfully', data };
  }

  @Get('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Preflight one transfer, line by line',
    description:
      'Advisory: another till can move the same holding between this call and the despatch.',
  })
  @ApiOkResponse({ type: StockTransferValidateSuccessDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async validate(
    @Query() query: StockTransferRefQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>> {
    const data = await this.stockVoucherService.validate(
      TRANSFER_OUT_RULES,
      query.svhId,
      query.accYear,
      query.companyId,
      query.branchId,
    );
    const failing = data.filter((row) => row.problem !== null).length;
    return {
      success: true,
      message: failing
        ? `${failing} of ${data.length} lines have problems`
        : `All ${data.length} lines are clean`,
      data,
    };
  }

  @Post('despatch')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Despatch the transfer — stock.fn_svh_post_transfer',
    description:
      'The engine chooses the shape. A same-branch transfer writes the OUT and IN ledger rows as a pair and ends POSTED; an inter-branch despatch writes the OUT row plus one stock_transit row per line and ends IN_TRANSIT. The response says which happened — read from the row, not from the request. LR, vehicle and expected date are written to the transit rows in the same transaction.',
  })
  @ApiOkResponse({ type: StockTransferDespatchSuccessDto })
  @ApiUnprocessableEntityResponse({ type: StockTransferErrorResponseDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async despatch(
    @Body() dto: DespatchStockTransferDto,
  ): Promise<StockVoucherSuccessResponse<StockTransferDespatchResult>> {
    const data = await this.stockTransferService.despatch(TRANSFER_OUT_RULES, dto);
    return {
      success: true,
      message: data.sameBranch
        ? `Stock moved between godowns — ${data.ledgerRows} ledger rows, transfer POSTED`
        : `Transfer despatched — ${data.transitRows} lines in transit`,
      data,
    };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel a same-branch POSTED transfer — reversal rows, never a delete',
    description:
      "Only a same-branch transfer can be cancelled. An IN_TRANSIT or RECEIVED despatch is refused by tr_svh_transfer_cancel_guard with 409 and the engine's own sentence — goods that left cannot be cancelled on paper, and the fix is to receive them or transfer them back.",
  })
  @ApiOkResponse({ type: StockTransferCancelSuccessDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async cancel(
    @Body() dto: CancelStockTransferDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>> {
    const data = await this.stockVoucherService.cancel(
      TRANSFER_OUT_RULES,
      dto.svhId,
      dto.accYear,
      dto.reason,
      dto.companyId,
      dto.branchId,
      dto.userId,
    );
    return {
      success: true,
      message: `Stock transfer cancelled — ${data.rowsReversed} reversal rows`,
      data,
    };
  }

  @Delete()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a DRAFT transfer',
    description:
      'Drafts are DELETED, never cancelled. The cancel guard refuses cancelling any linked TRANSFER_IN, a draft one included, and the link is mandatory on all of them.',
  })
  @ApiOkResponse({ type: StockTransferDeleteSuccessDto })
  @ApiConflictResponse({ type: StockTransferErrorResponseDto })
  @ApiNotFoundResponse({ type: StockTransferErrorResponseDto })
  async remove(
    @Query() query: StockTransferRefQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>> {
    const data = await this.stockVoucherService.softDelete(
      TRANSFER_OUT_RULES,
      query.svhId,
      query.accYear,
      query.companyId,
      query.branchId,
    );
    return { success: true, message: 'Stock transfer deleted successfully', data };
  }
}

export { TRANSFER_OUT_RULES };
