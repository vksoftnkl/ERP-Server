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
import { AppSettingsExceptionFilter } from './app-settings-exception.filter';
import { AppSettingDefService } from './app-setting-def.service';
import { ListAppSettingDefQueryDto } from './dto/list-app-setting-def-query.dto';
import { SaveAppSettingDefDto } from './dto/save-app-setting-def.dto';
import {
  AppSettingDefSuccessDeleteDto,
  AppSettingDefSuccessListDto,
  AppSettingDefSuccessSingleDto,
  AppSettingsErrorResponseDto,
} from './dto/app-settings-response.dto';
import { throwSettingsBadRequest } from 'src/common/utils/module-service.utils';
import {
  AppSettingDefDeleteResult,
  AppSettingDefListItem,
  AppSettingDefPayload,
  AppSettingsErrorDetail,
  AppSettingsListMeta,
  AppSettingsSuccessResponse,
} from './types/app-settings-api.types';

@ApiTags('App Setting Definitions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('app-setting-defs')
@UseFilters(AppSettingsExceptionFilter)
export class AppSettingDefController {
  constructor(private readonly appSettingDefService: AppSettingDefService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update one setting definition (by asdId presence)',
    description:
      'A create needs asdKey, asdModule, asdDataType and asdLabel. An update needs asdId plus ' +
      'the fields that change — except asdKey, which is immutable because overrides point at ' +
      'the key rather than the id. Tightening the shape (asdDataType, asdAllowedValues, the ' +
      'min/max) or narrowing asdMaxScope is refused while a stored override would stop passing ' +
      'it, and asdDefaultValue is always checked against the type: the resolver casts it for ' +
      'every caller who has not overridden the setting.',
  })
  @ApiCreatedResponse({ type: AppSettingDefSuccessSingleDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  @ApiConflictResponse({ type: AppSettingsErrorResponseDto })
  @ApiNotFoundResponse({ type: AppSettingsErrorResponseDto })
  async save(
    @Body() saveDto: SaveAppSettingDefDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingDefPayload>> {
    const data = await this.appSettingDefService.save(saveDto);
    return {
      success: true,
      message: saveDto.asdId ? 'Setting updated successfully' : 'Setting created successfully',
      data,
    };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List setting definitions with search, filters and pagination',
    description:
      'Module → group → sort order, the tree the settings screen draws. Soft-deleted settings ' +
      'are never returned; retired ones (asdIsActive = false) are, so pass asdIsActive=true for ' +
      'the live catalog. Sending any filter beyond `search` takes the query off the configured ' +
      'grid and onto the module’s own query.',
  })
  @ApiOkResponse({ type: AppSettingDefSuccessListDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  async list(
    @Query() queryDto: ListAppSettingDefQueryDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingDefListItem[], AppSettingsListMeta>> {
    const result = await this.appSettingDefService.list(queryDto);
    return {
      success: true,
      message: 'Settings fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get one setting definition by id or key',
    description: 'Send asdId or asdKey — the key is the stabler handle of the two.',
  })
  @ApiQuery({ name: 'asdId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'asdKey',
    required: false,
    schema: { type: 'string', maxLength: 80, example: 'sales.max_discount_percent' },
  })
  @ApiOkResponse({ type: AppSettingDefSuccessSingleDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  @ApiNotFoundResponse({ type: AppSettingsErrorResponseDto })
  async getOne(
    @Query('asdId') asdId?: string,
    @Query('asdKey') asdKey?: string,
  ): Promise<AppSettingsSuccessResponse<AppSettingDefPayload>> {
    const data = asdId
      ? await this.appSettingDefService.getById(asdId)
      : await this.appSettingDefService.getByKey(this.requireKey(asdKey));
    return {
      success: true,
      message: 'Setting fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a setting definition by id',
    description:
      'For a setting that should never have existed. One anybody has actually SET is retired ' +
      'instead — save it with asdIsActive = false — and this refuses (409) while live overrides ' +
      'still point at the key, rather than leaving them behind pointing at nothing readable.',
  })
  @ApiQuery({ name: 'asdId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AppSettingDefSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  @ApiConflictResponse({ type: AppSettingsErrorResponseDto })
  @ApiNotFoundResponse({ type: AppSettingsErrorResponseDto })
  async remove(
    @Query('asdId', new ParseUUIDPipe()) asdId: string,
  ): Promise<AppSettingsSuccessResponse<AppSettingDefDeleteResult>> {
    const data = await this.appSettingDefService.softDelete(asdId);
    return {
      success: true,
      message: 'Setting deleted successfully',
      data,
    };
  }

  private requireKey(asdKey: string | undefined): string {
    const key = asdKey?.trim();
    if (!key) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        { field: 'asdId', message: 'Either asdId or asdKey must be sent' },
      ]);
    }
    // ck_asd_key stores keys lower-cased, so a caller that shouts one still
    // finds the row rather than getting a 404 it cannot explain.
    return key.toLowerCase();
  }
}
