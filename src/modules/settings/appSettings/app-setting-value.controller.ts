import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { API_VERSION } from '../../../common/constants/api-version';
import { throwSettingsBadRequest } from 'src/common/utils/module-service.utils';
import { AppSettingsExceptionFilter } from './app-settings-exception.filter';
import { AppSettingValueService } from './app-setting-value.service';
import { ListAppSettingValueQueryDto } from './dto/list-app-setting-value-query.dto';
import {
  ResolveAppSettingsQueryDto,
  ResolveOneAppSettingQueryDto,
} from './dto/resolve-app-settings-query.dto';
import { SaveAppSettingValueDto } from './dto/save-app-setting-value.dto';
import {
  AppSettingResolvedValueSuccessDto,
  AppSettingValueSuccessDeleteDto,
  AppSettingValueSuccessListDto,
  AppSettingValueSuccessSingleDto,
  AppSettingsErrorResponseDto,
  AppSettingsResolvedSuccessDto,
} from './dto/app-settings-response.dto';
import {
  AppSettingResolvedValue,
  AppSettingValueDeleteResult,
  AppSettingValueListItem,
  AppSettingValuePayload,
  AppSettingsErrorDetail,
  AppSettingsListMeta,
  AppSettingsResolved,
  AppSettingsSuccessResponse,
} from './types/app-settings-api.types';

@ApiTags('App Setting Values')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('app-setting-values')
@UseFilters(AppSettingsExceptionFilter)
export class AppSettingValueController {
  constructor(private readonly appSettingValueService: AppSettingValueService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Set one override (upsert on the scope target)',
    description:
      'Send asvSettingKey, asvScope and the id that scope names — the other id columns must be ' +
      'absent. Posting the same target twice MOVES the existing override rather than answering ' +
      '409, which is what a settings screen means by Save. Sending asvId edits that row in ' +
      'place; the key and the target are immutable there. The value is checked against the ' +
      'catalog (asdDataType, asdAllowedValues, min/max) and the scope against asdMaxScope, so a ' +
      'bad value is a 400 naming the field rather than a raw constraint violation. asvValue = ' +
      'null is legal and means "explicitly nothing" — it BLANKS the setting for this layer ' +
      'instead of inheriting the one above. To go back to inheriting, delete the override.',
  })
  @ApiCreatedResponse({ type: AppSettingValueSuccessSingleDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  @ApiConflictResponse({ type: AppSettingsErrorResponseDto })
  @ApiNotFoundResponse({ type: AppSettingsErrorResponseDto })
  async save(
    @Body() saveDto: SaveAppSettingValueDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingValuePayload>> {
    const data = await this.appSettingValueService.save(saveDto);
    return {
      success: true,
      message: saveDto.asvId ? 'Override updated successfully' : 'Override saved successfully',
      data,
    };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List overrides with search, filters and pagination',
    description:
      'What has been changed and where — the diff behind the settings screen, NOT what a caller ' +
      'resolves to. Filtering by an id answers for that target alone and does not walk the ' +
      'layers above it; /resolve does that. Reset overrides are never returned.',
  })
  @ApiOkResponse({ type: AppSettingValueSuccessListDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  async list(
    @Query() queryDto: ListAppSettingValueQueryDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingValueListItem[], AppSettingsListMeta>> {
    const result = await this.appSettingValueService.list(queryDto);
    return {
      success: true,
      message: 'Overrides fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get one override by id' })
  @ApiQuery({ name: 'asvId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AppSettingValueSuccessSingleDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  @ApiNotFoundResponse({ type: AppSettingsErrorResponseDto })
  async getById(
    @Query('asvId', new ParseUUIDPipe()) asvId: string,
  ): Promise<AppSettingsSuccessResponse<AppSettingValuePayload>> {
    const data = await this.appSettingValueService.getById(asvId);
    return {
      success: true,
      message: 'Override fetched successfully',
      data,
    };
  }

  @Get('resolve')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Resolve the whole settings object for one caller',
    description:
      'GLOBAL < COMPANY < BRANCH < DEVICE < USER: the deepest override matching the ids sent ' +
      'wins, and where nothing matches the catalog default applies. Values come back cast per ' +
      'asdDataType (BOOL as a boolean, INT / DECIMAL as numbers, JSON as the object itself, the ' +
      'rest as strings) and keys that resolve to nothing are ABSENT rather than null. Every id ' +
      'is optional and additive — a layer whose id is not sent simply never matches. This is ' +
      'the one endpoint the client should read settings from: it is public.fn_app_settings, the ' +
      'same resolver the server-side rules use.',
  })
  @ApiOkResponse({ type: AppSettingsResolvedSuccessDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  async resolve(
    @Query() queryDto: ResolveAppSettingsQueryDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingsResolved>> {
    const data = await this.appSettingValueService.resolve(queryDto);
    return {
      success: true,
      message: 'Settings resolved successfully',
      data,
    };
  }

  @Get('resolve-one')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Resolve one setting for one caller, as raw text',
    description:
      'Same precedence as /resolve, one key, no cast — the caller casts, because it is the rule ' +
      'that knows whether it wanted a boolean or a numeric. A null value means the setting ' +
      'resolves to nothing, or that there is no such key.',
  })
  @ApiOkResponse({ type: AppSettingResolvedValueSuccessDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  async resolveOne(
    @Query() queryDto: ResolveOneAppSettingQueryDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingResolvedValue>> {
    const key = queryDto.key?.trim();
    if (!key) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        { field: 'key', message: 'key must be provided' },
      ]);
    }
    const data = await this.appSettingValueService.resolveOne(key, queryDto);
    return {
      success: true,
      message: 'Setting resolved successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Reset one override by id',
    description:
      'The override goes away and the layer above takes over again. A soft delete IS the reset: ' +
      'ux_asv_scope_target is partial on asv_is_deleted, so the slot is free for a new override ' +
      'immediately, and the row stays as the record of what somebody once set. Resetting is ' +
      'never a write of the default value — that would freeze today’s default into a permanent ' +
      'override that stops tracking it.',
  })
  @ApiQuery({ name: 'asvId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AppSettingValueSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  @ApiNotFoundResponse({ type: AppSettingsErrorResponseDto })
  async remove(
    @Query('asvId', new ParseUUIDPipe()) asvId: string,
  ): Promise<AppSettingsSuccessResponse<AppSettingValueDeleteResult>> {
    const data = await this.appSettingValueService.softDelete(asvId);
    return {
      success: true,
      message: 'Override reset successfully',
      data,
    };
  }
}
