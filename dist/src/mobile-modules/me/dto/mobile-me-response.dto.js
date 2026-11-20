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
exports.MobileMeSuccessDto = exports.MobileMeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class MobileMenuRightsDto {
    view;
    create;
    post;
    cancel;
    print;
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'um_can_view' }),
    __metadata("design:type", Boolean)
], MobileMenuRightsDto.prototype, "view", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'um_can_create' }),
    __metadata("design:type", Boolean)
], MobileMenuRightsDto.prototype, "create", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'um_can_post' }),
    __metadata("design:type", Boolean)
], MobileMenuRightsDto.prototype, "post", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'um_can_cancel' }),
    __metadata("design:type", Boolean)
], MobileMenuRightsDto.prototype, "cancel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'um_can_print' }),
    __metadata("design:type", Boolean)
], MobileMenuRightsDto.prototype, "print", void 0);
class MobileMeRightsDto {
    '11';
    '12';
    '99';
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileMenuRightsDto, description: 'Menu 11, Sales Order' }),
    __metadata("design:type", MobileMenuRightsDto)
], MobileMeRightsDto.prototype, "11", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileMenuRightsDto, description: 'Menu 12, Sales Bill' }),
    __metadata("design:type", MobileMenuRightsDto)
], MobileMeRightsDto.prototype, "12", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileMenuRightsDto, description: 'Menu 99, Receipt' }),
    __metadata("design:type", MobileMenuRightsDto)
], MobileMeRightsDto.prototype, "99", void 0);
class MobileMeDto {
    userId;
    loginName;
    employeeId;
    employeeName;
    rights;
}
exports.MobileMeDto = MobileMeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileMeDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'VKPOS' }),
    __metadata("design:type", String)
], MobileMeDto.prototype, "loginName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        format: 'uuid',
        description: "user_master.usr_employee_id when it names a live employee: the collector the phone's receipts carry",
    }),
    __metadata("design:type", Object)
], MobileMeDto.prototype, "employeeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileMeDto.prototype, "employeeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: MobileMeRightsDto,
        description: "The login's rights on the menus the phone uses, keyed by menu id as text, read from " +
            'public.user_menus as the desktop guards read them (no row = no rights; no SUPER ADMIN bypass)',
    }),
    __metadata("design:type", MobileMeRightsDto)
], MobileMeDto.prototype, "rights", void 0);
class MobileMeSuccessDto {
    success;
    message;
    data;
}
exports.MobileMeSuccessDto = MobileMeSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileMeSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileMeSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileMeDto }),
    __metadata("design:type", MobileMeDto)
], MobileMeSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-me-response.dto.js.map