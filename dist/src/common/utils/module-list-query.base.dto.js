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
exports.SalesListQueryBaseDto = exports.PurchaseListQueryBaseDto = exports.InventoryListQueryBaseDto = exports.FixedListQueryBaseDto = exports.AccountsListQueryBaseDto = exports.ModuleListQueryBaseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../dto/dtoDecorators");
class ModuleListQueryBaseDto {
    search;
    page;
    limit;
}
exports.ModuleListQueryBaseDto = ModuleListQueryBaseDto;
exports.AccountsListQueryBaseDto = ModuleListQueryBaseDto;
exports.FixedListQueryBaseDto = ModuleListQueryBaseDto;
exports.InventoryListQueryBaseDto = ModuleListQueryBaseDto;
exports.PurchaseListQueryBaseDto = ModuleListQueryBaseDto;
exports.SalesListQueryBaseDto = ModuleListQueryBaseDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(200),
    __metadata("design:type", String)
], ModuleListQueryBaseDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], ModuleListQueryBaseDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 100, default: 20 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 100),
    __metadata("design:type", Number)
], ModuleListQueryBaseDto.prototype, "limit", void 0);
//# sourceMappingURL=module-list-query.base.dto.js.map