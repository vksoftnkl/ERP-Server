import { PrismaService } from "../../../database/prisma/prisma.service";
import { PrintTemplateAssignmentService } from '../print-template-assignment/print-template-assignment.service';
import { DatasetRunnerService } from './data/dataset-runner.service';
import { OutputMode } from './definition/template-definition.schema';
import { LayoutEngine } from './engine/layout/layout.engine';
import { EscPRenderer } from './engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from './engine/renderers/grid/escpos.renderer';
import { PdfKitRenderer } from './engine/renderers/pdfkit.renderer';
import { PrintLogService } from './print-log.service';
import { RecordableOutputMode } from './print-render.constants';
import { RenderContext, RenderOutcome } from './types/print-render-api.types';
export declare const WHATSAPP_ASSIGNMENT_LADDER: readonly ["WHATSAPP", "PDF", "PRINT"];
export interface PreviewRequest {
    readonly versionId: string;
    readonly context: RenderContext;
    readonly params: Record<string, unknown>;
    readonly outputMode?: OutputMode;
    readonly copies?: number;
    readonly copyLabels?: readonly string[];
    readonly body?: Record<string, unknown>;
    readonly docIds?: readonly string[];
}
export interface PrintRequest {
    readonly purposeId: string;
    readonly srcModule?: string;
    readonly srcDocType?: string;
    readonly context: RenderContext;
    readonly params: Record<string, unknown>;
    readonly outputMode?: OutputMode;
    readonly assignmentOutputMode?: string;
    readonly copies?: number;
    readonly isReprint?: boolean;
}
export interface RecordPrintRequest {
    readonly versionId: string;
    readonly context: RenderContext;
    readonly docIds?: readonly string[];
    readonly outputMode: RecordableOutputMode;
    readonly pageCount?: number;
    readonly byteCount?: number;
}
export interface PrintOutcome extends RenderOutcome {
    readonly printLogIds: readonly string[];
    readonly assignment: {
        readonly ptaId: string;
        readonly scope: string;
        readonly printerName: string | null;
        readonly printerSource: string;
        readonly outputMode: string;
    };
}
export declare class PrintRenderService {
    private readonly prisma;
    private readonly datasetRunner;
    private readonly assignments;
    private readonly printLog;
    private readonly layout;
    private readonly logger;
    private readonly renderers;
    constructor(prisma: PrismaService, datasetRunner: DatasetRunnerService, assignments: PrintTemplateAssignmentService, printLog: PrintLogService, layout: LayoutEngine, pdf: PdfKitRenderer, escpos: EscPosRenderer, escp: EscPRenderer);
    preview(request: PreviewRequest): Promise<RenderOutcome>;
    print(request: PrintRequest): Promise<PrintOutcome>;
    renderForWhatsApp(request: {
        purposeCode: string;
        context: RenderContext;
        params: Record<string, unknown>;
    }): Promise<{
        ok: true;
        bytes: Buffer;
        versionId: string;
        templateCode: string;
        assignmentMode: string;
    } | {
        ok: false;
        reason: 'NO_DESIGN' | 'FAILED';
        message: string;
    }>;
    recordPrint(request: RecordPrintRequest): Promise<string[]>;
    private withCurrentAccYear;
    private renderDefinition;
    private loadPurpose;
    private loadVersion;
    private build;
    private buildFromUnsavedBody;
    private resolveParams;
    private runDatasets;
    private rendererForAssignment;
    private chooseRenderer;
    private labelsFor;
    private mergeTrees;
    private asBadRequest;
    private withTimeout;
}
