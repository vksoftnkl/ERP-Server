import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { OutputMode } from '../templates/dto/template-definition.schema';
import { BulkPrintJobData, BulkPrintResult } from './bulk-print.processor';
import { BulkPrintDto, PreviewDto, PrintQueryDto } from './dto/print-request.dto';
import { MAX_BULK_DOCUMENTS, REPORT_QUEUE_NAMES } from './print.constants';
import { ReportRenderService } from './report-render.service';

/**
 * The print API.
 *
 * Three entry points, and the split between them is a load-shedding decision
 * rather than a stylistic one:
 *
 *   GET  .../print        one document, rendered inline. Bounded work.
 *   POST .../bulk-print   many documents, queued. See BulkPrintProcessor for
 *                         why this cannot be a loop in the handler.
 *   POST .../preview      an unsaved definition against sample data, for the
 *                         designer. No database read of the document at all.
 */
@ApiTags('Report Printing')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('reports')
export class PrintController {
  constructor(
    private readonly renderService: ReportRenderService,
    private readonly requestContext: RequestContextService,
    @InjectQueue(REPORT_QUEUE_NAMES.BULK_PRINT) private readonly bulkQueue: Queue,
  ) {}

  @Get(':docType/:docId/print')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Render one document. Returns application/pdf for PDF mode, or raw ' +
      'printer bytes (application/octet-stream) for the thermal and dot-matrix modes.',
  })
  @ApiProduces('application/pdf', 'application/octet-stream')
  @ApiOkResponse({ description: 'The rendered document.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  // Never cache a document: a reprint after an amendment must show the
  // amendment, and a proxy holding yesterday's invoice is a compliance problem.
  @Header('Cache-Control', 'no-store, private')
  async print(
    @Param('docType') docType: string,
    @Param('docId') docId: string,
    @Query() query: PrintQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const companyId = this.requireCompanyId();

    const rendered = await this.renderService.render({
      docType: docType.toUpperCase(),
      docId,
      outputMode: (query.mode ?? 'PDF') as OutputMode,
      paperCode: query.paper ?? 'A4',
      companyId,
      branchId: query.branchId ?? null,
      accYear: query.accYear,
      userId: this.requestContext.getUserId(),
      templateId: query.templateId,
      printerProfileCode: query.printerProfile,
      params: query.partyId ? { partyId: query.partyId, asOn: query.asOn } : undefined,
    });

    const fileName = `${docType.toLowerCase()}-${docId}.${rendered.extension}`;

    response
      .status(200)
      .setHeader('Content-Type', rendered.contentType)
      .setHeader('Content-Length', rendered.bytes.length)
      // `inline` so a browser opens a PDF in its viewer rather than downloading
      // it — the web client prints from an iframe.
      .setHeader('Content-Disposition', `inline; filename="${fileName}"`)
      // Diagnostics the desktop and web clients log when a print looks wrong.
      // Which template rendered a document is the first question every time.
      .setHeader('X-Report-Template-Id', rendered.templateId)
      .setHeader('X-Report-Template-Version', String(rendered.templateVersion))
      .setHeader('X-Report-Template-Source', rendered.templateSource)
      .setHeader('X-Report-Page-Count', String(rendered.pageCount))
      .setHeader('X-Report-Render-Ms', String(rendered.durationMs))
      .send(rendered.bytes);
  }

  @Post('preview')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Render an UNSAVED definition, by default against provider sample data. ' +
      'This is the designer preview, and it is authoritative: the canvas is an ' +
      'approximation, this is the real engine.',
  })
  @ApiProduces('application/pdf', 'application/octet-stream')
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @Header('Cache-Control', 'no-store, private')
  async preview(@Body() dto: PreviewDto, @Res() response: Response): Promise<void> {
    const companyId = this.requireCompanyId();

    const rendered = await this.renderService.preview(dto.definition, {
      outputMode: dto.mode as OutputMode | undefined,
      companyId,
      branchId: dto.branchId ?? null,
      accYear: dto.accYear ?? currentAccYear(),
      userId: this.requestContext.getUserId(),
      docId: dto.docId,
      useSampleData: dto.useSampleData,
      printerProfileCode: dto.printerProfile,
      params: dto.params,
    });

    response
      .status(200)
      .setHeader('Content-Type', rendered.contentType)
      .setHeader('Content-Length', rendered.bytes.length)
      .setHeader('Content-Disposition', `inline; filename="preview.${rendered.extension}"`)
      .setHeader('X-Report-Page-Count', String(rendered.pageCount))
      .setHeader('X-Report-Render-Ms', String(rendered.durationMs))
      .send(rendered.bytes);
  }

  @Post('bulk-print')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Queue a batch render. Returns a job id immediately — rendering a hundred ' +
      'documents inline would block the event loop and stall the whole API.',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async bulkPrint(
    @Body() dto: BulkPrintDto,
  ): Promise<{ success: true; message: string; data: { jobId: string; queued: number } }> {
    const companyId = this.requireCompanyId();

    const docIds = [...new Set(dto.docIds.map((docId) => docId.trim()).filter(Boolean))];

    if (docIds.length === 0) {
      throw new BadRequestException('docIds must contain at least one document id');
    }
    if (docIds.length > MAX_BULK_DOCUMENTS) {
      throw new BadRequestException(
        `A bulk print job is capped at ${MAX_BULK_DOCUMENTS} documents; ${docIds.length} were requested. Split the batch.`,
      );
    }

    const jobData: BulkPrintJobData = {
      docType: dto.docType.toUpperCase(),
      docIds,
      outputMode: (dto.mode ?? 'PDF') as OutputMode,
      paperCode: dto.paper ?? 'A4',
      companyId,
      branchId: dto.branchId ?? null,
      accYear: dto.accYear,
      userId: this.requestContext.getUserId(),
      templateId: dto.templateId,
      printerProfileCode: dto.printerProfile,
      params: dto.params,
    };

    const job = await this.bulkQueue.add('bulk-print', jobData, {
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
      attempts: 1,
    });

    return {
      success: true,
      message: 'Bulk print job queued successfully',
      data: { jobId: String(job.id), queued: docIds.length },
    };
  }

  @Get('jobs/:jobId')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Bulk print job status and, once finished, its per-document results.' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async jobStatus(@Param('jobId') jobId: string): Promise<{
    success: true;
    message: string;
    data: {
      jobId: string;
      state: string;
      progress: number;
      result: BulkPrintResult | null;
      failedReason: string | null;
    };
  }> {
    const job = await this.bulkQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(
        `Bulk print job ${jobId} not found. Completed jobs are retained for 24 hours.`,
      );
    }

    const state = await job.getState();
    const progress = typeof job.progress === 'number' ? job.progress : 0;

    return {
      success: true,
      message: 'Bulk print job status fetched successfully',
      data: {
        jobId: String(job.id),
        state,
        progress,
        result: (job.returnvalue as BulkPrintResult | undefined) ?? null,
        failedReason: job.failedReason ?? null,
      },
    };
  }

  /**
   * The company every render is scoped to.
   *
   * Taken from the authenticated request context, never from a query
   * parameter. A caller-supplied company id would make every print endpoint a
   * cross-tenant read.
   */
  private requireCompanyId(): string {
    const companyId = this.requestContext.getCompanyId();
    if (!companyId) {
      throw new BadRequestException(
        'No company in the request context. Printing requires an authenticated company session.',
      );
    }
    return companyId;
  }
}

/**
 * The Indian fiscal year containing today, as 'YYYY-YYYY'.
 * April to March, which is what sb_acc_year holds.
 */
const currentAccYear = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startYear = now.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};
