import type { Request } from 'express';
import { ErrorMessagesQueryDto } from './dto/error-messages-query.dto';
import { ErrorMessageService } from './error-messages.service';
import type { ErrorMessageCataloguePayload } from './error-messages.types';
export declare class ErrorMessagesController {
    private readonly messages;
    constructor(messages: ErrorMessageService);
    catalogue(query: ErrorMessagesQueryDto, request: Request): Promise<{
        success: true;
        message: string;
        data: ErrorMessageCataloguePayload;
    }>;
}
