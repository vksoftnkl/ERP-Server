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
exports.UnitsMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const save_unit_dto_1 = require("./dto/save-unit.dto");
const unit_response_dto_1 = require("./dto/unit-response.dto");
const unit_exception_filter_1 = require("./unit-exception.filter");
const units_master_service_1 = require("./units-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let UnitsMasterController = class UnitsMasterController {
    unitsMasterService;
    constructor(unitsMasterService) {
        this.unitsMasterService = unitsMasterService;
    }
    async save(saveUnitDto) {
        const data = await this.unitsMasterService.save(saveUnitDto);
        return {
            success: true,
            message: saveUnitDto.unit_id ? 'Unit updated successfully' : 'Unit created successfully',
            data,
        };
    }
    async getById(unitId) {
        const data = await this.unitsMasterService.getById(unitId);
        return {
            success: true,
            message: 'Unit fetched successfully',
            data,
        };
    }
    async remove(unitId) {
        const { unit_id, deleted } = await this.unitsMasterService.toggleDelete(unitId);
        return {
            success: true,
            message: deleted ? 'Unit deleted successfully' : 'Unit restored successfully',
            data: { unit_id, deleted },
        };
    }
};
exports.UnitsMasterController = UnitsMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update unit (by unit_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: unit_response_dto_1.UnitSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_unit_dto_1.SaveUnitDto]),
    __metadata("design:returntype", Promise)
], UnitsMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get unit by id' }),
    (0, swagger_1.ApiQuery)({ name: 'unit_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: unit_response_dto_1.UnitSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    __param(0, (0, common_1.Query)('unit_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UnitsMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore unit by id' }),
    (0, swagger_1.ApiQuery)({ name: 'unit_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: unit_response_dto_1.UnitSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    __param(0, (0, common_1.Query)('unit_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UnitsMasterController.prototype, "remove", null);
exports.UnitsMasterController = UnitsMasterController = __decorate([
    (0, swagger_1.ApiTags)('Units'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('units'),
    (0, common_1.UseFilters)(unit_exception_filter_1.UnitExceptionFilter),
    __metadata("design:paramtypes", [units_master_service_1.UnitsMasterService])
], UnitsMasterController);
//# sourceMappingURL=units-master.controller.js.map