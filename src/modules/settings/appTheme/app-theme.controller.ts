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
import { AppThemeExceptionFilter } from './app-theme-exception.filter';
import { AppThemeService } from './app-theme.service';
import { AppThemeEffectiveQueryDto, AppThemeIdQueryDto } from './dto/app-theme-query.dto';
import {
  AppThemeErrorResponseDto,
  AppThemeSuccessDeleteDto,
  AppThemeSuccessEffectiveDto,
  AppThemeSuccessSingleDto,
} from './dto/app-theme-response.dto';
import { SaveAppThemeDto } from './dto/save-app-theme.dto';
import type {
  AppThemeDeleteResult,
  AppThemeEffectivePayload,
  AppThemePayload,
  AppThemeSuccessResponse,
} from './types/app-theme.types';

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
      '(resolvedFrom COMPANY), else the default theme (DEFAULT). Sends an ETag of ' +
      'thmId:thmModifiedOn:resolvedFrom; a request carrying it in If-None-Match gets a bare 304. ' +
      'Compare thmModifiedOn with a cached copy to skip a repaint.',
  })
  @ApiHeader({ name: 'If-None-Match', required: false })
  @ApiOkResponse({ type: AppThemeSuccessEffectiveDto })
  @ApiNotFoundResponse({ type: AppThemeErrorResponseDto })
  async effective(
    @Query() query: AppThemeEffectiveQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AppThemeSuccessResponse<AppThemeEffectivePayload> | undefined> {
    const data = await this.appThemeService.effective(query.companyId);
    const etag = `"${data.thmId}:${data.thmModifiedOn ?? ''}:${data.resolvedFrom}"`;
    res.setHeader('Cache-Control', 'private, max-age=0');
    res.setHeader('ETag', etag);
    if (ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }
    return { success: true, message: 'Effective app theme fetched successfully', data };
  }

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no thmId) or update an app theme',
    description:
      'Needs create / edit on the App Themes menu. tokens replaces the stored object: every key ' +
      'must be a v1 token (APP_THEME_TOKEN_KEYS) and every value #rrggbb or #rrggbbaa — 400 ' +
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
