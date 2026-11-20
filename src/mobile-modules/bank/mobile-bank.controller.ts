import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileBankListQueryDto } from './dto/mobile-bank.dto';
import { MobileBankListSuccessDto } from './dto/mobile-bank-response.dto';
import { MobileBankService } from './mobile-bank.service';
import type { MobileBankList } from './types/mobile-bank-api.types';

type MobileSuccess<T> = { success: true; message: string; data: T };

/**
 * GET /mobile/banks/list: the bank list for a phone cheque's Bank dropdown,
 * read at Sync. @OptionalAuth like the other mobile reads; the phone must be
 * registered (deviceUid). No @CacheTTL: the HTTP cache key would hold no
 * device, so a blocked phone could be answered from the cache.
 */
@ApiTags('Mobile · Banks')
@ApiBearerAuth('access-token')
@Controller('mobile/banks')
export class MobileBankController {
  constructor(private readonly mobileBankService: MobileBankService) {}

  @Get('list')
  @Version(API_VERSION)
  @OptionalAuth()
  @ApiSecurity({})
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary: 'The banks a cheque can be drawn on, for the phone cheque Bank dropdown',
    description:
      'fixed.bank_master rows that are active and not deleted, by name (the rows of the ' +
      "desktop's bank popup, grid 111). Not paged: the whole list in one answer. The phone " +
      'sends the NAME as tdBankName; td_bank_name is a varchar, not a key.',
  })
  @ApiOkResponse({ type: MobileBankListSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: 'deviceUid missing' })
  @ApiForbiddenResponse({
    type: HttpErrorResponseDto,
    description: 'Phone not registered, blocked or inactive (MOBILE_DEVICE_*)',
  })
  async list(@Query() query: MobileBankListQueryDto): Promise<MobileSuccess<MobileBankList>> {
    const data = await this.mobileBankService.list(query);
    return { success: true, message: 'Banks fetched successfully', data };
  }
}
