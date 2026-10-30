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
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { GstCompanyCredentialService } from '../config/gst-company-credential.service';
import { GstCompanyCredentialIdDto } from '../dto/gst-ids.dto';
import { SaveGstCompanyCredentialDto } from '../dto/save-gst-company-credential.dto';
import { GstExceptionFilter } from '../gst-exception.filter';
import type {
  GstCompanyCredentialPayload,
  GstCredentialStatus,
  GstCredentialVerifyResult,
  GstSuccessResponse,
} from '../types/gst-config.types';

/**
 * Notes 79 R7–R9 — the taxpayer's portal login per company / branch ×
 * service × environment. Menu "GST Credentials": view / create / edit /
 * delete, and POST for Verify. No /list: the grid reads vw_gst_credential.
 */
@ApiTags('GST Credentials')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Credentials' })
@Controller('gst/company-credentials')
@UseFilters(GstExceptionFilter)
export class GstCompanyCredentialController {
  constructor(private readonly credentials: GstCompanyCredentialService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no gccId) or update a company credential; secrets are write-only',
    description:
      'Needs create / edit on GST Credentials. password is required on create; each secret: absent ' +
      'or "" keeps it, a value is encrypted with GST_CRED_KEY, "clear" sets clientId / clientSecret ' +
      '/ appKey NULL. The GSTIN is not a field: the response carries `gstin` (branch GSTIN, else ' +
      'the company’s); 422 GST_NO_GSTIN when neither has one. 409 GST_CREDENTIAL_PRIMARY_EXISTS ' +
      '(one live, active priority 1 per company + branch + service + environment), ' +
      'GST_CREDENTIAL_PRIORITY_TAKEN. A save that changes who signs in retires the live session.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: GstCompanyCredentialPayload }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: SaveGstCompanyCredentialDto,
  ): Promise<GstSuccessResponse<GstCompanyCredentialPayload>> {
    const data = await this.credentials.save(dto);
    return {
      success: true,
      message: dto.gccId
        ? 'GST credential updated successfully'
        : 'GST credential created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'One credential, deleted or not — hasPassword / hasClientId / hasClientSecret / hasAppKey, never a value',
  })
  @ApiOkResponse({ description: '{ success, message, data: GstCompanyCredentialPayload }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async get(
    @Query() query: GstCompanyCredentialIdDto,
  ): Promise<GstSuccessResponse<GstCompanyCredentialPayload>> {
    const data = await this.credentials.getById(query.gccId);
    return { success: true, message: 'GST credential fetched successfully', data };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a credential (its live session is retired)',
    description: 'Needs delete on GST Credentials. 409 GST_ALREADY_DELETED.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: { gccId, deleted: true } }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async delete(
    @Body() dto: GstCompanyCredentialIdDto,
  ): Promise<GstSuccessResponse<{ gccId: string; deleted: boolean }>> {
    const data = await this.credentials.softDelete(dto.gccId);
    return { success: true, message: 'GST credential deleted successfully', data };
  }

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restore a soft-deleted credential',
    description:
      'Needs edit. 409 GST_NOT_DELETED, GST_CREDENTIAL_PRIMARY_EXISTS / _PRIORITY_TAKEN when its ' +
      'slot was filled meanwhile, GST_ALREADY_DELETED when its provider is deleted.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: { gccId, deleted: false } }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async restore(
    @Body() dto: GstCompanyCredentialIdDto,
  ): Promise<GstSuccessResponse<{ gccId: string; deleted: boolean }>> {
    const data = await this.credentials.restore(dto.gccId);
    return { success: true, message: 'GST credential restored successfully', data };
  }

  @Post('verify')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'ONE sign-in at the provider, through the auth lease',
    description:
      'Needs POST on GST Credentials (it reaches an outside system). Stamps gccLastVerifiedOn ' +
      '(success) / gccLastErrorMessage (failure) and keeps the session it gets. A refusal by the ' +
      'portal is data: { ok: false, message, errorCode }. Refused WITHOUT calling the portal: 409 ' +
      'GST_AUTH_BUSY (another sign-in holds the lease), GST_AUTH_RATE_LIMIT (4 sign-ins for this ' +
      'GSTIN in 15 minutes — NIC blocks at 5); 422 GST_CREDENTIAL_INCOMPLETE / ' +
      'GST_PUBLIC_KEY_MISSING / GST_NO_AUTH_ENDPOINT / GST_NO_GSTIN naming what is missing; 503 ' +
      'GST_SWITCHED_OFF naming the first inactive row (provider, service, AUTH endpoint, account, ' +
      'credential — notes 88).',
  })
  @ApiCreatedResponse({
    description:
      '{ success, message, data: { ok, message, errorCode?, tokenValidUntil?, creditBalance? } }',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: HttpErrorResponseDto })
  async verify(
    @Body() dto: GstCompanyCredentialIdDto,
  ): Promise<GstSuccessResponse<GstCredentialVerifyResult>> {
    const data = await this.credentials.verify(dto.gccId);
    return {
      success: true,
      message: data.ok ? 'GST credential verified' : 'GST credential verification failed',
      data,
    };
  }

  @Get('status')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Session and verification status, with no portal call',
    description:
      'Needs view. { hasLiveToken, tokenExpiresOn, issuedOn, leaseFree, lastVerifiedOn, ' +
      'lastErrorMessage, creditBalance } from gst_auth_session, the credential and its provider account.',
  })
  @ApiOkResponse({ description: '{ success, message, data: GstCredentialStatus }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async status(
    @Query() query: GstCompanyCredentialIdDto,
  ): Promise<GstSuccessResponse<GstCredentialStatus>> {
    const data = await this.credentials.status(query.gccId);
    return { success: true, message: 'GST credential status fetched successfully', data };
  }
}
