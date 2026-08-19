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
exports.GetChargeMasterQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const charge_master_api_types_1 = require("../types/charge-master-api.types");
class GetChargeMasterQueryDto {
    chgId;
    chgModule;
}
exports.GetChargeMasterQueryDto = GetChargeMasterQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Fetch a single charge by id' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetChargeMasterQueryDto.prototype, "chgId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: charge_master_api_types_1.CHARGE_MODULES,
        description: 'Fetch every active charge for a module. P also returns B (both) charges, S also returns B, B returns B only.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(1),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_MODULES),
    __metadata("design:type", String)
], GetChargeMasterQueryDto.prototype, "chgModule", void 0);
//# sourceMappingURL=get-charge-master-query.dto.js.map