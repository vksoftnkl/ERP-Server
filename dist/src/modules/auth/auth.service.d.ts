import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthSessionService } from './auth-session.service';
import { TokenService } from './token.service';
type LoginRequestMetadata = {
    userAgent: string | null;
    appVersion: string | null;
};
export declare class AuthService {
    private readonly tokenService;
    private readonly authSessionService;
    private readonly prisma;
    private readonly requestContextService;
    private readonly logger;
    constructor(tokenService: TokenService, authSessionService: AuthSessionService, prisma: PrismaService, requestContextService: RequestContextService);
    login(loginAuthDto: LoginAuthDto, requestMetadata?: LoginRequestMetadata): Promise<LoginResponseDto>;
    refresh(refreshToken: string): Promise<LoginResponseDto>;
    private findLoginUser;
    private buildLoginChannelFilter;
    private resolveLoginChannel;
    private logUnmatchedLoginName;
    private findAndUpdateDeviceOnLogin;
    private describeBlockedDevice;
    private updateUserOnLogin;
    private incrementFailedLogin;
    private verifyPassword;
    private saveUserLoginSession;
    private normalizeSessionToken;
    private describeError;
}
export {};
