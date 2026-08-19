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
exports.DeleteLoyaltySchemeQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const loyalty_scheme_id_query_dto_1 = require("./loyalty-scheme-id-query.dto");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
class DeleteLoyaltySchemeQueryDto extends loyalty_scheme_id_query_dto_1.LoyaltySchemeIdQueryDto {
    ls_updated_by;
}
exports.DeleteLoyaltySchemeQueryDto = DeleteLoyaltySchemeQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], DeleteLoyaltySchemeQueryDto.prototype, "ls_updated_by", void 0);
//# sourceMappingURL=delete-loyalty-scheme-query.dto.js.map