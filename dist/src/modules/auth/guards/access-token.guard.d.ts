import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuthSessionService } from '../auth-session.service';
import { TokenService } from '../token.service';
export declare class AccessTokenGuard implements CanActivate {
    private readonly reflector;
    private readonly tokenService;
    private readonly authSessionService;
    private readonly requestContextService;
    constructor(reflector: Reflector, tokenService: TokenService, authSessionService: AuthSessionService, requestContextService: RequestContextService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractBearerToken;
}
