import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Res,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { AppThemeExceptionFilter } from './app-theme-exception.filter';
import { AppThemeService } from './app-theme.service';
import { AppThemeEffectiveQueryDto, AppThemeIdQueryDto } from './dto/app-theme-query.dto';
import {
  AppThemeErrorResponseDto,
  AppThemeSuccessBootstrapDto,
  AppThemeSuccessDeleteDto,
  AppThemeSuccessEffectiveDto,
  AppThemeSuccessSingleDto,
  AppThemeSuccessTemplateDto,
} from './dto/app-theme-response.dto';
import { SaveAppThemeDto } from './dto/save-app-theme.dto';
import { SaveAppThemeTemplateDto } from './dto/save-app-theme-template.dto';
import type {
  AppThemeBootstrapPayload,
  AppThemeDeleteResult,
  AppThemeEffectiveWithTemplate,
  AppThemePayload,
  AppThemeSuccessResponse,
  AppThemeTemplatePayload,
} from './types/app-theme.types';

/** A conditional GET: the ETag goes out, and a matching If-None-Match gets a bare 304. */
function answerConditionally(
  res: Response,
  etag: string,
  ifNoneMatch: string | undefined,
): 'not-modified' | 'send' {
  res.setHeader('Cache-Control', 'private, max-age=0');
  res.setHeader('ETag', etag);
  if (ifNoneMatch === etag) {
    res.status(304);
    return 'not-modified';
  }
  return 'send';
}

/**
 * Company themes (theme/plan-app-theme.md §3). No `/list`: the grid "MAIN LIST
 * - APP THEMES" lists. No response cache here — `/effective` must show a saved
 * theme at the next login, so it answers with an ETag instead (§3.3).
 */
@ApiTags('App Themes')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('app-themes')
@UseFilters(AppThemeExceptionFilter)
export class AppThemeController {
  constructor(private readonly appThemeService: AppThemeService) {}

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'One app theme by thmId — deleted ones too, so the screen can restore them',
  })
  @ApiOkResponse({ type: AppThemeSuccessSingleDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  async getById(
    @Query() query: AppThemeIdQueryDto,
  ): Promise<AppThemeSuccessResponse<AppThemePayload>> {
    const data = await this.appThemeService.getById(query.thmId);
    return { success: true, message: 'App theme fetched successfully', data };
  }

  @Get('effective')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The theme a company is painted in — called at login and on every company switch',
    description:
      "The company's comp_stylesheet_id when that theme is active and not deleted " +
      '(resolvedFrom COMPANY), else the default theme (DEFAULT), with the active stylesheet ' +
      'template (template: tplId, tplQss, tplModifiedOn) so a login is one call. Sends an ETag ' +
      'of thmId:thmModifiedOn:resolvedFrom:tplId:tplModifiedOn; a request carrying it in ' +
      'If-None-Match gets a bare 304. Compare thmModifiedOn / tplModifiedOn with a cached copy ' +
      'to skip a repaint.',
  })
  @ApiHeader({ name: 'If-None-Match', required: false })
  @ApiOkResponse({ type: AppThemeSuccessEffectiveDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  async effective(
    @Query() query: AppThemeEffectiveQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AppThemeSuccessResponse<AppThemeEffectiveWithTemplate> | undefined> {
    const data = await this.appThemeService.effective(query.companyId);
    const etag =
      `"${data.thmId}:${data.thmModifiedOn ?? ''}:${data.resolvedFrom}` +
      `:${data.template?.tplId ?? ''}:${data.template?.tplModifiedOn ?? ''}"`;
    if (answerConditionally(res, etag, ifNoneMatch) === 'not-modified') {
      return undefined;
    }
    return { success: true, message: 'Effective app theme fetched successfully', data };
  }

  @Public()
  @Get('bootstrap')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'NO TOKEN — the default theme’s tokens and the active template, for the login window',
    description:
      'The login window is painted before anyone has logged in, so this answers without a ' +
      'token: tokens (the default theme), thmModifiedOn and template (tplId, tplQss, ' +
      'tplModifiedOn) — colours and layout rules, nothing else. Never a 404: what is missing ' +
      'comes back empty / null. ETag thmModifiedOn:tplId:tplModifiedOn, 304 on a match.',
  })
  @ApiHeader({ name: 'If-None-Match', required: false })
  @ApiOkResponse({ type: AppThemeSuccessBootstrapDto })
  async bootstrap(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AppThemeSuccessResponse<AppThemeBootstrapPayload> | undefined> {
    const data = await this.appThemeService.bootstrap();
    const etag = `"${data.thmModifiedOn ?? ''}:${data.template?.tplId ?? ''}:${data.template?.tplModifiedOn ?? ''}"`;
    if (answerConditionally(res, etag, ifNoneMatch) === 'not-modified') {
      return undefined;
    }
    return { success: true, message: 'App theme bootstrap fetched successfully', data };
  }

  @Get('template')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The active stylesheet template — the rules every client fills with its tokens',
    description:
      'tplQss is QSS with {{key}} placeholders; placeholders lists the distinct keys it uses. ' +
      'Echo tplModifiedOn on /template/save. 404 only while no live, active template exists.',
  })
  @ApiOkResponse({ type: AppThemeSuccessTemplateDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  async template(): Promise<AppThemeSuccessResponse<AppThemeTemplatePayload>> {
    const data = await this.appThemeService.template();
    return { success: true, message: 'App theme template fetched successfully', data };
  }

  @Post('template/save')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Replace the stylesheet template’s rules',
    description:
      'Needs edit on the App Themes menu. 400 on tplQss for each unknown placeholder, ' +
      'unbalanced brace, url() that is not a :/ resource, or a text over 512 KB — all checked ' +
      'before anything is written. 409 when tplModifiedOn is not the row’s (someone saved since ' +
      'it was loaded) or the template is not the active one. Audited with the text before and ' +
      'after.',
  })
  @ApiCreatedResponse({ type: AppThemeSuccessTemplateDto })
  @ApiBadRequestResponse({ type: AppThemeErrorResponseDto })
  @ApiForbiddenResponse({ type: AppThemeErrorResponseDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  @ApiConflictResponse({ type: AppThemeErrorResponseDto })
  async saveTemplate(
    @Body() dto: SaveAppThemeTemplateDto,
  ): Promise<AppThemeSuccessResponse<AppThemeTemplatePayload>> {
    const data = await this.appThemeService.saveTemplate(dto);
    return { success: true, message: 'App theme template saved successfully', data };
  }

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no thmId) or update an app theme',
    description:
      'Needs create / edit on the App Themes menu. tokens replaces the stored object: every key ' +
      'must be a token (APP_THEME_TOKEN_KEYS, v1 + v2) and every value #rrggbb or #rrggbbaa — 400 ' +
      'names each bad key as tokens.<key>. thmIsDefault = true moves the default here in the same ' +
      'transaction; the default cannot be un-set or deactivated. 409 on a live name clash.',
  })
  @ApiCreatedResponse({ type: AppThemeSuccessSingleDto })
  @ApiBadRequestResponse({ type: AppThemeErrorResponseDto })
  @ApiForbiddenResponse({ type: AppThemeErrorResponseDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  @ApiConflictResponse({ type: AppThemeErrorResponseDto })
  async save(@Body() dto: SaveAppThemeDto): Promise<AppThemeSuccessResponse<AppThemePayload>> {
    const data = await this.appThemeService.save(dto);
    return {
      success: true,
      message: dto.thmId ? 'App theme updated successfully' : 'App theme created successfully',
      data,
    };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete an app theme',
    description:
      'Needs delete on the App Themes menu. 409 when it is already deleted, when it is the ' +
      'default, or while a live company uses it (usedByCount).',
  })
  @ApiCreatedResponse({ type: AppThemeSuccessDeleteDto })
  @ApiForbiddenResponse({ type: AppThemeErrorResponseDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  @ApiConflictResponse({ type: AppThemeErrorResponseDto })
  async remove(
    @Query() query: AppThemeIdQueryDto,
  ): Promise<AppThemeSuccessResponse<AppThemeDeleteResult>> {
    const data = await this.appThemeService.softDelete(query.thmId);
    return { success: true, message: 'App theme deleted successfully', data };
  }

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restore a soft-deleted app theme',
    description:
      'Needs edit on the App Themes menu. 409 when it is not deleted, or when a live theme now ' +
      'has its name.',
  })
  @ApiCreatedResponse({ type: AppThemeSuccessDeleteDto })
  @ApiForbiddenResponse({ type: AppThemeErrorResponseDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  @ApiConflictResponse({ type: AppThemeErrorResponseDto })
  async restore(
    @Query() query: AppThemeIdQueryDto,
  ): Promise<AppThemeSuccessResponse<AppThemeDeleteResult>> {
    const data = await this.appThemeService.restore(query.thmId);
    return { success: true, message: 'App theme restored successfully', data };
  }
}
