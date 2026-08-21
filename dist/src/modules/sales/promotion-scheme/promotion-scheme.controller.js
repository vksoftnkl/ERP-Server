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
const promotion_scheme_id_query_dto_1 = require("./dto/promotion-scheme-id-query.dto");
const promotion_scheme_response_dto_1 = require("./dto/promotion-scheme-response.dto");
const save_promotion_scheme_branch_dto_1 = require("./dto/save-promotion-scheme-branch.dto");
const save_promotion_scheme_item_dto_1 = require("./dto/save-promotion-scheme-item.dto");
const save_promotion_scheme_party_dto_1 = require("./dto/save-promotion-scheme-party.dto");
const save_promotion_scheme_slab_dto_1 = require("./dto/save-promotion-scheme-slab.dto");
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
    async deleteScheme(query) {
        const data = await this.promotionSchemeService.softDeleteScheme(query.prm_id, query.prm_modified_by);
        return { success: true, message: 'Promotion scheme deleted successfully', data };
    }
    async saveBranches(dto) {
        const data = await this.promotionSchemeService.saveBranches(dto);
        return { success: true, message: 'Promotion scheme branches saved successfully', data };
    }
    async getBranches(query) {
        const data = await this.promotionSchemeService.getBranches(query.prm_id);
        return { success: true, message: 'Promotion scheme branches fetched successfully', data };
    }
    async deleteBranch(query) {
        const data = await this.promotionSchemeService.deleteBranch(query.row_id, query.modified_by);
        return { success: true, message: 'Promotion scheme branch deleted successfully', data };
    }
    async saveParties(dto) {
        const data = await this.promotionSchemeService.saveParties(dto);
        return { success: true, message: 'Promotion scheme parties saved successfully', data };
    }
    async getParties(query) {
        const data = await this.promotionSchemeService.getParties(query.prm_id);
        return { success: true, message: 'Promotion scheme parties fetched successfully', data };
    }
    async deleteParty(query) {
        const data = await this.promotionSchemeService.deleteParty(query.row_id, query.modified_by);
        return { success: true, message: 'Promotion scheme party deleted successfully', data };
    }
    async saveItems(dto) {
        const data = await this.promotionSchemeService.saveItems(dto);
        return { success: true, message: 'Promotion scheme items saved successfully', data };
    }
    async getItems(query) {
        const data = await this.promotionSchemeService.getItems(query.prm_id);
        return { success: true, message: 'Promotion scheme items fetched successfully', data };
    }
    async deleteItem(query) {
        const data = await this.promotionSchemeService.deleteItem(query.row_id, query.modified_by);
        return { success: true, message: 'Promotion scheme item deleted successfully', data };
    }
    async saveSlabs(dto) {
        const data = await this.promotionSchemeService.saveSlabs(dto);
        return { success: true, message: 'Promotion scheme slabs saved successfully', data };
    }
    async getSlabs(query) {
        const data = await this.promotionSchemeService.getSlabs(query.prm_id);
        return { success: true, message: 'Promotion scheme slabs fetched successfully', data };
    }
    async deleteSlab(query) {
        const data = await this.promotionSchemeService.deleteSlab(query.row_id, query.modified_by);
        return { success: true, message: 'Promotion scheme slab deleted successfully', data };
    }
};
exports.PromotionSchemeController = PromotionSchemeController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a promotion scheme header by prm_id presence',
        description: 'Object payload. Omit prm_id to create, send it to update — on update only the keys present ' +
            'in the body are written.',
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
__decorate([
    (0, common_1.Post)('branches/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Upsert the branch scope rows of a scheme',
        description: 'Array payload. Rows carrying prb_id are updated, rows without one are inserted, and rows ' +
            'omitted from the array are left untouched — delete explicitly.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeBranchSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_promotion_scheme_branch_dto_1.SavePromotionSchemeBranchesDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "saveBranches", null);
__decorate([
    (0, common_1.Get)('branches/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List the branch scope rows of a scheme' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeBranchSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.PromotionSchemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "getBranches", null);
__decorate([
    (0, common_1.Delete)('branches/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete one branch scope row by prb_id (row_id)' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeChildSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.DeletePromotionChildQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "deleteBranch", null);
__decorate([
    (0, common_1.Post)('parties/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Upsert the customer/group/area/city scope rows of a scheme',
        description: 'Array payload. Send prp_kind + prp_scope_id per row; the four FK carrier columns are ' +
            'generated by the database and are not accepted here.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemePartySuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_promotion_scheme_party_dto_1.SavePromotionSchemePartiesDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "saveParties", null);
__decorate([
    (0, common_1.Get)('parties/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List the party scope rows of a scheme, narrowest match first' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemePartySuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.PromotionSchemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "getParties", null);
__decorate([
    (0, common_1.Delete)('parties/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete one party scope row by prp_id (row_id)' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeChildSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.DeletePromotionChildQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "deleteParty", null);
__decorate([
    (0, common_1.Post)('items/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Upsert the item scope rows of a scheme',
        description: 'Array payload. Send pri_kind + pri_scope_id per row (plus pri_unit_id when the kind is ' +
            'ITEM); the five FK carrier columns are generated by the database.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeItemSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_promotion_scheme_item_dto_1.SavePromotionSchemeItemsDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "saveItems", null);
__decorate([
    (0, common_1.Get)('items/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List the item scope rows of a scheme, most specific first' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeItemSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.PromotionSchemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "getItems", null);
__decorate([
    (0, common_1.Delete)('items/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete one item scope row by pri_id (row_id)' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeChildSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.DeletePromotionChildQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "deleteItem", null);
__decorate([
    (0, common_1.Post)('slabs/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Upsert the offer bands of a scheme',
        description: "Array payload. prs_benefit defaults to the header's prm_benefit and may not disagree " +
            'with it; the benefit decides which of the band columns must be filled.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeSlabSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_promotion_scheme_slab_dto_1.SavePromotionSchemeSlabsDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "saveSlabs", null);
__decorate([
    (0, common_1.Get)('slabs/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List the offer bands of a scheme, lowest threshold first' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeSlabSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.PromotionSchemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "getSlabs", null);
__decorate([
    (0, common_1.Delete)('slabs/delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete one offer band by prs_id (row_id)' }),
    (0, swagger_1.ApiOkResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeChildSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: promotion_scheme_response_dto_1.PromotionSchemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [promotion_scheme_id_query_dto_1.DeletePromotionChildQueryDto]),
    __metadata("design:returntype", Promise)
], PromotionSchemeController.prototype, "deleteSlab", null);
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