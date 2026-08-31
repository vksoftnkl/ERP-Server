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
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const list_loyalty_scheme_query_dto_1 = require("./dto/list-loyalty-scheme-query.dto");
const loyalty_scheme_id_query_dto_1 = require("./dto/loyalty-scheme-id-query.dto");
const promotion_loyalty_points_response_dto_1 = require("./dto/promotion-loyalty-points-response.dto");
const save_loyalty_scheme_dto_1 = require("./dto/save-loyalty-scheme.dto");
const promotion_loyalty_points_exception_filter_1 = require("./promotion-loyalty-points-exception.filter");
const promotion_loyalty_points_service_1 = require("./promotion-loyalty-points.service");
let PromotionLoyaltyPointsController = class PromotionLoyaltyPointsController {
    promotionLoyaltyPointsService;
    constructor(promotionLoyaltyPointsService) {
        this.promotionLoyaltyPointsService = promotionLoyaltyPointsService;
    }
    async saveScheme(dto) {
        const data = await this.promotionLoyaltyPointsService.saveScheme(dto);
        return {
            success: true,
            message: dto.lsc_id
                ? 'Loyalty scheme updated successfully'
                : 'Loyalty scheme created successfully',
            data,
        };
    }
    async getScheme(query) {
        const data = await this.promotionLoyaltyPointsService.getSchemeById(query.lsc_id);
        return { success: true, message: 'Loyalty scheme fetched successfully', data };
    }
    async listSchemes(query) {
        const data = await this.promotionLoyaltyPointsService.listSchemes(query);
        return { success: true, message: 'Loyalty schemes fetched successfully', data };
    }
    async checkEligibility(query) {
        const data = await this.promotionLoyaltyPointsService.checkEligibility(query.lsc_id, query.cus_id);
        return {
            success: true,
            message: 'Loyalty scheme eligibility evaluated successfully',
            data,
        };
    }
    async deleteScheme(query) {
        const data = await this.promotionLoyaltyPointsService.softDeleteScheme(query.lsc_id, query.lsc_modified_by);
        return { success: true, message: 'Loyalty scheme deleted successfully', data };
    }
};
exports.PromotionLoyaltyPointsController = PromotionLoyaltyPointsController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a whole loyalty scheme — header and all five grids — in one call',
        description: 'Object payload. Omit lsc_id to create, send it to update — on update only the keys ' +
            'present in the body are written.\n\n' +
            'The `branches`, `parties`, `items`, `slabs` and `gifts` arrays are optional and save ' +
            'with the header in the same transaction. An array that is present REPLACES that grid: ' +
            'rows carrying their own id are updated, rows without one are inserted, and rows already ' +
            'on the scheme but missing from the array are soft deleted. Omit the key to leave the ' +
            'grid untouched — `"slabs": []` means "delete every band", which is not the same thing.',
    }),
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
        summary: 'Get one loyalty scheme with its branches, parties, items, slabs and gifts',
        description: 'Returns the same shape POST /create accepts, ready to edit and post back.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltySchemeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_scheme_id_query_dto_1.LoyaltySchemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "getScheme", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List the live loyalty schemes, optionally narrowed to a company and a branch',
        description: 'Each scheme comes back WHOLE — the header plus its five grids, the same shape GET /get ' +
            'answers with for one scheme and POST /create accepts back.\n\n' +
            'Only rows with is_deleted = false AND is_active = true are returned, and that is not a ' +
            'parameter. It holds for the child rows too: a deactivated band or party rule is absent ' +
            'from the arrays, not present and flagged.\n\n' +
            'Both `company` and `branch` are OPTIONAL narrowings, applied only when sent. `branch` ' +
            'matches the lsc_branch_id column literally, so company-wide schemes (lsc_branch_id ' +
            'NULL) come back only when no branch is named. Ordered by lsc_code.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltySchemeSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_loyalty_scheme_query_dto_1.ListLoyaltySchemeQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "listSchemes", null);
__decorate([
    (0, common_1.Get)('eligibility'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Ask whether one customer earns on one scheme',
        description: 'The read the till needs, as opposed to /get which is the read the grid needs. A customer ' +
            'can be reached by two party rows at once — by name and by their group — so the answer ' +
            'names the row that decided it: highest lsp_match_priority wins, and at equal priority an ' +
            'EXCLUDE beats an INCLUDE.\n\n' +
            'A scheme whose lsc_cust_scope is ALL answers YES without reading a single party row. A ' +
            'scheme scoped to a LIST that no row reaches answers NO.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltySchemeEligibilitySuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_scheme_id_query_dto_1.LoyaltySchemeEligibilityQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "checkEligibility", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a loyalty scheme and every one of its child rows' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_loyalty_points_response_dto_1.LoyaltySchemeSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_loyalty_points_response_dto_1.PromotionLoyaltyPointsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_scheme_id_query_dto_1.DeleteLoyaltySchemeQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionLoyaltyPointsController.prototype, "deleteScheme", null);
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