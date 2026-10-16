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
exports.StockTrackPresetsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_stock_track_presets_query_dto_1 = require("./dto/get-stock-track-presets-query.dto");
const stock_track_presets_response_dto_1 = require("./dto/stock-track-presets-response.dto");
const stock_track_presets_service_1 = require("./stock-track-presets.service");
let StockTrackPresetsController = class StockTrackPresetsController {
    stockTrackPresetsService;
    constructor(stockTrackPresetsService) {
        this.stockTrackPresetsService = stockTrackPresetsService;
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
};
exports.StockTrackPresetsController = StockTrackPresetsController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Stock tracking presets a company may pick from — its own plus the shared ones it has not overridden. Feeds the preset combo on Item Master and Item Group Master; the chosen spt_id is what those screens save.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsSuccessGetDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_track_presets_response_dto_1.StockTrackPresetsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_stock_track_presets_query_dto_1.GetStockTrackPresetsQueryDto]),
    __metadata("design:returntype", Promise)
], StockTrackPresetsController.prototype, "get", null);
exports.StockTrackPresetsController = StockTrackPresetsController = __decorate([
    (0, swagger_1.ApiTags)('Stock Track Presets'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('stock-track-presets'),
    __metadata("design:paramtypes", [stock_track_presets_service_1.StockTrackPresetsService])
], StockTrackPresetsController);
//# sourceMappingURL=stock-track-presets.controller.js.map