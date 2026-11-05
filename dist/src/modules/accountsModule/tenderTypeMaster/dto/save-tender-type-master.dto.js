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
exports.SaveTenderTypeMasterDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const DtoTransforms_1 = require("../../../../common/dto/DtoTransforms");
class SaveTenderTypeMasterDto {
    ttmTypeId;
    ttmTypeName;
    ttmDisplayName;
    ttmIsActive;
}
exports.SaveTenderTypeMasterDto = SaveTenderTypeMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '1',
        description: 'When provided, request updates the existing tender type',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, DtoTransforms_1.toOptionalIdString)(value)),
    (0, class_validator_1.Matches)(/^\d+$/),
    __metadata("design:type", String)
], SaveTenderTypeMasterDto.prototype, "ttmTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50, example: 'CASH' }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveTenderTypeMasterDto.prototype, "ttmTypeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        example: 'Cash',
        description: 'POS-facing label. Defaults to ttmTypeName when omitted.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], SaveTenderTypeMasterDto.prototype, "ttmDisplayName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTenderTypeMasterDto.prototype, "ttmIsActive", void 0);
//# sourceMappingURL=save-tender-type-master.dto.js.map