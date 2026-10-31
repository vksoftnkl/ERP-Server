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
exports.GetStockTrackPresetsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class GetStockTrackPresetsQueryDto {
    company_id;
    spt_id;
    spt_code;
}
exports.GetStockTrackPresetsQueryDto = GetStockTrackPresetsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Company whose presets to merge with the shared ones. Defaults to the request context company. A company preset overrides a shared one of the same code.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetStockTrackPresetsQueryDto.prototype, "company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Fetch one preset by id. Returns it whether shared or company-owned.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetStockTrackPresetsQueryDto.prototype, "spt_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filter to a single code, after the company merge is applied.',
        example: 'PHARMA',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(30),
    __metadata("design:type", String)
], GetStockTrackPresetsQueryDto.prototype, "spt_code", void 0);
//# sourceMappingURL=get-stock-track-presets-query.dto.js.map