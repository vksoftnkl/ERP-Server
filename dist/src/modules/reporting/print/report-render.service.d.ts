import { OutputMode } from '../templates/dto/template-definition.schema';
import { LayoutEngine } from '../engine/layout/layout.engine';
import { EscPRenderer } from '../engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from '../engine/renderers/grid/escpos.renderer';
import { PdfKitRenderer } from '../engine/renderers/pdfkit.renderer';
import { RenderResult } from '../engine/renderers/renderer.types';
import { ReportDataProviderRegistry } from '../providers/report-data-provider.registry';
import { PrinterProfileService } from './printer-profile.service';
import { TemplatesService } from '../templates/templates.service';
export interface RenderRequest {
    readonly docType: string;
    readonly docId: string;
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
export interface RenderOutcome extends RenderResult {
    readonly templateId: string;
    readonly templateName: string;
    readonly templateVersion: number;
    readonly templateSource: string;
    readonly layoutMs: number;
    readonly detailRows: number;
}
export declare class ReportRenderService {
    private readonly templates;
    private readonly providers;
    private readonly layout;
    private readonly printerProfiles;
    private readonly logger;
    private readonly renderers;
    constructor(templates: TemplatesService, providers: ReportDataProviderRegistry, layout: LayoutEngine, printerProfiles: PrinterProfileService, pdf: PdfKitRenderer, escp: EscPRenderer, escpos: EscPosRenderer);
    render(request: RenderRequest): Promise<RenderOutcome>;
    preview(rawDefinition: Record<string, unknown>, options: {
        outputMode?: OutputMode;
        companyId: string;
        branchId: string | null;
        accYear: string;
        userId: string | null;
        docId?: string;
        useSampleData?: boolean;
        params?: Record<string, unknown>;
        printerProfileCode?: string;
    }): Promise<RenderOutcome>;
    private layoutAndRender;
    private resolveDatasets;
    private sampleDatasets;
    private coerceCardinality;
    private resolveProfile;
    private withTimeout;
}
