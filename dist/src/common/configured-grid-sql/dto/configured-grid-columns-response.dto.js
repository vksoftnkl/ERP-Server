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
exports.ConfiguredGridColumnsResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const configured_grid_style_dto_1 = require("./configured-grid-style.dto");
class ConfiguredGridColumnsResponseDto {
    success;
    message;
    data;
}
exports.ConfiguredGridColumnsResponseDto = ConfiguredGridColumnsResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfiguredGridColumnsResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Grid columns fetched successfully' }),
    __metadata("design:type", String)
], ConfiguredGridColumnsResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: configured_grid_style_dto_1.ConfiguredGridStyleDto, isArray: true }),
    __metadata("design:type", Array)
], ConfiguredGridColumnsResponseDto.prototype, "data", void 0);
//# sourceMappingURL=configured-grid-columns-response.dto.js.map