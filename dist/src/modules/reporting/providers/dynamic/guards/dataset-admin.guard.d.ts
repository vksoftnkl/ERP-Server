import { CanActivate } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContextService } from '../../../../../common/request-context/request-context.service';
export declare class DatasetAdminGuard implements CanActivate {
    private readonly requestContext;
    private readonly logger;
    private readonly allowed;
    constructor(requestContext: RequestContextService, config: ConfigService);
    canActivate(): boolean;
}
