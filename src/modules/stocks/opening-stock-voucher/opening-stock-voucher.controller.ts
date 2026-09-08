import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
  OpeningReconcileRow,
  PagedResult,
  PendingOpeningItem,
  StockVoucherCancelResult,
  StockVoucherDeleteResult,
  StockVoucherImportResult,
  StockVoucherLineProblem,
  StockVoucherListResult,
  StockVoucherPayload,
  StockVoucherPostResult,
  StockVoucherSuccessResponse,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import { SaveOpeningStockVoucherDto } from './dto/save-opening-stock-voucher.dto';
import {
  GetOpeningStockVoucherQueryDto,
  OpeningStockReportQueryDto,
  OpeningStockVoucherRefQueryDto,
} from './dto/list-opening-stock-voucher-query.dto';
import {
  CancelOpeningStockVoucherDto,
  PostOpeningStockVoucherDto,
} from './dto/post-opening-stock-voucher.dto';
import { ImportOpeningStockVoucherDto } from './dto/import-opening-stock-voucher.dto';
import {
  OpeningReconcileSuccessDto,
  OpeningStockCancelSuccessDto,
  OpeningStockDeleteSuccessDto,
  OpeningStockDocumentSuccessDto,
  OpeningStockErrorResponseDto,
  OpeningStockListSuccessDto,
  OpeningStockPostSuccessDto,
  OpeningStockImportSuccessDto,
  OpeningStockValidateSuccessDto,
  PendingOpeningItemsSuccessDto,
} from './dto/opening-stock-voucher-response.dto';

/**
 * THE ROUTE IS WHAT PINS THE VOUCHER TYPE.
 *
 * Everything below hands StockVoucherService this one record. Nothing in a
 * payload can reach it: SaveOpeningStockVoucherDto rejects any `voucherType`
 * but OPENING, and even that value is discarded — the type used is the one
 * here.
 *
 * TRANSFER_* and REPACK_* are named in refuseTypes rather than merely being
 * absent, because they are the two families whose posting writes tables this
 * service knows nothing about (stock_transit, and a paired document in the
 * receiving branch). A transfer posted through this route would look like it
 * worked.
 */
const OPENING_RULES: StockVoucherTypeRules = {
  voucherType: 'OPENING',
  typeCode: 'OPN',
  displayName: 'Opening stock',
  // ck_svh_godowns is satisfied by a from-godown alone — see the DTO.
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  // The one voucher type whose ledger txn_type is its own name — see the field.
  ledgerTxnTypes: ['OPENING'],
  // Every OPENING line states a quantity to move — see StockQuantityMode.
  quantityMode: 'QTY',
  // An opening states a quantity; it does not reconcile one, and it does not
  // leave the branch.
  allowsCount: false,
  allowsToBranch: false,
  auditScreenName: 'Opening Stock',
  // An opening is not a transfer, and ck_tsl_src_doc_type has no OPENING —
  // see StockVoucherTypeRules.statusDocType for why this is pinned per screen.
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  // The generic entry point. 19 refuses to post a TRANSFER_* through it by
  // name, so the transfer screens cannot reach this record by accident.
  postFunction: 'stock.fn_svh_post',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

/** What FileInterceptor hands back for the uploaded CSV. */
type UploadedCsvFile = {
  buffer: Buffer;
  originalname?: string;
  size?: number;
};

/** A 400-line opening is ~60KB; this is generous and still bounds the request. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * NO @CacheTTL ANYWHERE IN THIS CONTROLLER. Every read here is a live balance
 * or a live document status; a cached preflight is worse than no preflight,
 * because it says a holding is free to open after another till has opened it.
 */
@ApiTags('Opening Stock')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('stock/opening')
@UseFilters(StockVoucherExceptionFilter)
export class OpeningStockVoucherController {
  constructor(private readonly stockVoucherService: StockVoucherService) {}

  @Post()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update an opening stock draft (by header.svhId presence)',
    description:
      'Update is a full replace of the lines. The saved status is always DRAFT — posting is a separate call, not a status field.',
  })
  @ApiCreatedResponse({ type: OpeningStockDocumentSuccessDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: OpeningStockErrorResponseDto })
  @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async save(
    @Body() dto: SaveOpeningStockVoucherDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPayload>> {
    const data = await this.stockVoucherService.save(OPENING_RULES, dto);
    return {
      success: true,
      message: dto.header.svhId
        ? 'Opening stock updated successfully'
        : 'Opening stock created successfully',
      data,
    };
  }

  @Get()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List opening stock documents, or load one when svhId is given',
    description:
      'The list reads the trigger-maintained header counters — it never aggregates the line table.',
  })
  @ApiOkResponse({ type: OpeningStockListSuccessDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async listOrLoad(
    @Query() query: GetOpeningStockVoucherQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPayload | StockVoucherListResult>> {
    if (query.svhId) {
      const data = await this.stockVoucherService.getById(
        OPENING_RULES,
        query.svhId,
        query.accYear,
        query.companyId,
        query.branchId,
      );
      return { success: true, message: 'Opening stock fetched successfully', data };
    }
    const data = await this.stockVoucherService.list(OPENING_RULES, query);
    return { success: true, message: 'Opening stock list fetched successfully', data };
  }

  @Get('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Preflight one opening stock document, line by line',
    description:
      'Resolves the lot the way the engine would — without creating anything — and reports every line, problem null on the clean ones. Advisory: another till can post the same holding between this call and the post.',
  })
  @ApiOkResponse({ type: OpeningStockValidateSuccessDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async validate(
    @Query() query: OpeningStockVoucherRefQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>> {
    const data = await this.stockVoucherService.validate(
      OPENING_RULES,
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
    summary: 'Post the opening — stock.fn_svh_post, the whole engine in one statement',
    description:
      'Returns the reloaded document: the post fills lotId and costRateWot and recomputes every total on rows the client is still holding.',
  })
  @ApiOkResponse({ type: OpeningStockPostSuccessDto })
  @ApiUnprocessableEntityResponse({ type: OpeningStockErrorResponseDto })
  @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async post(
    @Body() dto: PostOpeningStockVoucherDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>> {
    const data = await this.stockVoucherService.post(
      OPENING_RULES,
      dto.svhId,
      dto.accYear,
      dto.companyId,
      dto.branchId,
      dto.userId,
    );
    return {
      success: true,
      message: `Opening stock posted successfully — ${data.rowsPosted} ledger rows`,
      data,
    };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel a posted opening — reversal rows, never a delete',
    description:
      'Can legitimately fail with 409: cancelling an opening after stock has been sold from it drives the holding negative, which fn_sml_apply refuses under BLOCK. The fix is an ADJUSTMENT, not a retry.',
  })
  @ApiOkResponse({ type: OpeningStockCancelSuccessDto })
  @ApiUnprocessableEntityResponse({ type: OpeningStockErrorResponseDto })
  @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async cancel(
    @Body() dto: CancelOpeningStockVoucherDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>> {
    const data = await this.stockVoucherService.cancel(
      OPENING_RULES,
      dto.svhId,
      dto.accYear,
      dto.reason,
      dto.companyId,
      dto.branchId,
      dto.userId,
    );
    return {
      success: true,
      message: `Opening stock cancelled successfully — ${data.rowsReversed} reversal rows`,
      data,
    };
  }

  @Delete()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete an opening stock DRAFT',
    description:
      'DRAFT only. A POSTED voucher is cancelled, never deleted: soft-deleting it would hide the document from every list while its ledger rows went on affecting stock for ever.',
  })
  @ApiOkResponse({ type: OpeningStockDeleteSuccessDto })
  @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async remove(
    @Query() query: OpeningStockVoucherRefQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>> {
    const data = await this.stockVoucherService.softDelete(
      OPENING_RULES,
      query.svhId,
      query.accYear,
      query.companyId,
      query.branchId,
    );
    return { success: true, message: 'Opening stock deleted successfully', data };
  }

  @Post('import')
  @Version(API_VERSION)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportOpeningStockVoucherDto })
  @ApiOperation({
    summary: "Replace an existing DRAFT's lines from a CSV",
    description:
      'Resolves item code and unit name to ids server-side, then goes through the ordinary save path so every line rule still applies. Ambiguity is refused, never guessed, and every bad row is reported at once. It never posts and never creates the document.',
  })
  @ApiOkResponse({ type: OpeningStockImportSuccessDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: OpeningStockErrorResponseDto })
  @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async import(
    @Body() dto: ImportOpeningStockVoucherDto,
    @UploadedFile() file?: UploadedCsvFile,
  ): Promise<StockVoucherSuccessResponse<StockVoucherImportResult>> {
    const csvText = this.readCsv(file);
    const data = await this.stockVoucherService.importLines(
      OPENING_RULES,
      dto.svhId,
      dto.accYear,
      dto.companyId,
      dto.branchId,
      csvText,
      dto.userId,
    );
    const failing = data.problems.filter((row) => row.problem !== null).length;
    return {
      success: true,
      message: failing
        ? `${data.linesImported} lines imported; ${failing} have problems`
        : `${data.linesImported} lines imported, all clean`,
      data,
    };
  }

  @Get('pending-items')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Every stockable item with no opening movement in this branch and year',
    description:
      'On go-live day this is the work list. A week later it should be the items that genuinely started at zero.',
  })
  @ApiOkResponse({ type: PendingOpeningItemsSuccessDto })
  async pendingItems(
    @Query() query: OpeningStockReportQueryDto,
  ): Promise<StockVoucherSuccessResponse<PagedResult<PendingOpeningItem>>> {
    const data = await this.stockVoucherService.pendingItems(
      OPENING_RULES,
      query.companyId,
      query.branchId,
      query.accYear,
      query.limit,
      query.offset,
    );
    return { success: true, message: 'Pending opening items fetched successfully', data };
  }

  @Get('reconcile')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'What the branch started with, what it holds now, the difference',
    description:
      'The opening figure comes from the ledger, not the document, so a cancelled opening correctly reads as zero.',
  })
  @ApiOkResponse({ type: OpeningReconcileSuccessDto })
  async reconcile(
    @Query() query: OpeningStockReportQueryDto,
  ): Promise<StockVoucherSuccessResponse<PagedResult<OpeningReconcileRow>>> {
    const data = await this.stockVoucherService.reconcile(
      OPENING_RULES,
      query.companyId,
      query.branchId,
      query.accYear,
      query.limit,
      query.offset,
    );
    return { success: true, message: 'Opening reconciliation fetched successfully', data };
  }

  /**
   * Decodes the uploaded part, refusing the two things that are cheaper to
   * catch here than to diagnose from a wall of resolution errors: no file at
   * all, and a file large enough to be something other than a line list.
   */
  private readCsv(file?: UploadedCsvFile): string {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        success: false,
        message: 'No file uploaded',
        errors: [{ field: 'file', message: 'Attach the CSV as the "file" part of the form.' }],
      });
    }
    if (file.buffer.length > MAX_IMPORT_BYTES) {
      throw new BadRequestException({
        success: false,
        message: 'File too large',
        errors: [
          {
            field: 'file',
            message: `The file is ${Math.round(file.buffer.length / 1024)}KB; the limit is ${MAX_IMPORT_BYTES / 1024 / 1024}MB.`,
          },
        ],
      });
    }
    return file.buffer.toString('utf8');
  }
}
