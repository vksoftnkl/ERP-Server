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
exports.PromotionLoyaltyPointsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const delete_loyalty_gift_query_dto_1 = require("./dto/delete-loyalty-gift-query.dto");
const delete_loyalty_point_query_dto_1 = require("./dto/delete-loyalty-point-query.dto");
const delete_loyalty_scheme_query_dto_1 = require("./dto/delete-loyalty-scheme-query.dto");
const loyalty_gift_id_query_dto_1 = require("./dto/loyalty-gift-id-query.dto");
const loyalty_point_id_query_dto_1 = require("./dto/loyalty-point-id-query.dto");
const loyalty_scheme_id_query_dto_1 = require("./dto/loyalty-scheme-id-query.dto");
const promotion_loyalty_points_response_dto_1 = require("./dto/promotion-loyalty-points-response.dto");
const save_loyalty_gift_dto_1 = require("./dto/save-loyalty-gift.dto");
const save_loyalty_point_dto_1 = require("./dto/save-loyalty-point.dto");
const save_loyalty_scheme_dto_1 = require("./dto/save-loyalty-scheme.dto");
const promotion_loyalty_points_exception_filter_1 = require("./promotion-loyalty-points-exception.filter");
const promotion_loyalty_points_service_1 = require("./promotion-loyalty-points.service");
const api_version_1 = require("../../../common/constants/api-version");
let PromotionLoyaltyPointsController = class PromotionLoyaltyPointsController {
    promotionLoyaltyPointsService;
    constructor(promotionLoyaltyPointsService) {
        this.promotionLoyaltyPointsService = promotionLoyaltyPointsService;
    }
    async saveScheme(saveLoyaltySchemeDto) {
        const data = await this.promotionLoyaltyPointsService.saveScheme(saveLoyaltySchemeDto);
        return {
            success: true,
            message: saveLoyaltySchemeDto.ls_id
                ? 'Loyalty scheme updated successfully'
                : 'Loyalty scheme created successfully',
            data,
        };
    }
    async getSchemeById(queryDto) {
        const data = await this.promotionLoyaltyPointsService.getSchemeById(queryDto.ls_id);
        return {
            success: true,
            message: 'Loyalty scheme fetched successfully',
            data,
        };
    }
    async deleteScheme(queryDto) {
        const data = await this.promotionLoyaltyPointsService.softDeleteScheme(queryDto.ls_id, queryDto.ls_updated_by);
        return {
            success: true,
            message: 'Loyalty scheme deleted successfully',
            data,
        };
    }
    async savePoint(saveLoyaltyPointDto) {
        const data = await this.promotionLoyaltyPointsService.savePoint(saveLoyaltyPointDto);
        return {
            success: true,
            message: saveLoyaltyPointDto.lspt_id
                ? 'Loyalty point updated successfully'
                : 'Loyalty point created successfully',
            data,
        };
    }
    async getPointById(queryDto) {
        const data = await this.promotionLoyaltyPointsService.getPointById(queryDto.lspt_id);
        return {
            success: true,
            message: 'Loyalty point fetched successfully',
            data,
        };
    }
    async deletePoint(queryDto) {
        const data = await this.promotionLoyaltyPointsService.softDeletePoint(queryDto.lspt_id, queryDto.lspt_updated_by);
        return {
            success: true,
            message: 'Loyalty point deleted successfully',
            data,
        };
    }
    async saveGift(saveLoyaltyGiftDto) {
        const data = await this.promotionLoyaltyPointsService.saveGift(saveLoyaltyGiftDto);
        return {
            success: true,
            message: saveLoyaltyGiftDto.lsg_id
                ? 'Loyalty gift updated successfully'
                : 'Loyalty gift created successfully',
            data,
        };
    }
    async getGiftById(queryDto) {
        const data = await this.promotionLoyaltyPointsService.getGiftById(queryDto.lsg_id);
        return {
            success: true,
            message: 'Loyalty gift fetched successfully',
            data,
        };
    }
    async deleteGift(queryDto) {
        const data = await this.promotionLoyaltyPointsService.softDeleteGift(queryDto.lsg_id, queryDto.lsg_updated_by);
        return {
            success: true,
            message: 'Loyalty gift deleted successfully',
            data,
        };
    }
};
exports.PromotionLoyaltyPointsController = PromotionLoyaltyPointsController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update loyalty scheme by ls_id presence' }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltySchemeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_loyalty_scheme_dto_1.SaveLoyaltySchemeDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "saveScheme", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get a full loyalty scheme graph by ls_id in a single response',
    }),
    (0, swagger_1.ApiOkResponse)({
        type: promotion_loyalty_points_response_dto_1.LoyaltySchemeSuccessSingleDto,
        description: 'Returns the scheme header along with nested parties, points, and gifts.',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_scheme_id_query_dto_1.LoyaltySchemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "getSchemeById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete loyalty scheme by ls_id' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltySchemeSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_loyalty_scheme_query_dto_1.DeleteLoyaltySchemeQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "deleteScheme", null);
__decorate([
    (0, common_1.Post)('points/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update loyalty point slab by lspt_id presence' }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltyPointSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_loyalty_point_dto_1.SaveLoyaltyPointDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "savePoint", null);
__decorate([
    (0, common_1.Get)('points/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Compatibility endpoint for a single loyalty point slab',
        deprecated: true,
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltyPointSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_point_id_query_dto_1.LoyaltyPointIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "getPointById", null);
__decorate([
    (0, common_1.Delete)('points/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete loyalty point slab by lspt_id' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltyPointSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_loyalty_point_query_dto_1.DeleteLoyaltyPointQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "deletePoint", null);
__decorate([
    (0, common_1.Post)('gifts/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update loyalty gift rule by lsg_id presence' }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltyGiftSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_loyalty_gift_dto_1.SaveLoyaltyGiftDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "saveGift", null);
__decorate([
    (0, common_1.Get)('gifts/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Compatibility endpoint for a single loyalty gift rule',
        deprecated: true,
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltyGiftSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_gift_id_query_dto_1.LoyaltyGiftIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "getGiftById", null);
__decorate([
    (0, common_1.Delete)('gifts/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete loyalty gift rule by lsg_id' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltyGiftSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_loyalty_gift_query_dto_1.DeleteLoyaltyGiftQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "deleteGift", null);
exports.PromotionLoyaltyPointsController = PromotionLoyaltyPointsController = __decorate([
    (0, swagger_1.ApiTags)('Promotion Loyalty Points'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('promotion-loyalty-points'),
    (0, common_1.UseFilters)(promotion_loyalty_points_exception_filter_1.PromotionLoyaltyPointsExceptionFilter),
    __metadata("design:paramtypes", [promotion_loyalty_points_service_1.PromotionLoyaltyPointsService])
], PromotionLoyaltyPointsController);
//# sourceMappingURL=promotion-loyalty-points.controller.js.map