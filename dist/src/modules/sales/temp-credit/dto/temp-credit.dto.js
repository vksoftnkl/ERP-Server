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
exports.TempCreditFollowUpDto = exports.OpenTempCreditsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class OpenTempCreditsQueryDto {
    companyId;
    branchId;
    status;
    search;
    overdueOnly;
}
exports.OpenTempCreditsQueryDto = OpenTempCreditsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OpenTempCreditsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(36),
    __metadata("design:type", String)
], OpenTempCreditsQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Comma list of OPEN, PARTIAL, SETTLED, WRITTEN_OFF, CANCELLED',
        default: 'OPEN,PARTIAL',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], OpenTempCreditsQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Name, mobile or bill number' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], OpenTempCreditsQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], OpenTempCreditsQueryDto.prototype, "overdueOnly", void 0);
class TempCreditFollowUpDto {
    atcId;
    atcAccYear;
    promiseDate;
    remarks;
}
exports.TempCreditFollowUpDto = TempCreditFollowUpDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TempCreditFollowUpDto.prototype, "atcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], TempCreditFollowUpDto.prototype, "atcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], TempCreditFollowUpDto.prototype, "promiseDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], TempCreditFollowUpDto.prototype, "remarks", void 0);
//# sourceMappingURL=temp-credit.dto.js.map