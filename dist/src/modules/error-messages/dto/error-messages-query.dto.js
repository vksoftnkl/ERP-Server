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
exports.ErrorMessagesQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
class ErrorMessagesQueryDto {
    lang;
    since;
}
exports.ErrorMessagesQueryDto = ErrorMessagesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'en',
        nullable: true,
        description: 'Language; else Accept-Language; else en. Only en has rows today.',
    }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], ErrorMessagesQueryDto.prototype, "lang", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-15.1',
        nullable: true,
        description: 'The catalogue version the app holds: the same → `unchanged` and no rows.',
    }),
    (0, dtoDecorators_1.NullableString)(40),
    __metadata("design:type", Object)
], ErrorMessagesQueryDto.prototype, "since", void 0);
//# sourceMappingURL=error-messages-query.dto.js.map