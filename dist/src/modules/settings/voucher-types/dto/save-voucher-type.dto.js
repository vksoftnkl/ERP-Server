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
exports.ValidateVoucherTypeDto = exports.SaveVoucherTypeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const voucher_types_rules_1 = require("../voucher-types.rules");
const NUMBERING_MODES = Object.values(client_1.VoucherNumberingMode);
const RESET_FREQS = Object.values(client_1.VoucherResetFreq);
class SaveVoucherTypeDto {
    companyId;
    vchrTypeId;
    vchrParentId;
    vchrTypeName;
    vchrTypeShort;
    vchrSortOrder;
    vchrIsActive;
    vchrNumberingMode;
    vchrNoPrefix;
    vchrNoSuffix;
    vchrNoWidth;
    vchrResetFreq;
    vchrStartNo;
    vchrPrintTitle;
    vchrPrintPurposeId;
    vchrPrintAfterPost;
    vchrTallyVoucherTypeName;
    vchrDeliveryMode;
    offerBase;
    branchId;
    accYear;
}
exports.SaveVoucherTypeDto = SaveVoucherTypeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The login company (VT_COMPANY_MISMATCH otherwise).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveVoucherTypeDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = edit that type.' }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveVoucherTypeDto.prototype, "vchrTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'A child names its base (3 Sales Bill); a base sends null.',
    }),
    (0, dtoDecorators_1.NullableInteger)(1),
    __metadata("design:type", Object)
], SaveVoucherTypeDto.prototype, "vchrParentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SaveVoucherTypeDto.prototype, "vchrTypeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        description: 'Abbreviation: 1 to 6 letters or digits (a child).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], SaveVoucherTypeDto.prototype, "vchrTypeShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveVoucherTypeDto.prototype, "vchrSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'A child only; a base keeps its Active (OP-2).' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveVoucherTypeDto.prototype, "vchrIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: NUMBERING_MODES,
        description: "Method. 'AUTO' only today (decision 42).",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(NUMBERING_MODES),
    __metadata("design:type", String)
], SaveVoucherTypeDto.prototype, "vchrNumberingMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true, description: 'May hold {FY}, {YY}, {BR}.' }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveVoucherTypeDto.prototype, "vchrNoPrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveVoucherTypeDto.prototype, "vchrNoSuffix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '1 to 9 (VT_WIDTH_INVALID).' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveVoucherTypeDto.prototype, "vchrNoWidth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: RESET_FREQS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(RESET_FREQS),
    __metadata("design:type", String)
], SaveVoucherTypeDto.prototype, "vchrResetFreq", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'First number of every NEW counter, 1 or more (VT_START_NO_INVALID).',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveVoucherTypeDto.prototype, "vchrStartNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveVoucherTypeDto.prototype, "vchrPrintTitle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'A print design from /get printDesigns.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveVoucherTypeDto.prototype, "vchrPrintPurposeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveVoucherTypeDto.prototype, "vchrPrintAfterPost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Child only (Q9); stored, no export yet.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveVoucherTypeDto.prototype, "vchrTallyVoucherTypeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: voucher_types_rules_1.VT_DELIVERY_MODES,
        nullable: true,
        description: 'Delivery tracking (Q3): the delivery mode a new bill of this type defaults to — Sales Bill and its ' +
            'children only (VT_DELIVERY_MODE_NOT_ALLOWED elsewhere). Left out = keep the stored value (a child ' +
            "never saved with one keeps null = the base's). null / '' on a Sales Bill type → VT_DELIVERY_MODE_REQUIRED.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() || null : value),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsIn)(voucher_types_rules_1.VT_DELIVERY_MODES),
    __metadata("design:type", Object)
], SaveVoucherTypeDto.prototype, "vchrDeliveryMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Base 3 only: "Offer Sales Bill itself on new bills" for this company (sales.offer_base_bill_type).',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveVoucherTypeDto.prototype, "offerBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The branch the preview / counters are shown for (default: the company default branch).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveVoucherTypeDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-2027',
        description: 'The year the preview / counters are shown for (default: today’s).',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", String)
], SaveVoucherTypeDto.prototype, "accYear", void 0);
class ValidateVoucherTypeDto extends SaveVoucherTypeDto {
}
exports.ValidateVoucherTypeDto = ValidateVoucherTypeDto;
//# sourceMappingURL=save-voucher-type.dto.js.map