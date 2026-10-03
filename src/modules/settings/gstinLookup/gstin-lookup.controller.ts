import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { GstinLookupQueryDto } from './dto/gstin-lookup-query.dto';
import { GstinLookupExceptionFilter } from './gstin-lookup-exception.filter';
import { GstinLookupService } from './gstin-lookup.service';
import { GstinLookupPayload } from './types/gstin-lookup.types';

@ApiTags('GST')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('gst')
@UseFilters(GstinLookupExceptionFilter)
export class GstinLookupController {
  constructor(private readonly gstinLookupService: GstinLookupService) {}

  @Get('search')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Look up a GSTIN's registered details through the configured GST provider",
    description:
      'Fills a company / branch / party form: legal and trade name, status, registration type ' +
      '(also as REGULAR / COMPOSITION / UNREGISTERED / SEZ), state code, PAN and address, plus ' +
      'the provider record as sent. The provider is whatever the GST Provider screen has ' +
      'switched on for GSTIN_VERIFY (notes 87). 404 when the provider has no details, 502 when ' +
      'it fails (with its own [code] message), 503 when search is switched off or the company ' +
      'has no GSTIN.',
  })
  @ApiOkResponse({ description: '{ success, message, data: GstinLookupPayload }' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiBadGatewayResponse({ type: HttpErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: HttpErrorResponseDto })
  async search(
    @Query() query: GstinLookupQueryDto,
  ): Promise<{ success: true; message: string; data: GstinLookupPayload }> {
    const data = await this.gstinLookupService.search(query.gstin);
    return { success: true, message: 'GST details fetched successfully', data };
  }
}
