import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UseFilters,
  Version,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import type { LabelRenderOutcome } from '../../settings/print-render/print-render.service';
import {
  StickerFromItemsQueryDto,
  StickerJobGetQueryDto,
  StickerJobStatusDto,
  StickerLotsQueryDto,
  StickerPreviewDto,
  StickerPrintDto,
  StickerReprintDto,
  StickerResendDto,
  StickerResolveDto,
  StickerTestPrintDto,
} from './dto/sticker-request.dto';
import {
  StickerFromItemsDataDto,
  StickerJobGetDataDto,
  StickerJobInspectDto,
  StickerJobStatusDataDto,
  StickerLotsDataDto,
  StickerResolveDataDto,
} from './dto/sticker-response.dto';
import { StickerExceptionFilter } from './sticker-exception.filter';
import { StickerJobsService, StickerPdfAnswer } from './sticker-jobs.service';
import { StickerLinesService } from './sticker-lines.service';
import { StickerJobInspect } from './types/sticker.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const ok = (description: string, model: unknown) => ({
  description,
  schema: {
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: { $ref: getSchemaPath(model as never) },
    },
  },
});

const JOB_PDF_NOTE =
  'Answers application/pdf with X-Sticker-Job-Id, X-Sticker-Job-No, X-Sticker-Acc-Year, ' +
  'X-Sticker-Labels, X-Sticker-Pages, X-Print-Warnings (the count) and, when there is a warning, ' +
  'X-Print-Warning-Texts (standard base64 of the UTF-8 JSON array of the warning strings, at most 20); ' +
  'inspect=true answers JSON instead (the job is still made; data.warnings holds the same strings). ' +
  'The job is SENT; the counter reports PRINTED / FAILED through /jobs/status.';

/**
 * /stickers — Sticker Printing (menu 32, plan S-P1 §7.2). Own routes, own DTOs.
 *
 * Reads need View on menu 32 (STICKER_RIGHT_VIEW), job writes Print
 * (STICKER_RIGHT_PRINT), Test print Print on Print Assignments 248
 * (PRINT_ASSIGN_RIGHT_PRINT). No route is cached: every answer depends on the
 * caller's rights, counter and the stock a moment ago. The Printed jobs list
 * is grid 223 (/configured-grid-sql/run) — no /list route.
 */
@ApiTags('Sticker Printing')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({
  type: HttpErrorResponseDto,
  description: 'STICKER_RIGHT_VIEW / STICKER_RIGHT_PRINT',
})
@ApiExtraModels(
  StickerFromItemsDataDto,
  StickerResolveDataDto,
  StickerLotsDataDto,
  StickerJobInspectDto,
  StickerJobStatusDataDto,
  StickerJobGetDataDto,
)
@Controller('stickers')
@UseFilters(StickerExceptionFilter)
export class StickersController {
  constructor(
    private readonly lines: StickerLinesService,
    private readonly jobs: StickerJobsService,
  ) {}

  @Get('lines/from-items')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Add items · F3: sticker lines for the items a filter picks',
    description:
      'Items of the company (or shared), live, active, not services; stickerOnly (default true) = ticked ' +
      '"Sticker". labelsMode ONE / TYPED (labelsEach) / STOCK (SALEABLE stock here in the Def unit, rounded ' +
      'down; a decimal unit gives 1; no stock → not added, counted in skipped.noStock). More than 500 items → ' +
      'STICKER_TOO_MANY_ITEMS.',
  })
  @ApiOkResponse(ok('lines, skipped, assignment', StickerFromItemsDataDto))
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description:
      'STICKER_BRANCH_NOT_IN_COMPANY, STICKER_PURPOSE_INVALID, STICKER_LABELS_INVALID (TYPED), STICKER_TOO_MANY_ITEMS',
  })
  async fromItems(@Query() q: StickerFromItemsQueryDto): Promise<Ok<StickerFromItemsDataDto>> {
    const data = await this.jobs.fromItems(q);
    return { success: true, message: `${data.lines.length} line(s)`, data };
  }

  @Post('lines/resolve')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Scan / type, and every re-resolve of the list (purpose or price level changed)',
    description:
      'Each line names code or itemId (+ unitId, lotId, templateId, labels). Same order and keys back. A bad ' +
      'line answers 200 with its problem (STICKER_CODE_NOT_FOUND, STICKER_ITEM_NOT_FOUND, ' +
      'STICKER_UNIT_NOT_OF_ITEM, STICKER_LOT_NOT_OF_ITEM, STICKER_DESIGN_*, STICKER_LABELS_INVALID, ' +
      'STICKER_BARCODE_TOO_LONG, STICKER_BATCH_TOO_LONG).',
  })
  @ApiOkResponse(ok('lines, assignment', StickerResolveDataDto))
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description:
      'STICKER_BRANCH_NOT_IN_COMPANY, STICKER_PURPOSE_INVALID, STICKER_TOO_MANY_ITEMS (> 500 lines)',
  })
  async resolve(@Body() body: StickerResolveDto): Promise<Ok<StickerResolveDataDto>> {
    const data = await this.jobs.resolve(body);
    return { success: true, message: `${data.lines.length} line(s)`, data };
  }

  @Get('lots')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The lot list of a line: lots with SALEABLE stock here, newest first',
    description: 'onHandQty is in the unit asked for.',
  })
  @ApiOkResponse(ok('lots', StickerLotsDataDto))
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'STICKER_ITEM_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'STICKER_BRANCH_NOT_IN_COMPANY, STICKER_UNIT_NOT_OF_ITEM',
  })
  async lots(@Query() q: StickerLotsQueryDto): Promise<Ok<StickerLotsDataDto>> {
    await this.lines.assertRight('view');
    const lots = await this.lines.lots(q);
    return { success: true, message: `${lots.length} lot(s)`, data: { lots } };
  }

  @Post('preview')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'One label of the selected line (the side pane): a PDF, nothing logged',
    description:
      'The label as a person reads it, alone on its page, through the same label path as the jobs. ' +
      'printerDpi snaps the bars (else the design’s dpi).',
  })
  @ApiProduces('application/pdf')
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'STICKER_DESIGN_NOT_FOUND, STICKER_ITEM_NOT_FOUND',
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description:
      'STICKER_DESIGN_NOT_PUBLISHED, STICKER_DESIGN_NOT_LABEL, STICKER_UNIT_NOT_OF_ITEM, STICKER_LOT_NOT_OF_ITEM',
  })
  async preview(
    @Body() body: StickerPreviewDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const outcome = await this.jobs.preview(body);
    this.sendPdf(response, outcome, 'sticker-preview');
  }

  @Post('jobs/print')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Print one design group: re-resolve, freeze, number per counter, render',
    description:
      'Order: right → branch → purpose → design (live, published, label sheet, the job’s purpose) → ' +
      'printer → counter → every line re-resolved (item / unit / lot, lot required, barcode when the design ' +
      'prints one, labels 1-9,999) → ≤ 5,000 labels → number + render + job + SENT step in one transaction. ' +
      JOB_PDF_NOTE,
  })
  @ApiProduces('application/pdf', 'application/json')
  @ApiOkResponse(ok('inspect=true', StickerJobInspectDto))
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description:
      'STICKER_DESIGN_NOT_FOUND, STICKER_ITEM_NOT_FOUND, STOCK_DEVICE_NOT_FOUND, STOCK_DEVICE_BLOCKED',
  })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description:
      'STICKER_BRANCH_NOT_IN_COMPANY, STICKER_PURPOSE_INVALID, STICKER_NO_DESIGN, STICKER_DESIGN_NOT_PUBLISHED, ' +
      'STICKER_DESIGN_NOT_LABEL (rule=PURPOSE), STICKER_NO_PRINTER, STICKER_NOTHING_TO_PRINT, STICKER_TOO_MANY_ITEMS, ' +
      'STICKER_UNIT_NOT_OF_ITEM, STICKER_LOT_NOT_OF_ITEM, STICKER_LOT_REQUIRED, STICKER_LINE_NO_BARCODE, ' +
      'STICKER_LABELS_INVALID, STICKER_TOO_MANY_LABELS, STICKER_BARCODE_TOO_LONG, STICKER_BATCH_TOO_LONG',
  })
  async print(
    @Body() body: StickerPrintDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Ok<StickerJobInspect> | void> {
    return this.answerJob(
      response,
      await this.jobs.print(body),
      body.inspect === true,
      'Sticker job printed',
    );
  }

  @Post('jobs/status')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'The counter that printed reports PRINTED or FAILED (the one status step)',
    description: 'txn_status_log seq 2 (PRINTED / PRINT_FAILED). printerMessage is kept on FAILED.',
  })
  @ApiOkResponse(ok('jobId, jobNo, status, statusOn', StickerJobStatusDataDto))
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'STICKER_JOB_NOT_FOUND' })
  @ApiConflictResponse({ type: HttpErrorResponseDto, description: 'STICKER_JOB_STATUS_SET' })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'STICKER_JOB_OTHER_COUNTER' })
  async status(@Body() body: StickerJobStatusDto): Promise<Ok<StickerJobStatusDataDto>> {
    const data = await this.jobs.status(body);
    return { success: true, message: `Job ${data.jobNo} ${data.status.toLowerCase()}`, data };
  }

  @Post('jobs/reprint')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reprint lines of a PRINTED job with a reason: a new REPRINT job',
    description:
      'A reprint job’s Reprint opens its original. The new lines copy the original’s frozen figures and ' +
      'design revision and point at the original lines. ' +
      JOB_PDF_NOTE,
  })
  @ApiProduces('application/pdf', 'application/json')
  @ApiOkResponse(ok('inspect=true', StickerJobInspectDto))
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'STICKER_JOB_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description:
      'STICKER_REASON_REQUIRED, STICKER_REASON_INVALID, STICKER_NOTE_REQUIRED, STICKER_REPRINT_NOT_PRINTED, ' +
      'STICKER_LINE_NOT_ON_JOB, STICKER_LABELS_INVALID, STICKER_NOTHING_TO_PRINT, STICKER_TOO_MANY_LABELS, ' +
      'STICKER_NO_PRINTER',
  })
  async reprint(
    @Body() body: StickerReprintDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Ok<StickerJobInspect> | void> {
    return this.answerJob(
      response,
      await this.jobs.reprint(body),
      body.inspect === true,
      'Sticker job reprinted',
    );
  }

  @Post('jobs/resend')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a FAILED job again: a new PRINT job, no reason',
    description:
      'Same frozen lines and revision; refused once a resend of it has printed. ' + JOB_PDF_NOTE,
  })
  @ApiProduces('application/pdf', 'application/json')
  @ApiOkResponse(ok('inspect=true', StickerJobInspectDto))
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'STICKER_JOB_NOT_FOUND' })
  @ApiConflictResponse({ type: HttpErrorResponseDto, description: 'STICKER_ALREADY_RESENT' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'STICKER_RESEND_NOT_FAILED, STICKER_NO_PRINTER',
  })
  async resend(
    @Body() body: StickerResendDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Ok<StickerJobInspect> | void> {
    return this.answerJob(
      response,
      await this.jobs.resend(body),
      body.inspect === true,
      'Sticker job sent again',
    );
  }

  @Get('jobs/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One job: head, frozen lines with Reprinted, and its reprints',
    description: 'The Printed jobs list itself is grid 223.',
  })
  @ApiOkResponse(ok('job, lines, reprints', StickerJobGetDataDto))
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'STICKER_JOB_NOT_FOUND' })
  async get(@Query() q: StickerJobGetQueryDto): Promise<Ok<StickerJobGetDataDto>> {
    const data = await this.jobs.get(q);
    return { success: true, message: `Job ${String(data.job.jobNo)}`, data };
  }

  @Post('test-print')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Print Assignments · Test print: ONE test label in cell 1 of the design’s page',
    description:
      'Frame, "TEST · counter · printer", dpi and size, a 1-4 dot bar ladder, Aa 6 / 8 / 10, Tamil, EAN-13 ' +
      '4006381333931. The published revision, else the newest. Not logged. Needs Print on menu 248.',
  })
  @ApiProduces('application/pdf')
  @ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'PRINT_ASSIGN_RIGHT_PRINT' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'STICKER_DESIGN_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    type: HttpErrorResponseDto,
    description: 'STICKER_DESIGN_NOT_LABEL',
  })
  async testPrint(
    @Body() body: StickerTestPrintDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const outcome = await this.jobs.testPrint(body);
    this.sendPdf(response, outcome, 'test-label');
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  private answerJob(
    response: Response,
    answer: StickerPdfAnswer,
    inspect: boolean,
    message: string,
  ): Ok<StickerJobInspect> | void {
    response.setHeader('X-Sticker-Job-Id', answer.inspect.jobId);
    response.setHeader('X-Sticker-Job-No', answer.inspect.jobNo);
    response.setHeader('X-Sticker-Acc-Year', answer.inspect.accYear);
    response.setHeader('X-Sticker-Labels', String(answer.inspect.labels));
    response.setHeader('X-Sticker-Pages', String(answer.inspect.pages));
    if (inspect) {
      response.setHeader('X-Print-Warnings', String(answer.inspect.warnings.length));
      return { success: true, message, data: answer.inspect };
    }
    this.sendPdf(response, answer.outcome, answer.inspect.jobNo);
  }

  private sendPdf(response: Response, outcome: LabelRenderOutcome, stem: string): void {
    const safeStem = stem.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'stickers';
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Length', String(outcome.bytes.length));
    response.setHeader('Content-Disposition', `inline; filename="${safeStem}.pdf"`);
    response.setHeader('X-Print-Template-Id', outcome.templateId);
    response.setHeader('X-Print-Version-Id', outcome.versionId);
    response.setHeader('X-Print-Rev-No', String(outcome.revNo));
    response.setHeader('X-Print-Pages', String(outcome.pageCount));
    response.setHeader('X-Print-Dpi', String(outcome.printDpi));
    response.setHeader('X-Print-Warnings', String(outcome.warnings.length));
    const texts = warningTextsHeader(outcome);
    if (texts) {
      response.setHeader(WARNING_TEXTS_HEADER, texts);
    }
    response.setHeader('Cache-Control', 'no-store');
    response.end(outcome.bytes);
  }
}

/**
 * The render's warnings, readable before the PDF goes to the printer (review
 * SF3): header `X-Print-Warning-Texts` = standard base64 of the UTF-8 JSON
 * array of the warning strings — the same strings, in the same order, as the
 * inspect answer's `warnings` — at most 20 of them, and at most 2,048
 * characters ENCODED (RR9: a proxy with a 4 KB header buffer must not turn a
 * job already committed as SENT into a 502). Entries are dropped from the end
 * until it fits; a first entry that alone is too long is cut, ending "…". Sent
 * only when there is at least one warning; `X-Print-Warnings` stays the full
 * count. (A header value is Latin-1 on the wire, so the Tamil / "×" in a
 * warning travels base64.)
 */
export const WARNING_TEXTS_HEADER = 'X-Print-Warning-Texts';
export const WARNING_TEXTS_MAX = 20;
export const WARNING_TEXTS_MAX_ENCODED = 2048;

const encodeTexts = (texts: readonly string[]): string =>
  Buffer.from(JSON.stringify(texts), 'utf8').toString('base64');

export function warningTextsHeader(outcome: Pick<LabelRenderOutcome, 'warnings'>): string | null {
  if (outcome.warnings.length === 0) {
    return null;
  }
  let texts = outcome.warnings.slice(0, WARNING_TEXTS_MAX).map((warning) => warning.message);
  let encoded = encodeTexts(texts);
  while (encoded.length > WARNING_TEXTS_MAX_ENCODED && texts.length > 1) {
    texts = texts.slice(0, -1);
    encoded = encodeTexts(texts);
  }
  if (encoded.length <= WARNING_TEXTS_MAX_ENCODED) {
    return encoded;
  }
  // One warning alone is too long: keep the longest start of it that fits
  // (whole code points, so the UTF-8 stays valid), ending "…".
  const chars = [...texts[0]];
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (encodeTexts([`${chars.slice(0, middle).join('')}…`]).length <= WARNING_TEXTS_MAX_ENCODED) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return encodeTexts([`${chars.slice(0, low).join('')}…`]);
}
