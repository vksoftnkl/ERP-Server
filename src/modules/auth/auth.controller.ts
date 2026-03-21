import { Body, Controller, HttpCode, HttpStatus, Post, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
  async login(@Body() loginAuthDto: LoginAuthDto): Promise<LoginResponseDto> {
    return this.authService.login(loginAuthDto);
  }
}
