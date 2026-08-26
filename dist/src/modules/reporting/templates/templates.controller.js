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
exports.TemplatesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const report_data_provider_registry_1 = require("../providers/report-data-provider.registry");
const gallery_index_1 = require("./gallery/gallery.index");
const template_definition_schema_1 = require("./dto/template-definition.schema");
const units_1 = require("../engine/units/units");
const jexl_factory_1 = require("../engine/expression/jexl.factory");
const expression_validator_1 = require("../engine/expression/expression.validator");
const template_request_dto_1 = require("./dto/template-request.dto");
const templates_service_1 = require("./templates.service");
let TemplatesController = class TemplatesController {
    templatesService;
    providers;
    constructor(templatesService, providers) {
        this.templatesService = templatesService;
        this.providers = providers;
    }
    async list(query) {
        const result = await this.templatesService.list(query);
        return {
            success: true,
            message: 'Report templates fetched successfully',
            data: result.items,
            meta: {
                count: result.items.length,
                docType: query.ptDocType,
                outputMode: query.ptOutputMode,
                paperCode: query.ptPaperCode,
                companyId: query.ptCompanyId,
                includeSystem: result.includeSystem,
            },
        };
    }
    schema() {
        return {
            success: true,
            message: 'Template schema vocabulary fetched successfully',
            data: {
                schemaVersion: template_definition_schema_1.SCHEMA_VERSION,
                layoutModes: template_definition_schema_1.LAYOUT_MODES,
                outputModes: template_definition_schema_1.OUTPUT_MODES,
                bandTypes: template_definition_schema_1.BAND_TYPES,
                elementKinds: template_definition_schema_1.ELEMENT_KINDS,
                papers: units_1.PAPER_PRESETS,
                transforms: jexl_factory_1.TRANSFORM_NAMES,
                rootIdentifiers: expression_validator_1.BUILTIN_ROOT_IDENTIFIERS,
                gallery: gallery_index_1.GALLERY_TEMPLATES.map((entry) => ({
                    key: entry.key,
                    name: entry.name,
                    docType: entry.docType,
                    outputMode: entry.outputMode,
                    paperCode: entry.paperCode,
                })),
            },
        };
    }
    async findOne(ptId) {
        return {
            success: true,
            message: 'Report template fetched successfully',
            data: await this.templatesService.findOne(ptId),
        };
    }
    async create(dto) {
        return {
            success: true,
            message: 'Report template created successfully',
            data: await this.templatesService.create(dto),
        };
    }
    async update(ptId, dto) {
        return {
            success: true,
            message: 'Report template updated successfully',
            data: await this.templatesService.update(ptId, dto),
        };
    }
    async remove(ptId) {
        return {
            success: true,
            message: 'Report template deleted successfully',
            data: await this.templatesService.softDelete(ptId),
        };
    }
    async clone(ptId, dto) {
        return {
            success: true,
            message: 'Report template cloned successfully',
            data: await this.templatesService.clone(ptId, dto),
        };
    }
    async setDefault(ptId) {
        return {
            success: true,
            message: 'Report template promoted to default successfully',
            data: await this.templatesService.setDefault(ptId),
        };
    }
    async revisions(ptId) {
        const data = await this.templatesService.listRevisions(ptId);
        return {
            success: true,
            message: 'Report template revisions fetched successfully',
            data,
            meta: { count: data.length },
        };
    }
    async rollback(ptId, version) {
        return {
            success: true,
            message: `Report template rolled back to version ${version} successfully`,
            data: await this.templatesService.rollback(ptId, version),
        };
    }
    async export(ptId) {
        return {
            success: true,
            message: 'Report template exported successfully',
            data: await this.templatesService.export(ptId),
        };
    }
    async import(dto) {
        return {
            success: true,
            message: 'Report template imported successfully',
            data: await this.templatesService.import(dto),
        };
    }
    datasets(docType) {
        const data = this.providers.list(docType);
        return {
            success: true,
            message: 'Report dataset providers fetched successfully',
            data,
            meta: { count: data.length },
        };
    }
};
exports.TemplatesController = TemplatesController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List templates for the request context company, plus the shipped system ' +
            'templates. Filterable by document type, output mode and paper.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [template_request_dto_1.GetTemplatesQueryDto]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('schema'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The template definition vocabulary: bands, elements, papers, transforms.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Vocabulary for the designer palette.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], TemplatesController.prototype, "schema", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One template with its definition, migrated to the current schema.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a template. The definition is validated in full — schema, ' +
            'expressions and provider tokens — before anything is stored.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [template_request_dto_1.CreateTemplateDto]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Update a template. Supplying a definition bumps the version and archives ' +
            'the previous body as a revision.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, template_request_dto_1.UpdateTemplateDto]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a template. Refused while it is the default for its scope, ' +
            'or while clones descend from it.',
    }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/clone'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Clone a template into a tenant. This is how a shipped system design is ' +
            'customised — system templates are read-only.',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, template_request_dto_1.CloneTemplateDto]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "clone", null);
__decorate([
    (0, common_1.Put)(':id/set-default'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Make this template the default for its company/branch/docType/mode/paper.',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "setDefault", null);
__decorate([
    (0, common_1.Get)(':id/revisions'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Version history, newest first.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "revisions", null);
__decorate([
    (0, common_1.Post)(':id/rollback/:version'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Roll back to an archived version. The old body is written FORWARD as a ' +
            'new version, so the history stays append-only.',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('version', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "rollback", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Export a template as a portable JSON file.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "export", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Import an exported template. Older exports are migrated forward, then ' +
            'validated exactly as a create would be.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [template_request_dto_1.ImportTemplateDto]),
    __metadata("design:returntype", Promise)
], TemplatesController.prototype, "import", null);
__decorate([
    (0, common_1.Get)('datasets/catalogue'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Registered dataset providers with their field metadata, for the designer field tree.',
    }),
    __param(0, (0, common_1.Query)('docType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], TemplatesController.prototype, "datasets", null);
exports.TemplatesController = TemplatesController = __decorate([
    (0, swagger_1.ApiTags)('Report Templates'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('reports/templates'),
    __metadata("design:paramtypes", [templates_service_1.TemplatesService,
        report_data_provider_registry_1.ReportDataProviderRegistry])
], TemplatesController);
//# sourceMappingURL=templates.controller.js.map