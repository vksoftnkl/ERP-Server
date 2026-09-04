import type { Response } from 'express';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrintDataProviderRegistry } from './data/print-data-provider.registry';
import { RenderDocumentDto } from './dto/render-document.dto';
import { RenderPreviewDto } from './dto/render-preview.dto';
import { PrintRenderService } from './print-render.service';
import { PrintRenderSuccessResponse, RenderInspection } from './types/print-render-api.types';
export declare class PrintRenderController {
    private readonly printRenderService;
    private readonly providers;
    private readonly requestContextService;
    constructor(printRenderService: PrintRenderService, providers: PrintDataProviderRegistry, requestContextService: RequestContextService);
    preview(dto: RenderPreviewDto, response: Response): Promise<PrintRenderSuccessResponse<RenderInspection> | void>;
    print(dto: RenderDocumentDto, response: Response): Promise<PrintRenderSuccessResponse<RenderInspection> | void>;
    providerList(): PrintRenderSuccessResponse<Array<{
        code: string;
        label: string;
        cardinality: string;
    }>>;
    private contextFrom;
    private send;
    private inspect;
}
