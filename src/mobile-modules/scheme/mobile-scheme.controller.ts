import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { ActiveMobileSchemesQueryDto } from './dto/mobile-scheme.dto';
import { MobileSchemesSuccessDto } from './dto/mobile-scheme-response.dto';
import { MobileSchemeService } from './mobile-scheme.service';
import type { MobileSchemesPayload } from './types/mobile-scheme-api.types';

type MobileSuccess<T> = { success: true; message: string; data: T };

/**
 * Promotion schemes for the phone's offline offer engine. Read-only, no
 * database change, no menu right.
 *
 * No @CacheTTL: the answer is per company, and the HTTP cache key holds no
 * company (redis usage audit). @OptionalAuth, like the other /mobile/* reads:
 * no token needed; a sent token is still checked.
 */
@ApiTags('Mobile · Schemes')
@OptionalAuth()
@ApiBearerAuth('access-token')
@ApiSecurity({})
@ApiUnauthorizedResponse({
  type: HttpErrorResponseDto,
  description: 'Only when a token is sent and it is malformed, expired or revoked',
})
@Controller('mobile/schemes')
@UseFilters(MobileExceptionFilter)
export class MobileSchemeController {
  constructor(private readonly mobileSchemeService: MobileSchemeService) {}

  @Get('active')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "The company's promotion schemes a phone can apply by itself, with every child row",
    description:
      'Headers: prm_comp_id = companyId, not deleted, active, APPROVED, auto-apply, no coupon ' +
      "batch, prm_end_date >= the database's today (IST; asOf). A future start is sent. No " +
      'branch filter. Children (branches, parties, items, slabs): active, not deleted, by slno ' +
      'then id. Schemes by prm_priority, prm_code, prm_id. Keys are the VK Nex column names; ' +
      'integers are numbers, numerics exact text at column scale. *_name fields are joined as ' +
      '/promotion-scheme/list joins them; prs_free_unit_factor is the iuc_to_base_factor of ' +
      'the free unit.',
  })
  @ApiOkResponse({ type: MobileSchemesSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'deviceUid sent but not registered, blocked or inactive (MOBILE_DEVICE_*)',
  })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' })
  async active(
    @Query() query: ActiveMobileSchemesQueryDto,
  ): Promise<MobileSuccess<MobileSchemesPayload>> {
    const data = await this.mobileSchemeService.active(query);
    return { success: true, message: 'Active schemes fetched', data };
  }
}
