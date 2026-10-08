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
exports.ConfiguredGridRunResponseDto = exports.ConfiguredGridRunDataDto = exports.ConfiguredGridRunMetaDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ConfiguredGridRunMetaDto {
    page;
    limit;
    total;
}
exports.ConfiguredGridRunMetaDto = ConfiguredGridRunMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ConfiguredGridRunMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], ConfiguredGridRunMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], ConfiguredGridRunMetaDto.prototype, "total", void 0);
class ConfiguredGridRunDataDto {
    items;
    meta;
}
exports.ConfiguredGridRunDataDto = ConfiguredGridRunDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Rows returned by the grid SQL query', type: [Object] }),
    __metadata("design:type", Array)
], ConfiguredGridRunDataDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfiguredGridRunMetaDto }),
    __metadata("design:type", ConfiguredGridRunMetaDto)
], ConfiguredGridRunDataDto.prototype, "meta", void 0);
class ConfiguredGridRunResponseDto {
    success;
    message;
    data;
}
exports.ConfiguredGridRunResponseDto = ConfiguredGridRunResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfiguredGridRunResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Grid data fetched successfully' }),
    __metadata("design:type", String)
], ConfiguredGridRunResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfiguredGridRunDataDto }),
    __metadata("design:type", ConfiguredGridRunDataDto)
], ConfiguredGridRunResponseDto.prototype, "data", void 0);
//# sourceMappingURL=configured-grid-run-response.dto.js.map