import { Controller, Get, Post, Body, Query, UseFilters, Version } from '@nestjs/common';
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
import type { SaveStockVoucherDto } from '../stock-voucher/dto/save-stock-voucher.dto';
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type {
  PagedResult,
  StockCountSheetRow,
  StockVarianceRow,
  StockVoucherCancelResult,
  StockVoucherLineProblem,
  StockVoucherListResult,
  StockVoucherPayload,
  StockVoucherPostResult,
  StockVoucherSuccessResponse,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import { PHYSICAL_DEFAULT_RATE_SOURCE } from '../stock-voucher/types/stock-voucher.types';
import { SavePhysicalStockVoucherDto } from './dto/save-physical-stock-voucher.dto';
import {
  GenerateCountSheetQueryDto,
  GetPhysicalStockVoucherQueryDto,
  PhysicalStockVarianceQueryDto,
  PhysicalStockVoucherRefQueryDto,
} from './dto/list-physical-stock-voucher-query.dto';
import {
  CancelPhysicalStockVoucherDto,
  PostPhysicalStockVoucherDto,
} from './dto/post-physical-stock-voucher.dto';
import {
  CountSheetSuccessDto,
  PhysicalStockCancelSuccessDto,
  PhysicalStockDocumentSuccessDto,
  PhysicalStockErrorResponseDto,
  PhysicalStockListSuccessDto,
  PhysicalStockPostSuccessDto,
  PhysicalStockValidateSuccessDto,
  StockVarianceSuccessDto,
} from './dto/physical-stock-voucher-response.dto';

/**
 * THE ROUTE IS WHAT PINS THE VOUCHER TYPE — as for the opening, and for the
 * same reason: nothing in a payload may reach this record.
 *
 * Four of these fields say something an opening does not, and each one is a
 * rule the OPENING satisfied by accident:
 *
 *   quantityMode: 'COUNT'      the line states what was FOUND, not a quantity
 *                              to move. svi_qty stays 0 for the whole document
 *                              and svi_diff_qty — GENERATED as counted − book —
 *                              is what reaches the ledger.
 *   defaultRateSource          found stock is worth what the rest of that item
 *                              is worth. MANUAL, the right default for an
 *                              opening, makes the engine refuse an overage line
 *                              outright.
 *   allowsRepeatHolding: true  a holding may be counted any number of times.
 *                              The opening's "already opened this year" guard
 *                              would refuse every re-count — which is also the
 *                              ordinary answer to "the counter miscounted".
 *   ledgerTxnTypes             TWO of them, in the same document: one line
 *                              short, the next line over.
 *
 * `requiresToGodown` follows §17 open item 1 — the counted godown is assumed to
 * be svh_to_godown_id, and the service enforces that every line is in it, so
 * whichever side fn_svh_post reads, the two agree.
 */
const PHYSICAL_RULES: StockVoucherTypeRules = {
  voucherType: 'PHYSICAL',
  typeCode: 'PHY',
  displayName: 'Physical stock count',
  requiresToGodown: true,
  requiresFromGodown: false,
  // Superseded by quantityMode: a count moves stock BOTH ways at once, so a
  // document-wide inward flag cannot describe it. See §3.3.
  isInward: false,
  ledgerTxnTypes: ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'],
  quantityMode: 'COUNT',
  defaultRateSource: PHYSICAL_DEFAULT_RATE_SOURCE,
  allowsRepeatHolding: true,
  allowsCount: true,
  allowsToBranch: false,
  auditScreenName: 'Physical Stock Count',
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  // The generic entry point. 19 refuses to post a TRANSFER_* through it by
  // name, so the transfer screens cannot reach this record by accident.
  postFunction: 'stock.fn_svh_post',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

/**
 * NO @CacheTTL ANYWHERE IN THIS CONTROLLER, and here it matters more than
 * anywhere else in the module: A CACHED COUNT SHEET IS A BOOK FIGURE FROM
 * BEFORE THE LAST SALE. Every read here is a live balance or a live status.
 */
@ApiTags('Physical Stock')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock/physical')
@UseFilters(StockVoucherExceptionFilter)
export class PhysicalStockVoucherController {
  constructor(private readonly stockVoucherService: StockVoucherService) { }

  @Get('count-sheet')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Generate a count sheet for one godown from stock_balance',
    description:
      'A READ, NOT A DOCUMENT — it creates nothing, so the sheet can be printed and walked before any row exists. One line per godown × lot × bucket, not per item: two batches of MILK are two lines, because they are two holdings.\n\n' +
      'AN ITEM WITH NO BALANCE ROW IS NOT ON THE SHEET AND MUST NOT BE ADDED TO IT. No book quantity means no variance to have; finding such an item on the shelf is an ADJUSTMENT, which is a different screen.\n\n' +
      'Send each row back on POST /stock/physical with its lotId verbatim and one number filled in.',
  })
  @ApiOkResponse({ type: CountSheetSuccessDto })
  @ApiUnprocessableEntityResponse({ type: PhysicalStockErrorResponseDto })
  async countSheet(
    @Query() query: GenerateCountSheetQueryDto,
  ): Promise<StockVoucherSuccessResponse<PagedResult<StockCountSheetRow>>> {
    const data = await this.stockVoucherService.countSheet(PHYSICAL_RULES, query);
    return {
      success: true,
      message: `${data.items.length} holdings to count`,
      data,
    };
  }

  @Post('/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a physical count draft (by header.svhId presence)',
    description:
      'Update is a full replace of the lines. The saved status is always DRAFT — posting is a separate call, not a status field.\n\n' +
      'THE SERVER READS RATHER THAN TRUSTS: svi_book_qty comes from stock_balance for the lot the line names, and the unit, batch, expiry, MRP, sale price, serial and supplier are copied from the same holding. A lotId with no live balance row in this godown is a 422 telling you to regenerate the sheet.',
  })
  @ApiCreatedResponse({ type: PhysicalStockDocumentSuccessDto })
  @ApiBadRequestResponse({ type: PhysicalStockErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: PhysicalStockErrorResponseDto })
  @ApiConflictResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async save(
    @Body() dto: SavePhysicalStockVoucherDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPayload>> {
    // A COUNT LINE IS STRUCTURALLY NARROWER, and deliberately so. The shared
    // line now requires baseUomId, toBaseFactor and baseQty from the payload;
    // a count sends none of the three, because it is taken in the base unit the
    // book figure is held in, at factor 1, and its quantity is the variance.
    // The service reads all three off the holding on the COUNT branch and never
    // touches these properties, so the cast is sound — the same one
    // StockTransferService.saveReceive makes for the same reason.
    const data = await this.stockVoucherService.save(
      PHYSICAL_RULES,
      dto as unknown as SaveStockVoucherDto,
    );
    return {
      success: true,
      message: dto.header.svhId
        ? 'Physical stock count updated successfully'
        : 'Physical stock count created successfully',
      data,
    };
  }

  @Get('/get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List physical counts, or load one when svhId is given',
    description:
      'The header totals on a POSTED count are the NET VARIANCE read off the ledger, not the sum of anything on the screen. Label them "Net variance" or do not show them: a column headed "Total" reading 1 under three lines totalling 236 counted units is worse than no column.',
  })
  @ApiOkResponse({ type: PhysicalStockListSuccessDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async listOrLoad(
    @Query() query: GetPhysicalStockVoucherQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPayload | StockVoucherListResult>> {
    if (query.svhId) {
      const data = await this.stockVoucherService.getById(
        PHYSICAL_RULES,
        query.svhId,
        query.accYear,
        query.companyId,
        query.branchId,
      );
      return { success: true, message: 'Physical stock count fetched successfully', data };
    }
    const data = await this.stockVoucherService.list(PHYSICAL_RULES, query);
    return { success: true, message: 'Physical stock count list fetched successfully', data };
  }

  @Get('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Preflight one count, line by line',
    description:
      'Returns EVERY line, problem null on the clean ones — including the ones that agree, because a line with no variance is still a line that was counted and the screen ticks it.\n\n' +
      'The check worth reading is the drift check: "the book quantity has changed since this sheet was generated". With the freeze on it should never fire; when it does, it is telling you the freeze is not working. Advisory either way — a sheet can be generated before the freeze window opens.',
  })
  @ApiOkResponse({ type: PhysicalStockValidateSuccessDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async validate(
    @Query() query: PhysicalStockVoucherRefQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>> {
    const data = await this.stockVoucherService.validate(
      PHYSICAL_RULES,
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

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post the count — stock.fn_svh_post, the whole engine in one statement',
    description:
      'ZERO LEDGER ROWS IS A SUCCESS. A count where every line agrees posts nothing, closes POSTED, and is exactly what a well-run stockroom should produce; rowsPosted is the honest number of lines that varied, not a failure count.\n\n' +
      'The average must not move: a shortage is relieved at the average and an overage added at it. A count finds a quantity error, not a price error — and correcting a price is something this engine cannot express at all.',
  })
  @ApiOkResponse({ type: PhysicalStockPostSuccessDto })
  @ApiUnprocessableEntityResponse({ type: PhysicalStockErrorResponseDto })
  @ApiConflictResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async post(
    @Body() dto: PostPhysicalStockVoucherDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>> {
    const data = await this.stockVoucherService.post(
      PHYSICAL_RULES,
      dto.svhId,
      dto.accYear,
      dto.companyId,
      dto.branchId,
      dto.userId,
    );
    return {
      success: true,
      // §3.6 — "0 ledger rows" reads like a failure on the one document type
      // where it is the best possible outcome. Say what actually happened.
      message: this.postedMessage(data),
      data,
    };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel a posted count — reversal rows, never a delete',
    description:
      'A cancelled count UN-CORRECTS a correction: the book figure goes back to being the one the shelf disagreed with. Usually the right answer to "the counter miscounted" is a SECOND COUNT, not a cancellation — a holding may be counted any number of times, each posting its own variance from the then-current book figure. Put that in the confirm dialog.\n\n' +
      'It can also legitimately fail with 409: cancel an overage after the found stock has been sold and the reversal drives the holding negative, which fn_sml_apply refuses under BLOCK. The fix is another count, not a retry.',
  })
  @ApiOkResponse({ type: PhysicalStockCancelSuccessDto })
  @ApiUnprocessableEntityResponse({ type: PhysicalStockErrorResponseDto })
  @ApiConflictResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async cancel(
    @Body() dto: CancelPhysicalStockVoucherDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>> {
    const data = await this.stockVoucherService.cancel(
      PHYSICAL_RULES,
      dto.svhId,
      dto.accYear,
      dto.reason,
      dto.companyId,
      dto.branchId,
      dto.userId,
    );
    return {
      success: true,
      message: `Physical stock count cancelled successfully — ${data.rowsReversed} reversal rows`,
      data,
    };
  }

  @Get('variance')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The count as the LEDGER recorded it',
    description:
      "Not the same row set as the document: only the lines that varied are here, keeping the count sheet's own line numbers so a variance row can be pointed back at the line it came from. A count of three lines with one agreement returns rows 2 and 3, and row 1 is missing deliberately.\n\n" +
      "This is what an auditor asks for, and the only place the shortage's stamped cost and the overage's derived cost sit side by side.",
  })
  @ApiOkResponse({ type: StockVarianceSuccessDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async variance(
    @Query() query: PhysicalStockVarianceQueryDto,
  ): Promise<StockVoucherSuccessResponse<PagedResult<StockVarianceRow>>> {
    const data = await this.stockVoucherService.variance(
      PHYSICAL_RULES,
      query.svhId,
      query.accYear,
      query.companyId,
      query.branchId,
      query.limit,
      query.offset,
    );
    return {
      success: true,
      message: data.items.length
        ? `${data.items.length} variance rows`
        : 'Every line agreed — the count posted no ledger rows',
      data,
    };
  }

  /**
   * §3.6 — a count where every line agrees returns 0 from fn_svh_post and still
   * closes POSTED. "Posted — 0 ledger rows" reads like a failure; it is the
   * best outcome this screen has.
   *
   * Counted off svi_diff_qty rather than off rowsPosted, so the two halves of
   * the sentence come from the same document the caller is being handed.
   */
  private postedMessage(data: StockVoucherPostResult): string {
    const varied = data.lines.filter((line) => (line.diffQty ?? 0) !== 0).length;
    const total = data.lines.length;
    return varied
      ? `Physical stock count posted — ${varied} of ${total} lines had a variance`
      : `Physical stock count posted — all ${total} lines agreed with the book`;
  }
}
