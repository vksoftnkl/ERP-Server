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
exports.MenuMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_menu_query_dto_1 = require("./dto/get-menu-query.dto");
const menu_master_response_dto_1 = require("./dto/menu-master-response.dto");
const update_menu_visibility_dto_1 = require("./dto/update-menu-visibility.dto");
const menu_master_service_1 = require("./menu-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let MenuMasterController = class MenuMasterController {
    menuMasterService;
    constructor(menuMasterService) {
        this.menuMasterService = menuMasterService;
    }
    async get(queryDto) {
        const result = await this.menuMasterService.get(queryDto);
        return {
            success: true,
            message: 'Menus fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getUserMenu() {
        const result = await this.menuMasterService.getUserMenu();
        return {
            success: true,
            message: 'User menus fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async updateVisibility(body) {
        const data = await this.menuMasterService.updateVisibility(body.menus);
        return {
            success: true,
            message: 'Menu visibility updated successfully',
            data,
        };
    }
};
exports.MenuMasterController = MenuMasterController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get the full active menu tree, optionally filtered to only visible menus.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: menu_master_response_dto_1.MenuMasterSuccessGetDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: menu_master_response_dto_1.MenuMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: menu_master_response_dto_1.MenuMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_menu_query_dto_1.GetMenuQueryDto]),
    __metadata("design:returntype", Promise)
], MenuMasterController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('usermenu'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get the menus visible to the current user, based on their user-menu assignments (um_visibility = true).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: menu_master_response_dto_1.MenuMasterSuccessGetDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: menu_master_response_dto_1.MenuMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: menu_master_response_dto_1.MenuMasterErrorResponseDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MenuMasterController.prototype, "getUserMenu", null);
__decorate([
    (0, common_1.Patch)('visibility'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update menu_visibility for one or more menus.' }),
    (0, swagger_1.ApiOkResponse)({ type: menu_master_response_dto_1.MenuMasterSuccessUpdateVisibilityDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: menu_master_response_dto_1.MenuMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: menu_master_response_dto_1.MenuMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_menu_visibility_dto_1.UpdateMenuVisibilityDto]),
    __metadata("design:returntype", Promise)
], MenuMasterController.prototype, "updateVisibility", null);
exports.MenuMasterController = MenuMasterController = __decorate([
    (0, swagger_1.ApiTags)('Menu Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('menu-masters'),
    __metadata("design:paramtypes", [menu_master_service_1.MenuMasterService])
], MenuMasterController);
//# sourceMappingURL=menu-master.controller.js.map