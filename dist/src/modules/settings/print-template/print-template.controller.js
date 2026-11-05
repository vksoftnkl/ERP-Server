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
exports.PrintTemplateController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const list_print_template_query_dto_1 = require("./dto/list-print-template-query.dto");
const print_template_id_query_dto_1 = require("./dto/print-template-id-query.dto");
const print_template_response_dto_1 = require("./dto/print-template-response.dto");
const save_print_template_dto_1 = require("./dto/save-print-template.dto");
const print_template_exception_filter_1 = require("./print-template-exception.filter");
const print_template_service_1 = require("./print-template.service");
let PrintTemplateController = class PrintTemplateController {
    printTemplateService;
    constructor(printTemplateService) {
        this.printTemplateService = printTemplateService;
    }
    async saveTemplate(dto) {
        const data = await this.printTemplateService.saveTemplate(dto);
        return {
            success: true,
            message: dto.ptlId
                ? 'Print template updated successfully'
                : 'Print template created successfully',
            data,
        };
    }
    async getTemplate(query) {
        const data = await this.printTemplateService.getTemplateById(query.ptlId, query.includeDeletedVersions ?? false);
        return { success: true, message: 'Print template fetched successfully', data };
    }
    async listTemplates(query) {
        const result = await this.printTemplateService.listTemplates(query);
        return {
            success: true,
            message: 'Print templates fetched successfully',
            data: result.items,
            meta: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                total_pages: result.total_pages,
            },
        };
    }
    async deleteTemplate(query) {
        const data = await this.printTemplateService.softDeleteTemplate(query.ptlId, query.ptlModifiedBy);
        return { success: true, message: 'Print template deleted successfully', data };
    }
};
exports.PrintTemplateController = PrintTemplateController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a whole print template — header, revisions and datasets — in one call',
        description: 'Object payload. Omit ptlId to create, send it to update; on update only the keys present ' +
            'in the body are written.\n\n' +
            "**The two arrays do not behave the same way, and the difference is the schema's.**\n\n" +
            '`versions` — omitted leaves the history alone; present inserts and updates the rows in ' +
            'it. A revision MISSING from the array is NOT deleted, because the version history is ' +
            'append-only (ux_ptv_template_rev is not partial on is_deleted). Removing one is an ' +
            'explicit `"ptvIsDeleted": true`, and is refused for a PUBLISHED revision or the one the ' +
            'template currently points at.\n\n' +
            '`datasets` — nested inside each version, because a dataset hangs off the VERSION: if it ' +
            'hung off the template, editing a query would silently change what every past version ' +
            "rendered. An array that is present REPLACES that version's set — rows with ptdId are " +
            'updated, rows without one are inserted, rows missing from it are soft deleted. Omit the ' +
            'key to leave them alone; `"datasets": []` means "delete every one", which is not the ' +
            'same thing.\n\n' +
            '**A published version is never UPDATEd.** print_log points at the exact bytes that were ' +
            'rendered. Send a version row with no ptvId to write the next revision instead; the only ' +
            'move still open to a live revision is RETIRED. A revision being published BY this ' +
            'request is not yet frozen, so composing a design and publishing it in one call works.\n\n' +
            "**Publishing** is setting a version's ptvStatus to PUBLISHED: it needs an approver, the " +
            "server stamps ptvApprovedOn, and the template's published pointer moves to that " +
            'revision. One per request — the template has one pointer.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: print_template_response_dto_1.PrintTemplateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_print_template_dto_1.SavePrintTemplateDto]),
    __metadata("design:returntype", Promise)
], PrintTemplateController.prototype, "saveTemplate", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Get one print template with every revision and each revision's datasets",
        description: 'Returns the same shape POST /create accepts, ready to edit and post back. Revisions come ' +
            'newest first, and each carries ptvIsPublishedRev and ptvIsEditable so a designer knows ' +
            'what may still be changed before they try.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_response_dto_1.PrintTemplateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [print_template_id_query_dto_1.PrintTemplateIdQueryDto]),
    __metadata("design:returntype", Promise)
], PrintTemplateController.prototype, "getTemplate", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List print templates, paginated',
        description: 'Every filter is an optional narrowing; a bare /list is every live template there is.\n\n' +
            'ptlCompanyId is NOT a plain column match: a shipped design (ptl_company_id NULL) is ' +
            'visible to every company, so narrowing to a company returns its own templates AND the ' +
            'shipped ones it can use. Pass onlyOwned=true for the other reading.\n\n' +
            '`engine` and `isPublished` ask about the PUBLISHED revision, which is why a template ' +
            'holding only a draft matches neither. Set includeVersions=false for a light pick list.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_response_dto_1.PrintTemplateSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_print_template_query_dto_1.ListPrintTemplateQueryDto]),
    __metadata("design:returntype", Promise)
], PrintTemplateController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a print template with every revision and dataset',
        description: 'Soft, not hard: print_log still points at those revisions, and "what did this bill look ' +
            'like" has to keep answering after the design is withdrawn.\n\n' +
            'Refused while a print template assignment still points at the template — a counter would ' +
            'otherwise resolve to a design that is gone.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: print_template_response_dto_1.PrintTemplateSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: print_template_response_dto_1.PrintTemplateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [print_template_id_query_dto_1.DeletePrintTemplateQueryDto]),
    __metadata("design:returntype", Promise)
], PrintTemplateController.prototype, "deleteTemplate", null);
exports.PrintTemplateController = PrintTemplateController = __decorate([
    (0, swagger_1.ApiTags)('Print Template'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('print-templates'),
    (0, common_1.UseFilters)(print_template_exception_filter_1.PrintTemplateExceptionFilter),
    __metadata("design:paramtypes", [print_template_service_1.PrintTemplateService])
], PrintTemplateController);
//# sourceMappingURL=print-template.controller.js.map