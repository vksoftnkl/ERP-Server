import {
  BadRequestException,
  Body,
  Controller,
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
  StockVoucherCancelResult,
  StockVoucherImportResult,
  StockVoucherLineProblem,
  StockVoucherPayload,
  StockVoucherSaveResult,
  StockVoucherPostResult,
  StockVoucherSuccessResponse,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import { OpeningStockLookupService } from './opening-stock-lookup.service';
import type { OpeningStockItemLookup } from './types/opening-stock-lookup.types';
import { SaveOpeningStockVoucherDto } from './dto/save-opening-stock-voucher.dto';
import {
  GetOpeningStockVoucherQueryDto,
  OpeningStockItemLookupQueryDto,
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
  OpeningStockSaveSuccessDto,
  OpeningStockErrorResponseDto,
  OpeningStockDocumentSuccessDto,
  OpeningStockPostSuccessDto,
  OpeningStockImportSuccessDto,
  OpeningStockItemLookupSuccessDto,
  OpeningStockValidateSuccessDto,
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
/**
 * accounts.acc_voucher_types row "OPENING" / Opening Stock. Its numbering
 * format (prefix `OPN`, no suffix, width 4, yearly reset) seeds the
 * acc_voucher_seq row that svh_refno is drawn from — `OPN0001`.
 */
const OPENING_VCHR_TYPE_ID = 1;

const OPENING_RULES: StockVoucherTypeRules = {
  voucherType: 'OPENING',
  typeCode: 'OPN',
  refnoVchrTypeId: OPENING_VCHR_TYPE_ID,
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
  constructor(
    private readonly stockVoucherService: StockVoucherService,
    private readonly lookupService: OpeningStockLookupService,
  ) {}

  /**
   * 19q Q6. Runs ONCE per item picked on the line grid and fills the whole
   * line in one round trip: unit, base unit, factor, tax, and how the item is
   * tracked. It returns NO COST — see OpeningStockItemLookup for why a seeded
   * cost cell would silently disable the engine's rate source.
   *
   * Empty is a 404 that names the cause: no such item, an inactive or service item, no unit
   * conversion at all, or a unit that is not one of the item's.
   */
  @Get('item-lookup')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The item picker — fill an opening line for one item',
    description:
      'Unit, base unit (as an iuc_id), conversion factor, tax and cess, the tracking signature in force on onDate, an MRP / sale-price seed for the bucket, and whether the item has already been opened in this branch. Deliberately returns no cost: the cost cell stays empty unless a human types one, so the engine can apply the rate source. 404 names which of the four causes left the item unpickable.',
  })
  @ApiOkResponse({ type: OpeningStockItemLookupSuccessDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async lookupItem(
    @Query() query: OpeningStockItemLookupQueryDto,
  ): Promise<StockVoucherSuccessResponse<OpeningStockItemLookup>> {
    const data = await this.lookupService.lookupItem(query);
    return {
      success: true,
      // The warning goes in the message too, so a client that shows messages
      // and ignores flags still hears it while the operator is typing.
      message: data.alreadyOpened
        ? `${data.itemName} has already been opened in this branch`
        : 'Item fetched successfully',
      data,
    };
  }

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update an opening stock document (by header.svhId presence)',
    description:
      "Update is a full replace of the lines. Saves a DRAFT unless header.status is 'POSTED', which saves and posts in one transaction — preflight, lots, ledger, balance and the status trail — so a line the preflight refuses fails the save too. rowsPosted on the response is null for a draft.",
  })
  @ApiCreatedResponse({ type: OpeningStockSaveSuccessDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: OpeningStockErrorResponseDto })
  @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async save(
    @Body() dto: SaveOpeningStockVoucherDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherSaveResult>> {
    const data = await this.stockVoucherService.save(OPENING_RULES, dto);
    // The message says which of the two things actually happened, because a
    // save that also posted moved stock and the user is entitled to see that
    // said out loud rather than inferring it from the status field.
    const saved = dto.header.svhId ? 'updated' : 'created';
    return {
      success: true,
      message:
        data.rowsPosted === null
          ? `Opening stock ${saved} successfully`
          : `Opening stock ${saved} and posted successfully — ${data.rowsPosted} ledger rows`,
      data,
    };
  }

  /**
   * ONE DOCUMENT, ALWAYS. This route used to list as well — `svhId` absent meant
   * "list them", with status, date, search and paging filters. `svhId` is now
   * required, so that branch is unreachable and has been removed rather than
   * left in as code no request can enter.
   *
   * `StockVoucherService.list` is untouched and still serves the other voucher
   * screens; a list for openings can be given its own path whenever the screen
   * needs one.
   */
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Load one opening stock document by svhId',
    description:
      'Loads the document named by svhId, header and lines. This route does not list: svhId is required, and there are no status, date, search or paging filters — sending one is a 400.',
  })
  @ApiOkResponse({ type: OpeningStockDocumentSuccessDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async load(
    @Query() query: GetOpeningStockVoucherQueryDto,
  ): Promise<StockVoucherSuccessResponse<StockVoucherPayload>> {
    const data = await this.stockVoucherService.getById(
      OPENING_RULES,
      query.svhId,
      query.accYear,
      query.companyId,
      query.branchId,
    );
    return { success: true, message: 'Opening stock fetched successfully', data };
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
    summary: 'Cancel a DRAFT or a POSTED opening — never a delete',
    description:
      'A DRAFT is cancelled by moving the header: it has written no ledger row, so `rowsReversed` is 0 and nothing about stock can refuse it. Cancelling a draft is not the same act as deleting one — a cancelled draft stays on the list, numbered, with the reason on its trail, while a soft delete takes it out of play as though it had never been raised. Both are offered; the reason is what makes cancel the honest choice for an abandoned document.\n\n' +
      'A POSTED opening is reversed, and that can legitimately fail with 409: cancelling an opening after stock has been sold from it drives the holding negative, which fn_sml_apply refuses under BLOCK. The fix is an ADJUSTMENT, not a retry.\n\n' +
      'An already-CANCELLED opening is refused with the date it was cancelled on.',
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
      message: data.rowsReversed
        ? `Opening stock cancelled successfully — ${data.rowsReversed} reversal rows`
        : 'Opening stock cancelled successfully — no stock had moved, so nothing was reversed',
      data,
    };
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
