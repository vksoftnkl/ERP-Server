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
exports.CreateMobileVisitDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const mobile_item_dto_1 = require("../../item/dto/mobile-item.dto");
const mobile_visit_api_types_1 = require("../types/mobile-visit-api.types");
class CreateMobileVisitDto {
    cvClientUuid;
    cvCompanyId;
    deviceUid;
    cvCustId;
    cvSalesmanId;
    cvReasonCode;
    cvRemarks;
    cvLatitude;
    cvLongitude;
    cvGpsAccuracy;
    cvVisitAt;
}
exports.CreateMobileVisitDto = CreateMobileVisitDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The phone's own id for this check-in. Sending it again answers the row already saved " +
            '(duplicate: true), never a second one.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileVisitDto.prototype, "cvClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company the salesman works for' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileVisitDto.prototype, "cvCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid. Its device is cv_device_id, its branch the visit's " +
            "when it belongs to the company (else the company's default branch).",
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMobileVisitDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'sales.customers.cus_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileVisitDto.prototype, "cvCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'public.employee_master.emp_id, as soSalesmanId' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileVisitDto.prototype, "cvSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: mobile_visit_api_types_1.MOBILE_VISIT_REASON_CODES }),
    (0, class_validator_1.IsIn)(mobile_visit_api_types_1.MOBILE_VISIT_REASON_CODES),
    __metadata("design:type", String)
], CreateMobileVisitDto.prototype, "cvReasonCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], CreateMobileVisitDto.prototype, "cvRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        minimum: -90,
        maximum: 90,
        example: 11.1085,
        description: 'Send with cvLongitude, or neither',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    (0, class_validator_1.Min)(-90),
    (0, class_validator_1.Max)(90),
    __metadata("design:type", Object)
], CreateMobileVisitDto.prototype, "cvLatitude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, minimum: -180, maximum: 180, example: 77.3411 }),
    (0, dtoDecorators_1.NullableNumber)(),
    (0, class_validator_1.Min)(-180),
    (0, class_validator_1.Max)(180),
    __metadata("design:type", Object)
], CreateMobileVisitDto.prototype, "cvLongitude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, minimum: 0, example: 12.5, description: 'Metres' }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], CreateMobileVisitDto.prototype, "cvGpsAccuracy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: 'string',
        format: 'date-time',
        example: '2026-11-16T10:42:00+05:30',
        description: "When the salesman checked in, by the phone's clock (ISO 8601, with an offset)",
    }),
    (0, class_validator_1.IsDateString)({ strict: true }),
    __metadata("design:type", String)
], CreateMobileVisitDto.prototype, "cvVisitAt", void 0);
//# sourceMappingURL=mobile-visit.dto.js.map