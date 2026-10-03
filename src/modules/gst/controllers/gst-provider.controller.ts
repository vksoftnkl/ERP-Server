import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { GstProviderService } from '../config/gst-provider.service';
import { GstProviderIdDto } from '../dto/gst-ids.dto';
import { SaveGstProviderDto } from '../dto/save-gst-provider.dto';
import { GstExceptionFilter } from '../gst-exception.filter';
import type { GstProviderPayload, GstSuccessResponse } from '../types/gst-config.types';

/** Notes 79 R1. No /list: the provider list is a grid on gst_provider. Menu "GST Providers". */
@ApiTags('GST Providers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' })
@Controller('gst/providers')
@UseFilters(GstExceptionFilter)
export class GstProviderController {
  constructor(private readonly providers: GstProviderService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no gpvId) or update a GST provider’s header',
    description:
      'Needs create / edit on GST Providers. Answers like /get. 409 GST_PROVIDER_CODE_DUPLICATE ' +
      '(codes are unique over deleted rows too), GST_PROVIDER_CODE_FIXED (a code is never renamed), ' +
      'GST_ALREADY_DELETED (restore first).',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: GstProviderPayload }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(@Body() dto: SaveGstProviderDto): Promise<GstSuccessResponse<GstProviderPayload>> {
    const data = await this.providers.save(dto);
    return {
      success: true,
      message: dto.gpvId
        ? 'GST provider updated successfully'
        : 'GST provider created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'One GST provider, deleted or not, with its services, accounts and counts',
    description:
      'Needs view on GST Providers. services[] (live, each with endpointCount), accounts[] ' +
      '(live, secret-free: has* flags + keyVersion), endpointCount, errorMapCount, credentialCount.',
  })
  @ApiOkResponse({ description: '{ success, message, data: GstProviderPayload }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async get(@Query() query: GstProviderIdDto): Promise<GstSuccessResponse<GstProviderPayload>> {
    const data = await this.providers.getById(query.gpvId);
    return { success: true, message: 'GST provider fetched successfully', data };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a GST provider',
    description:
      'Needs delete on GST Providers. 409 GST_PROVIDER_IN_USE while a live company credential ' +
      'names it; GST_ALREADY_DELETED. Its services, endpoints and maps are kept for /restore.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: { gpvId, deleted: true } }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async delete(
    @Body() dto: GstProviderIdDto,
  ): Promise<GstSuccessResponse<{ gpvId: string; deleted: boolean }>> {
    const data = await this.providers.softDelete(dto.gpvId);
    return { success: true, message: 'GST provider deleted successfully', data };
  }

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restore a soft-deleted GST provider',
    description: 'Needs edit. 409 GST_NOT_DELETED.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: { gpvId, deleted: false } }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async restore(
    @Body() dto: GstProviderIdDto,
  ): Promise<GstSuccessResponse<{ gpvId: string; deleted: boolean }>> {
    const data = await this.providers.restore(dto.gpvId);
    return { success: true, message: 'GST provider restored successfully', data };
  }
}
