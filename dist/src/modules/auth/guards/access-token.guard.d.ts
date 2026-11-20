import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuthEpochService } from '../../app-version/services/auth-epoch.service';
import { AuthSessionService } from '../auth-session.service';
import { TokenService } from '../token.service';
export declare class AccessTokenGuard implements CanActivate {
    private readonly reflector;
    private readonly tokenService;
    private readonly authSessionService;
    private readonly requestContextService;
    private readonly authEpoch;
    private readonly prisma;
    constructor(reflector: Reflector, tokenService: TokenService, authSessionService: AuthSessionService, requestContextService: RequestContextService, authEpoch: AuthEpochService, prisma: PrismaService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private assertPasswordChanged;
    private isPasswordChangeAllowed;
    private isOptionalAuth;
    private extractBearerToken;
}
