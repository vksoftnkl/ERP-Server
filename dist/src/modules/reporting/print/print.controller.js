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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintController = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bullmq_2 = require("bullmq");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const print_request_dto_1 = require("./dto/print-request.dto");
const print_constants_1 = require("./print.constants");
const report_render_service_1 = require("./report-render.service");
let PrintController = class PrintController {
    renderService;
    requestContext;
    bulkQueue;
    constructor(renderService, requestContext, bulkQueue) {
        this.renderService = renderService;
        this.requestContext = requestContext;
        this.bulkQueue = bulkQueue;
    }
    async print(docType, docId, query, response) {
        const companyId = this.requireCompanyId();
        const rendered = await this.renderService.render({
            docType: docType.toUpperCase(),
            docId,
            outputMode: (query.mode ?? 'PDF'),
            paperCode: query.paper ?? 'A4',
            companyId,
            branchId: query.branchId ?? null,
            accYear: query.accYear,
            userId: this.requestContext.getUserId(),
            templateId: query.templateId,
            printerProfileCode: query.printerProfile,
            params: query.partyId ? { partyId: query.partyId, asOn: query.asOn } : undefined,
        });
        const fileName = `${docType.toLowerCase()}-${docId}.${rendered.extension}`;
        response
            .status(200)
            .setHeader('Content-Type', rendered.contentType)
            .setHeader('Content-Length', rendered.bytes.length)
            .setHeader('Content-Disposition', `inline; filename="${fileName}"`)
            .setHeader('X-Report-Template-Id', rendered.templateId)
            .setHeader('X-Report-Template-Version', String(rendered.templateVersion))
            .setHeader('X-Report-Template-Source', rendered.templateSource)
            .setHeader('X-Report-Page-Count', String(rendered.pageCount))
            .setHeader('X-Report-Render-Ms', String(rendered.durationMs))
            .send(rendered.bytes);
    }
    async preview(dto, response) {
        const companyId = this.requireCompanyId();
        const rendered = await this.renderService.preview(dto.definition, {
            outputMode: dto.mode,
            companyId,
            branchId: dto.branchId ?? null,
            accYear: dto.accYear ?? currentAccYear(),
            userId: this.requestContext.getUserId(),
            docId: dto.docId,
            useSampleData: dto.useSampleData,
            printerProfileCode: dto.printerProfile,
            params: dto.params,
        });
        response
            .status(200)
            .setHeader('Content-Type', rendered.contentType)
            .setHeader('Content-Length', rendered.bytes.length)
            .setHeader('Content-Disposition', `inline; filename="preview.${rendered.extension}"`)
            .setHeader('X-Report-Page-Count', String(rendered.pageCount))
            .setHeader('X-Report-Render-Ms', String(rendered.durationMs))
            .send(rendered.bytes);
    }
    async bulkPrint(dto) {
        const companyId = this.requireCompanyId();
        const docIds = [...new Set(dto.docIds.map((docId) => docId.trim()).filter(Boolean))];
        if (docIds.length === 0) {
            throw new common_1.BadRequestException('docIds must contain at least one document id');
        }
        if (docIds.length > print_constants_1.MAX_BULK_DOCUMENTS) {
            throw new common_1.BadRequestException(`A bulk print job is capped at ${print_constants_1.MAX_BULK_DOCUMENTS} documents; ${docIds.length} were requested. Split the batch.`);
        }
        const jobData = {
            docType: dto.docType.toUpperCase(),
            docIds,
            outputMode: (dto.mode ?? 'PDF'),
            paperCode: dto.paper ?? 'A4',
            companyId,
            branchId: dto.branchId ?? null,
            accYear: dto.accYear,
            userId: this.requestContext.getUserId(),
            templateId: dto.templateId,
            printerProfileCode: dto.printerProfile,
            params: dto.params,
        };
        const job = await this.bulkQueue.add('bulk-print', jobData, {
            removeOnComplete: { age: 24 * 60 * 60, count: 100 },
            removeOnFail: { age: 7 * 24 * 60 * 60 },
            attempts: 1,
        });
        return {
            success: true,
            message: 'Bulk print job queued successfully',
            data: { jobId: String(job.id), queued: docIds.length },
        };
    }
    async jobStatus(jobId) {
        const job = await this.bulkQueue.getJob(jobId);
        if (!job) {
            throw new common_1.NotFoundException(`Bulk print job ${jobId} not found. Completed jobs are retained for 24 hours.`);
        }
        const state = await job.getState();
        const progress = typeof job.progress === 'number' ? job.progress : 0;
        return {
            success: true,
            message: 'Bulk print job status fetched successfully',
            data: {
                jobId: String(job.id),
                state,
                progress,
                result: job.returnvalue ?? null,
                failedReason: job.failedReason ?? null,
            },
        };
    }
    requireCompanyId() {
        const companyId = this.requestContext.getCompanyId();
        if (!companyId) {
            throw new common_1.BadRequestException('No company in the request context. Printing requires an authenticated company session.');
        }
        return companyId;
    }
};
exports.PrintController = PrintController;
__decorate([
    (0, common_1.Get)(':docType/:docId/print'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Render one document. Returns application/pdf for PDF mode, or raw ' +
            'printer bytes (application/octet-stream) for the thermal and dot-matrix modes.',
    }),
    (0, swagger_1.ApiProduces)('application/pdf', 'application/octet-stream'),
    (0, swagger_1.ApiOkResponse)({ description: 'The rendered document.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Header)('Cache-Control', 'no-store, private'),
    __param(0, (0, common_1.Param)('docType')),
    __param(1, (0, common_1.Param)('docId')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, print_request_dto_1.PrintQueryDto, Object]),
    __metadata("design:returntype", Promise)
], PrintController.prototype, "print", null);
__decorate([
    (0, common_1.Post)('preview'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Render an UNSAVED definition, by default against provider sample data. ' +
            'This is the designer preview, and it is authoritative: the canvas is an ' +
            'approximation, this is the real engine.',
    }),
    (0, swagger_1.ApiProduces)('application/pdf', 'application/octet-stream'),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Header)('Cache-Control', 'no-store, private'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [print_request_dto_1.PreviewDto, Object]),
    __metadata("design:returntype", Promise)
], PrintController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('bulk-print'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Queue a batch render. Returns a job id immediately — rendering a hundred ' +
            'documents inline would block the event loop and stall the whole API.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [print_request_dto_1.BulkPrintDto]),
    __metadata("design:returntype", Promise)
], PrintController.prototype, "bulkPrint", null);
__decorate([
    (0, common_1.Get)('jobs/:jobId'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk print job status and, once finished, its per-document results.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PrintController.prototype, "jobStatus", null);
exports.PrintController = PrintController = __decorate([
    (0, swagger_1.ApiTags)('Report Printing'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('reports'),
    __param(2, (0, bullmq_1.InjectQueue)(print_constants_1.REPORT_QUEUE_NAMES.BULK_PRINT)),
    __metadata("design:paramtypes", [report_render_service_1.ReportRenderService,
        request_context_service_1.RequestContextService,
        bullmq_2.Queue])
], PrintController);
const currentAccYear = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const startYear = now.getUTCMonth() >= 3 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
};
//# sourceMappingURL=print.controller.js.map