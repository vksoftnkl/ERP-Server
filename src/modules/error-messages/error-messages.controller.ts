import { Controller, Get, Query, Req, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { API_VERSION } from '../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { wordingLangOf } from '../../common/error-wording/error-wording';
import { ErrorMessagesQueryDto } from './dto/error-messages-query.dto';
import { ErrorMessageService } from './error-messages.service';
import type { ErrorMessageCataloguePayload } from './error-messages.types';

/**
 * GET /error-messages (notes 120) — the plain words for every error code, for
 * the apps to cache: a counter offline still words an error it raises itself,
 * and an app can word an error from an older server. Login only, no menu
 * right: every screen of every app needs it.
 */
@ApiTags('Error messages')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('error-messages')
export class ErrorMessagesController {
  constructor(private readonly messages: ErrorMessageService) {}

  @Get()
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The plain error wording catalogue (notes 120)',
    description:
      'Every active row of one language — `{ code, variant, lang, title, line, todo }` — and the catalogue ' +
      'version. `code` is an error code, or a prefix row ending in * (HOLD_*) for every code of it with no row ' +
      "of its own; `variant` is '' (plain), field=<name>, <key>=<value> or <key>=* — field= first, then " +
      '<key>=<value>, then <key>=*, then the plain row; the exact code before a prefix row. `lang` from the ' +
      'query, else Accept-Language, else en (a language with no rows answers en). `since` = the version held: ' +
      'the same answers `unchanged: true` and no rows. Login only.',
  })
  @ApiOkResponse({
    description: '{ success, message, data: { version, lang, unchanged, rows[] } }',
  })
  async catalogue(
    @Query() query: ErrorMessagesQueryDto,
    @Req() request: Request,
  ): Promise<{ success: true; message: string; data: ErrorMessageCataloguePayload }> {
    const lang = wordingLangOf({
      query: { lang: query.lang ?? undefined },
      headers: request.headers,
    });
    const data = await this.messages.catalogue(lang, query.since ?? null);
    return {
      success: true,
      message: data.unchanged
        ? `Error messages ${data.version ?? ''} unchanged`
        : `${data.rows.length} error message(s), version ${data.version ?? 'none'}`,
      data,
    };
  }
}
