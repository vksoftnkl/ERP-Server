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
exports.PrintTemplateAssignmentController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const print_template_assignment_exception_filter_1 = require("./print-template-assignment-exception.filter");
const print_template_assignment_service_1 = require("./print-template-assignment.service");
const save_print_template_assignment_dto_1 = require("./dto/save-print-template-assignment.dto");
const list_print_template_assignment_query_dto_1 = require("./dto/list-print-template-assignment-query.dto");
const resolve_print_template_assignment_query_dto_1 = require("./dto/resolve-print-template-assignment-query.dto");
const print_template_assignment_response_dto_1 = require("./dto/print-template-assignment-response.dto");
let PrintTemplateAssignmentController = class PrintTemplateAssignmentController {
    printTemplateAssignmentService;
    requestContextService;
    constructor(printTemplateAssignmentService, requestContextService) {
        this.printTemplateAssignmentService = printTemplateAssignmentService;
        this.requestContextService = requestContextService;
    }
    async create(dto) {
        if (dto.ptaId) {
            const data = await this.printTemplateAssignmentService.save(dto);
            return { success: true, message: 'Print template assignment updated successfully', data };
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const data = await this.printTemplateAssignmentService.createAssignment(dto, userId);
        return { success: true, message: 'Print template assignment created successfully', data };
    }
    async list(queryDto) {
        const data = await this.printTemplateAssignmentService.list(queryDto);
        return { success: true, message: 'Print template assignments fetched successfully', data };
    }
    async resolve(queryDto) {
        const companyId = queryDto.companyId ?? this.requestContextService.getCompanyId();
        if (!companyId) {
            (0, module_service_utils_1.throwSettingsBadRequest)('No company to resolve against', [
                {
                    field: 'companyId',
                    message: 'An assignment is resolved within one company. None was sent and the session carries ' +
                        'none — re-authenticate against a company, or name one.',
                },
            ]);
        }
        const data = await this.printTemplateAssignmentService.resolve({
            ...queryDto,
            companyId,
            branchId: queryDto.branchId ?? this.requestContextService.getBranchId(),
            deviceId: queryDto.deviceId ?? this.requestContextService.getDeviceId(),
        });
        return { success: true, message: 'Print template resolved successfully', data };
    }
    async getById(ptaId) {
        const data = await this.printTemplateAssignmentService.getById(ptaId);
        return { success: true, message: 'Print template assignment fetched successfully', data };
    }
    async remove(ptaId) {
        const data = await this.printTemplateAssignmentService.softDelete(ptaId);
        return { success: true, message: 'Print template assignment deleted successfully', data };
    }
};
exports.PrintTemplateAssignmentController = PrintTemplateAssignmentController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a print template assignment (by ptaId presence)',
        description: 'One row IS one choice: there is no is_default flag, so changing the design for a scope is an update of this one row. Scope is a ladder — counter, branch, company, every company — and ptaCompanyId must be PRESENT on create: send null deliberately for the every-company rung, which only a shipped design may occupy.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentSuccessCreateDto }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_print_template_assignment_dto_1.SavePrintTemplateAssignmentDto]),
    __metadata("design:returntype", Promise)
], PrintTemplateAssignmentController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List print template assignments, narrowest scope first',
        description: 'Pair ptaCompanyId with includeGlobal to see what a company inherits where it has said nothing, or globalOnly for the every-company rows alone.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_print_template_assignment_query_dto_1.ListPrintTemplateAssignmentQueryDto]),
    __metadata("design:returntype", Promise)
], PrintTemplateAssignmentController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('resolve'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Resolve which design wins for a counter',
        description: 'Narrowest wins: counter, then branch, then company, then the every-company default. Returns the template, its published revision, the printer and the copy count — the assignment overrides the purpose, NULL means use it. printerSource says whether the printer is a registered profile (paper and codepage known and assertable), a bare queue name (neither known), or the counter default.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentSuccessResolveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_print_template_assignment_query_dto_1.ResolvePrintTemplateAssignmentQueryDto]),
    __metadata("design:returntype", Promise)
], PrintTemplateAssignmentController.prototype, "resolve", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get a print template assignment by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ptaId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    __param(0, (0, common_1.Query)('ptaId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PrintTemplateAssignmentController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a print template assignment by id',
        description: 'Removing the row removes the choice for that scope; the resolver then falls back to the next rung up — branch, company, and finally the every-company default.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'ptaId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_template_assignment_response_dto_1.PrintTemplateAssignmentErrorResponseDto }),
    __param(0, (0, common_1.Query)('ptaId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PrintTemplateAssignmentController.prototype, "remove", null);
exports.PrintTemplateAssignmentController = PrintTemplateAssignmentController = __decorate([
    (0, swagger_1.ApiTags)('Print Template Assignments'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('print-template-assignments'),
    (0, common_1.UseFilters)(print_template_assignment_exception_filter_1.PrintTemplateAssignmentExceptionFilter),
    __metadata("design:paramtypes", [print_template_assignment_service_1.PrintTemplateAssignmentService,
        request_context_service_1.RequestContextService])
], PrintTemplateAssignmentController);
//# sourceMappingURL=print-template-assignment.controller.js.map