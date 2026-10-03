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
import { GstProviderPartsService } from '../config/gst-provider-parts.service';
import {
  GstProviderEndpointIdDto,
  GstProviderErrorMapIdDto,
  GstProviderFieldMapIdDto,
  GstProviderServiceIdDto,
} from '../dto/gst-ids.dto';
import {
  SaveGstProviderEndpointDto,
  SaveGstProviderErrorMapDto,
  SaveGstProviderFieldMapDto,
  SaveGstProviderServiceDto,
} from '../dto/save-gst-provider.dto';
import { GstExceptionFilter } from '../gst-exception.filter';
import type {
  GstProviderEndpointPayload,
  GstProviderErrorMapPayload,
  GstProviderFieldMapPayload,
  GstProviderServicePayload,
  GstSuccessResponse,
} from '../types/gst-config.types';

/*
 * Notes 79 R2–R5 — what hangs below a provider, all on the "GST Providers"
 * menu's rights (create / edit / delete; view for /get). Lists are grids.
 * Deletes are soft and cascade down (a service takes its endpoints and their
 * field maps; an endpoint its field maps); these rows have no /restore.
 */

const SAVE_NOTE =
  'Needs create (no id) / edit on GST Providers. A row never moves to another parent (409 GST_PARENT_FIXED).';

@ApiTags('GST Providers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' })
@Controller('gst/provider-services')
@UseFilters(GstExceptionFilter)
export class GstProviderServiceController {
  constructor(private readonly parts: GstProviderPartsService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no gpsId) or update a provider service (host per service × environment)',
    description: `${SAVE_NOTE} 409 GST_SERVICE_DUPLICATE when the provider has a live row for that service + environment.`,
  })
  @ApiCreatedResponse({ description: '{ success, message, data: GstProviderServicePayload }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: SaveGstProviderServiceDto,
  ): Promise<GstSuccessResponse<GstProviderServicePayload>> {
    const data = await this.parts.saveService(dto);
    return {
      success: true,
      message: dto.gpsId
        ? 'GST provider service updated successfully'
        : 'GST provider service created successfully',
      data,
    };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a provider service, its endpoints and their field maps' })
  @ApiCreatedResponse({
    description: '{ success, message, data: { gpsId, deleted, endpointsDeleted } }',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async delete(
    @Body() dto: GstProviderServiceIdDto,
  ): Promise<GstSuccessResponse<{ gpsId: string; deleted: boolean; endpointsDeleted: number }>> {
    const data = await this.parts.deleteService(dto.gpsId);
    return { success: true, message: 'GST provider service deleted successfully', data };
  }
}

@ApiTags('GST Providers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' })
@Controller('gst/provider-endpoints')
@UseFilters(GstExceptionFilter)
export class GstProviderEndpointController {
  constructor(private readonly parts: GstProviderPartsService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no gpeId) or update an endpoint (one action of a service)',
    description:
      `${SAVE_NOTE} 409 GST_ENDPOINT_DUPLICATE when the service has a live row for the action. ` +
      'gpeHeaders is an object of string templates; gpeRedactPaths an array of $-paths. Answers like /get.',
  })
  @ApiCreatedResponse({
    description: '{ success, message, data: GstProviderEndpointPayload (with fieldMaps) }',
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: SaveGstProviderEndpointDto,
  ): Promise<GstSuccessResponse<GstProviderEndpointPayload>> {
    const data = await this.parts.saveEndpoint(dto);
    return {
      success: true,
      message: dto.gpeId
        ? 'GST provider endpoint updated successfully'
        : 'GST provider endpoint created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'One endpoint, deleted or not, with its live field map',
    description:
      'Needs view on GST Providers. fieldMaps[]: REQUEST then RESPONSE, by sort order — the field-map popup in one call.',
  })
  @ApiOkResponse({ description: '{ success, message, data: GstProviderEndpointPayload }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async get(
    @Query() query: GstProviderEndpointIdDto,
  ): Promise<GstSuccessResponse<GstProviderEndpointPayload>> {
    const data = await this.parts.getEndpoint(query.gpeId);
    return { success: true, message: 'GST provider endpoint fetched successfully', data };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete an endpoint and its field map' })
  @ApiCreatedResponse({
    description: '{ success, message, data: { gpeId, deleted, fieldMapsDeleted } }',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async delete(
    @Body() dto: GstProviderEndpointIdDto,
  ): Promise<GstSuccessResponse<{ gpeId: string; deleted: boolean; fieldMapsDeleted: number }>> {
    const data = await this.parts.deleteEndpoint(dto.gpeId);
    return { success: true, message: 'GST provider endpoint deleted successfully', data };
  }
}

@ApiTags('GST Providers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' })
@Controller('gst/provider-field-maps')
@UseFilters(GstExceptionFilter)
export class GstProviderFieldMapController {
  constructor(private readonly parts: GstProviderPartsService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no gfmId) or update one field of an endpoint’s request or reply',
    description:
      `${SAVE_NOTE} 409 GST_FIELD_MAP_DUPLICATE per (endpoint, direction, gfmOurField). ` +
      '400 for a required field with a default, or DATETIME_MASK without gfmFormatMask.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: GstProviderFieldMapPayload }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: SaveGstProviderFieldMapDto,
  ): Promise<GstSuccessResponse<GstProviderFieldMapPayload>> {
    const data = await this.parts.saveFieldMap(dto);
    return {
      success: true,
      message: dto.gfmId
        ? 'GST field map updated successfully'
        : 'GST field map created successfully',
      data,
    };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a field-map row' })
  @ApiCreatedResponse({ description: '{ success, message, data: { gfmId, deleted: true } }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async delete(
    @Body() dto: GstProviderFieldMapIdDto,
  ): Promise<GstSuccessResponse<{ gfmId: string; deleted: boolean }>> {
    const data = await this.parts.deleteFieldMap(dto.gfmId);
    return { success: true, message: 'GST field map deleted successfully', data };
  }
}

@ApiTags('GST Providers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' })
@Controller('gst/provider-error-maps')
@UseFilters(GstExceptionFilter)
export class GstProviderErrorMapController {
  constructor(private readonly parts: GstProviderPartsService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no gemId) or update what one of the provider’s codes means to us',
    description:
      `${SAVE_NOTE} gemService null = every service. 409 GST_ERROR_MAP_DUPLICATE per ` +
      '(provider, service, gemTheirCode). gemTreatAs SUCCESS needs gemExtractPath + gemCanonicalField.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: GstProviderErrorMapPayload }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: SaveGstProviderErrorMapDto,
  ): Promise<GstSuccessResponse<GstProviderErrorMapPayload>> {
    const data = await this.parts.saveErrorMap(dto);
    return {
      success: true,
      message: dto.gemId
        ? 'GST error map updated successfully'
        : 'GST error map created successfully',
      data,
    };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete an error-map row' })
  @ApiCreatedResponse({ description: '{ success, message, data: { gemId, deleted: true } }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async delete(
    @Body() dto: GstProviderErrorMapIdDto,
  ): Promise<GstSuccessResponse<{ gemId: string; deleted: boolean }>> {
    const data = await this.parts.deleteErrorMap(dto.gemId);
    return { success: true, message: 'GST error map deleted successfully', data };
  }
}
