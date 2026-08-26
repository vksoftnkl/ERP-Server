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
exports.ReportDatasetsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../../common/dto/http-error-response.dto");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const dataset_admin_guard_1 = require("./guards/dataset-admin.guard");
const report_datasets_service_1 = require("./report-datasets.service");
const report_dataset_request_dto_1 = require("./dto/report-dataset-request.dto");
class ListReportDatasetsQueryDto {
    includeInactive;
}
__decorate([
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListReportDatasetsQueryDto.prototype, "includeInactive", void 0);
let ReportDatasetsController = class ReportDatasetsController {
    datasets;
    constructor(datasets) {
        this.datasets = datasets;
    }
    async list(query) {
        const data = await this.datasets.findAll(query.includeInactive === true);
        return {
            success: true,
            message: 'Report datasets fetched successfully',
            data,
            meta: { count: data.length },
        };
    }
    async probe(dto) {
        return {
            success: true,
            message: 'Report dataset query validated successfully',
            data: await this.datasets.probe(dto),
        };
    }
    async findOne(id) {
        return {
            success: true,
            message: 'Report dataset fetched successfully',
            data: await this.datasets.findOne(id),
        };
    }
    async usage(id) {
        const dataset = await this.datasets.findOne(id);
        return {
            success: true,
            message: 'Report dataset usage fetched successfully',
            data: await this.datasets.findTemplatesUsing(dataset.rdsToken),
        };
    }
    async create(dto) {
        return {
            success: true,
            message: 'Report dataset created successfully',
            data: await this.datasets.create(dto),
        };
    }
    async update(id, dto) {
        return {
            success: true,
            message: 'Report dataset updated successfully',
            data: await this.datasets.update(id, dto),
        };
    }
    async preview(id, dto) {
        return {
            success: true,
            message: 'Report dataset preview generated successfully',
            data: await this.datasets.preview(id, dto),
        };
    }
    async remove(id, force) {
        return {
            success: true,
            message: 'Report dataset deleted successfully',
            data: await this.datasets.remove(id, force === 'true'),
        };
    }
};
exports.ReportDatasetsController = ReportDatasetsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List runtime report datasets.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListReportDatasetsQueryDto]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('probe'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate a candidate query and introspect its columns, without storing it.',
        description: 'Returns the field list the designer would show. Use it to check a query while ' +
            'authoring — the same validation and introspection a save performs.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dataset_request_dto_1.ProbeReportDatasetDto]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "probe", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One runtime report dataset.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/usage'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Templates that bind this dataset.',
        description: 'What a delete would break. Read this before deactivating a dataset.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "usage", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a runtime report dataset.',
        description: 'The query is validated and executed (WHERE false) before the row is written, so a ' +
            'dataset that cannot run is never stored. Field metadata is introspected from that ' +
            'run rather than supplied.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dataset_request_dto_1.CreateReportDatasetDto]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Update a runtime report dataset.',
        description: 'The token is immutable — templates bind it by value, so a rename would break every ' +
            'design that uses it, silently, at print time.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, report_dataset_request_dto_1.UpdateReportDatasetDto]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/preview'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Run a stored dataset against the caller\'s own company, capped.',
        description: 'The author\'s smoke test: real rows, real scoping, at most 100 of them. The company ' +
            'comes from the request context and is never a parameter.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Rows the dataset returns for the given context.' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, report_dataset_request_dto_1.PreviewReportDatasetDto]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "preview", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a runtime report dataset.',
        description: 'Refused while a template still binds the token, because that template would then ' +
            'fail at print time rather than at save time. Pass force=true to override.',
    }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('force')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ReportDatasetsController.prototype, "remove", null);
exports.ReportDatasetsController = ReportDatasetsController = __decorate([
    (0, swagger_1.ApiTags)('Report Datasets (admin)'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        description: 'Caller is not a vendor administrator.',
        type: http_error_response_dto_1.HttpErrorResponseDto,
    }),
    (0, common_1.UseGuards)(dataset_admin_guard_1.DatasetAdminGuard),
    (0, common_1.Controller)('reports/datasets'),
    __metadata("design:paramtypes", [report_datasets_service_1.ReportDatasetsService])
], ReportDatasetsController);
//# sourceMappingURL=report-datasets.controller.js.map