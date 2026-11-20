import { Body, Controller, HttpCode, HttpStatus, Post, Req, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { clientInfoOf } from '../../common/client-info/client-info';
import { Public } from '../../common/decorators/public.decorator';
import { AllowWhilePasswordChangeRequired } from '../../common/decorators/password-change-allowed.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ChangePasswordResponseDto } from './dto/change-password.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { API_VERSION } from '../../common/constants/api-version';
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Public()
  @Post('login')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user and return access token',
    description:
      'Wrong password or unknown login name: 401 AUTH_INVALID_CREDENTIALS (nothing more is said). ' +
      'Only after the password is proved right does the answer name the account state ' +
      '(review step 6): 401 AUTH_USER_INACTIVE (inactive or deleted), 401 AUTH_USER_LOCKED, ' +
      '401 AUTH_CHANNEL_DISABLED (detail `channel`: desktop | web | mobile). ' +
      '`mustChangePassword: true` = an administrator reset the password: this session may call ' +
      'POST /auth/change-password only (anything else is 403 AUTH_PASSWORD_CHANGE_REQUIRED) ' +
      'until the user has changed it.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  async login(
    @Body() loginAuthDto: LoginAuthDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginAuthDto, {
      userAgent: this.extractHeader(request.headers['user-agent']),
      appVersion: this.extractHeader(request.headers['x-app-version']),
      client: clientInfoOf(request),
    });
  }
  @Public()
  @Post('refresh')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.refresh(refreshTokenDto.refresh_token, clientInfoOf(request));
  }
  // Review list 11-19, task 1: NOT @Public — the user is the access token's.
  // Review step 6 (U8): the one route a session whose password must change may call.
  @AllowWhilePasswordChangeRequired()
  @Post('change-password')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Change the signed-in user's own password (current password checked)",
    description:
      'The user comes from the access token only; a usrId in the body is refused ' +
      '(VALIDATION_WHITELIST). 400 AUTH_CURRENT_PASSWORD_WRONG (field currentPassword), ' +
      '400 AUTH_NEW_PASSWORD_TOO_SHORT / AUTH_NEW_PASSWORD_SAME (field newPassword), ' +
      '401 AUTH_USER_INACTIVE when the account was deactivated, deleted or locked since login. ' +
      'Clears usr_must_change_password; this session stays signed in, and a session that ' +
      'logged in with mustChangePassword: true may call every other route again at once.',
  })
  @ApiOkResponse({ type: ChangePasswordResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  async changePassword(@Body() dto: ChangePasswordDto): Promise<ChangePasswordResponseDto> {
    const data = await this.authService.changePassword(dto);
    return { success: true, message: 'Password changed', data };
  }
  private extractHeader(headerValue: string | string[] | undefined): string | null {
    if (typeof headerValue === 'string') {
      const trimmed = headerValue.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (Array.isArray(headerValue)) {
      const firstValue = headerValue.find(
        (value) => typeof value === 'string' && value.trim().length > 0,
      );
      return typeof firstValue === 'string' ? firstValue.trim() : null;
    }
    return null;
  }
}
