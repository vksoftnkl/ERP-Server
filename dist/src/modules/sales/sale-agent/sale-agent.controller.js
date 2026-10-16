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
exports.SaleAgentController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const save_sale_agent_dto_1 = require("./dto/save-sale-agent.dto");
const sale_agent_response_dto_1 = require("./dto/sale-agent-response.dto");
const sale_agent_exception_filter_1 = require("./sale-agent-exception.filter");
const sale_agent_service_1 = require("./sale-agent.service");
const api_version_1 = require("../../../common/constants/api-version");
let SaleAgentController = class SaleAgentController {
    saleAgentService;
    constructor(saleAgentService) {
        this.saleAgentService = saleAgentService;
    }
    async save(saveSaleAgentDto) {
        const data = await this.saleAgentService.save(saveSaleAgentDto);
        return {
            success: true,
            message: saveSaleAgentDto.saId
                ? 'Sale agent updated successfully'
                : 'Sale agent created successfully',
            data,
        };
    }
    async getById(saId) {
        const data = await this.saleAgentService.getById(saId);
        return {
            success: true,
            message: 'Sale agent fetched successfully',
            data,
        };
    }
    async remove(saId) {
        const data = await this.saleAgentService.softDelete(saId);
        return {
            success: true,
            message: 'Sale agent deleted successfully',
            data,
        };
    }
};
exports.SaleAgentController = SaleAgentController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update sale agent (by saId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: sale_agent_response_dto_1.SaleAgentSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_agent_response_dto_1.SaleAgentErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_agent_response_dto_1.SaleAgentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_agent_response_dto_1.SaleAgentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_sale_agent_dto_1.SaveSaleAgentDto]),
    __metadata("design:returntype", Promise)
], SaleAgentController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get sale agent by id' }),
    (0, swagger_1.ApiQuery)({ name: 'saId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: sale_agent_response_dto_1.SaleAgentSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_agent_response_dto_1.SaleAgentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_agent_response_dto_1.SaleAgentErrorResponseDto }),
    __param(0, (0, common_1.Query)('saId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SaleAgentController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete sale agent by id' }),
    (0, swagger_1.ApiQuery)({ name: 'saId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: sale_agent_response_dto_1.SaleAgentSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_agent_response_dto_1.SaleAgentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_agent_response_dto_1.SaleAgentErrorResponseDto }),
    __param(0, (0, common_1.Query)('saId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SaleAgentController.prototype, "remove", null);
exports.SaleAgentController = SaleAgentController = __decorate([
    (0, swagger_1.ApiTags)('Sale Agents'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('sale-agents'),
    (0, common_1.UseFilters)(sale_agent_exception_filter_1.SaleAgentExceptionFilter),
    __metadata("design:paramtypes", [sale_agent_service_1.SaleAgentService])
], SaleAgentController);
//# sourceMappingURL=sale-agent.controller.js.map