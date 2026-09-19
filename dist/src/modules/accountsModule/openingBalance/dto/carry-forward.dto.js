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
exports.CarryForwardDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class CarryForwardDto {
    companyId;
    fromAccYear;
    toAccYear;
    branchId;
    overwriteManual;
}
exports.CarryForwardDto = CarryForwardDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CarryForwardDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-2026', description: 'The year being closed — read from.' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], CarryForwardDto.prototype, "fromAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'The year being opened — written into. Must follow fromAccYear.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], CarryForwardDto.prototype, "toAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'null = the company-level set.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CarryForwardDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'false (the default) spares MANUAL and MIGRATION rows and reports them as skippedManual. ' +
            "true overwrites them — which discards an accountant's correction, so it is never the default.",
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], CarryForwardDto.prototype, "overwriteManual", void 0);
//# sourceMappingURL=carry-forward.dto.js.map