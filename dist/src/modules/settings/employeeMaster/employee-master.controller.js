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
exports.EmployeeMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const employee_master_response_dto_1 = require("./dto/employee-master-response.dto");
const save_employee_master_dto_1 = require("./dto/save-employee-master.dto");
const employee_master_exception_filter_1 = require("./employee-master-exception.filter");
const employee_master_service_1 = require("./employee-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let EmployeeMasterController = class EmployeeMasterController {
    employeeMasterService;
    constructor(employeeMasterService) {
        this.employeeMasterService = employeeMasterService;
    }
    async save(saveEmployeeMasterDto) {
        const data = await this.employeeMasterService.save(saveEmployeeMasterDto);
        return {
            success: true,
            message: saveEmployeeMasterDto.empId
                ? 'Employee updated successfully'
                : 'Employee created successfully',
            data,
        };
    }
    async getById(empId) {
        const data = await this.employeeMasterService.getById(empId);
        return {
            success: true,
            message: 'Employee fetched successfully',
            data,
        };
    }
    async remove(empId) {
        const data = await this.employeeMasterService.softDelete(empId);
        return {
            success: true,
            message: 'Employee deleted successfully',
            data,
        };
    }
};
exports.EmployeeMasterController = EmployeeMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update employee (by empId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: employee_master_response_dto_1.EmployeeMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_master_response_dto_1.EmployeeMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: employee_master_response_dto_1.EmployeeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_master_response_dto_1.EmployeeMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_employee_master_dto_1.SaveEmployeeMasterDto]),
    __metadata("design:returntype", Promise)
], EmployeeMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get employee by id' }),
    (0, swagger_1.ApiQuery)({ name: 'empId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: employee_master_response_dto_1.EmployeeMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_master_response_dto_1.EmployeeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_master_response_dto_1.EmployeeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('empId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete employee by id' }),
    (0, swagger_1.ApiQuery)({ name: 'empId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: employee_master_response_dto_1.EmployeeMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: employee_master_response_dto_1.EmployeeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: employee_master_response_dto_1.EmployeeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('empId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeMasterController.prototype, "remove", null);
exports.EmployeeMasterController = EmployeeMasterController = __decorate([
    (0, swagger_1.ApiTags)('Employee Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('employee-masters'),
    (0, common_1.UseFilters)(employee_master_exception_filter_1.EmployeeMasterExceptionFilter),
    __metadata("design:paramtypes", [employee_master_service_1.EmployeeMasterService])
], EmployeeMasterController);
//# sourceMappingURL=employee-master.controller.js.map