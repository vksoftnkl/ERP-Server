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
exports.MobileOrderController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const error_wording_1 = require("../../common/error-wording/error-wording");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const data_change_service_1 = require("../../common/data-changes/data-change.service");
const sale_order_exception_filter_1 = require("../../modules/sales/sale-order/sale-order-exception.filter");
const sale_order_response_dto_1 = require("../../modules/sales/sale-order/dto/sale-order-response.dto");
const mobile_order_dto_1 = require("./dto/mobile-order.dto");
const mobile_order_service_1 = require("./mobile-order.service");
class MobileOrderUserWordingDto {
    title;
    line;
    todo;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Day closed' }),
    __metadata("design:type", String)
], MobileOrderUserWordingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Today is closed for billing.' }),
    __metadata("design:type", String)
], MobileOrderUserWordingDto.prototype, "line", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Call manager.' }),
    __metadata("design:type", String)
], MobileOrderUserWordingDto.prototype, "todo", void 0);
class MobileOrderConfirmRefusalDto {
    code;
    field;
    message;
    user;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SALES_DAY_CLOSED' }),
    __metadata("design:type", String)
], MobileOrderConfirmRefusalDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, nullable: true, example: 'soOrderDate' }),
    __metadata("design:type", Object)
], MobileOrderConfirmRefusalDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'The books for 2026-11-19 are closed at this branch' }),
    __metadata("design:type", String)
], MobileOrderConfirmRefusalDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: MobileOrderUserWordingDto,
        description: "The catalogue's plain words for the code (fixed.error_message); absent when none",
    }),
    __metadata("design:type", MobileOrderUserWordingDto)
], MobileOrderConfirmRefusalDto.prototype, "user", void 0);
class MobileOrderReserveShortDto {
    code;
    line;
    short;
    message;
    user;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SALES_RESERVE_SHORT' }),
    __metadata("design:type", String)
], MobileOrderReserveShortDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], MobileOrderReserveShortDto.prototype, "line", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 6, description: 'Quantity the stock could not hold for the line' }),
    __metadata("design:type", Number)
], MobileOrderReserveShortDto.prototype, "short", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileOrderReserveShortDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: MobileOrderUserWordingDto }),
    __metadata("design:type", MobileOrderUserWordingDto)
], MobileOrderReserveShortDto.prototype, "user", void 0);
class MobileOrderWhatsappDto {
    wmlId;
    accYear;
    status;
    errorCode;
    fallbackClickToChat;
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], MobileOrderWhatsappDto.prototype, "wmlId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, nullable: true, example: '2026-2027' }),
    __metadata("design:type", Object)
], MobileOrderWhatsappDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['SENDING', 'SKIPPED', 'FAILED', 'NOT_CONNECTED'] }),
    __metadata("design:type", String)
], MobileOrderWhatsappDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], MobileOrderWhatsappDto.prototype, "errorCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Boolean)
], MobileOrderWhatsappDto.prototype, "fallbackClickToChat", void 0);
class MobileOrderCreateResultDto {
    soId;
    soOrderRefno;
    soStatus;
    soAccYear;
    duplicate;
    soIsDeleted;
    confirmRefused;
    warnings;
    whatsapp;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileOrderCreateResultDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sor00042' }),
    __metadata("design:type", String)
], MobileOrderCreateResultDto.prototype, "soOrderRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'CONFIRMED',
        description: 'Now: CONFIRMED when this upload confirmed it, DRAFT when the confirm was refused ' +
            '(confirmRefused says why); a resend reads the stored one',
    }),
    __metadata("design:type", String)
], MobileOrderCreateResultDto.prototype, "soStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileOrderCreateResultDto.prototype, "soAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true = saved before under this soClientUuid; nothing written now' }),
    __metadata("design:type", Boolean)
], MobileOrderCreateResultDto.prototype, "duplicate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'A resend of an order the office has since deleted' }),
    __metadata("design:type", Boolean)
], MobileOrderCreateResultDto.prototype, "soIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: MobileOrderConfirmRefusalDto,
        nullable: true,
        description: 'Why the new order was kept DRAFT (the first error the confirm refused with); null when ' +
            'confirmed, and on a resend',
    }),
    __metadata("design:type", Object)
], MobileOrderCreateResultDto.prototype, "confirmRefused", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileOrderReserveShortDto],
        description: "The confirm's reservation shortfalls, as /sale-orders/post answers them: a warning, " +
            'never a refusal. [] on a resend and when kept DRAFT',
    }),
    __metadata("design:type", Array)
], MobileOrderCreateResultDto.prototype, "warnings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: MobileOrderWhatsappDto,
        description: 'WhatsApp on Post, as /sale-orders/post answers it: only when this upload confirmed the ' +
            "order and the company's whatsapp.on_post_types lists Sales Order (4). Never on a resend " +
            'or a DRAFT',
    }),
    __metadata("design:type", MobileOrderWhatsappDto)
], MobileOrderCreateResultDto.prototype, "whatsapp", void 0);
class MobileOrderCreateSuccessDto {
    success;
    message;
    data;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileOrderCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileOrderCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileOrderCreateResultDto }),
    __metadata("design:type", MobileOrderCreateResultDto)
], MobileOrderCreateSuccessDto.prototype, "data", void 0);
let MobileOrderController = class MobileOrderController {
    mobileOrderService;
    dataChangeService;
    constructor(mobileOrderService, dataChangeService) {
        this.mobileOrderService = mobileOrderService;
        this.dataChangeService = dataChangeService;
    }
    async create(dto, request) {
        const created = await this.mobileOrderService.create(dto);
        const data = withRefusalWording(created, (0, error_wording_1.wordingLangOf)(request));
        if (!data.duplicate) {
            this.dataChangeService.publish({
                resource: 'sale-orders',
                method: 'POST',
                at: Date.now(),
                originSessionId: request.user?.sid ?? null,
            });
        }
        return {
            success: true,
            message: data.duplicate ? 'Order already saved' : 'Order created successfully',
            data,
        };
    }
};
exports.MobileOrderController = MobileOrderController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload one order with its lines (safe to resend)',
        description: 'The desktop /sale-orders/create payload (so* / soi*) without soId, soAccYear, ' +
            'soDeviceId, soOrderSlno / soOrderRefno, soSessionId, soStatus, post, charges and ' +
            'tenders (400 VALIDATION_WHITELIST), plus soClientUuid and deviceUid. soBranchId is ' +
            'optional: the branch the salesman picked, which must be an active branch of ' +
            'soCompanyId (422 MOBILE_BRANCH_NOT_OF_COMPANY). The server fills: the device (the ' +
            'registered phone, 403 MOBILE_DEVICE_*), the branch when soBranchId is absent (the ' +
            "phone's when it belongs to soCompanyId, else the company default; 422 " +
            "MOBILE_BRANCH_NOT_RESOLVED), the acc year (the company's financial year holding " +
            'soOrderDate, today when omitted; 422 MOBILE_NO_FISCAL_YEAR) and the number (voucher ' +
            'type 4). A line with no soiGodownId is saved in its item godown, as a desktop sale ' +
            "line defaults it: the item's price-row godown for its unit, else the branch's live " +
            'default godown (user, 2026-11-20). The order is then confirmed in the same ' +
            'transaction, as /sale-orders/post would (stock reserved, CONFIRMED), without the menu-11 ' +
            'Post right check (user, 2026-11-19); shortfalls come back in warnings[], and WhatsApp ' +
            "on Post follows the commit as on the desktop (the company's setting decides; whatsapp " +
            'block). When the confirm is refused (a closed ' +
            'day, a closed or locked year, an invalid salesman …) the order is kept DRAFT and ' +
            'confirmRefused says why; the upload still succeeds. The same soClientUuid again answers ' +
            'the order already saved (duplicate: true) and writes nothing; on another customer it ' +
            'is a 409 MOBILE_CLIENT_UUID_REUSED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: MobileOrderCreateSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_order_dto_1.CreateMobileOrderDto, Object]),
    __metadata("design:returntype", Promise)
], MobileOrderController.prototype, "create", null);
exports.MobileOrderController = MobileOrderController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Orders'),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiSecurity)({}),
    (0, swagger_1.ApiUnauthorizedResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Only when a token is sent and it is malformed, expired or revoked',
    }),
    (0, common_1.Controller)('mobile/orders'),
    (0, common_1.UseFilters)(sale_order_exception_filter_1.SaleOrderExceptionFilter),
    __metadata("design:paramtypes", [mobile_order_service_1.MobileOrderService,
        data_change_service_1.DataChangeService])
], MobileOrderController);
function withRefusalWording(data, lang) {
    if (!data.confirmRefused) {
        return data;
    }
    const user = (0, error_wording_1.wordingFor)({ ...data.confirmRefused }, lang);
    return user ? { ...data, confirmRefused: { ...data.confirmRefused, user } } : data;
}
//# sourceMappingURL=mobile-order.controller.js.map