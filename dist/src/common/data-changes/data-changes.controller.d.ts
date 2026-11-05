import { type MessageEvent } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { AccessTokenPayload } from '../../modules/auth/token.service';
import { DataChangeService } from './data-change.service';
export declare class DataChangesController {
    private readonly dataChangeService;
    constructor(dataChangeService: DataChangeService);
    stream(request: Request & {
        user?: AccessTokenPayload;
    }): Observable<MessageEvent>;
}
