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
exports.TxnAdjacentQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const txn_adjacent_registry_1 = require("../txn-adjacent.registry");
class TxnAdjacentQueryDto {
    docType;
    companyId;
    branchId;
    accYear;
    docId;
    direction;
    typeCode;
    status;
    fromDate;
    toDate;
}
exports.TxnAdjacentQueryDto = TxnAdjacentQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: txn_adjacent_registry_1.TXN_DOC_TYPES, example: 'OPENING_STOCK' }),
    (0, class_validator_1.IsIn)(txn_adjacent_registry_1.TXN_DOC_TYPES),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "docType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: 'The year — the partition the walk stays in.' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{4}$/),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The document on screen. Omit on an empty screen: prev → the newest document, next → the oldest.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['prev', 'next'],
        description: 'prev = the document entered just BEFORE this one (older); next = just after.',
    }),
    (0, class_validator_1.IsIn)(['prev', 'next']),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'ISSUE',
        description: 'Walk one type only. VOUCHER: a register voucher type code (Jrl, Con, RcpV …), as ' +
            '/vouchers/adjacent. STOCK_ADJUSTMENT: ADJUSTMENT | ISSUE | DAMAGE | EXPIRY_WRITEOFF. ' +
            'A sales document: its `*_doc_type` (TAX_INVOICE …). Omit to walk every type the list shows.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "typeCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'POSTED',
        description: "The list's status filter, if set — one of the docType's own statuses.",
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-01', description: "The list's from-date, if set." }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-30', description: "The list's to-date, if set." }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], TxnAdjacentQueryDto.prototype, "toDate", void 0);
//# sourceMappingURL=txn-adjacent-query.dto.js.map