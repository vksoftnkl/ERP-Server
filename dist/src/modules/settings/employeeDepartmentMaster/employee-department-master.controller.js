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
exports.EmployeeDepartmentMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const employee_department_master_response_dto_1 = require("./dto/employee-department-master-response.dto");
const save_employee_department_master_dto_1 = require("./dto/save-employee-department-master.dto");
const employee_department_master_exception_filter_1 = require("./employee-department-master-exception.filter");
const employee_department_master_service_1 = require("./employee-department-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let EmployeeDepartmentMasterController = class EmployeeDepartmentMasterController {
    employeeDepartmentMasterService;
    constructor(employeeDepartmentMasterService) {
        this.employeeDepartmentMasterService = employeeDepartmentMasterService;
    }
    async save(saveEmployeeDepartmentMasterDto) {
        const data = await this.employeeDepartmentMasterService.save(saveEmployeeDepartmentMasterDto);
        return {
            success: true,
            message: saveEmployeeDepartmentMasterDto.edptId
                ? 'Employee department updated successfully'
                : 'Employee department created successfully',
            data,
        };
    }
    async getById(edptId) {
        const data = await this.employeeDepartmentMasterService.getById(edptId);
        return {
            success: true,
            message: 'Employee department fetched successfully',
            data,
        };
    }
    async remove(edptId) {
        const data = await this.employeeDepartmentMasterService.softDelete(edptId);
        return {
            success: true,
            message: 'Employee department deleted successfully',
            data,
        };
    }
};
exports.EmployeeDepartmentMasterController = EmployeeDepartmentMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update employee department (by edptId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_employee_department_master_dto_1.SaveEmployeeDepartmentMasterDto]),
    __metadata("design:returntype", Promise)
], EmployeeDepartmentMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get employee department by id' }),
    (0, swagger_1.ApiQuery)({ name: 'edptId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('edptId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeDepartmentMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete employee department by id' }),
    (0, swagger_1.ApiQuery)({ name: 'edptId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_department_master_response_dto_1.EmployeeDepartmentMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('edptId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeDepartmentMasterController.prototype, "remove", null);
exports.EmployeeDepartmentMasterController = EmployeeDepartmentMasterController = __decorate([
    (0, swagger_1.ApiTags)('Employee Department Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('employee-department-masters'),
    (0, common_1.UseFilters)(employee_department_master_exception_filter_1.EmployeeDepartmentMasterExceptionFilter),
    __metadata("design:paramtypes", [employee_department_master_service_1.EmployeeDepartmentMasterService])
], EmployeeDepartmentMasterController);
//# sourceMappingURL=employee-department-master.controller.js.map