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
exports.BranchMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const branch_master_exception_filter_1 = require("./branch-master-exception.filter");
const branch_master_response_dto_1 = require("./dto/branch-master-response.dto");
const save_branch_master_dto_1 = require("./dto/save-branch-master.dto");
const branch_master_service_1 = require("./branch-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let BranchMasterController = class BranchMasterController {
    branchMasterService;
    constructor(branchMasterService) {
        this.branchMasterService = branchMasterService;
    }
    async save(saveBranchMasterDto) {
        const data = await this.branchMasterService.save(saveBranchMasterDto);
        return {
            success: true,
            message: saveBranchMasterDto.brId
                ? 'Branch updated successfully'
                : 'Branch created successfully',
            data,
        };
    }
    async getById(brId) {
        const data = await this.branchMasterService.getById(brId);
        return {
            success: true,
            message: 'Branch fetched successfully',
            data,
        };
    }
    async remove(brId) {
        const data = await this.branchMasterService.softDelete(brId);
        return {
            success: true,
            message: 'Branch deleted successfully',
            data,
        };
    }
};
exports.BranchMasterController = BranchMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update branch (by brId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: branch_master_response_dto_1.BranchMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: branch_master_response_dto_1.BranchMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: branch_master_response_dto_1.BranchMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: branch_master_response_dto_1.BranchMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_branch_master_dto_1.SaveBranchMasterDto]),
    __metadata("design:returntype", Promise)
], BranchMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get branch by id' }),
    (0, swagger_1.ApiQuery)({ name: 'brId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' }),
    (0, swagger_1.ApiOkResponse)({ type: branch_master_response_dto_1.BranchMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: branch_master_response_dto_1.BranchMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: branch_master_response_dto_1.BranchMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('brId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BranchMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete branch by id' }),
    (0, swagger_1.ApiQuery)({ name: 'brId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' }),
    (0, swagger_1.ApiOkResponse)({ type: branch_master_response_dto_1.BranchMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: branch_master_response_dto_1.BranchMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: branch_master_response_dto_1.BranchMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('brId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BranchMasterController.prototype, "remove", null);
exports.BranchMasterController = BranchMasterController = __decorate([
    (0, swagger_1.ApiTags)('Branch Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('branch-masters'),
    (0, common_1.UseFilters)(branch_master_exception_filter_1.BranchMasterExceptionFilter),
    __metadata("design:paramtypes", [branch_master_service_1.BranchMasterService])
], BranchMasterController);
//# sourceMappingURL=branch-master.controller.js.map