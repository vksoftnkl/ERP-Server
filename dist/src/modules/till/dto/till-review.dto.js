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
exports.TillReviewListQueryDto = exports.CreateTillReviewDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const till_enum_1 = require("../types/till-enum");
const till_session_dto_1 = require("./till-session.dto");
class CreateTillReviewDto extends till_session_dto_1.TillScopeDto {
    accYear;
    dayId;
    sessionId;
    outcome;
    note;
    refVoucherId;
    refVoucherAccYear;
}
exports.CreateTillReviewDto = CreateTillReviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'The year of the day / session reviewed: the review is filed in it.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], CreateTillReviewDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'A business day of this branch (till_business_day.tbd_id). Exactly one of dayId / sessionId.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillReviewDto.prototype, "dayId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'A till session of this branch (till_session.tss_id). Exactly one of dayId / sessionId.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillReviewDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: till_enum_1.TillReviewOutcome }),
    (0, class_validator_1.IsIn)(Object.values(till_enum_1.TillReviewOutcome)),
    __metadata("design:type", String)
], CreateTillReviewDto.prototype, "outcome", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 1000,
        description: 'Required unless the outcome is OK (400 TILL_NOTE_REQUIRED).',
    }),
    (0, dtoDecorators_1.NullableString)(1000),
    __metadata("design:type", Object)
], CreateTillReviewDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: `The journal head office raised — only on ${till_enum_1.REVIEW_REF_OUTCOMES.join(' / ')}, with refVoucherAccYear. A posted voucher of this company.`,
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], CreateTillReviewDto.prototype, "refVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-2027', nullable: true }),
    (0, dtoDecorators_1.NullableUpperString)(9),
    __metadata("design:type", Object)
], CreateTillReviewDto.prototype, "refVoucherAccYear", void 0);
class TillReviewListQueryDto extends till_session_dto_1.TillScopeDto {
    dayId;
    sessionId;
}
exports.TillReviewListQueryDto = TillReviewListQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'One business day’s reviews.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillReviewListQueryDto.prototype, "dayId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'One session’s reviews.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TillReviewListQueryDto.prototype, "sessionId", void 0);
//# sourceMappingURL=till-review.dto.js.map