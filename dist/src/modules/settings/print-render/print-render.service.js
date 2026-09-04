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
var PrintRenderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintRenderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const print_template_assignment_service_1 = require("../print-template-assignment/print-template-assignment.service");
const dataset_runner_service_1 = require("./data/dataset-runner.service");
const render_params_1 = require("./data/render-params");
const definition_from_version_1 = require("./definition/definition-from-version");
const layout_engine_1 = require("./engine/layout/layout.engine");
const escp_renderer_1 = require("./engine/renderers/grid/escp.renderer");
const escpos_renderer_1 = require("./engine/renderers/grid/escpos.renderer");
const pdfkit_renderer_1 = require("./engine/renderers/pdfkit.renderer");
const print_log_service_1 = require("./print-log.service");
const print_render_constants_1 = require("./print-render.constants");
let PrintRenderService = PrintRenderService_1 = class PrintRenderService {
    prisma;
    datasetRunner;
    assignments;
    printLog;
    layout;
    logger = new common_1.Logger(PrintRenderService_1.name);
    renderers;
    constructor(prisma, datasetRunner, assignments, printLog, layout, pdf, escpos, escp) {
        this.prisma = prisma;
        this.datasetRunner = datasetRunner;
        this.assignments = assignments;
        this.printLog = printLog;
        this.layout = layout;
        this.renderers = { PDF: pdf, ESCPOS: escpos, ESCP_DOTMATRIX: escp };
    }
    async preview(request) {
        const bundle = await this.loadVersion(request.versionId, request.context.companyId);
        const context = await this.withCurrentAccYear(request.context);
        const definition = request.body
            ? this.buildFromUnsavedBody(bundle, request.body)
            : this.build(bundle);
        return this.renderDefinition({
            bundle,
            definition: definition.definition,
            layoutMode: definition.layoutMode,
            context,
            params: request.params,
            requestedMode: request.outputMode,
            copies: request.copies ?? 1,
            copyLabels: request.copyLabels ?? [],
            docType: 'PREVIEW',
        });
    }
    async print(request) {
        const context = await this.withCurrentAccYear(request.context);
        const purpose = await this.loadPurpose(request.purposeId, context.companyId);
        if (request.isReprint && !purpose.ppoAllowReprint) {
            (0, module_service_utils_1.throwSettingsBadRequest)('This purpose does not allow reprints', [
                {
                    field: 'isReprint',
                    message: 'ppoAllowReprint is false for this purpose, so it may be printed once. Change the ' +
                        'purpose if that is wrong; there is no override on the render.',
                },
            ]);
        }
        const resolution = await this.assignments.resolve({
            purposeId: request.purposeId,
            companyId: context.companyId,
            branchId: context.branchId ?? undefined,
            deviceId: context.deviceId ?? undefined,
            ...(request.assignmentOutputMode ? { outputMode: request.assignmentOutputMode } : {}),
        });
        if (!resolution.publishedRevId) {
            (0, module_service_utils_1.throwSettingsNotFound)('The assigned template has no published revision', 'purposeId', `Template ${resolution.ptaTemplateName ?? resolution.ptaTemplateId} is assigned at the ` +
                `${resolution.scope} scope but its publish pointer is empty — either nothing has been ` +
                'published yet, or the live revision was retired, which releases the pointer and is ' +
                'what withdrawing a design means.');
        }
        const bundle = await this.loadVersion(resolution.publishedRevId, context.companyId);
        const built = this.build(bundle);
        const copies = Math.min(request.copies ?? resolution.copies ?? 1, print_render_constants_1.MAX_COPIES);
        const outcome = await this.renderDefinition({
            bundle,
            definition: built.definition,
            layoutMode: built.layoutMode,
            context: request.context,
            params: request.params,
            requestedMode: request.outputMode ?? this.rendererForAssignment(resolution.ptaOutputMode),
            copies,
            copyLabels: resolution.copyLabels,
            docType: request.srcDocType ?? purpose.ppoDocType,
        });
        const accYear = await this.printLog.currentAccYear(context.companyId, context.accYear);
        const entries = outcome.copyLabels.map((label, index) => ({
            accYear,
            companyId: context.companyId,
            branchId: context.branchId,
            deviceId: context.deviceId,
            srcModule: request.srcModule ?? purpose.ppoSrcModule,
            srcDocType: request.srcDocType ?? purpose.ppoDocType,
            srcDocId: context.docId,
            srcAccYear: context.accYear,
            purposeId: request.purposeId,
            templateId: bundle.template.ptlId,
            versionId: bundle.version.ptvId,
            printerId: resolution.ptaPrinterId,
            outputMode: request.isReprint ? 'REPRINT' : 'PRINT',
            copyNo: index + 1,
            copyLabel: label || null,
            lang: bundle.version.ptvLang,
            params: Object.keys(request.params).length > 0 ? request.params : null,
            status: 'SUCCESS',
            error: null,
            pageCount: outcome.pagesPerCopy[index] ?? null,
            byteCount: outcome.bytes.length,
            durationMs: outcome.layoutMs + outcome.renderMs,
            printedBy: context.userId,
        }));
        const printLogIds = await this.printLog.record(entries);
        return {
            ...outcome,
            printLogIds,
            assignment: {
                ptaId: resolution.ptaId,
                scope: resolution.scope,
                printerName: resolution.ptaPrinterName,
                printerSource: resolution.printerSource,
                outputMode: resolution.ptaOutputMode,
            },
        };
    }
    async withCurrentAccYear(context) {
        const named = context.accYear?.trim();
        if (named && print_render_constants_1.ACC_YEAR_PATTERN.test(named)) {
            return { ...context, accYear: named };
        }
        return {
            ...context,
            accYear: await this.printLog.currentAccYear(context.companyId, null),
        };
    }
    async renderDefinition(input) {
        const { bundle, definition, layoutMode, context } = input;
        const outputMode = this.chooseRenderer(layoutMode, input.requestedMode);
        const renderer = this.renderers[outputMode];
        if (!renderer) {
            throw new common_1.InternalServerErrorException(`No renderer registered for ${outputMode}`);
        }
        const params = this.resolveParams(bundle.version, input.params);
        const started = Date.now();
        const { data, resolved, warnings } = await this.runDatasets(bundle, context, params);
        const copies = Math.max(1, Math.min(input.copies, print_render_constants_1.MAX_COPIES));
        const labels = this.labelsFor(copies, input.copyLabels);
        const trees = [];
        for (const [index, label] of labels.entries()) {
            trees.push(this.layout.render({
                definition,
                datasets: data,
                ctx: {
                    ...params,
                    companyId: context.companyId,
                    branchId: context.branchId,
                    accYear: context.accYear,
                    docId: context.docId,
                    docType: input.docType,
                    userId: context.userId,
                    deviceId: context.deviceId,
                    lang: bundle.version.ptvLang,
                    copyNo: index + 1,
                    copyLabel: label,
                    copies,
                    params,
                },
                sys: {
                    now: new Date().toISOString(),
                    template: bundle.template.ptlName,
                    templateCode: bundle.template.ptlCode,
                    revNo: bundle.version.ptvRevNo,
                },
            }));
        }
        const layoutMs = Date.now() - started;
        const merged = this.mergeTrees(trees);
        const renderStarted = Date.now();
        const rendered = await this.withTimeout(renderer.render(merged, {
            creationDate: new Date(),
            timeoutMs: print_render_constants_1.RENDER_COPY_TIMEOUT_MS * copies,
        }), print_render_constants_1.RENDER_TIMEOUT_MS, `${bundle.template.ptlCode} rev ${bundle.version.ptvRevNo}`);
        const allWarnings = [
            ...warnings,
            ...merged.warnings.map((warning) => ({ kind: warning.kind, message: warning.message })),
            ...rendered.warnings.map((message) => ({ kind: 'renderer', message })),
        ];
        if (allWarnings.length > 0) {
            this.logger.warn(`Render of ${bundle.template.ptlCode} rev ${bundle.version.ptvRevNo} produced ` +
                `${allWarnings.length} warning(s): ${allWarnings
                    .slice(0, 5)
                    .map((warning) => warning.message)
                    .join(' | ')}`);
        }
        this.logger.log(`Rendered ${bundle.template.ptlCode} rev ${bundle.version.ptvRevNo} · ${outputMode} · ` +
            `${copies} cop${copies === 1 ? 'y' : 'ies'} · ${merged.pageCount}p · ` +
            `layout ${layoutMs}ms · render ${rendered.durationMs}ms · ` +
            `${(rendered.bytes.length / 1024).toFixed(0)}KB`);
        return {
            bytes: rendered.bytes,
            contentType: rendered.contentType,
            extension: rendered.extension,
            outputMode,
            pageCount: merged.pageCount,
            pagesPerCopy: trees.map((tree) => tree.pageCount),
            copies,
            copyLabels: labels,
            templateId: bundle.template.ptlId,
            templateName: bundle.template.ptlName,
            versionId: bundle.version.ptvId,
            revNo: bundle.version.ptvRevNo,
            status: bundle.version.ptvStatus,
            engine: bundle.version.ptvEngine,
            paperCode: definition.paper.code,
            layoutMs,
            renderMs: Date.now() - renderStarted,
            detailRows: merged.stats.detailRows,
            datasets: resolved,
            warnings: allWarnings,
        };
    }
    async loadPurpose(purposeId, companyId) {
        const purpose = await this.prisma.printPurpose.findFirst({
            where: {
                ppoId: purposeId,
                ppoIsDeleted: false,
                ppoIsActive: true,
                OR: [{ ppoCompanyId: null }, { ppoCompanyId: companyId }],
            },
            select: { ppoSrcModule: true, ppoDocType: true, ppoAllowReprint: true },
        });
        if (!purpose) {
            (0, module_service_utils_1.throwSettingsNotFound)('Print purpose not found', 'purposeId', `No active print purpose has id ${purposeId} for this company. A purpose is what makes ` +
                'a thing printable at all — 3.0 kept this list in C++ as a magic integer, and it is a ' +
                'table now.');
        }
        return purpose;
    }
    async loadVersion(versionId, companyId) {
        const version = await this.prisma.printTemplateVersion.findFirst({
            where: { ptvId: versionId, ptvIsDeleted: false },
            include: {
                template: true,
                datasets: {
                    where: { ptdIsDeleted: false },
                    orderBy: [{ ptdDatasetNo: 'asc' }],
                },
            },
        });
        if (!version) {
            (0, module_service_utils_1.throwSettingsNotFound)('Revision not found', 'versionId', `No undeleted print_template_version has id ${versionId}`);
        }
        const owner = version.template.ptlCompanyId;
        if (owner !== null && owner !== companyId) {
            (0, module_service_utils_1.throwSettingsNotFound)('Revision not found', 'versionId', `Revision ${versionId} belongs to another company`);
        }
        return { template: version.template, version, datasets: version.datasets };
    }
    build(bundle) {
        try {
            const built = (0, definition_from_version_1.buildDefinition)(bundle.version, bundle.datasets);
            return { definition: built.definition, layoutMode: built.layoutMode };
        }
        catch (error) {
            this.asBadRequest(error);
        }
    }
    buildFromUnsavedBody(bundle, body) {
        if (bundle.version.ptvStatus !== 'DRAFT') {
            (0, module_service_utils_1.throwSettingsBadRequest)('A live revision can only be previewed as it stands', [
                {
                    field: 'body',
                    message: `Revision ${bundle.version.ptvRevNo} is ${bundle.version.ptvStatus}, so it is frozen ` +
                        'and previewing a different body against it would show a design nothing will print. ' +
                        'Save the change as a new revision (send a version row with no ptvId) and preview that.',
                },
            ]);
        }
        try {
            const built = (0, definition_from_version_1.buildDefinitionFromBody)(bundle.version, bundle.datasets, body);
            return { definition: built.definition, layoutMode: built.layoutMode };
        }
        catch (error) {
            this.asBadRequest(error);
        }
    }
    resolveParams(version, supplied) {
        try {
            return (0, render_params_1.resolveRenderParams)(version.ptvParams, supplied);
        }
        catch (error) {
            this.asBadRequest(error);
        }
    }
    async runDatasets(bundle, context, params) {
        try {
            const result = await this.datasetRunner.run({
                datasets: bundle.datasets,
                context,
                params,
                lang: bundle.version.ptvLang,
            });
            return { data: result.data, resolved: result.resolved, warnings: [...result.warnings] };
        }
        catch (error) {
            this.asBadRequest(error);
        }
    }
    rendererForAssignment(assignmentMode) {
        const mapped = print_render_constants_1.RENDERER_FOR_OUTPUT_MODE[assignmentMode];
        return mapped === undefined || mapped === 'BY_LAYOUT' ? undefined : mapped;
    }
    chooseRenderer(layoutMode, requested) {
        const mode = requested ?? print_render_constants_1.RENDERER_FOR_LAYOUT_MODE[layoutMode];
        if (!print_render_constants_1.IMPLEMENTED_RENDERERS.includes(mode)) {
            (0, module_service_utils_1.throwSettingsBadRequest)(`There is no ${mode} renderer`, [
                {
                    field: 'outputMode',
                    message: `Available renderers: ${print_render_constants_1.IMPLEMENTED_RENDERERS.join(', ')}.`,
                },
            ]);
        }
        if (print_render_constants_1.LAYOUT_MODE_FOR_RENDERER[mode] !== layoutMode) {
            (0, module_service_utils_1.throwSettingsBadRequest)(`A ${layoutMode} design cannot be rendered as ${mode}`, [
                {
                    field: 'outputMode',
                    message: layoutMode === 'GRID'
                        ? `This revision's engine lays out in CHARACTER CELLS, and ${mode} draws in ` +
                            'millimetres. Render it as ESCPOS or ESCP_DOTMATRIX, or design it with a page ' +
                            'engine (JSON_BANDS) if it is meant for a sheet.'
                        : `This revision's engine lays out in MILLIMETRES, and ${mode} draws on a ` +
                            'character grid. Render it as PDF, or design it with ESCPOS_TEXT if it is meant ' +
                            'for a roll.',
                },
            ]);
        }
        return mode;
    }
    labelsFor(copies, labels) {
        const usable = labels.filter((label) => label && label.toUpperCase() !== 'NA');
        return Array.from({ length: copies }, (_unused, index) => usable[index] ?? '');
    }
    mergeTrees(trees) {
        if (trees.length === 1)
            return trees[0];
        const pages = trees.flatMap((tree) => tree.pages);
        return {
            ...trees[0],
            pageCount: pages.length,
            pages: pages.map((page, index) => ({ ...page, index })),
            warnings: trees.flatMap((tree) => tree.warnings),
            stats: {
                detailRows: trees.reduce((sum, tree) => sum + tree.stats.detailRows, 0),
                bandsEmitted: trees.reduce((sum, tree) => sum + tree.stats.bandsEmitted, 0),
                durationMs: trees.reduce((sum, tree) => sum + tree.stats.durationMs, 0),
            },
        };
    }
    asBadRequest(error) {
        if (error instanceof definition_from_version_1.PrintRenderDefinitionError ||
            error instanceof dataset_runner_service_1.DatasetRunError ||
            error instanceof render_params_1.RenderParamError) {
            (0, module_service_utils_1.throwSettingsBadRequest)(error.message, error.details);
        }
        throw error;
    }
    async withTimeout(work, timeoutMs, label) {
        let timer;
        const expiry = new Promise((_resolve, reject) => {
            timer = setTimeout(() => reject(new common_1.InternalServerErrorException(`Rendering ${label} exceeded the ${timeoutMs}ms limit and was abandoned.`)), timeoutMs);
        });
        try {
            return await Promise.race([work, expiry]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
};
exports.PrintRenderService = PrintRenderService;
exports.PrintRenderService = PrintRenderService = PrintRenderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        dataset_runner_service_1.DatasetRunnerService,
        print_template_assignment_service_1.PrintTemplateAssignmentService,
        print_log_service_1.PrintLogService,
        layout_engine_1.LayoutEngine,
        pdfkit_renderer_1.PdfKitRenderer,
        escpos_renderer_1.EscPosRenderer,
        escp_renderer_1.EscPRenderer])
], PrintRenderService);
//# sourceMappingURL=print-render.service.js.map