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
exports.AgeingSlabsController = exports.AGEING_SLABS_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const ageing_slabs_dto_1 = require("./dto/ageing-slabs.dto");
const ageing_slabs_service_1 = require("./ageing-slabs.service");
exports.AGEING_SLABS_MENU_ID = 294;
let AgeingSlabsController = class AgeingSlabsController {
    service;
    prisma;
    requestContext;
    constructor(service, prisma, requestContext) {
        this.service = service;
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async get(query) {
        await this.requireRight('view', 'view the ageing slabs');
        const data = await this.service.get(query.companyId);
        return { success: true, message: 'Ageing slabs fetched successfully', data };
    }
    async save(dto) {
        await this.requireRight('edit', 'save the ageing slabs');
        const data = await this.service.save(dto);
        return { success: true, message: 'Ageing slabs saved successfully', data };
    }
    async revert(dto) {
        await this.requireRight('edit', 'revert the ageing slabs');
        const data = await this.service.revert(dto.companyId);
        return { success: true, message: 'Ageing slabs reverted to the default', data };
    }
    async requireRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: exports.AGEING_SLABS_MENU_ID,
            right,
            codePrefix: 'AGE',
            action,
        });
    }
};
exports.AgeingSlabsController = AgeingSlabsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "The company's ageing ladder",
        description: "The company's own slabs if it has any (usingOwn true), otherwise the shared default (company NULL) — never a mixture.",
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ usingOwn, slabs: [{ slabNo, label, fromDays, toDays|null }] }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ageing_slabs_dto_1.AgeingSlabsCompanyDto]),
    __metadata("design:returntype", Promise)
], AgeingSlabsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Replace the company's whole ladder",
        description: 'One transaction (ex_sag_overlap deferred) retires every company row and writes the ladder sent. Refused 422 per field (slabs.<i>.fromDays, .toDays, .label, .slabNo; slabs for the count) unless the first slab starts at 0, each starts the day after the previous ends, exactly one slab is open-ended and it is the last, labels are non-blank and unique, there are 1–20 slabs and slabNo runs 1..n. "Customise" = this save with a copy of the default.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The ladder as saved (usingOwn true).' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ageing_slabs_dto_1.SaveAgeingSlabsDto]),
    __metadata("design:returntype", Promise)
], AgeingSlabsController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('revert'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Drop the company's own ladder; the shared default applies again",
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The ladder now in force (usingOwn false).' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ageing_slabs_dto_1.AgeingSlabsCompanyDto]),
    __metadata("design:returntype", Promise)
], AgeingSlabsController.prototype, "revert", null);
exports.AgeingSlabsController = AgeingSlabsController = __decorate([
    (0, swagger_1.ApiTags)('Ageing Slabs'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'AGE_RIGHT_VIEW / AGE_RIGHT_EDIT on menu 294.' }),
    (0, common_1.Controller)('stock/ageing-slabs'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [ageing_slabs_service_1.AgeingSlabsService,
        prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], AgeingSlabsController);
//# sourceMappingURL=ageing-slabs.controller.js.map