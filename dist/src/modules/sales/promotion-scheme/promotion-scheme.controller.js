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
exports.PromotionSchemeController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const list_promotion_scheme_query_dto_1 = require("./dto/list-promotion-scheme-query.dto");
const promotion_scheme_id_query_dto_1 = require("./dto/promotion-scheme-id-query.dto");
const promotion_scheme_response_dto_1 = require("./dto/promotion-scheme-response.dto");
const save_promotion_scheme_dto_1 = require("./dto/save-promotion-scheme.dto");
const promotion_scheme_exception_filter_1 = require("./promotion-scheme-exception.filter");
const promotion_scheme_service_1 = require("./promotion-scheme.service");
let PromotionSchemeController = class PromotionSchemeController {
    promotionSchemeService;
    constructor(promotionSchemeService) {
        this.promotionSchemeService = promotionSchemeService;
    }
    async saveScheme(dto) {
        const data = await this.promotionSchemeService.saveScheme(dto);
        return {
            success: true,
            message: dto.prm_id
                ? 'Promotion scheme updated successfully'
                : 'Promotion scheme created successfully',
            data,
        };
    }
    async getScheme(query) {
        const data = await this.promotionSchemeService.getSchemeById(query.prm_id);
        return { success: true, message: 'Promotion scheme fetched successfully', data };
    }
    async listSchemes(query) {
        const data = await this.promotionSchemeService.listSchemes(query);
        return { success: true, message: 'Promotion schemes fetched successfully', data };
    }
    async checkEligibility(query) {
        const data = await this.promotionSchemeService.checkEligibility(query.prm_id, query.cus_id);
        return {
            success: true,
            message: 'Promotion scheme eligibility evaluated successfully',
            data,
        };
    }
    async deleteScheme(query) {
        const data = await this.promotionSchemeService.softDeleteScheme(query.prm_id, query.prm_modified_by);
        return { success: true, message: 'Promotion scheme deleted successfully', data };
    }
};
exports.PromotionSchemeController = PromotionSchemeController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a whole promotion scheme — header and all four grids — in one call',
        description: 'Object payload. Omit prm_id to create, send it to update — on update only the keys present ' +
            'in the body are written.\n\n' +
            'The `branches`, `parties`, `items` and `slabs` arrays are optional and save with the ' +
            'header in the same transaction. An array that is present REPLACES that grid: rows ' +
            'carrying their own id are updated, rows without one are inserted, and rows already on the ' +
            'scheme but missing from the array are soft deleted. Omit the key to leave the grid ' +
            'untouched — `"items": []` means "delete every item row", which is not the same thing.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_promotion_scheme_dto_1.SavePromotionSchemeDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "saveScheme", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get one promotion scheme with its branches, parties, items and slabs',
        description: 'Returns the same shape POST /create accepts, ready to edit and post back.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.PromotionSchemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "getScheme", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List the live promotion schemes, optionally narrowed to a company and a branch',
        description: 'Each scheme comes back WHOLE — the header plus its `branches`, `parties`, `items` and ' +
            '`slabs` arrays, the same shape GET /get answers with for one scheme and POST /create ' +
            'accepts back.\n\n' +
            'Only rows with is_deleted = false AND is_active = true are returned, and that is not a ' +
            'parameter. It holds for the child rows too: a deactivated slab band or party rule is ' +
            'absent from the arrays, not present and flagged.\n\n' +
            'Both `company` and `branch` are OPTIONAL narrowings, applied only when sent: no company ' +
            'means every company, no branch means every branch, and a bare /list is every live scheme ' +
            'there is. `branch` matches the prm_branch_id column literally, so company-wide schemes ' +
            '(prm_branch_id NULL) come back only when no branch is named. `company`/`branch` are ' +
            'accepted as short spellings of prm_comp_id/prm_branch_id. Ordered by prm_code.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_promotion_scheme_query_dto_1.ListPromotionSchemeQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "listSchemes", null);
__decorate([
    (0, common_1.Get)('eligibility'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Ask whether one customer qualifies for one scheme',
        description: 'The read the till needs, as opposed to /get which is the read the grid needs. A customer ' +
            'can be reached by four party rows at once — by name, by their group, by their area and by ' +
            'their city — so the answer names the row that decided it: highest prp_match_priority ' +
            'wins, and at equal priority an EXCLUDE beats an INCLUDE.\n\n' +
            'A scheme whose prm_cust_scope is ALL answers YES without reading a single party row. A ' +
            'scheme scoped to a LIST that no row reaches answers NO.\n\n' +
            'A customer reaches a CITY rule only through their area — cus_area_id is the one path, ' +
            'whatever their free-text city says.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeEligibilitySuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.PromotionSchemeEligibilityQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "checkEligibility", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a promotion scheme and every one of its child rows',
    }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.DeletePromotionSchemeQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "deleteScheme", null);
exports.PromotionSchemeController = PromotionSchemeController = __decorate([
    (0, swagger_1.ApiTags)('Promotion Scheme'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('promotion-scheme'),
    (0, common_1.UseFilters)(promotion_scheme_exception_filter_1.PromotionSchemeExceptionFilter),
    __metadata("design:paramtypes", [promotion_scheme_service_1.PromotionSchemeService])
], PromotionSchemeController);
//# sourceMappingURL=promotion-scheme.controller.js.map