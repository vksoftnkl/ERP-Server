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
exports.ListUiTableMasterQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class ListUiTableMasterQueryDto {
    uiTableId;
    uiTblId;
    search;
}
exports.ListUiTableMasterQueryDto = ListUiTableMasterQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'UI table id — selects a specific configured grid for display' }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], ListUiTableMasterQueryDto.prototype, "uiTableId", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], ListUiTableMasterQueryDto.prototype, "uiTblId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 255, description: 'Search by UI table name' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(255),
    __metadata("design:type", String)
], ListUiTableMasterQueryDto.prototype, "search", void 0);
//# sourceMappingURL=list-ui-table-master-query.dto.js.map