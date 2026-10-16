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
exports.SaveCompanyGroupMasterDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const toUniqueStringArray = (value) => {
    const toDistinct = (input) => {
        const seen = new Set();
        const out = [];
        for (const item of input) {
            if (!seen.has(item)) {
                seen.add(item);
                out.push(item);
            }
        }
        return out;
    };
    if (Array.isArray(value)) {
        const normalized = value
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        return toDistinct(normalized);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                const normalized = parsed
                    .filter((item) => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0);
                return toDistinct(normalized);
            }
        }
        catch {
        }
        return toDistinct(trimmed
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0));
    }
    return [];
};
class SaveCompanyGroupMasterDto {
    cogGroupId;
    cogGroupName;
    cogCompanyIds;
    cogIsActive;
}
exports.SaveCompanyGroupMasterDto = SaveCompanyGroupMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'When provided, request updates the group' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveCompanyGroupMasterDto.prototype, "cogGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80 }),
    (0, dtoDecorators_1.TrimmedString)(80),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveCompanyGroupMasterDto.prototype, "cogGroupName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], description: 'UUID list of company ids mapped to group' }),
    (0, class_transformer_1.Transform)(({ value }) => toUniqueStringArray(value)),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], SaveCompanyGroupMasterDto.prototype, "cogCompanyIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCompanyGroupMasterDto.prototype, "cogIsActive", void 0);
//# sourceMappingURL=save-company-group-master.dto.js.map