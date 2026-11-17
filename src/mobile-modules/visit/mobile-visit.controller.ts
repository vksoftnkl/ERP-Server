import { Body, Controller, Post, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProperty,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { CreateMobileVisitDto } from './dto/mobile-visit.dto';
import { MobileVisitService } from './mobile-visit.service';
import type { MobileVisitCreateResult } from './types/mobile-visit-api.types';

class MobileVisitCreateResultDto {
  @ApiProperty({ format: 'uuid' }) cvId!: string;
  @ApiProperty({ format: 'uuid' }) cvClientUuid!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'The visit time the server holds (UTC instant)',
  })
  cvVisitAt!: string;
  @ApiProperty({ description: 'true = saved before under this cvClientUuid; nothing written now' })
  duplicate!: boolean;
}

class MobileVisitCreateSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileVisitCreateResultDto }) data!: MobileVisitCreateResultDto;
}

/**
 * Check-ins from the React Native salesman app (sales.customer_visit).
 * @OptionalAuth, like the other /mobile routes: a sent token is checked and
 * its user stamped on the row (cv_user_id); none = the default actor.
 */
@ApiTags('Mobile · Visits')
@OptionalAuth()
@ApiBearerAuth('access-token')
@ApiSecurity({})
@ApiUnauthorizedResponse({
  type: HttpErrorResponseDto,
  description: 'Only when a token is sent and it is malformed, expired or revoked',
})
@Controller('mobile/visits')
@UseFilters(MobileExceptionFilter)
export class MobileVisitController {
  constructor(private readonly mobileVisitService: MobileVisitService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Upload one check-in at a customer (safe to resend)',
    description:
      'Customer, salesman (employee), reason code (shopClosed / noOrder / shopBusy / ' +
      'ownerAway / paymentPending / nextVisit), remarks, GPS fix and the visit time. The ' +
      'server fills the device (the registered phone, 403 MOBILE_DEVICE_*) and the branch (the ' +
      "phone's when it belongs to the company, else the company default). The same " +
      'cvClientUuid again answers the row already saved (duplicate: true) and writes nothing; ' +
      'on another customer it is a 409 MOBILE_CLIENT_UUID_REUSED.',
  })
  @ApiCreatedResponse({ type: MobileVisitCreateSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  async create(
    @Body() dto: CreateMobileVisitDto,
  ): Promise<{ success: true; message: string; data: MobileVisitCreateResult }> {
    const data = await this.mobileVisitService.create(dto);
    return {
      success: true,
      message: data.duplicate ? 'Visit already saved' : 'Visit saved successfully',
      data,
    };
  }
}
