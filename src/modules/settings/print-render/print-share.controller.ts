import { Body, Controller, Get, Logger, Param, Post, Res, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { API_VERSION } from '../../../common/constants/api-version';
import { Public } from '../../../common/decorators/public.decorator';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { throwSettingsBadRequest } from 'src/common/utils/module-service.utils';
import { CreatePrintShareDto } from './dto/create-print-share.dto';
import { PrintRenderErrorResponseDto } from './dto/print-render-response.dto';
import { PrintRenderExceptionFilter } from './print-render-exception.filter';
import { CreatedPrintShare, PrintShareService } from './print-share.service';
import {
  PrintRenderErrorDetail,
  PrintRenderErrorResponse,
  PrintRenderSuccessResponse,
} from './types/print-render-api.types';
import { PrintRenderErrorCode } from './types/print-render-error-codes';

/** The page a customer sees instead of a PDF. Plain, readable on a phone, no script. */
function messagePage(title: string, message: string): string {
  const escape = (text: string) =>
    text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${escape(title)}</title>` +
    '<style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'background:#f5f5f5;color:#222;display:flex;min-height:100vh;align-items:center;justify-content:center}' +
    'main{background:#fff;border-radius:10px;padding:28px 24px;max-width:420px;margin:16px;' +
    'box-shadow:0 2px 12px rgba(0,0,0,.08)}h1{font-size:19px;margin:0 0 10px}p{margin:0;line-height:1.5}</style>' +
    `</head><body><main><h1>${escape(title)}</h1><p>${escape(message)}</p></main></body></html>`
  );
}

/**
 * Documents shared as a link — the sale bill's WhatsApp send.
 *
 *   POST /print-share/create          authenticated: the operator's screen asks
 *                                     for a link to the revision it just rendered
 *   GET  /print-share/<token>[/<file>] PUBLIC: the customer opens it
 *
 * The open is the one route in the printing module with no session, and it is
 * deliberately narrow: it takes a token and nothing else, renders the frozen
 * context the token names, and answers a person, not a program — a PDF, or a
 * short page saying the link has expired. The optional trailing file name is
 * cosmetic: it makes the link in a chat read as `…/bill-bil00016.pdf`.
 */
@ApiTags('Print Share')
@Controller('print-share')
export class PrintShareController {
  private readonly logger = new Logger(PrintShareController.name);

  constructor(
    private readonly printShareService: PrintShareService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiBearerAuth('access-token')
  @UseFilters(PrintRenderExceptionFilter)
  @ApiOperation({
    summary: 'Create a public link to a rendered document',
    description:
      'Freezes the render context (revision, document, company, branch, year, counter, user) ' +
      'under a random token and returns the path it opens at. The link renders a PDF on every ' +
      'open until it expires (PRINT_SHARE_TTL_DAYS, default 30). `url` is filled when the ' +
      'server knows its public address (PRINT_SHARE_PUBLIC_BASE_URL); otherwise the client ' +
      'puts `path` under its own API base.',
  })
  @ApiCreatedResponse({ description: '{ token, path, url, expiresAt }' })
  @ApiBadRequestResponse({ type: PrintRenderErrorResponseDto })
  @ApiNotFoundResponse({ type: PrintRenderErrorResponseDto })
  async create(
    @Body() dto: CreatePrintShareDto,
  ): Promise<PrintRenderSuccessResponse<CreatedPrintShare>> {
    // The document's company when named, else the session's — `/preview`'s rule.
    const companyId = dto.companyId ?? this.requestContextService.getCompanyId();
    if (!companyId) {
      throwSettingsBadRequest<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'No company in the request context',
        [
          {
            field: 'companyId',
            code: PrintRenderErrorCode.NO_COMPANY,
            message: 'A shared document is rendered in one company’s scope; name it or re-authenticate.',
          },
        ],
      );
    }

    const data = await this.printShareService.create({
      versionId: dto.versionId,
      docId: dto.docId,
      companyId,
      branchId: dto.branchId ?? this.requestContextService.getBranchId(),
      accYear: dto.accYear ?? null,
      deviceId: dto.deviceId ?? this.requestContextService.getDeviceId(),
      userId: this.requestContextService.getUserId(),
      filename: dto.filename ?? null,
    });
    return { success: true, message: 'Share link created', data };
  }

  @Public()
  @Get(':token')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Open a shared document (public)' })
  @ApiParam({ name: 'token' })
  @ApiProduces('application/pdf', 'text/html')
  @ApiOkResponse({ description: 'The PDF, or a page saying why there is none' })
  async open(@Param('token') token: string, @Res() response: Response): Promise<void> {
    await this.serve(token, response);
  }

  @Public()
  @Get(':token/:filename')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Open a shared document (public), with a cosmetic file name' })
  @ApiParam({ name: 'token' })
  @ApiParam({ name: 'filename' })
  @ApiProduces('application/pdf', 'text/html')
  @ApiOkResponse({ description: 'The PDF, or a page saying why there is none' })
  async openNamed(@Param('token') token: string, @Res() response: Response): Promise<void> {
    await this.serve(token, response);
  }

  private async serve(token: string, response: Response): Promise<void> {
    // Nothing here may be cached by a proxy or the phone: the bill can change,
    // and an expired link must stop opening.
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');

    try {
      const opened = await this.printShareService.open(token);
      if (opened.status === 'MISSING') {
        this.html(response, 404, 'Link not found', 'This link is not valid. Please ask the sender for a new one.');
        return;
      }
      if (opened.status === 'EXPIRED') {
        this.html(response, 410, 'Link expired', 'This link has expired. Please ask the sender for a new one.');
        return;
      }
      const { outcome, filename } = opened;
      response.status(200);
      response.setHeader('Content-Type', outcome.contentType);
      response.setHeader('Content-Length', String(outcome.bytes.length));
      response.setHeader('Content-Disposition', `inline; filename="${filename}.${outcome.extension}"`);
      response.end(outcome.bytes);
    } catch (error) {
      // The render's own refusal names a field in a design — useless to a
      // customer, so it goes to the log and they get a sentence.
      this.logger.error(
        `Shared document could not be rendered: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.html(
        response,
        503,
        'Document unavailable',
        'This document cannot be opened right now. Please try again later, or ask the sender.',
      );
    }
  }

  private html(response: Response, status: number, title: string, message: string): void {
    response.status(status);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(messagePage(title, message));
  }
}
