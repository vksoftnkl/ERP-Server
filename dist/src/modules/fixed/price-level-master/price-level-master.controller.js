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
exports.PriceLevelMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_price_level_master_query_dto_1 = require("./dto/get-price-level-master-query.dto");
const update_price_level_master_dto_1 = require("./dto/update-price-level-master.dto");
const price_level_master_response_dto_1 = require("./dto/price-level-master-response.dto");
const price_level_master_service_1 = require("./price-level-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let PriceLevelMasterController = class PriceLevelMasterController {
    priceLevelMasterService;
    constructor(priceLevelMasterService) {
        this.priceLevelMasterService = priceLevelMasterService;
    }
    async get(queryDto) {
        const result = await this.priceLevelMasterService.get(queryDto);
        return {
            success: true,
            message: queryDto.priceLvlId !== undefined
                ? 'Price level fetched successfully'
                : 'Price levels fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async update(updateDto) {
        const data = await this.priceLevelMasterService.update(updateDto);
        return {
            success: true,
            message: 'Price levels updated successfully',
            data,
        };
    }
};
exports.PriceLevelMasterController = PriceLevelMasterController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get price levels from fixed.price_levels by priceLvlId or filters. Defaults to non-deleted, both active and inactive.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: price_level_master_response_dto_1.PriceLevelMasterSuccessGetDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: price_level_master_response_dto_1.PriceLevelMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: price_level_master_response_dto_1.PriceLevelMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_price_level_master_query_dto_1.GetPriceLevelMasterQueryDto]),
    __metadata("design:returntype", Promise)
], PriceLevelMasterController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)('bulk'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update one or more price levels in bulk' }),
    (0, swagger_1.ApiOkResponse)({ type: price_level_master_response_dto_1.PriceLevelMasterSuccessUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: price_level_master_response_dto_1.PriceLevelMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: price_level_master_response_dto_1.PriceLevelMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_price_level_master_dto_1.UpdatePriceLevelMasterDto]),
    __metadata("design:returntype", Promise)
], PriceLevelMasterController.prototype, "update", null);
exports.PriceLevelMasterController = PriceLevelMasterController = __decorate([
    (0, swagger_1.ApiTags)('Price Level Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('price-level-masters'),
    __metadata("design:paramtypes", [price_level_master_service_1.PriceLevelMasterService])
], PriceLevelMasterController);
//# sourceMappingURL=price-level-master.controller.js.map