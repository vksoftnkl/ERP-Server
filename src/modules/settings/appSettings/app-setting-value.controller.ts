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
import { AppSettingValueService } from './app-setting-value.service';
import { ResolveAppSettingsQueryDto } from './dto/resolve-app-settings-query.dto';
import { SaveBulkAppSettingValueDto } from './dto/save-bulk-app-setting-value.dto';
import {
  AppSettingsEffectiveSuccessDto,
  AppSettingValueSuccessDeleteDto,
  AppSettingValueSuccessSaveDto,
  AppSettingsErrorResponseDto,
} from './dto/app-settings-response.dto';
import {
  AppSettingEffectiveItem,
  AppSettingValueDeleteResult,
  AppSettingValuePayload,
  AppSettingsSuccessResponse,
} from './types/app-settings-api.types';

@ApiTags('App Setting Values')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('app-setting-values')
@UseFilters(AppSettingsExceptionFilter)
export class AppSettingValueController {
  constructor(private readonly appSettingValueService: AppSettingValueService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Set overrides — an array, upserted on each entry’s scope target',
    description:
      'The payload is always `{ "data": [ … ] }`, one entry per override, because a settings ' +
      'screen saves a page of boxes rather than one box. The whole array is ONE transaction: if ' +
      'any entry is refused, none of them are written, and the errors name the entry — ' +
      '`data[2].asvValue` — so the screen can put each message on the box that caused it.\n\n' +
      'Per entry: send asvSettingKey, asvScope and the id that scope names — the other id ' +
      'columns must be absent. Posting the same target twice MOVES the existing override rather ' +
      'than answering 409, which is what a settings screen means by Save. Sending asvId edits ' +
      'that row in place; the key and the target are immutable there. The value is checked ' +
      'against the catalog (asdDataType, asdAllowedValues, min/max) and the scope against ' +
      'asdMaxScope, so a bad value is a 400 naming the field rather than a raw constraint ' +
      'violation. asvValue = null is legal and means "explicitly nothing" — it BLANKS the ' +
      'setting for this layer instead of inheriting the one above. To go back to inheriting, ' +
      'delete the override.',
  })
  @ApiCreatedResponse({ type: AppSettingValueSuccessSaveDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  @ApiConflictResponse({ type: AppSettingsErrorResponseDto })
  @ApiNotFoundResponse({ type: AppSettingsErrorResponseDto })
  async save(
    @Body() saveDto: SaveBulkAppSettingValueDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingValuePayload[]>> {
    const data = await this.appSettingValueService.save(saveDto.data);
    return {
      success: true,
      message: 'Overrides saved successfully',
      data,
    };
  }

  @Get('effective')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Every setting as it stands for one caller — override where one matched, catalog where none did',
    description:
      'One row per LIVE setting: the catalog row, the override row that won (null when the ' +
      'default stands), and the value the two come to. GLOBAL < COMPANY < BRANCH < DEVICE < ' +
      'USER over whichever of companyId / branchId / deviceId / userId are sent — every id is ' +
      'optional and additive, and a layer whose id is not sent simply never matches. This is ' +
      'the one endpoint the client should read settings from: it is ' +
      'public.fn_app_settings_effective, which the server-side resolver is itself built on.\n\n' +
      'It answers what to APPLY and what to DRAW at once: the value, plus the label, type and ' +
      'bounds to render a control, `override.asvId` to edit or reset it, and `override.asvScope` ' +
      'so the screen can say "set on this branch". Values come back as RAW TEXT with ' +
      'asdDataType beside them — the caller casts. `source` is read from the override ROW, not ' +
      'its value, so an override that deliberately blanks a setting still reads OVERRIDE and can ' +
      'still be reset; such a setting is returned with value null. Unpaged: the catalog is small ' +
      'and a settings screen wants all of it.',
  })
  @ApiOkResponse({ type: AppSettingsEffectiveSuccessDto })
  @ApiBadRequestResponse({ type: AppSettingsErrorResponseDto })
  async effective(
    @Query() queryDto: ResolveAppSettingsQueryDto,
  ): Promise<AppSettingsSuccessResponse<AppSettingEffectiveItem[]>> {
    const data = await this.appSettingValueService.resolveEffective(queryDto);
    return {
      success: true,
      message: 'Settings fetched successfully',
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
