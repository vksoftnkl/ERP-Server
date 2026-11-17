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
exports.GodownPositionController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../../common/dto/http-error-response.dto");
const godown_position_service_1 = require("./godown-position.service");
const godown_position_query_dto_1 = require("./dto/godown-position-query.dto");
const SCOPE_NOTE = 'Per item × godown of one branch, TODAY: Physical = Owned (stock_balance on hand) + Billed not ' +
    'delivered (Σ open Pickup / Dispatch bill lines of the godown − their delivery events). Free to ' +
    'sell = stock_balance available. Challan out = posted challans’ open qty. On vehicle is phase 2 ' +
    '(null). Quantities 3 dp in the Qty-in unit (the selling unit by default, Q16), kg 3 dp. ' +
    'Needs view on menu 306 — 403 GODOWN_POSITION_RIGHT_VIEW.';
const REFUSALS = 'STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY, GODOWN_POSITION_GODOWN_NOT_IN_BRANCH, ' +
    'STOCK_SUMMARY_GROUP_NOT_FOUND, STOCK_SUMMARY_BRAND_NOT_FOUND (in that order)';
let GodownPositionController = class GodownPositionController {
    service;
    constructor(service) {
        this.service = service;
    }
    async show(q) {
        const data = await this.service.show(q);
        return { success: true, message: `${data.rows.length} row(s)`, data };
    }
    async behind(q) {
        const data = await this.service.behind(q);
        return { success: true, message: `${data.rows.length} row(s)`, data };
    }
    async export(q) {
        const data = await this.service.export(q);
        return { success: true, message: `${data.totalRows} row(s)`, data };
    }
};
exports.GodownPositionController = GodownPositionController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Show: head, tiles, one row per item × godown, kg totals, rights',
        description: SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [godown_position_query_dto_1.GodownPositionQueryDto]),
    __metadata("design:returntype", Promise)
], GodownPositionController.prototype, "show", null);
__decorate([
    (0, common_1.Get)('behind'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'What is behind one row’s figure: the open bill lines (BND) or challans, + the row by lot',
        description: 'kind BND: the open bill lines of the item in the godown (billed, given, pending in the row’s ' +
            'Qty-in unit), oldest bill first; kind CHALLAN: the posted challans with open qty. byLot: ' +
            'owned + not delivered = physical per lot; sum: the row. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${REFUSALS}, STOCK_SUMMARY_ITEM_NOT_FOUND`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [godown_position_query_dto_1.GodownPositionBehindDto]),
    __metadata("design:returntype", Promise)
], GodownPositionController.prototype, "behind", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Every row of a Show for Excel and print, with printedAs (the first line)',
        description: 'Show’s keys and answer plus printedAs and totalRows, numbers unformatted (as the Stock ' +
            'Summary export). Needs VIEW and EXPORT on 306 (403 GODOWN_POSITION_RIGHT_EXPORT). ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'GODOWN_POSITION_RIGHT_VIEW, GODOWN_POSITION_RIGHT_EXPORT',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [godown_position_query_dto_1.GodownPositionExportDto]),
    __metadata("design:returntype", Promise)
], GodownPositionController.prototype, "export", null);
exports.GodownPositionController = GodownPositionController = __decorate([
    (0, swagger_1.ApiTags)('Stock Reports — Godown Stock Position'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'GODOWN_POSITION_RIGHT_VIEW' }),
    (0, common_1.Controller)('stock/reports/godown-position'),
    __metadata("design:paramtypes", [godown_position_service_1.GodownPositionService])
], GodownPositionController);
//# sourceMappingURL=godown-position.controller.js.map