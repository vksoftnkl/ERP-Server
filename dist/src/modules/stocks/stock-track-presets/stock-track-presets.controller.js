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
exports.StockTrackPresetsController = exports.TRACKING_PRESETS_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const get_stock_track_presets_query_dto_1 = require("./dto/get-stock-track-presets-query.dto");
const save_stock_track_preset_dto_1 = require("./dto/save-stock-track-preset.dto");
const stock_track_presets_response_dto_1 = require("./dto/stock-track-presets-response.dto");
const stock_track_presets_service_1 = require("./stock-track-presets.service");
exports.TRACKING_PRESETS_MENU_ID = 249;
let StockTrackPresetsController = class StockTrackPresetsController {
    stockTrackPresetsService;
    prisma;
    requestContext;
    constructor(stockTrackPresetsService, prisma, requestContext) {
        this.stockTrackPresetsService = stockTrackPresetsService;
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async get(queryDto) {
        const result = await this.stockTrackPresetsService.get(queryDto);
        return {
            success: true,
            message: queryDto.spt_id
                ? 'Stock track preset fetched successfully'
                : 'Stock track presets fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async save(dto) {
        await this.requireRight(dto.sptId ? 'edit' : 'create', dto.sptId ? 'edit a tracking preset' : 'create a tracking preset');
        const data = await this.stockTrackPresetsService.save(dto);
        return {
            success: true,
            message: dto.sptId ? 'Stock track preset updated successfully' : 'Stock track preset created successfully',
            data,
        };
    }
    async deactivate(dto) {
        await this.requireRight('edit', dto.reactivate ? 'reactivate a tracking preset' : 'deactivate a tracking preset');
        const data = await this.stockTrackPresetsService.deactivate(dto);
        return {
            success: true,
            message: data.spt_is_active ? 'Stock track preset reactivated' : 'Stock track preset deactivated',
            data,
        };
    }
    async requireRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: exports.TRACKING_PRESETS_MENU_ID,
            right,
            codePrefix: 'SPT',
            action,
        });
    }
};
exports.StockTrackPresetsController = StockTrackPresetsController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Stock tracking presets a company may pick from — its own plus the shared ones it has not overridden. Feeds the preset combo on Item Master and Item Group Master; the chosen spt_id is what those screens save. usedByItems / usedByGroups count the items and groups naming each preset; above 0 its flags, valuation and code are locked.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsSuccessGetDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_stock_track_presets_query_dto_1.GetStockTrackPresetsQueryDto]),
    __metadata("design:returntype", Promise)
], StockTrackPresetsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Create (no sptId) or update the company's own preset",
        description: 'A shared preset (company NULL) is read-only (409 STOCK_PRESET_SHARED_READ_ONLY): create the company\'s own with the same code to override it. On an update a field left out keeps its value. Once any item or group uses the preset, the six track flags, the valuation and the code are fixed (409 STOCK_PRESET_IN_USE, one detail per field). 422: expiry needs batch, FEFO needs expiry on a batch-tracked preset, valuation is LOT_ACTUAL when anything is tracked else WAVG (derived when left out), code and name on a create. 409 STOCK_PRESET_CODE_TAKEN for a code the company already has.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsSuccessOneDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_stock_track_preset_dto_1.SaveStockTrackPresetDto]),
    __metadata("design:returntype", Promise)
], StockTrackPresetsController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('deactivate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Deactivate (or, with reactivate, reactivate) the company's own preset",
        description: 'Refused 409 STOCK_PRESET_IN_USE while any active item or group uses it; a shared preset is read-only (409).',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsSuccessOneDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_stock_track_preset_dto_1.DeactivateStockTrackPresetDto]),
    __metadata("design:returntype", Promise)
], StockTrackPresetsController.prototype, "deactivate", null);
exports.StockTrackPresetsController = StockTrackPresetsController = __decorate([
    (0, swagger_1.ApiTags)('Stock Track Presets'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock-track-presets'),
    __metadata("design:paramtypes", [stock_track_presets_service_1.StockTrackPresetsService,
        prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], StockTrackPresetsController);
//# sourceMappingURL=stock-track-presets.controller.js.map