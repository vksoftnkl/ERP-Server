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
exports.PrintRenderController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const print_data_provider_registry_1 = require("./data/print-data-provider.registry");
const render_document_dto_1 = require("./dto/render-document.dto");
const render_preview_dto_1 = require("./dto/render-preview.dto");
const print_render_response_dto_1 = require("./dto/print-render-response.dto");
const print_render_service_1 = require("./print-render.service");
const print_render_exception_filter_1 = require("./print-render-exception.filter");
let PrintRenderController = class PrintRenderController {
    printRenderService;
    providers;
    requestContextService;
    constructor(printRenderService, providers, requestContextService) {
        this.printRenderService = printRenderService;
        this.providers = providers;
        this.requestContextService = requestContextService;
    }
    async preview(dto, response) {
        const outcome = await this.printRenderService.preview({
            versionId: dto.versionId,
            context: this.contextFrom(dto),
            params: dto.params ?? {},
            ...(dto.outputMode ? { outputMode: dto.outputMode } : {}),
            ...(dto.copies ? { copies: dto.copies } : {}),
            ...(dto.body ? { body: dto.body } : {}),
        });
        if (dto.inspect) {
            return {
                success: true,
                message: 'Preview rendered successfully',
                data: this.inspect(outcome),
            };
        }
        this.send(response, outcome, dto.filename ?? `preview-rev-${outcome.revNo}`);
    }
    async print(dto, response) {
        const outcome = await this.printRenderService.print({
            purposeId: dto.purposeId,
            context: this.contextFrom(dto),
            params: dto.params ?? {},
            ...(dto.srcModule ? { srcModule: dto.srcModule } : {}),
            ...(dto.srcDocType ? { srcDocType: dto.srcDocType } : {}),
            ...(dto.assignmentOutputMode ? { assignmentOutputMode: dto.assignmentOutputMode } : {}),
            ...(dto.outputMode ? { outputMode: dto.outputMode } : {}),
            ...(dto.copies ? { copies: dto.copies } : {}),
            ...(dto.isReprint ? { isReprint: dto.isReprint } : {}),
        });
        response.setHeader('X-Print-Log-Ids', outcome.printLogIds.join(','));
        response.setHeader('X-Print-Scope', outcome.assignment.scope);
        if (dto.inspect) {
            return {
                success: true,
                message: 'Document printed successfully',
                data: { ...this.inspect(outcome), printLogIds: outcome.printLogIds },
            };
        }
        this.send(response, outcome, dto.filename ?? `${dto.srcDocType ?? 'document'}-${dto.docId}`);
    }
    providerList() {
        return {
            success: true,
            message: 'Print data providers retrieved successfully',
            data: this.providers.describe(),
        };
    }
    contextFrom(dto) {
        const companyId = this.requestContextService.getCompanyId();
        if (!companyId) {
            (0, module_service_utils_1.throwSettingsBadRequest)('No company in the request context', [
                {
                    field: 'companyId',
                    message: 'Every dataset is company-scoped and the company comes from the authenticated ' +
                        'session, never from the request. Re-authenticate against a company.',
                },
            ]);
        }
        return {
            companyId,
            branchId: dto.branchId ?? this.requestContextService.getBranchId(),
            accYear: dto.accYear ?? null,
            docId: dto.docId ?? null,
            userId: this.requestContextService.getUserId(),
            deviceId: dto.deviceId ?? this.requestContextService.getDeviceId(),
        };
    }
    send(response, outcome, stem) {
        const safeStem = stem.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'print';
        response.setHeader('Content-Type', outcome.contentType);
        response.setHeader('Content-Length', String(outcome.bytes.length));
        response.setHeader('Content-Disposition', `${outcome.outputMode === 'PDF' ? 'inline' : 'attachment'}; filename="${safeStem}.${outcome.extension}"`);
        response.setHeader('X-Print-Template-Id', outcome.templateId);
        response.setHeader('X-Print-Version-Id', outcome.versionId);
        response.setHeader('X-Print-Rev-No', String(outcome.revNo));
        response.setHeader('X-Print-Output-Mode', outcome.outputMode);
        response.setHeader('X-Print-Pages', String(outcome.pageCount));
        response.setHeader('X-Print-Copies', String(outcome.copies));
        response.setHeader('X-Print-Warnings', String(outcome.warnings.length));
        response.setHeader('Cache-Control', 'no-store');
        response.end(outcome.bytes);
    }
    inspect(outcome) {
        const { bytes, datasets, ...rest } = outcome;
        return {
            ...rest,
            datasets: datasets.map((dataset) => ({
                name: dataset.name,
                datasetNo: dataset.datasetNo,
                role: dataset.role,
                sourceKind: dataset.sourceKind,
                rowCount: dataset.rowCount,
                durationMs: dataset.durationMs,
                truncated: dataset.truncated,
            })),
            byteCount: bytes.length,
        };
    }
};
exports.PrintRenderController = PrintRenderController;
__decorate([
    (0, common_1.Post)('preview'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Render one revision — the designer’s Preview',
        description: 'Returns the rendered bytes (application/pdf, or application/octet-stream for a text ' +
            'engine), or JSON when inspect=true. The paper and the datasets always come from the ' +
            'revision; an unsaved `body` may stand in for the stored bands, but only against a DRAFT.',
    }),
    (0, swagger_1.ApiProduces)('application/pdf', 'application/octet-stream', 'application/json'),
    (0, swagger_1.ApiOkResponse)({ type: print_render_response_dto_1.PrintRenderInspectSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_render_response_dto_1.PrintRenderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_render_response_dto_1.PrintRenderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [render_preview_dto_1.RenderPreviewDto, Object]),
    __metadata("design:returntype", Promise)
], PrintRenderController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('print'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Print a document through the assignment ladder',
        description: 'Resolves which design wins for this counter (counter → branch → company → every ' +
            'company), renders every copy the purpose calls for, and appends one print_log row per ' +
            'copy. There is deliberately no templateId: which design wins is a row in ' +
            'print_template_assignment, and a second place to decide it would drift from the first.',
    }),
    (0, swagger_1.ApiProduces)('application/pdf', 'application/octet-stream', 'application/json'),
    (0, swagger_1.ApiOkResponse)({ type: print_render_response_dto_1.PrintRenderInspectSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_render_response_dto_1.PrintRenderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_render_response_dto_1.PrintRenderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [render_document_dto_1.RenderDocumentDto, Object]),
    __metadata("design:returntype", Promise)
], PrintRenderController.prototype, "print", null);
__decorate([
    (0, common_1.Get)('providers'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The dataset providers this build carries',
        description: 'What a ptdProviderCode may name. A provider is CODE, so a template naming one this ' +
            'build does not have cannot be fixed by editing data — this is the list to check against.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: print_render_response_dto_1.PrintRenderProvidersSuccessDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], PrintRenderController.prototype, "providerList", null);
exports.PrintRenderController = PrintRenderController = __decorate([
    (0, swagger_1.ApiTags)('Print Render'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('print-render'),
    (0, common_1.UseFilters)(print_render_exception_filter_1.PrintRenderExceptionFilter),
    __metadata("design:paramtypes", [print_render_service_1.PrintRenderService,
        print_data_provider_registry_1.PrintDataProviderRegistry,
        request_context_service_1.RequestContextService])
], PrintRenderController);
//# sourceMappingURL=print-render.controller.js.map