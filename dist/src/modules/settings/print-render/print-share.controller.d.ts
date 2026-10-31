import type { Response } from 'express';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { CreatePrintShareDto } from './dto/create-print-share.dto';
import { CreatedPrintShare, PrintShareService } from './print-share.service';
import { PrintRenderSuccessResponse } from './types/print-render-api.types';
export declare class PrintShareController {
    private readonly printShareService;
    private readonly requestContextService;
    private readonly logger;
    constructor(printShareService: PrintShareService, requestContextService: RequestContextService);
    create(dto: CreatePrintShareDto): Promise<PrintRenderSuccessResponse<CreatedPrintShare>>;
    open(token: string, response: Response): Promise<void>;
    openNamed(token: string, response: Response): Promise<void>;
    private serve;
    private html;
}
