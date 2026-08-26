import { Queue } from 'bullmq';
import { Response } from 'express';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BulkPrintResult } from './bulk-print.processor';
import { BulkPrintDto, PreviewDto, PrintQueryDto } from './dto/print-request.dto';
import { ReportRenderService } from './report-render.service';
export declare class PrintController {
    private readonly renderService;
    private readonly requestContext;
    private readonly bulkQueue;
    constructor(renderService: ReportRenderService, requestContext: RequestContextService, bulkQueue: Queue);
    print(docType: string, docId: string, query: PrintQueryDto, response: Response): Promise<void>;
    preview(dto: PreviewDto, response: Response): Promise<void>;
    bulkPrint(dto: BulkPrintDto): Promise<{
        success: true;
        message: string;
        data: {
            jobId: string;
            queued: number;
        };
    }>;
    jobStatus(jobId: string): Promise<{
        success: true;
        message: string;
        data: {
            jobId: string;
            state: string;
            progress: number;
            result: BulkPrintResult | null;
            failedReason: string | null;
        };
    }>;
    private requireCompanyId;
}
