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
exports.PhysicalStockController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const physical_stock_service_1 = require("./physical-stock.service");
const create_physical_stock_dto_1 = require("./dto/create-physical-stock.dto");
const physical_stock_response_dto_1 = require("./dto/physical-stock-response.dto");
const physical_stock_exception_filter_1 = require("./physical-stock-exception.filter");
const physical_stock_response_types_1 = require("./types/physical-stock-response.types");
const list_physical_stock_query_dto_1 = require("./dto/list-physical-stock-query.dto");
const api_version_1 = require("../../../common/constants/api-version");
let PhysicalStockController = class PhysicalStockController {
    physicalStockService;
    constructor(physicalStockService) {
        this.physicalStockService = physicalStockService;
    }
    async save(createPhysicalStockDto, response) {
        const isUpdate = Boolean(createPhysicalStockDto.psId);
        response.status(isUpdate ? common_1.HttpStatus.OK : common_1.HttpStatus.CREATED);
        const data = await this.physicalStockService.save(createPhysicalStockDto);
        return {
            success: true,
            message: isUpdate
                ? 'Physical stock updated successfully'
                : 'Physical stock created successfully',
            data,
        };
    }
    async listOrGet(queryDto) {
        const document = await this.resolveDocumentQuery(queryDto);
        if (document) {
            return {
                success: true,
                message: 'Physical stock fetched successfully',
                data: document,
            };
        }
        const result = await this.physicalStockService.list(queryDto);
        return {
            success: true,
            message: 'Physical stock documents fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(queryDto) {
        const data = await this.physicalStockService.getById(queryDto.ps_id ?? '');
        return {
            success: true,
            message: 'Physical stock fetched successfully',
            data,
        };
    }
    async getList(queryDto) {
        return this.listOrGet(queryDto);
    }
    async findOne(id) {
        const data = await this.physicalStockService.findOne(id);
        return {
            success: true,
            message: 'Physical stock fetched successfully',
            data,
        };
    }
    async removeByQueryRoot(queryDto) {
        return this.remove(queryDto.ps_id ?? '');
    }
    async removeByQuery(queryDto) {
        return this.remove(queryDto.ps_id ?? '');
    }
    async remove(id) {
        const data = await this.physicalStockService.remove(id);
        return {
            success: true,
            message: 'Physical stock deleted successfully',
            data,
        };
    }
    async resolveDocumentQuery(queryDto) {
        if (queryDto.ps_id) {
            return this.physicalStockService.getById(queryDto.ps_id);
        }
        if (queryDto.ps_doc_refno) {
            return this.physicalStockService.getByRefNo(queryDto);
        }
        return null;
    }
};
exports.PhysicalStockController = PhysicalStockController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update physical stock document by psId presence' }),
    (0, swagger_1.ApiBody)({ type: create_physical_stock_dto_1.CreatePhysicalStockDto }),
    (0, swagger_1.ApiCreatedResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessSingleDto }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_physical_stock_dto_1.CreatePhysicalStockDto, Object]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "save", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List physical stock documents or get a single document when ps_id or ps_doc_refno is provided',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_query_dto_1.ListPhysicalStockQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "listOrGet", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get physical stock document by ps_id' }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_query_dto_1.ListPhysicalStockQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List physical stock documents or get a single document when ps_id or ps_doc_refno is provided',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_query_dto_1.ListPhysicalStockQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "getList", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get physical stock document by physical stock header id' }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        format: 'uuid',
        description: 'Physical stock header id',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessSingleDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete physical stock document by ps_id' }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessDeleteDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_query_dto_1.ListPhysicalStockQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "removeByQueryRoot", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete physical stock document by ps_id' }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessDeleteDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_query_dto_1.ListPhysicalStockQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "removeByQuery", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete physical stock document by physical stock header id' }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        format: 'uuid',
        description: 'Physical stock header id',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_response_types_1.PhysicalStockSuccessDeleteDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PhysicalStockController.prototype, "remove", null);
exports.PhysicalStockController = PhysicalStockController = __decorate([
    (0, swagger_1.ApiTags)('Physical Stock'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: physical_stock_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('physical-stock'),
    (0, common_1.UseFilters)(physical_stock_exception_filter_1.PhysicalStockExceptionFilter),
    __metadata("design:paramtypes", [physical_stock_service_1.PhysicalStockService])
], PhysicalStockController);
//# sourceMappingURL=physical-stock.controller.js.map