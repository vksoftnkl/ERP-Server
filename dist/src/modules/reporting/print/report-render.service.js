"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReportRenderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportRenderService = void 0;
const common_1 = require("@nestjs/common");
const layout_engine_1 = require("../engine/layout/layout.engine");
const escp_renderer_1 = require("../engine/renderers/grid/escp.renderer");
const escpos_renderer_1 = require("../engine/renderers/grid/escpos.renderer");
const pdfkit_renderer_1 = require("../engine/renderers/pdfkit.renderer");
const report_data_provider_registry_1 = require("../providers/report-data-provider.registry");
const printer_profile_service_1 = require("./printer-profile.service");
const templates_service_1 = require("../templates/templates.service");
const DEFAULT_TIMEOUT_MS = 15_000;
let ReportRenderService = ReportRenderService_1 = class ReportRenderService {
    templates;
    providers;
    layout;
    printerProfiles;
    logger = new common_1.Logger(ReportRenderService_1.name);
    renderers;
    constructor(templates, providers, layout, printerProfiles, pdf, escp, escpos) {
        this.templates = templates;
        this.providers = providers;
        this.layout = layout;
        this.printerProfiles = printerProfiles;
        this.renderers = {
            PDF: pdf,
            ESCP_DOTMATRIX: escp,
            ESCPOS: escpos,
        };
    }
    async render(request) {
        const template = await this.templates.resolveForPrint({
            docType: request.docType,
            outputMode: request.outputMode,
            paperCode: request.paperCode,
            companyId: request.companyId,
            branchId: request.branchId,
            templateId: request.templateId,
        });
        const context = {
            companyId: request.companyId,
            branchId: request.branchId,
            accYear: request.accYear,
            docId: request.docId,
            userId: request.userId,
            params: request.params,
        };
        const datasets = await this.resolveDatasets(template.definition, context);
        const profile = await this.resolveProfile(request);
        return this.layoutAndRender(template, datasets, context, profile, request);
    }
    async preview(rawDefinition, options) {
        const definition = this.templates.validateDefinition(rawDefinition, {
            outputMode: options.outputMode,
        });
        const outputMode = options.outputMode ?? (definition.layoutMode === 'GRID' ? 'ESCPOS' : 'PDF');
        const context = {
            companyId: options.companyId,
            branchId: options.branchId,
            accYear: options.accYear,
            docId: options.docId ?? '',
            userId: options.userId,
            params: options.params,
        };
        const useSample = options.useSampleData ?? !options.docId;
        const datasets = useSample
            ? this.sampleDatasets(definition)
            : await this.resolveDatasets(definition, context);
        const profile = options.printerProfileCode
            ? await this.printerProfiles.findByCode(options.printerProfileCode, options.companyId)
            : await this.printerProfiles.findDefault(outputMode, options.companyId);
        return this.layoutAndRender({
            ptId: 'preview',
            name: 'preview',
            version: 0,
            outputMode,
            paperCode: definition.paper.code,
            definition,
            source: 'EXPLICIT',
        }, datasets, context, profile, { outputMode, docType: 'PREVIEW', docId: context.docId });
    }
    async layoutAndRender(template, datasets, context, profile, request) {
        const renderer = this.renderers[request.outputMode];
        if (!renderer) {
            throw new common_1.NotFoundException(`No renderer for output mode ${request.outputMode}. ` +
                `Available: ${Object.keys(this.renderers).join(', ')}`);
        }
        const tree = this.layout.render({
            definition: template.definition,
            datasets,
            ctx: {
                companyId: context.companyId,
                branchId: context.branchId,
                accYear: context.accYear,
                docId: context.docId,
                userId: context.userId,
                docType: request.docType,
                ...(context.params ?? {}),
            },
            sys: { now: new Date().toISOString() },
        });
        const rendered = await this.withTimeout(renderer.render(tree, {
            printerProfile: profile,
            creationDate: new Date(),
            timeoutMs: DEFAULT_TIMEOUT_MS,
        }), DEFAULT_TIMEOUT_MS, `${request.docType}/${request.docId}`);
        if (rendered.warnings.length > 0) {
            this.logger.warn(`Render of ${request.docType}/${request.docId} via template ${template.ptId} ` +
                `produced ${rendered.warnings.length} warning(s): ${rendered.warnings.slice(0, 5).join(' | ')}`);
        }
        this.logger.log(`Rendered ${request.docType}/${request.docId} · template ${template.name} v${template.version} ` +
            `(${template.source}) · ${request.outputMode} · ${rendered.pageCount}p · ` +
            `layout ${tree.stats.durationMs}ms · render ${rendered.durationMs}ms · ` +
            `${(rendered.bytes.length / 1024).toFixed(0)}KB`);
        return {
            ...rendered,
            templateId: template.ptId,
            templateName: template.name,
            templateVersion: template.version,
            templateSource: template.source,
            layoutMs: tree.stats.durationMs,
            detailRows: tree.stats.detailRows,
        };
    }
    async resolveDatasets(definition, context) {
        const resolved = await Promise.all(definition.datasets.map(async (dataset) => {
            const provider = this.providers.get(dataset.provider);
            const rows = await provider.resolve({
                ...context,
                params: { ...(context.params ?? {}), ...(dataset.params ?? {}) },
            });
            return [dataset.name, this.coerceCardinality(rows, dataset.cardinality)];
        }));
        return Object.fromEntries(resolved);
    }
    sampleDatasets(definition) {
        const entries = definition.datasets.map((dataset) => {
            const rows = this.providers.sample(dataset.provider);
            return [dataset.name, this.coerceCardinality(rows, dataset.cardinality)];
        });
        return Object.fromEntries(entries);
    }
    coerceCardinality(rows, cardinality) {
        if (cardinality === 'one') {
            return Array.isArray(rows) ? (rows[0] ?? {}) : rows;
        }
        return Array.isArray(rows) ? rows : [rows];
    }
    async resolveProfile(request) {
        if (request.outputMode === 'PDF' || request.outputMode === 'HTML') {
            return null;
        }
        if (request.printerProfileCode) {
            return this.printerProfiles.findByCode(request.printerProfileCode, request.companyId);
        }
        return this.printerProfiles.findDefault(request.outputMode, request.companyId);
    }
    async withTimeout(work, timeoutMs, label) {
        let timer;
        const timeout = new Promise((_resolve, reject) => {
            timer = setTimeout(() => reject(new common_1.InternalServerErrorException(`Rendering ${label} exceeded the ${timeoutMs}ms limit and was abandoned.`)), timeoutMs);
        });
        try {
            return await Promise.race([work, timeout]);
        }
        finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
};
exports.ReportRenderService = ReportRenderService;
exports.ReportRenderService = ReportRenderService = ReportRenderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [templates_service_1.TemplatesService,
        report_data_provider_registry_1.ReportDataProviderRegistry,
        layout_engine_1.LayoutEngine,
        printer_profile_service_1.PrinterProfileService,
        pdfkit_renderer_1.PdfKitRenderer,
        escp_renderer_1.EscPRenderer,
        escpos_renderer_1.EscPosRenderer])
], ReportRenderService);
//# sourceMappingURL=report-render.service.js.map