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
exports.GstinLookupController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const gstin_lookup_query_dto_1 = require("./dto/gstin-lookup-query.dto");
const gstin_lookup_exception_filter_1 = require("./gstin-lookup-exception.filter");
const gstin_lookup_service_1 = require("./gstin-lookup.service");
let GstinLookupController = class GstinLookupController {
    gstinLookupService;
    constructor(gstinLookupService) {
        this.gstinLookupService = gstinLookupService;
    }
    async search(query) {
        const data = await this.gstinLookupService.search(query.gstin);
        return { success: true, message: 'GST details fetched successfully', data };
    }
};
exports.GstinLookupController = GstinLookupController;
__decorate([
    (0, common_1.Get)('search'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Look up a GSTIN's registered details through the configured GST provider",
        description: 'Fills a company / branch / party form: legal and trade name, status, registration type ' +
            '(also as REGULAR / COMPOSITION / UNREGISTERED / SEZ), state code, PAN and address, plus ' +
            'the provider record as sent. 404 when the provider has no details, 502 when it fails, ' +
            '503 when no provider or source GSTIN is configured.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ success, message, data: GstinLookupPayload }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiBadGatewayResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gstin_lookup_query_dto_1.GstinLookupQueryDto]),
    __metadata("design:returntype", Promise)
], GstinLookupController.prototype, "search", null);
exports.GstinLookupController = GstinLookupController = __decorate([
    (0, swagger_1.ApiTags)('GST'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('gst'),
    (0, common_1.UseFilters)(gstin_lookup_exception_filter_1.GstinLookupExceptionFilter),
    __metadata("design:paramtypes", [gstin_lookup_service_1.GstinLookupService])
], GstinLookupController);
//# sourceMappingURL=gstin-lookup.controller.js.map