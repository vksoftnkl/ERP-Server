import { Body, Controller, HttpCode, HttpStatus, Post, Req, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and return access token' })
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
    });
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
