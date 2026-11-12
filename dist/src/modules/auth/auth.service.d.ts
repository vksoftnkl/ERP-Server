import type { ClientInfo } from '../../common/client-info/client-info';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ClientTrackingService } from '../app-version/services/client-tracking.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthSessionService } from './auth-session.service';
import { TokenService } from './token.service';
type LoginRequestMetadata = {
    userAgent: string | null;
    appVersion: string | null;
    client?: ClientInfo | null;
};
export declare const LEGACY_LOGIN_APP_VERSION_FIELD = "auth.login.app_version";
export declare class AuthService {
    private readonly tokenService;
    private readonly authSessionService;
    private readonly prisma;
    private readonly requestContextService;
    private readonly clientTracking;
    private readonly logger;
    constructor(tokenService: TokenService, authSessionService: AuthSessionService, prisma: PrismaService, requestContextService: RequestContextService, clientTracking: ClientTrackingService);
    login(loginAuthDto: LoginAuthDto, requestMetadata?: LoginRequestMetadata): Promise<LoginResponseDto>;
    refresh(refreshToken: string, client?: ClientInfo | null): Promise<LoginResponseDto>;
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
