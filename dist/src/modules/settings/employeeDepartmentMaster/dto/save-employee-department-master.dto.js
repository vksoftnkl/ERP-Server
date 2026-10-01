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
exports.SaveEmployeeDepartmentMasterDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveEmployeeDepartmentMasterDto {
    edptId;
    edptName;
    edptCode;
    edptAlias;
    edptRemarks;
    edptIsActive;
}
exports.SaveEmployeeDepartmentMasterDto = SaveEmployeeDepartmentMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing employee department',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveEmployeeDepartmentMasterDto.prototype, "edptId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], SaveEmployeeDepartmentMasterDto.prototype, "edptName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveEmployeeDepartmentMasterDto.prototype, "edptCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveEmployeeDepartmentMasterDto.prototype, "edptAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveEmployeeDepartmentMasterDto.prototype, "edptRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveEmployeeDepartmentMasterDto.prototype, "edptIsActive", void 0);
//# sourceMappingURL=save-employee-department-master.dto.js.map