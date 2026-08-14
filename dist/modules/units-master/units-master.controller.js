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
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const list_unit_query_dto_1 = require("./dto/list-unit-query.dto");
const save_unit_dto_1 = require("./dto/save-unit.dto");
const unit_response_dto_1 = require("./dto/unit-response.dto");
const unit_exception_filter_1 = require("./unit-exception.filter");
const units_master_service_1 = require("./units-master.service");
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
    async list(queryDto) {
        const result = await this.unitsMasterService.list(queryDto);
        return {
            success: true,
            message: 'Units fetched successfully',
            data: result.items,
            meta: result.meta,
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
        const data = await this.unitsMasterService.softDelete(unitId);
        return {
            success: true,
            message: 'Unit deleted successfully',
            data,
        };
    }
};
exports.UnitsMasterController = UnitsMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)('1'),
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
    (0, common_1.Get)('list'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'List units with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: unit_response_dto_1.UnitSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_unit_query_dto_1.ListUnitQueryDto]),
    __metadata("design:returntype", Promise)
], UnitsMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get/:unit_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Get unit by id' }),
    (0, swagger_1.ApiParam)({ name: 'unit_id', type: Number }),
    (0, swagger_1.ApiOkResponse)({ type: unit_response_dto_1.UnitSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    __param(0, (0, common_1.Param)('unit_id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], UnitsMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete/:unit_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete unit by id' }),
    (0, swagger_1.ApiParam)({ name: 'unit_id', type: Number }),
    (0, swagger_1.ApiOkResponse)({ type: unit_response_dto_1.UnitSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: unit_response_dto_1.UnitErrorResponseDto }),
    __param(0, (0, common_1.Param)('unit_id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], UnitsMasterController.prototype, "remove", null);
exports.UnitsMasterController = UnitsMasterController = __decorate([
    (0, swagger_1.ApiTags)('Units'),
    (0, common_1.Controller)('units'),
    (0, common_1.UseFilters)(unit_exception_filter_1.UnitExceptionFilter),
    __metadata("design:paramtypes", [units_master_service_1.UnitsMasterService])
], UnitsMasterController);
//# sourceMappingURL=units-master.controller.js.map