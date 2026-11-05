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
exports.GetChargeDetailQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const charge_detail_api_types_1 = require("../types/charge-detail-api.types");
class GetChargeDetailQueryDto {
    cdId;
    cdDocType;
    cdDocId;
    isActive;
}
exports.GetChargeDetailQueryDto = GetChargeDetailQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Fetch a single charge line by id' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetChargeDetailQueryDto.prototype, "cdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: charge_detail_api_types_1.ChargeDocType,
        enumName: 'ChargeDocType',
        description: "Parent document's module; send together with cdDocId",
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(12),
    (0, class_validator_1.IsEnum)(charge_detail_api_types_1.ChargeDocType),
    __metadata("design:type", String)
], GetChargeDetailQueryDto.prototype, "cdDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Parent document id; send together with cdDocType',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetChargeDetailQueryDto.prototype, "cdDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Document lookup only: restrict to cd_is_active = true rows. Defaults to all',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GetChargeDetailQueryDto.prototype, "isActive", void 0);
//# sourceMappingURL=get-charge-detail-query.dto.js.map