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
exports.ItemsGstUnitsMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_item_gst_unit_query_dto_1 = require("./dto/get-item-gst-unit-query.dto");
const item_gst_unit_response_dto_1 = require("./dto/item-gst-unit-response.dto");
const item_gst_unit_exception_filter_1 = require("./item-gst-unit-exception.filter");
const items_gst_units_master_service_1 = require("./items-gst-units-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsGstUnitsMasterController = class ItemsGstUnitsMasterController {
    itemsGstUnitsMasterService;
    constructor(itemsGstUnitsMasterService) {
        this.itemsGstUnitsMasterService = itemsGstUnitsMasterService;
    }
    async list(queryDto) {
        const data = await this.itemsGstUnitsMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item GST units fetched successfully',
            data,
        };
    }
};
exports.ItemsGstUnitsMasterController = ItemsGstUnitsMasterController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List item GST units with optional search' }),
    (0, swagger_1.ApiOkResponse)({ type: item_gst_unit_response_dto_1.ItemGstUnitSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_gst_unit_response_dto_1.ItemGstUnitErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_item_gst_unit_query_dto_1.GetItemGstUnitQueryDto]),
    __metadata("design:returntype", Promise)
], ItemsGstUnitsMasterController.prototype, "list", null);
exports.ItemsGstUnitsMasterController = ItemsGstUnitsMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item GST Units'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('item-gst-units'),
    (0, common_1.UseFilters)(item_gst_unit_exception_filter_1.ItemGstUnitExceptionFilter),
    __metadata("design:paramtypes", [items_gst_units_master_service_1.ItemsGstUnitsMasterService])
], ItemsGstUnitsMasterController);
//# sourceMappingURL=items-gst-units-master.controller.js.map