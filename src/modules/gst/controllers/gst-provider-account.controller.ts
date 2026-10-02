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
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { GstProviderAccountService } from '../config/gst-provider-account.service';
import { GstProviderAccountIdDto } from '../dto/gst-ids.dto';
import { SaveGstProviderAccountDto } from '../dto/save-gst-provider-account.dto';
import { GstExceptionFilter } from '../gst-exception.filter';
import type { GstProviderAccountPayload, GstSuccessResponse } from '../types/gst-config.types';

/**
 * Notes 79 R6 — the GSP's own account. Secrets are write-only (§3): they go
 * in as clientId / clientSecret / apiKey and come back only as has* flags and
 * keyVersion. On the "GST Providers" menu's rights.
 */
@ApiTags('GST Providers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' })
@Controller('gst/provider-accounts')
@UseFilters(GstExceptionFilter)
export class GstProviderAccountController {
  constructor(private readonly accounts: GstProviderAccountService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create (no gpaId) or update a provider account; secrets are write-only',
    description:
      'Needs create / edit on GST Providers. Each secret: absent or "" keeps the stored value, a ' +
      'value is encrypted with GST_CRED_KEY (503 GST_CRED_KEY_MISSING when the server has none), ' +
      '"clear": ["clientSecret"] sets it NULL. 409 GST_ACCOUNT_DUPLICATE per (provider, ' +
      'environment, service).',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: GstProviderAccountPayload }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: SaveGstProviderAccountDto,
  ): Promise<GstSuccessResponse<GstProviderAccountPayload>> {
    const data = await this.accounts.save(dto);
    return {
      success: true,
      message: dto.gpaId
        ? 'GST provider account updated successfully'
        : 'GST provider account created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'One provider account, deleted or not — hasClientId / hasClientSecret / hasApiKey, never a value',
  })
  @ApiOkResponse({ description: '{ success, message, data: GstProviderAccountPayload }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async get(
    @Query() query: GstProviderAccountIdDto,
  ): Promise<GstSuccessResponse<GstProviderAccountPayload>> {
    const data = await this.accounts.getById(query.gpaId);
    return { success: true, message: 'GST provider account fetched successfully', data };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a provider account',
    description: 'Needs delete. 409 GST_ALREADY_DELETED.',
  })
  @ApiCreatedResponse({ description: '{ success, message, data: { gpaId, deleted: true } }' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async delete(
    @Body() dto: GstProviderAccountIdDto,
  ): Promise<GstSuccessResponse<{ gpaId: string; deleted: boolean }>> {
    const data = await this.accounts.softDelete(dto.gpaId);
    return { success: true, message: 'GST provider account deleted successfully', data };
  }
}
