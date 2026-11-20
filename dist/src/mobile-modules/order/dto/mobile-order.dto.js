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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMobileOrderDto = exports.MobileOrderLineDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const save_sale_order_dto_1 = require("../../../modules/sales/sale-order/dto/save-sale-order.dto");
const save_sale_order_item_dto_1 = require("../../../modules/sales/sale-order/dto/save-sale-order-item.dto");
const mobile_item_dto_1 = require("../../item/dto/mobile-item.dto");
const SERVER_FILLED_HEADER_KEYS = [
    'soId',
    'soTenantId',
    'soAccYear',
    'soSessionId',
    'soDeviceId',
    'soOrderSlno',
    'soOrderRefno',
    'soStatus',
    'post',
    'waOnPost',
    'charges',
    'tenders',
    'soCreatedBy',
    'soModifiedBy',
];
const REDECLARED_HEADER_KEYS = ['soBranchId', 'soUserId', 'items'];
const SERVER_FILLED_LINE_KEYS = [
    'soiId',
    'soiOrderId',
    'soiCompanyId',
    'soiBranchId',
    'soiTenantId',
    'soiAccYear',
    'soiCreatedBy',
    'soiModifiedBy',
];
class MobileOrderLineDto extends (0, swagger_1.OmitType)(save_sale_order_item_dto_1.SaveSaleOrderItemDto, SERVER_FILLED_LINE_KEYS) {
}
exports.MobileOrderLineDto = MobileOrderLineDto;
class CreateMobileOrderDto extends (0, swagger_1.OmitType)(save_sale_order_dto_1.SaveSaleOrderDto, [
    ...SERVER_FILLED_HEADER_KEYS,
    ...REDECLARED_HEADER_KEYS,
]) {
    soClientUuid;
    deviceUid;
    soUserId;
    soBranchId;
    items;
}
exports.CreateMobileOrderDto = CreateMobileOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The phone's own id for this order. Send the same one again after a lost answer: the " +
            'order already saved is answered (duplicate: true), never a second one.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileOrderDto.prototype, "soClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid (fixed.device_master.dev_device_uid). Its device " +
            "becomes so_device_id. Without soBranchId, its branch is also the order's branch when " +
            "it belongs to soCompanyId (else the company's default branch).",
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMobileOrderDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "The salesman's user id. Ignored when the upload carries a token: the login user is " +
            'so_user_id then. Required without one.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CreateMobileOrderDto.prototype, "soUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The branch the salesman picked for this order (VKSMAN Switch company), saved with the ' +
            'order on the phone. The order is saved in this branch, whatever branch the phone is ' +
            'registered to or the salesman has switched to since. It must be an active, not deleted ' +
            'branch of soCompanyId (the rows of GET /master-lookups/branches/by-company/{soCompanyId}), ' +
            'else 422 MOBILE_BRANCH_NOT_OF_COMPANY; no other branch is tried instead. Absent (or null): ' +
            "as before, the phone's branch on the Device List when it belongs to soCompanyId, else " +
            "the company's default branch, else its only active branch (422 " +
            'MOBILE_BRANCH_NOT_RESOLVED when none). A resend (same soClientUuid) answers the order ' +
            'already saved, in the branch it was saved in, whatever branch the resend carries.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CreateMobileOrderDto.prototype, "soBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileOrderLineDto], minItems: 1, description: 'At least one line' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MobileOrderLineDto),
    __metadata("design:type", Array)
], CreateMobileOrderDto.prototype, "items", void 0);
//# sourceMappingURL=mobile-order.dto.js.map