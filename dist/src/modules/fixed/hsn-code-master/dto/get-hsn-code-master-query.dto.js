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
exports.GetHsnCodeMasterQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class GetHsnCodeMasterQueryDto {
    hsnId;
    hsnCode;
    activeOnly;
}
exports.GetHsnCodeMasterQueryDto = GetHsnCodeMasterQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Fetch a specific HSN record by id.',
        minimum: 1,
        example: 1,
    }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], GetHsnCodeMasterQueryDto.prototype, "hsnId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Fetch HSN records by exact HSN code.',
        maxLength: 50,
        example: '3004',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], GetHsnCodeMasterQueryDto.prototype, "hsnCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: true,
        description: 'Return only active HSN records',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GetHsnCodeMasterQueryDto.prototype, "activeOnly", void 0);
//# sourceMappingURL=get-hsn-code-master-query.dto.js.map