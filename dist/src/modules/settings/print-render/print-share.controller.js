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
var PrintShareController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintShareController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const create_print_share_dto_1 = require("./dto/create-print-share.dto");
const print_render_response_dto_1 = require("./dto/print-render-response.dto");
const print_render_exception_filter_1 = require("./print-render-exception.filter");
const print_share_service_1 = require("./print-share.service");
const print_render_error_codes_1 = require("./types/print-render-error-codes");
function messagePage(title, message) {
    const escape = (text) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
    return ('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        `<title>${escape(title)}</title>` +
        '<style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
        'background:#f5f5f5;color:#222;display:flex;min-height:100vh;align-items:center;justify-content:center}' +
        'main{background:#fff;border-radius:10px;padding:28px 24px;max-width:420px;margin:16px;' +
        'box-shadow:0 2px 12px rgba(0,0,0,.08)}h1{font-size:19px;margin:0 0 10px}p{margin:0;line-height:1.5}</style>' +
        `</head><body><main><h1>${escape(title)}</h1><p>${escape(message)}</p></main></body></html>`);
}
let PrintShareController = PrintShareController_1 = class PrintShareController {
    printShareService;
    requestContextService;
    logger = new common_1.Logger(PrintShareController_1.name);
    constructor(printShareService, requestContextService) {
        this.printShareService = printShareService;
        this.requestContextService = requestContextService;
    }
    async create(dto) {
        const companyId = dto.companyId ?? this.requestContextService.getCompanyId();
        if (!companyId) {
            (0, module_service_utils_1.throwSettingsBadRequest)('No company in the request context', [
                {
                    field: 'companyId',
                    code: print_render_error_codes_1.PrintRenderErrorCode.NO_COMPANY,
                    message: 'A shared document is rendered in one company’s scope; name it or re-authenticate.',
                },
            ]);
        }
        const data = await this.printShareService.create({
            versionId: dto.versionId,
            docId: dto.docId,
            companyId,
            branchId: dto.branchId ?? this.requestContextService.getBranchId(),
            accYear: dto.accYear ?? null,
            deviceId: dto.deviceId ?? this.requestContextService.getDeviceId(),
            userId: this.requestContextService.getUserId(),
            filename: dto.filename ?? null,
        });
        return { success: true, message: 'Share link created', data };
    }
    async open(token, response) {
        await this.serve(token, response);
    }
    async openNamed(token, response) {
        await this.serve(token, response);
    }
    async serve(token, response) {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Robots-Tag', 'noindex, nofollow');
        try {
            const opened = await this.printShareService.open(token);
            if (opened.status === 'MISSING') {
                this.html(response, 404, 'Link not found', 'This link is not valid. Please ask the sender for a new one.');
                return;
            }
            if (opened.status === 'EXPIRED') {
                this.html(response, 410, 'Link expired', 'This link has expired. Please ask the sender for a new one.');
                return;
            }
            const { outcome, filename } = opened;
            response.status(200);
            response.setHeader('Content-Type', outcome.contentType);
            response.setHeader('Content-Length', String(outcome.bytes.length));
            response.setHeader('Content-Disposition', `inline; filename="${filename}.${outcome.extension}"`);
            response.end(outcome.bytes);
        }
        catch (error) {
            this.logger.error(`Shared document could not be rendered: ${error instanceof Error ? error.message : String(error)}`);
            this.html(response, 503, 'Document unavailable', 'This document cannot be opened right now. Please try again later, or ask the sender.');
        }
    }
    html(response, status, title, message) {
        response.status(status);
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(messagePage(title, message));
    }
};
exports.PrintShareController = PrintShareController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.UseFilters)(print_render_exception_filter_1.PrintRenderExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a public link to a rendered document',
        description: 'Freezes the render context (revision, document, company, branch, year, counter, user) ' +
            'under a random token and returns the path it opens at. The link renders a PDF on every ' +
            'open until it expires (PRINT_SHARE_TTL_DAYS, default 30). `url` is filled when the ' +
            'server knows its public address (PRINT_SHARE_PUBLIC_BASE_URL); otherwise the client ' +
            'puts `path` under its own API base.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ token, path, url, expiresAt }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_render_response_dto_1.PrintRenderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_render_response_dto_1.PrintRenderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_print_share_dto_1.CreatePrintShareDto]),
    __metadata("design:returntype", Promise)
], PrintShareController.prototype, "create", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':token'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Open a shared document (public)' }),
    (0, swagger_1.ApiParam)({ name: 'token' }),
    (0, swagger_1.ApiProduces)('application/pdf', 'text/html'),
    (0, swagger_1.ApiOkResponse)({ description: 'The PDF, or a page saying why there is none' }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PrintShareController.prototype, "open", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':token/:filename'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Open a shared document (public), with a cosmetic file name' }),
    (0, swagger_1.ApiParam)({ name: 'token' }),
    (0, swagger_1.ApiParam)({ name: 'filename' }),
    (0, swagger_1.ApiProduces)('application/pdf', 'text/html'),
    (0, swagger_1.ApiOkResponse)({ description: 'The PDF, or a page saying why there is none' }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PrintShareController.prototype, "openNamed", null);
exports.PrintShareController = PrintShareController = PrintShareController_1 = __decorate([
    (0, swagger_1.ApiTags)('Print Share'),
    (0, common_1.Controller)('print-share'),
    __metadata("design:paramtypes", [print_share_service_1.PrintShareService,
        request_context_service_1.RequestContextService])
], PrintShareController);
//# sourceMappingURL=print-share.controller.js.map