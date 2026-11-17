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
exports.MobileVisitController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_visit_dto_1 = require("./dto/mobile-visit.dto");
const mobile_visit_service_1 = require("./mobile-visit.service");
class MobileVisitCreateResultDto {
    cvId;
    cvClientUuid;
    cvVisitAt;
    duplicate;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileVisitCreateResultDto.prototype, "cvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileVisitCreateResultDto.prototype, "cvClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'date-time',
        description: 'The visit time the server holds (UTC instant)',
    }),
    __metadata("design:type", String)
], MobileVisitCreateResultDto.prototype, "cvVisitAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true = saved before under this cvClientUuid; nothing written now' }),
    __metadata("design:type", Boolean)
], MobileVisitCreateResultDto.prototype, "duplicate", void 0);
class MobileVisitCreateSuccessDto {
    success;
    message;
    data;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileVisitCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileVisitCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileVisitCreateResultDto }),
    __metadata("design:type", MobileVisitCreateResultDto)
], MobileVisitCreateSuccessDto.prototype, "data", void 0);
let MobileVisitController = class MobileVisitController {
    mobileVisitService;
    constructor(mobileVisitService) {
        this.mobileVisitService = mobileVisitService;
    }
    async create(dto) {
        const data = await this.mobileVisitService.create(dto);
        return {
            success: true,
            message: data.duplicate ? 'Visit already saved' : 'Visit saved successfully',
            data,
        };
    }
};
exports.MobileVisitController = MobileVisitController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload one check-in at a customer (safe to resend)',
        description: 'Customer, salesman (employee), reason code (shopClosed / noOrder / shopBusy / ' +
            'ownerAway / paymentPending / nextVisit), remarks, GPS fix and the visit time. The ' +
            'server fills the device (the registered phone, 403 MOBILE_DEVICE_*) and the branch (the ' +
            "phone's when it belongs to the company, else the company default). The same " +
            'cvClientUuid again answers the row already saved (duplicate: true) and writes nothing; ' +
            'on another customer it is a 409 MOBILE_CLIENT_UUID_REUSED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: MobileVisitCreateSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_visit_dto_1.CreateMobileVisitDto]),
    __metadata("design:returntype", Promise)
], MobileVisitController.prototype, "create", null);
exports.MobileVisitController = MobileVisitController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Visits'),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiSecurity)({}),
    (0, swagger_1.ApiUnauthorizedResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Only when a token is sent and it is malformed, expired or revoked',
    }),
    (0, common_1.Controller)('mobile/visits'),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    __metadata("design:paramtypes", [mobile_visit_service_1.MobileVisitService])
], MobileVisitController);
//# sourceMappingURL=mobile-visit.controller.js.map