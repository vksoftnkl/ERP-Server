import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OutputMode } from '../templates/dto/template-definition.schema';
import { ReportRenderService } from './report-render.service';
export interface BulkPrintJobData {
    readonly docType: string;
    readonly docIds: readonly string[];
    readonly outputMode: OutputMode;
    readonly paperCode: string;
    readonly companyId: string;
    readonly branchId: string | null;
    readonly accYear: string;
    readonly userId: string | null;
    readonly templateId?: string;
    readonly printerProfileCode?: string;
    readonly params?: Record<string, unknown>;
}
export interface BulkPrintDocumentResult {
    readonly docId: string;
    readonly ok: boolean;
    readonly file?: string;
    readonly bytes?: number;
    readonly pageCount?: number;
    readonly error?: string;
}
export interface BulkPrintResult {
    readonly jobId: string;
    readonly requested: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly outputDir: string;
    readonly documents: readonly BulkPrintDocumentResult[];
    readonly durationMs: number;
}
export declare class BulkPrintProcessor extends WorkerHost {
    private readonly renderer;
    private readonly logger;
    constructor(renderer: ReportRenderService);
    process(job: Job<BulkPrintJobData>): Promise<BulkPrintResult>;
}
