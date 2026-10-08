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
exports.DropdownRunResponseDto = exports.DropdownRunDataDto = exports.DropdownRunMetaDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class DropdownRunMetaDto {
    page;
    limit;
    total;
}
exports.DropdownRunMetaDto = DropdownRunMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], DropdownRunMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], DropdownRunMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], DropdownRunMetaDto.prototype, "total", void 0);
class DropdownRunDataDto {
    items;
    meta;
}
exports.DropdownRunDataDto = DropdownRunDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Rows returned by the dropdown SQL query', type: [Object] }),
    __metadata("design:type", Array)
], DropdownRunDataDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DropdownRunMetaDto }),
    __metadata("design:type", DropdownRunMetaDto)
], DropdownRunDataDto.prototype, "meta", void 0);
class DropdownRunResponseDto {
    success;
    message;
    data;
}
exports.DropdownRunResponseDto = DropdownRunResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DropdownRunResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Dropdown data fetched successfully' }),
    __metadata("design:type", String)
], DropdownRunResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DropdownRunDataDto }),
    __metadata("design:type", DropdownRunDataDto)
], DropdownRunResponseDto.prototype, "data", void 0);
//# sourceMappingURL=dropdown-run-response.dto.js.map