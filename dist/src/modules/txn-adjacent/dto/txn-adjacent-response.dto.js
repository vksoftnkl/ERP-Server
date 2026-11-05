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
exports.TxnAdjacentErrorResponseDto = exports.TxnAdjacentErrorDetailDto = exports.TxnAdjacentSuccessDto = exports.TxnAdjacentPayloadDto = exports.TxnAdjacentDocDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const txn_adjacent_registry_1 = require("../txn-adjacent.registry");
class TxnAdjacentDocDto {
    docId;
    companyId;
    branchId;
    accYear;
    typeCode;
    refno;
    date;
    status;
}
exports.TxnAdjacentDocDto = TxnAdjacentDocDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TxnAdjacentDocDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TxnAdjacentDocDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TxnAdjacentDocDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], TxnAdjacentDocDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'OPENING',
        description: 'The row’s own type: svh_voucher_type, the *_doc_type, or the voucher type code.',
    }),
    __metadata("design:type", String)
], TxnAdjacentDocDto.prototype, "typeCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        nullable: true,
        description: 'null on a draft that has no number yet (a sale bill, a voucher).',
    }),
    __metadata("design:type", Object)
], TxnAdjacentDocDto.prototype, "refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-23' }),
    __metadata("design:type", String)
], TxnAdjacentDocDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'POSTED' }),
    __metadata("design:type", String)
], TxnAdjacentDocDto.prototype, "status", void 0);
class TxnAdjacentPayloadDto {
    docType;
    direction;
    fromDocId;
    doc;
}
exports.TxnAdjacentPayloadDto = TxnAdjacentPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: txn_adjacent_registry_1.TXN_DOC_TYPES }),
    __metadata("design:type", String)
], TxnAdjacentPayloadDto.prototype, "docType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['prev', 'next'] }),
    __metadata("design:type", String)
], TxnAdjacentPayloadDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: 'null when the walk started from an empty screen.',
    }),
    __metadata("design:type", Object)
], TxnAdjacentPayloadDto.prototype, "fromDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: TxnAdjacentDocDto,
        nullable: true,
        description: 'null at either end of the list.',
    }),
    __metadata("design:type", Object)
], TxnAdjacentPayloadDto.prototype, "doc", void 0);
class TxnAdjacentSuccessDto {
    success;
    message;
    data;
}
exports.TxnAdjacentSuccessDto = TxnAdjacentSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TxnAdjacentSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TxnAdjacentSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TxnAdjacentPayloadDto }),
    __metadata("design:type", TxnAdjacentPayloadDto)
], TxnAdjacentSuccessDto.prototype, "data", void 0);
class TxnAdjacentErrorDetailDto {
    field;
    message;
    code;
}
exports.TxnAdjacentErrorDetailDto = TxnAdjacentErrorDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TxnAdjacentErrorDetailDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TxnAdjacentErrorDetailDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TXN_DOC_NOT_FOUND' }),
    __metadata("design:type", String)
], TxnAdjacentErrorDetailDto.prototype, "code", void 0);
class TxnAdjacentErrorResponseDto {
    success;
    message;
    errors;
}
exports.TxnAdjacentErrorResponseDto = TxnAdjacentErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TxnAdjacentErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TxnAdjacentErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [TxnAdjacentErrorDetailDto] }),
    __metadata("design:type", Array)
], TxnAdjacentErrorResponseDto.prototype, "errors", void 0);
//# sourceMappingURL=txn-adjacent-response.dto.js.map