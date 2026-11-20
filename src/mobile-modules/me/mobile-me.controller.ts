import { Controller, Get, UseFilters, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { MobileExceptionFilter } from '../common/mobile-exception.filter';
import { MobileMeSuccessDto } from './dto/mobile-me-response.dto';
import { MobileMeService } from './mobile-me.service';
import type { MobileMe } from './types/mobile-me-api.types';

type MobileSuccess<T> = { success: true; message: string; data: T };

/**
 * GET /mobile/me: the signed-in login, its employee and its rights on the
 * menus the phone acts on. Needs a token (401 without one). Per-user, so not
 * cached.
 */
@ApiTags('Mobile · Me')
@ApiBearerAuth('access-token')
@Controller('mobile/me')
export class MobileMeController {
  constructor(private readonly mobileMeService: MobileMeService) {}

  @Get()
  @Version(API_VERSION)
  @UseFilters(MobileExceptionFilter)
  @ApiOperation({
    summary: 'The signed-in login: its employee (the receipt collector) and its rights',
    description:
      'userId, loginName, employeeId / employeeName (user_master.usr_employee_id when it names a ' +
      'live employee, else null) and rights keyed by menu id as text: "11" Sales Order, "12" ' +
      'Sales Bill, "99" Receipt, each {view, create, post, cancel, print} from public.user_menus ' +
      'as the desktop guards read them (no row = all false). Needs a token; 401 ' +
      'AUTH_USER_INACTIVE when the login has been deleted since the token was issued.',
  })
  @ApiOkResponse({ type: MobileMeSuccessDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No token, or a bad one' })
  async me(): Promise<MobileSuccess<MobileMe>> {
    const data = await this.mobileMeService.me();
    return { success: true, message: 'Login fetched successfully', data };
  }
}
