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
exports.EmployeeDesignationMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const employee_designation_master_exception_filter_1 = require("./employee-designation-master-exception.filter");
const employee_designation_master_response_dto_1 = require("./dto/employee-designation-master-response.dto");
const save_employee_designation_master_dto_1 = require("./dto/save-employee-designation-master.dto");
const employee_designation_master_service_1 = require("./employee-designation-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let EmployeeDesignationMasterController = class EmployeeDesignationMasterController {
    employeeDesignationMasterService;
    constructor(employeeDesignationMasterService) {
        this.employeeDesignationMasterService = employeeDesignationMasterService;
    }
    async save(saveEmployeeDesignationMasterDto) {
        const data = await this.employeeDesignationMasterService.save(saveEmployeeDesignationMasterDto);
        return {
            success: true,
            message: saveEmployeeDesignationMasterDto.edId
                ? 'Employee designation updated successfully'
                : 'Employee designation created successfully',
            data,
        };
    }
    async getById(edId) {
        const data = await this.employeeDesignationMasterService.getById(edId);
        return {
            success: true,
            message: 'Employee designation fetched successfully',
            data,
        };
    }
    async remove(edId) {
        const data = await this.employeeDesignationMasterService.softDelete(edId);
        return {
            success: true,
            message: 'Employee designation deleted successfully',
            data,
        };
    }
};
exports.EmployeeDesignationMasterController = EmployeeDesignationMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update employee designation (by edId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_employee_designation_master_dto_1.SaveEmployeeDesignationMasterDto]),
    __metadata("design:returntype", Promise)
], EmployeeDesignationMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get employee designation by id' }),
    (0, swagger_1.ApiQuery)({ name: 'edId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('edId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeDesignationMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete employee designation by id' }),
    (0, swagger_1.ApiQuery)({ name: 'edId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_designation_master_response_dto_1.EmployeeDesignationMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('edId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeDesignationMasterController.prototype, "remove", null);
exports.EmployeeDesignationMasterController = EmployeeDesignationMasterController = __decorate([
    (0, swagger_1.ApiTags)('Employee Designation Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('employee-designation-masters'),
    (0, common_1.UseFilters)(employee_designation_master_exception_filter_1.EmployeeDesignationMasterExceptionFilter),
    __metadata("design:paramtypes", [employee_designation_master_service_1.EmployeeDesignationMasterService])
], EmployeeDesignationMasterController);
//# sourceMappingURL=employee-designation-master.controller.js.map