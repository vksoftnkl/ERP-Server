import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginAuthDto: LoginAuthDto, request: Request): Promise<LoginResponseDto>;
    refresh(refreshTokenDto: RefreshTokenDto): Promise<LoginResponseDto>;
    private extractHeader;
}
