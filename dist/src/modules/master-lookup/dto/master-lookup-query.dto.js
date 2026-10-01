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
exports.MasterLookupQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const master_lookup_api_types_1 = require("../types/master-lookup-api.types");
const normalizeLookupModuleAlias = (value) => value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const LOOKUP_MODULE_ALIAS_MAP = Object.fromEntries(master_lookup_api_types_1.LOOKUP_MODULE_KEYS.flatMap((moduleKey) => [moduleKey, ...master_lookup_api_types_1.LOOKUP_MODULE_ALIASES[moduleKey]].map((alias) => [
    normalizeLookupModuleAlias(alias),
    moduleKey,
])));
const toOptionalLookupModule = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    const canonical = master_lookup_api_types_1.LOOKUP_MODULE_KEYS.find((moduleKey) => moduleKey.toLowerCase() === trimmed.toLowerCase());
    if (canonical) {
        return canonical;
    }
    return LOOKUP_MODULE_ALIAS_MAP[normalizeLookupModuleAlias(trimmed)] ?? trimmed;
};
const toOptionalId = (value) => {
    if (typeof value !== 'string') {
        return value === undefined || value === null ? undefined : value;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};
class MasterLookupQueryDto {
    module;
    id;
}
exports.MasterLookupQueryDto = MasterLookupQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: master_lookup_api_types_1.LOOKUP_MODULE_KEYS,
        description: 'When provided, returns only the selected module id-name list. Also accepts route/display aliases such as item-group-master, tax-master, gsp-service-master, statecode, pricelevel, and hsncode.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalLookupModule(value)),
    (0, class_validator_1.IsIn)(master_lookup_api_types_1.LOOKUP_MODULE_KEYS),
    __metadata("design:type", String)
], MasterLookupQueryDto.prototype, "module", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "Narrows the result to the single row carrying this id, as the module's own table keys it — a UUID for most masters, but the state code for stateCodes, the HSN code for hsnCodes and a number for priceLevels / tenderTypes. Matched exactly against the option id. With `module` it is a by-id read of that master; without one, every module is searched. No row matching returns an empty list, not a 404.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalId(value)),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MasterLookupQueryDto.prototype, "id", void 0);
//# sourceMappingURL=master-lookup-query.dto.js.map