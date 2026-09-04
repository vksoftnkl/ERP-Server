import { NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from '../request-context/request-context.service';
export declare class RequestContextMiddleware implements NestMiddleware {
    private readonly requestContextService;
    constructor(requestContextService: RequestContextService);
    use(request: Request, _response: Response, next: NextFunction): void;
    private extractClientIp;
    private extractUserIdHeader;
    private normalizeIpAddress;
}
