import { Body, Controller, Get, HttpCode, Post, Res, UseFilters, Version } from '@nestjs/common';
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
import type { Response } from 'express';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { throwSettingsBadRequest } from 'src/common/utils/module-service.utils';
import { PrintDataProviderRegistry } from './data/print-data-provider.registry';
import { RenderDocumentDto } from './dto/render-document.dto';
import { RenderPreviewDto } from './dto/render-preview.dto';
import {
  PrintRenderProvidersSuccessDto,
  PrintRenderErrorResponseDto,
  PrintRenderInspectSuccessDto,
} from './dto/print-render-response.dto';
import { PrintRenderService } from './print-render.service';
import { OutputMode } from './definition/template-definition.schema';
import {
  PrintRenderErrorDetail,
  PrintRenderErrorResponse,
  PrintRenderSuccessResponse,
  RenderContext,
  RenderInspection,
  RenderOutcome,
} from './types/print-render-api.types';
import { PrintRenderExceptionFilter } from './print-render-exception.filter';

/**
 * §8's HTTP surface.
 *
 * Two verbs, and the difference between them is what the printing subsystem is
 * actually about:
 *
 *   /preview  renders a REVISION you name. Nothing is logged.
 *   /print    renders whatever the assignment ladder resolves to for this
 *             counter, and writes one print_log row per copy.
 *
 * Neither takes a company: it comes from the authenticated context. A render
 * reads a company's documents, and a company id in the body would make either
 * of these a cross-tenant read with a friendly name.
 *
 * ── WHY THIS IS NOT UNDER /reports ─────────────────────────────────────────
 *
 * It is not the old reporting module coming back. `/reports/*` was a parallel
 * subsystem with its own tables, its own templates and its own idea of which
 * design was default; it was removed, its schema dropped. This renders the
 * printing engine's own tables — print_template_version's body,
 * print_template_dataset's queries, print_template_assignment's choice — and
 * has no storage of its own at all.
 */
@ApiTags('Print Render')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('print-render')
@UseFilters(PrintRenderExceptionFilter)
export class PrintRenderController {
  constructor(
    private readonly printRenderService: PrintRenderService,
    private readonly providers: PrintDataProviderRegistry,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post('preview')
  @Version(API_VERSION)
  // A render CREATES nothing — it reads a revision and returns bytes. Nest's
  // default 201 for POST would tell every caller a resource came into being,
  // and the one thing that might (a print_log row) is not this route's.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Render one revision — the designer’s Preview',
    description:
      'Returns the rendered bytes (application/pdf, or application/octet-stream for a text ' +
      'engine), or JSON when inspect=true. The paper and the datasets always come from the ' +
      'revision; an unsaved `body` may stand in for the stored bands, but only against a DRAFT.',
  })
  @ApiProduces('application/pdf', 'application/octet-stream', 'application/json')
  @ApiOkResponse({ type: PrintRenderInspectSuccessDto })
  @ApiBadRequestResponse({ type: PrintRenderErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintRenderErrorResponseDto })
  async preview(
    @Body() dto: RenderPreviewDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PrintRenderSuccessResponse<RenderInspection> | void> {
    const outcome = await this.printRenderService.preview({
      versionId: dto.versionId,
      context: this.contextFrom(dto),
      params: dto.params ?? {},
      ...(dto.outputMode ? { outputMode: dto.outputMode as OutputMode } : {}),
      ...(dto.copies ? { copies: dto.copies } : {}),
      ...(dto.body ? { body: dto.body } : {}),
    });

    if (dto.inspect) {
      return {
        success: true,
        message: 'Preview rendered successfully',
        data: this.inspect(outcome),
      };
    }

    this.send(response, outcome, dto.filename ?? `preview-rev-${outcome.revNo}`);
  }

  @Post('print')
  @Version(API_VERSION)
  // 200 rather than 201 for the same reason as /preview. The print_log rows this
  // one does append are a record OF the render, not the thing being returned;
  // their ids come back in X-Print-Log-Ids.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Print a document through the assignment ladder',
    description:
      'Resolves which design wins for this counter (counter → branch → company → every ' +
      'company), renders every copy the purpose calls for, and appends one print_log row per ' +
      'copy. There is deliberately no templateId: which design wins is a row in ' +
      'print_template_assignment, and a second place to decide it would drift from the first.',
  })
  @ApiProduces('application/pdf', 'application/octet-stream', 'application/json')
  @ApiOkResponse({ type: PrintRenderInspectSuccessDto })
  @ApiBadRequestResponse({ type: PrintRenderErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintRenderErrorResponseDto })
  async print(
    @Body() dto: RenderDocumentDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PrintRenderSuccessResponse<RenderInspection> | void> {
    const outcome = await this.printRenderService.print({
      purposeId: dto.purposeId,
      context: this.contextFrom(dto),
      params: dto.params ?? {},
      ...(dto.srcModule ? { srcModule: dto.srcModule } : {}),
      ...(dto.srcDocType ? { srcDocType: dto.srcDocType } : {}),
      ...(dto.assignmentOutputMode ? { assignmentOutputMode: dto.assignmentOutputMode } : {}),
      ...(dto.outputMode ? { outputMode: dto.outputMode as OutputMode } : {}),
      ...(dto.copies ? { copies: dto.copies } : {}),
      ...(dto.isReprint ? { isReprint: dto.isReprint } : {}),
    });

    response.setHeader('X-Print-Log-Ids', outcome.printLogIds.join(','));
    response.setHeader('X-Print-Scope', outcome.assignment.scope);

    if (dto.inspect) {
      return {
        success: true,
        message: 'Document printed successfully',
        data: { ...this.inspect(outcome), printLogIds: outcome.printLogIds },
      };
    }

    this.send(response, outcome, dto.filename ?? `${dto.srcDocType ?? 'document'}-${dto.docId}`);
  }

  @Get('providers')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The dataset providers this build carries',
    description:
      'What a ptdProviderCode may name. A provider is CODE, so a template naming one this ' +
      'build does not have cannot be fixed by editing data — this is the list to check against.',
  })
  @ApiOkResponse({ type: PrintRenderProvidersSuccessDto })
  providerList(): PrintRenderSuccessResponse<
    Array<{ code: string; label: string; cardinality: string }>
  > {
    return {
      success: true,
      message: 'Print data providers retrieved successfully',
      data: this.providers.describe(),
    };
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  /**
   * The closed context set, assembled from the authenticated session and the
   * request.
   *
   * The company comes from the session and CANNOT come from the body. Everything
   * else is a property of what is being printed rather than of who is printing,
   * so it arrives with the request.
   */
  private contextFrom(dto: RenderPreviewDto | RenderDocumentDto): RenderContext {
    const companyId = this.requestContextService.getCompanyId();

    if (!companyId) {
      // Not an authorisation failure — the token is fine — but a render with no
      // company cannot scope a single one of its queries.
      throwSettingsBadRequest<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'No company in the request context',
        [
          {
            field: 'companyId',
            message:
              'Every dataset is company-scoped and the company comes from the authenticated ' +
              'session, never from the request. Re-authenticate against a company.',
          },
        ],
      );
    }

    return {
      companyId,
      branchId: dto.branchId ?? null,
      accYear: dto.accYear ?? null,
      docId: dto.docId ?? null,
      userId: this.requestContextService.getUserId(),
      deviceId: dto.deviceId ?? null,
    };
  }

  /**
   * The bytes, with the render's own facts in headers.
   *
   * A browser gets a PDF it can show inline; a print agent gets an octet-stream
   * it can copy to a queue. The headers carry what a caller would otherwise have
   * to make a second, inspecting request to learn — which revision drew this,
   * how many pages came out, and whether anything went wrong that did not stop
   * the render.
   */
  private send(response: Response, outcome: RenderOutcome, stem: string): void {
    const safeStem = stem.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'print';

    response.setHeader('Content-Type', outcome.contentType);
    response.setHeader('Content-Length', String(outcome.bytes.length));
    response.setHeader(
      'Content-Disposition',
      `${outcome.outputMode === 'PDF' ? 'inline' : 'attachment'}; filename="${safeStem}.${outcome.extension}"`,
    );
    response.setHeader('X-Print-Template-Id', outcome.templateId);
    response.setHeader('X-Print-Version-Id', outcome.versionId);
    response.setHeader('X-Print-Rev-No', String(outcome.revNo));
    response.setHeader('X-Print-Output-Mode', outcome.outputMode);
    response.setHeader('X-Print-Pages', String(outcome.pageCount));
    response.setHeader('X-Print-Copies', String(outcome.copies));
    response.setHeader('X-Print-Warnings', String(outcome.warnings.length));
    // A render is not cacheable: the same URL renders today's data.
    response.setHeader('Cache-Control', 'no-store');

    response.end(outcome.bytes);
  }

  /**
   * The render's own account of itself, WITHOUT the rows.
   *
   * `ResolvedDataset.value` holds every row the render read — which is the
   * point internally, and entirely wrong to send back here. `inspect` answers
   * "did my query return anything, how long did it take, what went wrong", and
   * a detail dataset at its 5,000-row limit would make that answer several
   * megabytes of JSON nobody asked for. The counts are what the question is
   * about; the rows are on the page.
   */
  private inspect(outcome: RenderOutcome): RenderInspection {
    const { bytes, datasets, ...rest } = outcome;
    return {
      ...rest,
      // Listed field by field rather than destructured, so what this endpoint
      // discloses is a decision on the page rather than whatever `ResolvedDataset`
      // happens to carry after the next change to it.
      datasets: datasets.map((dataset) => ({
        name: dataset.name,
        datasetNo: dataset.datasetNo,
        role: dataset.role,
        sourceKind: dataset.sourceKind,
        rowCount: dataset.rowCount,
        durationMs: dataset.durationMs,
        truncated: dataset.truncated,
      })),
      byteCount: bytes.length,
    };
  }
}
