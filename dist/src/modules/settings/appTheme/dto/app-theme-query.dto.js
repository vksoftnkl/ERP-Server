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
exports.AppThemeEffectiveQueryDto = exports.AppThemeIdQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class AppThemeIdQueryDto {
    thmId;
}
exports.AppThemeIdQueryDto = AppThemeIdQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], AppThemeIdQueryDto.prototype, "thmId", void 0);
class AppThemeEffectiveQueryDto {
    companyId;
}
exports.AppThemeEffectiveQueryDto = AppThemeEffectiveQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AppThemeEffectiveQueryDto.prototype, "companyId", void 0);
//# sourceMappingURL=app-theme-query.dto.js.map