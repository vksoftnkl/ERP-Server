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
exports.SaveConfigsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveConfigsDto {
    configId;
    configName;
    configValue;
    configSyncDate;
    configCreatedBy;
    configModifiedBy;
}
exports.SaveConfigsDto = SaveConfigsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Config identifier (primary key). Updates the record when it already exists.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SaveConfigsDto.prototype, "configId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Config key/name' }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveConfigsDto.prototype, "configName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Config value' }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveConfigsDto.prototype, "configValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Last sync timestamp (ISO-8601)' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveConfigsDto.prototype, "configSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveConfigsDto.prototype, "configCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveConfigsDto.prototype, "configModifiedBy", void 0);
//# sourceMappingURL=save-configs.dto.js.map